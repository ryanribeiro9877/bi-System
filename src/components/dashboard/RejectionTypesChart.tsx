import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "CBO Bloqueado", value: 80 },
  { name: "Margem Indisponível", value: 60 },
  { name: "Tempo de Vínculo < 6 meses", value: 60 },
  { name: "Vínculo Encerrado", value: 40 },
  { name: "Porte Empresa (ME)", value: 40 },
  { name: "Excesso de Contratos", value: 20 },
  { name: "Empréstimo Legado", value: 20 },
  { name: "Requisitos da Empresa", value: 20 },
];

const getBarColor = (value: number) => {
  if (value >= 70) return "hsl(var(--success))";
  if (value >= 50) return "hsl(142 71% 55%)";
  if (value >= 30) return "hsl(var(--warning))";
  return "hsl(25 95% 53%)";
};

const RejectionTypesChart = () => {
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
            <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number) => [`${value}%`, "Ocorrência"]}
            />
            <ReferenceLine y={50} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: "50% (Alta Frequência)", fill: "hsl(var(--destructive))", fontSize: 10 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RejectionTypesChart;
