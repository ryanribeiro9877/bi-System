import { BarChart3, Building2, Briefcase, AlertTriangle, TrendingDown, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, Suspense, lazy } from "react";

// Lazy load dos painéis para melhor performance
const OverviewPanel = lazy(() => import("./panels/OverviewPanel"));
const CBOsPanel = lazy(() => import("./panels/CBOsPanel"));
const ResultadosPanel = lazy(() => import("./panels/ResultadosPanel"));
const ResultadosConsultasPanel = lazy(() => import("./panels/ResultadosConsultasPanel"));
const ConsultaMargemReprovadaPanel = lazy(() => import("./panels/ConsultaMargemReprovadaPanel"));

// Componente de loading para os painéis
const PanelLoader = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
    <span className="text-muted-foreground">Carregando painel...</span>
  </div>
);

const DashboardTabs = () => {
  const [tab, setTab] = useState("overview");

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="mb-4 lg:mb-6">
        <TabsList className="w-full grid grid-cols-5 bg-muted/50 border border-border rounded-lg p-1 h-auto gap-1">
          <TabsTrigger
            value="overview"
            className="flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
          >
            <BarChart3 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Visão Geral</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger
            value="cbos"
            className="flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
          >
            <Briefcase className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Autorizações</span>
            <span className="sm:hidden">Auth</span>
          </TabsTrigger>
          <TabsTrigger
            value="resultados"
            className="flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
            <span className="hidden md:inline">Resultado Consultas</span>
            <span className="md:hidden">Result.</span>
          </TabsTrigger>
          <TabsTrigger
            value="erros-consulta"
            className="flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
            <span className="hidden md:inline">Erros Consulta</span>
            <span className="md:hidden">Erros</span>
          </TabsTrigger>
          <TabsTrigger
            value="margem-reprovada"
            className="flex items-center justify-center gap-1 lg:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 lg:py-2.5 rounded-md text-xs lg:text-sm"
          >
            <TrendingDown className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
            <span className="hidden md:inline">Margem Reprovada</span>
            <span className="md:hidden">Margem</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-0">
        <Suspense fallback={<PanelLoader />}>
          {tab === "overview" && <OverviewPanel />}
        </Suspense>
      </TabsContent>

      <TabsContent value="cbos" className="mt-0">
        <Suspense fallback={<PanelLoader />}>
          {tab === "cbos" && <CBOsPanel />}
        </Suspense>
      </TabsContent>

      <TabsContent value="resultados" className="mt-0">
        <Suspense fallback={<PanelLoader />}>
          {tab === "resultados" && <ResultadosConsultasPanel />}
        </Suspense>
      </TabsContent>

      <TabsContent value="erros-consulta" className="mt-0">
        <Suspense fallback={<PanelLoader />}>
          {tab === "erros-consulta" && <ResultadosPanel />}
        </Suspense>
      </TabsContent>

      <TabsContent value="margem-reprovada" className="mt-0">
        <Suspense fallback={<PanelLoader />}>
          {tab === "margem-reprovada" && <ConsultaMargemReprovadaPanel />}
        </Suspense>
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
