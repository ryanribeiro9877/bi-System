import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardFilters, { FilterState } from "@/components/dashboard/DashboardFilters";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { useAuth } from "@/hooks/useAuth";

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

  const [filters, setFilters] = useState<FilterState>({
    dataInicial: undefined,
    dataFinal: undefined,
    banco: "",
    tipoReprovacao: "",
    status: "",
    cpf: "",
  });

  if (!user) {
    return null;
  }

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

        {/* Tabbed Panels */}
        <DashboardTabs />
      </main>
    </div>
  );
};

export default Dashboard;
