// Dashboard page - force refresh v3
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { useDashboard } from "@/contexts/DashboardContext";
import { SkeletonDashboard } from "@/components/ui/skeleton-card";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { filters, setFilters, isLoading: dataLoading, stats } = useDashboard();

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

        {/* Filters - sempre visíveis */}
        <DashboardFilters filters={filters} onFiltersChange={setFilters} />

        {/* Loading state com skeletons */}
        {dataLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-muted-foreground">Carregando dados do banco...</span>
            </div>
            <SkeletonDashboard />
          </div>
        )}

        {/* Tabbed Panels - só mostra quando carregou */}
        {!dataLoading && <DashboardTabs />}
      </main>
    </div>
  );
};

export default Dashboard;
