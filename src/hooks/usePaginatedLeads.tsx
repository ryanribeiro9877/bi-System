import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead } from "@/hooks/useLeadsData";
import { 
  RetornoAutorizacao, 
  RetornoMargem, 
  RetornoSimulacao, 
  RetornoProposta, 
  RetornoGetProposta,
  parseJsonSafe 
} from "@/types/lead";
import { importEvents } from "@/events/importEvents";

interface UsePaginatedLeadsOptions {
  pageSize?: number;
  statusFilter?: string;
  searchQuery?: string;
  bancoFilter?: string;
}

interface UsePaginatedLeadsResult {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refetch: () => void;
}

/**
 * Hook para paginação server-side de leads
 * Carrega apenas os registros da página atual
 */
export const usePaginatedLeads = (options: UsePaginatedLeadsOptions = {}): UsePaginatedLeadsResult => {
  const { 
    pageSize = 20, 
    statusFilter = "", 
    searchQuery = "",
    bancoFilter = ""
  } = options;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const totalPages = Math.ceil(totalRecords / pageSize);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Campos mínimos necessários para a tabela
      const selectFields = "id,cpf,nome,banco,cbo,status,tipo_reprovacao,valor,created_at,updated_at,retorno_margem,ultimo_log";

      // Construir query base
      let countQuery = supabase.from("leads").select("*", { count: "exact", head: true });
      let dataQuery = supabase.from("leads").select(selectFields).order("created_at", { ascending: false });

      // Aplicar filtros
      if (statusFilter && statusFilter !== "todos") {
        countQuery = countQuery.eq("status", statusFilter);
        dataQuery = dataQuery.eq("status", statusFilter);
      }

      if (bancoFilter) {
        countQuery = countQuery.eq("banco", bancoFilter);
        dataQuery = dataQuery.eq("banco", bancoFilter);
      }

      if (searchQuery) {
        const cleanSearch = searchQuery.replace(/\D/g, "");
        if (cleanSearch) {
          countQuery = countQuery.ilike("cpf", `%${cleanSearch}%`);
          dataQuery = dataQuery.ilike("cpf", `%${cleanSearch}%`);
        } else {
          countQuery = countQuery.ilike("nome", `%${searchQuery}%`);
          dataQuery = dataQuery.ilike("nome", `%${searchQuery}%`);
        }
      }

      // Buscar contagem total
      const { count } = await countQuery;
      setTotalRecords(count || 0);

      // Calcular range para paginação
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Buscar dados da página atual
      const { data, error: queryError } = await dataQuery.range(from, to);

      if (queryError) throw queryError;

      // Parse JSONB fields
      const parsedLeads: Lead[] = (data || []).map((row: any) => ({
        ...row,
        retorno_autorizacao: null,
        retorno_margem: parseJsonSafe<RetornoMargem>(row.retorno_margem),
        retorno_simulacao: null,
        retorno_proposta: null,
        retorno_get_proposta: null,
      }));

      setLeads(parsedLeads);
    } catch (err: any) {
      console.error("Error fetching paginated leads:", err);
      setError(err.message || "Erro ao buscar leads");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, searchQuery, bancoFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, bancoFilter]);

  // Atualiza quando houver nova importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log("[usePaginatedLeads] Recebido evento de importação, atualizando...");
      setCurrentPage(1);
      fetchLeads();
    });
    return unsubscribe;
  }, [fetchLeads]);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  return {
    leads,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalRecords,
    goToPage,
    nextPage,
    prevPage,
    refetch: fetchLeads,
  };
};