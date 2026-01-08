import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-3))",
  "hsl(142 71% 55%)",
];

const CBOsPieChart = memo(() => {
  const { stats } = useDashboard();

  const data = useMemo(() => {
    const totalReprovacoes = stats.reprovacoesPorCBO.reduce((acc, item) => acc + item.quantidade, 0);
    return stats.reprovacoesPorCBO.slice(0, 6).map(item => ({
      name: item.cbo,
      value: totalReprovacoes > 0 ? Math.round((item.quantidade / totalReprovacoes) * 100 * 10) / 10 : 0,
    }));
  }, [stats.reprovacoesPorCBO]);

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Distribuição de CBOs Bloqueados
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
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
              formatter={(value: number) => [`${value}%`]}
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
