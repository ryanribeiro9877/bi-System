// DashboardContext - Otimizado com estatísticas calculadas no banco
import { createContext, useContext, ReactNode, useState, useMemo, useEffect, useCallback } from "react";
import { Lead, DashboardStats, FilterState } from "@/hooks/useLeadsData";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { parseJsonSafe, RetornoAutorizacao, RetornoMargem, RetornoSimulacao, RetornoProposta, RetornoGetProposta } from "@/types/lead";

export interface ImportedFile {
  id: string;
  file_name: string;
  total_records: number;
  successful_records: number;
  created_at: string;
}

interface FilterOptions {
  bancos: string[];
  tiposReprovacao: string[];
  statuses: string[];
  cbos: string[];
}

interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface DashboardContextType {
  leads: Lead[];           // Leads paginados para exibição em tabelas
  allLeads: Lead[];        // Todos os leads para análises e gráficos
  stats: DashboardStats;
  filterOptions: FilterOptions;
  isLoading: boolean;
  isLoadingStats: boolean;
  error: string | null;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  refetch: () => void;
  // Paginação (client-side por enquanto)
  pagination: PaginationState;
  goToPage: (page: number) => void;
  // Filtro por arquivo importado
  importedFiles: ImportedFile[];
  selectedImportFile: string;
  setSelectedImportFile: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Componente interno que contém os hooks
const DashboardProviderInner = ({ children }: { children: ReactNode }) => {
  const [filters, setFiltersInternal] = useState<FilterState>({
    dataInicial: undefined,
    dataFinal: undefined,
    banco: "",
    tipoReprovacao: "",
    tiposReprovacaoMultiplos: [],
    status: "",
    cpf: "",
    importBatchId: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Estado para arquivos importados
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [selectedImportFile, setSelectedImportFileInternal] = useState<string>("");

  // Carregar lista de arquivos importados
  const fetchImportedFiles = async () => {
    const { data, error } = await supabase
      .from("imports")
      .select("id, file_name, total_records, successful_records, created_at")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setImportedFiles(data);
    }
  };

  // Carregar arquivos importados ao montar e quando houver mudanças
  useEffect(() => {
    fetchImportedFiles();
    
    const unsubscribe = importEvents.subscribe(() => {
      fetchImportedFiles();
    });
    
    return unsubscribe;
  }, []);

  // Wrapper para setFilters que também reseta a página
  const setFilters = (newFilters: FilterState) => {
    setFiltersInternal(newFilters);
    setCurrentPage(1); // Reset para primeira página ao mudar filtros
  };

  // Wrapper para setSelectedImportFile que também atualiza o filtro
  const setSelectedImportFile = (id: string) => {
    setSelectedImportFileInternal(id);
    setFiltersInternal(prev => ({ ...prev, importBatchId: id }));
    setCurrentPage(1);
  };

  // Hook otimizado para estatísticas (calculadas no banco)
  const { stats: dashboardStats, isLoading: isLoadingStats, refetch: refetchStats } = useDashboardStats({
    importBatchId: filters.importBatchId,
    banco: filters.banco,
    status: filters.status,
    dataInicial: filters.dataInicial,
    dataFinal: filters.dataFinal,
  });

  // Estado para leads paginados
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar leads paginados do servidor
  const fetchLeads = useCallback(async () => {
    setIsLoadingLeads(true);
    setError(null);

    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
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

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const parsedLeads: Lead[] = (data || []).map((row: Record<string, unknown>) => ({
        ...row,
        retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(row.retorno_autorizacao),
        retorno_margem: parseJsonSafe<RetornoMargem>(row.retorno_margem),
        retorno_simulacao: parseJsonSafe<RetornoSimulacao>(row.retorno_simulacao),
        retorno_proposta: parseJsonSafe<RetornoProposta>(row.retorno_proposta),
        retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(row.retorno_get_proposta),
      } as Lead));

      setLeads(parsedLeads);
      setAllLeads(parsedLeads); // Para compatibilidade
      
      // Atualizar total count para paginação
      if (count !== null) {
        setTotalCount(count);
      }
    } catch (err: unknown) {
      console.error("Error fetching leads:", err);
      setError(err instanceof Error ? err.message : "Erro ao buscar leads");
    } finally {
      setIsLoadingLeads(false);
    }
  }, [currentPage, pageSize, filters]);

  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Sincronização global
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      fetchLeads();
      refetchStats();
    });
    return unsubscribe;
  }, [fetchLeads, refetchStats]);

  // Paginação
  const pagination = useMemo(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    return {
      page: currentPage,
      pageSize,
      totalCount,
      totalPages,
    };
  }, [totalCount, currentPage, pageSize]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
    }
  };

  // Converter stats do hook para o formato esperado
  const stats: DashboardStats = useMemo(() => ({
    totalLeads: dashboardStats.totalLeads,
    leadsAprovados: dashboardStats.leadsAprovados,
    leadsReprovados: dashboardStats.leadsReprovados,
    leadsPendentes: dashboardStats.leadsPendentes,
    taxaReprovacao: dashboardStats.taxaReprovacao,
    taxaAprovacao: dashboardStats.taxaAprovacao,
    valorTotal: 0,
    principalMotivo: "-",
    principalMotivoCompleto: "-",
    principalMotivoPercentual: 0,
    bancoMaiorReprovacao: "-",
    bancoMaiorReprovacaoPercentual: 0,
    cbosUnicos: 0,
    tiposReprovacaoUnicos: dashboardStats.tiposReprovacao.length,
    reprovacoesPorBanco: [],
    reprovacoesPorCBO: [],
    reprovacoesPorTipo: [],
    leadsPorStatus: [
      { status: "aprovado", quantidade: dashboardStats.leadsAprovados },
      { status: "reprovado", quantidade: dashboardStats.leadsReprovados },
      { status: "pendente", quantidade: dashboardStats.leadsPendentes },
    ],
    cbosBloqueados: [],
    totalCBOsBloqueados: 0,
    margemMedia: 0,
    valorSimulacaoTotal: 0,
  }), [dashboardStats]);

  // Filter options
  const filterOptions = useMemo(() => ({
    bancos: dashboardStats.bancos || [],
    tiposReprovacao: dashboardStats.tiposReprovacao || [],
    statuses: ["aprovado", "reprovado", "pendente"],
    cbos: [],
  }), [dashboardStats]);

  const refetch = useCallback(() => {
    fetchLeads();
    refetchStats();
  }, [fetchLeads, refetchStats]);

  const isLoading = isLoadingLeads || isLoadingStats;

  const value = useMemo(() => ({
    leads,
    allLeads,
    stats,
    filterOptions,
    isLoading,
    isLoadingStats,
    error,
    filters,
    setFilters,
    refetch,
    pagination,
    goToPage,
    importedFiles,
    selectedImportFile,
    setSelectedImportFile,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [leads, allLeads, stats, filterOptions, isLoading, isLoadingStats, error, filters, refetch, pagination, importedFiles, selectedImportFile]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  // Evita montar múltiplos providers caso a árvore já esteja envolvida
  const existing = useContext(DashboardContext);
  if (existing) return <>{children}</>;

  return <DashboardProviderInner>{children}</DashboardProviderInner>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
