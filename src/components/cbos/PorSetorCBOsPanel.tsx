import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const setoresChartData = [
  { setor: "Construção Civil", leads: 245, color: "#ef4444" },
  { setor: "Comércio", leads: 189, color: "#f97316" },
  { setor: "Alimentação", leads: 156, color: "#eab308" },
  { setor: "Serviços Gerais", leads: 134, color: "#84cc16" },
  { setor: "Administrativo", leads: 163, color: "#22c55e" },
  { setor: "Indústria", leads: 87, color: "#06b6d4" },
  { setor: "Transporte", leads: 76, color: "#3b82f6" },
];

const setoresCards = [
  {
    nome: "Construção Civil",
    leads: 245,
    color: "text-red-400",
    badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
    cbos: [{ descricao: "Servente de Obras", leads: 245 }],
  },
  {
    nome: "Comércio",
    leads: 189,
    color: "text-orange-400",
    badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    cbos: [{ descricao: "Vendedor em Comércio At...", leads: 189 }],
  },
  {
    nome: "Alimentação",
    leads: 156,
    color: "text-amber-400",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    cbos: [{ descricao: "Atendente de Lanchonete", leads: 156 }],
  },
  {
    nome: "Serviços Gerais",
    leads: 134,
    color: "text-lime-400",
    badgeColor: "bg-lime-500/20 text-lime-400 border-lime-500/30",
    cbos: [{ descricao: "Faxineiro", leads: 134 }],
  },
  {
    nome: "Administrativo",
    leads: 163,
    color: "text-emerald-400",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    cbos: [
      { descricao: "Recepcionista em Geral", leads: 98 },
      { descricao: "Auxiliar de Escritório", leads: 65 },
    ],
  },
  {
    nome: "Indústria",
    leads: 87,
    color: "text-cyan-400",
    badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    cbos: [{ descricao: "Alimentador de Linha de Pr...", leads: 87 }],
  },
];

const PorSetorCBOsPanel = () => {
  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">CBOs Bloqueados por Setor de Atuação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise detalhada dos bloqueios organizados por área de trabalho
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setoresChartData} margin={{ bottom: 60 }}>
                <XAxis 
                  dataKey="setor" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 260]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                  {setoresChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {setoresCards.map((setor) => (
          <Card key={setor.nome} className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">{setor.nome}</h3>
                <Badge variant="outline" className={setor.badgeColor}>
                  {setor.leads} leads
                </Badge>
              </div>
              <div className="space-y-2">
                {setor.cbos.map((cbo, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{cbo.descricao}</span>
                    <span className="text-foreground font-medium">{cbo.leads}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PorSetorCBOsPanel;
