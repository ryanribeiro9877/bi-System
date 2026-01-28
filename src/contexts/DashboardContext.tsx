// DashboardContext - Otimizado com TanStack Query e estatísticas calculadas no banco
import { createContext, useContext, ReactNode, useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lead, DashboardStats, FilterState } from "@/hooks/useLeadsData";
import { parseJsonSafe, RetornoGetProposta, RetornoMargem } from "@/types/lead";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useLeadsQueryEnabled } from "@/hooks/useLeadsQuery";
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
const DashboardProviderInner = ({ children, enableLeadsQuery }: { children: ReactNode; enableLeadsQuery: boolean }) => {
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
      .order("created_at", { ascending: false })
      .limit(50);
    
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
  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersInternal(newFilters);
    setCurrentPage(1); // Reset para primeira página ao mudar filtros
  }, []);

  // Wrapper para setSelectedImportFile que também atualiza o filtro
  const setSelectedImportFile = useCallback((id: string) => {
    setSelectedImportFileInternal(id);
    setFiltersInternal(prev => ({ ...prev, importBatchId: id }));
    setCurrentPage(1);
  }, []);

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
  } = useLeadsQueryEnabled(filters, currentPage, pageSize, enableLeadsQuery);

  const fetchAllLeads = useCallback(async (): Promise<Lead[]> => {
    const batchSize = 1000;
    const maxBatches = 50;
    const all: Lead[] = [];

    for (let batch = 0; batch < maxBatches; batch++) {
      const from = batch * batchSize;
      const to = from + batchSize - 1;

      let query = supabase
        .from("leads")
        .select(
          "id, cpf, nome, banco, status, tipo_reprovacao, valor, created_at, updated_at, import_batch_id, retorno_get_proposta, retorno_margem",
          { count: "planned" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.importBatchId) query = query.eq("import_batch_id", filters.importBatchId);
      if (filters.banco) query = query.eq("banco", filters.banco);
      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      } else if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.cpf) {
        const digits = filters.cpf.replace(/\D/g, "");
        if (digits.length === 11) query = query.eq("cpf", digits);
        else query = query.ilike("cpf", `%${filters.cpf}%`);
      }
      if (filters.dataInicial) query = query.gte("created_at", filters.dataInicial.toISOString());
      if (filters.dataFinal) query = query.lte("created_at", filters.dataFinal.toISOString());

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      const mapped: Lead[] = (data || []).map((row) => ({
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
        retorno_margem: parseJsonSafe<RetornoMargem>(row.retorno_margem),
        retorno_simulacao: null,
        retorno_proposta: null,
        retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(row.retorno_get_proposta),
        ultimo_log: null,
        cbo_block_code: null,
        cbo_block_name: null,
        motivo_reprovacao_tecnica: null,
      }));

      all.push(...mapped);
      if (!data || data.length < batchSize) break;
    }

    return all;
  }, [filters]);

  const allLeadsQueryKey = useMemo(() => [
    "all-leads",
    filters.importBatchId || "",
    filters.banco || "",
    filters.status || "",
    (filters.statuses || []).join(","),
    filters.cpf || "",
    filters.dataInicial?.toISOString() || "",
    filters.dataFinal?.toISOString() || "",
    enableLeadsQuery ? "1" : "0",
  ], [filters, enableLeadsQuery]);

  const { data: allLeadsData, isLoading: isLoadingAllLeads } = useQuery({
    queryKey: allLeadsQueryKey,
    queryFn: fetchAllLeads,
    enabled: enableLeadsQuery,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const allLeads = allLeadsData || [];

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

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
    }
  }, [pagination.totalPages]);

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

  const isLoading = isLoadingLeads || isLoadingStats || isLoadingAllLeads;

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

  return <DashboardProviderInner enableLeadsQuery={true}>{children}</DashboardProviderInner>;
};

export const DashboardProviderNoLeads = ({ children }: { children: ReactNode }) => {
  const existing = useContext(DashboardContext);
  if (existing) return <>{children}</>;

  return <DashboardProviderInner enableLeadsQuery={false}>{children}</DashboardProviderInner>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
