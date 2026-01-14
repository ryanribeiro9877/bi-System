import { useState } from "react";
import { CheckCircle, TrendingUp, DollarSign, Eye, ChevronLeft, ChevronRight, Loader2, Search, Settings, BarChart3, Building2, Zap, Users, Download, Wallet, Filter } from "lucide-react";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { Lead } from "@/hooks/useLeadsData";
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
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import PerfilIdealPanel from "@/components/leads/PerfilIdealPanel";
import CBOsQueAprovamPanel from "@/components/leads/CBOsQueAprovamPanel";
import EmpresasPanel from "@/components/leads/EmpresasPanel";
import PorBancoPanel from "@/components/leads/PorBancoPanel";
import AnaliseImportacoesPanel from "@/components/leads/AnaliseImportacoesPanel";
import { useDashboard } from "@/contexts/DashboardContext";

// Formata data como dd/mm/aaaa - hh:nn:ss
const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    
    return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
  } catch {
    return "-";
  }
};

interface LeadSummary {
  id: string;
  cpf: string;
  nome: string;
  banco: string;
  cbo: string;
  status: string;
  valor: number;
  created_at: string;
}

const LeadsContent = () => {
  const { leads, stats, isLoading, filterOptions, pagination, goToPage, filters, setFilters } = useDashboard();
  const [searchCpf, setSearchCpf] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [bancoFilter, setBancoFilter] = useState("todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Usa estatísticas do contexto (calculadas no banco)
  const statsFiltradas = {
    totalLeads: stats.totalLeads,
    leadsAprovados: stats.leadsAprovados,
    taxaAprovacao: stats.taxaAprovacao,
    margemMedia: stats.margemMedia,
    margemTotal: stats.valorSimulacaoTotal,
  };

  // Aplica filtros via contexto
  const handleSearch = () => {
    setFilters({ ...filters, cpf: searchCpf, status: statusFilter === "todos" ? "" : statusFilter, banco: bancoFilter === "todos" ? "" : bancoFilter });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    const s = status.toLowerCase();
    if (s === "aprovado") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Aprovado</Badge>;
    if (s === "reprovado") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado</Badge>;
    if (s === "pendente") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
  };

  const kpiCards = [
    {
      title: "Total Aprovados",
      value: statsFiltradas.leadsAprovados.toLocaleString("pt-BR"),
      subtitle: "Leads com proposta aprovada",
      icon: CheckCircle,
      borderColor: "border-l-emerald-500",
      textColor: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
    {
      title: "Taxa de Aprovação",
      value: `${statsFiltradas.taxaAprovacao}%`,
      subtitle: "Do total de leads analisados",
      icon: TrendingUp,
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconBg: "bg-purple-500/20",
    },
    {
      title: "Margem Média",
      value: `R$ ${statsFiltradas.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Média dos leads aprovados",
      icon: DollarSign,
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconBg: "bg-amber-500/20",
    },
    {
      title: "Margem Total",
      value: statsFiltradas.margemTotal >= 1000000 
        ? `R$ ${(statsFiltradas.margemTotal / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
        : statsFiltradas.margemTotal >= 1000
        ? `R$ ${(statsFiltradas.margemTotal / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`
        : `R$ ${statsFiltradas.margemTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Soma das margens aprovadas",
      icon: Wallet,
      borderColor: "border-l-cyan-500",
      textColor: "text-cyan-400",
      iconBg: "bg-cyan-500/20",
    },
    {
      title: "Total Leads",
      value: statsFiltradas.totalLeads.toLocaleString("pt-BR"),
      subtitle: "Importados no sistema",
      icon: Users,
      borderColor: "border-l-blue-500",
      textColor: "text-blue-400",
      iconBg: "bg-blue-500/20",
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground mt-1">Visualize e analise os leads importados</p>
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              className="h-10 px-4 rounded-md border border-input bg-background text-sm min-w-[180px]"
              value={bancoFilter}
              onChange={(e) => setBancoFilter(e.target.value)}
            >
              <option value="todos">Todos os Bancos</option>
              {filterOptions.bancos.map((banco) => (
                <option key={banco} value={banco}>
                  {banco}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} className={`bg-card border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                    <p className={`text-3xl font-bold ${kpi.textColor}`}>{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
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
          <TabsList className="w-full grid grid-cols-6 bg-muted/50 border border-border rounded-lg p-1 h-auto">
            <TabsTrigger value="analise" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <TrendingUp className="w-4 h-4" />
              Análise
            </TabsTrigger>
            <TabsTrigger value="perfil" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <Settings className="w-4 h-4" />
              Perfil Ideal
            </TabsTrigger>
            <TabsTrigger value="cbos" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <BarChart3 className="w-4 h-4" />
              CBOs que Aprovam
            </TabsTrigger>
            <TabsTrigger value="empresas" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <Building2 className="w-4 h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="banco" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <Zap className="w-4 h-4" />
              Por Banco
            </TabsTrigger>
            <TabsTrigger value="lista" className="flex items-center justify-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 rounded-md">
              <Users className="w-4 h-4" />
              Lista de Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analise" className="mt-6">
            <AnaliseImportacoesPanel bancoFilter={bancoFilter} />
          </TabsContent>

          <TabsContent value="perfil" className="mt-6">
            <PerfilIdealPanel bancoFilter={bancoFilter} />
          </TabsContent>

          <TabsContent value="cbos" className="mt-6">
            <CBOsQueAprovamPanel bancoFilter={bancoFilter} />
          </TabsContent>

          <TabsContent value="empresas" className="mt-6">
            <EmpresasPanel bancoFilter={bancoFilter} />
          </TabsContent>

          <TabsContent value="banco" className="mt-6">
            <PorBancoPanel bancoFilter={bancoFilter} />
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
                    <p className="text-sm text-muted-foreground mt-1">Visualize e filtre todos os leads</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{pagination.totalCount.toLocaleString("pt-BR")} leads</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por CPF..." 
                      value={searchCpf} 
                      onChange={(e) => setSearchCpf(e.target.value)} 
                      onKeyDown={handleKeyDown}
                      className="pl-9 bg-background" 
                    />
                  </div>
                  <Button variant="outline" onClick={handleSearch} className="gap-2">
                    <Search className="w-4 h-4" />
                    Buscar
                  </Button>
                  <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={statusFilter} onChange={(e) => { 
                    const newStatus = e.target.value;
                    setStatusFilter(newStatus);
                    setFilters({ ...filters, status: newStatus === "todos" ? "" : newStatus });
                  }}>
                    <option value="todos">Todos</option>
                    <option value="aprovado">Aprovados</option>
                    <option value="reprovado">Reprovados</option>
                    <option value="pendente">Pendentes</option>
                  </select>
                  <Button variant="outline" className="gap-2" disabled>
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Users className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">Nenhum lead encontrado</p>
                    <p className="text-sm mt-1">Ajuste os filtros ou importe mais dados</p>
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
                            <TableHead className="text-muted-foreground">Valor</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                            <TableHead className="text-muted-foreground">Data</TableHead>
                            <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map((lead: Lead) => (
                            <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                              <TableCell className="font-mono text-foreground">{formatCpf(lead.cpf)}</TableCell>
                              <TableCell className="text-muted-foreground truncate max-w-[160px]">{lead.nome || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{lead.banco || "-"}</TableCell>
                              <TableCell className="text-foreground">
                                {lead.valor && lead.valor > 0 
                                  ? `R$ ${lead.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                                  : "-"}
                              </TableCell>
                              <TableCell>{getStatusBadge(lead.status)}</TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(lead.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setSelectedLead(lead);
                                    setDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination - usando paginação do servidor */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <span className="text-sm text-muted-foreground">
                        Página {pagination.page} de {pagination.totalPages} ({pagination.totalCount.toLocaleString("pt-BR")} leads)
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page === 1}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-3 text-sm text-muted-foreground">{pagination.page}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}>
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

        {/* Lead Detail Dialog */}
        <LeadDetailDialog lead={selectedLead} open={detailOpen} onOpenChange={setDetailOpen} />
      </div>
    </main>
  );
};

const Leads = () => {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      <LeadsContent />
    </div>
  );
};

export default Leads;
