import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

// Interfaces para os dados de contratos aprovados
export interface DataDigitacao {
  data: string;
  quantidade: number;
}

export interface TempoDigitacao {
  faixa: string;
  quantidade: number;
}

export interface PagoPorBanco {
  banco: string;
  pagos: number;
  naoPagos: number;
  valorPago: number;
}

export interface DataPagamento {
  data: string;
  quantidade: number;
  valorTotal: number;
}

export interface LeadPago {
  id: string;
  cpf: string;
  nome: string;
  banco: string;
  valorPago: number;
  dataPagamento: string | null;
  dataDigitacao: string;
}

export interface ContratosAprovadosAnalysis {
  topDatasDigitacao: DataDigitacao[];
  topTemposDigitacao: TempoDigitacao[];
  pagoPorBanco: PagoPorBanco[];
  topDatasPagamento: DataPagamento[];
  leadsPagos: LeadPago[];
  leadsNaoPagos: LeadPago[];
}

interface FetchParams {
  banco?: string;
  importBatchId?: string;
}

const fetchContratosAprovadosAnalysis = async (params?: FetchParams): Promise<ContratosAprovadosAnalysis> => {
  // Buscar leads aprovados diretamente
  // Nota: pagamento_status é um campo dinâmico que pode não estar no schema, acessamos via cast
  let query = supabase
    .from('leads')
    .select('*')
    .eq('status', 'aprovado');

  if (params?.banco) {
    query = query.eq('banco', params.banco);
  }
  if (params?.importBatchId) {
    query = query.eq('import_batch_id', params.importBatchId);
  }

  const { data: leads, error } = await query;

  if (error) {
    console.error('[useContratosAprovadosAnalysis] Query error:', error);
    throw error;
  }

  if (!leads || leads.length === 0) {
    return {
      topDatasDigitacao: [],
      topTemposDigitacao: [],
      pagoPorBanco: [],
      topDatasPagamento: [],
      leadsPagos: [],
      leadsNaoPagos: [],
    };
  }

  // NOTA: Datas de digitação e tempo de digitação são calculados APÓS identificar os leads pagos
  // para usar apenas leads efetivamente pagos (não apenas aprovados)

  // Helper para normalizar texto (remover acentos e converter para minúsculas)
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Helper para determinar se o lead está PAGO
  // CRITÉRIO: 
  // 1. Primeiro verifica pagamento_status manual (se existir)
  // 2. Senão, verifica statusDescription do retorno_get_proposta
  // Pago = statusDescription IN (Encerrado, Liquidação, Liquidação Manual, Pago, Liquidado)
  const isLeadPago = (leadAny: Record<string, unknown>, getProposta: Record<string, unknown> | null): boolean => {
    // 1. Verificar status manual primeiro (prioridade)
    const manualStatus = leadAny.pagamento_status as string | null;
    if (manualStatus) {
      return manualStatus === "pago";
    }
    
    // 2. Verificar statusDescription do retorno_get_proposta
    const statusDescription = getProposta?.statusDescription;
    if (typeof statusDescription !== "string") return false;
    
    const sd = normalize(statusDescription);
    
    // Status que indicam PAGO efetivamente
    const statusPagos = ["encerrado", "liquidacao", "liquidacao manual", "pago", "liquidado"];
    
    return statusPagos.includes(sd);
  };

  // Processar pagos/não pagos por banco
  const pagoPorBancoMap = new Map<string, { pagos: number; naoPagos: number; valorPago: number }>();
  const leadsPagos: LeadPago[] = [];
  const leadsNaoPagos: LeadPago[] = [];

  leads.forEach(lead => {
    const banco = lead.banco || 'Não informado';
    const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
    const leadAny = lead as unknown as Record<string, unknown>;
    
    // Verificar se foi pago usando statusDescription ou pagamento_status manual
    const isPago = isLeadPago(leadAny, getProposta);
    
    // Extrair valor (para exibição, não para determinar se é pago)
    const valorPago = Number(getProposta?.disbursedIssueAmount || getProposta?.paidAmount || getProposta?.valorPago || lead.valor || 0);
    
    // Extrair data de pagamento
    const dataPagamento = getProposta?.disbursementDate || getProposta?.paymentDate || getProposta?.dataPagamento || null;
    
    // Extrair nome
    const nome = lead.nome || (getProposta?.name as string) || '';
    
    const leadInfo: LeadPago = {
      id: lead.id,
      cpf: lead.cpf,
      nome,
      banco,
      valorPago: isPago ? valorPago : (lead.valor || 0),
      dataPagamento: dataPagamento ? String(dataPagamento) : null,
      dataDigitacao: lead.created_at,
    };
    
    if (!pagoPorBancoMap.has(banco)) {
      pagoPorBancoMap.set(banco, { pagos: 0, naoPagos: 0, valorPago: 0 });
    }
    
    const stats = pagoPorBancoMap.get(banco)!;
    if (isPago) {
      stats.pagos++;
      stats.valorPago += valorPago;
      leadsPagos.push(leadInfo);
    } else {
      stats.naoPagos++;
      leadsNaoPagos.push(leadInfo);
    }
  });

  const pagoPorBanco = Array.from(pagoPorBancoMap.entries())
    .map(([banco, stats]) => ({ banco, ...stats }))
    .sort((a, b) => b.pagos - a.pagos);

  // Processar tempo de digitação baseado nos leads PAGOS (não aprovados)
  // Diferença entre data de digitação (created_at) e data de pagamento
  const temposDigitacaoMap = new Map<string, number>();
  leadsPagos.forEach(lead => {
    if (!lead.dataPagamento) return;
    
    const dataDigitacao = new Date(lead.dataDigitacao);
    const dataPagamento = new Date(lead.dataPagamento);
    
    if (isNaN(dataPagamento.getTime()) || isNaN(dataDigitacao.getTime())) return;
    
    // Calcular diferença em dias (valor absoluto para evitar negativos)
    const diffMs = Math.abs(dataPagamento.getTime() - dataDigitacao.getTime());
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    // Classificar em faixas de dias
    let faixa = 'Sem dados';
    if (diffDias === 0) faixa = 'Mesmo dia';
    else if (diffDias <= 3) faixa = '1-3 dias';
    else if (diffDias <= 7) faixa = '4-7 dias';
    else if (diffDias <= 15) faixa = '8-15 dias';
    else if (diffDias <= 30) faixa = '16-30 dias';
    else faixa = '30+ dias';
    
    temposDigitacaoMap.set(faixa, (temposDigitacaoMap.get(faixa) || 0) + 1);
  });
  const topTemposDigitacao = Array.from(temposDigitacaoMap.entries())
    .filter(([faixa]) => faixa !== 'Sem dados')
    .map(([faixa, quantidade]) => ({ faixa, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);

  // Processar datas de digitação baseado nos leads PAGOS (não aprovados)
  const datasDigitacaoPagosMap = new Map<string, number>();
  leadsPagos.forEach(lead => {
    if (lead.dataDigitacao) {
      const data = new Date(lead.dataDigitacao).toLocaleDateString('pt-BR');
      datasDigitacaoPagosMap.set(data, (datasDigitacaoPagosMap.get(data) || 0) + 1);
    }
  });
  const topDatasDigitacaoPagos = Array.from(datasDigitacaoPagosMap.entries())
    .map(([data, quantidade]) => ({ data, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);

  // Processar datas de pagamento
  const datasPagamentoMap = new Map<string, { quantidade: number; valorTotal: number }>();
  leadsPagos.forEach(lead => {
    if (lead.dataPagamento) {
      const data = new Date(lead.dataPagamento).toLocaleDateString('pt-BR');
      if (!datasPagamentoMap.has(data)) {
        datasPagamentoMap.set(data, { quantidade: 0, valorTotal: 0 });
      }
      const stats = datasPagamentoMap.get(data)!;
      stats.quantidade++;
      stats.valorTotal += lead.valorPago;
    }
  });
  const topDatasPagamento = Array.from(datasPagamentoMap.entries())
    .map(([data, stats]) => ({ data, ...stats }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);

  return {
    topDatasDigitacao: topDatasDigitacaoPagos, // Usar datas de digitação dos leads PAGOS
    topTemposDigitacao,
    pagoPorBanco,
    topDatasPagamento,
    leadsPagos,
    leadsNaoPagos,
  };
};

export const useContratosAprovadosAnalysis = (banco?: string, importBatchId?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contratos-aprovados-analysis', banco || 'todos', importBatchId || ''],
    queryFn: () => fetchContratosAprovadosAnalysis({ banco, importBatchId }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Invalidar cache quando houver importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log('[useContratosAprovadosAnalysis] Invalidando cache após importação...');
      queryClient.invalidateQueries({ queryKey: ['contratos-aprovados-analysis'] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  return {
    analysis: data || {
      topDatasDigitacao: [],
      topTemposDigitacao: [],
      pagoPorBanco: [],
      topDatasPagamento: [],
      leadsPagos: [],
      leadsNaoPagos: [],
    },
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
};
