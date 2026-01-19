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

  // Usar dados de CBOs bloqueados extraídos das mensagens de erro
  const hasCBOsBloqueados = stats.cbosBloqueados.length > 0;
  const totalCBOsBloqueados = stats.totalCBOsBloqueados;
  const cbosUnicosBloqueados = stats.cbosBloqueados.length;

  // Dados para o gráfico - Top 10 CBOs bloqueados
  const chartData = stats.cbosBloqueados.slice(0, 10).map((c) => ({
    name: c.name 
      ? (c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name) 
      : c.code,
    code: c.code,
    reprovações: c.quantidade,
    percentual: totalCBOsBloqueados > 0 ? Math.round((c.quantidade / totalCBOsBloqueados) * 100) : 0,
  }));

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e"];

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">CBOs Bloqueados Únicos</p>
            <p className="text-2xl font-bold text-foreground">{cbosUnicosBloqueados}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total de Leads Bloqueados por CBO</p>
            <p className="text-2xl font-bold text-foreground">{totalCBOsBloqueados.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">% do Total de Reprovações</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.leadsReprovados > 0 
                ? ((totalCBOsBloqueados / stats.leadsReprovados) * 100).toFixed(1) 
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {hasCBOsBloqueados ? (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="w-5 h-5 text-red-400" />
                Top 10 CBOs Bloqueados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartData} margin={{ left: 10 }}>
                    <XAxis type="number" tickFormatter={(v) => `${v}`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(v) => [`${v} leads bloqueados`, "Qtd"]} 
                      labelFormatter={(label) => {
                        const item = chartData.find(c => c.name === label);
                        return item ? `CBO ${item.code}: ${item.name}` : label;
                      }}
                    />
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
                Lista de CBOs Bloqueados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Leads Bloqueados</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.cbosBloqueados.slice(0, 15).map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="text-foreground font-mono">{c.code}</TableCell>
                      <TableCell className="text-foreground">{c.name || "-"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.quantidade.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-foreground">
                        {totalCBOsBloqueados > 0 ? ((c.quantidade / totalCBOsBloqueados) * 100).toFixed(1) : 0}%
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
              Nenhum CBO bloqueado identificado
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Não foram encontradas mensagens de erro com o padrão "CBO bloqueado" nos leads importados.
              Verifique se os dados possuem esse tipo de reprovação.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VisaoGeralCBOsPanel;