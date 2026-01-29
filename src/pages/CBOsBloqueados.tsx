import { Ban, Users, DollarSign, Building2, LayoutGrid, Zap, Factory, List } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import VisaoGeralCBOsPanel from "@/components/cbos/VisaoGeralCBOsPanel";
import PorBancoCBOsPanel from "@/components/cbos/PorBancoCBOsPanel";
import PorSetorCBOsPanel from "@/components/cbos/PorSetorCBOsPanel";
import ListaCompletaCBOsPanel from "@/components/cbos/ListaCompletaCBOsPanel";
import { useDashboard } from "@/contexts/DashboardContext";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const CBOsContent = () => {
  const { stats, leads, isLoading } = useDashboard();

  const calculatedStats = useMemo(() => {
    // Usar dados extraídos de CBOs bloqueados
    const totalCBOsBloqueados = stats.totalCBOsBloqueados;
    const cbosUnicosBloqueados = stats.cbosBloqueados.length;

    // Estima margem perdida nos reprovados que tinham valorMargemDisponivel
    let margemPerdida = 0;
    const reprovados = leads.filter((l) => l.status?.toLowerCase() === "reprovado");
    reprovados.forEach((lead) => {
      const margem = lead.retorno_margem as any;
      margemPerdida += margem?.valorMargemDisponivel || 0;
    });

    return {
      totalBloqueados: cbosUnicosBloqueados,
      leadsAfetados: totalCBOsBloqueados,
      margemPerdida,
      taxaReprovacao: stats.taxaReprovacao,
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
      title: "CBOs Bloqueados",
      value: calculatedStats.totalBloqueados.toString(),
      subtitle: "Ocupações identificadas",
      icon: Ban,
      bgGradient: "from-red-950/50 to-red-900/30",
      borderColor: "border-l-red-500",
      textColor: "text-red-400",
      iconColor: "text-red-400",
    },
    {
      title: "Leads Afetados",
      value: calculatedStats.leadsAfetados.toLocaleString("pt-BR"),
      subtitle: "Total bloqueados por CBO",
      icon: Users,
      bgGradient: "from-orange-950/50 to-orange-900/30",
      borderColor: "border-l-orange-500",
      textColor: "text-orange-400",
      iconColor: "text-orange-400",
    },
    {
      title: "% Reprovação",
      value: `${calculatedStats.taxaReprovacao}%`,
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
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8 animate-page-enter">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8 overflow-auto w-full min-w-0 animate-page-enter">
      <div className="max-w-7xl mx-auto space-y-4 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">CBOs Bloqueados</h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-1">
            Análise de ocupações e reprovações
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.title}
              className={`bg-gradient-to-br ${kpi.bgGradient} border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}
            >
              <CardContent className="p-3 lg:p-6">
                <div className="flex items-start justify-between gap-1">
                  <div className="space-y-1 lg:space-y-3 min-w-0 flex-1">
                    <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className={`text-lg sm:text-xl lg:text-3xl font-bold ${kpi.textColor} truncate`}>
                      {kpi.value}
                    </p>
                    <p className="text-[10px] lg:text-xs text-muted-foreground line-clamp-2">{kpi.subtitle}</p>
                  </div>
                  <kpi.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${kpi.iconColor} flex-shrink-0`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="visao-geral" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <TabsList className="inline-flex min-w-max lg:w-full lg:grid lg:grid-cols-4 bg-muted/50 border border-border rounded-lg p-1 h-auto gap-1">
            <TabsTrigger
              value="visao-geral"
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
            >
              <LayoutGrid className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger
              value="por-banco"
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
            >
              <Zap className="w-3 h-3 lg:w-4 lg:h-4" />
              Banco
            </TabsTrigger>
            <TabsTrigger
              value="por-setor"
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
            >
              <Factory className="w-3 h-3 lg:w-4 lg:h-4" />
              Setor
            </TabsTrigger>
            <TabsTrigger
              value="lista-completa"
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
            >
              <List className="w-3 h-3 lg:w-4 lg:h-4" />
              Lista
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="visao-geral" className="mt-4 lg:mt-6">
            <VisaoGeralCBOsPanel />
          </TabsContent>

          <TabsContent value="por-banco" className="mt-4 lg:mt-6">
            <PorBancoCBOsPanel />
          </TabsContent>

          <TabsContent value="por-setor" className="mt-4 lg:mt-6">
            <PorSetorCBOsPanel />
          </TabsContent>

          <TabsContent value="lista-completa" className="mt-4 lg:mt-6">
            <ListaCompletaCBOsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

const CBOsBloqueados = () => {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      <CBOsContent />
    </div>
  );
};

export default CBOsBloqueados;
