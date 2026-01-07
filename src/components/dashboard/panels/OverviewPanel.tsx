import { Users, TrendingDown, Building2, AlertTriangle, FileX, TrendingUp } from "lucide-react";
import KPICard from "../KPICard";
import BankApprovalChart from "../BankApprovalChart";
import CBOsPieChart from "../CBOsPieChart";
import RejectionTypesChart from "../RejectionTypesChart";
import { useDashboard } from "@/contexts/DashboardContext";

const OverviewPanel = () => {
  const { stats, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total de Leads Analisados"
          value={stats.totalLeads.toLocaleString("pt-BR")}
          icon={Users}
          variant="default"
        />
        <KPICard
          title="Taxa de Reprovação Geral"
          value={`${stats.taxaReprovacao}%`}
          icon={TrendingDown}
          variant={stats.taxaReprovacao > 50 ? "danger" : stats.taxaReprovacao > 30 ? "warning" : "success"}
        />
        <KPICard
          title="Principal Motivo"
          value={stats.principalMotivo}
          subtitle={stats.principalMotivoPercentual > 0 ? `${stats.principalMotivoPercentual}% das reprovações` : undefined}
          icon={AlertTriangle}
          variant="warning"
        />
        <KPICard
          title="Banco com Maior Reprovação"
          value={stats.bancoMaiorReprovacao}
          subtitle={stats.bancoMaiorReprovacaoPercentual > 0 ? `${stats.bancoMaiorReprovacaoPercentual}% de reprovação` : undefined}
          icon={Building2}
          variant="danger"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="CBOs Bloqueados Identificados"
          value={stats.cbosUnicos.toString()}
          icon={FileX}
          variant="warning"
        />
        <KPICard
          title="Tipos de Reprovação"
          value={stats.tiposReprovacaoUnicos.toString()}
          icon={AlertTriangle}
          variant="default"
        />
        <KPICard
          title="Taxa de Aprovação"
          value={`${stats.taxaAprovacao}%`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BankApprovalChart />
        <CBOsPieChart />
      </div>

      {/* Full Width Chart */}
      <RejectionTypesChart />
    </div>
  );
};

export default OverviewPanel;
