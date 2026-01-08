/**
 * Utilitário centralizado para normalizar status de leads
 * 
 * REGRAS ATUALIZADAS - PRIORIZA VALORES FINANCEIROS SOBRE MENSAGENS DE ERRO
 * 
 * PRINCÍPIO GERAL:
 * Se existem valores financeiros positivos (margem, valor_parcela, valor_financiado, prazo),
 * o lead é APROVADO independente de mensagens de warning/erro.
 * 
 * PENDENTE (prioridade máxima):
 * - retorno_autorizacao.errors contém "Limite de consultas excedido"
 * - Erros de timeout/rate limit que impedem processamento
 * - EXCETO se existem valores financeiros positivos
 * 
 * V8:
 * - APROVADO: retorno_simulacao.details.availableMarginValue > 0
 * - APROVADO: retorno_proposta.status = "success" ou "Aprovada"
 * - REPROVADO: sem valores financeiros válidos
 * 
 * UY3:
 * - APROVADO: dataprevValidationResponses[].employeeRelationShip.valorMargemDisponivel > 0
 * - APROVADO: valor_parcela, valor_financiado ou prazo > 0 na simulação
 * - REPROVADO: sem valores financeiros válidos
 * 
 * PRESENÇA:
 * - APROVADO: retorno_margem.valorMargemDisponivel > 0
 * - REPROVADO: retorno_margem.error presente SEM valores positivos
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

/**
 * Verifica se há erro de limite de consultas no retorno_autorizacao
 */
const isLimiteConsultasExcedido = (autorizacao: any): boolean => {
  if (!autorizacao) return false;
  
  // Formato: { errors: ["Limite de consultas excedido para este parceiro."] }
  if (Array.isArray(autorizacao.errors)) {
    return autorizacao.errors.some((err: string) => 
      String(err).toLowerCase().includes("limite") && 
      String(err).toLowerCase().includes("excedido")
    );
  }
  
  // Formato alternativo: { error: "..." }
  if (autorizacao.error) {
    const erro = String(autorizacao.error).toLowerCase();
    return erro.includes("limite") && erro.includes("excedido");
  }
  
  return false;
};

/**
 * Extrai o motivo do erro/reprovação/pendência de um lead
 */
export const extrairMotivoErro = (lead: LeadData): string | null => {
  const proposta = lead.retorno_proposta as any;
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const autorizacao = lead.retorno_autorizacao as any;
  
  // Verificar limite de consultas excedido primeiro (pendente)
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
  
  // Presença: erro na margem
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
  
  return null;
};

/**
 * Verifica se é erro de conexão/timeout (não conta como reprovação real)
 */
const isErroConexao = (erro: string): boolean => {
  const lower = erro.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("curl error") ||
    lower.includes("rate limit") ||
    lower.includes("connection") ||
    lower.includes("network")
  );
};

// =====================================================
// FILTRO DE SUCESSO - Prioriza valores financeiros
// =====================================================

/**
 * Extrai valor numérico de qualquer formato
 */
const parseValorNumerico = (valor: any): number => {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") {
    // Remove caracteres não numéricos exceto ponto e vírgula
    const cleaned = valor.replace(/[^\d.,\-]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

/**
 * FILTRO DE SUCESSO V8
 * Prioriza availableMarginValue > 0 sobre mensagens de erro
 */
const hasValoresFinanceirosV8 = (lead: LeadData): boolean => {
  const simulacao = lead.retorno_simulacao as any;
  const proposta = lead.retorno_proposta as any;
  const getProposta = lead.retorno_get_proposta as any;
  
  // Verificar availableMarginValue em simulacao.details
  if (simulacao?.details?.availableMarginValue) {
    const valor = parseValorNumerico(simulacao.details.availableMarginValue);
    if (valor > 0) return true;
  }
  
  // Verificar status success na proposta
  if (proposta?.status?.toLowerCase() === "success") return true;
  if (proposta?.status?.toLowerCase() === "aprovada") return true;
  
  // Verificar formalizationLink (indica aprovação)
  if (proposta?.formalizationLink) return true;
  
  // Verificar get_proposta
  if (getProposta?.status?.toLowerCase() === "success") return true;
  if (getProposta?.status?.toLowerCase() === "formalization") return true;
  
  return false;
};

/**
 * FILTRO DE SUCESSO UY3
 * Prioriza valorMargemDisponivel > 0 em dataprevValidationResponses
 * ou valor_parcela/valor_financiado/prazo na simulação
 */
const hasValoresFinanceirosUY3 = (lead: LeadData): boolean => {
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
  // Buscar valorMargemDisponivel em dataprevValidationResponses (estrutura aninhada)
  if (margem?.details?.dataprevValidationResponses) {
    const responses = margem.details.dataprevValidationResponses;
    if (Array.isArray(responses)) {
      for (const response of responses) {
        const emp = response?.employeeRelationShip;
        if (emp?.valorMargemDisponivel) {
          const valor = parseValorNumerico(emp.valorMargemDisponivel);
          if (valor > 0) return true;
        }
      }
    }
  }
  
  // Verificar valorMargemDisponivel direto na margem
  if (margem?.valorMargemDisponivel) {
    const valor = parseValorNumerico(margem.valorMargemDisponivel);
    if (valor > 0) return true;
  }
  
  // Verificar simulação - valor_parcela, valor_financiado, prazo
  if (simulacao) {
    const valorParcela = parseValorNumerico(simulacao.valor_parcela);
    const valorFinanciado = parseValorNumerico(simulacao.valor_financiado);
    const prazo = parseValorNumerico(simulacao.prazo);
    
    if (valorParcela > 0 || valorFinanciado > 0 || prazo > 0) return true;
    
    // Também verificar em details
    if (simulacao.details) {
      const liquidValue = parseValorNumerico(simulacao.details.liquidValue);
      const installmentValue = parseValorNumerico(simulacao.details.installmentValue);
      const availableMargin = parseValorNumerico(simulacao.details.availableMarginValue);
      
      if (liquidValue > 0 || installmentValue > 0 || availableMargin > 0) return true;
    }
  }
  
  return false;
};

/**
 * FILTRO DE SUCESSO PRESENÇA
 * Prioriza valorMargemDisponivel > 0
 */
const hasValoresFinanceirosPresenca = (lead: LeadData): boolean => {
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
  // Verificar valorMargemDisponivel na margem
  if (margem?.valorMargemDisponivel) {
    const valor = parseValorNumerico(margem.valorMargemDisponivel);
    if (valor > 0) return true;
  }
  
  // Verificar valores na simulação
  if (simulacao) {
    const liquidValue = parseValorNumerico(simulacao.liquidValue);
    if (liquidValue > 0) return true;
    
    if (simulacao.details) {
      const availableMargin = parseValorNumerico(simulacao.details.availableMarginValue);
      if (availableMargin > 0) return true;
    }
  }
  
  return false;
};

/**
 * FILTRO DE SUCESSO UNIVERSAL
 * Verifica se o lead possui valores financeiros positivos
 * independente do banco
 */
const hasValoresFinanceiros = (lead: LeadData): boolean => {
  const banco = (lead.banco || "").toLowerCase();
  
  // Aplicar filtro específico por banco
  if (banco.includes("v8")) {
    return hasValoresFinanceirosV8(lead);
  }
  
  if (banco.includes("uy3")) {
    return hasValoresFinanceirosUY3(lead);
  }
  
  if (banco.includes("presença") || banco.includes("presenca")) {
    return hasValoresFinanceirosPresenca(lead);
  }
  
  // Para outros bancos, verificar todos os padrões
  return hasValoresFinanceirosV8(lead) || 
         hasValoresFinanceirosUY3(lead) || 
         hasValoresFinanceirosPresenca(lead);
};

/**
 * Verifica se o lead está pendente por erro de limite/conexão
 * EXCETO se possui valores financeiros positivos
 */
const isPendente = (lead: LeadData): boolean => {
  const autorizacao = lead.retorno_autorizacao as any;
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
  // SE TEM VALORES FINANCEIROS, NÃO É PENDENTE
  if (hasValoresFinanceiros(lead)) {
    return false;
  }
  
  // Verificar limite de consultas excedido no retorno_autorizacao
  if (isLimiteConsultasExcedido(autorizacao)) {
    return true;
  }
  
  // Verificar erro de rate limit em qualquer retorno
  const erros = [
    margem?.error,
    simulacao?.error,
    autorizacao?.error
  ].filter(Boolean);
  
  for (const erro of erros) {
    const lower = String(erro).toLowerCase();
    if (lower.includes("rate limit") || 
        (lower.includes("limite") && lower.includes("excedido"))) {
      return true;
    }
  }
  
  return false;
};

/**
 * Normaliza o status do lead considerando as diferenças entre bancos
 * NOVA LÓGICA: Prioriza valores financeiros sobre mensagens de erro
 */
export const normalizarStatusLead = (lead: LeadData): StatusNormalizado => {
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const proposta = lead.retorno_proposta as any;
  const getProposta = lead.retorno_get_proposta as any;
  
  // =====================================================
  // FILTRO DE SUCESSO - PRIORIDADE MÁXIMA
  // Se tem valores financeiros positivos = APROVADO
  // Ignora mensagens de erro/warning
  // =====================================================
  if (hasValoresFinanceiros(lead)) {
    return "aprovado";
  }
  
  // ==============================
  // VERIFICAR PENDENTE
  // ==============================
  if (isPendente(lead)) {
    return "pendente";
  }
  
  // ==============================
  // V8: Verificar retorno_proposta
  // ==============================
  if (proposta) {
    // Se tem status = success = APROVADO
    if (proposta.status?.toLowerCase() === "success") {
      return "aprovado";
    }
    if (proposta.status?.toLowerCase() === "aprovada") {
      return "aprovado";
    }
  }
  
  // Verificar retorno_get_proposta
  if (getProposta) {
    const getPropostaStatus = String(getProposta.status || "").toLowerCase();
    if (getPropostaStatus === "success" || getPropostaStatus === "formalization") {
      return "aprovado";
    }
  }
  
  // =====================================
  // GENÉRICO: Verificar retorno_simulacao
  // =====================================
  if (simulacao) {
    // Verificar status explícito no details
    const detailsStatus = typeof simulacao.details?.status === "string"
      ? simulacao.details.status.toUpperCase()
      : String(simulacao.details?.status || "").toUpperCase();
    
    if (detailsStatus === "APPROVED" || detailsStatus === "SUCCESS") {
      return "aprovado";
    }
  }
  
  // =====================================
  // Verificar erro de conexão = PENDENTE
  // =====================================
  const erros = [
    margem?.error,
    simulacao?.error,
    proposta?.error
  ].filter(Boolean);
  
  for (const erro of erros) {
    if (isErroConexao(String(erro))) {
      return "pendente";
    }
  }
  
  // =====================================
  // SEM VALORES FINANCEIROS E SEM ERROS DE CONEXÃO = REPROVADO
  // =====================================
  return "reprovado";
};

/**
 * Função legada para compatibilidade - chama normalizarStatusLead
 * NOTA: Agora prioriza análise de valores financeiros sobre status de texto
 */
export const normalizarStatus = (status: string | null, lead?: LeadData): StatusNormalizado => {
  // Se tem lead, usar lógica por banco (prioriza valores financeiros)
  if (lead) {
    return normalizarStatusLead(lead);
  }
  
  // Status explícitos respeitados apenas se não tem dados do lead
  const s = (status || "").toLowerCase().trim();
  if (s === "aprovado" || s === "approved") return "aprovado";
  if (s === "reprovado" || s === "rejected" || s === "recusado") return "reprovado";
  if (s === "pendente" || s === "pending") return "pendente";
  // CPF não encontrado = REPROVADO
  if (s === "cpf não encontrado" || s === "cpf_nao_encontrado" || s === "nao encontrado") return "reprovado";
  
  return "reprovado";
};
