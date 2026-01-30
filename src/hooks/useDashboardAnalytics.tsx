import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";

// ============================================================
// TIPOS
// ============================================================
interface CBOStats {
  codigo: string;
  descricao: string;
  total: number;
  aprovados: number;
  reprovados: number;
  taxaAprovacao: number;
}

interface BancoStats {
  banco: string;
  total: number;
  aprovados: number;
  reprovados: number;
  taxaAprovacao: number;
  valorTotal: number;
}

interface EmpresaStats {
  empresa: string;
  total: number;
  aprovados: number;
  reprovados: number;
  taxaAprovacao: number;
}

interface PerfilIdeal {
  cboIdeal: { codigo: string; descricao: string; totalAprovacoes: number } | null;
  margemIdeal: { min: number; max: number; media: number } | null;
  bancoIdeal: { banco: string; totalAprovacoes: number } | null;
  melhorDiaSemana: { dia: string; totalPagamentos: number } | null;
}

interface DiaStats {
  dia: string;
  total: number;
  aprovados: number;
  pagos: number;
  taxaAprovacao: number;
  taxaPagamento: number;
}

interface MesStats {
  mes: string;
  total: number;
  aprovados: number;
  pagos: number;
  taxaAprovacao: number;
  taxaPagamento: number;
}

export interface DashboardAnalyticsData {
  totalLeads: number;
  totalAprovados: number;
  totalReprovados: number;
  totalPagos: number;
  taxaAprovacaoGeral: number;
  taxaPagamentoGeral: number;
  valorGanho: number;
  valorGasto: number;
  valorPerdido: number;
  cboMaisAprovacao: CBOStats | null;
  cboMaisReprovacao: CBOStats | null;
  empresaMaisAprovacoes: EmpresaStats | null;
  empresaMaisReprovacoes: EmpresaStats | null;
  bancoMaisAprovacoes: BancoStats | null;
  bancoMenosAprovacoes: BancoStats | null;
  aprovacoesPorDiaSemana: DiaStats[];
  aprovacoesPorMes: MesStats[];
  perfilIdeal: PerfilIdeal;
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// VALOR PADRÃO (para estados de loading/erro)
// ============================================================
const emptyResult: DashboardAnalyticsData = {
  totalLeads: 0,
  totalAprovados: 0,
  totalReprovados: 0,
  totalPagos: 0,
  taxaAprovacaoGeral: 0,
  taxaPagamentoGeral: 0,
  valorGanho: 0,
  valorGasto: 0,
  valorPerdido: 0,
  cboMaisAprovacao: null,
  cboMaisReprovacao: null,
  empresaMaisAprovacoes: null,
  empresaMaisReprovacoes: null,
  bancoMaisAprovacoes: null,
  bancoMenosAprovacoes: null,
  aprovacoesPorDiaSemana: [],
  aprovacoesPorMes: [],
  perfilIdeal: {
    cboIdeal: null,
    margemIdeal: null,
    bancoIdeal: null,
    melhorDiaSemana: null,
  },
  isLoading: false,
  error: null,
};

// ============================================================
// TIPO DO RETORNO DA FUNÇÃO SQL
// ============================================================
interface DashboardAnalyticsResponse {
  totalLeads: number;
  totalAprovados: number;
  totalReprovados: number;
  totalPagos: number;
  taxaAprovacaoGeral: number;
  taxaPagamentoGeral: number;
  valorGanho: number;
  valorGasto: number;
  valorPerdido: number;
  cboMaisAprovacao: CBOStats | null;
  cboMaisReprovacao: CBOStats | null;
  empresaMaisAprovacoes: EmpresaStats | null;
  empresaMaisReprovacoes: EmpresaStats | null;
  bancoMaisAprovacoes: BancoStats | null;
  bancoMenosAprovacoes: BancoStats | null;
  aprovacoesPorDiaSemana: DiaStats[];
  aprovacoesPorMes: MesStats[];
  perfilIdeal: PerfilIdeal;
}

// ============================================================
// FUNÇÃO DE FETCH
// ============================================================
interface FetchParams {
  dataInicial?: Date | null;
  dataFinal?: Date | null;
  banco?: string | null;
  importBatchId?: string | null;
}

async function fetchDashboardAnalytics(params: FetchParams): Promise<DashboardAnalyticsData> {
  const { dataInicial, dataFinal, banco, importBatchId } = params;

  const bancoParam = banco && banco.trim() ? banco : null;
  const importBatchIdParam = importBatchId && importBatchId.trim() ? importBatchId : null;

  const { data, error } = await supabase.rpc("get_dashboard_analytics", {
    p_data_inicial: dataInicial?.toISOString() ?? null,
    p_data_final: dataFinal?.toISOString() ?? null,
    p_banco: bancoParam,
    p_import_batch_id: importBatchIdParam,
  });

  if (error) {
    throw new Error(error.message ?? "Erro ao buscar dados do dashboard");
  }

  let raw: unknown = data;

  if (Array.isArray(raw)) {
    raw = raw[0];
  }

  if (raw && typeof raw === "object" && "get_dashboard_analytics" in (raw as Record<string, unknown>)) {
    raw = (raw as Record<string, unknown>).get_dashboard_analytics;
  }

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  const payload = raw as DashboardAnalyticsResponse | null;

  if (!payload || typeof payload !== "object") {
    return { ...emptyResult };
  }

  return {
    totalLeads: payload.totalLeads ?? 0,
    totalAprovados: payload.totalAprovados ?? 0,
    totalReprovados: payload.totalReprovados ?? 0,
    totalPagos: payload.totalPagos ?? 0,
    taxaAprovacaoGeral: payload.taxaAprovacaoGeral ?? 0,
    taxaPagamentoGeral: payload.taxaPagamentoGeral ?? 0,
    valorGanho: payload.valorGanho ?? 0,
    valorGasto: payload.valorGasto ?? 0,
    valorPerdido: payload.valorPerdido ?? 0,
    cboMaisAprovacao: payload.cboMaisAprovacao ?? null,
    cboMaisReprovacao: payload.cboMaisReprovacao ?? null,
    empresaMaisAprovacoes: payload.empresaMaisAprovacoes ?? null,
    empresaMaisReprovacoes: payload.empresaMaisReprovacoes ?? null,
    bancoMaisAprovacoes: payload.bancoMaisAprovacoes ?? null,
    bancoMenosAprovacoes: payload.bancoMenosAprovacoes ?? null,
    aprovacoesPorDiaSemana: payload.aprovacoesPorDiaSemana ?? [],
    aprovacoesPorMes: payload.aprovacoesPorMes ?? [],
    perfilIdeal: payload.perfilIdeal ?? {
      cboIdeal: null,
      margemIdeal: null,
      bancoIdeal: null,
      melhorDiaSemana: null,
    },
    isLoading: false,
    error: null,
  };
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================
export const useDashboardAnalytics = (): DashboardAnalyticsData => {
  const { filters } = useDashboard();
  const [data, setData] = useState<DashboardAnalyticsData>({ ...emptyResult, isLoading: true });

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const result = await fetchDashboardAnalytics({
          dataInicial: filters?.dataInicial,
          dataFinal: filters?.dataFinal,
          banco: filters?.banco,
          importBatchId: filters?.importBatchId,
        });
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setData({ 
            ...emptyResult, 
            isLoading: false, 
            error: err instanceof Error ? err.message : "Erro ao carregar dados" 
          });
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [filters?.dataInicial, filters?.dataFinal, filters?.banco, filters?.importBatchId]);

  return data;
};