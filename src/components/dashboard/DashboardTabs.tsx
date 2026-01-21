import { BarChart3, Building2, Briefcase, Users, AlertTriangle, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewPanel from "./panels/OverviewPanel";
import CBOsPanel from "./panels/CBOsPanel";
import LeadsPanel from "./panels/LeadsPanel";
import ResultadosConsultasPanel from "./panels/ResultadosConsultasPanel";
import ConsultaMargemReprovadaPanel from "./panels/ConsultaMargemReprovadaPanel";

const DashboardTabs = () => {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="overflow-x-auto mb-4 lg:mb-6 -mx-4 px-4 lg:mx-0 lg:px-0">
        <TabsList className="inline-flex min-w-max lg:min-w-full h-10 lg:h-12 bg-muted/50 border border-border rounded-lg p-1 gap-1">
          <TabsTrigger
            value="overview"
            className="flex-1 min-w-[90px] lg:min-w-[120px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
          >
            <BarChart3 className="h-4 w-4 mr-1.5 lg:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Visão Geral</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger
            value="cbos"
            className="flex-1 min-w-[70px] lg:min-w-[80px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
          >
            <Briefcase className="h-4 w-4 mr-1.5 lg:mr-2 flex-shrink-0" />
            CBOs
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="flex-1 min-w-[90px] lg:min-w-[160px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
          >
            <Users className="h-4 w-4 mr-1.5 lg:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Contratos Digitados</span>
            <span className="sm:hidden">Contratos</span>
          </TabsTrigger>
          <TabsTrigger
            value="resultados"
            className="flex-1 min-w-[100px] lg:min-w-[200px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5 lg:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Resultados das Consultas</span>
            <span className="sm:hidden">Resultados</span>
          </TabsTrigger>
          <TabsTrigger
            value="margem-reprovada"
            className="flex-1 min-w-[90px] lg:min-w-[220px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap text-xs lg:text-sm px-2 lg:px-3"
          >
            <TrendingDown className="h-4 w-4 mr-1.5 lg:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Margem Reprovada</span>
            <span className="sm:hidden">Margem</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-0">
        <OverviewPanel />
      </TabsContent>

      <TabsContent value="cbos" className="mt-0">
        <CBOsPanel />
      </TabsContent>

      <TabsContent value="leads" className="mt-0">
        <LeadsPanel />
      </TabsContent>

      <TabsContent value="resultados" className="mt-0">
        <ResultadosConsultasPanel />
      </TabsContent>

      <TabsContent value="margem-reprovada" className="mt-0">
        <ConsultaMargemReprovadaPanel />
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
