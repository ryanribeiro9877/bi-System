import { FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";

const LeadsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  if (stats.totalLeads === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Leads (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lead importado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus dados de leads CLT para visualizar análises detalhadas, taxas e estatísticas.
            </p>
            <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
              <Upload className="w-4 h-4" />
              Ir para Importações
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">
          Leads ({stats.totalLeads.toLocaleString("pt-BR")})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Aprovados: {stats.leadsAprovados.toLocaleString("pt-BR")}</Badge>
          <Badge variant="secondary">Reprovados: {stats.leadsReprovados.toLocaleString("pt-BR")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Taxa de aprovação</p>
            <p className="text-2xl font-semibold text-foreground">{stats.taxaAprovacao}%</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Taxa de reprovação</p>
            <p className="text-2xl font-semibold text-foreground">{stats.taxaReprovacao}%</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Principal motivo</p>
            <p className="text-foreground font-medium truncate">{stats.principalMotivo}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate("/dashboard/leads")}>Ver Leads</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadsPanel;
