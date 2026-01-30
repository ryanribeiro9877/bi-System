import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { extrairCBOUniversal } from "@/lib/cboUtils";
import { extrairValorMargem } from "@/lib/leadStatusUtils";

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


interface PerfilIdeal {
  cboIdeal: { codigo: string; descricao: string; totalAprovacoes: number } | null;
  margemIdeal: { min: number; max: number; media: number } | null;
  bancoIdeal: { banco: string; totalAprovacoes: number } | null;
  melhorDiaSemana: { dia: string; totalPagamentos: number } | null;
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
  aprovacoesPorDiaSemana: { dia: string; total: number; aprovados: number; pagos: number; taxaAprovacao: number; taxaPagamento: number }[];
  aprovacoesPorMes: { mes: string; total: number; aprovados: number; pagos: number; taxaAprovacao: number; taxaPagamento: number }[];
  
  // Perfil Ideal
  perfilIdeal: PerfilIdeal;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const isAprovadoPorStatus = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('aprovad') || s.includes('contrato') || s === 'aprovado' || s === 'contratado' || s === 'reprovacao_tecnica';
};

// Verifica se lead é aprovado considerando status E statusDescription (consistente com página Leads)
const isLeadAprovado = (lead: LeadAnalytics): boolean => {
  // Se status é aprovado ou reprovacao_tecnica, é aprovado
  if (isAprovadoPorStatus(lead.status)) {
    return true;
  }
  
  // Se tem statusDescription indicando pagamento, também é aprovado
  const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
  if (getProposta?.statusDescription) {
    const statusDescription = String(getProposta.statusDescription);
    const normalized = statusDescription
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    
    const statusPagos = [
      "encerrado", 
      "liquidacao", 
      "liquidacao manual", 
      "pago", 
      "liquidado",
      "aprovacao de instrumento",
      "aprovacao manual",
      "aprovado"
    ];
    
    if (statusPagos.some(s => normalized.includes(s))) {
      return true;
    }
  }
  
  return false;
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
          .select("id, cpf, nome, banco, status, valor, created_at, cbo, retorno_margem, retorno_simulacao, retorno_get_proposta")
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
          // Usar campo cbo do banco ou extrair via extrairCBOUniversal
          const cboBanco = row.cbo as string | null;
          const cboStr = cboBanco || extrairCBOUniversal({
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

          // Extrair empresa do retorno_margem (pode ser array ou objeto)
          const margemRaw = row.retorno_margem;
          let empresa: string | null = null;
          if (margemRaw) {
            // Se for array, pegar o primeiro elemento
            const margem = Array.isArray(margemRaw) ? margemRaw[0] : margemRaw;
            if (margem && typeof margem === 'object') {
              const margemObj = margem as Record<string, unknown>;
              // Tentar extrair de result[0].nomeEmpregador
              const result = margemObj.result;
              if (Array.isArray(result) && result.length > 0) {
                const resultItem = result[0] as Record<string, unknown>;
                empresa = (resultItem?.nomeEmpregador as string) || null;
              }
              // Fallback para outros campos
              if (!empresa) {
                const regEmp = margemObj.registroEmpregaticio as Record<string, unknown> | undefined;
                empresa = (regEmp?.nomeEmpregador as string) || 
                          (margemObj.nomeEmpresa as string) || 
                          (margemObj.empresa as string) || 
                          (margemObj.razaoSocial as string) || null;
              }
            }
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
                'liquidacao manual', 
                'pago', 
                'liquidado',
                'aprovacao de instrumento',
                'aprovacao manual'
              ];
              // Status que indicam aguardando (em andamento, não pagos ainda)
              const statusAguardando = [
                'revisao',
                'rascunho',
                'coleta'
              ];
              // Verificar se NÃO é um status de aguardando e SE é um status pago
              const isAguardando = statusAguardando.some(s => normalizedStatus.includes(s));
              isPago = !isAguardando && statusPagos.some(s => normalizedStatus.includes(s));
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

    // ===== PROCESSAMENTO ÚNICO DE TODOS OS LEADS =====
    // Consolidar todas as estatísticas em uma única iteração para melhor performance
    const cboMap = new Map<string, { codigo: string; descricao: string; total: number; aprovados: number; reprovados: number }>();
    const empresaMap = new Map<string, { empresa: string; total: number; aprovados: number; reprovados: number }>();
    const bancoMap = new Map<string, { banco: string; total: number; aprovados: number; reprovados: number; valorTotal: number }>();
    const diaSemanaMap = new Map<string, { dia: string; total: number; aprovados: number; pagos: number }>();
    const mesMap = new Map<string, { mes: string; total: number; aprovados: number; pagos: number }>();
    
    // Inicializar dias da semana
    DIAS_SEMANA.forEach(dia => diaSemanaMap.set(dia, { dia, total: 0, aprovados: 0, pagos: 0 }));
    
    // Contadores gerais
    let totalAprovados = 0;
    let totalReprovados = 0;
    let totalPagos = 0;
    let valorGanho = 0;
    const aprovadosParaMargem: LeadAnalytics[] = [];
    
    // Processar todos os leads em uma única iteração
    for (const l of leads) {
      const leadAprovado = isLeadAprovado(l);
      const leadReprovado = isReprovado(l.status);
      
      // Contadores gerais
      if (leadAprovado) {
        totalAprovados++;
        aprovadosParaMargem.push(l);
      }
      if (leadReprovado) totalReprovados++;
      if (l.isPago) {
        totalPagos++;
        const liquidValue = extrairValorMargem({ retorno_simulacao: l.retorno_simulacao } as never);
        valorGanho += liquidValue * 0.07;
      }
      
      // CBO
      if (l.cbo_codigo) {
        const cboExisting = cboMap.get(l.cbo_codigo) || { codigo: l.cbo_codigo, descricao: l.cbo_descricao || l.cbo_codigo, total: 0, aprovados: 0, reprovados: 0 };
        cboExisting.total++;
        if (leadAprovado) cboExisting.aprovados++;
        if (leadReprovado) cboExisting.reprovados++;
        cboMap.set(l.cbo_codigo, cboExisting);
      }
      
      // Empresa
      if (l.empresa) {
        const empExisting = empresaMap.get(l.empresa) || { empresa: l.empresa, total: 0, aprovados: 0, reprovados: 0 };
        empExisting.total++;
        if (leadAprovado) empExisting.aprovados++;
        if (leadReprovado) empExisting.reprovados++;
        empresaMap.set(l.empresa, empExisting);
      }
      
      // Banco
      if (l.banco) {
        const bancoExisting = bancoMap.get(l.banco) || { banco: l.banco, total: 0, aprovados: 0, reprovados: 0, valorTotal: 0 };
        bancoExisting.total++;
        if (leadAprovado) {
          bancoExisting.aprovados++;
          bancoExisting.valorTotal += l.valor || 0;
        }
        if (leadReprovado) bancoExisting.reprovados++;
        bancoMap.set(l.banco, bancoExisting);
      }
      
      // Dia da Semana e Mês (baseado em created_at do lead)
      if (l.created_at) {
        const date = new Date(l.created_at);
        const diaSemana = DIAS_SEMANA[date.getDay()];
        const diaExisting = diaSemanaMap.get(diaSemana)!;
        diaExisting.total++;
        if (leadAprovado) diaExisting.aprovados++;
        
        const mesStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const mesExisting = mesMap.get(mesStr) || { mes: mesStr, total: 0, aprovados: 0, pagos: 0 };
        mesExisting.total++;
        if (leadAprovado) mesExisting.aprovados++;
        mesMap.set(mesStr, mesExisting);
      }
      
      // Pagamentos: usar createdAt do retorno_get_proposta (data real do pagamento)
      if (l.isPago) {
        const getProposta = l.retorno_get_proposta as Record<string, unknown> | null;
        const createdAtPagamento = getProposta?.createdAt as string | null;
        if (createdAtPagamento) {
          const datePagamento = new Date(createdAtPagamento);
          const diaSemana = DIAS_SEMANA[datePagamento.getDay()];
          const diaExisting = diaSemanaMap.get(diaSemana)!;
          diaExisting.pagos++;
          
          const mesStr = `${datePagamento.getFullYear()}-${String(datePagamento.getMonth() + 1).padStart(2, '0')}`;
          const mesExisting = mesMap.get(mesStr);
          if (mesExisting) mesExisting.pagos++;
        }
      }
    }
    
    // Taxas gerais
    const taxaAprovacaoGeral = leads.length > 0 ? (totalAprovados / leads.length) * 100 : 0;
    const taxaPagamentoGeral = leads.length > 0 ? (totalPagos / leads.length) * 100 : 0;
    const valorGasto = totalAprovados * 1.15;
    const valorPerdido = totalReprovados * 1.15;

    // ===== PROCESSAR ESTATÍSTICAS DE CBO =====
    const todosCbosComAprovacoes: CBOStats[] = Array.from(cboMap.values())
      .filter(c => c.aprovados > 0)
      .map(c => ({ ...c, taxaAprovacao: c.total > 0 ? (c.aprovados / c.total) * 100 : 0 }));

    const cboStats: CBOStats[] = Array.from(cboMap.values())
      .filter(c => c.total >= 3)
      .map(c => ({ ...c, taxaAprovacao: c.total > 0 ? (c.aprovados / c.total) * 100 : 0 }));

    const cbosOrdenadosPorAprovacoes = todosCbosComAprovacoes.sort((a, b) => b.aprovados - a.aprovados);
    const cboMaisAprovacao = cbosOrdenadosPorAprovacoes.length > 1 
      ? cbosOrdenadosPorAprovacoes[1]
      : (cbosOrdenadosPorAprovacoes.length > 0 ? cbosOrdenadosPorAprovacoes[0] : null);
    const cboMaisReprovacao = cboStats.length > 0 
      ? [...cboStats].sort((a, b) => a.taxaAprovacao - b.taxaAprovacao)[0] 
      : null;

    // ===== PROCESSAR ESTATÍSTICAS DE EMPRESA =====
    const todasEmpresasComAprovacoes: EmpresaStats[] = Array.from(empresaMap.values())
      .filter(e => e.aprovados > 0)
      .map(e => ({ ...e, taxaAprovacao: e.total > 0 ? (e.aprovados / e.total) * 100 : 0 }));

    const empresasOrdenadas = todasEmpresasComAprovacoes.sort((a, b) => b.aprovados - a.aprovados);
    const empresaMaisAprovacoes = empresasOrdenadas.length > 0 ? empresasOrdenadas[0] : null;
    
    // Empresa com mais REPROVAÇÕES (ordenar por número de reprovados)
    const todasEmpresasComReprovacoes: EmpresaStats[] = Array.from(empresaMap.values())
      .filter(e => e.reprovados > 0)
      .map(e => ({ ...e, taxaAprovacao: e.total > 0 ? (e.aprovados / e.total) * 100 : 0 }));
    const empresaMaisReprovacoes = todasEmpresasComReprovacoes.length > 0
      ? todasEmpresasComReprovacoes.sort((a, b) => b.reprovados - a.reprovados)[0]
      : null;

    // ===== PROCESSAR ESTATÍSTICAS DE BANCO =====
    const bancoStats: BancoStats[] = Array.from(bancoMap.values())
      .filter(b => b.total >= 3)
      .map(b => ({ ...b, taxaAprovacao: b.total > 0 ? (b.aprovados / b.total) * 100 : 0 }));

    const bancosOrdenados = [...bancoStats].sort((a, b) => b.aprovados - a.aprovados);
    const bancoMaisAprovacoes = bancosOrdenados.length > 0 ? bancosOrdenados[0] : null;
    const bancoMenosAprovacoes = bancosOrdenados.length > 0 ? bancosOrdenados[bancosOrdenados.length - 1] : null;

    // ===== PROCESSAR ESTATÍSTICAS TEMPORAIS =====
    const aprovacoesPorDiaSemana = Array.from(diaSemanaMap.values()).map(d => ({
      ...d,
      taxaAprovacao: d.total > 0 ? (d.aprovados / d.total) * 100 : 0,
      taxaPagamento: d.total > 0 ? (d.pagos / d.total) * 100 : 0,
    }));

    const aprovacoesPorMes = Array.from(mesMap.values())
      .map(m => ({
        ...m,
        taxaAprovacao: m.total > 0 ? (m.aprovados / m.total) * 100 : 0,
        taxaPagamento: m.total > 0 ? (m.pagos / m.total) * 100 : 0,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // ===== PERFIL IDEAL =====
    const cboIdeal = cbosOrdenadosPorAprovacoes.length > 0 ? {
      codigo: cbosOrdenadosPorAprovacoes[0].codigo,
      descricao: cbosOrdenadosPorAprovacoes[0].descricao,
      totalAprovacoes: cbosOrdenadosPorAprovacoes[0].aprovados,
    } : null;

    const margensAprovados = aprovadosParaMargem
      .map(l => extrairValorMargem({ retorno_simulacao: l.retorno_simulacao } as never))
      .filter((v): v is number => v !== null && v > 0);
    const margemIdeal = margensAprovados.length > 0 ? {
      min: Math.min(...margensAprovados),
      max: Math.max(...margensAprovados),
      media: margensAprovados.reduce((a, b) => a + b, 0) / margensAprovados.length,
    } : null;

    const bancoIdeal = bancosOrdenados.length > 0 ? {
      banco: bancosOrdenados[0].banco,
      totalAprovacoes: bancosOrdenados[0].aprovados,
    } : null;

    const melhorDiaSemana = aprovacoesPorDiaSemana.reduce((best, curr) => 
      curr.pagos > best.pagos ? curr : best, aprovacoesPorDiaSemana[0]);

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
      aprovacoesPorDiaSemana,
      aprovacoesPorMes,
      perfilIdeal: {
        cboIdeal,
        margemIdeal,
        bancoIdeal,
        melhorDiaSemana: melhorDiaSemana ? { dia: melhorDiaSemana.dia, totalPagamentos: melhorDiaSemana.pagos } : null,
      },
      isLoading,
      error,
    };
  }, [leads, isLoading, error]);

  return analytics;
};
