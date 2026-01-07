import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const approvalData = [
  { name: "UY3", aprovado: 150, reprovado: 450 },
  { name: "PRESENÇA", aprovado: 200, reprovado: 400 },
  { name: "V8", aprovado: 180, reprovado: 420 },
];

const distributionData = [
  { name: "UY3", value: 33 },
  { name: "PRESENÇA", value: 33 },
  { name: "V8", value: 34 },
];

const matrixData = [
  { tipo: "CBO Bloqueado", UY3: 85, Presença: 80, V8: 82 },
  { tipo: "Margem Indisponível", UY3: 65, Presença: 60, V8: 58 },
  { tipo: "Tempo de Vínculo", UY3: 55, Presença: 58, V8: 52 },
  { tipo: "Porte Empresa (ME)", UY3: 40, Presença: 38, V8: 42 },
  { tipo: "Vínculo Encerrado", UY3: 35, Presença: 32, V8: 38 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

const getHeatmapColor = (value: number) => {
  if (value >= 80) return "bg-red-600";
  if (value >= 60) return "bg-red-500";
  if (value >= 40) return "bg-red-400";
  return "bg-red-300";
};

const BanksPanel = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aprovação vs Reprovação por Banco */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Aprovação vs Reprovação por Banco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={approvalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="aprovado" stackId="a" fill="hsl(var(--success))" name="Aprovado" />
                <Bar dataKey="reprovado" stackId="a" fill="hsl(var(--destructive))" name="Reprovado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Banco */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Distribuição por Banco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={true}
                >
                  {distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
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
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Matriz de Reprovação por Tipo e Banco */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Matriz de Reprovação por Tipo e Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Tipo de Reprovação</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">UY3</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Presença</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">V8</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="py-3 px-4 text-foreground">{row.tipo}</td>
                    <td className="py-3 px-4">
                      <div className={`${getHeatmapColor(row.UY3)} text-white text-center py-2 rounded font-medium`}>
                        {row.UY3}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`${getHeatmapColor(row.Presença)} text-white text-center py-2 rounded font-medium`}>
                        {row.Presença}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`${getHeatmapColor(row.V8)} text-white text-center py-2 rounded font-medium`}>
                        {row.V8}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BanksPanel;
