import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

interface DistribuicaoParcelas {
  parcelas: number;
  quantidade: number;
}

interface ProdutoMaisProcurado {
  produto: string;
  quantidade: number;
}

export interface LeadsAnalysis {
  totalLeads: number;
  comMargem: number;
  semMargem: number;
  percentualComMargem: number;
  percentualSemMargem: number;
  simulacoesAprovadas: number;
  simulacoesRecusadas: number;
  percentualSimAprovadas: number;
  percentualSimRecusadas: number;
  distribuicaoParcelas: DistribuicaoParcelas[];
  produtosMaisProcurados: ProdutoMaisProcurado[];
}

interface FetchParams {
  banco?: string;
  importBatchId?: string;
}

const fetchLeadsAnalysis = async (params?: FetchParams): Promise<LeadsAnalysis> => {
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: LeadsAnalysis | null; error: Error | null }>)('get_leads_analysis', {
    p_banco: params?.banco || null,
    p_import_batch_id: params?.importBatchId || null,
  });

  if (error) {
    console.error('[useLeadsAnalysis] RPC error:', error);
    throw error;
  }

  if (data) {
    const result = data as LeadsAnalysis;
    return {
      totalLeads: result.totalLeads || 0,
      comMargem: result.comMargem || 0,
      semMargem: result.semMargem || 0,
      percentualComMargem: result.percentualComMargem || 0,
      percentualSemMargem: result.percentualSemMargem || 0,
      simulacoesAprovadas: result.simulacoesAprovadas || 0,
      simulacoesRecusadas: result.simulacoesRecusadas || 0,
      percentualSimAprovadas: result.percentualSimAprovadas || 0,
      percentualSimRecusadas: result.percentualSimRecusadas || 0,
      distribuicaoParcelas: result.distribuicaoParcelas || [],
      produtosMaisProcurados: result.produtosMaisProcurados || [],
    };
  }

  return {
    totalLeads: 0,
    comMargem: 0,
    semMargem: 0,
    percentualComMargem: 0,
    percentualSemMargem: 0,
    simulacoesAprovadas: 0,
    simulacoesRecusadas: 0,
    percentualSimAprovadas: 0,
    percentualSimRecusadas: 0,
    distribuicaoParcelas: [],
    produtosMaisProcurados: [],
  };
};

export const useLeadsAnalysis = (banco?: string, importBatchId?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads-analysis', banco || 'todos', importBatchId || ''],
    queryFn: () => fetchLeadsAnalysis({ banco, importBatchId }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsAnalysis] Invalidando cache após importação...');
      queryClient.invalidateQueries({ queryKey: ['leads-analysis'] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  return {
    analysis: data || {
      totalLeads: 0,
      comMargem: 0,
      semMargem: 0,
      percentualComMargem: 0,
      percentualSemMargem: 0,
      simulacoesAprovadas: 0,
      simulacoesRecusadas: 0,
      percentualSimAprovadas: 0,
      percentualSimRecusadas: 0,
      distribuicaoParcelas: [],
      produtosMaisProcurados: [],
    },
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};
