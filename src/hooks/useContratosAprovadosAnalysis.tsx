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
  let query = supabase
    .from('leads')
    .select('id, cpf, nome, banco, created_at, data_envio, data_retorno, retorno_get_proposta, retorno_simulacao, valor')
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

  // Processar dados de digitação (created_at)
  const datasDigitacaoMap = new Map<string, number>();
  leads.forEach(lead => {
    if (lead.created_at) {
      const data = new Date(lead.created_at).toLocaleDateString('pt-BR');
      datasDigitacaoMap.set(data, (datasDigitacaoMap.get(data) || 0) + 1);
    }
  });
  const topDatasDigitacao = Array.from(datasDigitacaoMap.entries())
    .map(([data, quantidade]) => ({ data, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3);

  // Processar tempo de digitação (diferença entre data de aprovação e data de pagamento, em dias)
  const temposDigitacaoMap = new Map<string, number>();
  leads.forEach(lead => {
    const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
    const simulacao = lead.retorno_simulacao as Record<string, unknown> | null;
    
    // Data de aprovação = created_at (quando o contrato foi aprovado/importado)
    const dataAprovacao = new Date(lead.created_at);
    
    // Data de pagamento = buscar em múltiplas fontes
    const dataPagamentoStr = 
      getProposta?.disbursementDate || 
      getProposta?.paymentDate || 
      getProposta?.dataPagamento ||
      getProposta?.firstPaymentDate ||
      simulacao?.firstPaymentDate ||
      lead.data_retorno || // Usar data_retorno como fallback
      null;
    
    if (!dataPagamentoStr) return; // Só calcular para contratos com data de pagamento
    
    const dataPagamento = new Date(String(dataPagamentoStr));
    
    if (isNaN(dataPagamento.getTime()) || isNaN(dataAprovacao.getTime())) return;
    
    // Calcular diferença em dias (valor absoluto para evitar negativos)
    const diffMs = Math.abs(dataPagamento.getTime() - dataAprovacao.getTime());
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

  // Processar pagos/não pagos por banco
  const pagoPorBancoMap = new Map<string, { pagos: number; naoPagos: number; valorPago: number }>();
  const leadsPagos: LeadPago[] = [];
  const leadsNaoPagos: LeadPago[] = [];

  leads.forEach(lead => {
    const banco = lead.banco || 'Não informado';
    const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
    
    // Verificar se foi pago - disbursedIssueAmount > 0 indica pagamento
    const valorPago = Number(getProposta?.disbursedIssueAmount || getProposta?.paidAmount || getProposta?.valorPago || 0);
    const isPago = valorPago > 0;
    
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
    topDatasDigitacao,
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
