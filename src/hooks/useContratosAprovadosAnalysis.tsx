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

// Lista de status que indicam pagamento
const STATUS_PAGOS = [
  'encerrado', 
  'liquidacao', 
  'liquidacao manual', 
  'pago', 
  'liquidado',
  'aprovacao de instrumento',
  'aprovacao manual',
  'aprovado'
];

const isStatusPagamento = (statusDescription: string | null): boolean => {
  if (!statusDescription) return false;
  const normalized = statusDescription
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return STATUS_PAGOS.some(s => normalized.includes(s));
};

const fetchContratosAprovadosAnalysis = async (params?: FetchParams): Promise<ContratosAprovadosAnalysis> => {
  // Buscar leads aprovados OU com statusDescription de pagamento usando filtro OR
  let query = supabase
    .from('leads')
    .select('id, cpf, nome, banco, status, created_at, data_envio, data_retorno, retorno_get_proposta, retorno_simulacao, valor')
    .or('status.in.(aprovado,approved,reprovacao_tecnica),retorno_get_proposta->>statusDescription.ilike.%liquid%,retorno_get_proposta->>statusDescription.ilike.%pago%,retorno_get_proposta->>statusDescription.ilike.%aprovado%,retorno_get_proposta->>statusDescription.ilike.%aprovacao%,retorno_get_proposta->>statusDescription.ilike.%encerrado%');

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

  // Processar pagos/não pagos por banco PRIMEIRO (para usar na filtragem de tempos de digitação)
  const pagoPorBancoMap = new Map<string, { pagos: number; naoPagos: number; valorPago: number }>();
  const leadsPagos: LeadPago[] = [];
  const leadsNaoPagos: LeadPago[] = [];

  leads.forEach(lead => {
    const banco = lead.banco || 'Não informado';
    const getProposta = lead.retorno_get_proposta as Record<string, unknown> | null;
    
    // Verificar se foi pago - baseado no statusDescription do retorno_get_proposta
    const statusDescription = getProposta?.statusDescription as string | null;
    const normalizedStatus = statusDescription 
      ? statusDescription.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      : '';
    
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
    const isPago = statusPagos.some(s => normalizedStatus.includes(s));
    
    const valorLead = lead.valor || Number(getProposta?.disbursedIssueAmount || getProposta?.requestedAmount || 0);
    const dataPagamento = getProposta?.disbursementDate || getProposta?.paymentDate || getProposta?.dataPagamento || null;
    const nome = lead.nome || (getProposta?.name as string) || '';
    
    const leadInfo: LeadPago = {
      id: lead.id,
      cpf: lead.cpf,
      nome,
      banco,
      valorPago: valorLead,
      dataPagamento: dataPagamento ? String(dataPagamento) : null,
      dataDigitacao: lead.created_at,
    };
    
    if (!pagoPorBancoMap.has(banco)) {
      pagoPorBancoMap.set(banco, { pagos: 0, naoPagos: 0, valorPago: 0 });
    }
    
    const stats = pagoPorBancoMap.get(banco)!;
    if (isPago) {
      stats.pagos++;
      stats.valorPago += valorLead;
      leadsPagos.push(leadInfo);
    } else {
      stats.naoPagos++;
      leadsNaoPagos.push(leadInfo);
    }
  });

  // Processar tempo de digitação - APENAS para leads PAGOS
  // (diferença entre data de aprovação e data de pagamento, em dias)
  const temposDigitacaoMap = new Map<string, number>();
  leadsPagos.forEach(lead => {
    // Data de aprovação = dataDigitacao (created_at)
    const dataAprovacao = new Date(lead.dataDigitacao);
    
    // Data de pagamento
    if (!lead.dataPagamento) return;
    
    const dataPagamento = new Date(lead.dataPagamento);
    
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
    staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos
    gcTime: 30 * 60 * 1000, // 30 minutos em cache
    refetchOnWindowFocus: false, // Não recarregar ao focar na janela
    placeholderData: (previousData) => previousData, // Manter dados anteriores enquanto carrega
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
