// DashboardContext - Otimizado com TanStack Query e estatísticas calculadas no banco
import { createContext, useContext, ReactNode, useState, useMemo, useEffect, useCallback } from "react";
import { Lead, DashboardStats, FilterState } from "@/hooks/useLeadsData";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useLeadsQuery } from "@/hooks/useLeadsQuery";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import React from "react";

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

  // Hook otimizado para leads com TanStack Query (cache + paginação)
  const { 
    leads, 
    totalCount, 
    isLoading: isLoadingLeads, 
    error, 
    refetch: refetchLeads 
  } = useLeadsQuery(filters, currentPage, pageSize);

  // allLeads para compatibilidade (mesmos dados paginados)
  const allLeads = leads;

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
  const stats: DashboardStats = useMemo(() => {
    // Calcular principal motivo de reprovação
    const tiposReprovacao = dashboardStats.reprovacoesPorTipo || [];
    const principalTipo = tiposReprovacao.length > 0 ? tiposReprovacao[0] : null;
    const totalReprovacoes = tiposReprovacao.reduce((acc, t) => acc + t.quantidade, 0);
    
    // Calcular banco com maior reprovação
    const bancos = dashboardStats.reprovacoesPorBanco || [];
    const bancoMaiorReprovacao = bancos.length > 0 
      ? bancos.reduce((prev, curr) => curr.taxaReprovacao > prev.taxaReprovacao ? curr : prev, bancos[0])
      : null;

    return {
      totalLeads: dashboardStats.totalLeads,
      leadsAprovados: dashboardStats.leadsAprovados,
      leadsReprovados: dashboardStats.leadsReprovados,
      leadsPendentes: dashboardStats.leadsPendentes,
      taxaReprovacao: dashboardStats.taxaReprovacao,
      taxaAprovacao: dashboardStats.taxaAprovacao,
      valorTotal: dashboardStats.valorTotal || 0,
      principalMotivo: principalTipo?.tipo || "-",
      principalMotivoCompleto: principalTipo?.tipoCompleto || "-",
      principalMotivoPercentual: principalTipo && totalReprovacoes > 0 
        ? Math.round((principalTipo.quantidade / totalReprovacoes) * 100) 
        : 0,
      bancoMaiorReprovacao: bancoMaiorReprovacao?.banco || "-",
      bancoMaiorReprovacaoPercentual: bancoMaiorReprovacao?.taxaReprovacao || 0,
      cbosUnicos: dashboardStats.cbosBloqueados?.length || 0,
      tiposReprovacaoUnicos: tiposReprovacao.length,
      reprovacoesPorBanco: bancos.map(b => ({
        banco: b.banco,
        total: b.total,
        aprovados: b.aprovados,
        reprovados: b.reprovados,
        pendentes: b.pendentes,
        taxaReprovacao: b.taxaReprovacao,
      })),
      reprovacoesPorCBO: [],
      reprovacoesPorTipo: tiposReprovacao.map(t => ({
        tipo: t.tipo,
        tipoCompleto: t.tipoCompleto,
        quantidade: t.quantidade,
      })),
      leadsPorStatus: dashboardStats.leadsPorStatus || [
        { status: "Aprovado", quantidade: dashboardStats.leadsAprovados },
        { status: "Reprovado", quantidade: dashboardStats.leadsReprovados },
        { status: "Pendente", quantidade: dashboardStats.leadsPendentes },
      ],
      cbosBloqueados: dashboardStats.cbosBloqueados || [],
      totalCBOsBloqueados: dashboardStats.totalCBOsBloqueados || 0,
      margemMedia: dashboardStats.margemMedia || 0,
      valorSimulacaoTotal: dashboardStats.valorSimulacaoTotal || 0,
    };
  }, [dashboardStats]);

  // Filter options - extrair dos dados retornados
  const filterOptions = useMemo(() => {
    const bancos = (dashboardStats.reprovacoesPorBanco || []).map(b => b.banco).filter(b => b && b !== 'Não Informado');
    const tiposReprovacao = (dashboardStats.reprovacoesPorTipo || []).map(t => t.tipo);
    return {
      bancos,
      tiposReprovacao,
      statuses: ["aprovado", "reprovado", "pendente"],
      cbos: [],
    };
  }, [dashboardStats]);

  const refetch = useCallback(() => {
    refetchLeads();
    refetchStats();
  }, [refetchLeads, refetchStats]);

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
