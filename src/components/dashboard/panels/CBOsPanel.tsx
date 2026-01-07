import { Briefcase, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import CBOsPieChart from "@/components/dashboard/CBOsPieChart";

const CBOsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  if (stats.totalLeads === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Análise de CBOs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO analisado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar CBOs bloqueados e visualizar estatísticas por ocupação.
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

  const hasCboData = stats.reprovacoesPorCBO.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CBOsPieChart />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Top CBOs por Reprovação</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasCboData ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                Nenhum CBO foi identificado nos dados importados (campo CBO está vazio). Para habilitar essa análise,
                inclua a coluna CBO na planilha.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CBO</TableHead>
                    <TableHead className="text-right">Reprovações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.reprovacoesPorCBO.slice(0, 20).map((c) => (
                    <TableRow key={c.cbo}>
                      <TableCell className="text-foreground">{c.cbo}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.quantidade.toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsPanel;
