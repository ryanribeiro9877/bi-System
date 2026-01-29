import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle, TrendingUp, DollarSign, Eye, ChevronLeft, ChevronRight, Loader2, Users, Wallet, Settings, BarChart3, Building2, Zap, Search, Download, Pencil, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { Lead } from "@/hooks/useLeadsData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { extrairValorMargemDisponivelLead, extrairCBOCodigo, extrairCBOCompleto, extrairDadosTrabalhador, normalizarStatusLead, extrairMotivoReprovacaoTecnica } from "@/lib/leadStatusUtils";
import { parseJsonSafe } from "@/types/lead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchLeadDetails } from "@/hooks/useLeadsQuery";

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
  const { leads, allLeads, stats, isLoading, pagination, goToPage, filters, setFilters, refetch } = useDashboard();
  const { toast } = useToast();
  const [searchCpf, setSearchCpf] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [listStatus, setListStatus] = useState("aprovado");
  const [tab, setTab] = useState("lista");
  
  // Estados para edição de pagamento
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para reimportação de lead
  const [editTab, setEditTab] = useState<"pagamento" | "reimportar">("pagamento");
  const [reimportFile, setReimportFile] = useState<File | null>(null);
  const [reimportError, setReimportError] = useState<string | null>(null);
  const [isReimporting, setIsReimporting] = useState(false);

  // Helper para determinar status de pagamento de um lead
  const getStatusPagamento = (lead: Lead): "pago" | "aguardando" | "reprovado_cancelado" => {
    const leadAny = lead as unknown as Record<string, unknown>;
    const manualStatus = leadAny.pagamento_status as string | null;
    
    if (manualStatus) {
      if (manualStatus === "pago") return "pago";
      if (manualStatus === "reprovado_cancelado") return "reprovado_cancelado";
      if (manualStatus === "aguardando") return "aguardando";
    }
    
    const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
    const statusDescription = getProposta?.statusDescription;
    if (typeof statusDescription !== "string") return "aguardando";
    
    const normalize = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    const sd = normalize(statusDescription);
    const pagos = ["encerrado", "liquidacao", "liquidacao manual", "pago", "liquidado"];
    const reprovadosCancelados = ["cancelada", "cancelado", "reprovado"];
    
    if (pagos.includes(sd)) return "pago";
    if (reprovadosCancelados.includes(sd)) return "reprovado_cancelado";
    return "aguardando";
  };

  // Calcula estatísticas com nova lógica:
  // - Total Aprovados = total de leads com status aprovado ou reprovacao_tecnica
  // - Margem Média = soma das margens / quantidade de aprovados
  // - Taxa de Aprovação = (leads aprovados com pagamento pago/aguardando)
  const statsFiltradas = useMemo(() => {
    const totalLeads = stats.totalLeads;

    // Total Aprovados: considera todos os aprovados (verde) + reprovação técnica
    const aprovadosParaMargem = allLeads.filter((l) => {
      const status = (l.status || "").toLowerCase();
      return status === "aprovado" || status === "approved" || status === "reprovacao_tecnica";
    });
    
    const leadsAprovados = aprovadosParaMargem.length;

    // Margem Média: soma das margens / quantidade de aprovados (TODOS aprovados, não apenas os com margem)
    // Fórmula: totalValorMargemDisponivel / quantidadeLeadsAprovados
    const margens = aprovadosParaMargem
      .map((l) => extrairValorMargemDisponivelLead(l))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

    const somaMargens = margens.reduce((acc, v) => acc + v, 0);
    // Dividir pela quantidade de leads aprovados (todos), não pela quantidade que tem margem
    const margemMedia = leadsAprovados > 0 ? somaMargens / leadsAprovados : 0;

    // Taxa de Aprovação = (aprovados com pagamento pago/aguardando) / (total de aprovados)
    const leadsAprovadosComPagamentoPositivo = allLeads.filter(l => {
      const status = (l.status || "").toLowerCase();
      if (status !== "aprovado" && status !== "approved") return false;
      const statusPag = getStatusPagamento(l);
      return statusPag === "pago" || statusPag === "aguardando";
    }).length;
    
    const taxaAprovacao = leadsAprovados > 0 
      ? parseFloat(((leadsAprovadosComPagamentoPositivo / leadsAprovados) * 100).toFixed(2)) 
      : 0;
    
    return {
      totalLeads,
      leadsAprovados,
      taxaAprovacao,
      margemMedia,
      margemTotal: stats.valorSimulacaoTotal,
    };
  }, [stats, allLeads]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const aprovadosParaMargem = allLeads.filter((l) => {
      const status = (l.status || "").toLowerCase();
      return status === "aprovado" || status === "approved" || status === "reprovacao_tecnica";
    });

    const margens = aprovadosParaMargem
      .map((l) => extrairValorMargemDisponivelLead(l))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

    const somaMargens = margens.reduce((acc, v) => acc + v, 0);
    const totalAprovados = aprovadosParaMargem.length;
    const margemMedia = totalAprovados > 0 ? somaMargens / totalAprovados : 0;

    const first = aprovadosParaMargem[0] as unknown as Record<string, unknown> | undefined;
    const rm = first?.retorno_margem as unknown;
    const rmIsObject = !!rm && typeof rm === "object";
    const rmKeys = rmIsObject ? Object.keys(rm as Record<string, unknown>) : [];
    const registro = rmIsObject ? (rm as Record<string, unknown>).registroEmpregaticio : undefined;
    const registroKeys = registro && typeof registro === "object" ? Object.keys(registro as Record<string, unknown>) : [];
    const direct = rmIsObject ? (rm as Record<string, unknown>).valorMargemDisponivel : null;
    const nested = registro && typeof registro === "object" ? (registro as Record<string, unknown>).valorMargemDisponivel : null;

    // Não logar JSON bruto. Apenas contagens/valores.
    console.log("[MargemMediaDebug]", {
      totalAllLeads: allLeads.length,
      aprovadosParaMargem: aprovadosParaMargem.length,
      aprovadosComMargemExtraida: margens.length,
      somaMargens: somaMargens,
      exemploMargens: margens.slice(0, 5),
      retornoMargemType: typeof rm,
      retornoMargemIsArray: Array.isArray(rm),
      retornoMargemKeys: rmKeys.slice(0, 30),
      registroEmpregaticioKeys: registroKeys.slice(0, 30),
      sampleValorMargemDisponivel_direct: direct,
      sampleValorMargemDisponivel_registroEmpregaticio: nested,
    });

    // Resposta direta: valor total das margens dos clientes com status aprovado
    console.log("[ValorTotalMargensAprovados]", `R$ ${somaMargens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }, [allLeads]);

  // Aplica filtros via contexto
  const handleSearch = () => {
    if (listStatus === "todos") {
      // KPIs: manter status "aprovado" (RPC de stats usa apenas filters.status)
      // Lista: buscar aprovados + reprovacao_tecnica
      setFilters({
        ...filters,
        cpf: searchCpf,
        status: "aprovado",
        statuses: ["aprovado", "approved", "reprovacao_tecnica"],
      });
      return;
    }

    if (listStatus === "aprovado") {
      // Lista: aprovado + reprovacao_tecnica (reprovacao_tecnica é tratado como aprovado na UI)
      // KPIs: manter status "aprovado" para não alterar stats da RPC
      setFilters({
        ...filters,
        cpf: searchCpf,
        status: "aprovado",
        statuses: ["aprovado", "approved", "reprovacao_tecnica"],
      });
      return;
    }

    if (listStatus === "reprovacao_tecnica") {
      // Lista: apenas reprovacao_tecnica (mas na UI o status aparecerá como aprovado)
      // KPIs: manter status "aprovado" para não alterar stats da RPC
      setFilters({
        ...filters,
        cpf: searchCpf,
        status: "aprovado",
        statuses: ["reprovacao_tecnica"],
      });
      return;
    }

    setFilters({ ...filters, cpf: searchCpf, status: listStatus, statuses: undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Aplica filtro local e limpa ao sair da página
  // "Todos" agora significa apenas aprovados + reprovação técnica
  useEffect(() => {
    if (listStatus === "todos") {
      // KPIs: manter status "aprovado" (RPC de stats usa apenas filters.status)
      // Lista: buscar aprovados + reprovacao_tecnica
      setFilters({ 
        ...filters, 
        status: "aprovado",
        statuses: ["aprovado", "approved", "reprovacao_tecnica"],
        tiposReprovacaoMultiplos: [],
      });
    } else if (listStatus === "aprovado") {
      setFilters({
        ...filters,
        status: "aprovado",
        statuses: ["aprovado", "approved", "reprovacao_tecnica"],
        tiposReprovacaoMultiplos: [],
      });
    } else if (listStatus === "reprovacao_tecnica") {
      setFilters({
        ...filters,
        status: "aprovado",
        statuses: ["reprovacao_tecnica"],
        tiposReprovacaoMultiplos: [],
      });
    } else {
      setFilters({ ...filters, status: listStatus, statuses: undefined, tiposReprovacaoMultiplos: [] });
    }
    
    // Limpa o filtro de status ao desmontar (sair da página)
    return () => {
      setFilters({ ...filters, status: "", statuses: undefined, tiposReprovacaoMultiplos: [] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listStatus]);

  // A lista já vem filtrada do backend (via filters.statuses quando necessário)
  const leadsFiltrados = leads;

  // Funções para edição de pagamento
  const openPaymentEdit = (lead: Lead) => {
    setEditingLead(lead);
    // Preenche com valores atuais se existirem (campos podem não existir ainda no tipo)
    const leadAny = lead as unknown as Record<string, unknown>;
    setPaymentStatus((leadAny.pagamento_status as string) || "");
    setPaymentDescription((leadAny.pagamento_descricao as string) || "");
    setEditPaymentOpen(true);
  };

  const closePaymentEdit = () => {
    setEditPaymentOpen(false);
    setEditingLead(null);
    setPaymentStatus("");
    setPaymentDescription("");
    setEditTab("pagamento");
    setReimportFile(null);
    setReimportError(null);
  };

  // Função para normalizar nome de coluna (igual ao Importacoes.tsx)
  const normalizeColumnName = (col: string): string => {
    const normalized = col
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    
    const mappings: Record<string, string> = {
      "cpf": "cpf",
      "documento": "cpf",
      "nome": "nome",
      "nome_completo": "nome",
      "banco": "banco",
      "instituicao": "banco",
      "cbo": "cbo",
      "ocupacao": "cbo",
      "status": "status",
      "situacao": "status",
      "tipo_reprovacao": "tipo_reprovacao",
      "motivo_reprovacao": "tipo_reprovacao",
      "motivo": "tipo_reprovacao",
      "valor": "valor",
      "valor_contrato": "valor",
      "data_envio": "data_envio",
      "data_retorno": "data_retorno",
      "observacoes": "observacoes",
      "obs": "observacoes",
      "retorno_autorizacao": "retorno_autorizacao",
      "retorno_margem": "retorno_margem",
      "retorno_simulacao": "retorno_simulacao",
      "retorno_proposta": "retorno_proposta",
      "retorno_get_proposta": "retorno_get_proposta",
      "retornogetproposta": "retorno_get_proposta",
      "ultimo_log": "ultimo_log",
    };

    return mappings[normalized] || normalized;
  };

  // Processa linha do arquivo para reimportação
  const processReimportRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const lead: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeColumnName(key);
      
      switch (normalizedKey) {
        case "cpf":
          lead.cpf = String(value).replace(/\D/g, "");
          break;
        case "nome":
          lead.nome = value;
          break;
        case "banco":
          lead.banco = value;
          break;
        case "cbo":
          lead.cbo = value;
          break;
        case "status":
          lead.status = value;
          break;
        case "tipo_reprovacao":
          lead.tipo_reprovacao = value;
          break;
        case "valor":
          lead.valor = parseFloat(String(value)) || null;
          break;
        case "data_envio":
          lead.data_envio = value;
          break;
        case "data_retorno":
          lead.data_retorno = value;
          break;
        case "observacoes":
          lead.observacoes = value;
          break;
        case "retorno_autorizacao":
          lead.retorno_autorizacao = parseJsonSafe(value);
          break;
        case "retorno_margem":
          lead.retorno_margem = parseJsonSafe(value);
          break;
        case "retorno_simulacao":
          lead.retorno_simulacao = parseJsonSafe(value);
          break;
        case "retorno_proposta":
          lead.retorno_proposta = parseJsonSafe(value);
          break;
        case "retorno_get_proposta":
          lead.retorno_get_proposta = parseJsonSafe(value);
          break;
        case "ultimo_log":
          lead.ultimo_log = value;
          break;
      }
    }
    
    return lead;
  };

  // Função para processar arquivo de reimportação
  const handleReimportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setReimportFile(file);
    setReimportError(null);
  };

  // Função para executar a reimportação
  const executeReimport = async () => {
    if (!editingLead || !reimportFile) {
      setReimportError("Selecione um arquivo para reimportar");
      return;
    }

    setIsReimporting(true);
    setReimportError(null);

    try {
      // Ler o arquivo
      const fileExtension = reimportFile.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, unknown>[] = [];

      if (fileExtension === "csv") {
        // Parse CSV
        const text = await reimportFile.text();
        const Papa = (await import("papaparse")).default;
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = result.data as Record<string, unknown>[];
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        // Parse Excel
        const data = await reimportFile.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null }) as Record<string, unknown>[];
      } else {
        throw new Error("Formato de arquivo não suportado. Use CSV ou XLSX.");
      }

      if (rows.length === 0) {
        throw new Error("Arquivo vazio ou sem dados válidos");
      }

      // PASSO 1: Primeiro, extrair todos os CPFs do arquivo para validação
      const targetCpf = editingLead.cpf.replace(/\D/g, "");
      let foundRow: Record<string, unknown> | null = null;
      let foundCpfInFile: string | null = null;

      // Procurar o CPF no arquivo
      for (const row of rows) {
        // Extrair CPF da linha (antes de processar todos os campos)
        let cpfFromRow: string | null = null;
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = normalizeColumnName(key);
          if (normalizedKey === "cpf" && value) {
            cpfFromRow = String(value).replace(/\D/g, "");
            break;
          }
        }
        
        // PASSO 2: Validar se o CPF do arquivo corresponde ao CPF do lead atual
        if (cpfFromRow === targetCpf) {
          foundCpfInFile = cpfFromRow;
          foundRow = processReimportRow(row);
          break;
        }
      }

      // PASSO 3: Se CPF não encontrado, mostrar erro claro
      if (!foundCpfInFile || !foundRow) {
        throw new Error(
          `CPF ${formatCpf(editingLead.cpf)} não encontrado no arquivo importado. ` +
          `Verifique se o arquivo contém o lead correto.`
        );
      }

      // PASSO 4: Atualizar APENAS o retorno_get_proposta
      // Mantém todos os outros dados do lead inalterados
      const updateData: Record<string, unknown> = {
        retorno_get_proposta: foundRow.retorno_get_proposta || null,
      };

      // PASSO 5: Atualizar o lead no banco de dados
      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", editingLead.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status de pagamento atualizado com sucesso",
      });

      closePaymentEdit();
      refetch();
    } catch (error) {
      console.error("Erro ao reimportar lead:", error);
      setReimportError(error instanceof Error ? error.message : "Erro ao reimportar lead");
    } finally {
      setIsReimporting(false);
    }
  };

  const savePaymentStatus = async () => {
    if (!editingLead || !paymentStatus) {
      toast({
        title: "Erro",
        description: "Selecione um status de pagamento",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Usa Record para permitir campos dinâmicos que podem não estar no tipo ainda
      const updateData: Record<string, unknown> = {
        pagamento_status: paymentStatus,
        pagamento_descricao: paymentDescription,
        pagamento_updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", editingLead.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status de pagamento atualizado com sucesso",
      });

      closePaymentEdit();
      refetch(); // Atualiza a lista
    } catch (error) {
      console.error("Erro ao salvar status de pagamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o status de pagamento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
    if (s === "reprovacao_tecnica") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Aprovado</Badge>;
    if (s === "pendente") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
  };

  const getPagamentoBadge = (lead: Lead) => {
    // Para reprovação técnica: mostrar no campo Pagamento (e status fica como aprovado)
    if ((lead.status || "").toLowerCase() === "reprovacao_tecnica") {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">⚠ Reprovação Técnica</Badge>;
    }

    // Prioriza status manual sobre automático
    const leadAny = lead as unknown as Record<string, unknown>;
    const manualStatus = leadAny.pagamento_status as string | null;
    
    // Se tem status manual, usa ele
    if (manualStatus) {
      if (manualStatus === "pago") {
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Pago</Badge>;
      }
      if (manualStatus === "reprovado_cancelado") {
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado/Cancelado</Badge>;
      }
      if (manualStatus === "aguardando") {
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Aguardando</Badge>;
      }
    }
    
    // Senão, usa o statusDescription do retorno_get_proposta
    const extractStatusDescription = (obj: unknown): string | null => {
      if (!obj || typeof obj !== "object") return null;
      const o = obj as Record<string, unknown>;
      if (typeof o.statusDescription === "string") return o.statusDescription;
      return null;
    };

    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const raw = extractStatusDescription(lead.retorno_get_proposta);
    if (!raw) return "-";

    const sd = normalize(raw);

    // Pagos: statusDescription IN (Encerrado, Liquidação, Liquidação Manual, Pago, Liquidado)
    const pagos = ["Encerrado", "Liquidação", "Liquidação Manual", "Pago", "Liquidado"].map(normalize);
    // Reprovados/Cancelados: statusDescription IN (Cancelada, Cancelado, Reprovado)
    const reprovadosCancelados = ["Cancelada", "Cancelado", "Reprovado"].map(normalize);

    if (pagos.includes(sd)) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Pago</Badge>;
    }

    if (reprovadosCancelados.includes(sd)) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado/Cancelado</Badge>;
    }

    // Aguardando: statusDescription NOT IN (Encerrado, Liquidação, Liquidação Manual, Pago, Cancelada, Cancelado, Reprovado)
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Aguardando</Badge>;
  };

  const formatCurrencyCompact = (value: number) => {
    const v = value || 0;
    if (v >= 1_000_000_000_000) {
      return `R$ ${(v / 1_000_000_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`;
    }
    if (v >= 1_000_000_000) {
      return `R$ ${(v / 1_000_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} B`;
    }
    if (v >= 1_000_000) {
      return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
    }
    if (v >= 1_000) {
      return `R$ ${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} K`;
    }
    return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyFull = (value: number) => {
    return `R$ ${(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Função para extrair apenas o número do CBO (usando a nova função de extração)
  const extrairNumeroCBO = (lead: Record<string, unknown>): string => {
    // Primeiro tenta extrair do retorno_margem usando a nova função
    const cboExtraido = extrairCBOCodigo(lead as Lead);
    if (cboExtraido) return cboExtraido;
    
    // Fallback: tentar do campo cbo do lead
    if (!lead.cbo) return "-";
    
    const cbo = lead.cbo;
    
    // Se já é só número
    if (typeof cbo === 'string' && /^\d+$/.test(cbo)) return cbo;
    
    // Se está no formato "codigo - descricao"
    if (typeof cbo === 'string') {
      const match = cbo.match(/^(\d+)/);
      if (match) return match[1];
    }
    
    // Se é objeto com codigo
    if (typeof cbo === 'object' && cbo && (cbo as Record<string, unknown>).codigo) {
      return String((cbo as Record<string, unknown>).codigo);
    }
    
    // Retorna o valor original se não conseguir extrair
    return String(cbo);
  };

  const kpiCards = [
    {
      title: "Total Aprovados",
      value: statsFiltradas.leadsAprovados.toLocaleString("pt-BR"),
      subtitle: "Contratos digitados com proposta aprovada",
      icon: CheckCircle,
      borderColor: "border-l-emerald-500",
      textColor: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
    {
      title: "Taxa de Aprovação",
      value: `${statsFiltradas.taxaAprovacao}%`,
      subtitle: "Do total de contratos digitados",
      icon: TrendingUp,
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconBg: "bg-purple-500/20",
    },
    {
      title: "Margem Média",
      value: formatCurrencyCompact(statsFiltradas.margemMedia),
      subtitle: "Média dos contratos aprovados",
      icon: DollarSign,
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconBg: "bg-amber-500/20",
    },
    {
      title: "Valor Total\nde Digitação",
      value: formatCurrencyFull(statsFiltradas.margemTotal),
      subtitle: "Soma das margens\naprovadas",
      icon: Wallet,
      borderColor: "border-l-cyan-500",
      textColor: "text-cyan-400",
      iconBg: "bg-cyan-500/20",
    },
    {
      title: "Leads Aptos a\nPagamentos",
      value: statsFiltradas.totalLeads.toLocaleString("pt-BR"),
      subtitle: "Dos leads aprovados",
      icon: Users,
      borderColor: "border-l-blue-500",
      textColor: "text-blue-400",
      iconBg: "bg-blue-500/20",
    },
  ];

  if (isLoading) {
    return (
      <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }
  return (
    <main className="flex-1 p-4 pt-20 lg:pt-4 lg:p-8 overflow-auto w-full min-w-0">
      <div className="max-w-7xl mx-auto space-y-4 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Contratos Digitados</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">Visualize e analise os contratos importados</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-4">
          {kpiCards.map((kpi) => {
            const titleClass = "text-xs lg:text-sm font-medium text-muted-foreground";
            const valueClass = `text-lg sm:text-xl lg:text-3xl font-bold ${kpi.textColor}`;

            return (
              <Card key={kpi.title} className={`bg-card border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}>
                <CardContent className="p-3 lg:p-6">
                  <div className="flex items-start justify-between gap-1">
                    <div className="space-y-1 lg:space-y-3 min-w-0 flex-1">
                      <p className={`${titleClass} whitespace-pre-line line-clamp-2`}>{kpi.title}</p>
                      <p className={`${valueClass} break-words`}>{kpi.value}</p>
                      <p className="text-[10px] lg:text-xs text-muted-foreground whitespace-pre-line line-clamp-2">{kpi.subtitle}</p>
                    </div>
                    <div className={`p-1.5 lg:p-2 rounded-full ${kpi.iconBg} flex-shrink-0`}>
                      <kpi.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${kpi.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Topic Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-full lg:grid lg:grid-cols-5 bg-muted/50 border border-border rounded-lg p-1 h-auto gap-1 flex-shrink-0">
            <TabsTrigger value="perfil" className="flex-1 min-w-[80px] lg:min-w-0 flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 sm:py-2.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Perfil</span>
              <span className="xs:hidden">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="cbos" className="flex-1 min-w-[80px] lg:min-w-0 flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 sm:py-2.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">CBOs que Aprovam</span>
              <span className="sm:hidden">CBOs</span>
            </TabsTrigger>
            <TabsTrigger value="empresas" className="flex-1 min-w-[80px] lg:min-w-0 flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 sm:py-2.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
              <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="banco" className="flex-1 min-w-[80px] lg:min-w-0 flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 sm:py-2.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Por Banco</span>
              <span className="sm:hidden">Banco</span>
            </TabsTrigger>
            <TabsTrigger value="lista" className="flex-1 min-w-[80px] lg:min-w-0 flex items-center justify-center gap-1 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 sm:py-2.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Lista de Leads</span>
              <span className="sm:hidden">Lista</span>
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="perfil" className="mt-6">
            {tab === "perfil" && <PerfilIdealPanel />}
          </TabsContent>

          <TabsContent value="cbos" className="mt-6">
            {tab === "cbos" && <CBOsQueAprovamPanel />}
          </TabsContent>

          <TabsContent value="empresas" className="mt-6">
            {tab === "empresas" && <EmpresasPanel />}
          </TabsContent>

          <TabsContent value="banco" className="mt-6">
            {tab === "banco" && <PorBancoPanel />}
          </TabsContent>

          <TabsContent value="lista" className="mt-4 lg:mt-6">
            {tab === "lista" && (
            <Card className="bg-card border-border">
              <CardHeader className="p-3 lg:p-6 pb-3 lg:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                      <Users className="w-4 h-4 lg:w-5 lg:h-5" />
                      Lista de Leads
                    </CardTitle>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1">Visualize e filtre todos os leads</p>
                  </div>
                  <span className="text-xs lg:text-sm text-muted-foreground">{pagination.totalCount.toLocaleString("pt-BR")} leads</span>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 lg:gap-3 mt-3 lg:mt-4">
                  <div className="relative col-span-2 sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por CPF..." 
                      value={searchCpf} 
                      onChange={(e) => setSearchCpf(e.target.value)} 
                      onKeyDown={handleKeyDown}
                      className="pl-9 bg-background h-9 lg:h-10 text-sm" 
                    />
                  </div>
                  <Select value={listStatus} onValueChange={setListStatus}>
                    <SelectTrigger className="w-[140px] lg:w-[160px] h-9 lg:h-10 text-xs lg:text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovacao_tecnica">Rep. Técnica</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSearch} className="gap-2 h-9 lg:h-10 text-xs lg:text-sm">
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Buscar</span>
                  </Button>
                  <Button variant="outline" className="gap-2 h-9 lg:h-10 text-xs lg:text-sm hidden sm:flex" disabled>
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 lg:p-6 pt-0">
                {leadsFiltrados.length === 0 ? (
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
                            <TableHead className="text-muted-foreground text-center">CPF</TableHead>
                            <TableHead className="text-muted-foreground text-center">Nome</TableHead>
                            <TableHead className="text-muted-foreground text-center">CBO</TableHead>
                            <TableHead className="text-muted-foreground text-center">Banco</TableHead>
                            <TableHead className="text-muted-foreground text-center">Valor</TableHead>
                            <TableHead className="text-muted-foreground text-center">Status</TableHead>
                            <TableHead className="text-muted-foreground text-center">Pagamento</TableHead>
                            <TableHead className="text-muted-foreground text-center">Data</TableHead>
                            <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leadsFiltrados.map((lead: Lead) => (
                            <TableRow key={lead.id} className="border-border/50 hover:bg-muted/30">
                              <TableCell className="font-mono text-foreground text-center">{formatCpf(lead.cpf)}</TableCell>
                              <TableCell className="text-muted-foreground truncate max-w-[160px] text-center" title={lead.nome || undefined}>{lead.nome || "-"}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-center" title={extrairCBOCompleto(lead as Lead) || undefined}>{extrairNumeroCBO(lead)}</TableCell>
                              <TableCell className="text-muted-foreground text-center">{lead.banco || "-"}</TableCell>
                              <TableCell className="text-foreground text-center">
                                {lead.valor && lead.valor > 0 
                                  ? `R$ ${lead.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-center">{getStatusBadge(lead.status)}</TableCell>
                              <TableCell className="text-center">{getPagamentoBadge(lead)}</TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap text-center">{formatDateTime(lead.created_at)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={async () => {
                                      // Buscar detalhes completos do lead (incluindo motivo_reprovacao_tecnica)
                                      const leadDetails = await fetchLeadDetails(lead.id);
                                      setSelectedLead(leadDetails || lead);
                                      setDetailOpen(true);
                                    }}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                    onClick={() => openPaymentEdit(lead)}
                                    title="Editar pagamento"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination - usando paginação do servidor */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-border">
                      <span className="text-xs lg:text-sm text-muted-foreground text-center sm:text-left">
                        Pág. {pagination.page}/{pagination.totalPages} ({pagination.totalCount.toLocaleString("pt-BR")})
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page === 1}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-2 lg:px-3 text-xs lg:text-sm text-muted-foreground">{pagination.page}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Lead Detail Dialog */}
        <LeadDetailDialog lead={selectedLead} open={detailOpen} onOpenChange={setDetailOpen} />

        {/* Payment Edit Dialog */}
        <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Editar Lead</DialogTitle>
              <DialogDescription>
                {editingLead && (
                  <span>
                    Lead: <strong>{editingLead.nome || formatCpf(editingLead.cpf)}</strong>
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {/* Tabs para Pagamento e Reimportar */}
            <Tabs value={editTab} onValueChange={(v) => setEditTab(v as "pagamento" | "reimportar")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pagamento" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pagamento
                </TabsTrigger>
                <TabsTrigger value="reimportar" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Reimportar
                </TabsTrigger>
              </TabsList>
              
              {/* Tab Pagamento */}
              <TabsContent value="pagamento" className="mt-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="payment-status" className="text-sm font-medium">
                      Status do Pagamento
                    </label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger id="payment-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pago">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Pago
                          </span>
                        </SelectItem>
                        <SelectItem value="reprovado_cancelado">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Reprovado/Cancelado
                          </span>
                        </SelectItem>
                        <SelectItem value="aguardando">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Aguardando
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="payment-description" className="text-sm font-medium">
                      Descrição / Observação
                    </label>
                    <Textarea
                      id="payment-description"
                      placeholder="Ex: Lead se encontrava em pendência de assinaturas, foi realizada a coleta e o contrato foi liquidado."
                      value={paymentDescription}
                      onChange={(e) => setPaymentDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={closePaymentEdit} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button onClick={savePaymentStatus} disabled={isSaving || !paymentStatus}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              {/* Tab Reimportar */}
              <TabsContent value="reimportar" className="mt-4">
                <div className="grid gap-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Selecione um arquivo CSV ou XLSX contendo os dados atualizados do lead. 
                      O sistema irá localizar o registro pelo CPF <strong>{editingLead && formatCpf(editingLead.cpf)}</strong> e substituir os dados existentes.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Arquivo de Importação</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleReimportFile}
                        className="flex-1"
                      />
                    </div>
                    {reimportFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileSpreadsheet className="h-4 w-4" />
                        {reimportFile.name}
                      </div>
                    )}
                  </div>
                  
                  {reimportError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{reimportError}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={closePaymentEdit} disabled={isReimporting}>
                    Cancelar
                  </Button>
                  <Button onClick={executeReimport} disabled={isReimporting || !reimportFile}>
                    {isReimporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reimportando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Reimportar
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
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
