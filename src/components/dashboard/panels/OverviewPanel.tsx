import { Users, TrendingDown, Building2, AlertTriangle, FileX } from "lucide-react";
import KPICard from "../KPICard";
import BankApprovalChart from "../BankApprovalChart";
import CBOsPieChart from "../CBOsPieChart";
import RejectionTypesChart from "../RejectionTypesChart";

const OverviewPanel = () => {
  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
