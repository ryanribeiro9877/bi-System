import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const cboData = [
  { name: "Não informado", value: 100 },
];

const blockedCBOs = [
  { codigo: "5211-10", descricao: "Servente de Obras", reprovacoes: 245 },
  { codigo: "5211-20", descricao: "Vendedor Atacadista", reprovacoes: 189 },
  { codigo: "5211-30", descricao: "Atendente de Lanchonete", reprovacoes: 156 },
  { codigo: "5211-40", descricao: "Faxineiro", reprovacoes: 98 },
  { codigo: "5211-50", descricao: "Recepcionista", reprovacoes: 87 },
  { codigo: "5211-60", descricao: "Alimentador de Linha", reprovacoes: 54 },
];

const COLORS = ["hsl(var(--chart-1))"];

const CBOsPanel = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CBOs com Maior Reprovação */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            CBOs com Maior Reprovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={cboData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={70}
                paddingAngle={0}
                dataKey="value"
                label={({ value }) => `${value}%`}
                labelLine={false}
              >
                {cboData.map((_, index) => (
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
                formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* CBOs Bloqueados */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              CBOs Bloqueados
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em um CBO para ver os leads afetados
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Ver Todos <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {blockedCBOs.map((cbo, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div>
                  <span className="text-muted-foreground text-sm">Código: </span>
                  <span className="text-foreground font-medium">{cbo.codigo}</span>
                </div>
                <span className="text-destructive font-semibold">
                  {cbo.reprovacoes.toLocaleString()} reprovações
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsPanel;
