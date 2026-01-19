import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";
import { useLeadsAnalysis } from "@/hooks/useLeadsAnalysis";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, 
  Package, FileCheck, FileX, Eye 
} from "lucide-react";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lead } from "@/hooks/useLeadsData";
import { supabase } from "@/integrations/supabase/client";

interface AnaliseImportacoesPanelProps {
  bancoFilter?: string;
  importBatchId?: string;
}

interface LeadAnalise {
  lead?: Lead;
  cpf: string;
  nome: string;
  banco: string;
  temMargem?: boolean;
  valorMargem?: number;
  valor?: number;
  temSimulacao?: boolean;
  simulacaoAprovada?: boolean;
  parcelas: number;
  produto: string;
  valorSimulacao?: number;
  status?: string;
}

interface DialogData {
  titulo: string;
  subtitulo: string;
  leads: LeadAnalise[];
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const ITEMS_PER_PAGE = 50;

const AnaliseImportacoesPanel = ({ bancoFilter = "todos", importBatchId }: AnaliseImportacoesPanelProps) => {
  const { allLeads, stats } = useDashboard();
  const { analysis: leadsAnalysis, isLoading: isLoadingAnalysis } = useLeadsAnalysis(bancoFilter === "todos" ? undefined : bancoFilter, importBatchId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<DialogData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadAnalise | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Função para abrir detalhes do lead
  const handleViewLeadDetails = (leadAnalise: LeadAnalise) => {
    setSelectedLead(leadAnalise);
    setDetailDialogOpen(true);
  };

  // Função para extrair motivo de reprovação/aprovação
  const extrairMotivoStatus = (lead: Lead): string => {
    const proposta = lead.retorno_proposta as Record<string, unknown> | null;
    const simulacao = lead.retorno_simulacao as Record<string, unknown> | null;
    const margem = lead.retorno_margem as Record<string, unknown> | null;
    
    // Se proposta tem status success
    if (proposta?.status === "success") {
      return "Proposta criada com sucesso - Aguardando assinatura do cliente";
    }
    
    // Se proposta tem erro
    if (proposta?.error) {
      const details = proposta.details as Record<string, unknown> | undefined;
      if (details?.errors && Array.isArray(details.errors)) {
        return details.errors.join("; ");
      }
      return String(proposta.error);
    }
    
    // Se simulação tem erro
    if (simulacao?.error) {
      return String(simulacao.error);
    }
    
    // Se simulação tem message de erro
    if (simulacao?.message) {
      return String(simulacao.message);
    }
    
    // Se margem tem erro
    if (margem?.error) {
      return String(margem.error);
    }
    
    // Se não tem proposta mas tem simulação
    if (!proposta && simulacao) {
      return "Simulação realizada mas proposta não foi processada";
    }
    
    // Se não tem margem
    if (!margem) {
      return "Sem dados de margem disponível";
    }
    
    return "Status não identificado";
  };

  // Filtra leads por banco se necessário
  const leadsFiltrados = useMemo(() => {
    if (bancoFilter === "todos") return allLeads;
    return allLeads.filter((l) => (l.banco || "Não Informado") === bancoFilter);
  }, [allLeads, bancoFilter]);

  // Análise completa dos dados importados
  const analise = useMemo(() => {
    if (leadsFiltrados.length === 0) return null;

    // Função para extrair valor de margem disponível do RETORNO MARGEM
    const extrairValorMargem = (l: Lead): number => {
      const margem = l.retorno_margem as any;
      
      // Presença: retorno_margem.valorMargemDisponivel direto
      if (margem?.valorMargemDisponivel) {
        return parseFloat(margem.valorMargemDisponivel) || 0;
      }
      
      // UY3: dataprevValidationResponses - busca maior margem disponível
      if (margem?.details?.dataprevValidationResponses) {
        const responses = margem.details.dataprevValidationResponses;
        if (Array.isArray(responses)) {
          let maiorMargem = 0;
          for (const resp of responses) {
            const valorMargem = resp?.employeeRelationShip?.valorMargemDisponivel;
            if (valorMargem) {
              maiorMargem = Math.max(maiorMargem, parseFloat(valorMargem) || 0);
            }
          }
          return maiorMargem;
        }
      }
      
      // UY3: retorno_margem é um array com result dentro
      if (Array.isArray(margem) && margem[0]?.result?.[0]?.valorMargemDisponivel) {
        return parseFloat(margem[0].result[0].valorMargemDisponivel) || 0;
      }
      
      // UY3: retorno_margem.result array
      if (margem?.result?.[0]?.valorMargemDisponivel) {
        return parseFloat(margem.result[0].valorMargemDisponivel) || 0;
      }
      
      // V8: retorno_margem.details.availableMarginValue (quando reprovado)
      if (margem?.details?.availableMarginValue) {
        const valor = String(margem.details.availableMarginValue).replace(',', '.');
        return parseFloat(valor) || 0;
      }
      
      // Valor do campo valor do lead (coluna valor)
      if (l.valor && l.valor > 0) {
        return l.valor;
      }
      
      return 0;
    };

    // Função para extrair dados de simulação e proposta
    // FLUXO CORRETO: Autorização → Margem → Simulação → Proposta
    const extrairDadosSimulacao = (l: Lead): { 
      temSimulacao: boolean; 
      propostaAprovada: boolean; 
      parcelas: number; 
      produto: string;
      valor: number;
    } => {
      const simulacao = l.retorno_simulacao as any;
      const getProposta = l.retorno_get_proposta as any;
      const proposta = l.retorno_proposta as any;
      
      // Verificar se tem simulação criada (RETORNO SIMULACAO com id e productId)
      const temSimulacao = !!(
        (simulacao?.id && simulacao?.productId) || 
        (simulacao?.liquidValue && simulacao?.numberOfPayments)
      );
      
      if (!temSimulacao) {
        return { temSimulacao: false, propostaAprovada: false, parcelas: 0, produto: "", valor: 0 };
      }
      
      // CRITÉRIO CORRETO: Proposta aprovada = retorno_proposta.status === "success"
      // Baseado na análise: A Presença aprova simulação mas pode rejeitar proposta
      const propostaAprovada = proposta?.status === "success";
      
      // Extrair número de parcelas
      let parcelas = 0;
      if (simulacao?.numberOfPayments) {
        parcelas = parseInt(simulacao.numberOfPayments) || 0;
      } else if (getProposta?.original_response?.quantidadeParcelas) {
        parcelas = parseInt(getProposta.original_response.quantidadeParcelas) || 0;
      }
      
      // Extrair produto
      let produto = "";
      if (simulacao?.productName) {
        produto = simulacao.productName;
      } else if (simulacao?.provider) {
        produto = simulacao.provider.replace(/-/g, ' ').toUpperCase();
      } else if (getProposta?.provider) {
        produto = getProposta.provider.replace(/-/g, ' ').toUpperCase();
      } else if (simulacao?.productId) {
        produto = `Produto ${simulacao.productId}`;
      }
      
      // Extrair valor da simulação (liquidValue em centavos para Presença)
      let valor = 0;
      if (simulacao?.liquidValue) {
        // Presença: valores em centavos, dividir por 100
        const liquidValue = parseFloat(simulacao.liquidValue) || 0;
        valor = liquidValue > 10000 ? liquidValue / 100 : liquidValue;
      } else if (simulacao?.requestedAmount) {
        const requestedAmount = parseFloat(simulacao.requestedAmount) || 0;
        valor = requestedAmount > 10000 ? requestedAmount / 100 : requestedAmount;
      }
      
      return { temSimulacao, propostaAprovada, parcelas, produto, valor };
    };

    // Extrair nome do lead
    const extrairNome = (l: Lead): string => {
      if (l.nome) return l.nome;
      const margem = l.retorno_margem as any;
      const getProposta = l.retorno_get_proposta as any;
      return margem?.registroEmpregaticio?.nomeEmpregado || 
             margem?.nomeEmpregado || 
             getProposta?.name || 
             "";
    };

    // Processar todos os leads
    const leadsAnalisados: LeadAnalise[] = leadsFiltrados.map(l => {
      const valorMargem = extrairValorMargem(l);
      const dadosSimulacao = extrairDadosSimulacao(l);
      
      return {
        lead: l,
        cpf: l.cpf,
        nome: extrairNome(l),
        banco: l.banco || "Não Informado",
        temMargem: valorMargem > 0,
        valorMargem,
        temSimulacao: dadosSimulacao.temSimulacao,
        simulacaoAprovada: dadosSimulacao.propostaAprovada,
        parcelas: dadosSimulacao.parcelas,
        produto: dadosSimulacao.produto,
        valorSimulacao: dadosSimulacao.valor,
      };
    });

    // === KPIs de Margem ===
    const leadsComMargem = leadsAnalisados.filter(l => l.temMargem);
    const leadsSemMargem = leadsAnalisados.filter(l => !l.temMargem);
    const totalLeads = leadsAnalisados.length;
    
    const percentualComMargem = totalLeads > 0 
      ? ((leadsComMargem.length / totalLeads) * 100).toFixed(1) 
      : "0";
    const percentualSemMargem = totalLeads > 0 
      ? ((leadsSemMargem.length / totalLeads) * 100).toFixed(1) 
      : "0";
    
    const somaMargemDisponivel = leadsComMargem.reduce((acc, l) => acc + l.valorMargem, 0);

    // === KPIs de Simulação ===
    const leadsComSimulacao = leadsAnalisados.filter(l => l.temSimulacao);
    const simulacoesAprovadas = leadsAnalisados.filter(l => l.simulacaoAprovada);
    const simulacoesRecusadas = leadsComSimulacao.filter(l => !l.simulacaoAprovada);
    
    const percentualSimAprovadas = leadsComSimulacao.length > 0 
      ? ((simulacoesAprovadas.length / leadsComSimulacao.length) * 100).toFixed(1) 
      : "0";
    const percentualSimRecusadas = leadsComSimulacao.length > 0 
      ? ((simulacoesRecusadas.length / leadsComSimulacao.length) * 100).toFixed(1) 
      : "0";

    // === Distribuição de Parcelamentos ===
    const parcelamentosCount: Record<string, { quantidade: number; leads: LeadAnalise[] }> = {};
    
    simulacoesAprovadas.forEach(l => {
      if (l.parcelas > 0) {
        let faixa = "";
        if (l.parcelas <= 6) faixa = "6x";
        else if (l.parcelas <= 12) faixa = "12x";
        else if (l.parcelas <= 24) faixa = "24x";
        else if (l.parcelas <= 36) faixa = "36x";
        else if (l.parcelas <= 48) faixa = "48x";
        else if (l.parcelas <= 60) faixa = "60x";
        else if (l.parcelas <= 72) faixa = "72x";
        else if (l.parcelas <= 84) faixa = "84x";
        else faixa = "84x+";
        
        if (!parcelamentosCount[faixa]) {
          parcelamentosCount[faixa] = { quantidade: 0, leads: [] };
        }
        parcelamentosCount[faixa].quantidade++;
        parcelamentosCount[faixa].leads.push(l);
      }
    });

    const parcelamentosData = Object.entries(parcelamentosCount)
      .map(([parcela, data]) => ({ 
        parcela, 
        quantidade: data.quantidade,
        leads: data.leads 
      }))
      .sort((a, b) => {
        const ordem = ["6x", "12x", "24x", "36x", "48x", "60x", "72x", "84x", "84x+"];
        return ordem.indexOf(a.parcela) - ordem.indexOf(b.parcela);
      });

    // === Produtos mais procurados ===
    const produtosCount: Record<string, { quantidade: number; leads: LeadAnalise[] }> = {};
    
    simulacoesAprovadas.forEach(l => {
      if (l.produto) {
        const produtoNormalizado = l.produto.trim() || "Não identificado";
        if (!produtosCount[produtoNormalizado]) {
          produtosCount[produtoNormalizado] = { quantidade: 0, leads: [] };
        }
        produtosCount[produtoNormalizado].quantidade++;
        produtosCount[produtoNormalizado].leads.push(l);
      }
    });

    const produtosData = Object.entries(produtosCount)
      .map(([produto, data]) => ({ 
        produto: produto.length > 30 ? produto.substring(0, 27) + "..." : produto, 
        produtoCompleto: produto,
        quantidade: data.quantidade,
        leads: data.leads 
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    // Dados para gráfico de pizza de margem
    const margemPieData = [
      { name: "Com Margem", value: leadsComMargem.length, leads: leadsComMargem },
      { name: "Sem Margem", value: leadsSemMargem.length, leads: leadsSemMargem },
    ];

    // Dados para gráfico de pizza de simulação
    const simulacaoPieData = [
      { name: "Aprovadas", value: simulacoesAprovadas.length, leads: simulacoesAprovadas },
      { name: "Recusadas", value: simulacoesRecusadas.length, leads: simulacoesRecusadas },
    ];

    return {
      totalLeads,
      // Margem
      leadsComMargem,
      leadsSemMargem,
      percentualComMargem,
      percentualSemMargem,
      somaMargemDisponivel,
      margemPieData,
      // Simulação
      leadsComSimulacao,
      simulacoesAprovadas,
      simulacoesRecusadas,
      percentualSimAprovadas,
      percentualSimRecusadas,
      simulacaoPieData,
      // Parcelamentos
      parcelamentosData,
      // Produtos
      produtosData,
    };
  }, [leadsFiltrados]);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handlePieClick = async (data: any, tipo: "margem" | "simulacao") => {
    if (!data?.name) return;
    
    const titulo = tipo === "margem" 
      ? `Leads ${data.name}`
      : `Simulações ${data.name}`;
    
    setDialogData({
      titulo,
      subtitulo: `Carregando...`,
      leads: [],
    });
    setCurrentPage(1);
    setDialogOpen(true);

    try {
      if (tipo === "margem") {
        const temMargem = data.name === "Com Margem";
        const { data: leads, error } = await (supabase.rpc as any)('get_leads_by_margem_status', {
          p_tem_margem: temMargem,
          p_import_batch_id: importBatchId || null,
          p_limit: 500,
        });
        if (error) throw error;
        const mappedLeads = (leads || []).map((l: any) => ({
          cpf: l.cpf,
          nome: l.nome || '-',
          banco: l.banco,
          status: l.status,
          valor: l.margem || 0,
          parcelas: l.parcelas || 0,
          produto: l.produto || '-',
        }));
        setDialogData({
          titulo,
          subtitulo: `${mappedLeads.length} leads encontrados${mappedLeads.length >= 500 ? ' (limite de exibição)' : ''}`,
          leads: mappedLeads,
        });
      } else {
        const aprovada = data.name === "Aprovadas";
        const { data: leads, error } = await (supabase.rpc as any)('get_leads_by_simulacao_status', {
          p_aprovada: aprovada,
          p_import_batch_id: importBatchId || null,
          p_limit: 500,
        });
        if (error) throw error;
        const mappedLeads = (leads || []).map((l: any) => ({
          cpf: l.cpf,
          nome: l.nome || '-',
          banco: l.banco,
          status: l.status,
          valor: l.margem || 0,
          parcelas: l.parcelas || 0,
          produto: l.produto || '-',
        }));
        setDialogData({
          titulo,
          subtitulo: `${mappedLeads.length} leads encontrados${mappedLeads.length >= 500 ? ' (limite de exibição)' : ''}`,
          leads: mappedLeads,
        });
      }
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
      setDialogData({
        titulo,
        subtitulo: `Erro ao carregar leads`,
        leads: [],
      });
    }
  };

  const handleBarClick = async (data: any, tipo: "parcela" | "produto") => {
    const titulo = tipo === "parcela" 
      ? `Leads - Parcelamento ${data.parcela}`
      : `Leads - ${data.produtoCompleto || data.produto}`;
    
    setDialogData({
      titulo,
      subtitulo: `Carregando...`,
      leads: [],
    });
    setCurrentPage(1);
    setDialogOpen(true);

    try {
      if (tipo === "parcela") {
        const parcelas = parseInt(data.parcela.replace('x', ''));
        const { data: leads, error } = await (supabase.rpc as any)('get_leads_by_parcelas', {
          p_parcelas: parcelas,
          p_import_batch_id: importBatchId || null,
          p_limit: 500,
        });
        if (error) throw error;
        const mappedLeads = (leads || []).map((l: any) => ({
          cpf: l.cpf,
          nome: l.nome || '-',
          banco: l.banco,
          status: l.status,
          valor: l.margem || 0,
          parcelas: l.parcelas || 0,
          produto: l.produto || '-',
        }));
        setDialogData({
          titulo,
          subtitulo: `${mappedLeads.length} leads encontrados${mappedLeads.length >= 500 ? ' (limite de exibição)' : ''}`,
          leads: mappedLeads,
        });
      } else {
        const { data: leads, error } = await (supabase.rpc as any)('get_leads_by_produto', {
          p_produto: data.produtoCompleto || data.produto,
          p_import_batch_id: importBatchId || null,
          p_limit: 500,
        });
        if (error) throw error;
        const mappedLeads = (leads || []).map((l: any) => ({
          cpf: l.cpf,
          nome: l.nome || '-',
          banco: l.banco,
          status: l.status,
          valor: l.margem || 0,
          parcelas: l.parcelas || 0,
          produto: l.produto || '-',
        }));
        setDialogData({
          titulo,
          subtitulo: `${mappedLeads.length} leads encontrados${mappedLeads.length >= 500 ? ' (limite de exibição)' : ''}`,
          leads: mappedLeads,
        });
      }
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
      setDialogData({
        titulo,
        subtitulo: `Erro ao carregar leads`,
        leads: [],
      });
    }
  };

  if (isLoadingAnalysis) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Análise de Importações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-8 w-48 bg-muted rounded mb-4"></div>
              <div className="h-4 w-32 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leadsAnalysis.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Análise de Importações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            Nenhum dado disponível para análise.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Dados para gráficos de pizza usando dados da RPC
  const margemPieData = [
    { name: "Com Margem", value: leadsAnalysis.comMargem },
    { name: "Sem Margem", value: leadsAnalysis.semMargem },
  ];

  const simulacaoPieData = [
    { name: "Aprovadas", value: leadsAnalysis.simulacoesAprovadas },
    { name: "Recusadas", value: leadsAnalysis.simulacoesRecusadas },
  ];

  // Dados de parcelas formatados para o gráfico
  const parcelasData = (leadsAnalysis.distribuicaoParcelas || []).map(p => ({
    parcela: `${p.parcelas}x`,
    quantidade: p.quantidade,
  }));

  // Dados de produtos formatados para o gráfico
  const produtosData = (leadsAnalysis.produtosMaisProcurados || []).map(p => ({
    produto: p.produto.length > 25 ? p.produto.substring(0, 22) + '...' : p.produto,
    produtoCompleto: p.produto,
    quantidade: p.quantidade,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Análise de Importações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="py-8 text-center text-muted-foreground">
          Os gráficos de Tipos de Parcelamento e Produtos Mais Procurados foram movidos para o painel Perfil Ideal.
        </div>
      </CardContent>
    </Card>
  );
};

export default AnaliseImportacoesPanel;
