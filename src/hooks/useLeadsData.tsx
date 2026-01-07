import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export const useLeadsData = (filters?: FilterState) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
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

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setLeads(data || []);
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
      };
    }

    const totalLeads = leads.length;
    const leadsAprovados = leads.filter(l => l.status?.toLowerCase() === "aprovado").length;
    const leadsReprovados = leads.filter(l => l.status?.toLowerCase() === "reprovado").length;
    const leadsPendentes = leads.filter(l => !l.status || l.status?.toLowerCase() === "pendente").length;
    
    const taxaReprovacao = totalLeads > 0 ? Math.round((leadsReprovados / totalLeads) * 100) : 0;
    const taxaAprovacao = totalLeads > 0 ? Math.round((leadsAprovados / totalLeads) * 100) : 0;
    
    const valorTotal = leads.reduce((acc, l) => acc + (l.valor || 0), 0);

    // Count by tipo_reprovacao
    const tipoReprovacaoCount: Record<string, number> = {};
    leads.forEach(l => {
      if (l.tipo_reprovacao) {
        tipoReprovacaoCount[l.tipo_reprovacao] = (tipoReprovacaoCount[l.tipo_reprovacao] || 0) + 1;
      }
    });

    const tiposReprovacao = Object.entries(tipoReprovacaoCount)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const principalMotivo = tiposReprovacao[0]?.tipo || "-";
    const principalMotivoPercentual = tiposReprovacao[0] 
      ? Math.round((tiposReprovacao[0].quantidade / leadsReprovados) * 100) 
      : 0;

    // Count by banco
    const bancoStats: Record<string, { aprovados: number; reprovados: number; total: number }> = {};
    leads.forEach(l => {
      const banco = l.banco || "Não informado";
      if (!bancoStats[banco]) {
        bancoStats[banco] = { aprovados: 0, reprovados: 0, total: 0 };
      }
      bancoStats[banco].total++;
      if (l.status?.toLowerCase() === "aprovado") {
        bancoStats[banco].aprovados++;
      } else if (l.status?.toLowerCase() === "reprovado") {
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

    // Count by CBO
    const cboCount: Record<string, number> = {};
    leads.filter(l => l.status?.toLowerCase() === "reprovado").forEach(l => {
      if (l.cbo) {
        cboCount[l.cbo] = (cboCount[l.cbo] || 0) + 1;
      }
    });

    const reprovacoesPorCBO = Object.entries(cboCount)
      .map(([cbo, quantidade]) => ({ cbo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // Count by status
    const statusCount: Record<string, number> = {};
    leads.forEach(l => {
      const status = l.status || "Pendente";
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const leadsPorStatus = Object.entries(statusCount)
      .map(([status, quantidade]) => ({ status, quantidade }));

    // Unique counts
    const cbosUnicos = new Set(leads.filter(l => l.status?.toLowerCase() === "reprovado" && l.cbo).map(l => l.cbo)).size;
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
    };
  }, [leads]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const bancos = [...new Set(leads.map(l => l.banco).filter(Boolean))] as string[];
    const tiposReprovacao = [...new Set(leads.map(l => l.tipo_reprovacao).filter(Boolean))] as string[];
    const statuses = [...new Set(leads.map(l => l.status).filter(Boolean))] as string[];
    const cbos = [...new Set(leads.map(l => l.cbo).filter(Boolean))] as string[];

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
