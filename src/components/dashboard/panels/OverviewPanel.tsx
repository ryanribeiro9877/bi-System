import { Users, Building2 } from "lucide-react";
import KPICard from "../KPICard";
import BankApprovalChart from "../BankApprovalChart";
import CBOsPieChart from "../CBOsPieChart";
import { useDashboard } from "@/contexts/DashboardContext";

const OverviewPanel = () => {
  const { stats, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(1)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <KPICard
          title="Total de Consultas Realizadas"
          value={stats.totalLeads.toLocaleString("pt-BR")}
          icon={Users}
          variant="default"
        />
        <KPICard
          title="Banco com Maior Reprovação"
          value={stats.bancoMaiorReprovacao}
          subtitle={stats.bancoMaiorReprovacaoPercentual > 0 ? `${stats.bancoMaiorReprovacaoPercentual}% de reprovação` : undefined}
          icon={Building2}
          variant="danger"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
        <BankApprovalChart />
        <CBOsPieChart />
      </div>
    </div>
  );
};

export default OverviewPanel;
