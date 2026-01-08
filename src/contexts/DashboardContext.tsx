import { createContext, useContext, ReactNode, useState } from "react";
import { useLeadsData, DashboardStats, Lead, FilterState } from "@/hooks/useLeadsData";

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
  const [filters, setFilters] = useState<FilterState>({
    dataInicial: undefined,
    dataFinal: undefined,
    banco: "",
    tipoReprovacao: "",
    tiposReprovacaoMultiplos: [],
    status: "",
    cpf: "",
  });
  const { leads, stats, filterOptions, isLoading, error, refetch } = useLeadsData(filters);

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
