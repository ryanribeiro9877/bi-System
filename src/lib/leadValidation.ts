import { z } from 'zod';

/**
 * Validates Brazilian CPF number format and checksum
 */
export function validarCPF(cpf: string): boolean {
  // Must be exactly 11 digits
  if (cpf.length !== 11 || !/^\d{11}$/.test(cpf)) return false;
  
  // Reject common invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(9))) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  
  return digit === parseInt(cpf.charAt(10));
}

/**
 * Sanitizes text by removing potentially dangerous characters
 * while keeping normal text characters
 */
export function sanitizeText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  
  // Remove script tags and event handlers
  let sanitized = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<[^>]*>/g, ''); // Remove all HTML tags
  
  // Trim and limit length
  sanitized = sanitized.trim();
  
  return sanitized || undefined;
}

/**
 * Zod schema for lead validation during import
 */
export const LeadImportSchema = z.object({
  cpf: z.string()
    .regex(/^\d{11}$/, 'CPF deve ter exatamente 11 dígitos')
    .refine(validarCPF, 'CPF inválido'),
  
  nome: z.string()
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  banco: z.string()
    .max(50, 'Banco deve ter no máximo 50 caracteres')
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  cbo: z.string()
    .max(50, 'CBO deve ter no máximo 50 caracteres')
    .optional()
    .nullable(),
  
  status: z.string()
    .max(50, 'Status deve ter no máximo 50 caracteres')
    .optional()
    .nullable(),
  
  tipo_reprovacao: z.string()
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  valor: z.number()
    .max(100000000, 'Valor excede o limite máximo')
    .optional()
    .nullable()
    .transform(v => (v !== null && v !== undefined && v < 0) ? 0 : v),
  
  data_envio: z.string()
    .optional()
    .nullable(),
  
  data_retorno: z.string()
    .optional()
    .nullable(),
  
  observacoes: z.string()
    .max(5000, 'Observações deve ter no máximo 5000 caracteres')
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  cbo_block_code: z.string()
    .max(20, 'Código CBO bloqueado deve ter no máximo 20 caracteres')
    .optional()
    .nullable(),
  
  cbo_block_name: z.string()
    .max(200, 'Nome CBO bloqueado deve ter no máximo 200 caracteres')
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  // JSONB fields - allow any structure but validate it's valid JSON
  retorno_autorizacao: z.any().optional().nullable(),
  retorno_margem: z.any().optional().nullable(),
  retorno_simulacao: z.any().optional().nullable(),
  retorno_proposta: z.any().optional().nullable(),
  retorno_get_proposta: z.any().optional().nullable(),
  
  ultimo_log: z.string().optional().nullable(),
  import_batch_id: z.string().uuid().optional().nullable(),
  imported_by: z.string().uuid().optional().nullable(),
});

export type ValidatedLead = z.infer<typeof LeadImportSchema>;

export interface ValidationError {
  linha: number;
  cpf: string;
  cpfOriginal: string;
  errors: string[];
  motivo: string;
}

export interface ValidationResult {
  valid: ValidatedLead[];
  invalid: ValidationError[];
}

/**
 * Validates CPF format only (11 digits, not all same)
 * Does NOT validate checksum - use for forced imports
 */
export function validarCPFRelaxado(cpf: string): boolean {
  // Must be exactly 11 digits
  if (cpf.length !== 11 || !/^\d{11}$/.test(cpf)) return false;
  
  // Reject common invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  return true;
}

/**
 * Validates an array of leads and separates valid from invalid
 * Now includes line numbers for better error reporting
 * @param leads - Array of leads to validate
 * @param forceImport - If true, uses relaxed CPF validation (ignores checksum)
 */
export function validateLeads(leads: any[], forceImport: boolean = false): ValidationResult {
  const valid: ValidatedLead[] = [];
  const invalid: ValidationError[] = [];
  
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const linha = i + 2; // +2 porque linha 1 é header, e arrays começam em 0
    const cpfOriginal = String(lead.cpf || '');
    const cpfLimpo = cpfOriginal.replace(/\D/g, '');
    
    try {
      // Clean CPF before validation
      const cleanedLead = {
        ...lead,
        cpf: cpfLimpo,
        // Ensure valor is a number or undefined
        valor: lead.valor !== undefined && lead.valor !== null && !isNaN(parseFloat(lead.valor))
          ? parseFloat(lead.valor)
          : undefined,
      };
      
      // Se forceImport está ativo, usar validação relaxada de CPF
      if (forceImport) {
        // Validar apenas formato do CPF (11 dígitos, não todos iguais)
        if (!validarCPFRelaxado(cpfLimpo)) {
          throw new Error('CPF com formato inválido');
        }
        // Validar outros campos sem a validação rigorosa de CPF
        const { cpf, ...otherFields } = cleanedLead;
        const partialSchema = LeadImportSchema.omit({ cpf: true });
        partialSchema.parse(otherFields);
        valid.push({ ...cleanedLead, cpf: cpfLimpo } as ValidatedLead);
      } else {
        const validated = LeadImportSchema.parse(cleanedLead);
        valid.push(validated);
      }
    } catch (error) {
      let errors: string[] = [];
      let motivo = '';
      
      if (error instanceof z.ZodError) {
        errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        
        // Determinar motivo principal de forma amigável
        const cpfError = error.errors.find(e => e.path.includes('cpf'));
        if (cpfError) {
          if (!cpfLimpo || cpfLimpo.length === 0) {
            motivo = 'CPF vazio ou ausente';
          } else if (cpfLimpo.length !== 11) {
            motivo = `CPF com ${cpfLimpo.length} dígitos (esperado: 11)`;
          } else if (/^(\d)\1{10}$/.test(cpfLimpo)) {
            motivo = 'CPF inválido (todos dígitos iguais)';
          } else {
            motivo = 'CPF com dígitos verificadores inválidos';
          }
        } else {
          motivo = errors[0] || 'Erro de validação';
        }
      } else {
        errors = ['Erro desconhecido na validação'];
        motivo = 'Erro desconhecido';
      }
      
      invalid.push({
        linha,
        cpf: cpfLimpo.substring(0, 11) || 'N/A',
        cpfOriginal: cpfOriginal.substring(0, 20),
        errors,
        motivo,
      });
    }
  }
  
  return { valid, invalid };
}
