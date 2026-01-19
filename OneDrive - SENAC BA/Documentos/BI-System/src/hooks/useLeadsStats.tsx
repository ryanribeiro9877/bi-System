import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

// Tipo para o retorno da função SQL get_dashboard_stats
interface DashboardStatsResponse {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaReprovacao: number;
  taxaAprovacao: number;
  valorTotal: number;
  reprovacoesPorBanco: { banco: string; aprovados: number; reprovados: number; pendentes: number; total: number; taxaReprovacao: number }[];
  reprovacoesPorTipo: { tipo: string; tipoCompleto: string; quantidade: number }[];
  leadsPorStatus: { status: string; quantidade: number }[];
  cbosBloqueados: { code: string; name: string | null; quantidade: number }[];
  totalCBOsBloqueados: number;
  margemMedia: number;
  valorSimulacaoTotal: number;
}

// Tipo para o retorno da função SQL get_filter_options
interface FilterOptionsResponse {
  bancos: string[];
  tiposReprovacao: string[];
  statuses: string[];
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
  principalMotivoCompleto: string;
  principalMotivoPercentual: number;
  bancoMaiorReprovacao: string;
  bancoMaiorReprovacaoPercentual: number;
  cbosUnicos: number;
  tiposReprovacaoUnicos: number;
  reprovacoesPorBanco: { banco: string; aprovados: number; reprovados: number; pendentes: number; total: number; taxaReprovacao: number }[];
  reprovacoesPorCBO: { cbo: string; quantidade: number }[];
  reprovacoesPorTipo: { tipo: string; tipoCompleto: string; quantidade: number }[];
  leadsPorStatus: { status: string; quantidade: number }[];
  cbosBloqueados: { code: string; name: string | null; quantidade: number }[];
  totalCBOsBloqueados: number;
  margemMedia: number;
  valorSimulacaoTotal: number;
}

export interface FilterState {
  dataInicial: Date | undefined;
  dataFinal: Date | undefined;
  banco: string;
  tipoReprovacao: string;
  tiposReprovacaoMultiplos: string[];
  status: string;
  cpf: string;
}

export interface FilterOptions {
  bancos: string[];
  tiposReprovacao: string[];
  statuses: string[];
}

const emptyStats: DashboardStats = {
  totalLeads: 0,
  leadsAprovados: 0,
  leadsReprovados: 0,
  leadsPendentes: 0,
  taxaReprovacao: 0,
  taxaAprovacao: 0,
  valorTotal: 0,
  principalMotivo: "-",
  principalMotivoCompleto: "-",
  principalMotivoPercentual: 0,
  bancoMaiorReprovacao: "-",
  bancoMaiorReprovacaoPercentual: 0,
  cbosUnicos: 0,
  tiposReprovacaoUnicos: 0,
  reprovacoesPorBanco: [],
  reprovacoesPorCBO: [],
  reprovacoesPorTipo: [],
  leadsPorStatus: [],
  cbosBloqueados: [],
  totalCBOsBloqueados: 0,
  margemMedia: 0,
  valorSimulacaoTotal: 0,
};

/**
 * Hook otimizado para buscar estatísticas do dashboard
 * Usa função SQL no banco para calcular agregações (muito mais rápido)
 */
export const useLeadsStats = (filters?: FilterState) => {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    bancos: [],
    tiposReprovacao: [],
    statuses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Chamar função SQL para estatísticas
      const { data, error: statsError } = await supabase.rpc('get_dashboard_stats', {
        p_data_inicial: filters?.dataInicial?.toISOString() || null,
        p_data_final: filters?.dataFinal?.toISOString() || null,
        p_banco: filters?.banco || null,
        p_status: filters?.status || null,
        p_tipo_reprovacao: filters?.tipoReprovacao || null,
        p_tipos_reprovacao_multiplos: filters?.tiposReprovacaoMultiplos?.length ? filters.tiposReprovacaoMultiplos : null,
      });

      if (statsError) throw statsError;

      console.log('[useLeadsStats] Raw data from RPC:', data);
      console.log('[useLeadsStats] Data type:', typeof data);
      console.log('[useLeadsStats] Is Array:', Array.isArray(data));
      console.log('[useLeadsStats] JSON stringify:', JSON.stringify(data));

      if (data) {
        // O Supabase RPC retorna o JSON diretamente como objeto
        // Mas pode vir como string se o tipo não estiver correto
        let statsData: DashboardStatsResponse;
        
        if (typeof data === 'string') {
          console.log('[useLeadsStats] Parsing string data');
          statsData = JSON.parse(data) as DashboardStatsResponse;
        } else if (typeof data === 'object' && data !== null) {
          // Verificar se é o objeto direto ou se está aninhado
          const dataObj = data as Record<string, unknown>;
          if ('totalLeads' in dataObj) {
            console.log('[useLeadsStats] Data has totalLeads directly');
            statsData = dataObj as unknown as DashboardStatsResponse;
          } else if (Array.isArray(data) && data.length > 0) {
            console.log('[useLeadsStats] Data is array, using first element');
            statsData = data[0] as unknown as DashboardStatsResponse;
          } else {
            console.log('[useLeadsStats] Data is object without totalLeads, keys:', Object.keys(dataObj));
            // Tentar encontrar o objeto correto
            statsData = dataObj as unknown as DashboardStatsResponse;
          }
        } else {
          console.log('[useLeadsStats] Unknown data format');
          statsData = data as unknown as DashboardStatsResponse;
        }
        
        console.log('[useLeadsStats] Final statsData:', statsData);
        console.log('[useLeadsStats] totalLeads:', statsData?.totalLeads);
        console.log('[useLeadsStats] reprovacoesPorBanco:', statsData?.reprovacoesPorBanco);
        console.log('[useLeadsStats] reprovacoesPorTipo:', statsData?.reprovacoesPorTipo);
        
        const reprovacoesPorTipo = statsData.reprovacoesPorTipo || [];
        const reprovacoesPorBanco = statsData.reprovacoesPorBanco || [];
        
        // Calcular campos derivados
        const principalMotivo = reprovacoesPorTipo[0]?.tipo || "-";
        const principalMotivoCompleto = reprovacoesPorTipo[0]?.tipoCompleto || principalMotivo;
        const principalMotivoPercentual = reprovacoesPorTipo[0] && statsData.leadsReprovados > 0
          ? Math.round((reprovacoesPorTipo[0].quantidade / statsData.leadsReprovados) * 100)
          : 0;

        const bancoMaiorReprovacao = reprovacoesPorBanco[0]?.banco || "-";
        const bancoMaiorReprovacaoPercentual = reprovacoesPorBanco[0]?.taxaReprovacao || 0;

        setStats({
          totalLeads: statsData.totalLeads || 0,
          leadsAprovados: statsData.leadsAprovados || 0,
          leadsReprovados: statsData.leadsReprovados || 0,
          leadsPendentes: statsData.leadsPendentes || 0,
          taxaReprovacao: statsData.taxaReprovacao || 0,
          taxaAprovacao: statsData.taxaAprovacao || 0,
          valorTotal: statsData.valorTotal || 0,
          principalMotivo,
          principalMotivoCompleto,
          principalMotivoPercentual,
          bancoMaiorReprovacao,
          bancoMaiorReprovacaoPercentual,
          cbosUnicos: reprovacoesPorTipo.length,
          tiposReprovacaoUnicos: reprovacoesPorTipo.length,
          reprovacoesPorBanco,
          reprovacoesPorCBO: [],
          reprovacoesPorTipo,
          leadsPorStatus: statsData.leadsPorStatus || [],
          cbosBloqueados: statsData.cbosBloqueados || [],
          totalCBOsBloqueados: statsData.totalCBOsBloqueados || 0,
          margemMedia: statsData.margemMedia || 0,
          valorSimulacaoTotal: statsData.valorSimulacaoTotal || 0,
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching stats:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar estatísticas";
      setError(errorMessage);
      setStats(emptyStats);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters?.dataInicial,
    filters?.dataFinal,
    filters?.banco,
    filters?.status,
    filters?.tipoReprovacao,
    filters?.tiposReprovacaoMultiplos,
  ]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_filter_options');
      
      if (error) throw error;
      
      if (data) {
        const filterData = data as unknown as FilterOptionsResponse;
        setFilterOptions({
          bancos: filterData.bancos || [],
          tiposReprovacao: filterData.tiposReprovacao || [],
          statuses: filterData.statuses || [],
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching filter options:", err);
    }
  }, []);

  // Fetch inicial
  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, [fetchStats, fetchFilterOptions]);

  // Sincronização com eventos de importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsStats] Recebido evento de importação, atualizando estatísticas...');
      fetchStats();
      fetchFilterOptions();
    });
    
    return unsubscribe;
  }, [fetchStats, fetchFilterOptions]);

  return {
    stats,
    filterOptions,
    isLoading,
    error,
    refetch: fetchStats,
  };
};
