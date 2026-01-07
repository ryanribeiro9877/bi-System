import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "UY3", aprovado: 20, reprovado: 80 },
  { name: "Presença", aprovado: 25, reprovado: 75 },
  { name: "V8", aprovado: 22, reprovado: 78 },
];

const BankApprovalChart = () => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Taxa de Aprovação/Reprovação por Banco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={80} />
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
            <Bar dataKey="reprovado" stackId="a" fill="hsl(var(--destructive))" name="Reprovado" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default BankApprovalChart;
