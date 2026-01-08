import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { agruparCBOsPorSetor } from "@/lib/cboSetorMapping";
import { Layers } from "lucide-react";

const CBOsPieChart = () => {
  const { leads } = useDashboard();

  // Extrair CBOs bloqueados dos leads (mesma lógica do PorSetorCBOsPanel)
  const cbosBloqueados = useMemo(() => {
    const cboMap: Record<string, { code: string; name: string; count: number }> = {};
    
    leads.forEach(lead => {
      const code = (lead as any).cbo_block_code;
      const name = (lead as any).cbo_block_name;
      
      if (code && name) {
        const key = code;
        if (!cboMap[key]) {
          cboMap[key] = { code, name, count: 0 };
        }
        cboMap[key].count++;
      }
    });
    
    return Object.values(cboMap).sort((a, b) => b.count - a.count);
  }, [leads]);

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

  const CustomTooltip = ({ active, payload }: any) => {
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Layers className="w-5 h-5 text-purple-400" />
            Distribuição de CBOs Bloqueados por Setor
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Nenhum CBO bloqueado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Layers className="w-5 h-5 text-purple-400" />
          Distribuição de CBOs Bloqueados por Setor
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Agrupamento de profissões bloqueadas por área de atuação
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={40}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
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
              formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CBOsPieChart;
