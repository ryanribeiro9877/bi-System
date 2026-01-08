import { useState, useEffect, useMemo } from "react";
import { FileText, Upload, Eye, ChevronLeft, ChevronRight, Search, Users, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Lead } from "@/hooks/useLeadsData";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";
import { REJECTION_COLORS, summarizeType } from "@/components/dashboard/DashboardFilters";

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

const LeadsPanel = () => {
  const navigate = useNavigate();
  const { leads, stats, filters } = useDashboard();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchCpf, setSearchCpf] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const leadsPerPage = 15;

  // Mapa de tipos de reprovação para cores
  const tipoColorMap = useMemo(() => {
    const map: Record<string, { cor: string; resumido: string }> = {};
    stats.reprovacoesPorTipo.forEach((item, index) => {
      map[item.tipo] = {
        cor: REJECTION_COLORS[index % REJECTION_COLORS.length],
        resumido: summarizeType(item.tipoCompleto || item.tipo),
      };
    });
    return map;
  }, [stats.reprovacoesPorTipo]);

  // Helper para normalizar status do lead - usa utilitário centralizado
  const getNormalizedStatus = (lead: Lead): string => {
    return normalizarStatusLead(lead);
  };
  
  // Helper para extrair valor da margem disponível
  const getValorMargem = (lead: Lead): number => {
    const margem = lead.retorno_margem as any;
    const simulacao = lead.retorno_simulacao as any;
    
    if (margem?.valorMargemDisponivel !== undefined && margem?.valorMargemDisponivel !== null) {
      return parseFloat(margem.valorMargemDisponivel) || 0;
    }
    if (simulacao?.details?.availableMarginValue !== undefined && simulacao?.details?.availableMarginValue !== null) {
      return parseFloat(simulacao.details.availableMarginValue) || 0;
    }
    return 0;
  };
  
  // Helper para extrair nome
  const getNome = (lead: Lead): string => {
    if (lead.nome) return lead.nome;
    
    const margem = lead.retorno_margem as any;
    const simulacao = lead.retorno_simulacao as any;
    
    if (margem?.registroEmpregaticio?.nomeEmpregado) return margem.registroEmpregaticio.nomeEmpregado;
    if (margem?.nomeEmpregado) return margem.nomeEmpregado;
    if (simulacao?.details?.name) return simulacao.details.name;
    if (simulacao?.name) return simulacao.name;
    
    return "-";
  };

  // Filtra e pagina os leads
  const filteredLeads = useMemo(() => {
    let list = leads;

    if (searchCpf) {
      const q = searchCpf.replace(/\D/g, "").toLowerCase();
      list = list.filter((l) => l.cpf.includes(q) || (l.nome ?? "").toLowerCase().includes(searchCpf.toLowerCase()));
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

  if (stats.totalLeads === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Leads (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lead importado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus dados de leads CLT para visualizar análises detalhadas, taxas e estatísticas.
            </p>
            <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
              <Upload className="w-4 h-4" />
              Ir para Importações
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Aprovados: {stats.leadsAprovados.toLocaleString("pt-BR")}</Badge>
            <Badge variant="secondary">Reprovados: {stats.leadsReprovados.toLocaleString("pt-BR")}</Badge>
            <span className="text-sm text-muted-foreground ml-2">{filteredLeads.length} leads</span>
          </div>
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
                    <TableHead className="text-muted-foreground w-[40px]"></TableHead>
                    <TableHead className="text-muted-foreground">CPF</TableHead>
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Banco</TableHead>
                    <TableHead className="text-muted-foreground">CBO</TableHead>
                    <TableHead className="text-muted-foreground">Valor</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Último Log</TableHead>
                    <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead) => {
                    const nome = getNome(lead);
                    const valorMargemDisponivel = getValorMargem(lead);
                    const banco = lead.banco || "-";
                    const statusNormalizado = getNormalizedStatus(lead);
                    const tipoReprovacao = lead.tipo_reprovacao;
                    const colorInfo = tipoReprovacao ? tipoColorMap[tipoReprovacao] : null;

                    return (
                      <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                        {/* Indicador de cor do tipo de reprovação */}
                        <TableCell className="px-2">
                          {colorInfo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className="w-3 h-3 rounded-full cursor-help mx-auto"
                                  style={{ backgroundColor: `hsl(${colorInfo.cor})` }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px]">
                                <p className="text-xs font-medium">{colorInfo.resumido}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="w-3 h-3 rounded-full mx-auto bg-muted" />
                          )}
                        </TableCell>
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

      {/* Lead Detail Dialog */}
      <LeadDetailDialog lead={selectedLead} open={detailOpen} onOpenChange={setDetailOpen} />
    </Card>
  );
};

export default LeadsPanel;
