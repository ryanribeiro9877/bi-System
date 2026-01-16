import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

export interface DashboardStatsResult {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaAprovacao: number;
  taxaReprovacao: number;
  bancos: string[];
  tiposReprovacao: string[];
}

interface StatsFilters {
  importBatchId?: string;
  banco?: string;
  status?: string;
  dataInicial?: Date;
  dataFinal?: Date;
}

export const useDashboardStats = (filters?: StatsFilters) => {
  const [stats, setStats] = useState<DashboardStatsResult>({
    totalLeads: 0,
    leadsAprovados: 0,
    leadsReprovados: 0,
    leadsPendentes: 0,
    taxaAprovacao: 0,
    taxaReprovacao: 0,
    bancos: [],
    tiposReprovacao: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    console.log('[useDashboardStats] Fetching stats with filters:', filters);
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
        p_import_batch_id: filters?.importBatchId || null,
        p_banco: filters?.banco || null,
        p_status: filters?.status || null,
        p_data_inicial: filters?.dataInicial?.toISOString() || null,
        p_data_final: filters?.dataFinal?.toISOString() || null,
      });

      if (rpcError) throw rpcError;

      if (data) {
        setStats({
          totalLeads: data.totalLeads || 0,
          leadsAprovados: data.leadsAprovados || 0,
          leadsReprovados: data.leadsReprovados || 0,
          leadsPendentes: data.leadsPendentes || 0,
          taxaAprovacao: data.taxaAprovacao || 0,
          taxaReprovacao: data.taxaReprovacao || 0,
          bancos: data.bancos || [],
          tiposReprovacao: data.tiposReprovacao || [],
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching dashboard stats:", err);
      setError(err instanceof Error ? err.message : "Erro ao buscar estatísticas");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Sincronização global: refetch quando houver nova importação ou exclusão
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useDashboardStats] Recebido evento de importação/exclusão, atualizando...');
      fetchStats();
    });
    
    return unsubscribe;
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
};
