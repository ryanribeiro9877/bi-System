import { useEffect, useMemo, useState } from "react";
import { FileText, Upload, Eye, ChevronLeft, ChevronRight, Search, Users, Download, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { LeadListItem } from "@/hooks/useLeadsPaginated";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { useLeadsQuery, useLeadDetails } from "@/hooks/useLeadsQuery";

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
  const { stats, isLoading: isLoadingDashboard, filters, setFilters } = useDashboard();
  const [searchCpf, setSearchCpf] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { lead } = useLeadDetails(selectedLeadId);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [listStatus, setListStatus] = useState("aprovado");

  const listFilters = useMemo(
    () => ({
      ...filters,
      status: listStatus === "todos" ? "" : listStatus,
    }),
    [filters, listStatus]
  );

  useEffect(() => {
    setPage(1);
  }, [listFilters]);

  const { leads, totalCount, isLoading: isLoadingLeads } = useLeadsQuery(listFilters, page, pageSize);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);

  const goToPage = (nextPage: number) => {
    if (nextPage >= 1 && nextPage <= totalPages) {
      setPage(nextPage);
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

  // Busca por CPF - atualiza filtros do contexto
  const handleSearch = () => {
    setFilters({ ...filters, cpf: searchCpf });
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Filtro por status
  const handleStatusFilter = (status: string) => {
    setListStatus(status === "todos" ? "todos" : status);
    setPage(1);
  };

  const isLoading = isLoadingDashboard || isLoadingLeads;

  if (stats.totalLeads === 0 && !isLoadingDashboard && !isLoadingLeads) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Contratos Digitados (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum contrato digitado importado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus dados de contratos digitados para visualizar análises detalhadas, taxas e estatísticas.
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
              Lista de Contratos Digitados
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Visualize e filtre todos os contratos digitados</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Aprovados: {stats.leadsAprovados.toLocaleString("pt-BR")}</Badge>
            <Badge variant="secondary">Reprovados: {stats.leadsReprovados.toLocaleString("pt-BR")}</Badge>
            <span className="text-sm text-muted-foreground ml-2">{totalCount.toLocaleString("pt-BR")} contratos</span>
          </div>
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
          <select 
            className="h-10 px-3 rounded-md border border-input bg-background text-sm" 
            value={listStatus || "todos"} 
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-12 h-12 mb-4 animate-spin" />
            <p className="text-lg font-medium text-foreground">Carregando contratos digitados...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground">Nenhum contrato digitado encontrado</p>
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
                  {leads.map((lead: LeadListItem) => {
                    const banco = lead.banco || "-";
                    const status = lead.status || "pendente";

                    return (
                      <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                        <TableCell className="font-mono text-foreground">{formatCpf(lead.cpf)}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[160px]">{lead.nome || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{banco}</TableCell>
                        <TableCell className="text-foreground">
                          {lead.valor && lead.valor > 0 
                            ? `R$ ${lead.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(lead.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedLeadId(lead.id);
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

            {/* Pagination - usando paginação do servidor */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({totalCount.toLocaleString("pt-BR")} leads)
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => goToPage(1)} 
                  disabled={page === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => goToPage(page - 1)} 
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  {page}
                </span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => goToPage(page + 1)} 
                  disabled={page === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => goToPage(totalPages)} 
                  disabled={page === totalPages || totalPages === 0}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Lead Detail Dialog - agora carrega detalhes sob demanda */}
      <LeadDetailDialog lead={lead} open={detailOpen} onOpenChange={setDetailOpen} />
    </Card>
  );
};

export default LeadsPanel;