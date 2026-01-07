import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const bancosData = [
  { 
    nome: "UY3", 
    aprovados: 120, 
    total: 450, 
    taxa: 26.7,
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    progressColor: "bg-blue-500"
  },
  { 
    nome: "Presença", 
    aprovados: 110, 
    total: 480, 
    taxa: 22.9,
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    progressColor: "bg-purple-500"
  },
  { 
    nome: "V8", 
    aprovados: 95, 
    total: 420, 
    taxa: 22.6,
    badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    progressColor: "bg-pink-500"
  },
];

const chartData = [
  { banco: "UY3", Aprovados: 120, Total: 450 },
  { banco: "Presença", Aprovados: 110, Total: 480 },
  { banco: "V8", Aprovados: 95, Total: 420 },
];

const PorBancoPanel = () => {
  return (
    <div className="space-y-6">
      {/* Bank Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bancosData.map((banco) => (
          <Card key={banco.nome} className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">{banco.nome}</h3>
                <Badge variant="outline" className={banco.badgeColor}>
                  {banco.taxa}%
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aprovados</span>
                  <span className="text-foreground font-medium">{banco.aprovados}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Analisados</span>
                  <span className="text-foreground font-medium">{banco.total}</span>
                </div>
                <div className="pt-2">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${banco.progressColor} rounded-full transition-all`}
                      style={{ width: `${banco.taxa}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Comparativo de Aprovação por Banco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise comparativa das taxas de aprovação entre UY3, Presença e V8
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ bottom: 20 }}>
                <XAxis 
                  dataKey="banco" 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 600]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 20 }} />
                <Bar 
                  dataKey="Aprovados" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="Total" 
                  fill="#6b7280" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PorBancoPanel;
