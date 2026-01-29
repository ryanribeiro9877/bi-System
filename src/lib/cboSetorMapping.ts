// Mapeamento de CBOs para setores de atuação
// Baseado na Classificação Brasileira de Ocupações (CBO)

export interface SetorInfo {
  nome: string;
  cor: string;
}

export const SETORES: Record<string, SetorInfo> = {
  "comercio_vendas": { nome: "Comércio e Vendas", cor: "#8B5CF6" },
  "administrativo": { nome: "Administrativo", cor: "#3B82F6" },
  "transporte_logistica": { nome: "Transporte e Logística", cor: "#10B981" },
  "servicos_gerais": { nome: "Serviços Gerais", cor: "#F59E0B" },
  "seguranca": { nome: "Segurança", cor: "#EF4444" },
  "construcao_civil": { nome: "Construção Civil", cor: "#6366F1" },
  "industria_producao": { nome: "Indústria e Produção", cor: "#EC4899" },
  "alimentacao_gastronomia": { nome: "Alimentação e Gastronomia", cor: "#14B8A6" },
  "saude": { nome: "Saúde", cor: "#F97316" },
  "educacao": { nome: "Educação", cor: "#84CC16" },
  "tecnologia": { nome: "Tecnologia", cor: "#06B6D4" },
  "agropecuaria": { nome: "Agropecuária", cor: "#22C55E" },
  "aviacao": { nome: "Aviação", cor: "#A855F7" },
  "financeiro": { nome: "Financeiro e Negócios", cor: "#0EA5E9" },
  "outros": { nome: "Outros", cor: "#64748B" },
};

// Mapeamento de códigos CBO para setores
// Os primeiros 2-3 dígitos do CBO indicam a grande área
export function mapearCBOParaSetor(cboCode: string, cboName: string): string {
  const code = cboCode?.trim() || "";
  const name = (cboName || "").toUpperCase();
  
  // Primeiro, verificar por palavras-chave no nome
  if (name.includes("VEND") || name.includes("COMERCI") || name.includes("PROMOTOR") || 
      name.includes("LOJA") || name.includes("MERCADO") || name.includes("ATENDENTE DE LOJA") ||
      name.includes("REPOSITOR") || name.includes("CAIXA") || name.includes("SUPERVISOR DE VENDAS") ||
      name.includes("GERENTE DE VENDAS") || name.includes("GERENTE COMERCIAL")) {
    return "comercio_vendas";
  }
  
  if (name.includes("ADMINISTRATIVO") || name.includes("ESCRITORIO") || name.includes("ALMOXARIFE") ||
      name.includes("AUXILIAR DE LOGISTICA") || name.includes("APONTADOR") || name.includes("RECEPCIONISTA") ||
      name.includes("GERENTE ADMINISTRATIVO") || name.includes("SUPERVISOR ADMINISTRATIVO")) {
    return "administrativo";
  }
  
  if (name.includes("MOTORISTA") || name.includes("CARREGADOR") || name.includes("AJUDANTE DE MOTORISTA") ||
      name.includes("FURGAO") || name.includes("CAMINHAO") || name.includes("ONIBUS") ||
      name.includes("TRATORISTA")) {
    return "transporte_logistica";
  }
  
  if (name.includes("FAXINEIRO") || name.includes("ZELADOR") || name.includes("LIMPEZA") ||
      name.includes("SERVENTE") || name.includes("MANUTENCAO DE EDIFICACOES")) {
    return "servicos_gerais";
  }
  
  if (name.includes("VIGILANTE") || name.includes("PORTEIRO") || name.includes("VIGIA") ||
      name.includes("SEGURANCA")) {
    return "seguranca";
  }
  
  if (name.includes("PEDREIRO") || name.includes("PINTOR DE OBRAS") || name.includes("ELETRICISTA") ||
      name.includes("ENCANADOR") || name.includes("MESTRE") && name.includes("OBRA")) {
    return "construcao_civil";
  }
  
  if (name.includes("SOLDADOR") || name.includes("OPERADOR DE MAQUINA") || name.includes("PRODUCAO") ||
      name.includes("ALIMENTADOR DE LINHA") || name.includes("MECANICO") || name.includes("TECNICO EM MANUTENCAO") ||
      name.includes("MAQUINAS FIXAS") || name.includes("INDUSTRIAL")) {
    return "industria_producao";
  }
  
  if (name.includes("COZINHEIRO") || name.includes("GARCOM") || name.includes("ALIMENTACAO") ||
      name.includes("PADEIRO") || name.includes("RESTAURANTE") || name.includes("CONFEITEIRO") ||
      name.includes("ACOUGUEIRO")) {
    return "alimentacao_gastronomia";
  }
  
  if (name.includes("ENFERMEIRO") || name.includes("ENFERMAGEM") || name.includes("SAUDE") ||
      name.includes("FARMACEUTICO") || name.includes("MEDICO") || name.includes("AUXILIAR DE FARMACIA")) {
    return "saude";
  }
  
  if (name.includes("PROFESSOR") || name.includes("EDUCACAO") || name.includes("INSTRUTOR") ||
      name.includes("PEDAGOGO")) {
    return "educacao";
  }
  
  if (name.includes("SISTEMAS") || name.includes("DESENVOLVEDOR") || name.includes("PROGRAMADOR") ||
      name.includes("ANALISTA DE DESENVOLVIMENTO") || name.includes("TECNOLOGIA") || name.includes("TI")) {
    return "tecnologia";
  }
  
  if (name.includes("AGRICOLA") || name.includes("AGROPECUARIO") || name.includes("VOLANTE DA AGRICULTURA") ||
      name.includes("PECUARIA") || name.includes("TRABALHADOR RURAL")) {
    return "agropecuaria";
  }
  
  if (name.includes("PILOTO") || name.includes("COMISSARIO DE VOO") || name.includes("AERONAVE") ||
      name.includes("AVIACAO")) {
    return "aviacao";
  }
  
  if (name.includes("ANALISTA DE NEGOCIOS") || name.includes("ADMINISTRADOR") || name.includes("FINANCEIRO") ||
      name.includes("CONTADOR") || name.includes("GERENTE DE AGENCIA") || name.includes("TELEMARKETING")) {
    return "financeiro";
  }
  
  // Se não encontrou por palavras-chave, usar código CBO
  const prefix2 = code.substring(0, 2);
  const prefix3 = code.substring(0, 3);
  
  // Grandes grupos CBO
  switch (prefix2) {
    case "14": // Gerentes
      if (prefix3 === "142") return "comercio_vendas"; // Gerentes de vendas/comercial
      return "administrativo";
    case "21": // Profissionais de ciências exatas
      if (prefix3 === "212") return "tecnologia";
      if (prefix3 === "215") return "aviacao";
      return "outros";
    case "22": // Profissionais de saúde
    case "32": // Técnicos de saúde
      return "saude";
    case "23": // Profissionais de ensino
      return "educacao";
    case "25": // Profissionais de administração
      return "financeiro";
    case "35": // Técnicos de nível médio
      if (prefix3 === "354") return "comercio_vendas"; // Propagandistas
      return "administrativo";
    case "41": // Escriturários
    case "42": // Trabalhadores de atendimento
      if (prefix3 === "421") return "comercio_vendas"; // Operadores de caixa
      if (prefix3 === "422") return "administrativo"; // Recepcionistas
      return "administrativo";
    case "51": // Trabalhadores de serviços
      if (prefix3 === "511") return "aviacao"; // Comissários
      if (prefix3 === "513") return "alimentacao_gastronomia";
      if (prefix3 === "514") return "servicos_gerais";
      if (prefix3 === "517") return "seguranca";
      return "servicos_gerais";
    case "52": // Vendedores
      return "comercio_vendas";
    case "62": // Trabalhadores agropecuários
    case "64": // Trabalhadores de máquinas agrícolas
      return "agropecuaria";
    case "71": // Trabalhadores da construção
      return "construcao_civil";
    case "72": // Trabalhadores de instalações
    case "73": // Trabalhadores de montagem
    case "74": // Trabalhadores de manutenção
    case "84": // Trabalhadores de produção
    case "86": // Operadores de instalações
    case "91": // Mecânicos de manutenção
      return "industria_producao";
    case "78": // Condutores de veículos
      return "transporte_logistica";
    default:
      return "outros";
  }
}

export interface CBOPorSetor {
  setor: string;
  setorNome: string;
  cor: string;
  cbos: Array<{ code: string; name: string; count: number; margemPerdida?: number }>;
  totalLeads: number;
  margemTotalPerdida: number;
}

export function agruparCBOsPorSetor(
  cbos: Array<{ code: string; name: string; count: number; margemPerdida?: number }>
): CBOPorSetor[] {
  const setorMap: Record<string, CBOPorSetor> = {};
  
  cbos.forEach(cbo => {
    const setorKey = mapearCBOParaSetor(cbo.code, cbo.name);
    const setorInfo = SETORES[setorKey] || SETORES.outros;
    
    if (!setorMap[setorKey]) {
      setorMap[setorKey] = {
        setor: setorKey,
        setorNome: setorInfo.nome,
        cor: setorInfo.cor,
        cbos: [],
        totalLeads: 0,
        margemTotalPerdida: 0,
      };
    }
    
    setorMap[setorKey].cbos.push(cbo);
    setorMap[setorKey].totalLeads += cbo.count;
    setorMap[setorKey].margemTotalPerdida += cbo.margemPerdida || 0;
  });
  
  // Ordenar CBOs dentro de cada setor por quantidade
  Object.values(setorMap).forEach(setor => {
    setor.cbos.sort((a, b) => b.count - a.count);
  });
  
  return Object.values(setorMap).sort((a, b) => b.totalLeads - a.totalLeads);
}

/**
 * Agrupa CBOs aprovados por setor
 */
export interface CBOAprovadoPorSetor {
  setor: string;
  setorNome: string;
  cor: string;
  cbos: Array<{ code: string; name: string; count: number; margemAprovada?: number }>;
  totalLeads: number;
  margemTotalAprovada: number;
}

export function agruparCBOsAprovadosPorSetor(
  cbos: Array<{ code: string; name: string; count: number; margemAprovada?: number }>
): CBOAprovadoPorSetor[] {
  const setorMap: Record<string, CBOAprovadoPorSetor> = {};
  
  cbos.forEach(cbo => {
    const setorKey = mapearCBOParaSetor(cbo.code, cbo.name);
    const setorInfo = SETORES[setorKey] || SETORES.outros;
    
    if (!setorMap[setorKey]) {
      setorMap[setorKey] = {
        setor: setorKey,
        setorNome: setorInfo.nome,
        cor: setorInfo.cor,
        cbos: [],
        totalLeads: 0,
        margemTotalAprovada: 0,
      };
    }
    
    setorMap[setorKey].cbos.push(cbo);
    setorMap[setorKey].totalLeads += cbo.count;
    setorMap[setorKey].margemTotalAprovada += cbo.margemAprovada || 0;
  });
  
  // Ordenar CBOs dentro de cada setor por quantidade
  Object.values(setorMap).forEach(setor => {
    setor.cbos.sort((a, b) => b.count - a.count);
  });
  
  return Object.values(setorMap).sort((a, b) => b.totalLeads - a.totalLeads);
}
