/**
 * Utilitário centralizado para normalizar status de leads
 * 
 * =====================================================
 * REGRA MESTRE DE CLASSIFICAÇÃO (Todos os Bancos)
 * =====================================================
 * 
 * APROVADO: APENAS quando:
 *   - retorno_proposta.status === "success" (ÚNICO critério)
 *   - SEM erros técnicos no processo
 * 
 * REPROVACAO_TECNICA:
 *   - retorno_proposta.status === "success" MAS com erros em etapas anteriores
 * 
 * REPROVADO: Quando qualquer uma das condições:
 *   - retorno_proposta.status !== "success"
 *   - Sem retorno_proposta
 *   - Erro de negócio (CBO bloqueado, margem indisponível, etc.)
 * 
 * PENDENTE: Apenas para erros de sistema:
 *   - Limite de consultas excedido
 *   - Rate limit (429)
 * 
 * NOTA IMPORTANTE: retorno_get_proposta NÃO indica aprovação!
 * Apenas retorno_proposta.status === "success" indica aprovação.
 */

import { parseJsonSafe } from "@/types/lead";

export type StatusNormalizado = "aprovado" | "reprovado" | "pendente" | "reprovacao_tecnica";

export type LeadData = {
  id: string;
  cpf?: string;
  nome?: string;
  banco?: string | null;
  status?: string | null;
  retorno_margem?: unknown;
  retorno_simulacao?: unknown;
  retorno_proposta?: unknown;
  retorno_get_proposta?: unknown;
  retorno_autorizacao?: unknown;
};

export type FunilEtapaErro =
  | "retorno_autorizacao"
  | "retorno_margem"
  | "retorno_simulacao"
  | "retorno_proposta"
  | "retorno_get_proposta";

export type FunilErroInfo = {
  erro_etapa: FunilEtapaErro;
  erro_code: string | null;
  erro_motivo: string | null;
};

export type MargemReprovacaoTipo =
  | "margem_insuficiente"
  | "margem_zerada"
  | "margem_negativa"
  | "inelegibilidade_convenio"
  | "nao_aplicavel";

export type MargemReprovacaoInfo = {
  isMargemReprovada: boolean;
  tipo_reprovacao: MargemReprovacaoTipo;
  erro_etapa: FunilEtapaErro | null;
  erro_code: string | null;
  erro_motivo: string | null;
  valorMargemDisponivel: number | null;
  valorMinimoProduto: number | null;
  parcelaSolicitada?: number | null;
  limiar?: number | null;
  criterios: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

// =====================================================
// UTILITÁRIOS DE PARSING
// =====================================================

/**
 * Extrai valor numérico de qualquer formato
 */
const parseValorNumerico = (valor: unknown): number => {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const cleaned = valor.replace(/[^\d.,-]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

const parseValorNumericoStrict = (valor: unknown): number => {
  if (valor === null || valor === undefined) return Number.NaN;
  if (typeof valor === "number") return Number.isNaN(valor) ? Number.NaN : valor;
  if (typeof valor !== "string") return Number.NaN;

  const raw = valor.trim();
  if (!raw) return Number.NaN;

  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return Number.NaN;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    normalized = cleaned.replace(/,/g, ".");
  } else if (hasDot) {
    const looksLikeThousands = /^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned);
    if (looksLikeThousands) normalized = cleaned.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

/**
 * Verifica se texto contém indicadores de "sem margem"
 */
const isSemMargem = (texto: string): boolean => {
  const lower = texto.toLowerCase();
  return (
    lower.includes("sem margem") ||
    lower.includes("margem indisponível") ||
    lower.includes("margem indisponivel") ||
    lower.includes("não existe valor de margem") ||
    lower.includes("nao existe valor de margem") ||
    lower.includes("margem disponível r$ 0") ||
    lower.includes("margem disponivel r$ 0")
  );
};

/**
 * Verifica se texto contém indicadores de bloqueio de negócio
 */
const isBloqueioNegocio = (texto: string): boolean => {
  const lower = texto.toLowerCase();
  return (
    lower.includes("cbo bloqueado") ||
    lower.includes("cbo inválido") ||
    lower.includes("cbo invalido") ||
    lower.includes("compliance") ||
    lower.includes("ocupação bloqueada") ||
    lower.includes("ocupacao bloqueada") ||
    lower.includes("empresa bloqueada") ||
    lower.includes("porte não atendido") ||
    lower.includes("porte nao atendido") ||
    lower.includes("inelegível") ||
    lower.includes("inelegivel") ||
    lower.includes("não elegível") ||
    lower.includes("nao elegivel")
  );
};

/**
 * Verifica se é erro de conexão que deve ser tratado como PENDENTE
 */
const isErroConexao = (erro: string): boolean => {
  const lower = erro.toLowerCase();
  
  // Error 28: Operation timed out - NÃO é pendente, é REPROVADO
  if (lower.includes("error 28") || lower.includes("operation timed out")) {
    return false;
  }
  
  // Apenas limite excedido e rate limit são considerados pendentes
  return (
    (lower.includes("limite") && lower.includes("excedido")) ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  );
};

/**
 * Verifica se o lead tem erros técnicos em qualquer etapa do processo
 * ERROS TÉCNICOS: timeout, limite, conexão, erro HTTP 5xx
 * NÃO SÃO TÉCNICOS: CBO bloqueado, margem indisponível, CPF não encontrado
 */
const hasErrosTecnicosNoProcesso = (lead: LeadData): boolean => {
  const errosTecnicos = [
    "timeout",
    "timed out",
    "connection",
    "conexão",
    "conexao",
    "network",
    "500",
    "502",
    "503",
    "504",
    "internal server error",
    "erro interno",
    "rate limit",
    "limite excedido"
  ];
  
  const contemErroTecnico = (texto: string | undefined | null): boolean => {
    if (!texto) return false;
    const lower = texto.toLowerCase();
    return errosTecnicos.some(erro => lower.includes(erro));
  };
  
  const retornos = [
    lead.retorno_autorizacao,
    lead.retorno_margem,
    lead.retorno_simulacao
  ];
  
  for (const retorno of retornos) {
    if (!retorno) continue;
    
    const obj = retorno as Record<string, unknown>;
    
    if (obj.error && contemErroTecnico(String(obj.error))) {
      return true;
    }
    
    if (obj.erro && contemErroTecnico(String(obj.erro))) {
      return true;
    }
    
    if (obj.message && contemErroTecnico(String(obj.message))) {
      return true;
    }
  }
  
  return false;
};

// =====================================================
// VERIFICAÇÃO DE VALORES FINANCEIROS
// =====================================================

/**
 * Extrai valor liquidValue de retorno_simulacao
 */
const extrairValorMargem = (lead: LeadData): number => {
  const simulacao = lead.retorno_simulacao;
  if (!simulacao) return 0;

  const fontes: unknown[] = [];

  if (isRecord(simulacao)) {
    fontes.push(
      simulacao["liquidValue"],
      isRecord(simulacao["details"]) ? (simulacao["details"] as Record<string, unknown>)["liquidValue"] : undefined,
      isRecord(simulacao["result"]) ? (simulacao["result"] as Record<string, unknown>)["liquidValue"] : undefined,
      isRecord(simulacao["data"]) ? (simulacao["data"] as Record<string, unknown>)["liquidValue"] : undefined,
      isRecord(simulacao["response"]) ? (simulacao["response"] as Record<string, unknown>)["liquidValue"] : undefined,
      isRecord(simulacao["simulation"]) ? (simulacao["simulation"] as Record<string, unknown>)["liquidValue"] : undefined,
      simulacao["liquid_value"],
      isRecord(simulacao["details"]) ? (simulacao["details"] as Record<string, unknown>)["liquid_value"] : undefined,
      simulacao["LiquidValue"],
      isRecord(simulacao["details"]) ? (simulacao["details"] as Record<string, unknown>)["LiquidValue"] : undefined
    );

    const result = simulacao["result"];
    if (Array.isArray(result) && result.length > 0 && isRecord(result[0])) {
      fontes.push((result[0] as Record<string, unknown>)["liquidValue"]);
    }

    const data = simulacao["data"];
    if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
      fontes.push((data[0] as Record<string, unknown>)["liquidValue"]);
    }
  }

  if (Array.isArray(simulacao) && simulacao.length > 0 && isRecord(simulacao[0])) {
    fontes.push((simulacao[0] as Record<string, unknown>)["liquidValue"]);
  }

  const valorBruto = fontes.find((v) => v !== undefined && v !== null && v !== 0);
  if (valorBruto === undefined) return 0;
  
  const valorNumerico = parseValorNumerico(valorBruto);
  return valorNumerico / 100;
};

/**
 * Verifica se o lead possui valores financeiros positivos
 */
const hasValoresFinanceiros = (lead: LeadData): boolean => {
  return extrairValorMargem(lead) > 0;
};

// =====================================================
// VERIFICAÇÃO DE STATUS DO GET_PROPOSTA
// =====================================================

/**
 * Lista de status que indicam que o lead foi pago/aprovado
 * Esses status têm prioridade sobre erros em outras etapas
 */
const STATUS_PAGOS = [
  'encerrado', 
  'liquidacao', 
  'liquidacao manual', 
  'pago', 
  'liquidado',
  'aprovacao de instrumento',
  'aprovacao manual',
  'aprovado'
];

/**
 * Verifica se o statusDescription do retorno_get_proposta indica pagamento/aprovação
 * Se sim, o lead deve ser considerado aprovado independente de erros em outras etapas
 */
const hasStatusDescriptionAprovado = (lead: LeadData): boolean => {
  const getProposta = lead.retorno_get_proposta;
  if (!getProposta || !isRecord(getProposta)) return false;
  
  const statusDescription = getProposta.statusDescription;
  if (typeof statusDescription !== 'string') return false;
  
  const normalized = statusDescription
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  
  return STATUS_PAGOS.some(status => normalized.includes(status));
};

// =====================================================
// VERIFICAÇÃO DE STATUS SUCCESS
// =====================================================

/**
 * Verifica se há bloqueio de negócio nas mensagens de retorno
 */
const hasBloqueioNegocio = (lead: LeadData): boolean => {
  const margem = lead.retorno_margem;
  const simulacao = lead.retorno_simulacao;
  const proposta = lead.retorno_proposta;
  const margemObj = isRecord(margem) ? margem : null;
  const simulacaoObj = isRecord(simulacao) ? simulacao : null;
  const propostaObj = isRecord(proposta) ? proposta : null;
  
  const mensagens = [
    margemObj ? margemObj["error"] : null,
    margemObj ? margemObj["message"] : null,
    margemObj && isRecord(margemObj["details"]) ? (margemObj["details"] as Record<string, unknown>)["reason"] : null,
    simulacaoObj ? simulacaoObj["error"] : null,
    simulacaoObj ? simulacaoObj["message"] : null,
    propostaObj ? propostaObj["error"] : null,
    propostaObj ? propostaObj["message"] : null
  ].filter(Boolean).map(String);
  
  for (const msg of mensagens) {
    if (isBloqueioNegocio(msg) || isSemMargem(msg)) {
      return true;
    }
  }
  
  // UY3: Verificar reasonForIneligibility
  if (margemObj && isRecord(margemObj["details"])) {
    const details = margemObj["details"] as Record<string, unknown>;
    const responses = details["dataprevValidationResponses"];
    if (Array.isArray(responses)) {
      for (const resp of responses) {
        if (!isRecord(resp)) continue;
        const reasons = (resp as Record<string, unknown>)["reasonForIneligibility"];
        if (!Array.isArray(reasons)) continue;
        for (const reason of reasons) {
          if (!isRecord(reason)) continue;
          const msg = String(reason["messageError"] || reason["errorField"] || "");
          if (isBloqueioNegocio(msg)) return true;
        }
      }
    }
  }
  
  return false;
};

/**
 * CRITÉRIO ÚNICO DE APROVAÇÃO:
 * retorno_proposta.status === "success"
 * 
 * IMPORTANTE: retorno_get_proposta NÃO indica aprovação!
 */
const hasStatusSuccess = (lead: LeadData): boolean => {
  const proposta = lead.retorno_proposta;
  if (!proposta) return false;

  const fontes: unknown[] = [];

  if (isRecord(proposta)) {
    fontes.push(
      proposta["status"],
      isRecord(proposta["details"]) ? (proposta["details"] as Record<string, unknown>)["status"] : undefined,
      isRecord(proposta["result"]) ? (proposta["result"] as Record<string, unknown>)["status"] : undefined,
      isRecord(proposta["data"]) ? (proposta["data"] as Record<string, unknown>)["status"] : undefined,
      isRecord(proposta["response"]) ? (proposta["response"] as Record<string, unknown>)["status"] : undefined,
      isRecord(proposta["proposal"]) ? (proposta["proposal"] as Record<string, unknown>)["status"] : undefined
    );

    const result = proposta["result"];
    if (Array.isArray(result) && result.length > 0 && isRecord(result[0])) {
      fontes.push((result[0] as Record<string, unknown>)["status"]);
    }

    const data = proposta["data"];
    if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
      fontes.push((data[0] as Record<string, unknown>)["status"]);
    }
  }

  if (Array.isArray(proposta) && proposta.length > 0 && isRecord(proposta[0])) {
    fontes.push((proposta[0] as Record<string, unknown>)["status"]);
  }

  for (const statusValue of fontes) {
    if (statusValue) {
      const status = String(statusValue).toLowerCase().trim();
      if (status === "success") return true;
    }
  }

  return false;
};

// =====================================================
// VERIFICAÇÃO DE PENDENTE (ERROS DE SISTEMA)
// =====================================================

/**
 * Verifica se o lead está pendente por erro de sistema
 */
const isPendente = (lead: LeadData): boolean => {
  const proposta = lead.retorno_proposta;
  const autorizacao = lead.retorno_autorizacao;
  const margem = lead.retorno_margem;
  const simulacao = lead.retorno_simulacao;
  const propostaObj = isRecord(proposta) ? proposta : null;
  const autorizacaoObj = isRecord(autorizacao) ? autorizacao : null;
  const margemObj = isRecord(margem) ? margem : null;
  const simulacaoObj = isRecord(simulacao) ? simulacao : null;
  
  // Se tem proposta com status success, NUNCA é pendente
  if (propostaObj?.["status"] === "success") {
    return false;
  }
  
  // Limite de consultas excedido
  if (autorizacaoObj) {
    const errors = autorizacaoObj["errors"];
    if (Array.isArray(errors)) {
      const hasLimite = errors.some((err) => 
        String(err).toLowerCase().includes("limite") && 
        String(err).toLowerCase().includes("excedido")
      );
      if (hasLimite) return true;
    }
    if (autorizacaoObj["error"] && isErroConexao(String(autorizacaoObj["error"]))) {
      return true;
    }
  }
  
  // Erros de conexão em outros retornos
  const erros = [
    margemObj ? margemObj["error"] : null,
    simulacaoObj ? simulacaoObj["error"] : null
  ].filter(Boolean);
  
  for (const erro of erros) {
    if (isErroConexao(String(erro))) {
      return true;
    }
  }
  
  return false;
};

// =====================================================
// EXTRAÇÃO DE MOTIVO DE ERRO
// =====================================================

const UUID_ONLY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hasHttpStatusInText = (text: string): string | null => {
  const match = text.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? match[1] : null;
};

const pickFirstString = (...values: unknown[]): string | null => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

const extractResponseCompletoFromErrorString = (errorString: string | null): { code: string | null; message: string | null } => {
  if (!errorString) return { code: null, message: null };
  const match = errorString.match(/Response completo:\s*(\{[\s\S]*\})/);
  if (!match) return { code: null, message: null };
  try {
    const json = JSON.parse(match[1].replace(/\\n/g, '').replace(/\\t/g, '').replace(/\\"/g, '"'));
    return {
      code: json.code || json.statusCode || null,
      message: json.message || json.error || null
    };
  } catch {
    return { code: null, message: null };
  }
};

const extractFormErrorsMessage = (retorno: unknown): string | null => {
  if (!isRecord(retorno)) return null;
  const details = isRecord(retorno.details) ? retorno.details : null;
  if (!details) return null;
  const formErrors = details.formErrors;
  if (!Array.isArray(formErrors) || formErrors.length === 0) return null;
  const messages = formErrors
    .map((e: unknown) => (isRecord(e) ? e.message : null))
    .filter((m): m is string => typeof m === "string");
  return messages.length > 0 ? messages.join(" | ") : null;
};

/**
 * Extrai mensagens de erro do campo DomainValidations (comum em retorno_autorizacao)
 * Estrutura esperada: { errors: { DomainValidations: ["mensagem de erro"] } }
 */
const extrairDomainValidationsMessage = (retorno: unknown): string | null => {
  if (!retorno) return null;
  
  // Se for string, tentar parsear como JSON
  let obj: Record<string, unknown> | null = null;
  if (typeof retorno === 'string') {
    try {
      const parsed = JSON.parse(retorno);
      if (parsed && typeof parsed === 'object') {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      // Tentar extrair JSON embutido na string
      const jsonMatch = retorno.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object') {
            obj = parsed as Record<string, unknown>;
          }
        } catch {
          return null;
        }
      }
    }
  } else if (isRecord(retorno)) {
    obj = retorno as Record<string, unknown>;
  }
  
  if (!obj) return null;
  
  // DomainValidations está dentro de errors
  const errors = isRecord(obj.errors) ? obj.errors as Record<string, unknown> : null;
  const details = isRecord(obj.details) ? obj.details as Record<string, unknown> : null;
  const detailsErrors = details && isRecord(details.errors) ? details.errors as Record<string, unknown> : null;
  
  const domainValidations = errors?.DomainValidations || detailsErrors?.DomainValidations;
  
  if (!Array.isArray(domainValidations) || domainValidations.length === 0) return null;
  
  // Extrair mensagens de erro de cada validação
  const mensagens: string[] = [];
  for (const validation of domainValidations) {
    // Caso 1: O item é uma string direta (ex: ["erro 1", "erro 2"])
    if (typeof validation === 'string' && validation.trim().length > 0) {
      mensagens.push(validation.trim());
      continue;
    }
    
    // Caso 2: O item é um objeto com campos de mensagem
    if (isRecord(validation)) {
      const msg = validation.Message || validation.message || 
                  validation.ErrorMessage || validation.errorMessage ||
                  validation.Description || validation.description ||
                  validation.Reason || validation.reason;
      if (msg && typeof msg === 'string' && msg.trim().length > 0) {
        mensagens.push(msg.trim());
      }
    }
  }
  
  // Normalizar/traduzir mensagens
  const normalizarMensagem = (msg: string): string => {
    // Traduzir termos em inglês para português
    let normalizada = msg;
    
    // formalization -> formalização
    normalizada = normalizada.replace(/\bformalization\b/gi, 'formalização');
    
    return normalizada;
  };
  
  // Retornar todas as mensagens concatenadas ou null se não houver
  return mensagens.length > 0 ? mensagens.map(normalizarMensagem).join('; ') : null;
};

const extrairMessageError = (retorno: unknown): string | null => {
  if (!retorno) return null;
  
  const obj = retorno as Record<string, unknown>;
  
  if (obj.error && typeof obj.error === 'string') {
    const match = obj.error.match(/Response completo:\s*(\{[\s\S]*\})/);
    if (match) {
      try {
        const jsonStr = match[1].replace(/\\n/g, '').replace(/\\t/g, '').replace(/\\"/g, '"');
        const jsonInterno = JSON.parse(jsonStr) as Record<string, unknown>;
        const details = jsonInterno.details as Record<string, unknown> | undefined;
        if (details) {
          const dataprevResponses = details.dataprevValidationResponses as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(dataprevResponses)) {
            const messages: string[] = [];
            for (const response of dataprevResponses) {
              const reasons = response.reasonForIneligibility as Array<Record<string, unknown>> | undefined;
              if (Array.isArray(reasons)) {
                for (const reason of reasons) {
                  if (reason.messageError && typeof reason.messageError === 'string') {
                    messages.push(reason.messageError);
                  }
                }
              }
            }
            if (messages.length > 0) return messages.join(' | ');
          }
        }
      } catch {
        // ignore
      }
    }
  }
  
  // Tentar direto do retorno
  if (isRecord(obj.details)) {
    const details = obj.details as Record<string, unknown>;
    const dataprevResponses = details.dataprevValidationResponses as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(dataprevResponses)) {
      const messages: string[] = [];
      for (const response of dataprevResponses) {
        const reasons = response.reasonForIneligibility as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(reasons)) {
          for (const reason of reasons) {
            if (reason.messageError && typeof reason.messageError === 'string') {
              messages.push(reason.messageError);
            }
          }
        }
      }
      if (messages.length > 0) return messages.join(' | ');
    }
  }
  
  return null;
};

const buildLegibleMotivo = (params: {
  statusCode: string | null;
  retorno: unknown;
  errorString: string | null;
  responseCompletoMessage: string | null;
  recordMessage: string | null;
  recordError: string | null;
}): string | null => {
  const { statusCode, responseCompletoMessage, recordMessage, recordError } = params;
  
  if (statusCode === "429") {
    return "Limite de requisições excedido (rate limit)";
  }
  
  return responseCompletoMessage || recordMessage || recordError || null;
};

const extractRetornoErrorString = (retorno: unknown): string | null => {
  if (typeof retorno === "string") return retorno;
  if (!isRecord(retorno)) return null;

  const details = isRecord(retorno.details) ? retorno.details : null;
  return pickFirstString(
    retorno.error,
    (retorno as Record<string, unknown>).erro,
    details?.error,
    details?.detail,
    details?.message
  );
};

const retornoIndicaErro = (retorno: unknown): boolean => {
  if (retorno === null || retorno === undefined) return false;
  if (typeof retorno === "string") {
    const trimmed = retorno.trim();
    if (!trimmed || UUID_ONLY_RE.test(trimmed)) return false;
    const status = hasHttpStatusInText(trimmed);
    if (status) return true;
    const lower = trimmed.toLowerCase();
    if (lower.includes("invalid_") || lower.includes("too many requests") || lower.includes("rate limit")) return true;
    if (lower.includes("erro") || lower.includes("error")) return true;
    return false;
  }
  if (Array.isArray(retorno)) return retorno.some(retornoIndicaErro);
  if (!isRecord(retorno)) return false;

  const statusCandidate = typeof retorno.status === "string" ? retorno.status.trim().toLowerCase() : null;
  const isOkStatus = statusCandidate ? ["success", "ok", "approved", "existing_authorization"].includes(statusCandidate) : false;

  const hasExplicitError =
    retorno.error !== undefined ||
    (retorno as Record<string, unknown>).erro !== undefined ||
    retorno.messageError !== undefined ||
    (isRecord(retorno.details) &&
      (retorno.details.error !== undefined ||
        retorno.details.formErrors !== undefined ||
        retorno.details.errors !== undefined ||
        retorno.details.reasonForIneligibility !== undefined));

  if (isOkStatus && !hasExplicitError) return false;

  const errorString = extractRetornoErrorString(retorno);
  if (errorString) return true;

  const details = isRecord(retorno.details) ? retorno.details : null;
  if (Array.isArray(retorno.errors) && retorno.errors.length > 0) return true;
  if (Array.isArray(details?.errors) && details?.errors.length > 0) return true;
  if (Array.isArray(details?.formErrors) && details?.formErrors.length > 0) return true;

  if (statusCandidate && !isOkStatus) return true;
  return false;
};

const extrairErroCodeMotivoDoRetorno = (retorno: unknown): { code: string | null; motivo: string | null } | null => {
  if (!retornoIndicaErro(retorno)) return null;

  // Primeiro: tentar extrair do DomainValidations (mais específico para erros de autorização)
  const domainValidationsMessage = extrairDomainValidationsMessage(retorno);
  if (domainValidationsMessage) {
    const errorString = extractRetornoErrorString(retorno);
    const statusFromText = errorString ? hasHttpStatusInText(errorString) : null;
    const recordCode =
      isRecord(retorno) && (typeof retorno.code === "string" || typeof retorno.code === "number") ? String(retorno.code) : null;
    const code = statusFromText ?? recordCode;
    return { code, motivo: domainValidationsMessage };
  }

  const messageError = extrairMessageError(retorno);
  if (messageError) {
    const errorString = extractRetornoErrorString(retorno);
    const statusFromText = errorString ? hasHttpStatusInText(errorString) : null;
    const responseCompleto = extractResponseCompletoFromErrorString(errorString);
    const recordCode =
      isRecord(retorno) && (typeof retorno.code === "string" || typeof retorno.code === "number") ? String(retorno.code) : null;
    const code = statusFromText ?? responseCompleto.code ?? recordCode;
    return { code, motivo: messageError };
  }

  const formErrorsMessage = extractFormErrorsMessage(retorno);

  const errorString = extractRetornoErrorString(retorno);
  const statusFromText = errorString ? hasHttpStatusInText(errorString) : null;
  const responseCompleto = extractResponseCompletoFromErrorString(errorString);

  const recordMessage = isRecord(retorno) ? (typeof retorno.message === "string" ? retorno.message : null) : null;
  const recordError = isRecord(retorno) ? (typeof retorno.error === "string" ? retorno.error : null) : null;
  const recordCode =
    isRecord(retorno) && (typeof retorno.code === "string" || typeof retorno.code === "number") ? String(retorno.code) : null;

  const codeBase = statusFromText ?? responseCompleto.code ?? recordCode;
  const looksLikeRateLimit = (() => {
    const txt = pickFirstString(errorString, recordMessage, recordError) ?? "";
    const lower = txt.toLowerCase();
    return lower.includes("too many requests") || lower.includes("rate limit") || lower.includes("ratelimit");
  })();

  const code = codeBase ?? (looksLikeRateLimit ? "429" : null);

  if (code === "429") {
    const motivo = buildLegibleMotivo({
      statusCode: code,
      retorno,
      errorString,
      responseCompletoMessage: responseCompleto.message,
      recordMessage,
      recordError,
    });
    return { code, motivo: motivo?.trim() ? motivo : null };
  }

  const motivo =
    formErrorsMessage ??
    responseCompleto.message ??
    recordMessage ??
    buildLegibleMotivo({
      statusCode: code,
      retorno,
      errorString,
      responseCompletoMessage: responseCompleto.message,
      recordMessage,
      recordError,
    });

  return { code, motivo: motivo?.trim() ? motivo : null };
};

export const extrairErroFunil = (lead: LeadData): FunilErroInfo | null => {
  const etapas: Array<{ etapa: FunilEtapaErro; retorno: unknown }> = [
    { etapa: "retorno_autorizacao", retorno: lead.retorno_autorizacao },
    { etapa: "retorno_margem", retorno: lead.retorno_margem },
    { etapa: "retorno_simulacao", retorno: lead.retorno_simulacao },
    { etapa: "retorno_proposta", retorno: lead.retorno_proposta },
    { etapa: "retorno_get_proposta", retorno: lead.retorno_get_proposta },
  ];

  for (const { etapa, retorno } of etapas) {
    const info = extrairErroCodeMotivoDoRetorno(retorno);
    if (info) {
      return {
        erro_etapa: etapa,
        erro_code: info.code,
        erro_motivo: info.motivo,
      };
    }
  }

  return null;
};

// =====================================================
// FUNÇÃO PRINCIPAL DE NORMALIZAÇÃO
// =====================================================

/**
 * REGRA MESTRE: Normaliza o status do lead
 * 
 * APROVADO = 
 *   1. retorno_proposta.status === "success" E SEM erros técnicos
 *   2. OU retorno_get_proposta.statusDescription indica pagamento/aprovação
 *      (Liquidação, Pago, Aprovado, etc.) - TEM PRIORIDADE sobre erros
 * 
 * REPROVACAO_TECNICA = retorno_proposta.status === "success" MAS com erros em alguma etapa anterior
 * PENDENTE = erros de sistema (rate limit, limite excedido)
 * REPROVADO = qualquer outro caso
 */
export const normalizarStatusLead = (lead: LeadData): StatusNormalizado => {
  // =====================================================
  // 0. PRIORIDADE: VERIFICAR statusDescription DO GET_PROPOSTA
  // Se indica pagamento/aprovação, o lead é APROVADO
  // independente de erros em outras etapas
  // =====================================================
  if (hasStatusDescriptionAprovado(lead)) {
    return "aprovado";
  }
  
  // =====================================================
  // 1. VERIFICAR SE TEM STATUS SUCCESS NA PROPOSTA
  // =====================================================
  if (hasStatusSuccess(lead)) {
    // Verificar erros técnicos no processo
    if (hasErrosTecnicosNoProcesso(lead)) {
      return "reprovacao_tecnica";
    }
    
    // Aprovado sem erros técnicos
    return "aprovado";
  }
  
  // =====================================================
  // 2. VERIFICAR SE É PENDENTE (erros de sistema)
  // =====================================================
  if (isPendente(lead)) {
    return "pendente";
  }
  
  // =====================================================
  // 3. REPROVADO: Tudo mais
  // =====================================================
  return "reprovado";
};

/**
 * Função legada para compatibilidade
 * Prioriza análise completa do lead se disponível
 */
export const normalizarStatus = (status: string | null, lead?: LeadData): StatusNormalizado => {
  // Se tem dados do lead, usar regra mestre
  if (lead) {
    return normalizarStatusLead(lead);
  }
  
  // Status explícitos apenas quando não tem dados do lead
  const s = (status || "").toLowerCase().trim();
  if (s === "aprovado" || s === "approved") return "aprovado";
  if (s === "reprovado" || s === "rejected" || s === "recusado") return "reprovado";
  if (s === "pendente" || s === "pending") return "pendente";
  if (s === "reprovacao_tecnica" || s === "reprovação técnica") return "reprovacao_tecnica";
  if (s === "cpf não encontrado" || s === "cpf_nao_encontrado") return "reprovado";
  
  return "reprovado";
};

// =====================================================
// CLASSIFICAÇÃO DE MARGEM REPROVADA
// =====================================================

/**
 * Keywords para NÃO classificar como margem reprovada
 * (erros técnicos, rate limit, etc)
 */
const NAO_CLASSIFICAR_MARGEM_KEYWORDS = [
  "invalid_form",
  "invalid business rule",
  "invalid_business_rule",
  "too many requests",
  "rate limit",
  "limite excedido",
  "timeout",
  "timed out",
  "internal server error",
  "erro interno",
  "janela de manutencao",
  "janela de manutenção",
] as const;

/**
 * Keywords para inelegibilidade do convênio
 */
const CONVENIO_INELEGIVEL_KEYWORDS = [
  "cbo bloqueado",
  "ocupacao bloqueada",
  "ocupação bloqueada",
  "empresa nao atende",
  "empresa não atende",
  "requisitos minimos",
  "requisitos mínimos",
  "data minima de atividade",
  "data mínima de atividade",
  "tempo de atividade",
  "porte nao atendido",
  "porte não atendido",
  "nao elegivel",
  "não elegível",
  "inelegivel",
  "inelegível",
] as const;

const normalizeText = (v: string): string => {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const includesAny = (haystack: string, needles: readonly string[]): boolean => {
  return needles.some((n) => haystack.includes(normalizeText(n)));
};

const pickFirstNumber = (...values: Array<unknown>): number | null => {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!/\d/.test(trimmed)) continue;
      const cleaned = trimmed.replace(/[^\d.,-]/g, "").replace(",", ".");
      const parsed = parseFloat(cleaned);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
};

/**
 * Extrai valorMargemDisponivel do retorno_margem
 * 
 * IMPORTANTE: Só extrai do retorno_margem, não de outros campos.
 * A classificação de margem reprovada só faz sentido quando o erro
 * ocorre na etapa de margem.
 */
const extrairValorMargemDisponivelDoLead = (lead: LeadData): {
  valorMargemDisponivel: number | null;
  valorMinimoProduto: number | null;
  criterios: string[];
} => {
  const criterios: string[] = [];
  
  const margemRaw = lead.retorno_margem;
  if (!margemRaw) {
    criterios.push("retorno_margem_ausente");
    return { valorMargemDisponivel: null, valorMinimoProduto: null, criterios };
  }
  
  const margem = Array.isArray(margemRaw) 
    ? (margemRaw[0] as Record<string, unknown> | null) 
    : (isRecord(margemRaw) ? (margemRaw as Record<string, unknown>) : null);
  
  if (!margem || Object.keys(margem).length === 0) {
    criterios.push("retorno_margem_vazio");
    return { valorMargemDisponivel: null, valorMinimoProduto: null, criterios };
  }
  
  // Tentar extrair valorMargemDisponivel de múltiplos caminhos
  
  // Caminho 1: Campo direto
  let valorMargemDisponivel = pickFirstNumber(
    margem["valorMargemDisponivel"],
    margem["valor_margem_disponivel"],
    margem["margemDisponivel"],
    margem["margem_disponivel"],
    margem["valorMargem"],
    margem["valor_margem"]
  );
  
  // Caminho 2: Em registroEmpregaticio
  if (valorMargemDisponivel === null && isRecord(margem["registroEmpregaticio"])) {
    const reg = margem["registroEmpregaticio"] as Record<string, unknown>;
    valorMargemDisponivel = pickFirstNumber(reg["valorMargemDisponivel"]);
    if (valorMargemDisponivel !== null) criterios.push("margem_de_registroEmpregaticio");
  }
  
  // Caminho 3: Em details
  if (valorMargemDisponivel === null && isRecord(margem["details"])) {
    const details = margem["details"] as Record<string, unknown>;
    valorMargemDisponivel = pickFirstNumber(
      details["valorMargemDisponivel"],
      details["valorMargem"]
    );
    if (valorMargemDisponivel !== null) criterios.push("margem_de_details");
  }
  
  // Caminho 4: Em details.dataprevValidationResponses[].employeeRelationShip.valorMargemDisponivel
  if (valorMargemDisponivel === null && isRecord(margem["details"])) {
    const details = margem["details"] as Record<string, unknown>;
    const dataprevResponses = details["dataprevValidationResponses"];
    if (Array.isArray(dataprevResponses)) {
      for (const response of dataprevResponses) {
        if (!isRecord(response)) continue;
        const employee = (response as Record<string, unknown>)["employeeRelationShip"];
        if (!isRecord(employee)) continue;
        const valor = pickFirstNumber((employee as Record<string, unknown>)["valorMargemDisponivel"]);
        if (valor !== null) {
          valorMargemDisponivel = valor;
          criterios.push("margem_de_dataprevValidationResponses");
          break;
        }
      }
    }
  }
  
  // Caminho 5: Em result[0]
  if (valorMargemDisponivel === null && Array.isArray(margem["result"]) && margem["result"].length > 0) {
    const first = margem["result"][0];
    if (isRecord(first)) {
      valorMargemDisponivel = pickFirstNumber((first as Record<string, unknown>)["valorMargemDisponivel"]);
      if (valorMargemDisponivel !== null) criterios.push("margem_de_result");
    }
  }
  
  // Caminho 6: Extrair do campo error se contém JSON embutido
  if (valorMargemDisponivel === null && typeof margem["error"] === "string") {
    const errorStr = margem["error"] as string;
    const match = errorStr.match(/Response completo:\s*(\{[\s\S]*\})/);
    if (match?.[1]) {
      try {
        const cleanJson = match[1].replace(/\\n/g, "").replace(/\\t/g, "").replace(/\\"/g, '"');
        const parsed = JSON.parse(cleanJson) as Record<string, unknown>;
        if (isRecord(parsed["details"])) {
          const details = parsed["details"] as Record<string, unknown>;
          const dataprevResponses = details["dataprevValidationResponses"];
          if (Array.isArray(dataprevResponses)) {
            for (const response of dataprevResponses) {
              if (!isRecord(response)) continue;
              const employee = (response as Record<string, unknown>)["employeeRelationShip"];
              if (!isRecord(employee)) continue;
              const valor = pickFirstNumber((employee as Record<string, unknown>)["valorMargemDisponivel"]);
              if (valor !== null) {
                valorMargemDisponivel = valor;
                criterios.push("margem_de_error_json_dataprev");
                break;
              }
            }
          }
        }
      } catch {
        // Ignorar erro de parse
      }
    }
  }
  
  if (valorMargemDisponivel !== null) {
    criterios.push("valorMargemDisponivel_encontrado");
  } else {
    criterios.push("valorMargemDisponivel_nao_encontrado");
  }
  
  // Extrair valor mínimo do produto
  const valorMinimoProduto = pickFirstNumber(
    margem["valorMinimoProduto"],
    margem["valor_minimo_produto"],
    margem["minimoProduto"],
    margem["minimumProductValue"],
    margem["minValue"],
    isRecord(margem["details"]) ? (margem["details"] as Record<string, unknown>)["valorMinimoProduto"] : null
  );
  
  return { valorMargemDisponivel, valorMinimoProduto, criterios };
};

/**
 * Extrai parcela solicitada do retorno_simulacao
 */
const extrairParcelaSolicitadaDoLead = (lead: LeadData): {
  parcelaSolicitada: number | null;
  criterios: string[];
} => {
  const criterios: string[] = [];
  
  const simulacaoRaw = lead.retorno_simulacao;
  if (!simulacaoRaw) {
    criterios.push("retorno_simulacao_ausente");
    return { parcelaSolicitada: null, criterios };
  }
  
  const simulacao = Array.isArray(simulacaoRaw) 
    ? (simulacaoRaw[0] as Record<string, unknown> | null) 
    : (isRecord(simulacaoRaw) ? (simulacaoRaw as Record<string, unknown>) : null);
  
  if (!simulacao) {
    criterios.push("retorno_simulacao_invalido");
    return { parcelaSolicitada: null, criterios };
  }
  
  const parcelaSolicitada = pickFirstNumber(
    simulacao["parcela_solicitada"],
    simulacao["parcelaSolicitada"],
    simulacao["valorParcelaSolicitada"],
    simulacao["valor_parcela_solicitada"],
    simulacao["installmentValue"],
    simulacao["installmentAmount"],
    simulacao["paymentValue"],
    simulacao["valuePerInstallment"],
    simulacao["valorPrestacao"],
    simulacao["valor_prestacao"],
    simulacao["valorParcela"],
    simulacao["valor_parcela"]
  );
  
  if (parcelaSolicitada !== null) {
    criterios.push("parcelaSolicitada_encontrada");
  } else {
    criterios.push("parcelaSolicitada_nao_encontrada");
  }
  
  return { parcelaSolicitada, criterios };
};

/**
 * FUNÇÃO PRINCIPAL: Classifica se um lead foi reprovado por margem
 * 
 * REGRA CORRIGIDA E RIGOROSA:
 * Um lead é classificado como "margem reprovada" APENAS quando:
 * 1. O retorno_margem indica ERRO/FALHA (não sucesso)
 * 2. E o erro é devido a margem zerada, negativa ou insuficiente
 * 
 * NÃO classificar como margem reprovada quando:
 * - Não há retorno_margem preenchido
 * - O retorno_margem indica SUCESSO (status = success/ok/approved)
 * - O erro é técnico (timeout, rate limit, etc)
 * - O erro é de inelegibilidade do convênio (CBO bloqueado, etc)
 * - A margem está OK (valor positivo e suficiente)
 * - A reprovação ocorreu em outra etapa (simulação, proposta, etc)
 */
export const classificarMargemReprovada = (lead: LeadData): MargemReprovacaoInfo => {
  const criterios: string[] = [];
  
  // 1. Verificar se o lead tem retorno_margem
  const margemRaw = lead.retorno_margem;
  if (!margemRaw) {
    criterios.push("sem_retorno_margem");
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa: null,
      erro_code: null,
      erro_motivo: null,
      valorMargemDisponivel: null,
      valorMinimoProduto: null,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 2. Parsear o retorno_margem
  const margem = Array.isArray(margemRaw) 
    ? (margemRaw[0] as Record<string, unknown> | null) 
    : (isRecord(margemRaw) ? (margemRaw as Record<string, unknown>) : null);
  
  if (!margem || Object.keys(margem).length === 0) {
    criterios.push("retorno_margem_vazio");
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa: null,
      erro_code: null,
      erro_motivo: null,
      valorMargemDisponivel: null,
      valorMinimoProduto: null,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 3. VERIFICAR SE O RETORNO_MARGEM INDICA SUCESSO
  // Se o status é success/ok/approved, a consulta de margem foi bem sucedida
  // e a reprovação do lead deve ter ocorrido em outra etapa
  const statusMargem = typeof margem["status"] === "string" ? margem["status"].toLowerCase().trim() : null;
  const isMargemSucesso = statusMargem && ["success", "ok", "approved", "existing_authorization"].includes(statusMargem);
  
  if (isMargemSucesso) {
    // Margem foi consultada com sucesso - a reprovação não foi por margem
    criterios.push("retorno_margem_sucesso");
    
    // Extrair valor da margem para referência
    const numeric = extrairValorMargemDisponivelDoLead(lead);
    
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa: null,
      erro_code: null,
      erro_motivo: null,
      valorMargemDisponivel: numeric.valorMargemDisponivel,
      valorMinimoProduto: numeric.valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 4. Verificar se há erro explícito no retorno_margem
  const erroMargem = typeof margem["error"] === "string" ? margem["error"] : 
                     typeof margem["erro"] === "string" ? margem["erro"] :
                     typeof margem["message"] === "string" && !isMargemSucesso ? margem["message"] : null;
  const motivoNorm = normalizeText((erroMargem as string) ?? "");
  
  // Se não tem status de sucesso E não tem erro explícito, verificar se há algum indicador de falha
  const hasError = erroMargem !== null || 
                   margem["error"] !== undefined || 
                   margem["erro"] !== undefined ||
                   (statusMargem && !isMargemSucesso);
  
  if (!hasError) {
    // Retorno_margem existe mas não indica erro explícito - pode ser sucesso implícito
    criterios.push("retorno_margem_sem_erro_explicito");
    
    // Extrair valor da margem
    const numeric = extrairValorMargemDisponivelDoLead(lead);
    
    // Se tem valor de margem positivo, provavelmente foi sucesso
    if (numeric.valorMargemDisponivel !== null && numeric.valorMargemDisponivel > 0) {
      criterios.push("margem_positiva_sem_erro");
      return {
        isMargemReprovada: false,
        tipo_reprovacao: "nao_aplicavel",
        erro_etapa: null,
        erro_code: null,
        erro_motivo: null,
        valorMargemDisponivel: numeric.valorMargemDisponivel,
        valorMinimoProduto: numeric.valorMinimoProduto,
        parcelaSolicitada: null,
        limiar: null,
        criterios,
      };
    }
  }
  
  // 5. Verificar se é erro técnico (não classificar como margem)
  if (erroMargem && includesAny(motivoNorm, NAO_CLASSIFICAR_MARGEM_KEYWORDS)) {
    criterios.push("erro_tecnico_no_retorno_margem");
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string,
      valorMargemDisponivel: null,
      valorMinimoProduto: null,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 6. Verificar se é inelegibilidade do convênio (CBO bloqueado, etc)
  if (erroMargem && (includesAny(motivoNorm, CONVENIO_INELEGIVEL_KEYWORDS) || isBloqueioNegocio(motivoNorm))) {
    criterios.push("inelegibilidade_convenio_no_retorno_margem");
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "inelegibilidade_convenio",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string,
      valorMargemDisponivel: null,
      valorMinimoProduto: null,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 7. Extrair valor da margem disponível
  const numeric = extrairValorMargemDisponivelDoLead(lead);
  criterios.push(...numeric.criterios);
  
  const valorMargemDisponivel = numeric.valorMargemDisponivel;
  const valorMinimoProduto = numeric.valorMinimoProduto;
  
  // 8. Classificar por valor da margem APENAS se há indicação de erro
  
  // Margem negativa
  if (valorMargemDisponivel !== null && valorMargemDisponivel < 0) {
    criterios.push("margem_negativa");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_negativa",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string | null,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // Margem zerada
  if (valorMargemDisponivel !== null && valorMargemDisponivel === 0) {
    criterios.push("margem_zerada");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_zerada",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string | null,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 9. Verificar margem insuficiente (abaixo do limiar)
  const parcelaInfo = extrairParcelaSolicitadaDoLead(lead);
  criterios.push(...parcelaInfo.criterios);
  
  const parcelaSolicitada = parcelaInfo.parcelaSolicitada;
  const limiar = Math.max(100, parcelaSolicitada ?? 0, valorMinimoProduto ?? 0);
  
  if (valorMargemDisponivel !== null && valorMargemDisponivel > 0 && valorMargemDisponivel < limiar) {
    criterios.push("margem_insuficiente");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_insuficiente",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string | null,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada,
      limiar,
      criterios,
    };
  }
  
  // 10. Se o erro menciona margem explicitamente mas não conseguiu extrair valor
  if (erroMargem && (
    motivoNorm.includes("margem") ||
    motivoNorm.includes("margin") ||
    motivoNorm.includes("sem margem") ||
    motivoNorm.includes("margem indisponivel") ||
    motivoNorm.includes("margem zerada")
  )) {
    criterios.push("erro_explicito_de_margem_sem_valor");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_zerada",
      erro_etapa: "retorno_margem",
      erro_code: null,
      erro_motivo: erroMargem as string,
      valorMargemDisponivel: 0,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }
  
  // 11. Margem OK ou não é reprovação por margem
  criterios.push("nao_e_reprovacao_por_margem");
  return {
    isMargemReprovada: false,
    tipo_reprovacao: "nao_aplicavel",
    erro_etapa: null,
    erro_code: null,
    erro_motivo: null,
    valorMargemDisponivel,
    valorMinimoProduto,
    parcelaSolicitada,
    limiar,
    criterios,
  };
};

/**
 * Extrai o valor da margem disponível de um lead
 */
export const extrairValorMargemDisponivelLead = (lead: LeadData): number | null => {
  return extrairValorMargemDisponivelDoLead(lead).valorMargemDisponivel;
};

/**
 * Extrai o motivo da reprovação técnica
 */
export const extrairMotivoReprovacaoTecnica = (lead: LeadData): string | null => {
  const messageError = extrairMessageError(lead.retorno_margem);
  if (messageError) return messageError;

  const funilErro = extrairErroFunil(lead);
  if (funilErro?.erro_motivo) return funilErro.erro_motivo;
  if (funilErro?.erro_code) return funilErro.erro_code;

  return null;
};

/**
 * Extrai o motivo do erro/reprovação de um lead
 */
export const extrairMotivoErro = (lead: LeadData): string | null => {
  const funilErro = extrairErroFunil(lead);
  if (funilErro?.erro_motivo) return funilErro.erro_motivo;
  if (funilErro?.erro_code) return funilErro.erro_code;

  if (extrairValorMargem(lead) === 0 && hasStatusSuccess(lead)) {
    return "Margem indisponível ou zerada";
  }

  return null;
};

/**
 * =====================================================
 * EXTRAÇÃO DE DADOS DO TRABALHADOR DO RETORNO_MARGEM
 * =====================================================
 * Extrai CBO, CNAE, Nome e Empregador de múltiplas fontes:
 * 1. result[0] - quando consulta retorna OK
 * 2. dataprevValidationResponses[].employeeRelationShip - dentro de erros
 * 3. Mensagens de erro (CBO bloqueado: XXXXXX - DESCRICAO)
 */



/**
 * Interface para dados do trabalhador extraídos do retorno_margem
 */
export interface DadosTrabalhador {
  nome: string | null;
  cboCodigo: string | null;
  cboDescricao: string | null;
  cnaeCodigo: string | null;
  cnaeDescricao: string | null;
  empregador: string | null;
  fonte: 'result' | 'employeeRelationShip' | 'erro_cbo_bloqueado' | null;
}

/**
 * Extrai dados do trabalhador (CBO, CNAE, Nome, Empregador) do retorno_margem
 * Busca em múltiplos caminhos:
 * 1. result[0] (quando consulta ok)
 * 2. dataprevValidationResponses[0].employeeRelationShip (dentro de erros)
 * 3. Mensagem de erro "CBO bloqueado: XXXXXX - DESCRICAO"
 */
export const extrairDadosTrabalhador = (lead: LeadData): DadosTrabalhador => {
  const resultado: DadosTrabalhador = {
    nome: null,
    cboCodigo: null,
    cboDescricao: null,
    cnaeCodigo: null,
    cnaeDescricao: null,
    empregador: null,
    fonte: null
  };

  const margemRaw = lead.retorno_margem;
  if (!margemRaw) return resultado;

  // Converter para string para busca com regex
  const textoOriginal = typeof margemRaw === 'string' ? margemRaw : JSON.stringify(margemRaw);
  
  // Limpar escapes para facilitar busca
  const texto = textoOriginal.replace(/\\n/g, ' ').replace(/\\t/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  // ============================================
  // EXTRAIR CBO (código de 6 dígitos)
  // ============================================
  
  // Padrão 1: "cbo": { "codigo": 123456, "descricao": "..."
  const cboMatch = texto.match(/"cbo"\s*:\s*\{\s*"codigo"\s*:\s*(\d{6})\s*,\s*"descricao"\s*:\s*"([^"]+)"/);
  if (cboMatch) {
    resultado.cboCodigo = cboMatch[1];
    resultado.cboDescricao = cboMatch[2];
    resultado.fonte = 'result';
  }
  
  // Padrão 2: CBO bloqueado: 123456 - DESCRICAO (em mensagens de erro)
  if (!resultado.cboCodigo) {
    const cboBloq = textoOriginal.match(/CBO bloqueado[:\s]+(\d{6})\s*[-–]\s*([^,\.\n"\\]+)/i);
    if (cboBloq) {
      resultado.cboCodigo = cboBloq[1];
      resultado.cboDescricao = cboBloq[2].trim();
      resultado.fonte = 'erro_cbo_bloqueado';
    }
  }

  // ============================================
  // EXTRAIR CNAE (código de 7 dígitos)
  // ============================================
  
  const cnaeMatch = texto.match(/"cnae"\s*:\s*\{\s*"codigo"\s*:\s*(\d{7})\s*,\s*"descricao"\s*:\s*"([^"]+)"/);
  if (cnaeMatch) {
    resultado.cnaeCodigo = cnaeMatch[1];
    resultado.cnaeDescricao = cnaeMatch[2];
  }

  // ============================================
  // EXTRAIR NOME DO EMPREGADOR
  // ============================================
  
  const empMatch = texto.match(/"nomeEmpregador"\s*:\s*"([^"]+)"/);
  if (empMatch) {
    resultado.empregador = empMatch[1];
  }

  // ============================================
  // EXTRAIR NOME DO CLIENTE
  // ============================================
  
  // O nome do cliente vem em "nome": "..." (em maiúsculas, com espaços)
  const nomeMatch = texto.match(/"nome"\s*:\s*"([A-Z][A-Z\s]+)"/);
  if (nomeMatch) {
    const nome = nomeMatch[1];
    // Verificar se é um nome válido (mais de uma palavra)
    if (nome.length > 5 && nome.includes(' ')) {
      resultado.nome = nome;
    }
  }

  // Se encontrou dados do employeeRelationShip, atualizar a fonte
  if (resultado.cboCodigo && texto.includes('employeeRelationShip') && resultado.fonte !== 'erro_cbo_bloqueado') {
    resultado.fonte = 'employeeRelationShip';
  }

  return resultado;
};

/**
 * Extrai apenas o código CBO do lead (conveniente para exibição em tabelas)
 */
export const extrairCBOCodigo = (lead: LeadData): string | null => {
  const dados = extrairDadosTrabalhador(lead);
  return dados.cboCodigo;
};

/**
 * Extrai CBO completo (código - descrição) do lead
 */
export const extrairCBOCompleto = (lead: LeadData): string | null => {
  const dados = extrairDadosTrabalhador(lead);
  if (!dados.cboCodigo) return null;
  if (!dados.cboDescricao) return dados.cboCodigo;
  return `${dados.cboCodigo} - ${dados.cboDescricao}`;
};

/**
 * Extrai nome do empregador do lead
 */
export const extrairEmpregador = (lead: LeadData): string | null => {
  const dados = extrairDadosTrabalhador(lead);
  return dados.empregador;
};

/**
 * Extrai CNAE completo (código - descrição) do lead
 */
export const extrairCNAECompleto = (lead: LeadData): string | null => {
  const dados = extrairDadosTrabalhador(lead);
  if (!dados.cnaeCodigo) return null;
  if (!dados.cnaeDescricao) return dados.cnaeCodigo;
  return `${dados.cnaeCodigo} - ${dados.cnaeDescricao}`;
};

/**
 * Interface para CBO com informações de status
 */
export interface CBOInfo {
  codigo: string;
  descricao: string;
  isBloqueado: boolean;
  fonte: 'result' | 'employeeRelationShip' | 'erro_cbo_bloqueado' | null;
}

/**
 * Verifica se o lead tem CBO bloqueado
 * Retorna true se o CBO foi extraído de uma mensagem de erro de bloqueio
 */
export const isCBOBloqueado = (lead: LeadData): boolean => {
  const dados = extrairDadosTrabalhador(lead);
  return dados.fonte === 'erro_cbo_bloqueado';
};

/**
 * Extrai informações completas do CBO incluindo status de bloqueio
 */
export const extrairCBOInfo = (lead: LeadData): CBOInfo | null => {
  const dados = extrairDadosTrabalhador(lead);
  if (!dados.cboCodigo) return null;
  
  return {
    codigo: dados.cboCodigo,
    descricao: dados.cboDescricao || '',
    isBloqueado: dados.fonte === 'erro_cbo_bloqueado',
    fonte: dados.fonte
  };
};

/**
 * Extrai informações de CBO bloqueado com valor de margem perdida
 */
export interface CBOBloqueadoInfo {
  codigo: string;
  descricao: string;
  valorMargemPerdida: number | null;
}

export const extrairCBOBloqueadoComMargem = (lead: LeadData): CBOBloqueadoInfo | null => {
  const dados = extrairDadosTrabalhador(lead);
  
  // Só retorna se for um CBO bloqueado
  if (dados.fonte !== 'erro_cbo_bloqueado' || !dados.cboCodigo) {
    return null;
  }
  
  const margemPerdida = extrairValorMargemDisponivelLead(lead);
  
  return {
    codigo: dados.cboCodigo,
    descricao: dados.cboDescricao || '',
    valorMargemPerdida: margemPerdida
  };
};

/**
 * Extrai informações de CBO aprovado (leads com proposta aprovada)
 */
export interface CBOAprovadoInfo {
  codigo: string;
  descricao: string;
  valorMargem: number | null;
  empregador: string | null;
}

export const extrairCBOAprovado = (lead: LeadData): CBOAprovadoInfo | null => {
  // Verificar se o lead foi aprovado (retorno_proposta.status === "success")
  const propostaRaw = lead.retorno_proposta;
  if (!propostaRaw) return null;
  
  const propostaTexto = typeof propostaRaw === 'string' ? propostaRaw : JSON.stringify(propostaRaw);
  const isAprovado = propostaTexto.includes('"status":"success"') || 
                     propostaTexto.includes('"status": "success"');
  
  if (!isAprovado) return null;
  
  const dados = extrairDadosTrabalhador(lead);
  
  // Só retorna se encontrou CBO e NÃO é de erro de bloqueio
  if (!dados.cboCodigo || dados.fonte === 'erro_cbo_bloqueado') {
    return null;
  }
  
  return {
    codigo: dados.cboCodigo,
    descricao: dados.cboDescricao || '',
    valorMargem: extrairValorMargemDisponivelLead(lead),
    empregador: dados.empregador
  };
};

/**
 * Agrupa CBOs bloqueados por código e calcula totais
 */
export interface CBOBloqueadoAgrupado {
  codigo: string;
  descricao: string;
  quantidade: number;
  margemTotalPerdida: number;
  margemMediaPerdida: number;
}

export const agruparCBOsBloqueados = (leads: LeadData[]): CBOBloqueadoAgrupado[] => {
  const agrupamento: Record<string, { 
    descricao: string; 
    quantidade: number; 
    margemTotal: number;
    leadsComMargem: number;
  }> = {};
  
  leads.forEach(lead => {
    const cboInfo = extrairCBOBloqueadoComMargem(lead);
    if (!cboInfo) return;
    
    if (!agrupamento[cboInfo.codigo]) {
      agrupamento[cboInfo.codigo] = {
        descricao: cboInfo.descricao,
        quantidade: 0,
        margemTotal: 0,
        leadsComMargem: 0
      };
    }
    
    agrupamento[cboInfo.codigo].quantidade++;
    
    if (cboInfo.valorMargemPerdida !== null && cboInfo.valorMargemPerdida > 0) {
      agrupamento[cboInfo.codigo].margemTotal += cboInfo.valorMargemPerdida;
      agrupamento[cboInfo.codigo].leadsComMargem++;
    }
  });
  
  return Object.entries(agrupamento)
    .map(([codigo, dados]) => ({
      codigo,
      descricao: dados.descricao,
      quantidade: dados.quantidade,
      margemTotalPerdida: dados.margemTotal,
      margemMediaPerdida: dados.leadsComMargem > 0 
        ? dados.margemTotal / dados.leadsComMargem 
        : 0
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
};

/**
 * Agrupa CBOs aprovados por código e calcula totais
 */
export interface CBOAprovadoAgrupado {
  codigo: string;
  descricao: string;
  quantidade: number;
  margemTotalAprovada: number;
  margemMediaAprovada: number;
  topEmpregador: string | null;
}

export const agruparCBOsAprovados = (leads: LeadData[]): CBOAprovadoAgrupado[] => {
  const agrupamento: Record<string, { 
    descricao: string; 
    quantidade: number; 
    margemTotal: number;
    leadsComMargem: number;
    empregadores: Record<string, number>;
  }> = {};
  
  leads.forEach(lead => {
    const cboInfo = extrairCBOAprovado(lead);
    if (!cboInfo) return;
    
    if (!agrupamento[cboInfo.codigo]) {
      agrupamento[cboInfo.codigo] = {
        descricao: cboInfo.descricao,
        quantidade: 0,
        margemTotal: 0,
        leadsComMargem: 0,
        empregadores: {}
      };
    }
    
    agrupamento[cboInfo.codigo].quantidade++;
    
    if (cboInfo.valorMargem !== null && cboInfo.valorMargem > 0) {
      agrupamento[cboInfo.codigo].margemTotal += cboInfo.valorMargem;
      agrupamento[cboInfo.codigo].leadsComMargem++;
    }
    
    if (cboInfo.empregador) {
      agrupamento[cboInfo.codigo].empregadores[cboInfo.empregador] = 
        (agrupamento[cboInfo.codigo].empregadores[cboInfo.empregador] || 0) + 1;
    }
  });
  
  return Object.entries(agrupamento)
    .map(([codigo, dados]) => {
      // Encontrar empregador com mais leads
      let topEmpregador: string | null = null;
      let maxLeads = 0;
      Object.entries(dados.empregadores).forEach(([emp, count]) => {
        if (count > maxLeads) {
          maxLeads = count;
          topEmpregador = emp;
        }
      });
      
      return {
        codigo,
        descricao: dados.descricao,
        quantidade: dados.quantidade,
        margemTotalAprovada: dados.margemTotal,
        margemMediaAprovada: dados.leadsComMargem > 0 
          ? dados.margemTotal / dados.leadsComMargem 
          : 0,
        topEmpregador
      };
    })
    .sort((a, b) => b.quantidade - a.quantidade);
};

/**
 * Interface para CBO bloqueado com informações de margem
 */
export interface CBOBloqueadoInfo {
  codigo: string;
  descricao: string;
  margemDisponivel: number | null;
  fonte: 'erro_cbo_bloqueado' | 'result' | 'employeeRelationShip';
}

/**
 * Extrai informações de CBO bloqueado de um lead, incluindo valor de margem
 * Usado para calcular margem perdida por CBO bloqueado
 */
export const extrairCBOBloqueado = (lead: LeadData): CBOBloqueadoInfo | null => {
  const margemRaw = lead.retorno_margem;
  if (!margemRaw) return null;

  const textoOriginal = typeof margemRaw === 'string' ? margemRaw : JSON.stringify(margemRaw);
  
  // Buscar padrão "CBO bloqueado: 123456 - DESCRICAO"
  const cboBloq = textoOriginal.match(/CBO bloqueado[:\s]+(\d{6})\s*[-–]\s*([^,\.\n"\\]+)/i);
  
  if (!cboBloq) return null;

  // Extrair valor de margem disponível
  let margemDisponivel: number | null = null;
  
  // Padrão 1: "valorMargemDisponivel": 123.45
  const margemMatch1 = textoOriginal.match(/"valorMargemDisponivel"\s*:\s*([\d.,-]+)/);
  if (margemMatch1) {
    margemDisponivel = parseFloat(margemMatch1[1].replace(',', '.'));
  }
  
  // Padrão 2: R$ 123,45 na mensagem de erro
  if (margemDisponivel === null) {
    const margemMatch2 = textoOriginal.match(/R\$\s*([\d.,]+)/);
    if (margemMatch2) {
      margemDisponivel = parseFloat(margemMatch2[1].replace('.', '').replace(',', '.'));
    }
  }

  return {
    codigo: cboBloq[1],
    descricao: cboBloq[2].trim(),
    margemDisponivel: margemDisponivel,
    fonte: 'erro_cbo_bloqueado'
  };
};

/**
 * Extrai informações de CBO da margem de um lead
 * Usado para análise de CBOs que aprovam
 */
export const extrairCBODaMargem = (lead: LeadData): CBOBloqueadoInfo | null => {
  const margemRaw = lead.retorno_margem;
  if (!margemRaw) return null;

  const textoOriginal = typeof margemRaw === 'string' ? margemRaw : JSON.stringify(margemRaw);
  const texto = textoOriginal.replace(/\\n/g, ' ').replace(/\\t/g, ' ').replace(/\\"/g, '"');

  // Padrão 1: "cbo": { "codigo": 123456, "descricao": "..."
  const cboMatch = texto.match(/"cbo"\s*:\s*\{\s*"codigo"\s*:\s*(\d{6})\s*,\s*"descricao"\s*:\s*"([^"]+)"/);
  
  if (!cboMatch) return null;

  // Extrair valor de margem disponível
  let margemDisponivel: number | null = null;
  const margemMatch = textoOriginal.match(/"valorMargemDisponivel"\s*:\s*([\d.,-]+)/);
  if (margemMatch) {
    margemDisponivel = parseFloat(margemMatch[1].replace(',', '.'));
  }

  return {
    codigo: cboMatch[1],
    descricao: cboMatch[2].trim(),
    margemDisponivel: margemDisponivel,
    fonte: 'result'
  };
};

/**
 * Verifica se um lead tem CBO bloqueado
 */
export const temCBOBloqueado = (lead: LeadData): boolean => {
  return extrairCBOBloqueado(lead) !== null;
};

/**
 * Verifica se um lead é aprovado (retorno_proposta.status === "success")
 */
export const isLeadAprovado = (lead: LeadData): boolean => {
  const proposta = lead.retorno_proposta;
  if (!proposta) return false;
  
  const texto = typeof proposta === 'string' ? proposta : JSON.stringify(proposta);
  return texto.includes('"status":"success"') || texto.includes('"status": "success"');
};

/**
 * Exporta funções úteis para visualizações e outros módulos
 */
export { extrairValorMargem, hasValoresFinanceiros, hasStatusSuccess, hasBloqueioNegocio, hasErrosTecnicosNoProcesso };
