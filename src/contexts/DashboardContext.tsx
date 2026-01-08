// DashboardContext - v3 - Persistent state with auth-aware loading
import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { useLeadsData, DashboardStats, Lead, FilterState } from "@/hooks/useLeadsData";
import { useAuth } from "@/hooks/useAuth";

interface DashboardContextType {
  leads: Lead[];
  stats: DashboardStats;
  filterOptions: {
    bancos: string[];
    tiposReprovacao: string[];
    statuses: string[];
    cbos: string[];
  };
  isLoading: boolean;
  error: string | null;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  refetch: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    dataInicial: undefined,
    dataFinal: undefined,
    banco: "",
    tipoReprovacao: "",
    tiposReprovacaoMultiplos: [],
    status: "",
    cpf: "",
  });
  
  // Só passa filtros para o hook quando o usuário está autenticado
  const { leads, stats, filterOptions, isLoading: dataLoading, error, refetch } = useLeadsData(
    user ? filters : undefined,
    !authLoading && !!user // enabled: só busca quando auth está pronto e tem usuário
  );

  // Reidrata dados quando usuário faz login
  useEffect(() => {
    if (user && !authLoading) {
      console.log('[DashboardContext] Usuário autenticado, reidratando dados...');
      refetch();
    }
  }, [user, authLoading]);

  // Combinação de loading states
  const isLoading = authLoading || dataLoading;

  return (
    <DashboardContext.Provider
      value={{
        leads,
        stats,
        filterOptions,
        isLoading,
        error,
        filters,
        setFilters,
        refetch,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};
