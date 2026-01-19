import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { 
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
  retorno_autorizacao: RetornoAutorizacao | null;
  retorno_margem: RetornoMargem | null;
  retorno_simulacao: RetornoSimulacao | null;
  retorno_proposta: RetornoProposta | null;
  retorno_get_proposta: RetornoGetProposta | null;
  ultimo_log: string | null;
  cbo_block_code: string | null;
  cbo_block_name: string | null;
}

export interface LeadListItem {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  status: string | null;
  tipo_reprovacao: string | null;
  valor: number | null;
  created_at: string;
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

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Hook otimizado para buscar leads com paginação
 * Carrega apenas as colunas necessárias para listagem
 */
export const useLeadsPaginated = (filters?: FilterState, pageSize = DEFAULT_PAGE_SIZE) => {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize,
    totalCount: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      // Primeiro, buscar contagem total
      console.log('[useLeadsPaginated] Calling count_leads RPC...');
      const { data: countData, error: countError } = await supabase.rpc('count_leads', {
        p_data_inicial: filters?.dataInicial?.toISOString() || null,
        p_data_final: filters?.dataFinal?.toISOString() || null,
        p_banco: filters?.banco || null,
        p_status: filters?.status || null,
        p_tipo_reprovacao: filters?.tipoReprovacao || null,
        p_cpf: filters?.cpf || null,
      });

      console.log('[useLeadsPaginated] count_leads result:', countData, 'error:', countError);
      if (countError) throw countError;

      const totalCount = countData || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Buscar apenas colunas necessárias para listagem (sem JSONB pesados)
      let query = supabase
        .from("leads")
        .select("id, cpf, nome, banco, status, tipo_reprovacao, valor, created_at")
        .order("created_at", { ascending: false });

      // Aplicar filtros
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
      if (filters?.tiposReprovacaoMultiplos && filters.tiposReprovacaoMultiplos.length > 0) {
        query = query.in("tipo_reprovacao", filters.tiposReprovacaoMultiplos);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.cpf) {
        query = query.ilike("cpf", `%${filters.cpf}%`);
      }

      // Aplicar paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setLeads(data || []);
      setPagination({
        page,
        pageSize,
        totalCount,
        totalPages,
      });
    } catch (err: unknown) {
      console.error("Error fetching leads:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar leads";
      setError(errorMessage);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters?.dataInicial,
    filters?.dataFinal,
    filters?.banco,
    filters?.tipoReprovacao,
    filters?.tiposReprovacaoMultiplos,
    filters?.status,
    filters?.cpf,
    pageSize,
  ]);

  // Função para mudar de página
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchLeads(page);
    }
  }, [fetchLeads, pagination.totalPages]);

  // Fetch inicial e quando filtros mudam
  useEffect(() => {
    fetchLeads(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters?.dataInicial,
    filters?.dataFinal,
    filters?.banco,
    filters?.tipoReprovacao,
    filters?.tiposReprovacaoMultiplos,
    filters?.status,
    filters?.cpf,
  ]);

  // Sincronização com eventos de importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsPaginated] Recebido evento de importação, atualizando dados...');
      fetchLeads(1);
    });
    
    return unsubscribe;
  }, [fetchLeads]);

  return {
    leads,
    pagination,
    isLoading,
    error,
    goToPage,
    refetch: () => fetchLeads(pagination.page),
  };
};

/**
 * Hook para buscar detalhes completos de um lead específico
 * Usado quando o usuário clica para ver detalhes
 */
export const useLeadDetails = (leadId: string | null) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    if (!leadId) {
      setLead(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setLead({
          ...data,
          retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(data.retorno_autorizacao),
          retorno_margem: parseJsonSafe<RetornoMargem>(data.retorno_margem),
          retorno_simulacao: parseJsonSafe<RetornoSimulacao>(data.retorno_simulacao),
          retorno_proposta: parseJsonSafe<RetornoProposta>(data.retorno_proposta),
          retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(data.retorno_get_proposta),
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching lead details:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao buscar detalhes do lead";
      setError(errorMessage);
      setLead(null);
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  return {
    lead,
    isLoading,
    error,
    refetch: fetchLead,
  };
};
