import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
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

const fetchDashboardStats = async (filters?: StatsFilters): Promise<DashboardStatsResult> => {
  console.log('[useDashboardStats] Fetching stats with filters:', filters);
  
  const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
    p_import_batch_id: filters?.importBatchId || '',
    p_banco: filters?.banco || '',
    p_status: filters?.status || '',
    p_data_inicial: filters?.dataInicial?.toISOString() || '',
    p_data_final: filters?.dataFinal?.toISOString() || '',
  });

  if (rpcError) throw rpcError;

  if (data) {
    const result = data as {
      totalLeads: number;
      leadsAprovados: number;
      leadsReprovados: number;
      leadsPendentes: number;
      taxaAprovacao: number;
      taxaReprovacao: number;
      bancos: string[];
      tiposReprovacao: string[];
    };
    return {
      totalLeads: result.totalLeads || 0,
      leadsAprovados: result.leadsAprovados || 0,
      leadsReprovados: result.leadsReprovados || 0,
      leadsPendentes: result.leadsPendentes || 0,
      taxaAprovacao: result.taxaAprovacao || 0,
      taxaReprovacao: result.taxaReprovacao || 0,
      bancos: result.bancos || [],
      tiposReprovacao: result.tiposReprovacao || [],
    };
  }

  return {
    totalLeads: 0,
    leadsAprovados: 0,
    leadsReprovados: 0,
    leadsPendentes: 0,
    taxaAprovacao: 0,
    taxaReprovacao: 0,
    bancos: [],
    tiposReprovacao: [],
  };
};

export const useDashboardStats = (filters?: StatsFilters) => {
  const queryClient = useQueryClient();
  
  // Memoizar a query key para evitar re-renders desnecessários
  const queryKey = useMemo(() => [
    'dashboard-stats',
    filters?.importBatchId || '',
    filters?.banco || '',
    filters?.status || '',
    filters?.dataInicial?.toISOString() || '',
    filters?.dataFinal?.toISOString() || '',
  ], [filters]);

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDashboardStats(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos em cache
  });

  // Sincronização global: invalidar cache quando houver nova importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useDashboardStats] Invalidando cache após importação...');
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  return { 
    stats: stats || {
      totalLeads: 0,
      leadsAprovados: 0,
      leadsReprovados: 0,
      leadsPendentes: 0,
      taxaAprovacao: 0,
      taxaReprovacao: 0,
      bancos: [],
      tiposReprovacao: [],
    }, 
    isLoading, 
    error: error instanceof Error ? error.message : null, 
    refetch 
  };
};
