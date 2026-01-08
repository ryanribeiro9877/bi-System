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
          <CardTitle className="text-lg font-semibold text-foreground">Top 10 CBOs por Reprovação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações com maior número de reprovações
          </p>
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
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground w-12">#</TableHead>
                    <TableHead className="text-muted-foreground">CBO</TableHead>
                    <TableHead className="text-right text-muted-foreground">Reprovações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.reprovacoesPorCBO.slice(0, 10).map((c, index) => (
                    <TableRow key={c.cbo} className="border-border">
                      <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="text-foreground font-medium">{c.cbo}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                          {c.quantidade.toLocaleString("pt-BR")}
                        </span>
                      </TableCell>
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
