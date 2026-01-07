import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, TrendingDown, Building2, AlertTriangle, FileX } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import KPICard from "@/components/dashboard/KPICard";
import BankApprovalChart from "@/components/dashboard/BankApprovalChart";
import CBOsPieChart from "@/components/dashboard/CBOsPieChart";
import RejectionTypesChart from "@/components/dashboard/RejectionTypesChart";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard Executivo
          </h1>
          <p className="text-muted-foreground">
            BI de Reprovações - Análise de Leads CLT
          </p>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total de Leads Analisados"
            value="147"
            icon={Users}
            variant="default"
          />
          <KPICard
            title="Taxa de Reprovação Geral"
            value="78%"
            icon={TrendingDown}
            variant="danger"
          />
          <KPICard
            title="Principal Motivo"
            value="CBO Bloqueado"
            subtitle="80% das reprovações"
            icon={AlertTriangle}
            variant="warning"
          />
          <KPICard
            title="Banco com Maior Reprovação"
            value="UY3"
            subtitle="80% de reprovação"
            icon={Building2}
            variant="danger"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <KPICard
            title="CBOs Bloqueados Identificados"
            value="6"
            icon={FileX}
            variant="warning"
          />
          <KPICard
            title="Tipos de Reprovação"
            value="9"
            icon={AlertTriangle}
            variant="default"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BankApprovalChart />
          <CBOsPieChart />
        </div>

        {/* Full Width Chart */}
        <RejectionTypesChart />
      </main>
    </div>
  );
};

export default Dashboard;
