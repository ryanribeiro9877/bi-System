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
      <div className="overflow-x-auto mb-6">
        <TabsList className="inline-flex min-w-full h-12 bg-muted/50 border border-border rounded-lg p-1">
          <TabsTrigger
            value="overview"
            className="flex-1 min-w-[120px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="cbos"
            className="flex-1 min-w-[80px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap"
          >
            <Briefcase className="h-4 w-4 mr-2 flex-shrink-0" />
            CBOs
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="flex-1 min-w-[160px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap"
          >
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            Contratos Digitados
          </TabsTrigger>
          <TabsTrigger
            value="resultados"
            className="flex-1 min-w-[200px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap"
          >
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            Resultados das Consultas
          </TabsTrigger>
          <TabsTrigger
            value="margem-reprovada"
            className="flex-1 min-w-[220px] h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all whitespace-nowrap"
          >
            <TrendingDown className="h-4 w-4 mr-2 flex-shrink-0" />
            Margem Reprovada
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
