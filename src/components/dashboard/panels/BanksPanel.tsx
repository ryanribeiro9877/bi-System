import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import BankApprovalChart from "@/components/dashboard/BankApprovalChart";

const BanksPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  if (stats.totalLeads === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Análise por Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar comparativos de aprovação e reprovação entre bancos.
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
    <div className="space-y-6">
      <BankApprovalChart />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Ranking por Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">Reprovados</TableHead>
                  <TableHead className="text-right">% Reprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.reprovacoesPorBanco.slice(0, 12).map((b) => (
                  <TableRow key={b.banco}>
                    <TableCell className="font-medium text-foreground">{b.banco}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.total.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.aprovados.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.reprovados.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-foreground">{b.taxaReprovacao}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BanksPanel;
