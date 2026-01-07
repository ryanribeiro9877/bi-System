import { Ban, Users, DollarSign, Building2, LayoutGrid, Zap, Factory, List } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import VisaoGeralCBOsPanel from "@/components/cbos/VisaoGeralCBOsPanel";
import PorBancoCBOsPanel from "@/components/cbos/PorBancoCBOsPanel";
import PorSetorCBOsPanel from "@/components/cbos/PorSetorCBOsPanel";
import ListaCompletaCBOsPanel from "@/components/cbos/ListaCompletaCBOsPanel";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const CBOsContent = () => {
  const { stats, leads, isLoading } = useDashboard();

  const calculatedStats = useMemo(() => {
    const reprovados = leads.filter((l) => l.status?.toLowerCase() === "reprovado");

    // Estima margem perdida nos reprovados que tinham valorMargemDisponivel
    let margemPerdida = 0;
    reprovados.forEach((lead) => {
      const margem = lead.retorno_margem as any;
      margemPerdida += margem?.valorMargemDisponivel || 0;
    });

    // Contagem de CBOs únicos (nao necessariamente usamos isso, pois já há stats.cbosUnicos, mas mantemos)
    const setoresAfetados = stats.cbosUnicos || 0;

    return {
      totalBloqueados: stats.cbosUnicos,
      leadsAfetados: stats.leadsReprovados,
      margemPerdida,
      setoresAfetados,
    };
  }, [leads, stats]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return `R$ ${value.toLocaleString("pt-BR")}`;
  };

  const kpiCards = [
    {
      title: "CBOs Únicos (reprovados)",
      value: calculatedStats.totalBloqueados.toString(),
      subtitle: "Ocupações identificadas",
      icon: Ban,
      bgGradient: "from-red-950/50 to-red-900/30",
      borderColor: "border-l-red-500",
      textColor: "text-red-400",
      iconColor: "text-red-400",
    },
    {
      title: "Leads Reprovados",
      value: calculatedStats.leadsAfetados.toLocaleString("pt-BR"),
      subtitle: "Total de reprovações",
      icon: Users,
      bgGradient: "from-orange-950/50 to-orange-900/30",
      borderColor: "border-l-orange-500",
      textColor: "text-orange-400",
      iconColor: "text-orange-400",
    },
    {
      title: "Margem Perdida",
      value: formatCurrency(calculatedStats.margemPerdida),
      subtitle: "Potencial não aproveitado",
      icon: DollarSign,
      bgGradient: "from-amber-950/50 to-amber-900/30",
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconColor: "text-amber-400",
    },
    {
      title: "% Reprovação",
      value: `${stats.taxaReprovacao}%`,
      subtitle: "Taxa de reprovação geral",
      icon: Building2,
      bgGradient: "from-purple-950/50 to-purple-900/30",
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconColor: "text-purple-400",
    },
  ];

  if (isLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">CBOs Bloqueados</h1>
          <p className="text-muted-foreground mt-1">
            Análise de ocupações e reprovações
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.title}
              className={`bg-gradient-to-br ${kpi.bgGradient} border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className={`text-3xl font-bold ${kpi.textColor}`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="visao-geral" className="w-full">
          <TabsList className="w-full grid grid-cols-4 bg-muted/50 border border-border rounded-lg p-1 h-auto">
            <TabsTrigger
              value="visao-geral"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
            >
              <LayoutGrid className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="por-banco"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
            >
              <Zap className="w-4 h-4" />
              Por Banco
            </TabsTrigger>
            <TabsTrigger
              value="por-setor"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
            >
              <Factory className="w-4 h-4" />
              Por Setor
            </TabsTrigger>
            <TabsTrigger
              value="lista-completa"
              className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
            >
              <List className="w-4 h-4" />
              Lista Completa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            <VisaoGeralCBOsPanel />
          </TabsContent>

          <TabsContent value="por-banco" className="mt-6">
            <PorBancoCBOsPanel />
          </TabsContent>

          <TabsContent value="por-setor" className="mt-6">
            <PorSetorCBOsPanel />
          </TabsContent>

          <TabsContent value="lista-completa" className="mt-6">
            <ListaCompletaCBOsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const CBOsBloqueados = () => {
  return (
    <DashboardProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <CBOsContent />
      </div>
    </DashboardProvider>
  );
};

export default CBOsBloqueados;
