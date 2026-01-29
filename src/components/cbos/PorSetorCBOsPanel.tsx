import { Layers, Upload, DollarSign, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { agruparCBOsPorSetor, CBOPorSetor } from "@/lib/cboSetorMapping";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const PorSetorCBOsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  // Usar CBOs bloqueados já calculados nas estatísticas
  const cbosBloqueados = useMemo(() => {
    return stats.cbosBloqueados.map(cbo => ({
      code: cbo.code,
      name: cbo.name || "",
      count: cbo.quantidade,
      margemPerdida: (cbo as any).margemPerdida || (cbo as any).margem_perdida || 0,
    }));
  }, [stats.cbosBloqueados]);

  // Calcular margem total perdida
  const totalMargemPerdida = useMemo(() => {
    return cbosBloqueados.reduce((acc, cbo) => acc + (cbo.margemPerdida || 0), 0);
  }, [cbosBloqueados]);

  // Agrupar por setor
  const cbosPorSetor = useMemo(() => {
    return agruparCBOsPorSetor(cbosBloqueados);
  }, [cbosBloqueados]);

  // Dados para o gráfico de pizza
  const chartData = useMemo(() => {
    return cbosPorSetor.map(setor => ({
      name: setor.setorNome,
      value: setor.totalLeads,
      color: setor.cor,
      cbos: setor.cbos,
      margemPerdida: setor.margemTotalPerdida,
    }));
  }, [cbosPorSetor]);

  // Dados para o gráfico de barras (Top 10 setores)
  const barChartData = useMemo(() => {
    return cbosPorSetor.slice(0, 10).map(setor => ({
      name: setor.setorNome.length > 15 ? setor.setorNome.slice(0, 12) + "..." : setor.setorNome,
      fullName: setor.setorNome,
      leads: setor.totalLeads,
      profissoes: setor.cbos.length,
      color: setor.cor,
    }));
  }, [cbosPorSetor]);

  const totalLeadsAfetados = useMemo(() => {
    return cbosPorSetor.reduce((acc, setor) => acc + setor.totalLeads, 0);
  }, [cbosPorSetor]);

  const totalProfissoesBloqueadas = useMemo(() => {
    return cbosPorSetor.reduce((acc, setor) => acc + setor.cbos.length, 0);
  }, [cbosPorSetor]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">CBOs por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum setor identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar CBOs por setor.
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

  if (cbosBloqueados.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-purple-400" />
            CBOs por Setor de Atuação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum CBO bloqueado encontrado
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Os leads importados não possuem CBOs bloqueados ou as informações de bloqueio não estão disponíveis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; cbos: Array<unknown>; margemPerdida?: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} leads ({((data.value / totalLeadsAfetados) * 100).toFixed(1)}%)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.cbos.length} profissões bloqueadas
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPIs Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Setores Afetados</p>
                <p className="text-xl font-bold text-foreground">{cbosPorSetor.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profissões Bloqueadas</p>
                <p className="text-xl font-bold text-foreground">{totalProfissoesBloqueadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <TrendingDown className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leads Bloqueados</p>
                <p className="text-xl font-bold text-foreground">{totalLeadsAfetados.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem Perdida Total</p>
                <p className="text-xl font-bold text-amber-400">
                  {totalMargemPerdida > 0 ? formatCurrency(totalMargemPerdida) : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="w-5 h-5 text-purple-400" />
              Distribuição por Setor
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Agrupamento de profissões bloqueadas por área de atuação
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Ranking de Setores
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Setores com mais leads bloqueados
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground">{data.fullName}</p>
                            <p className="text-sm text-red-400">{data.leads} leads bloqueados</p>
                            <p className="text-xs text-muted-foreground">{data.profissoes} profissões</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela resumo por setor */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resumo por Setor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visão geral de todos os setores com CBOs bloqueados
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Setor</TableHead>
                  <TableHead className="text-muted-foreground text-center">Profissões</TableHead>
                  <TableHead className="text-muted-foreground text-center">Leads Bloqueados</TableHead>
                  <TableHead className="text-muted-foreground text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cbosPorSetor.map((setor) => (
                  <TableRow key={setor.setor} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: setor.cor }}
                        />
                        <span className="font-medium text-foreground">{setor.setorNome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {setor.cbos.length}
                    </TableCell>
                    <TableCell className="text-center font-medium text-foreground">
                      {setor.totalLeads.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {((setor.totalLeads / totalLeadsAfetados) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento por setor com accordion */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Detalhamento por Setor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clique em um setor para ver as profissões bloqueadas
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {cbosPorSetor.map((setor) => (
              <AccordionItem key={setor.setor} value={setor.setor}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: setor.cor }}
                    />
                    <span className="font-medium text-foreground">{setor.setorNome}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({setor.cbos.length} profissões • {setor.totalLeads} leads)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-6 space-y-2">
                    {setor.cbos.map((cbo) => (
                      <div 
                        key={cbo.code} 
                        className="flex justify-between items-center p-2 rounded bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{cbo.code}</span>
                          <span className="text-sm text-foreground">{cbo.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {cbo.margemPerdida > 0 && (
                            <span className="text-xs text-amber-400">
                              {formatCurrency(cbo.margemPerdida)}
                            </span>
                          )}
                          <span className="text-sm font-medium text-red-400">
                            {cbo.count} bloqueios
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default PorSetorCBOsPanel;
