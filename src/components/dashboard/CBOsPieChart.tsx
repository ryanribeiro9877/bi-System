import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { agruparCBOsPorSetor } from "@/lib/cboSetorMapping";
import { Layers } from "lucide-react";

const CBOsPieChart = () => {
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

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; cbos: Array<unknown> } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} leads ({totalLeadsAfetados > 0 ? ((data.value / totalLeadsAfetados) * 100).toFixed(1) : 0}%)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.cbos.length} profissões
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="flex items-center gap-2 text-base lg:text-lg font-semibold text-foreground">
            <Layers className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400 flex-shrink-0" />
            <span className="line-clamp-2">Distribuição de CBOs Bloqueados por Setor</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] lg:h-[300px] p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">Nenhum CBO bloqueado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="p-4 lg:p-6">
        <CardTitle className="flex items-center gap-2 text-base lg:text-lg font-semibold text-foreground">
          <Layers className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400 flex-shrink-0" />
          <span className="line-clamp-2">CBOs Bloqueados por Setor</span>
        </CardTitle>
        <p className="text-xs lg:text-sm text-muted-foreground mt-1">
          Profissões bloqueadas por área
        </p>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
        <ResponsiveContainer width="100%" height={250} className="lg:!h-[300px]">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={70}
              innerRadius={30}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={({ percent }) => 
                percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ''
              }
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => <span className="text-foreground text-[10px] lg:text-xs">{value}</span>}
              wrapperStyle={{ fontSize: "10px" }}
              layout="horizontal"
              verticalAlign="bottom"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CBOsPieChart;
