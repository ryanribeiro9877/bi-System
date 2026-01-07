import { BarChart3, Building2, Briefcase, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewPanel from "./panels/OverviewPanel";
import BanksPanel from "./panels/BanksPanel";
import CBOsPanel from "./panels/CBOsPanel";
import LeadsPanel from "./panels/LeadsPanel";

const DashboardTabs = () => {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full h-12 bg-muted/50 border border-border rounded-lg p-1 mb-6">
        <TabsTrigger
          value="overview"
          className="flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Visão Geral
        </TabsTrigger>
        <TabsTrigger
          value="banks"
          className="flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Bancos
        </TabsTrigger>
        <TabsTrigger
          value="cbos"
          className="flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all"
        >
          <Briefcase className="h-4 w-4 mr-2" />
          CBOs
        </TabsTrigger>
        <TabsTrigger
          value="leads"
          className="flex-1 h-full data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=active]:shadow-sm rounded-md transition-all"
        >
          <Users className="h-4 w-4 mr-2" />
          Leads
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        <OverviewPanel />
      </TabsContent>

      <TabsContent value="banks" className="mt-0">
        <BanksPanel />
      </TabsContent>

      <TabsContent value="cbos" className="mt-0">
        <CBOsPanel />
      </TabsContent>

      <TabsContent value="leads" className="mt-0">
        <LeadsPanel />
      </TabsContent>
    </Tabs>
  );
};

export default DashboardTabs;
