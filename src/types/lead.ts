// Tipos para os campos JSONB dos leads importados

export interface RetornoAutorizacao {
  autorizacaoId?: string;
  shortUrl?: string;
}

export interface RetornoMargem {
  valorMargemDisponivel?: number;
  valorMargemBase?: number;
  valorTotalDevido?: number;
  registroEmpregaticio?: {
    cnpjEmpregador?: string;
    dataAdmissao?: string;
    dataNascimento?: string;
    nomeMae?: string;
    sexo?: string;
    razaoSocial?: string;
    nomeEmpregado?: string;
  };
  cnpjEmpregador?: string;
  dataAdmissao?: string;
  dataNascimento?: string;
  nomeMae?: string;
  sexo?: string;
  nomeEmpregado?: string;
}

export interface PaymentScheduleItem {
  number?: number;
  dueDate?: string;
  principal?: number;
  interest?: number;
  amortization?: number;
  outstandingBalance?: number;
}

export interface RetornoSimulacao {
  id?: string;
  productId?: string;
  productName?: string;
  requestedAmount?: number;
  liquidValue?: number;
  monthlyInterest?: number;
  yearlyInterest?: number;
  cet?: number;
  numberOfPayments?: number;
  firstPaymentDate?: string;
  lastPaymentDate?: string;
  valorMargem?: number;
  availableBalance?: number;
  amortizationType?: string;
  paymentScheduleItems?: PaymentScheduleItem[];
}

export interface RetornoProposta {
  [key: string]: any;
}

export interface RetornoGetProposta {
  [key: string]: any;
}

// Interface principal do Lead com todos os campos
export interface LeadCompleto {
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
  imported_by: string | null;
  import_batch_id: string | null;
  retorno_autorizacao: RetornoAutorizacao | null;
  retorno_margem: RetornoMargem | null;
  retorno_simulacao: RetornoSimulacao | null;
  retorno_proposta: RetornoProposta | null;
  retorno_get_proposta: RetornoGetProposta | null;
  ultimo_log: string | null;
}

// Dados extraídos do lead para visualização
export interface LeadExtraido {
  id: string;
  cpf: string;
  nome: string;
  banco: string;
  cbo: string;
  status: string;
  valorMargem: number;
  valorSimulacao: number;
  taxaJuros: number;
  parcelas: number;
  cnpjEmpregador: string;
  dataAdmissao: string;
  ultimoLog: string;
}

// Função para extrair dados do lead
export function extrairDadosLead(lead: LeadCompleto): LeadExtraido {
  const margem = lead.retorno_margem;
  const simulacao = lead.retorno_simulacao;
  
  // Extrair nome do registro empregático ou do campo nome
  const nomeExtraido = 
    margem?.registroEmpregaticio?.nomeEmpregado ||
    margem?.nomeEmpregado ||
    lead.nome ||
    "";

  // Determinar banco baseado nos dados disponíveis
  const bancoExtraido = lead.banco || "";
  
  // Extrair CBO - pode vir de vários lugares
  const cboExtraido = lead.cbo || "";

  // Determinar status (aprovado/reprovado)
  const statusExtraido = lead.status || "pendente";

  return {
    id: lead.id,
    cpf: lead.cpf,
    nome: nomeExtraido,
    banco: bancoExtraido,
    cbo: cboExtraido,
    status: statusExtraido,
    valorMargem: margem?.valorMargemDisponivel || 0,
    valorSimulacao: simulacao?.requestedAmount || simulacao?.liquidValue || 0,
    taxaJuros: simulacao?.monthlyInterest || 0,
    parcelas: simulacao?.numberOfPayments || 0,
    cnpjEmpregador: margem?.registroEmpregaticio?.cnpjEmpregador || margem?.cnpjEmpregador || "",
    dataAdmissao: margem?.registroEmpregaticio?.dataAdmissao || margem?.dataAdmissao || "",
    ultimoLog: lead.ultimo_log || "",
  };
}

// Função para parsear JSON de forma segura
export function parseJsonSafe<T>(value: any): T | null {
  if (!value) return null;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
