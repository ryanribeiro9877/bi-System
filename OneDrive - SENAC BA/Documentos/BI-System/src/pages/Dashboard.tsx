// Dashboard page - force refresh v2
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { Loader2 } from "lucide-react";

const DashboardInner = () => {
  const { filters, setFilters, isLoading: dataLoading } = useDashboard();

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard Executivo
          </h1>
          <p className="text-muted-foreground">
            BI de Reprovações - Análise de Leads CLT
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

const Dashboard = () => {
  // Garantia: caso esta página seja renderizada fora do wrapper de rotas,
  // ela ainda monta o Provider (sem duplicar se já existir acima).
  return (
    <DashboardProvider>
      <DashboardInner />
    </DashboardProvider>
  );
};

export default Dashboard;
