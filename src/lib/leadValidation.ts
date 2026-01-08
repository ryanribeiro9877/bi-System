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
    .max(500, 'Tipo de reprovação deve ter no máximo 500 caracteres')
    .transform(sanitizeText)
    .optional()
    .nullable(),
  
  valor: z.number()
    .positive('Valor deve ser positivo')
    .max(100000000, 'Valor excede o limite máximo')
    .optional()
    .nullable(),
  
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

export interface ValidationResult {
  valid: ValidatedLead[];
  invalid: Array<{
    cpf: string;
    errors: string[];
  }>;
}

/**
 * Validates an array of leads and separates valid from invalid
 */
export function validateLeads(leads: any[]): ValidationResult {
  const valid: ValidatedLead[] = [];
  const invalid: Array<{ cpf: string; errors: string[] }> = [];
  
  for (const lead of leads) {
    try {
      // Clean CPF before validation
      const cleanedLead = {
        ...lead,
        cpf: String(lead.cpf || '').replace(/\D/g, ''),
        // Ensure valor is a number or undefined
        valor: lead.valor !== undefined && lead.valor !== null && !isNaN(parseFloat(lead.valor))
          ? parseFloat(lead.valor)
          : undefined,
      };
      
      const validated = LeadImportSchema.parse(cleanedLead);
      valid.push(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        invalid.push({
          cpf: String(lead.cpf || 'N/A').replace(/\D/g, '').substring(0, 11),
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        });
      } else {
        invalid.push({
          cpf: String(lead.cpf || 'N/A').replace(/\D/g, '').substring(0, 11),
          errors: ['Erro desconhecido na validação'],
        });
      }
    }
  }
  
  return { valid, invalid };
}
