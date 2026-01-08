import { useState, useEffect, useMemo } from "react";
import { CheckCircle, TrendingUp, DollarSign, Clock, Eye, ChevronLeft, ChevronRight, Loader2, Search, Settings, BarChart3, Building2, Zap, Users, Download } from "lucide-react";
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
import { useDashboard } from "@/contexts/DashboardContext";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";

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
  const { leads, stats, isLoading } = useDashboard();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchCpf, setSearchCpf] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const leadsPerPage = 15;

  // Helper para normalizar status do lead - usa utilitário centralizado
  const getNormalizedStatus = (lead: Lead): string => {
    return normalizarStatusLead(lead);
  };

  // Extrai nome de todas as fontes possíveis
  const extrairNome = (lead: Lead): string => {
    if (lead.nome) return lead.nome;
    const margem = lead.retorno_margem as any;
    const simulacao = lead.retorno_simulacao as any;
    const getProposta = lead.retorno_get_proposta as any;
    return margem?.nome || simulacao?.details?.name || getProposta?.name || "";
  };

  // Extrai banco de todas as fontes possíveis
  const extrairBanco = (lead: Lead): string => {
    if (lead.banco) return lead.banco;
    const simulacao = lead.retorno_simulacao as any;
    return simulacao?.bank || simulacao?.details?.bank || "";
  };

  // Extrai CBO de todas as fontes possíveis
  const extrairCBO = (lead: Lead): string => {
    if (lead.cbo) return lead.cbo;
    const margem = lead.retorno_margem as any;
    const simulacao = lead.retorno_simulacao as any;
    return margem?.cbo || margem?.codigoCBO || simulacao?.details?.cbo || "";
  };

  // Filtra e pagina os leads
  const filteredLeads = useMemo(() => {
    let list = leads;

    if (searchCpf) {
      const searchLower = searchCpf.toLowerCase().trim();
      const searchClean = searchCpf.replace(/\D/g, ""); // CPF sem formatação
      
      list = list.filter((l) => {
        // Busca por CPF (com ou sem formatação)
        if (l.cpf.includes(searchClean)) return true;
        
        // Busca por nome (todas as fontes)
        const nome = extrairNome(l).toLowerCase();
        if (nome.includes(searchLower)) return true;
        
        // Busca por banco
        const banco = extrairBanco(l).toLowerCase();
        if (banco.includes(searchLower)) return true;
        
        // Busca por CBO
        const cbo = extrairCBO(l).toLowerCase();
        if (cbo.includes(searchLower)) return true;
        
        return false;
      });
    }

    if (statusFilter !== "todos") {
      list = list.filter((l) => getNormalizedStatus(l) === statusFilter);
    }

    return list;
  }, [leads, searchCpf, statusFilter]);

  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchCpf, statusFilter]);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">? CPF Não Encontrado</Badge>;
    const s = status.toLowerCase();
    if (s === "aprovado") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Aprovado</Badge>;
    if (s === "reprovado") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado</Badge>;
    if (s === "pendente") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    if (s === "cpf_nao_encontrado" || s === "cpf não encontrado") return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">? CPF Não Encontrado</Badge>;
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">? CPF Não Encontrado</Badge>;
  };

  const kpiCards = [
    {
      title: "Total Aprovados",
      value: stats.leadsAprovados.toLocaleString("pt-BR"),
      subtitle: "Leads com proposta aprovada",
      icon: CheckCircle,
      borderColor: "border-l-emerald-500",
      textColor: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
    {
      title: "Taxa de Aprovação",
      value: `${stats.taxaAprovacao}%`,
      subtitle: "Do total de leads analisados",
      icon: TrendingUp,
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconBg: "bg-purple-500/20",
    },
    {
      title: "Margem Média",
      value: `R$ ${stats.margemMedia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Média dos leads aprovados",
      icon: DollarSign,
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconBg: "bg-amber-500/20",
    },
    {
      title: "Total Leads",
      value: stats.totalLeads.toLocaleString("pt-BR"),
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground mt-1">Visualize e analise os leads importados</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <TabsList className="w-full grid grid-cols-5 bg-muted/50 border border-border rounded-lg p-1 h-auto">
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
                    <p className="text-sm text-muted-foreground mt-1">Visualize e filtre todos os leads</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{filteredLeads.length} leads</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar por CPF ou nome..." value={searchCpf} onChange={(e) => setSearchCpf(e.target.value)} className="pl-9 bg-background" />
                  </div>
                  <select className="h-10 px-3 rounded-md border border-input bg-background text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
                {paginatedLeads.length === 0 ? (
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
                            <TableHead className="text-muted-foreground">CBO</TableHead>
                            <TableHead className="text-muted-foreground">Valor</TableHead>
                            <TableHead className="text-muted-foreground">Status</TableHead>
                            <TableHead className="text-muted-foreground">Data</TableHead>
                            <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLeads.map((lead) => {
                            const margem = lead.retorno_margem as any;
                            const nome = lead.nome || margem?.registroEmpregaticio?.nomeEmpregado || margem?.nomeEmpregado || "-";
                            const valorMargemDisponivel = margem?.valorMargemDisponivel || 0;
                            const banco = lead.banco || "-";
                            const statusNormalizado = getNormalizedStatus(lead);

                            return (
                              <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                                <TableCell className="font-mono text-foreground">{formatCpf(lead.cpf)}</TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[160px]">{nome}</TableCell>
                                <TableCell className="text-muted-foreground">{banco}</TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[100px]">{lead.cbo || "-"}</TableCell>
                                <TableCell className="text-foreground">
                                  {statusNormalizado === "aprovado" && valorMargemDisponivel > 0 
                                    ? `R$ ${valorMargemDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                                    : "-"}
                                </TableCell>
                                <TableCell>{getStatusBadge(statusNormalizado)}</TableCell>
                                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(lead.ultimo_log)}</TableCell>
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
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <span className="text-sm text-muted-foreground">
                        Mostrando {(currentPage - 1) * leadsPerPage + 1} a {Math.min(currentPage * leadsPerPage, filteredLeads.length)} de {filteredLeads.length.toLocaleString("pt-BR")}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-3 text-sm text-muted-foreground">Página {currentPage} de {totalPages || 1}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages || totalPages === 0}>
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
