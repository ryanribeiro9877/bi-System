import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

const BankApprovalChart = () => {
  const { stats } = useDashboard();

  const data = stats.reprovacoesPorBanco.slice(0, 5).map(item => ({
    name: item.banco,
    aprovado: item.total > 0 ? Math.round((item.aprovados / item.total) * 100) : 0,
    reprovado: item.total > 0 ? Math.round((item.reprovados / item.total) * 100) : 0,
    pendente: item.total > 0 ? Math.round(((item.pendentes || 0) / item.total) * 100) : 0,
  }));

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Taxa por Status e Banco
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
          Taxa por Status e Banco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={100} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [`${value}%`]}
            />
            <Legend />
            <Bar dataKey="aprovado" stackId="a" fill="hsl(var(--success))" name="Aprovado" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pendente" stackId="a" fill="hsl(var(--warning))" name="Pendente" radius={[0, 0, 0, 0]} />
            <Bar dataKey="reprovado" stackId="a" fill="hsl(var(--destructive))" name="Reprovado" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default BankApprovalChart;
