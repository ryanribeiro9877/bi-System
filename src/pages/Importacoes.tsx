import { useState, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, FileText, Check, X, Loader2, AlertCircle, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { importEvents } from "@/events/importEvents";
import { parseJsonSafe } from "@/types/lead";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";
import { extrairCBOUniversal } from "@/lib/cboUtils";

const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) console.log(...args);
};
import { validateLeads, ValidationError } from "@/lib/leadValidation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImportRecord {
  id: string;
  file_name: string;
  file_type: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  status: string;
  created_at: string;
}

interface ParsedLead {
  cpf: string;
  nome?: string;
  banco?: string;
  cbo?: string;
  status?: string;
  tipo_reprovacao?: string;
  valor?: number;
  data_envio?: string;
  data_retorno?: string;
  observacoes?: string;
  // Novos campos JSONB
  retorno_autorizacao?: Record<string, unknown>;
  retorno_margem?: Record<string, unknown>;
  retorno_simulacao?: Record<string, unknown>;
  retorno_proposta?: Record<string, unknown>;
  retorno_get_proposta?: Record<string, unknown>;
  ultimo_log?: string;
  // Campos de CBO bloqueado extraídos
  cbo_block_code?: string;
  cbo_block_name?: string;
}

// Função para extrair CBO bloqueado buscando em múltiplas fontes de dados
// Formato esperado: "CBO bloqueado: 123456 - Nome do CBO" ou variações
// Suporta todos os bancos: V8, UY3, PRESENÇA
const extrairCBOBloqueadoFromText = (texto: string | undefined): { code: string | undefined; name: string | undefined } => {
  if (!texto) return { code: undefined, name: undefined };
  
  // Padrões de regex para diferentes formatos de CBO bloqueado
  const patterns = [
    // "CBO bloqueado: 123456 - Nome do CBO"
    /cbo\s*bloqueado[:\s]+(\d+)\s*[-–—]\s*([^,.()\n]+)/i,
    // "CBO: 123456 - Nome do CBO" (formato PRESENÇA)
    /cbo[:\s]+(\d{6})\s*[-–—]\s*([^,.()\n]+)/i,
    // "CBO bloqueado: 123456"
    /cbo\s*bloqueado[:\s]+(\d+)/i,
    // "código CBO 123456"
    /c[oó]digo\s*cbo[:\s]*(\d+)/i,
    // "cbo (123456)"
    /cbo\s*\((\d{6})\)/i,
    // "ocupação bloqueada: 123456 - Nome"
    /ocupa[çc][aã]o\s*bloqueada[:\s]+(\d+)\s*[-–—]\s*([^,.()\n]+)/i,
  ];
  
  // Tenta cada padrão
  for (const pattern of patterns) {
    const match = texto.match(pattern);
    if (match) {
      return {
        code: match[1].trim(),
        name: match[2]?.trim() || undefined
      };
    }
  }
  
  return { code: undefined, name: undefined };
};

// Função principal que busca CBO bloqueado em TODAS as fontes possíveis do lead
const extrairCBOBloqueado = (
  tipoReprovacao: string | undefined, 
  retornoMargem: any,
  retornoSimulacao?: any,
  retornoProposta?: any,
  retornoAutorizacao?: any
): { code: string | undefined; name: string | undefined } => {
  // Lista de textos a serem verificados
  const textosParaBuscar: string[] = [];
  
  // 1. tipo_reprovacao direto
  if (tipoReprovacao) textosParaBuscar.push(tipoReprovacao);
  
  // 2. retorno_margem - busca em várias propriedades
  if (retornoMargem) {
    if (retornoMargem.details?.reason) textosParaBuscar.push(retornoMargem.details.reason);
    if (retornoMargem.message) textosParaBuscar.push(retornoMargem.message);
    if (retornoMargem.error) textosParaBuscar.push(retornoMargem.error);
    // reasonForIneligibility pode ter mensagens de erro
    const validationResponses = retornoMargem.details?.dataprevValidationResponses;
    if (Array.isArray(validationResponses)) {
      validationResponses.forEach((resp: any) => {
        if (Array.isArray(resp.reasonForIneligibility)) {
          resp.reasonForIneligibility.forEach((reason: any) => {
            if (reason.messageError) textosParaBuscar.push(reason.messageError);
            if (reason.errorField) textosParaBuscar.push(reason.errorField);
          });
        }
      });
    }
    // Converter JSON inteiro para string como fallback
    if (typeof retornoMargem === 'object') {
      textosParaBuscar.push(JSON.stringify(retornoMargem));
    }
  }
  
  // 3. retorno_simulacao
  if (retornoSimulacao) {
    if (retornoSimulacao.details?.reason) textosParaBuscar.push(retornoSimulacao.details.reason);
    if (retornoSimulacao.message) textosParaBuscar.push(retornoSimulacao.message);
    if (retornoSimulacao.error) textosParaBuscar.push(retornoSimulacao.error);
  }
  
  // 4. retorno_proposta
  if (retornoProposta) {
    if (retornoProposta.details?.reason) textosParaBuscar.push(retornoProposta.details.reason);
    if (retornoProposta.message) textosParaBuscar.push(retornoProposta.message);
  }
  
  // 5. retorno_autorizacao
  if (retornoAutorizacao) {
    if (retornoAutorizacao.details?.reason) textosParaBuscar.push(retornoAutorizacao.details.reason);
    if (retornoAutorizacao.message) textosParaBuscar.push(retornoAutorizacao.message);
  }
  
  // Buscar em cada texto
  for (const texto of textosParaBuscar) {
    const resultado = extrairCBOBloqueadoFromText(texto);
    if (resultado.code) {
      return resultado;
    }
  }
  
  return { code: undefined, name: undefined };
};

// Função para extrair nome do JSON - busca em TODAS as colunas disponíveis
const extrairNomeDoJson = (margem: any, simulacao?: any, getProposta?: any, proposta?: any, autorizacao?: any): string | undefined => {
  // Busca em todas as fontes possíveis
  const fontes = [
    // retorno_get_proposta
    getProposta?.name,
    // retorno_margem
    margem?.registroEmpregaticio?.nomeEmpregado,
    margem?.nomeEmpregado,
    margem?.nome,
    // retorno_simulacao
    simulacao?.details?.name,
    simulacao?.name,
    simulacao?.nomeCliente,
    // retorno_proposta
    proposta?.name,
    proposta?.nomeCliente,
    proposta?.nome,
    // retorno_autorizacao
    autorizacao?.name,
    autorizacao?.nomeCliente,
  ];
  
  return fontes.find(v => v && typeof v === 'string' && v.trim().length > 0);
};

// Função para extrair CBO do JSON - busca em TODAS as colunas disponíveis
const extrairCBODoJson = (
  margem: unknown,
  simulacao?: unknown,
  getProposta?: unknown,
  proposta?: unknown,
  autorizacao?: unknown
): string | undefined => {
  // Primeiro: tenta extrair pelo helper universal (cobre Dataprev/UY3 + variações)
  const candidatos = [margem, simulacao, getProposta, proposta, autorizacao];
  for (const c of candidatos) {
    const cbo = extrairCBOUniversal(c);
    if (cbo) return cbo;
  }

  // Fallback: procurar por chaves mais comuns em cada retorno
  const objs = candidatos.map((v) => parseJsonSafe<any>(v)).filter(Boolean);
  const fontes = [
    // retorno_margem
    objs[0]?.registroEmpregaticio?.cbo,
    objs[0]?.cbo,
    objs[0]?.occupation,
    // retorno_simulacao
    objs[1]?.details?.cbo,
    objs[1]?.cbo,
    objs[1]?.details?.occupation,
    objs[1]?.occupation,
    // retorno_get_proposta
    objs[2]?.cbo,
    objs[2]?.occupation,
    // retorno_proposta
    objs[3]?.cbo,
    objs[3]?.occupation,
    // retorno_autorizacao
    objs[4]?.cbo,
    objs[4]?.occupation,
  ];

  const found = fontes.find((v) => v && String(v).trim().length > 0);
  return found ? String(found).trim() : undefined;
};

// Função para extrair o banco do NOME DO ARQUIVO importado
// Os bancos possíveis são: V8, UY3 e PRESENÇA
const extrairBancoDoNomeArquivo = (fileName: string): string => {
  const nomeNormalizado = fileName.toLowerCase();
  
  if (nomeNormalizado.includes("v8")) return "V8";
  if (nomeNormalizado.includes("uy3")) return "UY3";
  if (nomeNormalizado.includes("presen") || nomeNormalizado.includes("presença")) return "Presença";
  
  return "Não Informado";
};

// Função para extrair tipo de reprovação - busca em TODAS as colunas
const extrairTipoReprovacao = (simulacao: any, margem: any, getProposta?: any, proposta?: any, autorizacao?: any): string | undefined => {
  const fontes = [
    // retorno_simulacao
    simulacao?.details?.error,
    simulacao?.details?.description,
    simulacao?.error,
    simulacao?.motivo,
    // retorno_margem
    margem?.error,
    margem?.motivo,
    // retorno_get_proposta
    getProposta?.error,
    getProposta?.statusDescription,
    // retorno_proposta
    proposta?.error,
    proposta?.motivo,
    // retorno_autorizacao
    autorizacao?.error,
  ];
  
  const erro = fontes.find(v => v && String(v).trim().length > 0)?.toString();
  
  // Classificar erro 28 (Operation timed out) como "Erro de consulta código 28"
  if (erro) {
    const erroLower = erro.toLowerCase();
    if (erroLower.includes("error 28") || erroLower.includes("operation timed out")) {
      return "Erro de consulta código 28";
    }
  }
  
  return erro;
};

// Função para extrair valor - busca liquidValue em retorno_simulacao
// Suporta múltiplos formatos/estruturas do retorno_simulacao
// IMPORTANTE: liquidValue vem em centavos (sem separadores), então divide por 100
const extrairValorMargem = (simulacao: any, margem?: any, getProposta?: any, proposta?: any): number | undefined => {
  if (!simulacao) return undefined;
  
  // Múltiplos padrões para encontrar liquidValue no retorno_simulacao
  const fontes = [
    // Padrão 1: liquidValue direto na raiz
    simulacao?.liquidValue,
    
    // Padrão 2: liquidValue dentro de details
    simulacao?.details?.liquidValue,
    
    // Padrão 3: liquidValue dentro de result
    simulacao?.result?.liquidValue,
    
    // Padrão 4: liquidValue dentro de data
    simulacao?.data?.liquidValue,
    
    // Padrão 5: liquidValue dentro de response
    simulacao?.response?.liquidValue,
    
    // Padrão 6: liquidValue dentro de simulation
    simulacao?.simulation?.liquidValue,
    
    // Padrão 7: Array - primeiro item com liquidValue
    Array.isArray(simulacao) ? simulacao[0]?.liquidValue : undefined,
    
    // Padrão 8: Array dentro de result
    Array.isArray(simulacao?.result) ? simulacao.result[0]?.liquidValue : undefined,
    
    // Padrão 9: Array dentro de data
    Array.isArray(simulacao?.data) ? simulacao.data[0]?.liquidValue : undefined,
    
    // Padrão 10: Variações de nome (camelCase, snake_case, etc)
    simulacao?.liquid_value,
    simulacao?.details?.liquid_value,
    simulacao?.LiquidValue,
    simulacao?.details?.LiquidValue,
  ];
  
  const valorBruto = fontes.find(v => v !== undefined && v !== null && v !== 0);
  if (valorBruto === undefined) return undefined;
  
  // Converte para número e divide por 100 (valor vem em centavos)
  const valorNumerico = parseFloat(String(valorBruto));
  return valorNumerico / 100;
};

// Função para determinar status baseado nos retornos - suporta múltiplos formatos
/**
 * Determina o status do lead usando a lógica centralizada
 * que prioriza valores financeiros sobre mensagens de erro
 */
const determinarStatus = (
  simulacao: any, 
  proposta: any, 
  getProposta: any, 
  margem: any,
  banco?: string
): string => {
  try {
    // Usar a função centralizada que implementa o "filtro de sucesso"
    return normalizarStatusLead({
      banco: banco || null,
      retorno_margem: margem,
      retorno_simulacao: simulacao,
      retorno_proposta: proposta,
      retorno_get_proposta: getProposta,
    });
  } catch (error) {
    console.error("[determinarStatus] Erro ao normalizar status:", error);
    return "pendente"; // Fallback seguro
  }
};

const Importacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [previewData, setPreviewData] = useState<ParsedLead[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);
  const [forceImport, setForceImport] = useState(false);

  // Função para excluir uma importação e seus leads associados
  const handleDeleteImport = async (importId: string, fileName: string) => {
    devLog(`[Importacoes] Iniciando exclusão da importação: ${importId} (${fileName})`);
    setDeletingImportId(importId);
    
    try {
      // 1. Primeiro, contar quantos leads serão excluídos
      const { count: leadsCount, error: countError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("import_batch_id", importId);
      
      devLog(`[Importacoes] Leads a serem excluídos: ${leadsCount}`);
      
      if (countError) {
        console.error("Erro ao contar leads:", countError);
      }
      
      // 2. Excluir todos os leads associados a essa importação
      const { error: leadsError, count: deletedLeadsCount } = await supabase
        .from("leads")
        .delete({ count: "exact" })
        .eq("import_batch_id", importId);
      
      devLog(`[Importacoes] Leads excluídos: ${deletedLeadsCount}, Erro: ${leadsError?.message || 'nenhum'}`);
      
      if (leadsError) {
        console.error("Erro ao excluir leads:", leadsError);
        toast({
          title: "Erro ao excluir leads",
          description: leadsError.message,
          variant: "destructive",
        });
        setDeletingImportId(null);
        return;
      }
      
      // 3. Excluir o registro de importação
      const { error: importError } = await supabase
        .from("imports")
        .delete()
        .eq("id", importId);
      
      devLog(`[Importacoes] Importação excluída, Erro: ${importError?.message || 'nenhum'}`);
      
      if (importError) {
        console.error("Erro ao excluir importação:", importError);
        toast({
          title: "Erro ao excluir importação",
          description: importError.message,
          variant: "destructive",
        });
        setDeletingImportId(null);
        return;
      }
      
      // 4. Atualizar a lista de importações localmente
      setImports(prev => prev.filter(imp => imp.id !== importId));
      
      // 5. Emitir evento para atualizar dashboard e outras páginas
      devLog(`[Importacoes] Emitindo evento de atualização...`);
      importEvents.emit();
      
      toast({
        title: "Importação excluída com sucesso",
        description: `A importação "${fileName}" e ${deletedLeadsCount || leadsCount || 0} leads foram removidos permanentemente.`,
      });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao tentar excluir a importação.",
        variant: "destructive",
      });
    } finally {
      setDeletingImportId(null);
    }
  };

  // Fetch import history
  const fetchImports = useCallback(async () => {
    const { data, error } = await supabase
      .from("imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setImports(data);
    }
  }, []);

  // Load imports on mount
  useEffect(() => {
    if (user) {
      fetchImports();
    }
  }, [user, fetchImports]);

  const normalizeColumnName = (col: string): string => {
    const normalized = col
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    
    const mappings: Record<string, string> = {
      // Mapeamentos originais
      "cpf": "cpf",
      "documento": "cpf",
      "nome": "nome",
      "nome_completo": "nome",
      "banco": "banco",
      "instituicao": "banco",
      "cbo": "cbo",
      "ocupacao": "cbo",
      "status": "status",
      "situacao": "status",
      "tipo_reprovacao": "tipo_reprovacao",
      "motivo_reprovacao": "tipo_reprovacao",
      "motivo": "tipo_reprovacao",
      "valor": "valor",
      "valor_contrato": "valor",
      "data_envio": "data_envio",
      "data_retorno": "data_retorno",
      "observacoes": "observacoes",
      "obs": "observacoes",
      // Novos mapeamentos para os campos JSON
      "retorno_autorizacao": "retorno_autorizacao",
      "retorno_margem": "retorno_margem",
      "retorno_simulacao": "retorno_simulacao",
      "retorno_proposta": "retorno_proposta",
      "retorno_get_proposta": "retorno_get_proposta",
      "retornogetproposta": "retorno_get_proposta",
      "ultimo_log": "ultimo_log",
    };

    return mappings[normalized] || normalized;
  };

  // Função para converter data do Excel para string formatada
  const parseExcelDate = (value: any): string | undefined => {
    if (!value) return undefined;
    
    // Se já é uma string no formato esperado, retorna direto
    if (typeof value === 'string') {
      // Verificar se já está no formato correto (YYYY-MM-DD HH:MM:SS ou similar)
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
        return value;
      }
    }
    
    // Se é um número serial do Excel
    if (typeof value === 'number') {
      // Excel usa epoch 1900-01-01, com bug do ano bissexto
      // Número serial = dias desde 1899-12-30 (Excel considera 1900 como bissexto incorretamente)
      const excelEpoch = new Date(1899, 11, 30);
      const days = Math.floor(value);
      const fraction = value - days;
      
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      
      // Calcular horas, minutos, segundos da fração do dia
      const totalSeconds = Math.round(fraction * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
    }
    
    return String(value);
  };

  // Função auxiliar para processar uma linha do Excel
  const processExcelRow = (row: Record<string, unknown>, fileName: string): ParsedLead => {
    const lead: ParsedLead = { cpf: "" };
    
    // Processar cada coluna - apenas campos essenciais primeiro
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const normalizedKey = normalizeColumnName(key);
      const value = row[key];
      
      switch (normalizedKey) {
        case "cpf":
          lead.cpf = String(value).replace(/\D/g, "");
          break;
        case "nome":
          lead.nome = value as string;
          break;
        case "banco":
          lead.banco = value as string;
          break;
        case "cbo":
          lead.cbo = value as string;
          break;
        case "status":
          lead.status = value as string;
          break;
        case "tipo_reprovacao":
          lead.tipo_reprovacao = value as string;
          break;
        case "valor":
          lead.valor = parseFloat(String(value)) || undefined;
          break;
        case "data_envio":
          lead.data_envio = value as string;
          break;
        case "data_retorno":
          lead.data_retorno = value as string;
          break;
        case "observacoes":
          lead.observacoes = value as string;
          break;
        case "retorno_autorizacao":
          lead.retorno_autorizacao = parseJsonSafe(value);
          break;
        case "retorno_margem":
          lead.retorno_margem = parseJsonSafe(value);
          break;
        case "retorno_simulacao":
          lead.retorno_simulacao = parseJsonSafe(value);
          break;
        case "retorno_proposta":
          lead.retorno_proposta = parseJsonSafe(value);
          break;
        case "retorno_get_proposta":
          lead.retorno_get_proposta = parseJsonSafe(value);
          break;
        case "ultimo_log":
          lead.ultimo_log = parseExcelDate(value);
          break;
      }
    }
    
    // Extrair dados adicionais - com try-catch para evitar erros
    try {
      // Verificar se retorno_margem precisa de parse
      if (typeof lead.retorno_margem === 'string' && lead.retorno_margem.startsWith('{')) {
        devLog(`[processExcelRow] retorno_margem é string JSON para CPF ${lead.cpf}`);
        lead.retorno_margem = parseJsonSafe(lead.retorno_margem);
      }
      
      if (!lead.nome) {
        lead.nome = extrairNomeDoJson(lead.retorno_margem, lead.retorno_simulacao, lead.retorno_get_proposta, lead.retorno_proposta, lead.retorno_autorizacao);
      }
      if (!lead.cbo) {
        lead.cbo = extrairCBODoJson(lead.retorno_margem, lead.retorno_simulacao, lead.retorno_get_proposta, lead.retorno_proposta, lead.retorno_autorizacao);
        // Log para depurar CBO
        if (lead.cbo) {
          devLog(`[processExcelRow] CBO extraído para CPF ${lead.cpf}:`, lead.cbo);
        } else {
          devLog(`[processExcelRow] CBO NÃO encontrado para CPF ${lead.cpf}`);
        }
      }
      lead.banco = extrairBancoDoNomeArquivo(fileName);
      if (!lead.status) {
        lead.status = determinarStatus(lead.retorno_simulacao, lead.retorno_proposta, lead.retorno_get_proposta, lead.retorno_margem, lead.banco);
        // Log para depurar status
        if (lead.status === "reprovacao_tecnica") {
          devLog(`[processExcelRow] Reprovação TÉCNICA para CPF ${lead.cpf}:`, {
            banco: lead.banco,
            status_proposta: (lead.retorno_proposta as any)?.status,
            tem_error: !!(lead.retorno_autorizacao as any)?.error || !!(lead.retorno_margem as any)?.error || !!(lead.retorno_simulacao as any)?.error
          });
        }
      }
      if (!lead.tipo_reprovacao && lead.status === "reprovado") {
        lead.tipo_reprovacao = extrairTipoReprovacao(lead.retorno_simulacao, lead.retorno_margem, lead.retorno_get_proposta, lead.retorno_proposta, lead.retorno_autorizacao);
      }
      if (!lead.valor) {
        lead.valor = extrairValorMargem(lead.retorno_simulacao, lead.retorno_margem, lead.retorno_get_proposta, lead.retorno_proposta);
      }
      if (lead.status === "reprovado") {
        const cboBlock = extrairCBOBloqueado(lead.tipo_reprovacao, lead.retorno_margem, lead.retorno_simulacao, lead.retorno_proposta, lead.retorno_autorizacao);
        lead.cbo_block_code = cboBlock.code;
        lead.cbo_block_name = cboBlock.name;
      }
    } catch (e) {
      // Ignorar erros de extração
    }
    
    return lead;
  };

  const parseExcel = (file: File): Promise<ParsedLead[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          devLog("[parseExcel] Iniciando leitura do arquivo:", file.name);
          const data = new Uint8Array(e.target?.result as ArrayBuffer);

          const XLSX = await import("xlsx");
          
          // Ler workbook com opções otimizadas para memória
          const workbook = XLSX.read(data, { 
            type: "array", 
            cellDates: false,
            cellNF: false,    // Não parsear formatos de número
            cellStyles: false // Não parsear estilos
          });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Obter range da planilha para processar em chunks
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const totalRows = range.e.r - range.s.r;
          devLog("[parseExcel] Total de linhas:", totalRows);
          
          // Converter para JSON em uma única operação (mais eficiente que row-by-row)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });
          
          // Liberar memória do worksheet original
          delete workbook.Sheets[sheetName];
          
          devLog("[parseExcel] Registros JSON:", jsonData.length);
          
          // Processar em chunks para evitar bloqueio da UI
          const leads: ParsedLead[] = [];
          const chunkSize = 500;
          
          for (let i = 0; i < jsonData.length; i += chunkSize) {
            const chunk = jsonData.slice(i, i + chunkSize);
            
            for (const row of chunk) {
              const lead = processExcelRow(row as Record<string, unknown>, file.name);
              if (lead.cpf) {
                leads.push(lead);
              }
            }
            
            // Permitir que a UI respire a cada chunk
            if (i + chunkSize < jsonData.length) {
              await new Promise(r => setTimeout(r, 0));
            }
          }
          
          devLog("[parseExcel] Leads válidos:", leads.length);
          resolve(leads);
        } catch (error) {
          console.error("[parseExcel] Erro:", error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseCSV = (file: File): Promise<ParsedLead[]> => {
    return new Promise((resolve, reject) => {
      (async () => {
        const Papa = (await import("papaparse")).default;
        Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          devLog("[parseCSV] Registros encontrados:", results.data.length);
          
          const leads: ParsedLead[] = [];
          const chunkSize = 500;
          
          // Processar em chunks para evitar Out of Memory
          for (let i = 0; i < results.data.length; i += chunkSize) {
            const chunk = results.data.slice(i, i + chunkSize);
            
            for (const row of chunk) {
              const lead = processExcelRow(row as Record<string, unknown>, file.name);
              if (lead.cpf) {
                leads.push(lead);
              }
            }
            
            // Permitir que a UI respire
            if (i + chunkSize < results.data.length) {
              await new Promise(r => setTimeout(r, 0));
            }
          }
          
          devLog("[parseCSV] Leads válidos:", leads.length);
          resolve(leads);
        },
        error: reject,
        });
      })().catch(reject);
    });
  };

  const handleFileSelect = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    
    if (!["xlsx", "xls", "csv"].includes(extension || "")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      let parsed: ParsedLead[];
      
      devLog("[Importacoes] Processando arquivo:", file.name, "Extensão:", extension);
      
      if (extension === "csv") {
        parsed = await parseCSV(file);
      } else {
        parsed = await parseExcel(file);
      }

      devLog("[Importacoes] Registros parseados:", parsed.length);
      
      if (parsed.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém registros válidos. Verifique se há uma coluna 'cpf'.",
          variant: "destructive",
        });
        setSelectedFile(null);
        return;
      }

      setPreviewData(parsed.slice(0, 10));
      toast({
        title: "Arquivo processado",
        description: `${parsed.length} registros encontrados. Clique em "Importar" para confirmar.`,
      });
    } catch (error: any) {
      console.error("[Importacoes] Erro ao processar arquivo:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: error?.message || "Verifique se o arquivo está no formato correto.",
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !user) return;

    setIsProcessing(true);
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    try {
      let parsed: ParsedLead[];
      if (extension === "csv") {
        parsed = await parseCSV(selectedFile);
      } else {
        parsed = await parseExcel(selectedFile);
      }

      // Validate leads before import (usar validação relaxada se forceImport estiver ativo)
      const validationResult = validateLeads(parsed, forceImport);
      
      // Store validation errors for display
      if (validationResult.invalid.length > 0) {
        console.warn(`[Importacoes] ${validationResult.invalid.length} registros inválidos encontrados durante validação`);
        setValidationErrors(validationResult.invalid);
      } else {
        setValidationErrors([]);
      }

      // Only proceed with valid leads
      const validLeads = validationResult.valid;
      const invalidCount = validationResult.invalid.length;

      if (validLeads.length === 0) {
        toast({
          title: "Nenhum registro válido",
          description: `Todos os ${invalidCount} registros falharam na validação. Verifique os CPFs e outros campos obrigatórios.`,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from("imports")
        .insert({
          file_name: selectedFile.name,
          file_type: extension || "unknown",
          total_records: parsed.length,
          imported_by: user.id,
          status: "processing",
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert leads in batches
      const batchSize = 100;
      let successCount = 0;
      let failCount = invalidCount; // Start with validation failures

      for (let i = 0; i < validLeads.length; i += batchSize) {
        const batch = validLeads.slice(i, i + batchSize).map(lead => ({
          cpf: lead.cpf,
          // Campos obrigatórios (NOT NULL) - garantir valores padrão
          nome: lead.nome || "Não Informado",
          banco: lead.banco || "Não Informado",
          status: lead.status || "pendente",
          // Campos opcionais
          cbo: lead.cbo,
          tipo_reprovacao: lead.tipo_reprovacao,
          valor: lead.valor,
          data_envio: lead.data_envio,
          data_retorno: lead.data_retorno,
          observacoes: lead.observacoes,
          retorno_autorizacao: lead.retorno_autorizacao,
          retorno_margem: lead.retorno_margem,
          retorno_simulacao: lead.retorno_simulacao,
          retorno_proposta: lead.retorno_proposta,
          retorno_get_proposta: lead.retorno_get_proposta,
          ultimo_log: lead.ultimo_log,
          cbo_block_code: lead.cbo_block_code,
          cbo_block_name: lead.cbo_block_name,
          import_batch_id: importRecord.id,
          imported_by: user.id,
        }));

        const { error } = await supabase.from("leads").insert(batch);
        
        if (error) {
          console.error("Erro ao inserir batch:", error);
          failCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Update import record - garantir que o status seja atualizado corretamente
      const finalStatus = successCount > 0 && failCount === 0 ? "completed" : 
                          successCount > 0 && failCount > 0 ? "completed_with_errors" : 
                          "failed";
      
      const { error: updateError } = await supabase
        .from("imports")
        .update({
          successful_records: successCount,
          failed_records: failCount,
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);

      if (updateError) {
        console.error("Erro ao atualizar registro de importação:", updateError);
      }

      const validationMessage = invalidCount > 0 ? ` (${invalidCount} inválidos por CPF ou dados incorretos)` : "";
      toast({
        title: finalStatus === "completed" ? "Importação concluída com sucesso" : "Importação concluída",
        description: `${successCount} registros importados com sucesso${failCount > 0 ? `, ${failCount} falharam${validationMessage}` : ""}.`,
        variant: finalStatus === "completed" ? "default" : "destructive",
      });

      // Emitir evento para sincronização global
      devLog('[Importacoes] Emitindo evento de importação concluída...');
      importEvents.emit();

      setSelectedFile(null);
      setPreviewData([]);
      fetchImports();
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao importar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Sucesso</Badge>;
      case "completed_with_errors":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Com Erros</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processando</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8 overflow-auto w-full min-w-0">
        <div className="max-w-6xl mx-auto space-y-4 lg:space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Importações</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Importe dados de leads através de arquivos Excel ou CSV
            </p>
          </div>

          {/* Upload Area */}
          <Card>
            <CardHeader className="p-4 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Upload className="w-4 h-4 lg:w-5 lg:h-5" />
                Importar Arquivo
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">
                Arraste e solte um arquivo ou clique para selecionar. Formatos aceitos: .xlsx, .xls, .csv
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 pt-0">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-lg p-6 lg:p-12 text-center transition-colors cursor-pointer
                  ${isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3 lg:gap-4">
                    <Loader2 className="w-8 h-8 lg:w-12 lg:h-12 text-primary animate-spin" />
                    <p className="text-sm lg:text-base text-muted-foreground">Processando arquivo...</p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-3 lg:gap-4">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {selectedFile.name.endsWith(".csv") ? (
                        <FileText className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
                      ) : (
                        <FileSpreadsheet className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground text-sm lg:text-base break-all">{selectedFile.name}</p>
                      <p className="text-xs lg:text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 lg:gap-4">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6 lg:w-8 lg:h-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground text-sm lg:text-base">
                        Arraste um arquivo ou clique para selecionar
                      </p>
                      <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                        Suporta Excel (.xlsx, .xls) e CSV (.csv)
                      </p>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel
                      </div>
                      <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        CSV
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedFile && !isProcessing && (
                <>
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewData([]);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleImport}>
                    <Check className="w-4 h-4 mr-2" />
                    Importar {previewData.length > 0 && `(${previewData.length}+ registros)`}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="forceImport"
                    checked={forceImport}
                    onChange={(e) => setForceImport(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="forceImport" className="text-sm text-muted-foreground">
                    Forçar importação (ignorar validação de dígitos verificadores do CPF)
                  </label>
                </div>
              </>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Pré-visualização (primeiros 10 registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">CPF</TableHead>
                        <TableHead className="text-center">Nome</TableHead>
                        <TableHead className="text-center">Banco</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Valor Margem</TableHead>
                        <TableHead className="text-center">Valor Simulação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((lead, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-center">{formatCpf(lead.cpf)}</TableCell>
                          <TableCell className="text-center">{lead.nome || "-"}</TableCell>
                          <TableCell className="text-center">{lead.banco || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              className={
                                lead.status === "aprovado" 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : lead.status === "reprovado"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }
                            >
                              {lead.status || "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {lead.retorno_margem?.valorMargemDisponivel 
                              ? `R$ ${Number(lead.retorno_margem.valorMargemDisponivel).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                              : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {lead.retorno_simulacao?.requestedAmount || lead.retorno_simulacao?.liquidValue
                              ? `R$ ${Number(lead.retorno_simulacao.requestedAmount || lead.retorno_simulacao.liquidValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Errors Panel */}
          {validationErrors.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <X className="w-5 h-5" />
                  Registros com Erro de Validação ({validationErrors.length})
                </CardTitle>
                <CardDescription>
                  Os seguintes registros não foram importados devido a erros de validação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] text-center">Linha</TableHead>
                        <TableHead className="w-[140px] text-center">CPF Original</TableHead>
                        <TableHead className="w-[140px] text-center">CPF Limpo</TableHead>
                        <TableHead className="text-center">Motivo do Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationErrors.map((err, index) => (
                        <TableRow key={index} className="border-red-500/20">
                          <TableCell className="font-mono font-bold text-red-400 text-center">
                            {err.linha}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-center">
                            {err.cpfOriginal || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-center">
                            {err.cpf || "-"}
                          </TableCell>
                          <TableCell className="text-red-300 text-center">
                            {err.motivo}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setValidationErrors([])}
                  >
                    Limpar Erros
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Importações</CardTitle>
              <CardDescription>
                Últimas importações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma importação realizada ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Arquivo</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-center">Importados</TableHead>
                      <TableHead className="text-center">Original</TableHead>
                      <TableHead className="text-center">Falhas</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Data</TableHead>
                      <TableHead className="w-[80px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="font-medium text-center">{imp.file_name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="uppercase">
                            {imp.file_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-400 font-medium text-center">{imp.successful_records}</TableCell>
                        <TableCell className="text-muted-foreground text-center">{imp.total_records}</TableCell>
                        <TableCell className="text-red-400 text-center">{imp.failed_records}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(imp.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-center">
                          {new Date(imp.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                disabled={deletingImportId === imp.id}
                              >
                                {deletingImportId === imp.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Importação</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                  <p>
                                    Tem certeza que deseja excluir a importação <strong>"{imp.file_name}"</strong>?
                                  </p>
                                  <p className="text-red-400 font-medium">
                                    Esta ação irá remover permanentemente:
                                  </p>
                                  <ul className="list-disc list-inside text-red-400">
                                    <li>O registro de importação</li>
                                    <li>Todos os {imp.successful_records} leads importados</li>
                                  </ul>
                                  <p className="text-muted-foreground text-sm">
                                    Esta ação não pode ser desfeita.
                                  </p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteImport(imp.id, imp.file_name)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir Permanentemente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Modelo de Arquivo
              </CardTitle>
              <CardDescription>
                Baixe um modelo para garantir que seus dados estão no formato correto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const headers = [
                      "CPF", 
                      "RETORNO AUTORIZACAO", 
                      "RETORNO MARGEM", 
                      "RETORNO SIMULACAO", 
                      "RETORNO PROPOSTA", 
                      "RETORNO GET PROPOSTA", 
                      "ULTIMO LOG"
                    ];
                    const sampleRow = [
                      "12345678901", 
                      '{"autorizacaoId":"xxx","shortUrl":"https://..."}',
                      '{"valorMargemDisponivel":1000,"registroEmpregaticio":{"nomeEmpregado":"João"}}',
                      '{"requestedAmount":5000,"numberOfPayments":24}',
                      "",
                      "",
                      "2024-01-01 10:00:00"
                    ];
                    (async () => {
                      const XLSX = await import("xlsx");
                      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Modelo");
                      XLSX.writeFile(wb, "modelo_importacao.xlsx");
                    })();
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Baixar Modelo Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const csv = `CPF,RETORNO AUTORIZACAO,RETORNO MARGEM,RETORNO SIMULACAO,RETORNO PROPOSTA,RETORNO GET PROPOSTA,ULTIMO LOG
12345678901,"{""autorizacaoId"":""xxx""}","{""valorMargemDisponivel"":1000}","{""requestedAmount"":5000}","","","2024-01-01 10:00:00"`;
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "modelo_importacao.csv";
                    link.click();
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Baixar Modelo CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Importacoes;
