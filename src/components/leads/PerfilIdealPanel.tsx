import { Star, Upload, TrendingUp, Users, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";

// Calcula perfil ideal baseado em leads aprovados
const PerfilIdealPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const perfil = useMemo(() => {
    const aprovados = leads.filter((l) => l.status?.toLowerCase() === "aprovado");

    if (aprovados.length === 0) return null;

    const margens = aprovados.map((l) => {
      const margem = l.retorno_margem as any;
      return margem?.valorMargemDisponivel || 0;
    }).filter((v) => v > 0);

    const valores = aprovados.map((l) => {
      const sim = l.retorno_simulacao as any;
      return sim?.requestedAmount || sim?.liquidValue || 0;
    }).filter((v) => v > 0);

    const margemMedia = margens.length > 0 ? margens.reduce((a, b) => a + b, 0) / margens.length : 0;
    const valorMedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

    // Tempo de vínculo: calcula diferença entre data de admissão e hoje em meses
    const temposVinculo = aprovados.map((l) => {
      const margem = l.retorno_margem as any;
      const dataAdmissao = margem?.dataAdmissao || margem?.registroEmpregaticio?.dataAdmissao;
      if (!dataAdmissao) return 0;
      const diff = Date.now() - new Date(dataAdmissao).getTime();
      return Math.round(diff / (1000 * 60 * 60 * 24 * 30));
    }).filter((v) => v > 0);

    const tempoMedioVinculo = temposVinculo.length > 0 ? Math.round(temposVinculo.reduce((a, b) => a + b, 0) / temposVinculo.length) : 0;

    return {
      totalAprovados: aprovados.length,
      taxaAprovacao: stats.taxaAprovacao,
      margemMedia,
      valorMedio,
      tempoMedioVinculo,
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

  const cards = [
    {
      title: "Total Aprovados",
      value: perfil.totalAprovados.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-emerald-400",
    },
    {
      title: "Taxa de Aprovação",
      value: `${perfil.taxaAprovacao}%`,
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      title: "Margem Média",
      value: `R$ ${perfil.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-amber-400",
    },
    {
      title: "Valor Médio Simulado",
      value: `R$ ${perfil.valorMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-blue-400",
    },
    {
      title: "Tempo Médio Vínculo",
      value: perfil.tempoMedioVinculo > 0 ? `${perfil.tempoMedioVinculo} meses` : "-",
      icon: Clock,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="space-y-6">
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
            {cards.map((c) => (
              <div key={c.title} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                  <span className="text-sm text-muted-foreground">{c.title}</span>
                </div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilIdealPanel;
