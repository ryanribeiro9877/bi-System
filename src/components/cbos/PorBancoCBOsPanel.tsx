import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const PorBancoCBOsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">CBOs por Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar CBOs bloqueados por banco.
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

  const chartData = stats.reprovacoesPorBanco.slice(0, 8).map((b) => ({
    name: b.banco,
    aprovados: b.aprovados,
    reprovados: b.reprovados,
    pendentes: b.total - b.aprovados - b.reprovados,
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            Aprovação/Reprovação por Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="aprovados" fill="#22c55e" name="Aprovados" stackId="a" />
                <Bar dataKey="reprovados" fill="#ef4444" name="Reprovados" stackId="a" />
                <Bar dataKey="pendentes" fill="#fbbf24" name="Pendentes" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Ranking de Bancos</CardTitle>
        </CardHeader>
        <CardContent>
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
              {stats.reprovacoesPorBanco.map((b) => (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default PorBancoCBOsPanel;
