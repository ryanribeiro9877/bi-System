import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { 
  LeadCompleto, 
  RetornoAutorizacao, 
  RetornoMargem, 
  RetornoSimulacao, 
  RetornoProposta, 
  RetornoGetProposta,
  parseJsonSafe 
} from "@/types/lead";
import { normalizarStatusLead, StatusNormalizado } from "@/lib/leadStatusUtils";
import { extrairCBOUniversal } from "@/lib/cboUtils";

export interface Lead {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  cbo: string | null;
  status: string | null;
  tipo_reprovacao: string | null;
  valor: number | null;
  data_envio: string | null;
  data_retorno: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  import_batch_id: string | null;
  // Campos JSONB
  retorno_autorizacao: RetornoAutorizacao | null;
  retorno_margem: RetornoMargem | null;
  retorno_simulacao: RetornoSimulacao | null;
  retorno_proposta: RetornoProposta | null;
  retorno_get_proposta: RetornoGetProposta | null;
  ultimo_log: string | null;
  // Campos de CBO bloqueado extraídos
  cbo_block_code: string | null;
  cbo_block_name: string | null;
  // Campo calculado para motivo de reprovação técnica
  motivo_reprovacao_tecnica?: string | null;
}

export interface FilterState {
  dataInicial: Date | undefined;
  dataFinal: Date | undefined;
  banco: string;
  tipoReprovacao: string;
  tiposReprovacaoMultiplos: string[];
  status: string;
  statuses?: string[];
  cpf: string;
  importBatchId: string;
}

export interface DashboardStats {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  leadsReprovacaoTecnica: number;
  taxaReprovacao: number;
  taxaAprovacao: number;
  valorTotal: number;
  principalMotivo: string;
  principalMotivoCompleto: string;
  principalMotivoPercentual: number;
  bancoMaiorReprovacao: string;
  bancoMaiorReprovacaoPercentual: number;
  cbosUnicos: number;
  tiposReprovacaoUnicos: number;
  reprovacoesPorBanco: { banco: string; aprovados: number; reprovados: number; pendentes: number; total: number; taxaReprovacao: number }[];
  reprovacoesPorCBO: { cbo: string; quantidade: number }[];
  reprovacoesPorTipo: { tipo: string; tipoCompleto: string; quantidade: number }[];
  leadsPorStatus: { status: string; quantidade: number }[];
  cbosBloqueados: { code: string; name: string | null; quantidade: number }[];
  totalCBOsBloqueados: number;
  margemMedia: number;
  valorSimulacaoTotal: number;
}

// Helper para extrair nome do lead
const extrairNome = (lead: Lead): string => {
  if (lead.nome) return lead.nome;

  const margem = lead.retorno_margem as Record<string, unknown>;
  const simulacao = lead.retorno_simulacao as Record<string, unknown>;
  const getProposta = lead.retorno_get_proposta as Record<string, unknown>;
  const proposta = lead.retorno_proposta as Record<string, unknown>;
  const autorizacao = lead.retorno_autorizacao as Record<string, unknown>;

  const fontes = [
    (getProposta as Record<string, unknown>)?.name,
    (margem as Record<string, unknown>)?.registroEmpregaticio && 
      typeof (margem as Record<string, unknown>).registroEmpregaticio === 'object' &&
      ((margem as Record<string, unknown>).registroEmpregaticio as Record<string, unknown>)?.nomeEmpregado,
    (margem as Record<string, unknown>)?.nomeEmpregado,
    (margem as Record<string, unknown>)?.nome,
    (simulacao as Record<string, unknown>)?.details && 
      typeof (simulacao as Record<string, unknown>).details === 'object' &&
      ((simulacao as Record<string, unknown>).details as Record<string, unknown>)?.nome,
    (simulacao as Record<string, unknown>)?.name,
    (simulacao as Record<string, unknown>)?.nomeCliente,
    (proposta as Record<string, unknown>)?.name,
    (proposta as Record<string, unknown>)?.nomeCliente,
    (proposta as Record<string, unknown>)?.nome,
    (autorizacao as Record<string, unknown>)?.name,
    (autorizacao as Record<string, unknown>)?.nomeCliente,
  ];
  
  const found = fontes.find((v): v is string => v && typeof v === 'string' && v.trim().length > 0);
  return found || "";
};

// Helper para extrair CBO
const extrairCBO = (lead: Lead): string => {
  if (lead.cbo) return lead.cbo;

  const margem = lead.retorno_margem as any;
  const simulacao = lead.retorno_simulacao as any;
  const getProposta = lead.retorno_get_proposta as any;
  const proposta = lead.retorno_proposta as any;
  const autorizacao = lead.retorno_autorizacao as any;

  for (const c of [margem, simulacao, getProposta, proposta, autorizacao]) {
    const cbo = extrairCBOUniversal(c);
    if (cbo) return cbo;
  }

  const fontes = [
    margem?.registroEmpregaticio?.cbo,
    margem?.cbo,
    simulacao?.details?.cbo,
    simulacao?.cbo,
    simulacao?.details?.occupation,
    simulacao?.occupation,
    getProposta?.cbo,
    getProposta?.occupation,
    proposta?.cbo,
    proposta?.occupation,
    autorizacao?.cbo,
    autorizacao?.occupation,
  ];

  const found = fontes.find((v) => v && String(v).trim().length > 0);
  return found ? String(found).trim() : "";
};

// Helper para extrair banco
const extrairBanco = (lead: Lead): string => {
  if (lead.banco && lead.banco.trim()) return lead.banco.trim();
  return "Não Informado";
};

/**
 * IMPORTANTE: Esta função usa normalizarStatusLead para calcular o status
 * baseado nos campos JSON do lead.
 * 
 * REGRA DE APROVAÇÃO:
 * - APROVADO = retorno_proposta.status === "success" (ÚNICO critério)
 * - retorno_get_proposta NÃO indica aprovação
 */
const calcularStatusNormalizado = (lead: Lead): StatusNormalizado => {
  // Usa a função do leadStatusUtils que analisa os JSONs
  return normalizarStatusLead({
    id: lead.id,
    cpf: lead.cpf,
    nome: lead.nome || undefined,
    banco: lead.banco,
    status: lead.status,
    retorno_margem: lead.retorno_margem,
    retorno_simulacao: lead.retorno_simulacao,
    retorno_proposta: lead.retorno_proposta,
    retorno_get_proposta: lead.retorno_get_proposta,
    retorno_autorizacao: lead.retorno_autorizacao,
  });
};

export const useLeadsData = (filters?: FilterState) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    console.log('[useLeadsData] Fetching leads with filters:', filters);
    setIsLoading(true);
    setError(null);

    try {
      const pageSize = 1000;
      let from = 0;
      let allRows: any[] = [];

      const buildBaseQuery = () => {
        let query = supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (filters?.dataInicial) {
          query = query.gte("created_at", filters.dataInicial.toISOString());
        }
        if (filters?.dataFinal) {
          query = query.lte("created_at", filters.dataFinal.toISOString());
        }
        if (filters?.banco) {
          query = query.eq("banco", filters.banco);
        }
        if (filters?.tipoReprovacao) {
          query = query.eq("tipo_reprovacao", filters.tipoReprovacao);
        }
        if (filters?.tiposReprovacaoMultiplos && filters.tiposReprovacaoMultiplos.length > 0) {
          query = query.in("tipo_reprovacao", filters.tiposReprovacaoMultiplos);
        }
        if (filters?.status) {
          query = query.eq("status", filters.status);
        }
        if (filters?.cpf) {
          query = query.ilike("cpf", `%${filters.cpf}%`);
        }
        if (filters?.importBatchId) {
          query = query.eq("import_batch_id", filters.importBatchId);
        }

        return query;
      };

      while (true) {
        const { data, error: fetchError } = await buildBaseQuery().range(from, from + pageSize - 1);

        if (fetchError) throw fetchError;

        const batch = data || [];
        allRows = allRows.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      const parsedLeads: Lead[] = allRows.map((row: any) => ({
        ...row,
        retorno_autorizacao: parseJsonSafe<RetornoAutorizacao>(row.retorno_autorizacao),
        retorno_margem: parseJsonSafe<RetornoMargem>(row.retorno_margem),
        retorno_simulacao: parseJsonSafe<RetornoSimulacao>(row.retorno_simulacao),
        retorno_proposta: parseJsonSafe<RetornoProposta>(row.retorno_proposta),
        retorno_get_proposta: parseJsonSafe<RetornoGetProposta>(row.retorno_get_proposta),
      }));

      setLeads(parsedLeads);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err.message || "Erro ao buscar leads");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useLeadsData] Recebido evento de importação/exclusão, atualizando dados...');
      fetchLeads();
    });
    
    return unsubscribe;
  }, [fetchLeads]);

  const stats = useMemo<DashboardStats>(() => {
    if (leads.length === 0) {
      return {
        totalLeads: 0,
        leadsAprovados: 0,
        leadsReprovados: 0,
        leadsPendentes: 0,
        leadsReprovacaoTecnica: 0,
        taxaReprovacao: 0,
        taxaAprovacao: 0,
        valorTotal: 0,
        principalMotivo: "-",
        principalMotivoCompleto: "-",
        principalMotivoPercentual: 0,
        bancoMaiorReprovacao: "-",
        bancoMaiorReprovacaoPercentual: 0,
        cbosUnicos: 0,
        tiposReprovacaoUnicos: 0,
        reprovacoesPorBanco: [],
        reprovacoesPorCBO: [],
        reprovacoesPorTipo: [],
        leadsPorStatus: [],
        cbosBloqueados: [],
        totalCBOsBloqueados: 0,
        margemMedia: 0,
        valorSimulacaoTotal: 0,
      };
    }

    const totalLeads = leads.length;
    
    // =====================================================
    // CONTAGEM CORRIGIDA DE STATUS
    // Usa normalizarStatusLead que verifica retorno_proposta.status === "success"
    // =====================================================
    const leadsComStatusNormalizado = leads.map(l => ({
      ...l,
      statusNormalizado: calcularStatusNormalizado(l)
    }));
    
    // Contagem por status calculado
    const leadsAprovados = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "aprovado").length;
    const leadsReprovados = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").length;
    const leadsPendentes = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "pendente").length;
    const leadsReprovacaoTecnica = leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovacao_tecnica").length;
    
    // Log para debug
    console.log('[useLeadsData] Contagem de status:', {
      total: totalLeads,
      aprovados: leadsAprovados,
      reprovados: leadsReprovados,
      pendentes: leadsPendentes,
      reprovacaoTecnica: leadsReprovacaoTecnica
    });
    
    // Helper para determinar status de pagamento
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
    
    // Taxa de aprovação baseada apenas nos leads realmente aprovados
    const taxaAprovacao = totalLeads > 0 ? parseFloat(((leadsAprovados / totalLeads) * 100).toFixed(2)) : 0;
    const taxaReprovacao = totalLeads > 0 ? parseFloat(((leadsReprovados / totalLeads) * 100).toFixed(2)) : 0;
    
    // Calcular valores
    const valorTotal = leads.reduce((acc, l) => acc + (l.valor || 0), 0);
    
    // Função auxiliar para extrair margem disponível
    const extrairMargemDisponivel = (l: Lead): number => {
      const margem = l.retorno_margem as any;
      const simulacao = l.retorno_simulacao as any;
      
      if (margem?.valorMargemDisponivel !== undefined && margem?.valorMargemDisponivel !== null) {
        return parseFloat(margem.valorMargemDisponivel) || 0;
      }
      if (simulacao?.details?.availableMarginValue !== undefined && simulacao?.details?.availableMarginValue !== null) {
        return parseFloat(simulacao.details.availableMarginValue) || 0;
      }
      return 0;
    };
    
    // Calcular Margem Média dos leads aprovados
    const leadsAprovadosComMargem = leadsComStatusNormalizado.filter(l => {
      const margem = extrairMargemDisponivel(l);
      return l.statusNormalizado === "aprovado" && margem > 0;
    });
    const somaMargemAprovados = leadsAprovadosComMargem.reduce((acc, l) => {
      return acc + extrairMargemDisponivel(l);
    }, 0);
    const margemMedia = leadsAprovadosComMargem.length > 0 
      ? somaMargemAprovados / leadsAprovadosComMargem.length 
      : 0;
    const valorSimulacaoTotal = leads.reduce((acc, l) => {
      const simulacao = l.retorno_simulacao as any;
      const valor = simulacao?.requestedAmount || simulacao?.liquidValue || simulacao?.details?.availableMarginValue || 0;
      return acc + (parseFloat(valor) || 0);
    }, 0);

    // Função para resumir motivos de reprovação
    const resumirMotivo = (motivo: string): string => {
      if (!motivo || motivo === "-") return "Não informado";
      
      const motivoLower = motivo.toLowerCase();
      
      if (motivoLower.includes("timeout") || motivoLower.includes("curl error") || motivoLower.includes("timed out")) {
        return "Timeout";
      }
      if (motivoLower.includes("rate limit") || motivoLower.includes("429") || motivoLower.includes("too many")) {
        return "Limite de requisições";
      }
      if (motivoLower.includes("margem negativa") || motivoLower.includes("negative margin")) {
        return "Margem negativa";
      }
      if (motivoLower.includes("margem indispon") || motivoLower.includes("sem margem") || motivoLower.includes("unavailable margin")) {
        return "Margem indisponível";
      }
      if (motivoLower.includes("cbo") && (motivoLower.includes("bloqueado") || motivoLower.includes("blocked"))) {
        return "CBO bloqueado";
      }
      if (motivoLower.includes("cpf") && (motivoLower.includes("não encontrado") || motivoLower.includes("not found"))) {
        return "CPF inelegível";
      }
      if (motivoLower.includes("idade") || motivoLower.includes("age")) {
        return "Idade incompatível";
      }
      if (motivoLower.includes("renda") || motivoLower.includes("income") || motivoLower.includes("salário")) {
        return "Renda insuficiente";
      }
      if (motivoLower.includes("inadimplente") || motivoLower.includes("negativado") || motivoLower.includes("restrição")) {
        return "Restrição cadastral";
      }
      if (motivoLower.includes("empréstimo") || motivoLower.includes("loan") || motivoLower.includes("contrato")) {
        return "Empréstimo ativo";
      }
      if (motivoLower.includes("servidor") || motivoLower.includes("server error") || motivoLower.includes("500")) {
        return "Erro no servidor";
      }
      if (motivoLower.includes("não elegível") || motivoLower.includes("not eligible") || motivoLower.includes("inelegível")) {
        return "Não elegível";
      }
      if (motivoLower.includes("documento") || motivoLower.includes("document")) {
        return "Documento inválido";
      }
      
      if (motivo.length > 25) {
        return motivo.substring(0, 22) + "...";
      }
      
      return motivo;
    };

    // Count by motivo de reprovação
    const motivoReprovacaoCount: Record<string, number> = {};
    const motivoOriginais: Record<string, string> = {};
    
    leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").forEach(l => {
      const margem = l.retorno_margem as any;
      const simulacao = l.retorno_simulacao as any;
      let motivoOriginal = simulacao?.details?.error || simulacao?.error || margem?.error || l.tipo_reprovacao || "";
      
      if (!motivoOriginal || motivoOriginal === "Margem indisponível" || motivoOriginal.includes("sem margem")) {
        const valorMargem = margem?.valorMargemDisponivel || simulacao?.details?.availableMarginValue || 0;
        if (parseFloat(valorMargem) < 0) {
          motivoOriginal = "Margem negativa";
        } else {
          motivoOriginal = "Margem indisponível";
        }
      }
      
      const motivo = resumirMotivo(motivoOriginal);
      
      if (motivo) {
        motivoReprovacaoCount[motivo] = (motivoReprovacaoCount[motivo] || 0) + 1;
        if (!motivoOriginais[motivo]) {
          motivoOriginais[motivo] = motivoOriginal;
        }
      }
    });

    const tiposReprovacao = Object.entries(motivoReprovacaoCount)
      .map(([tipo, quantidade]) => ({ tipo, tipoCompleto: motivoOriginais[tipo] || tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const principalMotivo = tiposReprovacao[0]?.tipo || "-";
    const principalMotivoCompleto = motivoOriginais[principalMotivo] || principalMotivo;
    const principalMotivoPercentual = tiposReprovacao[0] && leadsReprovados > 0
      ? Math.round((tiposReprovacao[0].quantidade / leadsReprovados) * 100) 
      : 0;

    // Count by banco
    const bancoStats: Record<string, { aprovados: number; reprovados: number; pendentes: number; total: number }> = {};
    leadsComStatusNormalizado.forEach(l => {
      const banco = extrairBanco(l) || "Não informado";
      if (!bancoStats[banco]) {
        bancoStats[banco] = { aprovados: 0, reprovados: 0, pendentes: 0, total: 0 };
      }
      bancoStats[banco].total++;
      if (l.statusNormalizado === "aprovado") {
        bancoStats[banco].aprovados++;
      } else if (l.statusNormalizado === "reprovado") {
        bancoStats[banco].reprovados++;
      } else if (l.statusNormalizado === "pendente") {
        bancoStats[banco].pendentes++;
      }
    });

    const reprovacoesPorBanco = Object.entries(bancoStats)
      .map(([banco, stats]) => ({
        banco,
        ...stats,
        taxaReprovacao: stats.total > 0 ? Math.round((stats.reprovados / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.taxaReprovacao - a.taxaReprovacao);

    const bancoMaiorReprovacao = reprovacoesPorBanco[0]?.banco || "-";
    const bancoMaiorReprovacaoPercentual = reprovacoesPorBanco[0]?.taxaReprovacao || 0;

    // Count by CBO
    const cboCount: Record<string, number> = {};
    leadsComStatusNormalizado.filter(l => l.statusNormalizado === "reprovado").forEach(l => {
      const cbo = extrairCBO(l);
      if (cbo) {
        cboCount[cbo] = (cboCount[cbo] || 0) + 1;
      }
    });

    const reprovacoesPorCBO = Object.entries(cboCount)
      .map(([cbo, quantidade]) => ({ cbo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // Count by status normalizado
    const statusCount: Record<string, number> = {};
    leadsComStatusNormalizado.forEach(l => {
      const status = l.statusNormalizado;
      let statusLabel = "Reprovado";
      if (status === "aprovado") statusLabel = "Aprovado";
      else if (status === "reprovado") statusLabel = "Reprovado";
      else if (status === "pendente") statusLabel = "Pendente";
      else if (status === "reprovacao_tecnica") statusLabel = "Reprovação Técnica";
      statusCount[statusLabel] = (statusCount[statusLabel] || 0) + 1;
    });

    const leadsPorStatus = Object.entries(statusCount)
      .map(([status, quantidade]) => ({ status, quantidade }));

    // Unique counts
    const cbosUnicos = new Set(
      leadsComStatusNormalizado
        .filter(l => l.statusNormalizado === "reprovado")
        .map(l => extrairCBO(l))
        .filter(Boolean)
    ).size;
    const tiposReprovacaoUnicos = tiposReprovacao.length;

    // Count by CBO bloqueado
    const cboBlockCount: Record<string, { name: string | null; quantidade: number }> = {};
    leadsComStatusNormalizado.forEach(l => {
      if (l.cbo_block_code) {
        if (!cboBlockCount[l.cbo_block_code]) {
          cboBlockCount[l.cbo_block_code] = { name: l.cbo_block_name || null, quantidade: 0 };
        }
        cboBlockCount[l.cbo_block_code].quantidade++;
        if (l.cbo_block_name && !cboBlockCount[l.cbo_block_code].name) {
          cboBlockCount[l.cbo_block_code].name = l.cbo_block_name;
        }
      }
    });

    const cbosBloqueados = Object.entries(cboBlockCount)
      .map(([code, data]) => ({ code, name: data.name, quantidade: data.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const totalCBOsBloqueados = cbosBloqueados.reduce((acc, c) => acc + c.quantidade, 0);

    return {
      totalLeads,
      leadsAprovados,
      leadsReprovados,
      leadsPendentes,
      leadsReprovacaoTecnica,
      taxaReprovacao,
      taxaAprovacao,
      valorTotal,
      principalMotivo,
      principalMotivoCompleto,
      principalMotivoPercentual,
      bancoMaiorReprovacao,
      bancoMaiorReprovacaoPercentual,
      cbosUnicos,
      tiposReprovacaoUnicos,
      reprovacoesPorBanco,
      reprovacoesPorCBO,
      reprovacoesPorTipo: tiposReprovacao,
      leadsPorStatus,
      cbosBloqueados,
      totalCBOsBloqueados,
      margemMedia,
      valorSimulacaoTotal,
    };
  }, [leads]);

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const bancos = [...new Set(leads.map(l => extrairBanco(l)).filter(Boolean))] as string[];
    const tiposReprovacao = [...new Set(leads.map(l => l.tipo_reprovacao).filter(Boolean))] as string[];
    const statuses = [...new Set(leads.map(l => l.status).filter(Boolean))] as string[];
    const cbos = [...new Set(leads.map(l => extrairCBO(l)).filter(Boolean))] as string[];

    return { bancos, tiposReprovacao, statuses, cbos };
  }, [leads]);

  return {
    leads,
    stats,
    filterOptions,
    isLoading,
    error,
    refetch: fetchLeads,
  };
};
