import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

const getBarColor = (value: number, max: number) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  if (percentage >= 70) return "hsl(var(--destructive))";
  if (percentage >= 50) return "hsl(var(--warning))";
  if (percentage >= 30) return "hsl(25 95% 53%)";
  return "hsl(var(--success))";
};

const RejectionTypesChart = () => {
  const { stats } = useDashboard();

  const maxValue = Math.max(...stats.reprovacoesPorTipo.map(item => item.quantidade), 1);
  
  const data = stats.reprovacoesPorTipo.slice(0, 8).map(item => ({
    name: item.tipo,
    value: item.quantidade,
    fullName: item.tipoCompleto || item.tipo,
  }));

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Tipos de Reprovação - Análise de Leads CLT
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Tipos de Reprovação - Análise de Leads CLT
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="horizontal" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={100} fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
                maxWidth: "320px",
                whiteSpace: "normal",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
              labelStyle={{ 
                color: "hsl(var(--foreground))", 
                fontWeight: "bold", 
                marginBottom: "4px",
                whiteSpace: "normal",
                wordWrap: "break-word",
                display: "block",
                lineHeight: "1.4",
              }}
              itemStyle={{ color: "hsl(var(--muted-foreground))" }}
              labelFormatter={(label: string, payload: any[]) => {
                const item = payload?.[0]?.payload;
                return item?.fullName || label;
              }}
              formatter={(value: number) => [value, "Quantidade"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.value, maxValue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RejectionTypesChart;
