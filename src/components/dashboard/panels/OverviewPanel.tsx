import { useState, memo } from "react";
import { Users, TrendingDown, Building2, AlertTriangle, FileX, TrendingUp, Maximize2 } from "lucide-react";
import KPICard from "../KPICard";
import BankApprovalChart from "../BankApprovalChart";
import CBOsPieChart from "../CBOsPieChart";
import RejectionTypesChart from "../RejectionTypesChart";
import { useDashboard } from "@/contexts/DashboardContext";
import { SkeletonDashboard } from "@/components/ui/skeleton-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Memoized KPI Grid
const KPIGrid = memo(({ stats, onExpandMotivo }: { stats: any; onExpandMotivo: () => void }) => (
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
      expandable
      onExpand={onExpandMotivo}
    />
    <KPICard
      title="Banco com Maior Reprovação"
      value={stats.bancoMaiorReprovacao}
      subtitle={stats.bancoMaiorReprovacaoPercentual > 0 ? `${stats.bancoMaiorReprovacaoPercentual}% de reprovação` : undefined}
      icon={Building2}
      variant="danger"
    />
  </div>
));

KPIGrid.displayName = "KPIGrid";

// Memoized Secondary KPIs
const SecondaryKPIs = memo(({ stats }: { stats: any }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <KPICard
      title="CBOs Bloqueados Identificados"
      value={stats.cbosBloqueados.length.toString()}
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
));

SecondaryKPIs.displayName = "SecondaryKPIs";

// Memoized Charts Grid
const ChartsGrid = memo(() => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <BankApprovalChart />
    <CBOsPieChart />
  </div>
));

ChartsGrid.displayName = "ChartsGrid";

const OverviewPanel = () => {
  const { stats, isLoading } = useDashboard();
  const [motivoDialogOpen, setMotivoDialogOpen] = useState(false);

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <KPIGrid stats={stats} onExpandMotivo={() => setMotivoDialogOpen(true)} />

      {/* Dialog para motivo completo */}
      <Dialog open={motivoDialogOpen} onOpenChange={setMotivoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Principal Motivo de Reprovação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Motivo Resumido</p>
              <p className="text-lg font-semibold text-foreground">{stats.principalMotivo}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Mensagem Completa</p>
              <p className="text-foreground break-words">{stats.principalMotivoCompleto}</p>
            </div>
            {stats.principalMotivoPercentual > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Este motivo representa <span className="text-warning font-semibold">{stats.principalMotivoPercentual}%</span> das reprovações
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Secondary KPIs */}
      <SecondaryKPIs stats={stats} />

      {/* Charts Grid */}
      <ChartsGrid />

      {/* Full Width Chart */}
      <RejectionTypesChart />
    </div>
  );
};

export default memo(OverviewPanel);
