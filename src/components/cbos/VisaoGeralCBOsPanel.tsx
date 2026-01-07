import { AlertTriangle, TrendingDown, Ban, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/contexts/DashboardContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";

const VisaoGeralCBOsPanel = () => {
  const { stats } = useDashboard();
  const navigate = useNavigate();

  if (stats.totalLeads === 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Visão Geral de CBOs Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center">
              <AlertTriangle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO identificado</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Importe seus leads para identificar CBOs bloqueados.
              </p>
              <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
                <Upload className="w-4 h-4" />
                Ir para Importações
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasCBOs = stats.reprovacoesPorCBO.length > 0;
  const totalReprovacoes = stats.leadsReprovados;
  const cbosUnicosCount = stats.cbosUnicos;

  const chartData = stats.reprovacoesPorCBO.slice(0, 10).map((c) => ({
    name: c.cbo.length > 20 ? c.cbo.slice(0, 20) + "…" : c.cbo,
    reprovações: c.quantidade,
    percentual: totalReprovacoes > 0 ? Math.round((c.quantidade / totalReprovacoes) * 100) : 0,
  }));

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">CBOs Únicos (reprovados)</p>
            <p className="text-2xl font-bold text-foreground">{cbosUnicosCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total de Reprovações</p>
            <p className="text-2xl font-bold text-foreground">{totalReprovacoes.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">% Leads Reprovados</p>
            <p className="text-2xl font-bold text-foreground">{stats.taxaReprovacao}%</p>
          </CardContent>
        </Card>
      </div>

      {hasCBOs ? (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="w-5 h-5 text-red-400" />
                Top 10 CBOs com Maior Reprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartData} margin={{ left: 10 }}>
                    <XAxis type="number" tickFormatter={(v) => `${v}`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`${v} reprovações`, "Qtd"]} />
                    <Bar dataKey="reprovações" radius={4}>
                      {chartData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ban className="w-5 h-5 text-red-400" />
                Lista de CBOs por Reprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CBO</TableHead>
                    <TableHead className="text-right">Reprovações</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.reprovacoesPorCBO.slice(0, 15).map((c) => (
                    <TableRow key={c.cbo}>
                      <TableCell className="text-foreground">{c.cbo}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.quantidade.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-foreground">
                        {totalReprovacoes > 0 ? ((c.quantidade / totalReprovacoes) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum CBO identificado nos dados
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O campo CBO não está preenchido nos leads importados. Adicione a coluna "CBO" na planilha de importação.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VisaoGeralCBOsPanel;
