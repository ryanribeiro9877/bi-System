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

  // SELECT da tabela leads
  let query = supabase
    .from("leads")
    .select(
      "id, cpf, nome, banco, status, tipo_reprovacao, valor, created_at, updated_at, import_batch_id, retorno_get_proposta",
      { count: "planned" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.importBatchId) {
    query = query.eq("import_batch_id", filters.importBatchId);
  }
  if (filters.banco) {
    query = query.eq("banco", filters.banco);
  }
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.cpf) {
    const digits = filters.cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      query = query.eq("cpf", digits);
    } else {
      query = query.ilike("cpf", `%${filters.cpf}%`);
    }
  }
  if (filters.dataInicial) {
    query = query.gte("created_at", filters.dataInicial.toISOString());
  }
  if (filters.dataFinal) {
    query = query.lte("created_at", filters.dataFinal.toISOString());
  }

  const { data, error, count } = await query;

  if (error) throw error;

  // Mapear para o tipo Lead
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
    updated_at: row.updated_at ?? row.created_at,
    import_batch_id: row.import_batch_id,
    retorno_autorizacao: null,
    retorno_margem: null,
    retorno_simulacao: null,
    retorno_proposta: null,
    retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(row.retorno_get_proposta),
    ultimo_log: null,
    cbo_block_code: null,
    cbo_block_name: null,
    motivo_reprovacao_tecnica: null,
  }));

  return {
    leads,
    totalCount: count || 0,
  };
};

export const useLeadsQueryEnabled = (
  filters: FilterState,
  page: number,
  pageSize: number = 50,
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => [
    'leads',
    filters.importBatchId || '',
    filters.banco || '',
    filters.status || '',
    (filters.statuses || []).join(','),
    filters.cpf || '',
    filters.dataInicial?.toISOString() || '',
    filters.dataFinal?.toISOString() || '',
    page,
    pageSize,
  ], [filters, page, pageSize]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchLeads({ filters, page, pageSize }),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos
    gcTime: 30 * 60 * 1000, // 30 minutos em cache
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false, // Não recarregar ao focar na janela
  });

  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
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

// Buscar detalhes completos de um lead (com JSONs e motivo_reprovacao_tecnica)
export const fetchLeadDetails = async (leadId: string): Promise<Lead | null> => {
  // Buscar da view leads_com_motivo para incluir o campo calculado motivo_reprovacao_tecnica
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("leads_com_motivo")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) {
    console.error("[fetchLeadDetails] Erro ao buscar lead:", error);
    throw error;
  }
  if (!data) return null;

  // Log apenas para leads com reprovacao_tecnica
  if (data.status === "reprovacao_tecnica") {
    console.log("[fetchLeadDetails] Lead reprovacao_tecnica:", {
      id: data.id,
      status: data.status,
      motivo_reprovacao_tecnica: data.motivo_reprovacao_tecnica,
    });
  }

  return {
    ...data,
    retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(data.retorno_autorizacao),
    retorno_margem: parseJsonSafe<RetornoMargem>(data.retorno_margem),
    retorno_simulacao: parseJsonSafe<RetornoSimulacao>(data.retorno_simulacao),
    retorno_proposta: parseJsonSafe<RetornoProposta>(data.retorno_proposta),
    retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(data.retorno_get_proposta),
    motivo_reprovacao_tecnica: data.motivo_reprovacao_tecnica || null,
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
    (filters.statuses || []).join(','),
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
