// Consultas page - force refresh v2
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { Loader2 } from "lucide-react";

const ConsultasInner = () => {
  const { filters, setFilters, isLoading: dataLoading } = useDashboard();

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8 overflow-auto w-full min-w-0">
        {/* Header */}
        <div className="mb-4 lg:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-1 lg:mb-2">
            Consultas
          </h1>
          <p className="text-sm lg:text-base text-muted-foreground">
            BI de Consultas - Análise de CLT
          </p>
        </div>

        {/* Filters */}
        <DashboardFilters filters={filters} onFiltersChange={setFilters} />

        {/* Loading indicator */}
        {dataLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Carregando dados...</span>
          </div>
        )}

        {/* Tabbed Panels */}
        {!dataLoading && <DashboardTabs />}
      </main>
    </div>
  );
};

const Consultas = () => {
  // Garantia: caso esta página seja renderizada fora do wrapper de rotas,
  // ela ainda monta o Provider (sem duplicar se já existir acima).
  return (
    <DashboardProvider>
      <ConsultasInner />
    </DashboardProvider>
  );
};

export default Consultas;
