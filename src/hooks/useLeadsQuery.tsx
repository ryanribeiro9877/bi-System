import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { Lead, FilterState } from "@/hooks/useLeadsData";
import { parseJsonSafe, RetornoAutorizacao, RetornoMargem, RetornoSimulacao, RetornoProposta, RetornoGetProposta } from "@/types/lead";

interface LeadsQueryResult {
  leads: Lead[];
  totalCount: number;
}

interface LeadsQueryParams {
  filters: FilterState;
  page: number;
  pageSize: number;
}

const fetchLeads = async ({ filters, page, pageSize }: LeadsQueryParams): Promise<LeadsQueryResult> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // SELECT apenas campos necessários para a tabela (não carrega JSONs pesados)
  let query = supabase
    .from("leads")
    .select("id, cpf, nome, banco, status, tipo_reprovacao, valor, created_at, import_batch_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.importBatchId) {
    query = query.eq("import_batch_id", filters.importBatchId);
  }
  if (filters.banco) {
    query = query.eq("banco", filters.banco);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.cpf) {
    query = query.ilike("cpf", `%${filters.cpf}%`);
  }
  if (filters.dataInicial) {
    query = query.gte("created_at", filters.dataInicial.toISOString());
  }
  if (filters.dataFinal) {
    query = query.lte("created_at", filters.dataFinal.toISOString());
  }

  const { data, error, count } = await query;

  if (error) throw error;

  // Mapear para o tipo Lead (campos JSON serão null para performance)
  const leads: Lead[] = (data || []).map((row) => ({
    id: row.id,
    cpf: row.cpf,
    nome: row.nome,
    banco: row.banco,
    cbo: null,
    status: row.status,
    tipo_reprovacao: row.tipo_reprovacao,
    valor: row.valor,
    data_envio: null,
    data_retorno: null,
    observacoes: null,
    created_at: row.created_at,
    updated_at: row.created_at,
    import_batch_id: row.import_batch_id,
    retorno_autorizacao: null,
    retorno_margem: null,
    retorno_simulacao: null,
    retorno_proposta: null,
    retorno_get_proposta: null,
    ultimo_log: null,
    cbo_block_code: null,
    cbo_block_name: null,
  }));

  return {
    leads,
    totalCount: count || 0,
  };
};

// Buscar detalhes completos de um lead (com JSONs)
export const fetchLeadDetails = async (leadId: string): Promise<Lead | null> => {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(data.retorno_autorizacao),
    retorno_margem: parseJsonSafe<RetornoMargem>(data.retorno_margem),
    retorno_simulacao: parseJsonSafe<RetornoSimulacao>(data.retorno_simulacao),
    retorno_proposta: parseJsonSafe<RetornoProposta>(data.retorno_proposta),
    retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(data.retorno_get_proposta),
  } as Lead;
};

export const useLeadsQuery = (filters: FilterState, page: number, pageSize: number = 50) => {
  const queryClient = useQueryClient();

  // Memoizar query key
  const queryKey = useMemo(() => [
    'leads',
    filters.importBatchId || '',
    filters.banco || '',
    filters.status || '',
    filters.cpf || '',
    filters.dataInicial?.toISOString() || '',
    filters.dataFinal?.toISOString() || '',
    page,
    pageSize,
  ], [filters, page, pageSize]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchLeads({ filters, page, pageSize }),
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos em cache
    placeholderData: (previousData) => previousData, // Manter dados anteriores enquanto carrega
  });

  // Invalidar cache quando houver importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsQuery] Invalidando cache após importação...');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  return {
    leads: data?.leads || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};

// Hook para buscar detalhes de um lead específico
export const useLeadDetails = (leadId: string | null) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['lead-details', leadId],
    queryFn: () => leadId ? fetchLeadDetails(leadId) : null,
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    lead: data,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
};
