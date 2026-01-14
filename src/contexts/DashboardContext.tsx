// DashboardContext - Usando useLeadsData original
import { createContext, useContext, ReactNode, useState, useMemo, useEffect } from "react";
import { useLeadsData, Lead, DashboardStats, FilterState } from "@/hooks/useLeadsData";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

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

  // Hook original que carrega todos os dados
  const { 
    leads, 
    stats, 
    filterOptions: rawFilterOptions,
    isLoading, 
    error, 
    refetch 
  } = useLeadsData(filters);

  // Paginação client-side
  const pagination = useMemo(() => {
    const totalCount = leads.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    return {
      page: currentPage,
      pageSize,
      totalCount,
      totalPages,
    };
  }, [leads.length, currentPage, pageSize]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
    }
  };

  // Leads paginados
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return leads.slice(start, start + pageSize);
  }, [leads, currentPage, pageSize]);

  // Filter options com cbos
  const filterOptions = useMemo(() => ({
    ...rawFilterOptions,
    cbos: rawFilterOptions.cbos || [],
  }), [rawFilterOptions]);

  const value = useMemo(() => ({
    leads: paginatedLeads,
    allLeads: leads,  // Todos os leads para análises
    stats,
    filterOptions,
    isLoading,
    isLoadingStats: isLoading,
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
  }), [paginatedLeads, leads, stats, filterOptions, isLoading, error, filters, refetch, pagination, importedFiles, selectedImportFile]);

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
