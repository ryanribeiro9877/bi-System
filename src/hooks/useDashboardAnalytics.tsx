import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { extrairCBOUniversal } from "@/lib/cboUtils";

interface LeadAnalytics {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  status: string | null;
  valor: number | null;
  created_at: string;
  cbo_codigo: string | null;
  cbo_descricao: string | null;
  empresa: string | null;
  isPago: boolean;
  retorno_margem: unknown;
  retorno_simulacao: unknown;
  retorno_get_proposta: unknown;
}

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

interface TemporalStats {
  data: string;
  diaSemana: string;
  total: number;
  aprovados: number;
  reprovados: number;
  taxaAprovacao: number;
}

interface PerfilIdeal {
  cboIdeal: { codigo: string; descricao: string; taxaAprovacao: number } | null;
  margemIdeal: { min: number; max: number; media: number } | null;
  bancoIdeal: { banco: string; taxaAprovacao: number } | null;
  melhorDiaSemana: { dia: string; taxaAprovacao: number } | null;
}

export interface DashboardAnalyticsData {
  // Estatísticas gerais
  totalLeads: number;
  totalAprovados: number;
  totalReprovados: number;
  totalPagos: number;
  taxaAprovacaoGeral: number;
  taxaPagamentoGeral: number;
  
  // Valores financeiros
  valorGanho: number;      // Valor total dos leads pagos
  valorGasto: number;      // Valor total dos leads aprovados (potencial)
  valorPerdido: number;    // Valor total dos leads reprovados
  
  // Confronto de CBOs (mais aprovação vs mais reprovação)
  cboMaisAprovacao: CBOStats | null;
  cboMaisReprovacao: CBOStats | null;
  
  // Confronto de Empresas (mais aprovações vs mais reprovações)
  empresaMaisAprovacoes: EmpresaStats | null;
  empresaMaisReprovacoes: EmpresaStats | null;
  
  // Confronto de Bancos (mais aprovações vs menos aprovações)
  bancoMaisAprovacoes: BancoStats | null;
  bancoMenosAprovacoes: BancoStats | null;
  
  // Confronto Temporal (% aprovados vs % pagos)
  aprovacoesPorDia: TemporalStats[];
  aprovacoesPorDiaSemana: { dia: string; total: number; aprovados: number; pagos: number; taxaAprovacao: number; taxaPagamento: number }[];
  aprovacoesPorMes: { mes: string; total: number; aprovados: number; pagos: number; taxaAprovacao: number; taxaPagamento: number }[];
  
  // Perfil Ideal
  perfilIdeal: PerfilIdeal;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const isAprovado = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('aprovad') || s.includes('contrato') || s === 'aprovado' || s === 'contratado';
};

const isReprovado = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('reprovad') || s.includes('negad') || s.includes('recusad') || s === 'reprovado';
};

export const useDashboardAnalytics = (): DashboardAnalyticsData => {
  const { filters } = useDashboard();
  const [leads, setLeads] = useState<LeadAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pageSize = 1000;
      let from = 0;
      let allLeads: LeadAnalytics[] = [];

      const buildQuery = () => {
        let query = supabase
          .from("leads")
          .select("id, cpf, nome, banco, status, valor, created_at, retorno_margem, retorno_simulacao, retorno_get_proposta")
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
        if (filters?.importBatchId) {
          query = query.eq("import_batch_id", filters.importBatchId);
        }

        return query;
      };

      while (true) {
        const { data, error: fetchError } = await buildQuery().range(from, from + pageSize - 1);
        if (fetchError) throw fetchError;

        const batch = (data || []).map((row: Record<string, unknown>) => {
          // extrairCBOUniversal retorna string no formato "codigo - descricao" ou apenas "codigo"
          const cboStr = extrairCBOUniversal({
            retorno_margem: row.retorno_margem,
            retorno_simulacao: row.retorno_simulacao,
          } as Record<string, unknown>);
          
          // Separar código e descrição se possível
          let cbo_codigo: string | null = null;
          let cbo_descricao: string | null = null;
          if (cboStr) {
            const parts = cboStr.split(' - ');
            if (parts.length >= 2) {
              cbo_codigo = parts[0].trim();
              cbo_descricao = parts.slice(1).join(' - ').trim();
            } else {
              cbo_codigo = cboStr;
              cbo_descricao = cboStr;
            }
          }

          // Extrair empresa do retorno_margem
          const margem = row.retorno_margem as Record<string, unknown> | null;
          let empresa: string | null = null;
          if (margem) {
            const regEmp = margem.registroEmpregaticio as Record<string, unknown> | undefined;
            empresa = (regEmp?.nomeEmpregador as string) || 
                      (margem.nomeEmpresa as string) || 
                      (margem.empresa as string) || 
                      (margem.razaoSocial as string) || null;
          }

          // Verificar se foi pago baseado no statusDescription do retorno_get_proposta
          const getProposta = row.retorno_get_proposta as Record<string, unknown> | null;
          let isPago = false;
          if (getProposta) {
            const statusDescription = getProposta.statusDescription as string | null;
            if (statusDescription) {
              const normalizedStatus = statusDescription.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
              const statusPagos = [
                'encerrado', 
                'liquidacao', 
                'liquidacao manual', 
                'pago', 
                'liquidado',
                'aprovacao de instrumento',
                'aprovacao manual',
                'aprovado'
              ];
              isPago = statusPagos.some(s => normalizedStatus.includes(s));
            }
          }

          return {
            id: String(row.id ?? ""),
            cpf: String(row.cpf ?? ""),
            nome: (row.nome as string) ?? null,
            banco: (row.banco as string) ?? null,
            status: (row.status as string) ?? null,
            valor: typeof row.valor === "number" ? row.valor : null,
            created_at: String(row.created_at ?? ""),
            cbo_codigo,
            cbo_descricao,
            empresa,
            isPago,
            retorno_margem: row.retorno_margem,
            retorno_simulacao: row.retorno_simulacao,
            retorno_get_proposta: row.retorno_get_proposta,
          };
        });

        allLeads = allLeads.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setLeads(allLeads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const analytics = useMemo<DashboardAnalyticsData>(() => {
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
      aprovacoesPorDia: [],
      aprovacoesPorDiaSemana: [],
      aprovacoesPorMes: [],
      perfilIdeal: {
        cboIdeal: null,
        margemIdeal: null,
        bancoIdeal: null,
        melhorDiaSemana: null,
      },
      isLoading,
      error,
    };

    if (leads.length === 0) {
      return emptyResult;
    }

    // Estatísticas gerais
    const aprovados = leads.filter(l => isAprovado(l.status));
    const reprovados = leads.filter(l => isReprovado(l.status));
    const pagos = leads.filter(l => l.isPago);
    const totalAprovados = aprovados.length;
    const totalReprovados = reprovados.length;
    const totalPagos = pagos.length;
    const taxaAprovacaoGeral = leads.length > 0 ? (totalAprovados / leads.length) * 100 : 0;
    const taxaPagamentoGeral = leads.length > 0 ? (totalPagos / leads.length) * 100 : 0;

    // Valores financeiros
    const valorGanho = pagos.reduce((acc, l) => acc + (l.valor || 0), 0); // Valor dos pagos
    const valorGasto = aprovados.reduce((acc, l) => acc + (l.valor || 0), 0); // Valor dos aprovados (potencial)
    const valorPerdido = reprovados.reduce((acc, l) => acc + (l.valor || 0), 0); // Valor dos reprovados

    // Estatísticas por CBO
    const cboMap = new Map<string, { codigo: string; descricao: string; total: number; aprovados: number; reprovados: number }>();
    leads.forEach(l => {
      if (!l.cbo_codigo) return;
      const key = l.cbo_codigo;
      const existing = cboMap.get(key) || { codigo: l.cbo_codigo, descricao: l.cbo_descricao || l.cbo_codigo, total: 0, aprovados: 0, reprovados: 0 };
      existing.total++;
      if (isAprovado(l.status)) existing.aprovados++;
      if (isReprovado(l.status)) existing.reprovados++;
      cboMap.set(key, existing);
    });

    const cboStats: CBOStats[] = Array.from(cboMap.values())
      .filter(c => c.total >= 3)
      .map(c => ({
        ...c,
        taxaAprovacao: c.total > 0 ? (c.aprovados / c.total) * 100 : 0,
      }));

    // CBO com mais aprovação (maior taxa) vs CBO com mais reprovação (menor taxa)
    const cboMaisAprovacao = cboStats.length > 0 
      ? [...cboStats].sort((a, b) => b.taxaAprovacao - a.taxaAprovacao)[0] 
      : null;
    const cboMaisReprovacao = cboStats.length > 0 
      ? [...cboStats].sort((a, b) => a.taxaAprovacao - b.taxaAprovacao)[0] 
      : null;

    // Estatísticas por Empresa
    const empresaMap = new Map<string, { empresa: string; total: number; aprovados: number; reprovados: number }>();
    leads.forEach(l => {
      if (!l.empresa) return;
      const key = l.empresa;
      const existing = empresaMap.get(key) || { empresa: l.empresa, total: 0, aprovados: 0, reprovados: 0 };
      existing.total++;
      if (isAprovado(l.status)) existing.aprovados++;
      if (isReprovado(l.status)) existing.reprovados++;
      empresaMap.set(key, existing);
    });

    const empresaStats: EmpresaStats[] = Array.from(empresaMap.values())
      .filter(e => e.total >= 3)
      .map(e => ({
        ...e,
        taxaAprovacao: e.total > 0 ? (e.aprovados / e.total) * 100 : 0,
      }));

    // Empresa com mais aprovações (quantidade) vs Empresa com mais reprovações (quantidade)
    const empresaMaisAprovacoes = empresaStats.length > 0 
      ? [...empresaStats].sort((a, b) => b.aprovados - a.aprovados)[0] 
      : null;
    const empresaMaisReprovacoes = empresaStats.length > 0 
      ? [...empresaStats].sort((a, b) => b.reprovados - a.reprovados)[0] 
      : null;

    // Estatísticas por Banco
    const bancoMap = new Map<string, { banco: string; total: number; aprovados: number; reprovados: number; valorTotal: number }>();
    leads.forEach(l => {
      if (!l.banco) return;
      const key = l.banco;
      const existing = bancoMap.get(key) || { banco: l.banco, total: 0, aprovados: 0, reprovados: 0, valorTotal: 0 };
      existing.total++;
      if (isAprovado(l.status)) {
        existing.aprovados++;
        existing.valorTotal += l.valor || 0;
      }
      if (isReprovado(l.status)) existing.reprovados++;
      bancoMap.set(key, existing);
    });

    const bancoStats: BancoStats[] = Array.from(bancoMap.values())
      .filter(b => b.total >= 3)
      .map(b => ({
        ...b,
        taxaAprovacao: b.total > 0 ? (b.aprovados / b.total) * 100 : 0,
      }));

    // Banco com mais aprovações (quantidade) vs Banco com menos aprovações (quantidade)
    const bancoMaisAprovacoes = bancoStats.length > 0 
      ? [...bancoStats].sort((a, b) => b.aprovados - a.aprovados)[0] 
      : null;
    const bancoMenosAprovacoes = bancoStats.length > 0 
      ? [...bancoStats].sort((a, b) => a.aprovados - b.aprovados)[0] 
      : null;

    // Estatísticas Temporais - Por Dia
    const diaMap = new Map<string, { data: string; diaSemana: string; total: number; aprovados: number; reprovados: number }>();
    leads.forEach(l => {
      if (!l.created_at) return;
      const date = new Date(l.created_at);
      const dataStr = date.toISOString().split('T')[0];
      const diaSemana = DIAS_SEMANA[date.getDay()];
      const existing = diaMap.get(dataStr) || { data: dataStr, diaSemana, total: 0, aprovados: 0, reprovados: 0 };
      existing.total++;
      if (isAprovado(l.status)) existing.aprovados++;
      if (isReprovado(l.status)) existing.reprovados++;
      diaMap.set(dataStr, existing);
    });

    const aprovacoesPorDia: TemporalStats[] = Array.from(diaMap.values())
      .map(d => ({
        ...d,
        taxaAprovacao: d.total > 0 ? (d.aprovados / d.total) * 100 : 0,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Estatísticas por Dia da Semana (com pagos)
    const diaSemanaMap = new Map<string, { dia: string; total: number; aprovados: number; pagos: number }>();
    DIAS_SEMANA.forEach(dia => diaSemanaMap.set(dia, { dia, total: 0, aprovados: 0, pagos: 0 }));
    leads.forEach(l => {
      if (!l.created_at) return;
      const date = new Date(l.created_at);
      const diaSemana = DIAS_SEMANA[date.getDay()];
      const existing = diaSemanaMap.get(diaSemana)!;
      existing.total++;
      if (isAprovado(l.status)) existing.aprovados++;
      if (l.isPago) existing.pagos++;
    });

    const aprovacoesPorDiaSemana = Array.from(diaSemanaMap.values())
      .map(d => ({
        ...d,
        taxaAprovacao: d.total > 0 ? (d.aprovados / d.total) * 100 : 0,
        taxaPagamento: d.total > 0 ? (d.pagos / d.total) * 100 : 0,
      }));

    // Estatísticas por Mês (com pagos)
    const mesMap = new Map<string, { mes: string; total: number; aprovados: number; pagos: number }>();
    leads.forEach(l => {
      if (!l.created_at) return;
      const date = new Date(l.created_at);
      const mesStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = mesMap.get(mesStr) || { mes: mesStr, total: 0, aprovados: 0, pagos: 0 };
      existing.total++;
      if (isAprovado(l.status)) existing.aprovados++;
      if (l.isPago) existing.pagos++;
      mesMap.set(mesStr, existing);
    });

    const aprovacoesPorMes = Array.from(mesMap.values())
      .map(m => ({
        ...m,
        taxaAprovacao: m.total > 0 ? (m.aprovados / m.total) * 100 : 0,
        taxaPagamento: m.total > 0 ? (m.pagos / m.total) * 100 : 0,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Perfil Ideal
    const cboIdeal = cboMaisAprovacao ? {
      codigo: cboMaisAprovacao.codigo,
      descricao: cboMaisAprovacao.descricao,
      taxaAprovacao: cboMaisAprovacao.taxaAprovacao,
    } : null;

    const valoresAprovados = aprovados.map(l => l.valor).filter((v): v is number => v !== null && v > 0);
    const margemIdeal = valoresAprovados.length > 0 ? {
      min: Math.min(...valoresAprovados),
      max: Math.max(...valoresAprovados),
      media: valoresAprovados.reduce((a, b) => a + b, 0) / valoresAprovados.length,
    } : null;

    const bancoIdeal = bancoMaisAprovacoes ? {
      banco: bancoMaisAprovacoes.banco,
      taxaAprovacao: bancoMaisAprovacoes.taxaAprovacao,
    } : null;

    const melhorDiaSemana = aprovacoesPorDiaSemana.length > 0 
      ? aprovacoesPorDiaSemana.reduce((best, curr) => curr.taxaAprovacao > best.taxaAprovacao ? curr : best)
      : null;

    return {
      totalLeads: leads.length,
      totalAprovados,
      totalReprovados,
      totalPagos,
      taxaAprovacaoGeral,
      taxaPagamentoGeral,
      valorGanho,
      valorGasto,
      valorPerdido,
      cboMaisAprovacao,
      cboMaisReprovacao,
      empresaMaisAprovacoes,
      empresaMaisReprovacoes,
      bancoMaisAprovacoes,
      bancoMenosAprovacoes,
      aprovacoesPorDia,
      aprovacoesPorDiaSemana,
      aprovacoesPorMes,
      perfilIdeal: {
        cboIdeal,
        margemIdeal,
        bancoIdeal,
        melhorDiaSemana: melhorDiaSemana ? { dia: melhorDiaSemana.dia, taxaAprovacao: melhorDiaSemana.taxaAprovacao } : null,
      },
      isLoading,
      error,
    };
  }, [leads, isLoading, error]);

  return analytics;
};
