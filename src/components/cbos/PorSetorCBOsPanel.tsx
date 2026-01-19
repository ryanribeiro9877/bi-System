import { Layers, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { agruparCBOsPorSetor, CBOPorSetor } from "@/lib/cboSetorMapping";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PorSetorCBOsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  // Usar CBOs bloqueados já calculados nas estatísticas
  const cbosBloqueados = useMemo(() => {
    return stats.cbosBloqueados.map(cbo => ({
      code: cbo.code,
      name: cbo.name || "",
      count: cbo.quantidade,
    }));
  }, [stats.cbosBloqueados]);

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
    }));
  }, [cbosPorSetor]);

  const totalLeadsAfetados = useMemo(() => {
    return cbosPorSetor.reduce((acc, setor) => acc + setor.totalLeads, 0);
  }, [cbosPorSetor]);

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

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; cbos: Array<unknown> } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} leads ({((data.value / totalLeadsAfetados) * 100).toFixed(1)}%)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.cbos.length} profissões
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Gráfico de Pizza */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-purple-400" />
            Distribuição de CBOs Bloqueados por Setor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Agrupamento de profissões bloqueadas por área de atuação
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => 
                    percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
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
                    <span className="text-sm text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada por setor */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Detalhamento por Setor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clique em um setor para ver as profissões incluídas
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Setor</TableHead>
                  <TableHead className="text-muted-foreground text-center">Profissões</TableHead>
                  <TableHead className="text-muted-foreground text-center">Leads Afetados</TableHead>
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

      {/* Lista de profissões por setor */}
      <div className="grid gap-4 md:grid-cols-2">
        {cbosPorSetor.slice(0, 6).map((setor) => (
          <Card key={setor.setor} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: setor.cor }}
                />
                {setor.setorNome}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {setor.totalLeads} leads afetados
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {setor.cbos.slice(0, 10).map((cbo) => (
                  <li key={cbo.code} className="text-sm flex justify-between">
                    <span className="text-muted-foreground truncate mr-2">
                      {cbo.code} - {cbo.name}
                    </span>
                    <span className="text-foreground font-medium shrink-0">
                      {cbo.count}
                    </span>
                  </li>
                ))}
                {setor.cbos.length > 10 && (
                  <li className="text-xs text-muted-foreground italic">
                    +{setor.cbos.length - 10} outras profissões
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PorSetorCBOsPanel;
