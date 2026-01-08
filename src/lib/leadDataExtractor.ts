/**
 * Utilitário centralizado para extrair dados de leads de múltiplas fontes JSONB
 * Suporta estruturas de UY3 (retorno_margem como array) e V8 (retorno_simulacao)
 */

import { normalizarStatusLead } from "@/lib/leadStatusUtils";

// Tipos de dados extraídos
export interface DadosExtraidos {
  nome: string;
  cpf: string;
  cbo: { codigo: string; descricao: string } | null;
  empresa: { cnpj: string; razaoSocial: string } | null;
  idade: number | null;
  sexo: string | null;
  dataAdmissao: Date | null;
  tempoVinculoMeses: number | null;
  margemDisponivel: number;
  margemBase: number;
  valorSimulacao: number;
  statusNormalizado: "aprovado" | "reprovado" | "pendente";
}

// Parse seguro do retorno_margem (pode ser array ou objeto)
const parseRetornoMargem = (margem: any): any => {
  if (!margem) return null;
  
  // Se for array (formato UY3), pega o primeiro elemento
  if (Array.isArray(margem)) {
    const item = margem[0];
    // O dado real está em result[0]
    if (item?.result && Array.isArray(item.result) && item.result[0]) {
      return item.result[0];
    }
    return item;
  }
  
  // Se for objeto direto
  if (typeof margem === "object") {
    // Verifica se tem result aninhado
    if (margem.result && Array.isArray(margem.result) && margem.result[0]) {
      return margem.result[0];
    }
    return margem;
  }
  
  return null;
};

// Extrai CBO do lead
export const extrairCBO = (lead: any): { codigo: string; descricao: string } | null => {
  const margem = parseRetornoMargem(lead.retorno_margem);
  
  // 1. Formato UY3 - cbo como objeto
  if (margem?.cbo && typeof margem.cbo === "object") {
    return {
      codigo: String(margem.cbo.codigo || ""),
      descricao: String(margem.cbo.descricao || ""),
    };
  }
  
  // 2. Formato alternativo - string direta
  if (margem?.cbo && typeof margem.cbo === "string") {
    return { codigo: "", descricao: margem.cbo };
  }
  
  // 3. Campo cbo do lead
  if (lead.cbo) {
    return { codigo: "", descricao: String(lead.cbo) };
  }
  
  // 4. Tenta extrair do erro de CBO bloqueado
  if (lead.cbo_block_code || lead.cbo_block_name) {
    return {
      codigo: lead.cbo_block_code || "",
      descricao: lead.cbo_block_name || "",
    };
  }
  
  return null;
};

// Extrai empresa do lead
export const extrairEmpresa = (lead: any): { cnpj: string; razaoSocial: string } | null => {
  const margem = parseRetornoMargem(lead.retorno_margem);
  
  if (!margem) return null;
  
  // Formato UY3 - numeroInscricaoEmpregador
  if (margem.numeroInscricaoEmpregador || margem.nomeEmpregador) {
    return {
      cnpj: String(margem.numeroInscricaoEmpregador || ""),
      razaoSocial: String(margem.nomeEmpregador || ""),
    };
  }
  
  // Formato alternativo
  if (margem.cnpjEmpregador) {
    return {
      cnpj: String(margem.cnpjEmpregador),
      razaoSocial: String(margem.razaoSocial || margem.nomeEmpregador || ""),
    };
  }
  
  return null;
};

// Extrai dados demográficos
export const extrairDadosDemograficos = (lead: any): {
  idade: number | null;
  sexo: string | null;
  dataAdmissao: Date | null;
  tempoVinculoMeses: number | null;
} => {
  const margem = parseRetornoMargem(lead.retorno_margem);
  
  let idade: number | null = null;
  let sexo: string | null = null;
  let dataAdmissao: Date | null = null;
  let tempoVinculoMeses: number | null = null;
  
  if (!margem) return { idade, sexo, dataAdmissao, tempoVinculoMeses };
  
  // Data de nascimento - formato DDMMYYYY
  if (margem.dataNascimento) {
    const dataNasc = margem.dataNascimento;
    let parsedDate: Date | null = null;
    
    if (typeof dataNasc === "string" && dataNasc.length === 8) {
      // Formato DDMMYYYY
      const dia = parseInt(dataNasc.substring(0, 2));
      const mes = parseInt(dataNasc.substring(2, 4)) - 1;
      const ano = parseInt(dataNasc.substring(4, 8));
      parsedDate = new Date(ano, mes, dia);
    } else if (typeof dataNasc === "string" && dataNasc.includes("-")) {
      parsedDate = new Date(dataNasc);
    }
    
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      idade = Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }
  }
  
  // Sexo
  if (margem.sexo) {
    if (typeof margem.sexo === "object") {
      sexo = margem.sexo.codigo === 1 ? "M" : "F";
    } else {
      sexo = String(margem.sexo).toUpperCase().charAt(0);
    }
  }
  
  // Data de admissão - formato DDMMYYYY
  if (margem.dataAdmissao) {
    const dataAdm = margem.dataAdmissao;
    let parsedDate: Date | null = null;
    
    if (typeof dataAdm === "string" && dataAdm.length === 8) {
      const dia = parseInt(dataAdm.substring(0, 2));
      const mes = parseInt(dataAdm.substring(2, 4)) - 1;
      const ano = parseInt(dataAdm.substring(4, 8));
      parsedDate = new Date(ano, mes, dia);
    } else if (typeof dataAdm === "string" && dataAdm.includes("-")) {
      parsedDate = new Date(dataAdm);
    }
    
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      dataAdmissao = parsedDate;
      tempoVinculoMeses = Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    }
  }
  
  return { idade, sexo, dataAdmissao, tempoVinculoMeses };
};

// Extrai valores financeiros
export const extrairValoresFinanceiros = (lead: any): {
  margemDisponivel: number;
  margemBase: number;
  valorSimulacao: number;
} => {
  const margem = parseRetornoMargem(lead.retorno_margem);
  const simulacao = lead.retorno_simulacao as any;
  
  let margemDisponivel = 0;
  let margemBase = 0;
  let valorSimulacao = 0;
  
  // Margem do retorno_margem
  if (margem) {
    margemDisponivel = parseFloat(margem.valorMargemDisponivel) || 0;
    margemBase = parseFloat(margem.valorBaseMargem || margem.valorMargemBase) || 0;
  }
  
  // Valores de simulação (V8)
  if (simulacao) {
    valorSimulacao = parseFloat(simulacao.liquidValue || simulacao.requestedAmount) || 0;
    
    // Se não tiver margem mas tiver simulação, usa o valor da simulação
    if (margemDisponivel === 0 && valorSimulacao > 0) {
      margemDisponivel = valorSimulacao;
    }
  }
  
  return { margemDisponivel, margemBase, valorSimulacao };
};

// Extrai todos os dados de um lead
export const extrairTodosDados = (lead: any): DadosExtraidos => {
  const margem = parseRetornoMargem(lead.retorno_margem);
  const demograficos = extrairDadosDemograficos(lead);
  const financeiros = extrairValoresFinanceiros(lead);
  
  return {
    nome: margem?.nome || lead.nome || "",
    cpf: lead.cpf || "",
    cbo: extrairCBO(lead),
    empresa: extrairEmpresa(lead),
    ...demograficos,
    ...financeiros,
    statusNormalizado: normalizarStatusLead(lead),
  };
};

// Formata CNPJ
export const formatarCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};
