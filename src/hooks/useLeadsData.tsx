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

// Helper para extrair nome do lead
const extrairNome = (lead: Lead): string => {
  if (lead.nome) return lead.nome;

  const margem = lead.retorno_margem as any;
  const registro = margem?.registroEmpregaticio;

  // Em alguns retornos, registroEmpregaticio pode vir como string (ex: "FJC.0086")
  if (registro && typeof registro === "object" && registro.nomeEmpregado) {
    return registro.nomeEmpregado;
  }

  if (margem?.nomeEmpregado) return margem.nomeEmpregado;
  return "";
};

// Helper para extrair CBO
const extrairCBO = (lead: Lead): string => {
  if (lead.cbo) return lead.cbo;
  // CBO pode vir de outros campos no futuro
  return "";
};

// Helper para extrair banco - busca em todas as fontes disponíveis
const extrairBanco = (lead: Lead): string => {
  // 1. Primeiro verifica campo direto
  if (lead.banco && lead.banco.trim()) return lead.banco.trim();

  const simulacao = lead.retorno_simulacao as any;
  const autorizacao = lead.retorno_autorizacao as any;
  const proposta = lead.retorno_proposta as any;
  const getProposta = lead.retorno_get_proposta as any;
  
  // 2. Concatenar todos os campos possíveis para buscar padrões
  const haystack = [
    simulacao?.productName,
    simulacao?.productId,
    autorizacao?.shortUrl,
    proposta?.banco,
    proposta?.instituicao,
    getProposta?.banco,
    getProposta?.instituicao,
    // Adicionar campos personalizados se existirem
    simulacao?.banco,
    autorizacao?.banco,
  ].filter(Boolean).join(" ").toLowerCase();

  // 3. Identificar banco por padrões conhecidos
  if (haystack.includes("presen") || haystack.includes("privado")) return "Presença";
  if (haystack.includes("uy3")) return "UY3";
  if (haystack.includes("v8")) return "V8";
  if (haystack.includes("safra")) return "Safra";
  if (haystack.includes("itau") || haystack.includes("itaú")) return "Itaú";
  if (haystack.includes("santander")) return "Santander";
  if (haystack.includes("bradesco")) return "Bradesco";
  if (haystack.includes("caixa")) return "Caixa";
  if (haystack.includes("bb") || haystack.includes("brasil")) return "Banco do Brasil";

  // 4. Se productName existe mas não encontrou padrão, usar o próprio productName
  if (simulacao?.productName) {
    return simulacao.productName;
  }

  return "";
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
    
    // Se não tem retorno de margem = CPF não encontrado na base
    if (!margem || margem === null) {
      return "cpf_nao_encontrado";
    }
    
    // Se tem erro de timeout ou rate limit = CPF não encontrado (não conseguiu verificar)
    const erro = margem?.error || "";
    if (erro.includes("timeout") || erro.includes("cURL error") || erro.includes("Rate limit")) {
      return "cpf_nao_encontrado";
    }
    
    // Se tem margem disponível > 0 = aprovado
    const valorMargem = margem?.valorMargemDisponivel;
    if (valorMargem !== undefined && valorMargem !== null && valorMargem > 0) {
      return "aprovado";
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
    // Calcular Margem Média dos leads aprovados
    const leadsAprovadosComMargem = leadsComStatusNormalizado.filter(l => {
      const margem = l.retorno_margem?.valorMargemDisponivel || 0;
      return l.statusNormalizado === "aprovado" && margem > 0;
    });
    const somaMargemAprovados = leadsAprovadosComMargem.reduce((acc, l) => {
      const margem = l.retorno_margem?.valorMargemDisponivel || 0;
      return acc + margem;
    }, 0);
    const margemMedia = leadsAprovadosComMargem.length > 0 
      ? somaMargemAprovados / leadsAprovadosComMargem.length 
      : 0;
    const valorSimulacaoTotal = leads.reduce((acc, l) => {
      const simulacao = l.retorno_simulacao?.requestedAmount || l.retorno_simulacao?.liquidValue || 0;
      return acc + simulacao;
    }, 0);

    // Count by motivo de reprovação - extrair do JSON retorno_margem.error
    const motivoReprovacaoCount: Record<string, number> = {};
    leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").forEach(l => {
      const margem = l.retorno_margem as any;
      let motivo = margem?.error || l.tipo_reprovacao || "";
      
      // Normaliza os motivos para agrupamento
      if (motivo.includes("timeout") || motivo.includes("cURL error")) {
        motivo = "Timeout na consulta";
      } else if (motivo.includes("Rate limit")) {
        motivo = "Limite de requisições";
      } else if (motivo.includes("Margem indisponível") || motivo === "") {
        // Verifica se tem margem negativa ou zero
        const valorMargem = margem?.valorMargemDisponivel || margem?.valorMargem || 0;
        if (valorMargem < 0) {
          motivo = "Margem negativa";
        } else {
          motivo = "Margem indisponível";
        }
      }
      
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
    const tiposReprovacaoUnicos = new Set(leads.filter(l => l.tipo_reprovacao).map(l => l.tipo_reprovacao)).size;

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
