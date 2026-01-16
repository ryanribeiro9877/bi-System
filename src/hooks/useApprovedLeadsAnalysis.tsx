import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

interface Empresa {
  nome: string;
  cnpj: string;
  quantidade: number;
}

interface CBO {
  codigo: string;
  descricao: string;
  quantidade: number;
}

interface FaixaMargem {
  faixa: string;
  quantidade: number;
}

interface DistribuicaoParcelas {
  parcelas: number;
  quantidade: number;
}

interface DistribuicaoBanco {
  banco: string;
  quantidade: number;
  margemMedia: number;
}

interface DistribuicaoPorte {
  porte: string;
  quantidade: number;
}

interface DistribuicaoVinculo {
  faixa: string;
  quantidade: number;
}

export interface ApprovedLeadsAnalysis {
  totalAprovados: number;
  comMargem: number;
  margemMedia: number;
  margemMaxima: number;
  margemMinima: number;
  topEmpresas: Empresa[];
  topCBOs: CBO[];
  faixasMargem: FaixaMargem[];
  distribuicaoParcelas: DistribuicaoParcelas[];
  distribuicaoBanco: DistribuicaoBanco[];
  distribuicaoPorte: DistribuicaoPorte[];
  distribuicaoVinculo: DistribuicaoVinculo[];
}

const fetchApprovedLeadsAnalysis = async (banco?: string): Promise<ApprovedLeadsAnalysis> => {
  // Usar any para evitar erro de tipagem com RPC não tipada
  const { data, error } = await (supabase.rpc as any)('get_approved_leads_analysis', {
    p_banco: banco || null,
  });

  if (error) {
    console.error('[useApprovedLeadsAnalysis] RPC error:', error);
    throw error;
  }

  if (data) {
    const result = data as ApprovedLeadsAnalysis;
    return {
      totalAprovados: result.totalAprovados || 0,
      comMargem: result.comMargem || 0,
      margemMedia: result.margemMedia || 0,
      margemMaxima: result.margemMaxima || 0,
      margemMinima: result.margemMinima || 0,
      topEmpresas: result.topEmpresas || [],
      topCBOs: result.topCBOs || [],
      faixasMargem: result.faixasMargem || [],
      distribuicaoParcelas: result.distribuicaoParcelas || [],
      distribuicaoBanco: result.distribuicaoBanco || [],
      distribuicaoPorte: result.distribuicaoPorte || [],
      distribuicaoVinculo: result.distribuicaoVinculo || [],
    };
  }

  return {
    totalAprovados: 0,
    comMargem: 0,
    margemMedia: 0,
    margemMaxima: 0,
    margemMinima: 0,
    topEmpresas: [],
    topCBOs: [],
    faixasMargem: [],
    distribuicaoParcelas: [],
    distribuicaoBanco: [],
    distribuicaoPorte: [],
    distribuicaoVinculo: [],
  };
};

export const useApprovedLeadsAnalysis = (banco?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['approved-leads-analysis', banco || 'todos'],
    queryFn: () => fetchApprovedLeadsAnalysis(banco),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos em cache
  });

  // Invalidar cache quando houver importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useApprovedLeadsAnalysis] Invalidando cache após importação...');
      queryClient.invalidateQueries({ queryKey: ['approved-leads-analysis'] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  return {
    analysis: data || {
      totalAprovados: 0,
      comMargem: 0,
      margemMedia: 0,
      margemMaxima: 0,
      margemMinima: 0,
      topEmpresas: [],
      topCBOs: [],
      faixasMargem: [],
      distribuicaoParcelas: [],
      distribuicaoBanco: [],
      distribuicaoPorte: [],
      distribuicaoVinculo: [],
    },
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};
