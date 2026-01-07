import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { useAuth } from "@/hooks/useAuth";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { Loader2 } from "lucide-react";

const DashboardContent = () => {
  const { filters, setFilters, isLoading: dataLoading } = useDashboard();

  return (
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
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <DashboardContent />
      </div>
    </DashboardProvider>
  );
};

export default Dashboard;
