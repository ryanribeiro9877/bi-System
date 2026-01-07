import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { 
  LeadCompleto, 
  RetornoAutorizacao, 
  RetornoMargem, 
  RetornoSimulacao, 
  RetornoProposta, 
  RetornoGetProposta,
  parseJsonSafe 
} from "@/types/lead";

export interface Lead {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  cbo: string | null;
  status: string | null;
  tipo_reprovacao: string | null;
  valor: number | null;
  data_envio: string | null;
  data_retorno: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Campos JSONB
  retorno_autorizacao: RetornoAutorizacao | null;
  retorno_margem: RetornoMargem | null;
  retorno_simulacao: RetornoSimulacao | null;
  retorno_proposta: RetornoProposta | null;
  retorno_get_proposta: RetornoGetProposta | null;
  ultimo_log: string | null;
}

export interface FilterState {
  dataInicial: Date | undefined;
  dataFinal: Date | undefined;
  banco: string;
  tipoReprovacao: string;
  status: string;
  cpf: string;
}

export interface DashboardStats {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaReprovacao: number;
  taxaAprovacao: number;
  valorTotal: number;
  principalMotivo: string;
  principalMotivoPercentual: number;
  bancoMaiorReprovacao: string;
  bancoMaiorReprovacaoPercentual: number;
  cbosUnicos: number;
  tiposReprovacaoUnicos: number;
  reprovacoesPorBanco: { banco: string; aprovados: number; reprovados: number; total: number; taxaReprovacao: number }[];
  reprovacoesPorCBO: { cbo: string; quantidade: number }[];
  reprovacoesPorTipo: { tipo: string; quantidade: number }[];
  leadsPorStatus: { status: string; quantidade: number }[];
  // Novos campos extraídos
  margemMedia: number;
  valorSimulacaoTotal: number;
}

// Helper para extrair nome do lead - busca em TODAS as colunas
const extrairNome = (lead: Lead): string => {
  if (lead.nome) return lead.nome;

  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const getProposta = lead.retorno_get_proposta as any;
  const proposta = lead.retorno_proposta as any;
  const autorizacao = lead.retorno_autorizacao as any;

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
  
  return fontes.find(v => v && typeof v === 'string' && v.trim().length > 0) || "";
};

// Helper para extrair CBO - busca em TODAS as colunas
const extrairCBO = (lead: Lead): string => {
  if (lead.cbo) return lead.cbo;
  
  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const getProposta = lead.retorno_get_proposta as any;
  const proposta = lead.retorno_proposta as any;
  const autorizacao = lead.retorno_autorizacao as any;

  const fontes = [
    // retorno_margem
    margem?.registroEmpregaticio?.cbo,
    margem?.cbo,
    // retorno_simulacao
    simulacao?.details?.cbo,
    simulacao?.cbo,
    // retorno_get_proposta
    getProposta?.cbo,
    getProposta?.occupation,
    // retorno_proposta
    proposta?.cbo,
    // retorno_autorizacao
    autorizacao?.cbo,
  ];
  
  const found = fontes.find(v => v && String(v).trim().length > 0);
  return found ? String(found) : "";
};

// Helper para extrair banco - agora usa o campo banco que vem do nome do arquivo importado
const extrairBanco = (lead: Lead): string => {
  // O banco é definido pelo nome do arquivo na importação
  // Se não tiver, retorna "Não Informado"
  if (lead.banco && lead.banco.trim()) return lead.banco.trim();
  return "Não Informado";
};

// Helper para normalizar status - apenas 3 opções: aprovado, reprovado, cpf_nao_encontrado
const normalizarStatus = (status: string | null, lead?: Lead): string => {
  const s = (status || "").toLowerCase().trim();
  
  // Status explícitos sempre respeitados
  if (s === "aprovado" || s === "approved") return "aprovado";
  if (s === "reprovado" || s === "rejected" || s === "recusado") return "reprovado";
  if (s === "cpf não encontrado" || s === "cpf_nao_encontrado" || s === "nao encontrado") return "cpf_nao_encontrado";
  
  // Para outros status, verificar dados do lead
  if (lead) {
    const margem = lead.retorno_margem as any;
    const simulacao = lead.retorno_simulacao as any;
    
    // Verificar status explícito no retorno_simulacao.details (novo formato)
    const detailsStatus = typeof simulacao?.details?.status === 'string' 
      ? simulacao.details.status.toUpperCase() 
      : String(simulacao?.details?.status || "").toUpperCase();
    
    if (detailsStatus === "APPROVED" || detailsStatus === "SUCCESS") return "aprovado";
    if (detailsStatus === "REJECTED" || detailsStatus === "FAILED") {
      // Verificar se é CPF não encontrado ou reprovado por margem
      const error = String(simulacao?.details?.error || simulacao?.details?.description || "");
      if (error.includes("não encontrado") || error.includes("inelegível") || error.includes("não elegível")) {
        return "cpf_nao_encontrado";
      }
      return "reprovado";
    }
    
    // Se tem margem disponível > 0 = aprovado (retorno_margem)
    const valorMargem = margem?.valorMargemDisponivel;
    if (valorMargem !== undefined && valorMargem !== null && valorMargem > 0) {
      return "aprovado";
    }
    
    // Se tem availableMarginValue > 0 = aprovado (retorno_simulacao.details)
    const availableMargin = simulacao?.details?.availableMarginValue;
    if (availableMargin !== undefined && availableMargin !== null && parseFloat(availableMargin) > 0) {
      return "aprovado";
    }
    
    // Se não tem margem e não tem details = CPF não encontrado
    if (!margem && !simulacao?.details) {
      return "cpf_nao_encontrado";
    }
    
    // Se tem erro de timeout ou rate limit = CPF não encontrado (não conseguiu verificar)
    const erro = margem?.error || simulacao?.error || "";
    if (erro.includes("timeout") || erro.includes("cURL error") || erro.includes("Rate limit")) {
      return "cpf_nao_encontrado";
    }
    
    // Se tem retorno mas margem <= 0 ou erro de margem indisponível = reprovado
    return "reprovado";
  }
  
  return "cpf_nao_encontrado";
};

export const useLeadsData = (filters?: FilterState) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pageSize = 1000;
      let from = 0;
      let allRows: any[] = [];

      const buildBaseQuery = () => {
        let query = supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        // Apply filters
        if (filters?.dataInicial) {
          query = query.gte("created_at", filters.dataInicial.toISOString());
        }
        if (filters?.dataFinal) {
          query = query.lte("created_at", filters.dataFinal.toISOString());
        }
        if (filters?.banco) {
          query = query.eq("banco", filters.banco);
        }
        if (filters?.tipoReprovacao) {
          query = query.eq("tipo_reprovacao", filters.tipoReprovacao);
        }
        if (filters?.status) {
          query = query.eq("status", filters.status);
        }
        if (filters?.cpf) {
          query = query.ilike("cpf", `%${filters.cpf}%`);
        }

        return query;
      };

      // PostgREST tem limite padrão de 1000 linhas por request.
      // Aqui buscamos em páginas para montar estatísticas corretas.
      while (true) {
        const { data, error: fetchError } = await buildBaseQuery().range(from, from + pageSize - 1);

        if (fetchError) throw fetchError;

        const batch = data || [];
        allRows = allRows.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      // Parse JSONB fields
      const parsedLeads: Lead[] = allRows.map((row: any) => ({
        ...row,
        retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(row.retorno_autorizacao),
        retorno_margem: parseJsonSafe<RetornoMargem>(row.retorno_margem),
        retorno_simulacao: parseJsonSafe<RetornoSimulacao>(row.retorno_simulacao),
        retorno_proposta: parseJsonSafe<RetornoProposta>(row.retorno_proposta),
        retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(row.retorno_get_proposta),
      }));

      setLeads(parsedLeads);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err.message || "Erro ao buscar leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filters?.dataInicial, filters?.dataFinal, filters?.banco, filters?.tipoReprovacao, filters?.status, filters?.cpf]);

  // Sincronização global: refetch quando houver nova importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsData] Recebido evento de importação, atualizando dados...');
      fetchLeads();
    });
    
    return unsubscribe;
  }, []);

  const stats = useMemo<DashboardStats>(() => {
    if (leads.length === 0) {
      return {
        totalLeads: 0,
        leadsAprovados: 0,
        leadsReprovados: 0,
        leadsPendentes: 0,
        taxaReprovacao: 0,
        taxaAprovacao: 0,
        valorTotal: 0,
        principalMotivo: "-",
        principalMotivoPercentual: 0,
        bancoMaiorReprovacao: "-",
        bancoMaiorReprovacaoPercentual: 0,
        cbosUnicos: 0,
        tiposReprovacaoUnicos: 0,
        reprovacoesPorBanco: [],
        reprovacoesPorCBO: [],
        reprovacoesPorTipo: [],
        leadsPorStatus: [],
        margemMedia: 0,
        valorSimulacaoTotal: 0,
      };
    }

    const totalLeads = leads.length;
    
    // Normalizar status para contagem
    const leadsComStatusNormalizado = leads.map(l => ({
      ...l,
      statusNormalizado: normalizarStatus(l.status, l)
    }));
    
    const leadsAprovados = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "aprovado").length;
    const leadsReprovados = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").length;
    const leadsPendentes = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "cpf_nao_encontrado").length;
    
    const taxaReprovacao = totalLeads > 0 ? parseFloat(((leadsReprovados / totalLeads) * 100).toFixed(2)) : 0;
    const taxaAprovacao = totalLeads > 0 ? parseFloat(((leadsAprovados / totalLeads) * 100).toFixed(2)) : 0;
    
    // Calcular valores
    const valorTotal = leads.reduce((acc, l) => acc + (l.valor || 0), 0);
    
    // Função auxiliar para extrair margem disponível (suporta múltiplos formatos)
    const extrairMargemDisponivel = (l: Lead): number => {
      const margem = l.retorno_margem as any;
      const simulacao = l.retorno_simulacao as any;
      
      // Tenta do retorno_margem primeiro
      if (margem?.valorMargemDisponivel !== undefined && margem?.valorMargemDisponivel !== null) {
        return parseFloat(margem.valorMargemDisponivel) || 0;
      }
      // Tenta do retorno_simulacao.details (novo formato)
      if (simulacao?.details?.availableMarginValue !== undefined && simulacao?.details?.availableMarginValue !== null) {
        return parseFloat(simulacao.details.availableMarginValue) || 0;
      }
      return 0;
    };
    
    // Calcular Margem Média dos leads aprovados
    const leadsAprovadosComMargem = leadsComStatusNormalizado.filter(l => {
      const margem = extrairMargemDisponivel(l);
      return l.statusNormalizado === "aprovado" && margem > 0;
    });
    const somaMargemAprovados = leadsAprovadosComMargem.reduce((acc, l) => {
      return acc + extrairMargemDisponivel(l);
    }, 0);
    const margemMedia = leadsAprovadosComMargem.length > 0 
      ? somaMargemAprovados / leadsAprovadosComMargem.length 
      : 0;
    const valorSimulacaoTotal = leads.reduce((acc, l) => {
      const simulacao = l.retorno_simulacao as any;
      const valor = simulacao?.requestedAmount || simulacao?.liquidValue || simulacao?.details?.availableMarginValue || 0;
      return acc + (parseFloat(valor) || 0);
    }, 0);

    // Função para resumir motivos de reprovação
    const resumirMotivo = (motivo: string): string => {
      if (!motivo || motivo === "-") return "Não informado";
      
      const motivoLower = motivo.toLowerCase();
      
      // Mapeamento de padrões para resumos
      if (motivoLower.includes("timeout") || motivoLower.includes("curl error") || motivoLower.includes("timed out")) {
        return "Timeout";
      }
      if (motivoLower.includes("rate limit")) {
        return "Limite de requisições";
      }
      if (motivoLower.includes("margem negativa") || motivoLower.includes("negative margin")) {
        return "Margem negativa";
      }
      if (motivoLower.includes("margem indispon") || motivoLower.includes("sem margem") || motivoLower.includes("unavailable margin")) {
        return "Margem indisponível";
      }
      if (motivoLower.includes("cbo") || motivoLower.includes("ocupação") || motivoLower.includes("occupation")) {
        return "CBO bloqueado";
      }
      if (motivoLower.includes("cpf") && (motivoLower.includes("não encontrado") || motivoLower.includes("not found"))) {
        return "CPF não encontrado";
      }
      if (motivoLower.includes("idade") || motivoLower.includes("age")) {
        return "Idade incompatível";
      }
      if (motivoLower.includes("renda") || motivoLower.includes("income") || motivoLower.includes("salário")) {
        return "Renda insuficiente";
      }
      if (motivoLower.includes("inadimplente") || motivoLower.includes("negativado") || motivoLower.includes("restrição")) {
        return "Restrição cadastral";
      }
      if (motivoLower.includes("empréstimo") || motivoLower.includes("loan") || motivoLower.includes("contrato")) {
        return "Empréstimo ativo";
      }
      if (motivoLower.includes("servidor") || motivoLower.includes("server error") || motivoLower.includes("500")) {
        return "Erro no servidor";
      }
      if (motivoLower.includes("não elegível") || motivoLower.includes("not eligible") || motivoLower.includes("inelegível")) {
        return "Não elegível";
      }
      if (motivoLower.includes("documento") || motivoLower.includes("document")) {
        return "Documento inválido";
      }
      
      // Se o motivo for muito longo, trunca
      if (motivo.length > 25) {
        return motivo.substring(0, 22) + "...";
      }
      
      return motivo;
    };

    // Count by motivo de reprovação - extrair do JSON retorno_margem.error ou retorno_simulacao.details.error
    const motivoReprovacaoCount: Record<string, number> = {};
    leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").forEach(l => {
      const margem = l.retorno_margem as any;
      const simulacao = l.retorno_simulacao as any;
      let motivoOriginal = simulacao?.details?.error || simulacao?.error || margem?.error || l.tipo_reprovacao || "";
      
      // Verifica se tem margem negativa ou zero quando não tem motivo
      if (!motivoOriginal || motivoOriginal === "Margem indisponível" || motivoOriginal.includes("sem margem")) {
        const valorMargem = margem?.valorMargemDisponivel || simulacao?.details?.availableMarginValue || 0;
        if (parseFloat(valorMargem) < 0) {
          motivoOriginal = "Margem negativa";
        } else {
          motivoOriginal = "Margem indisponível";
        }
      }
      
      // Aplica o resumo do motivo
      const motivo = resumirMotivo(motivoOriginal);
      
      if (motivo) {
        motivoReprovacaoCount[motivo] = (motivoReprovacaoCount[motivo] || 0) + 1;
      }
    });

    const tiposReprovacao = Object.entries(motivoReprovacaoCount)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const principalMotivo = tiposReprovacao[0]?.tipo || "-";
    const principalMotivoPercentual = tiposReprovacao[0] && leadsReprovados > 0
      ? Math.round((tiposReprovacao[0].quantidade / leadsReprovados) * 100) 
      : 0;

    // Count by banco - extrair de várias fontes
    const bancoStats: Record<string, { aprovados: number; reprovados: number; total: number }> = {};
    leadsComStatusNormalizado.forEach(l => {
      const banco = extrairBanco(l) || "Não informado";
      if (!bancoStats[banco]) {
        bancoStats[banco] = { aprovados: 0, reprovados: 0, total: 0 };
      }
      bancoStats[banco].total++;
      if (l.statusNormalizado === "aprovado") {
        bancoStats[banco].aprovados++;
      } else if (l.statusNormalizado === "reprovado") {
        bancoStats[banco].reprovados++;
      }
    });

    const reprovacoesPorBanco = Object.entries(bancoStats)
      .map(([banco, stats]) => ({
        banco,
        ...stats,
        taxaReprovacao: stats.total > 0 ? Math.round((stats.reprovados / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.taxaReprovacao - a.taxaReprovacao);

    const bancoMaiorReprovacao = reprovacoesPorBanco[0]?.banco || "-";
    const bancoMaiorReprovacaoPercentual = reprovacoesPorBanco[0]?.taxaReprovacao || 0;

    // Count by CBO - extrair de várias fontes
    const cboCount: Record<string, number> = {};
    leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").forEach(l => {
      const cbo = extrairCBO(l);
      if (cbo) {
        cboCount[cbo] = (cboCount[cbo] || 0) + 1;
      }
    });

    const reprovacoesPorCBO = Object.entries(cboCount)
      .map(([cbo, quantidade]) => ({ cbo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // Count by status (normalizado) - apenas 3 opções
    const statusCount: Record<string, number> = {};
    leadsComStatusNormalizado.forEach(l => {
      const status = l.statusNormalizado;
      let statusLabel = "CPF Não Encontrado";
      if (status === "aprovado") statusLabel = "Aprovado";
      else if (status === "reprovado") statusLabel = "Reprovado";
      statusCount[statusLabel] = (statusCount[statusLabel] || 0) + 1;
    });

    const leadsPorStatus = Object.entries(statusCount)
      .map(([status, quantidade]) => ({ status, quantidade }));

    // Unique counts
    const cbosUnicos = new Set(
      leadsComStatusNormalizado
        .filter(l => l.statusNormalizado === "reprovado")
        .map(l => extrairCBO(l))
        .filter(Boolean)
    ).size;
    const tiposReprovacaoUnicos = tiposReprovacao.length;

    return {
      totalLeads,
      leadsAprovados,
      leadsReprovados,
      leadsPendentes,
      taxaReprovacao,
      taxaAprovacao,
      valorTotal,
      principalMotivo,
      principalMotivoPercentual,
      bancoMaiorReprovacao,
      bancoMaiorReprovacaoPercentual,
      cbosUnicos,
      tiposReprovacaoUnicos,
      reprovacoesPorBanco,
      reprovacoesPorCBO,
      reprovacoesPorTipo: tiposReprovacao,
      leadsPorStatus,
      margemMedia,
      valorSimulacaoTotal,
    };
  }, [leads]);

  // Get unique values for filters - extrair de várias fontes
  const filterOptions = useMemo(() => {
    const bancos = [...new Set(leads.map(l => extrairBanco(l)).filter(Boolean))] as string[];
    const tiposReprovacao = [...new Set(leads.map(l => l.tipo_reprovacao).filter(Boolean))] as string[];
    const statuses = [...new Set(leads.map(l => l.status).filter(Boolean))] as string[];
    const cbos = [...new Set(leads.map(l => extrairCBO(l)).filter(Boolean))] as string[];

    return { bancos, tiposReprovacao, statuses, cbos };
  }, [leads]);

  return {
    leads,
    stats,
    filterOptions,
    isLoading,
    error,
    refetch: fetchLeads,
  };
};
