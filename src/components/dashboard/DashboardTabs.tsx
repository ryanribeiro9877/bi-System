import { BarChart3, Building2, Briefcase, AlertTriangle, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import OverviewPanel from "./panels/OverviewPanel";
import CBOsPanel from "./panels/CBOsPanel";
import ResultadosPanel from "./panels/ResultadosPanel";
import ResultadosConsultasPanel from "./panels/ResultadosConsultasPanel";
import ConsultaMargemReprovadaPanel from "./panels/ConsultaMargemReprovadaPanel";

const DashboardTabs = () => {
  const [tab, setTab] = useState("overview");

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="overflow-x-auto mb-4 lg:mb-6 -mx-4 px-4 lg:mx-0 lg:px-0">
        <TabsList className="flex w-full min-w-max md:min-w-0 h-11 lg:h-12 bg-muted/50 border border-border rounded-lg px-2 sm:px-3 lg:px-4 py-2 gap-6 justify-between items-center">
          <TabsTrigger
            value="overview"
            className="min-w-[100px] md:flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-[11px] lg:text-sm px-3 lg:px-4"
          >
            <BarChart3 className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 flex-shrink-0" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="cbos"
            className="min-w-[70px] md:flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-[11px] lg:text-sm px-3 lg:px-4"
          >
            <Briefcase className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 flex-shrink-0" />
            Autorizações
          </TabsTrigger>
          <TabsTrigger
            value="resultados"
            className="min-w-[95px] md:flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-[11px] lg:text-sm px-3 lg:px-4"
          >
            <AlertTriangle className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 flex-shrink-0" />
            <span className="hidden md:inline">Resultados das Consultas</span>
            <span className="md:hidden">Resultados</span>
          </TabsTrigger>
          <TabsTrigger
            value="erros-consulta"
            className="min-w-[95px] md:flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-[11px] lg:text-sm px-3 lg:px-4"
          >
            <AlertTriangle className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 flex-shrink-0" />
            <span className="hidden md:inline">Erros de Consulta</span>
            <span className="md:hidden">Erros</span>
          </TabsTrigger>
          <TabsTrigger
            value="margem-reprovada"
            className="min-w-[85px] md:flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-[11px] lg:text-sm px-3 lg:px-4"
          >
            <TrendingDown className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5 flex-shrink-0" />
            <span className="hidden md:inline">Margem Reprovada</span>
            <span className="md:hidden">Margem</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-0">
        {tab === "overview" && <OverviewPanel />}
      </TabsContent>

      <TabsContent value="cbos" className="mt-0">
        {tab === "cbos" && <CBOsPanel />}
      </TabsContent>

      <TabsContent value="resultados" className="mt-0">
        {tab === "resultados" && <ResultadosConsultasPanel />}
      </TabsContent>

      <TabsContent value="erros-consulta" className="mt-0">
        {tab === "erros-consulta" && <ResultadosPanel />}
      </TabsContent>

      <TabsContent value="margem-reprovada" className="mt-0">
        {tab === "margem-reprovada" && <ConsultaMargemReprovadaPanel />}
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
