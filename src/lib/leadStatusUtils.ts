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

export type StatusNormalizado = "aprovado" | "reprovado" | "pendente";

interface LeadData {
  banco?: string | null;
  status?: string | null;
  retorno_margem?: unknown;
  retorno_simulacao?: unknown;
  retorno_proposta?: unknown;
  retorno_get_proposta?: unknown;
  retorno_autorizacao?: unknown;
}

// =====================================================
// UTILITÁRIOS DE PARSING
// =====================================================

/**
 * Extrai valor numérico de qualquer formato
 */
const parseValorNumerico = (valor: any): number => {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    const cleaned = valor.replace(/[^\d.,\-]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }
  return 0;
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
 * Verifica se é erro de conexão/timeout (PENDENTE, não REPROVADO)
 */
const isErroConexao = (erro: string): boolean => {
  const lower = erro.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("curl error") ||
    lower.includes("rate limit") ||
    lower.includes("connection") ||
    lower.includes("network") ||
    (lower.includes("limite") && lower.includes("excedido"))
  );
};

// =====================================================
// VERIFICAÇÃO DE VALORES FINANCEIROS
// =====================================================

/**
 * Extrai valor de margem disponível de todas as fontes possíveis
 * Adaptado para V8, UY3 e PRESENÇA
 */
const extrairValorMargem = (lead: LeadData): number => {
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
  let maiorMargem = 0;
  
  // 1. retorno_margem como array (UY3)
  if (Array.isArray(margem) && margem.length > 0) {
    for (const item of margem) {
      // UY3: result[].valorMargemDisponivel
      if (item?.result && Array.isArray(item.result)) {
        for (const res of item.result) {
          if (res?.valorMargemDisponivel) {
            maiorMargem = Math.max(maiorMargem, parseValorNumerico(res.valorMargemDisponivel));
          }
        }
      }
      // Direto no item
      if (item?.valorMargemDisponivel) {
        maiorMargem = Math.max(maiorMargem, parseValorNumerico(item.valorMargemDisponivel));
      }
    }
  }
  
  // 2. retorno_margem.valorMargemDisponivel (direto)
  if (margem?.valorMargemDisponivel) {
    maiorMargem = Math.max(maiorMargem, parseValorNumerico(margem.valorMargemDisponivel));
  }
  
  // 3. retorno_margem.details.dataprevValidationResponses (UY3 aninhado)
  if (margem?.details?.dataprevValidationResponses) {
    const responses = margem.details.dataprevValidationResponses;
    if (Array.isArray(responses)) {
      for (const response of responses) {
        const emp = response?.employeeRelationShip;
        if (emp?.valorMargemDisponivel) {
          maiorMargem = Math.max(maiorMargem, parseValorNumerico(emp.valorMargemDisponivel));
        }
      }
    }
  }
  
  // 4. retorno_simulacao - CRÍTICO para V8
  if (simulacao) {
    // V8: initialValue, liquidValue, requestedAmount
    if (simulacao.initialValue) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.initialValue));
    }
    if (simulacao.liquidValue) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.liquidValue));
    }
    if (simulacao.requestedAmount) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.requestedAmount));
    }
    
    // V8/UY3: details nested
    if (simulacao.details?.availableMarginValue) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.details.availableMarginValue));
    }
    if (simulacao.details?.liquidValue) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.details.liquidValue));
    }
    if (simulacao.details?.installmentValue) {
      maiorMargem = Math.max(maiorMargem, parseValorNumerico(simulacao.details.installmentValue));
    }
    
    // Campos diretos legados
    const valorParcela = parseValorNumerico(simulacao.valor_parcela);
    const valorFinanciado = parseValorNumerico(simulacao.valor_financiado);
    if (valorParcela > 0) maiorMargem = Math.max(maiorMargem, valorParcela);
    if (valorFinanciado > 0) maiorMargem = Math.max(maiorMargem, valorFinanciado);
  }
  
  return maiorMargem;
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
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const proposta = lead.retorno_proposta as any;
  
  // Verificar mensagens de erro
  const mensagens = [
    margem?.error,
    margem?.message,
    margem?.details?.reason,
    simulacao?.error,
    simulacao?.message,
    proposta?.error,
    proposta?.message
  ].filter(Boolean).map(String);
  
  for (const msg of mensagens) {
    if (isBloqueioNegocio(msg) || isSemMargem(msg)) {
      return true;
    }
  }
  
  // UY3: Verificar reasonForIneligibility
  if (margem?.details?.dataprevValidationResponses) {
    const responses = margem.details.dataprevValidationResponses;
    if (Array.isArray(responses)) {
      for (const resp of responses) {
        if (Array.isArray(resp?.reasonForIneligibility)) {
          for (const reason of resp.reasonForIneligibility) {
            const msg = String(reason?.messageError || reason?.errorField || "");
            if (isBloqueioNegocio(msg)) {
              return true;
            }
          }
        }
      }
    }
  }
  
  return false;
};

/**
 * Verifica se a API retornou status "success" ou equivalente
 * REGRA PRINCIPAL: retorno_proposta.status = "success" indica proposta aceita
 * 
 * Padrão para V8 e UY3:
 * - retorno_proposta.status = "success" = proposta aceita pelo banco
 * - retorno_get_proposta.status = "formalization" ou "pending" = em andamento (válido)
 */
const hasStatusSuccess = (lead: LeadData): boolean => {
  const proposta = lead.retorno_proposta as any;
  const getProposta = lead.retorno_get_proposta as any;
  const simulacao = lead.retorno_simulacao as any;
  const margem = lead.retorno_margem as any;
  
  // =====================================================
  // REGRA PRINCIPAL: retorno_proposta.status = "success"
  // Este é o indicador MAIS CONFIÁVEL de aprovação
  // =====================================================
  if (proposta?.status) {
    const status = String(proposta.status).toLowerCase();
    if (status === "success" || status === "aprovada" || status === "approved") {
      return true;
    }
  }
  
  // V8/UY3: formalizationLink presente indica sucesso
  if (proposta?.formalizationLink) {
    return true;
  }
  
  // V8/UY3: retorno_get_proposta.status indica proposta em andamento
  if (getProposta?.status) {
    const status = String(getProposta.status).toLowerCase();
    // "formalization" = em formalização (V8)
    // "pending" = aguardando formalização (UY3)
    // Ambos indicam que a proposta foi ACEITA pelo banco
    if (status === "success" || status === "formalization" || status === "pending" || status === "approved") {
      return true;
    }
  }
  
  // Genérico: retorno_simulacao.details.status
  if (simulacao?.details?.status) {
    const status = String(simulacao.details.status).toUpperCase();
    if (status === "APPROVED" || status === "SUCCESS") {
      return true;
    }
  }
  
  // PRESENÇA/UY3: Se tem dados de margem SEM erro, considera sucesso na consulta
  if (margem && !margem.error) {
    // Se tem dados do funcionário, a consulta foi bem sucedida
    if (margem.valorMargemDisponivel !== undefined || 
        margem.details?.dataprevValidationResponses) {
      return true;
    }
  }
  
  // UY3: Se tem dataprevValidationResponses com dados, é sucesso (mesmo com erro wrapper)
  // MAS apenas se não houver bloqueio de negócio
  if (margem?.details?.dataprevValidationResponses) {
    const responses = margem.details.dataprevValidationResponses;
    if (Array.isArray(responses) && responses.length > 0) {
      return true;
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
  const autorizacao = lead.retorno_autorizacao as any;
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
  // Se tem valores financeiros, NUNCA é pendente
  if (hasValoresFinanceiros(lead)) {
    return false;
  }
  
  // Limite de consultas excedido
  if (autorizacao) {
    if (Array.isArray(autorizacao.errors)) {
      const hasLimite = autorizacao.errors.some((err: string) => 
        String(err).toLowerCase().includes("limite") && 
        String(err).toLowerCase().includes("excedido")
      );
      if (hasLimite) return true;
    }
    if (autorizacao.error && isErroConexao(String(autorizacao.error))) {
      return true;
    }
  }
  
  // Erros de conexão em outros retornos
  const erros = [
    margem?.error,
    simulacao?.error
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
 * Extrai o motivo do erro/reprovação de um lead
 */
export const extrairMotivoErro = (lead: LeadData): string | null => {
  const proposta = lead.retorno_proposta as any;
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const autorizacao = lead.retorno_autorizacao as any;
  
  // Erros de sistema (pendente)
  if (autorizacao) {
    if (Array.isArray(autorizacao.errors) && autorizacao.errors.length > 0) {
      return autorizacao.errors.join("; ");
    }
    if (autorizacao.error) {
      return autorizacao.error;
    }
  }
  
  // V8: erro na proposta
  if (proposta?.error) {
    return proposta.details?.detail || proposta.error;
  }
  
  // Erro na margem
  if (margem?.error) {
    return margem.error;
  }
  
  // Erro na simulação
  if (simulacao?.error) {
    return simulacao.error;
  }
  if (simulacao?.details?.error) {
    return simulacao.details.error;
  }
  
  // Verificar "sem margem" implícito
  if (extrairValorMargem(lead) === 0 && hasStatusSuccess(lead)) {
    return "Margem indisponível ou zerada";
  }
  
  return null;
};

// =====================================================
// FUNÇÃO PRINCIPAL DE NORMALIZAÇÃO
// =====================================================

/**
 * REGRA MESTRE: Normaliza o status do lead
 * 
 * APROVADO = status success + valores financeiros > 0 + sem bloqueio de negócio
 * REPROVADO = sem valores financeiros OU bloqueio de negócio (CBO, Compliance, etc.)
 * PENDENTE = erros de sistema (timeout, limite, conexão)
 * 
 * Aplicável apenas a: V8, UY3 (PRESENÇA desconsiderado por falta de dados válidos)
 */
export const normalizarStatusLead = (lead: LeadData): StatusNormalizado => {
  // =====================================================
  // PRESENÇA: Desconsiderar - dados incompletos/inválidos
  // O banco PRESENÇA não retorna status da proposta (success/error)
  // =====================================================
  const banco = (lead.banco || "").toLowerCase().trim();
  if (banco.includes("presença") || banco.includes("presenca")) {
    return "pendente"; // Marcar como pendente para revisão manual
  }
  
  const temValoresFinanceiros = hasValoresFinanceiros(lead);
  const temStatusSuccess = hasStatusSuccess(lead);
  const temBloqueio = hasBloqueioNegocio(lead);
  
  // =====================================================
  // 1. APROVADO: Todos os critérios atendidos
  //    - Status success
  //    - Valores financeiros > 0
  //    - SEM bloqueio de negócio (CBO, Compliance, etc.)
  // =====================================================
  if (temStatusSuccess && temValoresFinanceiros && !temBloqueio) {
    return "aprovado";
  }
  
  // =====================================================
  // 2. PENDENTE: Erros de sistema (timeout, limite, etc.)
  //    Apenas se não tem valores financeiros
  // =====================================================
  if (isPendente(lead)) {
    return "pendente";
  }
  
  // =====================================================
  // 3. REPROVADO: Tudo mais
  //    - Status success mas com bloqueio (CBO, Compliance)
  //    - Status success mas sem valores financeiros
  //    - Erro de negócio (margem indisponível)
  //    - Sem dados para processar
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
  if (s === "cpf não encontrado" || s === "cpf_nao_encontrado") return "reprovado";
  
  return "reprovado";
};

/**
 * Exporta funções úteis para visualizações e outros módulos
 */
export { extrairValorMargem, hasValoresFinanceiros, hasStatusSuccess, hasBloqueioNegocio };
