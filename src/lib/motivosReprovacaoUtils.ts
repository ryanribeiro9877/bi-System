/**
 * Funções para extração de MÚLTIPLOS motivos de reprovação de um lead
 * 
 * Um lead pode ter vários motivos de reprovação no campo retorno_margem.error
 * Este módulo extrai e categoriza cada motivo individualmente.
 */

// Tipos
export interface MotivoReprovacao {
  codigo: string;
  descricao: string;
  categoria: 'MARGEM' | 'ELEGIBILIDADE' | 'VINCULO' | 'EMPRESA' | 'SISTEMA' | 'OUTRO';
}

export interface AnaliseMotivosLead {
  cpf: string;
  quantidadeMotivos: number;
  motivos: MotivoReprovacao[];
  erroOriginal: string | null;
}

// Mapeamento de códigos para descrições amigáveis
export const MOTIVOS_MAP: Record<string, MotivoReprovacao> = {
  'RESTRICAO_CONVENIO': {
    codigo: 'RESTRICAO_CONVENIO',
    descricao: 'Restrições do Convênio',
    categoria: 'ELEGIBILIDADE'
  },
  'CBO_BLOQUEADO': {
    codigo: 'CBO_BLOQUEADO',
    descricao: 'CBO Bloqueado',
    categoria: 'ELEGIBILIDADE'
  },
  'MARGEM_ZERADA': {
    codigo: 'MARGEM_ZERADA',
    descricao: 'Margem Zerada (R$ 0,00)',
    categoria: 'MARGEM'
  },
  'MARGEM_NEGATIVA': {
    codigo: 'MARGEM_NEGATIVA',
    descricao: 'Margem Negativa',
    categoria: 'MARGEM'
  },
  'MARGEM_INSUFICIENTE': {
    codigo: 'MARGEM_INSUFICIENTE',
    descricao: 'Margem Insuficiente',
    categoria: 'MARGEM'
  },
  'TEMPO_VINCULO_INSUFICIENTE': {
    codigo: 'TEMPO_VINCULO_INSUFICIENTE',
    descricao: 'Tempo de Vínculo Insuficiente',
    categoria: 'VINCULO'
  },
  'DESLIGAMENTO': {
    codigo: 'DESLIGAMENTO',
    descricao: 'Vínculo com Data de Desligamento',
    categoria: 'VINCULO'
  },
  'PORTE_NAO_ATENDIDO': {
    codigo: 'PORTE_NAO_ATENDIDO',
    descricao: 'Porte da Empresa Não Atendido',
    categoria: 'EMPRESA'
  },
  'EMPRESA_NAO_ATENDE': {
    codigo: 'EMPRESA_NAO_ATENDE',
    descricao: 'Empresa Não Atende Requisitos',
    categoria: 'EMPRESA'
  },
  'CNAE_NAO_PERMITIDO': {
    codigo: 'CNAE_NAO_PERMITIDO',
    descricao: 'CNAE Não Permitido',
    categoria: 'EMPRESA'
  },
  'AFASTAMENTO': {
    codigo: 'AFASTAMENTO',
    descricao: 'Funcionário Afastado',
    categoria: 'VINCULO'
  },
  'EMPRESTIMO_ATIVO': {
    codigo: 'EMPRESTIMO_ATIVO',
    descricao: 'Empréstimo/Contrato Ativo',
    categoria: 'ELEGIBILIDADE'
  },
  'RATE_LIMIT': {
    codigo: 'RATE_LIMIT',
    descricao: 'Rate Limit / Limite Excedido',
    categoria: 'SISTEMA'
  },
  'TIMEOUT': {
    codigo: 'TIMEOUT',
    descricao: 'Timeout',
    categoria: 'SISTEMA'
  },
  'ERRO_SISTEMA': {
    codigo: 'ERRO_SISTEMA',
    descricao: 'Erro de Sistema',
    categoria: 'SISTEMA'
  },
  'NAO_ELEGIVEL': {
    codigo: 'NAO_ELEGIVEL',
    descricao: 'Não Elegível',
    categoria: 'ELEGIBILIDADE'
  },
  'BLOQUEIO_JUDICIAL': {
    codigo: 'BLOQUEIO_JUDICIAL',
    descricao: 'Bloqueio Judicial',
    categoria: 'ELEGIBILIDADE'
  },
  'BLOQUEIO_ADMINISTRATIVO': {
    codigo: 'BLOQUEIO_ADMINISTRATIVO',
    descricao: 'Bloqueio Administrativo',
    categoria: 'ELEGIBILIDADE'
  },
  'IDADE_FORA_FAIXA': {
    codigo: 'IDADE_FORA_FAIXA',
    descricao: 'Idade Fora da Faixa',
    categoria: 'ELEGIBILIDADE'
  },
  'SEM_AUTORIZACAO': {
    codigo: 'SEM_AUTORIZACAO',
    descricao: 'Sem Autorização',
    categoria: 'ELEGIBILIDADE'
  },
  'FERIAS': {
    codigo: 'FERIAS',
    descricao: 'Funcionário em Férias',
    categoria: 'VINCULO'
  },
  'LICENCA': {
    codigo: 'LICENCA',
    descricao: 'Funcionário em Licença',
    categoria: 'VINCULO'
  },
  'CONTRATO_TEMPORARIO': {
    codigo: 'CONTRATO_TEMPORARIO',
    descricao: 'Contrato Temporário/Prazo Determinado',
    categoria: 'VINCULO'
  },
};

// Padrões regex para detectar cada tipo de motivo
const PADROES_MOTIVOS: Array<{ codigo: string; padrao: RegExp }> = [
  { codigo: 'AFASTAMENTO', padrao: /afastamento/i },
  { codigo: 'TEMPO_VINCULO_INSUFICIENTE', padrao: /tempo m[ií]nimo de v[ií]nculo|n[aã]o atingiu o tempo|v[ií]nculo empregat[ií]cio.*meses/i },
  { codigo: 'PORTE_NAO_ATENDIDO', padrao: /porte.*n[aã]o atendido|porte \([A-Z]+\) n[aã]o atendido/i },
  { codigo: 'DESLIGAMENTO', padrao: /data de desligamento|desligado|desligamento/i },
  { codigo: 'MARGEM_ZERADA', padrao: /margem dispon[ií]vel R\$ 0|n[aã]o existe valor de margem|margem zerada|sem margem|R\$ 0,00/i },
  { codigo: 'MARGEM_NEGATIVA', padrao: /margem negativa|valor negativo/i },
  { codigo: 'MARGEM_INSUFICIENTE', padrao: /margem insuficiente|margem abaixo|valor.*insuficiente/i },
  { codigo: 'CBO_BLOQUEADO', padrao: /cbo.*bloqueado|ocupa[cç][aã]o.*bloqueada/i },
  { codigo: 'EMPRESA_NAO_ATENDE', padrao: /empresa.*n[aã]o atende|empresa n[aã]o eleg[ií]vel/i },
  { codigo: 'CNAE_NAO_PERMITIDO', padrao: /cnae.*n[aã]o permitido|cnae.*bloqueado/i },
  { codigo: 'IDADE_FORA_FAIXA', padrao: /idade.*fora|faixa et[aá]ria|idade m[ií]nima|idade m[aá]xima/i },
  { codigo: 'BLOQUEIO_JUDICIAL', padrao: /bloqueio judicial|restri[cç][aã]o judicial/i },
  { codigo: 'BLOQUEIO_ADMINISTRATIVO', padrao: /bloqueio administrativo/i },
  { codigo: 'EMPRESTIMO_ATIVO', padrao: /empr[eé]stimo ativo|opera[cç][aã]o ativa|contrato ativo|j[aá] possui contrato/i },
  { codigo: 'LIMITE_EMPRESTIMOS', padrao: /limite de empr[eé]stimos|quantidade m[aá]xima/i },
  { codigo: 'SERVIDOR_INATIVO', padrao: /servidor inativo/i },
  { codigo: 'FERIAS', padrao: /f[eé]rias/i },
  { codigo: 'LICENCA', padrao: /licen[cç]a/i },
  { codigo: 'CONTRATO_TEMPORARIO', padrao: /contrato tempor[aá]rio|prazo determinado/i },
  { codigo: 'SEM_AUTORIZACAO', padrao: /sem autoriza[cç][aã]o|autoriza[cç][aã]o n[aã]o|n[aã]o autorizado/i },
  { codigo: 'RATE_LIMIT', padrao: /rate limit|too many requests|limite.*excedido|429|TOO_MANY_REQUESTS/i },
  { codigo: 'TIMEOUT', padrao: /timeout|tempo esgotado/i },
  { codigo: 'ERRO_SISTEMA', padrao: /erro interno|internal.*error|500|erro de sistema/i },
  { codigo: 'NAO_ELEGIVEL', padrao: /n[aã]o eleg[ií]vel|ineleg[ií]vel|ineligible/i },
  { codigo: 'RESTRICAO_CONVENIO', padrao: /restri[cç][oõ]es.*conv[eê]nio|configura[cç][oõ]es do conv[eê]nio/i },
];

/**
 * Extrai TODOS os motivos de reprovação de uma mensagem de erro
 * 
 * @param erroMargem - String de erro do campo retorno_margem.error
 * @returns Array de códigos de motivos encontrados
 */
export const extrairCodigosMotivos = (erroMargem: string | null | undefined): string[] => {
  if (!erroMargem || typeof erroMargem !== 'string') {
    return [];
  }

  const motivos = new Set<string>();

  // Verificar cada padrão
  for (const { codigo, padrao } of PADROES_MOTIVOS) {
    if (padrao.test(erroMargem)) {
      motivos.add(codigo);
    }
  }

  return Array.from(motivos);
};

/**
 * Extrai todos os motivos de reprovação com descrições completas
 * 
 * @param erroMargem - String de erro do campo retorno_margem.error
 * @returns Array de objetos MotivoReprovacao
 */
export const extrairMotivosReprovacao = (erroMargem: string | null | undefined): MotivoReprovacao[] => {
  const codigos = extrairCodigosMotivos(erroMargem);
  
  return codigos.map(codigo => {
    const mapeado = MOTIVOS_MAP[codigo];
    if (mapeado) {
      return mapeado;
    }
    // Fallback para códigos não mapeados
    return {
      codigo,
      descricao: codigo.replace(/_/g, ' '),
      categoria: 'OUTRO' as const
    };
  });
};

/**
 * Analisa um lead e extrai todos os seus motivos de reprovação
 * 
 * @param lead - Objeto do lead com retorno_margem
 * @returns Objeto com análise completa dos motivos
 */
export const analisarMotivosLead = (lead: {
  cpf?: string;
  retorno_margem?: unknown;
}): AnaliseMotivosLead => {
  const cpf = lead.cpf || '';
  let erroOriginal: string | null = null;

  // Extrair erro do retorno_margem
  if (lead.retorno_margem) {
    let margem = lead.retorno_margem;
    
    // Se for array, pegar primeiro elemento
    if (Array.isArray(margem) && margem.length > 0) {
      margem = margem[0];
    }
    
    // Extrair campo error
    if (margem && typeof margem === 'object') {
      const margemObj = margem as Record<string, unknown>;
      erroOriginal = (margemObj.error as string) || (margemObj.message as string) || null;
    }
  }

  const motivos = extrairMotivosReprovacao(erroOriginal);

  return {
    cpf,
    quantidadeMotivos: motivos.length,
    motivos,
    erroOriginal
  };
};

/**
 * Formata a quantidade de motivos para exibição
 * 
 * @param quantidade - Número de motivos
 * @returns String formatada (ex: "3 motivos", "1 motivo", "Sem motivos")
 */
export const formatarQuantidadeMotivos = (quantidade: number): string => {
  if (quantidade === 0) return 'Sem motivos';
  if (quantidade === 1) return '1 motivo';
  return `${quantidade} motivos`;
};

/**
 * Agrupa motivos por categoria
 * 
 * @param motivos - Array de motivos
 * @returns Objeto com motivos agrupados por categoria
 */
export const agruparMotivosPorCategoria = (motivos: MotivoReprovacao[]): Record<string, MotivoReprovacao[]> => {
  const grupos: Record<string, MotivoReprovacao[]> = {
    MARGEM: [],
    ELEGIBILIDADE: [],
    VINCULO: [],
    EMPRESA: [],
    SISTEMA: [],
    OUTRO: []
  };

  for (const motivo of motivos) {
    if (grupos[motivo.categoria]) {
      grupos[motivo.categoria].push(motivo);
    } else {
      grupos.OUTRO.push(motivo);
    }
  }

  // Remover categorias vazias
  return Object.fromEntries(
    Object.entries(grupos).filter(([_, arr]) => arr.length > 0)
  );
};

/**
 * Cores por categoria para visualização
 */
export const CORES_CATEGORIA: Record<string, string> = {
  MARGEM: '#ef4444',      // Vermelho
  ELEGIBILIDADE: '#f97316', // Laranja
  VINCULO: '#eab308',     // Amarelo
  EMPRESA: '#3b82f6',     // Azul
  SISTEMA: '#6b7280',     // Cinza
  OUTRO: '#9ca3af'        // Cinza claro
};

/**
 * Labels das categorias para exibição
 */
export const LABELS_CATEGORIA: Record<string, string> = {
  MARGEM: 'Problemas de Margem',
  ELEGIBILIDADE: 'Elegibilidade',
  VINCULO: 'Vínculo Empregatício',
  EMPRESA: 'Empresa/Empregador',
  SISTEMA: 'Erros de Sistema',
  OUTRO: 'Outros'
};
