import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";
import { extrairCBO, extrairTodosDados } from "@/lib/leadDataExtractor";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-3))",
  "hsl(142 71% 55%)",
];

const CBOsPieChart = memo(() => {
  const { leads } = useDashboard();

  const data = useMemo(() => {
    // Agrupa CBOs bloqueados (leads reprovados com CBO identificado)
    const cboCount: Record<string, { descricao: string; quantidade: number }> = {};
    
    leads.forEach(lead => {
      const dados = extrairTodosDados(lead);
      
      // Só conta CBOs de leads reprovados
      if (dados.statusNormalizado !== "reprovado") return;
      
      const cbo = extrairCBO(lead);
      if (!cbo || (!cbo.codigo && !cbo.descricao)) return;
      
      const key = cbo.codigo || cbo.descricao;
      const descricao = cbo.descricao || cbo.codigo;
      
      if (!cboCount[key]) {
        cboCount[key] = { descricao, quantidade: 0 };
      }
      cboCount[key].quantidade++;
    });
    
    const sorted = Object.values(cboCount)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6);
    
    const total = sorted.reduce((acc, item) => acc + item.quantidade, 0);
    
    return sorted.map(item => ({
      name: item.descricao.length > 30 ? item.descricao.substring(0, 27) + "..." : item.descricao,
      value: total > 0 ? Math.round((item.quantidade / total) * 100 * 10) / 10 : 0,
      count: item.quantidade,
    }));
  }, [leads]);

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Distribuição de CBOs Bloqueados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Nenhum CBO bloqueado identificado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Distribuição de CBOs Bloqueados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={40}
              paddingAngle={2}
              dataKey="value"
              label={({ value }) => `${value}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number, name: string, entry: any) => [
                `${value}% (${entry.payload.count} leads)`,
                name
              ]}
            />
            <Legend
              formatter={(value) => <span className="text-foreground text-xs">{value}</span>}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

CBOsPieChart.displayName = "CBOsPieChart";

export default CBOsPieChart;
