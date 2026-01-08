/**
 * Utilitário centralizado para normalizar status de leads
 * 
 * REGRAS POR BANCO (V8, PRESENÇA, UY3):
 * 
 * PENDENTE (prioridade máxima):
 * - retorno_autorizacao.errors contém "Limite de consultas excedido"
 * - Erros de timeout/rate limit que impedem processamento
 * 
 * V8:
 * - APROVADO: retorno_proposta.status = "success" (com formalizationLink)
 * - REPROVADO: retorno_proposta.error presente
 * - CPF_NAO_ENCONTRADO: sem retornos
 * 
 * PRESENÇA:
 * - APROVADO: retorno_margem.valorMargemDisponivel > 0 (sem error)
 * - REPROVADO: retorno_margem.error presente (ex: "Margem indisponível")
 * - CPF_NAO_ENCONTRADO: sem retornos
 * 
 * UY3:
 * - Segue mesma lógica dos demais bancos
 */

export type StatusNormalizado = "aprovado" | "reprovado" | "cpf_nao_encontrado" | "pendente";

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

/**
 * Verifica se o lead está pendente por erro de limite/conexão
 */
const isPendente = (lead: LeadData): boolean => {
  const autorizacao = lead.retorno_autorizacao as any;
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  
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
 */
export const normalizarStatusLead = (lead: LeadData): StatusNormalizado => {
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const proposta = lead.retorno_proposta as any;
  const getProposta = lead.retorno_get_proposta as any;
  const banco = (lead.banco || "").toLowerCase();
  
  // ==============================
  // VERIFICAR PENDENTE PRIMEIRO
  // ==============================
  if (isPendente(lead)) {
    return "pendente";
  }
  
  // ==============================
  // V8: Verificar retorno_proposta
  // ==============================
  if (banco.includes("v8") || proposta) {
    // Se tem retorno_proposta
    if (proposta) {
      // Se tem error = REPROVADO
      if (proposta.error) {
        return "reprovado";
      }
      // Se tem status = success = APROVADO
      if (proposta.status?.toLowerCase() === "success") {
        return "aprovado";
      }
    }
    
    // Verificar retorno_get_proposta também (dados complementares)
    if (getProposta) {
      if (getProposta.error) {
        return "reprovado";
      }
      const getPropostaStatus = String(getProposta.status || "").toLowerCase();
      if (getPropostaStatus === "success" || getPropostaStatus === "formalization") {
        return "aprovado";
      }
    }
  }
  
  // =====================================
  // PRESENÇA / UY3: Verificar retorno_margem
  // =====================================
  if (banco.includes("presença") || banco.includes("presenca") || banco.includes("uy3") || margem) {
    if (margem) {
      // Se tem erro na margem
      if (margem.error) {
        const erro = String(margem.error);
        if (isErroConexao(erro)) {
          return "pendente";
        }
        return "reprovado";
      }
      
      // Se tem margem disponível > 0 = APROVADO
      const valorMargem = Number(margem.valorMargemDisponivel || 0);
      if (valorMargem > 0) {
        return "aprovado";
      }
      
      // Se tem margem mas valor é 0 ou negativo = REPROVADO
      if (margem.valorMargemDisponivel !== undefined) {
        return "reprovado";
      }
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
    
    if (detailsStatus === "REJECTED" || detailsStatus === "FAILED") {
      const error = String(simulacao.details?.error || simulacao.details?.description || "");
      if (error.includes("não encontrado") || error.includes("inelegível") || error.includes("não elegível")) {
        return "cpf_nao_encontrado";
      }
      return "reprovado";
    }
    
    // Verificar erro na simulação
    if (simulacao.error) {
      if (isErroConexao(simulacao.error)) {
        return "pendente";
      }
      return "reprovado";
    }
    
    // Verificar availableMarginValue (V8 no retorno_simulacao)
    const availableMargin = simulacao.details?.availableMarginValue;
    if (availableMargin !== undefined && availableMargin !== null && parseFloat(availableMargin) > 0) {
      return "aprovado";
    }
  }
  
  // =====================================
  // SEM RETORNOS = CPF NÃO ENCONTRADO
  // =====================================
  if (!margem && !simulacao && !proposta && !getProposta) {
    return "cpf_nao_encontrado";
  }
  
  // =====================================
  // FALLBACK: Se tem retorno mas não identificou = REPROVADO
  // =====================================
  return "reprovado";
};

/**
 * Função legada para compatibilidade - chama normalizarStatusLead
 */
export const normalizarStatus = (status: string | null, lead?: LeadData): StatusNormalizado => {
  // Status explícitos sempre respeitados primeiro
  const s = (status || "").toLowerCase().trim();
  if (s === "aprovado" || s === "approved") return "aprovado";
  if (s === "reprovado" || s === "rejected" || s === "recusado") return "reprovado";
  if (s === "pendente" || s === "pending") return "pendente";
  if (s === "cpf não encontrado" || s === "cpf_nao_encontrado" || s === "nao encontrado") return "cpf_nao_encontrado";
  
  // Se tem lead, usar lógica por banco
  if (lead) {
    return normalizarStatusLead(lead);
  }
  
  return "cpf_nao_encontrado";
};
