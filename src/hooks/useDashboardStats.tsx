import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

interface ReprovacaoPorBanco {
  banco: string;
  total: number;
  aprovados: number;
  reprovados: number;
  pendentes: number;
  taxaReprovacao: number;
}

interface ReprovacaoPorTipo {
  tipo: string;
  tipoCompleto: string;
  quantidade: number;
}

interface LeadPorStatus {
  status: string;
  quantidade: number;
}

interface CBOBloqueado {
  code: string;
  name: string;
  quantidade: number;
}

export interface DashboardStatsResult {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaAprovacao: number;
  taxaReprovacao: number;
  valorTotal: number;
  reprovacoesPorBanco: ReprovacaoPorBanco[];
  reprovacoesPorTipo: ReprovacaoPorTipo[];
  leadsPorStatus: LeadPorStatus[];
  cbosBloqueados: CBOBloqueado[];
  totalCBOsBloqueados: number;
  margemMedia: number;
  valorSimulacaoTotal: number;
}

interface StatsFilters {
  importBatchId?: string;
  banco?: string;
  status?: string;
  dataInicial?: Date;
  dataFinal?: Date;
}

const fetchDashboardStats = async (filters?: StatsFilters): Promise<DashboardStatsResult> => {
  // Usar a versão completa da RPC com 7 parâmetros (inclui import_batch_id)
  const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
    p_data_inicial: filters?.dataInicial ? filters.dataInicial.toISOString() : null,
    p_data_final: filters?.dataFinal ? filters.dataFinal.toISOString() : null,
    p_banco: filters?.banco || '',
    p_status: filters?.status || '',
    p_tipo_reprovacao: '',
    p_tipos_reprovacao_multiplos: null,
    p_import_batch_id: filters?.importBatchId || '',
  });

  if (rpcError) {
    console.error('[useDashboardStats] RPC error:', rpcError);
    throw rpcError;
  }

  if (data) {
    const result = data as unknown as {
      totalLeads: number;
      leadsAprovados: number;
      leadsReprovados: number;
      leadsPendentes: number;
      taxaAprovacao: number;
      taxaReprovacao: number;
      valorTotal: number;
      reprovacoesPorBanco: ReprovacaoPorBanco[];
      reprovacoesPorTipo: ReprovacaoPorTipo[];
      leadsPorStatus: LeadPorStatus[];
      cbosBloqueados: CBOBloqueado[];
      totalCBOsBloqueados: number;
      margemMedia: number;
      valorSimulacaoTotal: number;
    };
    return {
      totalLeads: result.totalLeads || 0,
      leadsAprovados: result.leadsAprovados || 0,
      leadsReprovados: result.leadsReprovados || 0,
      leadsPendentes: result.leadsPendentes || 0,
      taxaAprovacao: result.taxaAprovacao || 0,
      taxaReprovacao: result.taxaReprovacao || 0,
      valorTotal: result.valorTotal || 0,
      reprovacoesPorBanco: result.reprovacoesPorBanco || [],
      reprovacoesPorTipo: result.reprovacoesPorTipo || [],
      leadsPorStatus: result.leadsPorStatus || [],
      cbosBloqueados: result.cbosBloqueados || [],
      totalCBOsBloqueados: result.totalCBOsBloqueados || 0,
      margemMedia: result.margemMedia || 0,
      valorSimulacaoTotal: result.valorSimulacaoTotal || 0,
    };
  }

  return {
    totalLeads: 0,
    leadsAprovados: 0,
    leadsReprovados: 0,
    leadsPendentes: 0,
    taxaAprovacao: 0,
    taxaReprovacao: 0,
    valorTotal: 0,
    reprovacoesPorBanco: [],
    reprovacoesPorTipo: [],
    leadsPorStatus: [],
    cbosBloqueados: [],
    totalCBOsBloqueados: 0,
    margemMedia: 0,
    valorSimulacaoTotal: 0,
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
      valorTotal: 0,
      reprovacoesPorBanco: [],
      reprovacoesPorTipo: [],
      leadsPorStatus: [],
      cbosBloqueados: [],
      totalCBOsBloqueados: 0,
      margemMedia: 0,
      valorSimulacaoTotal: 0,
    }, 
    isLoading, 
    error: error instanceof Error ? error.message : null, 
    refetch 
  };
};
