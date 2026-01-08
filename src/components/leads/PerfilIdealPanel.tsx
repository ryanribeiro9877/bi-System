import { Star, Upload, TrendingUp, Users, DollarSign, Clock, UserCheck, Briefcase, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { extrairTodosDados } from "@/lib/leadDataExtractor";

const PerfilIdealPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const perfil = useMemo(() => {
    // Extrai dados de todos os leads
    const leadsProcessados = leads.map(lead => extrairTodosDados(lead));
    
    const aprovados = leadsProcessados.filter(l => l.statusNormalizado === "aprovado");
    const reprovados = leadsProcessados.filter(l => l.statusNormalizado === "reprovado");

    if (aprovados.length === 0) return null;

    // Calcula médias dos aprovados
    const margens = aprovados.filter(d => d.margemDisponivel > 0).map(d => d.margemDisponivel);
    const margensBase = aprovados.filter(d => d.margemBase > 0).map(d => d.margemBase);
    const idades = aprovados.filter(d => d.idade && d.idade > 0).map(d => d.idade!);
    const temposVinculo = aprovados.filter(d => d.tempoVinculoMeses && d.tempoVinculoMeses > 0).map(d => d.tempoVinculoMeses!);
    
    const masculino = aprovados.filter(d => d.sexo === 'M').length;
    const feminino = aprovados.filter(d => d.sexo === 'F').length;

    const margemMedia = margens.length > 0 ? margens.reduce((a, b) => a + b, 0) / margens.length : 0;
    const margemBaseMedia = margensBase.length > 0 ? margensBase.reduce((a, b) => a + b, 0) / margensBase.length : 0;
    const idadeMedia = idades.length > 0 ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length) : 0;
    const tempoMedioVinculo = temposVinculo.length > 0 ? Math.round(temposVinculo.reduce((a, b) => a + b, 0) / temposVinculo.length) : 0;

    // Agrupa por faixa etária
    const faixasEtarias = [
      { faixa: '18-30', aprovados: 0 },
      { faixa: '31-40', aprovados: 0 },
      { faixa: '41-50', aprovados: 0 },
      { faixa: '51-60', aprovados: 0 },
      { faixa: '60+', aprovados: 0 },
    ];

    aprovados.forEach(l => {
      if (!l.idade) return;
      if (l.idade >= 18 && l.idade <= 30) faixasEtarias[0].aprovados++;
      else if (l.idade >= 31 && l.idade <= 40) faixasEtarias[1].aprovados++;
      else if (l.idade >= 41 && l.idade <= 50) faixasEtarias[2].aprovados++;
      else if (l.idade >= 51 && l.idade <= 60) faixasEtarias[3].aprovados++;
      else if (l.idade > 60) faixasEtarias[4].aprovados++;
    });

    // Agrupa por tempo de vínculo
    const faixasVinculo = [
      { faixa: '0-12 meses', aprovados: 0 },
      { faixa: '1-3 anos', aprovados: 0 },
      { faixa: '3-5 anos', aprovados: 0 },
      { faixa: '5-10 anos', aprovados: 0 },
      { faixa: '10+ anos', aprovados: 0 },
    ];

    aprovados.forEach(l => {
      if (!l.tempoVinculoMeses) return;
      if (l.tempoVinculoMeses <= 12) faixasVinculo[0].aprovados++;
      else if (l.tempoVinculoMeses <= 36) faixasVinculo[1].aprovados++;
      else if (l.tempoVinculoMeses <= 60) faixasVinculo[2].aprovados++;
      else if (l.tempoVinculoMeses <= 120) faixasVinculo[3].aprovados++;
      else faixasVinculo[4].aprovados++;
    });

    // Calcula % de utilização da margem
    const utilizacaoMargem = margemBaseMedia > 0 ? Math.round((margemMedia / margemBaseMedia) * 100) : 0;

    // Radar chart data
    const radarData = [
      { caracteristica: 'Margem Disponível', valor: Math.min(100, (margemMedia / 2000) * 100), fullMark: 100 },
      { caracteristica: 'Tempo Vínculo', valor: Math.min(100, (tempoMedioVinculo / 120) * 100), fullMark: 100 },
      { caracteristica: 'Idade Ideal', valor: idadeMedia > 35 && idadeMedia < 50 ? 90 : 60, fullMark: 100 },
      { caracteristica: 'Margem Base', valor: Math.min(100, (margemBaseMedia / 6000) * 100), fullMark: 100 },
      { caracteristica: 'Estabilidade', valor: tempoMedioVinculo > 24 ? 85 : Math.min(100, (tempoMedioVinculo / 24) * 85), fullMark: 100 },
    ];

    return {
      totalAprovados: aprovados.length,
      totalReprovados: reprovados.length,
      taxaAprovacao: stats.taxaAprovacao,
      margemMedia,
      margemBaseMedia,
      idadeMedia,
      tempoMedioVinculo,
      masculino,
      feminino,
      utilizacaoMargem,
      faixasEtarias,
      faixasVinculo,
      radarData,
    };
  }, [leads, stats]);

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Perfil Ideal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Star className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Dados insuficientes</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar o perfil ideal.
            </p>
            <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
              <Upload className="w-4 h-4" />
              Ir para Importações
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!perfil) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-amber-400" />
            Perfil Ideal do Lead Aprovado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Ainda não há leads aprovados para calcular o perfil ideal.
          </div>
        </CardContent>
      </Card>
    );
  }

  const sexoData = [
    { name: 'Masculino', value: perfil.masculino, color: '#3b82f6' },
    { name: 'Feminino', value: perfil.feminino, color: '#ec4899' },
  ].filter(d => d.value > 0);

  const kpiCards = [
    {
      title: "Margem Média Disponível",
      value: `R$ ${perfil.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      description: "Valor médio disponível para empréstimo",
    },
    {
      title: "Idade Média",
      value: perfil.idadeMedia > 0 ? `${perfil.idadeMedia} anos` : "N/D",
      icon: Calendar,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      description: "Faixa etária predominante",
    },
    {
      title: "Tempo de Vínculo",
      value: perfil.tempoMedioVinculo > 12 ? `${Math.round(perfil.tempoMedioVinculo / 12)} anos` : perfil.tempoMedioVinculo > 0 ? `${perfil.tempoMedioVinculo} meses` : "N/D",
      icon: Briefcase,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      description: "Tempo médio no emprego",
    },
    {
      title: "Utilização da Margem",
      value: perfil.utilizacaoMargem > 0 ? `${perfil.utilizacaoMargem}%` : "N/D",
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      description: "% da margem base disponível",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-amber-400" />
            Perfil Ideal do Lead Aprovado
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise baseada em {perfil.totalAprovados.toLocaleString("pt-BR")} leads aprovados
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {kpiCards.map((c) => (
              <div key={c.title} className={`rounded-lg border border-border p-4 ${c.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                  <span className="text-sm text-muted-foreground">{c.title}</span>
                </div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Características do Perfil Ideal
            </CardTitle>
            <p className="text-xs text-muted-foreground">Score de cada característica (0-100)</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={perfil.radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="caracteristica" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Radar name="Perfil" dataKey="valor" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Gênero */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-blue-400" />
              Distribuição por Gênero (Aprovados)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Proporção entre homens e mulheres aprovados</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {sexoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sexoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {sexoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">Dados de gênero não disponíveis</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aprovados por Faixa Etária */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-purple-400" />
              Aprovados por Faixa Etária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {perfil.faixasEtarias.some(f => f.aprovados > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfil.faixasEtarias} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis dataKey="faixa" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="aprovados" fill="#10b981" radius={[0, 4, 4, 0]} name="Aprovados" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Dados de idade não disponíveis
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aprovados por Tempo de Vínculo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4 text-amber-400" />
              Aprovados por Tempo de Vínculo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {perfil.faixasVinculo.some(f => f.aprovados > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfil.faixasVinculo} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis dataKey="faixa" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Bar dataKey="aprovados" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Aprovados" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Dados de vínculo não disponíveis
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Insights do Perfil Ideal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="font-medium text-emerald-400 mb-2">✓ Margem Disponível</h4>
              <p className="text-sm text-muted-foreground">
                Leads aprovados têm margem média de <span className="text-foreground font-medium">R$ {perfil.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h4 className="font-medium text-blue-400 mb-2">✓ Total Aprovados</h4>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{perfil.totalAprovados}</span> leads aprovados de {perfil.totalAprovados + perfil.totalReprovados} analisados ({stats.taxaAprovacao}% taxa de aprovação).
              </p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h4 className="font-medium text-purple-400 mb-2">✓ Perfil Demográfico</h4>
              <p className="text-sm text-muted-foreground">
                {perfil.idadeMedia > 0 ? `Idade média de ${perfil.idadeMedia} anos. ` : ""}
                {perfil.tempoMedioVinculo > 0 ? `Tempo médio de vínculo: ${perfil.tempoMedioVinculo > 12 ? Math.round(perfil.tempoMedioVinculo / 12) + " anos" : perfil.tempoMedioVinculo + " meses"}.` : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilIdealPanel;
