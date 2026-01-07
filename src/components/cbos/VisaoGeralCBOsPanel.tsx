import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const topCBOsData = [
  { cbo: "Servente de Obras", leads: 245 },
  { cbo: "Vendedor em Comércio Atacadista", leads: 189 },
  { cbo: "Atendente de Lanchonete", leads: 156 },
  { cbo: "Faxineiro", leads: 134 },
  { cbo: "Recepcionista em Geral", leads: 98 },
  { cbo: "Alimentador de Linha de Produção", leads: 87 },
];

const setorData = [
  { name: "Construção Civil", value: 23, color: "#f97316" },
  { name: "Comércio", value: 18, color: "#eab308" },
  { name: "Administrativo", value: 16, color: "#22c55e" },
  { name: "Alimentação", value: 15, color: "#06b6d4" },
  { name: "Serviços Gerais", value: 13, color: "#3b82f6" },
  { name: "Indústria", value: 8, color: "#8b5cf6" },
  { name: "Transporte", value: 7, color: "#ec4899" },
];

const bancosData = [
  { nome: "UY3", cbos: 6, leadsAfetados: 520, color: "bg-blue-500" },
  { nome: "Presença", cbos: 5, leadsAfetados: 450, color: "bg-purple-500" },
  { nome: "V8", cbos: 4, leadsAfetados: 380, color: "bg-pink-500" },
];

const VisaoGeralCBOsPanel = () => {
  return (
    <div className="space-y-6">
      {/* Top Row - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top CBOs com Mais Reprovações */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Top CBOs com Mais Reprovações
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ocupações que mais geram reprovações nos bancos
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCBOsData} layout="vertical" margin={{ left: 30 }}>
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} domain={[0, 260]} />
                  <YAxis
                    type="category"
                    dataKey="cbo"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="leads" fill="#f87171" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Setor */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5 text-purple-400" />
              Distribuição por Setor
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Setores mais afetados pelos bloqueios de CBO
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={setorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                    labelLine={false}
                  >
                    {setorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Impacto por Banco */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Impacto dos Bloqueios por Banco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comparativo de leads afetados e CBOs bloqueados em cada banco
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bancosData.map((banco) => (
              <Card key={banco.nome} className="bg-muted/30 border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{banco.nome}</h3>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {banco.cbos} CBOs
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Leads Afetados</span>
                    <span className="text-foreground font-medium">{banco.leadsAfetados}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${banco.color} rounded-full`}
                      style={{ width: `${(banco.leadsAfetados / 600) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisaoGeralCBOsPanel;
