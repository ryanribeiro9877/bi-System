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
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-base lg:text-lg font-semibold text-foreground">
            Taxa por Status e Banco
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] lg:h-[300px] p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="p-4 lg:p-6">
        <CardTitle className="text-base lg:text-lg font-semibold text-foreground">
          Taxa por Status e Banco
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
        <ResponsiveContainer width="100%" height={250} className="lg:!h-[300px]">
          <BarChart data={data} layout="vertical" margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={70} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value}%`]}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
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
