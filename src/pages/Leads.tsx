import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, TrendingUp, DollarSign, Clock, Eye, ChevronLeft, ChevronRight, Loader2, Search, Settings, BarChart3, Building2, Zap, Users, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import PerfilIdealPanel from "@/components/leads/PerfilIdealPanel";
import CBOsQueAprovamPanel from "@/components/leads/CBOsQueAprovamPanel";
import EmpresasPanel from "@/components/leads/EmpresasPanel";
import PorBancoPanel from "@/components/leads/PorBancoPanel";

interface LeadStats {
  totalAprovados: number;
  taxaAprovacao: number;
  margemMedia: number;
  tempoMedioVinculo: number;
  totalLeads: number;
}

interface Lead {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  cbo: string | null;
  status: string | null;
  valor: number | null;
  created_at: string;
}

const Leads = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<LeadStats>({
    totalAprovados: 0,
    taxaAprovacao: 0,
    margemMedia: 0,
    tempoMedioVinculo: 0,
    totalLeads: 0,
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchCpf, setSearchCpf] = useState("");
  const leadsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchLeads();
    }
  }, [user, currentPage, searchCpf]);

  const fetchStats = async () => {
    try {
      // Fetch total leads count
      const { count: totalCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      // Fetch approved leads count
      const { count: approvedCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .ilike("status", "%aprovado%");

      // Fetch average margin for approved leads
      const { data: marginData } = await supabase
        .from("leads")
        .select("valor")
        .ilike("status", "%aprovado%")
        .not("valor", "is", null);

      const margemMedia = marginData && marginData.length > 0
        ? marginData.reduce((sum, lead) => sum + (lead.valor || 0), 0) / marginData.length
        : 0;

      const taxaAprovacao = totalCount && totalCount > 0
        ? ((approvedCount || 0) / totalCount) * 100
        : 0;

      // Tempo médio de vínculo - placeholder (would need employment data)
      const tempoMedioVinculo = 24; // Placeholder - 24 months

      setStats({
        totalAprovados: approvedCount || 0,
        taxaAprovacao,
        margemMedia,
        tempoMedioVinculo,
        totalLeads: totalCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, cpf, nome, banco, cbo, status, valor, created_at")
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage - 1);

      if (searchCpf) {
        query = query.ilike("cpf", `%${searchCpf.replace(/\D/g, "")}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(stats.totalLeads / leadsPerPage);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">-</Badge>;
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes("aprovado")) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          ✓ Aprovado
        </Badge>
      );
    }
    if (statusLower.includes("reprovado") || statusLower.includes("negado")) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          ✕ Reprovado
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
        ◐ Pendente
      </Badge>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const kpiCards = [
    {
      title: "Total Aprovados",
      value: stats.totalAprovados.toLocaleString("pt-BR"),
      subtitle: "Leads com proposta aprovada",
      icon: CheckCircle,
      color: "emerald",
      borderColor: "border-l-emerald-500",
      textColor: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
    {
      title: "Taxa de Aprovação",
      value: `${stats.taxaAprovacao.toFixed(1)}%`,
      subtitle: "Do total de leads analisados",
      icon: TrendingUp,
      color: "purple",
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconBg: "bg-purple-500/20",
    },
    {
      title: "Margem Média",
      value: `R$ ${stats.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Margem média dos aprovados",
      icon: DollarSign,
      color: "amber",
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconBg: "bg-amber-500/20",
    },
    {
      title: "Tempo Médio Vínculo",
      value: `${stats.tempoMedioVinculo} meses`,
      subtitle: "Tempo médio de emprego",
      icon: Clock,
      color: "orange",
      borderColor: "border-l-orange-500",
      textColor: "text-orange-400",
      iconBg: "bg-orange-500/20",
    },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e gerencie os leads importados
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => (
              <Card 
                key={kpi.title} 
                className={`bg-card border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}
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
                      <p className="text-xs text-muted-foreground">
                        {kpi.subtitle}
                      </p>
                    </div>
                    <div className={`p-2 rounded-full ${kpi.iconBg}`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Topic Tabs */}
          <Tabs defaultValue="lista" className="w-full">
            <TabsList className="w-full grid grid-cols-5 bg-muted/50 border border-border rounded-lg p-1 h-auto">
              <TabsTrigger 
                value="perfil" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
              >
                <Settings className="w-4 h-4" />
                Perfil Ideal
              </TabsTrigger>
              <TabsTrigger 
                value="cbos" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
              >
                <BarChart3 className="w-4 h-4" />
                CBOs que Aprovam
              </TabsTrigger>
              <TabsTrigger 
                value="empresas" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
              >
                <Building2 className="w-4 h-4" />
                Empresas
              </TabsTrigger>
              <TabsTrigger 
                value="banco" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
              >
                <Zap className="w-4 h-4" />
                Por Banco
              </TabsTrigger>
              <TabsTrigger 
                value="lista" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md"
              >
                <Users className="w-4 h-4" />
                Lista de Leads
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-6">
              <PerfilIdealPanel />
            </TabsContent>

            <TabsContent value="cbos" className="mt-6">
              <CBOsQueAprovamPanel />
            </TabsContent>

            <TabsContent value="empresas" className="mt-6">
              <EmpresasPanel />
            </TabsContent>

            <TabsContent value="banco" className="mt-6">
              <PorBancoPanel />
            </TabsContent>

            <TabsContent value="lista" className="mt-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="w-5 h-5" />
                        Lista de Leads
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Visualize e filtre todos os leads cadastrados
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {stats.totalLeads} leads
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por CPF, nome ou empresa..."
                        value={searchCpf}
                        onChange={(e) => {
                          setSearchCpf(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-9 bg-background"
                      />
                    </div>
                    <select 
                      className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                      defaultValue="aprovados"
                    >
                      <option value="todos">Todos</option>
                      <option value="aprovados">Aprovados</option>
                      <option value="reprovados">Reprovados</option>
                      <option value="pendentes">Pendentes</option>
                    </select>
                    <Button variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Users className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium text-foreground">Nenhum lead encontrado</p>
                      <p className="text-sm mt-1">
                        Importe dados usando o botão "Importar Excel" no dashboard
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="text-muted-foreground">CPF</TableHead>
                              <TableHead className="text-muted-foreground">Nome</TableHead>
                              <TableHead className="text-muted-foreground">Banco</TableHead>
                              <TableHead className="text-muted-foreground">CBO</TableHead>
                              <TableHead className="text-muted-foreground">Valor</TableHead>
                              <TableHead className="text-muted-foreground">Status</TableHead>
                              <TableHead className="text-muted-foreground">Data</TableHead>
                              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leads.map((lead) => (
                              <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                                <TableCell className="font-mono text-foreground">
                                  {formatCpf(lead.cpf)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {lead.nome || "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {lead.banco || "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {lead.cbo || "-"}
                                </TableCell>
                                <TableCell className="text-foreground">
                                  {lead.valor 
                                    ? `R$ ${lead.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                    : "-"
                                  }
                                </TableCell>
                                <TableCell>{getStatusBadge(lead.status)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {new Date(lead.created_at).toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <span className="text-sm text-muted-foreground">
                          Mostrando {(currentPage - 1) * leadsPerPage + 1} a{" "}
                          {Math.min(currentPage * leadsPerPage, stats.totalLeads)} de{" "}
                          {stats.totalLeads.toLocaleString("pt-BR")}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Leads;
