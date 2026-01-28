/**
 * Utilitário centralizado para normalizar status de leads
 * 
 * =====================================================
 * REGRA MESTRE DE CLASSIFICAÇÃO (Todos os Bancos)
 * =====================================================
 * 
 * APROVADO: Apenas quando AMBOS os critérios são atendidos:
 *   1. Status da API = "success" (ou equivalente)
 *   2. Valores financeiros positivos (margem > 0, valor_parcela > 0, etc.)
 * 
 * REPROVADO: Quando qualquer uma das condições:
 *   - Status "success" mas valores financeiros = 0 ou "sem margem"
 *   - Erro de negócio (CBO bloqueado, margem indisponível, etc.)
 *   - Sem dados financeiros válidos
 * 
 * PENDENTE: Apenas para erros de sistema:
 *   - Limite de consultas excedido
 *   - Timeout / Rate limit
 *   - Erro de conexão
 * 
 * NOTA: Status "success" SEM valores financeiros = REPROVADO (não erro)
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
    // Ex: 1.514,26 -> 1514.26
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    // Ex: 151,13 -> 151.13
    normalized = cleaned.replace(/,/g, ".");
  } else if (hasDot) {
    // Ex: 1.514 -> 1514 (milhar) / 1514.26 -> decimal
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
 * Aplicável a todos os bancos, incluindo PRESENÇA
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
 * 
 * NOTA: error 28 (Operation timed out) é tratado como REPROVADO, não PENDENTE
 * Apenas erros de limite excedido são considerados pendentes
 */
const isErroConexao = (erro: string): boolean => {
  const lower = erro.toLowerCase();
  
  // Error 28: Operation timed out - NÃO é pendente, é REPROVADO
  if (lower.includes("error 28") || lower.includes("operation timed out")) {
    return false;
  }
  
  // Apenas limite excedido é considerado pendente
  return (lower.includes("limite") && lower.includes("excedido"));
};

/**
 * Verifica se um retorno contém indicadores de erro técnico
 * Usado para detectar REPROVAÇÃO TÉCNICA em leads com status success
 * ERROS TÉCNICOS: timeout, limite, conexão, erro HTTP
 * NÃO SÃO TÉCNICOS: CBO bloqueado, margem indisponível, CPF não encontrado, etc.
 */
const hasErroTecnico = (retorno: unknown): boolean => {
  if (!retorno) return false;
  
  // Verificar se é string e contém erro técnico
  if (typeof retorno === 'string') {
    const lower = retorno.toLowerCase();
    // Apenas erros técnicos (sistema, infra)
    return lower.includes("timeout") || 
           lower.includes("limite") || 
           lower.includes("conexão") || 
           lower.includes("conexao") ||
           lower.includes("connection") ||
           lower.includes("network") ||
           lower.includes("500") ||
           lower.includes("502") ||
           lower.includes("503") ||
           lower.includes("504") ||
           lower.includes("erro interno") ||
           lower.includes("internal error");
  }
  
  const obj = retorno as Record<string, unknown>;
  
  // Verificar campo "error" direto
  if (obj.error !== undefined && obj.error !== null && obj.error !== "") {
    const errorStr = String(obj.error).toLowerCase();
    
    // Ignorar erros de negócio
    if (errorStr.includes("cbo bloqueado") ||
        errorStr.includes("cbo inválido") ||
        errorStr.includes("margem indisponível") ||
        errorStr.includes("cpf não encontrado") ||
        errorStr.includes("cliente não encontrado") ||
        errorStr.includes("sem margem") ||
        errorStr.includes("sem consulta") ||
        errorStr.includes("bloqueado") ||
        errorStr.includes("negado") ||
        errorStr.includes("reprovado")) {
      return false;
    }
    
    // Considerar apenas erros técnicos
    return errorStr.includes("timeout") || 
           errorStr.includes("limite") || 
           errorStr.includes("conexão") || 
           errorStr.includes("conexao") ||
           errorStr.includes("connection") ||
           errorStr.includes("network") ||
           errorStr.includes("500") ||
           errorStr.includes("502") ||
           errorStr.includes("503") ||
           errorStr.includes("504") ||
           errorStr.includes("erro interno") ||
           errorStr.includes("internal error");
  }
  
  // Verificar campo "erro" direto
  if (obj.erro !== undefined && obj.erro !== null && obj.erro !== "") {
    const erroStr = String(obj.erro).toLowerCase();
    
    // Ignorar erros de negócio
    if (erroStr.includes("cbo bloqueado") ||
        erroStr.includes("cbo inválido") ||
        erroStr.includes("margem indisponível") ||
        erroStr.includes("cpf não encontrado") ||
        erroStr.includes("cliente não encontrado") ||
        erroStr.includes("sem margem") ||
        erroStr.includes("sem consulta") ||
        erroStr.includes("bloqueado") ||
        erroStr.includes("negado") ||
        erroStr.includes("reprovado")) {
      return false;
    }
    
    // Considerar apenas erros técnicos
    return erroStr.includes("timeout") || 
           erroStr.includes("limite") || 
           erroStr.includes("conexão") || 
           erroStr.includes("conexao") ||
           erroStr.includes("connection") ||
           erroStr.includes("network") ||
           erroStr.includes("500") ||
           erroStr.includes("502") ||
           erroStr.includes("503") ||
           erroStr.includes("504") ||
           erroStr.includes("erro interno") ||
           erroStr.includes("internal error");
  }
  
  // Verificar status:"error" - apenas se não for erro de negócio
  if (obj.status === "error") {
    // Verificar contexto para decidir se é erro técnico
    const context = String(obj.message || obj.description || '').toLowerCase();
    
    // Se há contexto de erro de negócio, não é erro técnico
    if (context.includes("cbo bloqueado") ||
        context.includes("margem indisponível") ||
        context.includes("cpf não encontrado") ||
        context.includes("sem margem") ||
        context.includes("bloqueado") ||
        context.includes("negado")) {
      return false;
    }
    
    // Sem contexto ou contexto técnico = erro técnico
    return true;
  }
  
  // Verificar code de erro (geralmente números negativos ou strings de erro)
  if (obj.code !== undefined && obj.code !== null) {
    const code = String(obj.code).toLowerCase();
    const codeNum = Number(obj.code);
    
    // Códigos de erro técnico (HTTP 5xx, números negativos)
    if (code.includes("error") || code.includes("erro") || 
        codeNum < 0 || 
        codeNum === 500 || codeNum === 502 || codeNum === 503 || codeNum === 504) {
      // Verificar se não é erro de negócio com código
      const context = String(obj.message || obj.description || '').toLowerCase();
      if (!context.includes("cbo bloqueado") &&
          !context.includes("margem indisponível") &&
          !context.includes("cpf não encontrado") &&
          !context.includes("sem margem") &&
          !context.includes("bloqueado")) {
        return true;
      }
    }
  }
  
  // Verificar em details
  if (obj.details && typeof obj.details === "object") {
    const details = obj.details as Record<string, unknown>;
    if (details.error || details.erro || details.status === "error") {
      const errorMsg = String(details.error || details.erro || details.message || '').toLowerCase();
      
      // Ignorar erros de negócio
      if (errorMsg.includes("cbo bloqueado") ||
          errorMsg.includes("margem indisponível") ||
          errorMsg.includes("cpf não encontrado") ||
          errorMsg.includes("sem margem") ||
          errorMsg.includes("bloqueado") ||
          errorMsg.includes("negado")) {
        return false;
      }
      
      // Considerar outros erros como técnicos
      return true;
    }
  }
  
  // Verificar mensagens de erro técnicas comuns no texto
  const textoCompleto = JSON.stringify(retorno).toLowerCase();
  const indicadoresErroTecnico = [
    "timeout",
    "limite excedido",
    "conexão",
    "conexao",
    "connection",
    "network",
    "erro interno",
    "internal error",
    "500",
    "502",
    "503",
    "504"
  ];
  
  // Verificar se algum indicador de erro técnico está presente
  // mas não se há contexto de erro de negócio
  if (indicadoresErroTecnico.some(indicador => textoCompleto.includes(indicador))) {
    // Garantir que não é erro de negócio
    if (!textoCompleto.includes("cbo bloqueado") &&
        !textoCompleto.includes("margem indisponível") &&
        !textoCompleto.includes("cpf não encontrado") &&
        !textoCompleto.includes("sem margem") &&
        !textoCompleto.includes("bloqueado")) {
      return true;
    }
  }
  
  return false;
};

/**
 * Verifica se o lead tem erros técnicos em qualquer etapa do processo
 * 
 * REPROVAÇÃO TÉCNICA = APENAS erros de infraestrutura:
 * - Timeout
 * - Erro de conexão
 * - Erro HTTP 5xx
 * - Limite de requisições excedido
 * 
 * NÃO É REPROVAÇÃO TÉCNICA:
 * - CBO bloqueado
 * - Margem indisponível
 * - CPF não encontrado
 * - Qualquer erro de negócio
 */
const hasErrosTecnicosNoProcesso = (lead: LeadData): boolean => {
  // Lista de palavras-chave que indicam erro TÉCNICO real
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
  
  // Função auxiliar para verificar se um texto contém erro técnico
  const contemErroTecnico = (texto: string | undefined | null): boolean => {
    if (!texto) return false;
    const lower = texto.toLowerCase();
    return errosTecnicos.some(erro => lower.includes(erro));
  };
  
  // Verificar cada retorno por erros técnicos específicos
  const retornos = [
    lead.retorno_autorizacao,
    lead.retorno_margem,
    lead.retorno_simulacao,
    lead.retorno_proposta
  ];
  
  for (const retorno of retornos) {
    if (!retorno) continue;
    
    const obj = retorno as Record<string, unknown>;
    
    // Verificar campo error
    if (obj.error && contemErroTecnico(String(obj.error))) {
      return true;
    }
    
    // Verificar campo erro
    if (obj.erro && contemErroTecnico(String(obj.erro))) {
      return true;
    }
    
    // Verificar campo message
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
 * Extrai valor - busca liquidValue em retorno_simulacao
 * Suporta múltiplos formatos/estruturas do retorno_simulacao
 * IMPORTANTE: liquidValue vem em centavos (sem separadores), então divide por 100
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
  
  // Converte para número e divide por 100 (valor vem em centavos)
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
// VERIFICAÇÃO DE STATUS SUCCESS
// =====================================================

/**
 * Verifica se há bloqueio de negócio nas mensagens de retorno
 * Se houver bloqueio, NÃO é considerado success mesmo com status success
 */
const hasBloqueioNegocio = (lead: LeadData): boolean => {
  const margem = lead.retorno_margem;
  const simulacao = lead.retorno_simulacao;
  const proposta = lead.retorno_proposta;
  const margemObj = isRecord(margem) ? margem : null;
  const simulacaoObj = isRecord(simulacao) ? simulacao : null;
  const propostaObj = isRecord(proposta) ? proposta : null;
  
  // Verificar mensagens de erro
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
 * Verifica se a proposta foi aprovada
 * 
 * CRITÉRIO ÚNICO DE APROVAÇÃO:
 * - retorno_proposta.status === "success" (APENAS este valor)
 * 
 * Suporta múltiplos padrões de estrutura do retorno_proposta
 * Qualquer outra mensagem ou status = REPROVADO
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
  
  // Se tem valores financeiros, NUNCA é pendente
  if (hasValoresFinanceiros(lead)) {
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

/**
 * Extrai o JSON interno do campo error
 * O campo error contém uma string com "Response completo: {JSON}"
 * Esta função extrai e parseia esse JSON interno
 */
const extrairJsonInternoDoError = (errorString: string): Record<string, unknown> | null => {
  if (!errorString) return null;
  
  // Procurar por "Response completo: " e extrair o JSON após isso
  const responseMatch = errorString.match(/Response completo:\s*(\{[\s\S]*\})/);
  if (responseMatch && responseMatch[1]) {
    try {
      // Limpar caracteres de escape (\n, \t, etc)
      const jsonStr = responseMatch[1]
        .replace(/\\n/g, '')
        .replace(/\\t/g, '')
        .replace(/\\"/g, '"');
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  
  // Fallback: tentar parsear a string inteira como JSON
  try {
    return JSON.parse(errorString) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Extrai todos os messageError do array reasonForIneligibility
 * e transforma em um texto único separado por " | "
 */
const extrairTodosMessageErrors = (jsonInterno: Record<string, unknown>): string | null => {
  const messages: string[] = [];
  
  // Caminho: details.dataprevValidationResponses[0].reasonForIneligibility[].messageError
  const details = jsonInterno.details as Record<string, unknown> | undefined;
  if (!details) return null;
  
  const dataprevResponses = details.dataprevValidationResponses as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(dataprevResponses) || dataprevResponses.length === 0) return null;
  
  // Iterar por todas as respostas
  for (const response of dataprevResponses) {
    const reasons = response.reasonForIneligibility as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(reasons)) continue;
    
    // Iterar por todos os motivos de inelegibilidade
    for (const reason of reasons) {
      if (reason.messageError && typeof reason.messageError === 'string') {
        messages.push(reason.messageError);
      }
    }
  }
  
  if (messages.length === 0) return null;
  
  // Retornar todos os messageErrors unidos por " | "
  return messages.join(' | ');
};

/**
 * Extrai messageError de um retorno JSON
 * 1. Extrai o JSON interno do campo error
 * 2. Busca todos os messageError do array reasonForIneligibility
 * 3. Transforma em texto único
 */
const extrairMessageError = (retorno: unknown): string | null => {
  if (!retorno) return null;
  
  const obj = retorno as Record<string, unknown>;
  
  // Tentar extrair do campo error (string com JSON embutido)
  if (obj.error && typeof obj.error === 'string') {
    const jsonInterno = extrairJsonInternoDoError(obj.error);
    if (jsonInterno) {
      const mensagens = extrairTodosMessageErrors(jsonInterno);
      if (mensagens) return mensagens;
    }
  }
  
  // Fallback: tentar extrair diretamente do objeto details
  if (obj.details && typeof obj.details === 'object') {
    const mensagens = extrairTodosMessageErrors({ details: obj.details });
    if (mensagens) return mensagens;
  }
  
  return null;
};

/**
 * Classifica determinísticamente se um lead possui "margem reprovada".
 *
 * Regras obrigatórias:
 * - Só classifica como margem reprovada quando o PRIMEIRO erro do funil ocorreu em `retorno_margem`.
 * - Erros em outras etapas NÃO caracterizam margem reprovada.
 * - Prioriza evidência numérica (valorMargemDisponivel/valorMargem). Texto é fallback.
 * - Exclui INVALID_FORM, 429/rate limit, timeout/500 e erros técnicos.
 */
export const classificarMargemReprovada = (lead: LeadData): MargemReprovacaoInfo => {
  const funilErro = extrairErroFunil(lead);
  const erro_etapa = funilErro?.erro_etapa ?? null;
  const erro_code = funilErro?.erro_code ?? null;
  const erro_motivo = funilErro?.erro_motivo ?? null;
  const criterios: string[] = [];

  if (erro_etapa !== "retorno_margem") {
    criterios.push("erro_etapa_nao_e_retorno_margem");
  }

  const motivoNorm = normalizeText(erro_motivo ?? "");

  if (erro_code === "429" || includesAny(motivoNorm, NAO_CLASSIFICAR_MARGEM_KEYWORDS)) {
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa,
      erro_code,
      erro_motivo,
      valorMargemDisponivel: null,
      valorMinimoProduto: null,
      parcelaSolicitada: null,
      limiar: null,
      criterios: [...criterios, "excluido_por_erro_tecnico_ou_rate_limit"],
    };
  }

  const numeric = extrairValorMargemDisponivelDoLead(lead);
  criterios.push(...numeric.criterios);

  const valorMargemDisponivel = numeric.valorMargemDisponivel;
  const valorMinimoProduto = numeric.valorMinimoProduto;

  // Detectar inelegibilidade (para usar depois, mas priorizar classificação por margem)
  const messageErrorMargem = extrairMessageError(parseJsonSafe<unknown>(lead.retorno_margem) ?? lead.retorno_margem);
  const inelegibilidadeText = normalizeText([erro_motivo ?? "", messageErrorMargem ?? ""].filter(Boolean).join(" | "));
  const hasInelegibilidade = includesAny(inelegibilidadeText, CONVENIO_INELEGIVEL_KEYWORDS) || isBloqueioNegocio(inelegibilidadeText);

  // PRIORIDADE: Classificar por margem PRIMEIRO (zerada/negativa/baixa)
  // Mesmo que haja inelegibilidade, se a margem é zerada/negativa, classificar como margem
  if (!(typeof valorMargemDisponivel === "number" && !Number.isNaN(valorMargemDisponivel))) {
    // Sem margem numérica: verificar inelegibilidade
    if (hasInelegibilidade) {
      return {
        isMargemReprovada: false,
        tipo_reprovacao: "inelegibilidade_convenio",
        erro_etapa,
        erro_code,
        erro_motivo,
        valorMargemDisponivel: null,
        valorMinimoProduto,
        parcelaSolicitada: null,
        limiar: null,
        criterios: [...criterios, "inelegibilidade_convenio_detectada"],
      };
    }
    return {
      isMargemReprovada: false,
      tipo_reprovacao: "nao_aplicavel",
      erro_etapa,
      erro_code,
      erro_motivo,
      valorMargemDisponivel: null,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios: [...criterios, "valorMargemDisponivel_ausente"],
    };
  }

  if (valorMargemDisponivel < 0) {
    criterios.push("valorMargemDisponivel_lt_0");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_negativa",
      erro_etapa,
      erro_code,
      erro_motivo,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }

  if (valorMargemDisponivel === 0) {
    criterios.push("valorMargemDisponivel_eq_0");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_zerada",
      erro_etapa,
      erro_code,
      erro_motivo,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada: null,
      limiar: null,
      criterios,
    };
  }

  const parcelaInfo = extrairParcelaSolicitadaDoLead(lead);
  criterios.push(...parcelaInfo.criterios);

  const parcelaSolicitada = parcelaInfo.parcelaSolicitada;
  const limiar = Math.max(100, parcelaSolicitada ?? 0, valorMinimoProduto ?? 0);
  criterios.push("limiar_max_100_parcela_solicitada_valorMinimoProduto");
  if (parcelaSolicitada === null) criterios.push("limiar_sem_parcela_solicitada");
  if (valorMinimoProduto === null) criterios.push("limiar_sem_valorMinimoProduto");

  if (valorMargemDisponivel > 0 && valorMargemDisponivel < limiar) {
    criterios.push("valorMargemDisponivel_gt_0_lt_limiar");
    return {
      isMargemReprovada: true,
      tipo_reprovacao: "margem_insuficiente",
      erro_etapa,
      erro_code,
      erro_motivo,
      valorMargemDisponivel,
      valorMinimoProduto,
      parcelaSolicitada,
      limiar,
      criterios,
    };
  }

  return {
    isMargemReprovada: false,
    tipo_reprovacao: "nao_aplicavel",
    erro_etapa,
    erro_code,
    erro_motivo,
    valorMargemDisponivel,
    valorMinimoProduto,
    parcelaSolicitada,
    limiar,
    criterios: [...criterios, "sem_evidencia_suficiente"],
  };
};


/**
 * Extrai o motivo da reprovação técnica
 * Busca messageError APENAS em RETORNO_MARGEM
 */
export const extrairMotivoReprovacaoTecnica = (lead: LeadData): string | null => {
  const messageError = extrairMessageError(lead.retorno_margem);
  if (messageError) return messageError;

  const funilErro = extrairErroFunil(lead);
  if (funilErro?.erro_motivo) return funilErro.erro_motivo;
  if (funilErro?.erro_code) return funilErro.erro_code;

  const getProposta = lead.retorno_get_proposta;
  const getPropostaHasData =
    getProposta && typeof getProposta === "object" && Object.keys(getProposta as object).length > 0;

  if (getPropostaHasData) {
    const missing: string[] = [];
    const isEmptyObj = (v: unknown) => typeof v === "object" && v !== null && Object.keys(v as object).length === 0;

    if (!lead.retorno_autorizacao || isEmptyObj(lead.retorno_autorizacao)) missing.push("Autorização");
    if (!lead.retorno_margem || isEmptyObj(lead.retorno_margem)) missing.push("Margem");
    if (!lead.retorno_simulacao || isEmptyObj(lead.retorno_simulacao)) missing.push("Simulação");
    if (!lead.retorno_proposta || isEmptyObj(lead.retorno_proposta)) missing.push("Proposta");

    if (missing.length > 0) {
      return `Processo incompleto (${missing.join(", ")})`;
    }
  }

  return null;
};

/**
 * Extrai o motivo do erro/reprovação de um lead
 */
export const extrairMotivoErro = (lead: LeadData): string | null => {
  const funilErro = extrairErroFunil(lead);
  if (funilErro?.erro_motivo) return funilErro.erro_motivo;
  if (funilErro?.erro_code) return funilErro.erro_code;

  // Verificar "sem margem" implícito
  if (extrairValorMargem(lead) === 0 && hasStatusSuccess(lead)) {
    return "Margem indisponível ou zerada";
  }

  return null;
};

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const UUID_ONLY_RE = new RegExp(`^${UUID_RE.source}$`);

const hasHttpStatusInText = (text: string): string | null => {
  if (!text) return null;
  const m = text.match(/\b(?:status|http|erro|error)\D{0,15}(\d{3})\b/i);
  if (m?.[1]) return m[1];
  const start = text.match(/^\s*(\d{3})\b/);
  return start?.[1] ?? null;
};

const pickFirstString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const stringifyUnknown = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const normalizeText = (v: string): string => {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

/**
 * Palavras-chave para detecção textual (aplicadas SOMENTE quando o erro é em retorno_margem).
 *
 * Importante:
 * - A classificação prioriza evidência numérica (valorMargemDisponivel/valorMargem).
 * - Keywords são fallback para quando não há número ou quando o retorno vem apenas com mensagem.
 */
const MARGEM_KEYWORDS = {
  insuficiente: [
    "margem insuficiente",
    "margem insuf",
    "insufficient margin",
    "margem abaixo",
    "abaixo do minimo",
    "abaixo do mínimo",
    "margem menor que",
    "margem inferior",
    "valor de margem insuficiente",
  ],
  zerada: [
    "margem zerada",
    "margem 0",
    "margem disponivel r$ 0",
    "margem disponivel 0",
    "margem disponível r$ 0",
    "margem disponível 0",
    "sem margem",
    "margem indisponivel",
    "margem indisponível",
    "margem nao retornada",
    "margem não retornada",
    "no margin returned",
  ],
  negativa: [
    "margem negativa",
    "negative margin",
    "saldo negativo",
    "valor negativo",
  ],
} as const;

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
      const parsed = parseValorNumericoStrict(trimmed);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
};

/**
 * Extrai valorMargemDisponivel/valorMargem a partir de retorno_margem / retorno_simulacao.
 *
 * Edge cases:
 * - Alguns bancos retornam margem em `retorno_margem`.
 * - UY3 costuma retornar `valorMargemDisponivel` em `retorno_simulacao[0].result[0]`.
 * - PRESENÇA pode retornar `valorMargem` negativo em retorno_margem.
 */
const extrairValorMargemDisponivelDoLead = (lead: LeadData): {
  valorMargemDisponivel: number | null;
  valorMinimoProduto: number | null;
  criterios: string[];
} => {
  const criterios: string[] = [];

  const margemRaw = parseJsonSafe<unknown>(lead.retorno_margem) ?? lead.retorno_margem;
  const margem = Array.isArray(margemRaw) ? (margemRaw[0] as Record<string, unknown> | null) : (isRecord(margemRaw) ? (margemRaw as Record<string, unknown>) : null);

  if (!margem || Object.keys(margem).length === 0) {
    criterios.push("retorno_margem_ausente_ou_vazio");
  }

  const simulacaoRaw = parseJsonSafe<unknown>(lead.retorno_simulacao) ?? lead.retorno_simulacao;
  const simulacao = Array.isArray(simulacaoRaw) ? (simulacaoRaw[0] as Record<string, unknown> | null) : (isRecord(simulacaoRaw) ? (simulacaoRaw as Record<string, unknown>) : null);

  // Extrair valorMargemDisponivel de múltiplos caminhos possíveis
  // Caminho principal: details.dataprevValidationResponses[].employeeRelationShip.valorMargemDisponivel
  // O JSON pode estar embutido no campo "error" como string
  const extrairMargemDeDataprev = (): number | null => {
    if (!margem) return null;
    
    // Tentar extrair details de múltiplas fontes
    let details: Record<string, unknown> | null = null;
    
    // 1. details direto como objeto
    if (isRecord(margem["details"])) {
      details = margem["details"] as Record<string, unknown>;
    }
    
    // 2. Se details não tem dataprevValidationResponses, tentar parsear do campo error
    if (!details || !details["dataprevValidationResponses"]) {
      const errorStr = typeof margem["error"] === "string" ? margem["error"] : null;
      if (errorStr) {
        // Extrair JSON de "Response completo: {...}"
        const match = errorStr.match(/Response completo:\s*(\{[\s\S]*\})/);
        if (match?.[1]) {
          try {
            const cleanJson = match[1].replace(/\\n/g, "").replace(/\\t/g, "").replace(/\\"/g, '"');
            const parsed = JSON.parse(cleanJson) as Record<string, unknown>;
            if (isRecord(parsed["details"])) {
              details = parsed["details"] as Record<string, unknown>;
            }
          } catch {
            // Ignorar erro de parse
          }
        }
      }
    }
    
    if (!details) return null;
    
    const dataprevResponses = details["dataprevValidationResponses"];
    if (!Array.isArray(dataprevResponses) || dataprevResponses.length === 0) return null;
    
    // Pegar o primeiro employeeRelationShip com valorMargemDisponivel
    for (const response of dataprevResponses) {
      if (!isRecord(response)) continue;
      const employee = response["employeeRelationShip"];
      if (!isRecord(employee)) continue;
      const valor = pickFirstNumber(employee["valorMargemDisponivel"]);
      if (valor !== null) return valor;
    }
    return null;
  };

  // Caminho 2: result[0].valorMargemDisponivel
  const extrairMargemDeResult = (): number | null => {
    if (!margem) return null;
    const result = margem["result"];
    if (!Array.isArray(result) || result.length === 0) return null;
    const first = result[0];
    if (!isRecord(first)) return null;
    const valor = pickFirstNumber(first["valorMargemDisponivel"]);
    return valor;
  };

  const margemDisponivel = margem
    ? pickFirstNumber(
        margem["valorMargemDisponivel"],
        margem["valor_margem_disponivel"],
        margem["margemDisponivel"],
        margem["margem_disponivel"],
        (isRecord(margem["registroEmpregaticio"]) ? (margem["registroEmpregaticio"] as Record<string, unknown>)["valorMargemDisponivel"] : null),
        (isRecord(margem["details"]) ? (margem["details"] as Record<string, unknown>)["valorMargemDisponivel"] : null),
        (isRecord(margem["result"]) ? (margem["result"] as Record<string, unknown>)["valorMargemDisponivel"] : null)
      ) ?? extrairMargemDeDataprev() ?? extrairMargemDeResult()
    : null;

  const margemAlternativa = margem
    ? pickFirstNumber(
        margem["valorMargem"],
        margem["valor_margem"],
        (isRecord(margem["details"]) ? (margem["details"] as Record<string, unknown>)["valorMargem"] : null)
      )
    : null;

  // Regra: margem deve vir de retorno_margem (não usar simulacao como fonte de margem disponível)
  const valorMargemDisponivel = margemDisponivel ?? margemAlternativa;
  if (margemDisponivel !== null) criterios.push("valorMargemDisponivel_extraido_retorno_margem");
  if (margemDisponivel === null && margemAlternativa !== null) criterios.push("valorMargem_extraido_retorno_margem");

  const valorMinimoProduto = margem
    ? pickFirstNumber(
        margem["valorMinimoProduto"],
        margem["valor_minimo_produto"],
        margem["minimoProduto"],
        margem["minimumProductValue"],
        margem["minValue"],
        (isRecord(margem["details"]) ? (margem["details"] as Record<string, unknown>)["valorMinimoProduto"] : null)
      )
    : null;
  if (valorMinimoProduto !== null) criterios.push("valorMinimoProduto_extraido");

  return { valorMargemDisponivel, valorMinimoProduto, criterios };
};

export const extrairValorMargemDisponivelLead = (lead: LeadData): number | null => {
  return extrairValorMargemDisponivelDoLead(lead).valorMargemDisponivel;
};

const extrairParcelaSolicitadaDoLead = (lead: LeadData): {
  parcelaSolicitada: number | null;
  criterios: string[];
} => {
  const criterios: string[] = [];

  const simulacaoRaw = parseJsonSafe<unknown>(lead.retorno_simulacao) ?? lead.retorno_simulacao;
  const simulacao = Array.isArray(simulacaoRaw) ? (simulacaoRaw[0] as Record<string, unknown> | null) : (isRecord(simulacaoRaw) ? (simulacaoRaw as Record<string, unknown>) : null);

  const parcelaSimulacao = simulacao
    ? pickFirstNumber(
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
      )
    : null;

  if (parcelaSimulacao !== null) {
    criterios.push("parcelaSolicitada_extraida_retorno_simulacao");
    return { parcelaSolicitada: parcelaSimulacao, criterios };
  }

  const resultParcela = (() => {
    if (!simulacao) return null;
    const result = simulacao["result"];
    if (Array.isArray(result) && result.length > 0 && isRecord(result[0])) {
      return pickFirstNumber(
        (result[0] as Record<string, unknown>)["parcela_solicitada"],
        (result[0] as Record<string, unknown>)["parcelaSolicitada"],
        (result[0] as Record<string, unknown>)["installmentValue"],
        (result[0] as Record<string, unknown>)["installmentAmount"],
        (result[0] as Record<string, unknown>)["paymentValue"],
        (result[0] as Record<string, unknown>)["valuePerInstallment"],
        (result[0] as Record<string, unknown>)["valorPrestacao"],
        (result[0] as Record<string, unknown>)["valorParcela"]
      );
    }
    return null;
  })();

  if (resultParcela !== null) {
    criterios.push("parcelaSolicitada_extraida_retorno_simulacao_result0");
    return { parcelaSolicitada: resultParcela, criterios };
  }

  criterios.push("parcelaSolicitada_ausente");
  return { parcelaSolicitada: null, criterios };
};

const extractResponseCompletoFromErrorString = (
  errorString: string | null
): { code: string | null; message: string | null } => {
  if (!errorString) return { code: null, message: null };
  const jsonInterno = extrairJsonInternoDoError(errorString);
  if (!jsonInterno) return { code: null, message: null };

  const details = isRecord(jsonInterno.details) ? jsonInterno.details : null;
  const codeCandidate =
    typeof jsonInterno.code === "string" || typeof jsonInterno.code === "number"
      ? String(jsonInterno.code)
      : typeof (jsonInterno as Record<string, unknown>).statusCode === "string" ||
        typeof (jsonInterno as Record<string, unknown>).statusCode === "number"
      ? String((jsonInterno as Record<string, unknown>).statusCode)
      : typeof (jsonInterno as Record<string, unknown>).httpStatus === "string" ||
        typeof (jsonInterno as Record<string, unknown>).httpStatus === "number"
      ? String((jsonInterno as Record<string, unknown>).httpStatus)
      : null;

  const message = pickFirstString(
    jsonInterno.message,
    (jsonInterno as Record<string, unknown>).detail,
    (jsonInterno as Record<string, unknown>).title,
    (jsonInterno as Record<string, unknown>).error,
    (jsonInterno as Record<string, unknown>).error_description,
    details?.message,
    details?.detail,
    details?.title,
    details?.error
  );

  const code = codeCandidate;
  return { code, message };
};

const buildLegibleMotivo = (payload: {
  statusCode: string | null;
  retorno: unknown;
  errorString: string | null;
  responseCompletoMessage: string | null;
  recordMessage: string | null;
  recordError: string | null;
}): string | null => {
  const { statusCode, errorString, responseCompletoMessage, recordMessage, recordError, retorno } = payload;
  const code = statusCode?.trim() ?? null;
  if (code === "429") {
    const source = pickFirstString(responseCompletoMessage, recordMessage, recordError, errorString) ?? "";
    const lower = source.toLowerCase();
    if (lower.includes("too many requests")) return "Too Many Requests";
    if (lower.includes("rate limit") || lower.includes("ratelimit")) return "Rate limit";
    if (lower.includes("limite") && lower.includes("exced")) return "Limite excedido";
    return "Limite de requisições excedido";
  }

  const fallback = pickFirstString(recordError, errorString);
  if (fallback) {
    const responseCompleto = extractResponseCompletoFromErrorString(fallback);
    if (responseCompleto.message) return responseCompleto.message;
    const statusFromText = hasHttpStatusInText(fallback);
    if (statusFromText === "429") return "Too Many Requests";
  }

  const maybeJson = pickFirstString(errorString);
  if (maybeJson && maybeJson.trim().startsWith("{")) {
    const parsed = extrairJsonInternoDoError(maybeJson);
    if (parsed) {
      const details = isRecord(parsed.details) ? parsed.details : null;
      const msg = pickFirstString(
        parsed.message,
        (parsed as Record<string, unknown>).detail,
        (parsed as Record<string, unknown>).title,
        (parsed as Record<string, unknown>).error,
        details?.message,
        details?.detail,
        details?.title,
        details?.error
      );
      if (msg) return msg;
    }
  }

  return (errorString ? stringifyUnknown(errorString) : stringifyUnknown(retorno)).trim() || null;
};

const extractFormErrorsMessage = (retorno: unknown): string | null => {
  if (!retorno || !isRecord(retorno)) return null;

  const details = isRecord(retorno.details) ? retorno.details : null;
  const formErrors = Array.isArray(details?.formErrors)
    ? details?.formErrors
    : Array.isArray((retorno as Record<string, unknown>).formErrors)
    ? (retorno as Record<string, unknown>).formErrors
    : null;

  if (!Array.isArray(formErrors) || formErrors.length === 0) return null;

  const messages = formErrors
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item)) return pickFirstString(item.message);
      return null;
    })
    .filter(Boolean)
    .map(String);

  return messages.length ? messages.join("; ") : null;
};

const extractRetornoErrorString = (retorno: unknown): string | null => {
  if (!retorno) return null;
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
 * APROVADO = retorno_proposta.status === "success" E SEM erros técnicos no processo
 * REPROVACAO_TECNICA = status success MAS com erros em alguma etapa anterior
 * PENDENTE = erros de sistema (timeout, limite, conexão)
 * REPROVADO = qualquer outro caso
 * 
 * Aplicável a todos os bancos: V8, UY3, PRESENÇA
 */
export const normalizarStatusLead = (lead: LeadData): StatusNormalizado => {
  // =====================================================
  // 1. VERIFICAR SE TEM STATUS SUCCESS NA PROPOSTA
  // =====================================================
  if (hasStatusSuccess(lead)) {
    // =====================================================
    // 1.1 VERIFICAR ERROS TÉCNICOS NO PROCESSO
    // Se tem success mas teve erros no caminho = REPROVAÇÃO TÉCNICA
    // =====================================================
    if (hasErrosTecnicosNoProcesso(lead)) {
      return "reprovacao_tecnica";
    }
    
    // Aprovado sem erros técnicos
    return "aprovado";
  }
  
  // =====================================================
  // 1.2 VERIFICAR SE TEM GET_PROPOSTA COM DADOS
  // (indica sucesso mesmo sem retorno_proposta.status)
  // =====================================================
  const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
  if (getProposta && Object.keys(getProposta).length > 0) {
    // Tem get_proposta com dados = foi processado
    // Verificar se tem erros técnicos no processo
    if (hasErrosTecnicosNoProcesso(lead)) {
      return "reprovacao_tecnica";
    }
    // Se não tem erros técnicos, é aprovado
    return "aprovado";
  }
  
  // =====================================================
  // 2. VERIFICAR SE É PENDENTE (erros de sistema)
  // =====================================================
  if (isPendente(lead)) {
    return "pendente";
  }
  
  // =====================================================
  // 3. REPROVADO: Tudo mais (qualquer outra mensagem)
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

/**
 * Exporta funções úteis para visualizações e outros módulos
 */
export { extrairValorMargem, hasValoresFinanceiros, hasStatusSuccess, hasBloqueioNegocio, hasErrosTecnicosNoProcesso };
