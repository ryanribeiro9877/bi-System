import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, DollarSign, Clock, Building2, Briefcase, CheckCircle } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

const radarData = [
  { subject: "Margem", value: 85, fullMark: 100 },
  { subject: "Tempo Vínculo", value: 75, fullMark: 100 },
  { subject: "Porte Empresa", value: 90, fullMark: 100 },
  { subject: "CBO Elegível", value: 80, fullMark: 100 },
  { subject: "CNAE Elegível", value: 70, fullMark: 100 },
  { subject: "Contratos Ativos", value: 65, fullMark: 100 },
];

const margemData = [
  { faixa: "R$ 0-300", value: 45 },
  { faixa: "R$ 301-500", value: 85 },
  { faixa: "R$ 501-800", value: 110 },
  { faixa: "R$ 801-1200", value: 55 },
  { faixa: "R$ 1200+", value: 20 },
];

const vinculoData = [
  { periodo: "6-12 meses", value: 60 },
  { periodo: "1-2 anos", value: 95 },
  { periodo: "2-3 anos", value: 85 },
  { periodo: "3-5 anos", value: 70 },
  { periodo: "5+ anos", value: 40 },
];

const porteData = [
  { porte: "Grande", value: 180 },
  { porte: "Média", value: 90 },
  { porte: "Pequena", value: 35 },
  { porte: "ME", value: 15 },
];

const resumoItems = [
  {
    icon: DollarSign,
    title: "Margem Disponível",
    subtitle: "Faixa ideal",
    value: "R$ 501 - R$ 800",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    badgeColor: "border-amber-500/50 text-amber-400",
  },
  {
    icon: Clock,
    title: "Tempo de Vínculo",
    subtitle: "Período ideal",
    value: "1 - 3 anos",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    badgeColor: "border-blue-500/50 text-blue-400",
  },
  {
    icon: Building2,
    title: "Porte da Empresa",
    subtitle: "Melhor taxa",
    value: "Grande / Média",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    badgeColor: "border-purple-500/50 text-purple-400",
  },
  {
    icon: Briefcase,
    title: "CBO Elegível",
    subtitle: "Top ocupação",
    value: "Assistente Administrativo",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    badgeColor: "border-orange-500/50 text-orange-400",
  },
  {
    icon: CheckCircle,
    title: "Contratos Ativos",
    subtitle: "Máximo permitido",
    value: "0 - 1 contrato",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    badgeColor: "border-emerald-500/50 text-emerald-400",
  },
];

const PerfilIdealPanel = () => {
  return (
    <div className="space-y-6">
      {/* Top Row - Radar Chart + Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-400" />
              Perfil Ideal do Lead Aprovado
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Características que maximizam a chance de aprovação
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  />
                  <Radar
                    name="Perfil"
                    dataKey="value"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Perfil */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="w-5 h-5 text-purple-400" />
              Resumo do Perfil que Aprova
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Características mais comuns entre leads aprovados
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {resumoItems.map((item) => (
              <div
                key={item.title}
                className={`flex items-center justify-between p-3 rounded-lg ${item.bgColor}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                </div>
                <Badge variant="outline" className={item.badgeColor}>
                  {item.value}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Middle Row - Margem + Vínculo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Faixa de Margem */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição por Faixa de Margem</CardTitle>
            <p className="text-sm text-muted-foreground">
              Leads aprovados por faixa de margem disponível
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={margemData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="faixa"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Tempo de Vínculo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição por Tempo de Vínculo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Leads aprovados por tempo de emprego
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vinculoData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="periodo"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Porte da Empresa */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Distribuição por Porte da Empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Taxa de aprovação por porte do empregador
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porteData} margin={{ bottom: 20 }}>
                <XAxis
                  dataKey="porte"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilIdealPanel;
