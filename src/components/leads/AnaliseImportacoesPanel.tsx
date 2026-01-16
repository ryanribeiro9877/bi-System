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

interface AnaliseImportacoesPanelProps {
  bancoFilter?: string;
  importBatchId?: string;
}

interface LeadAnalise {
  lead: Lead;
  cpf: string;
  nome: string;
  banco: string;
  temMargem: boolean;
  valorMargem: number;
  temSimulacao: boolean;
  simulacaoAprovada: boolean;
  parcelas: number;
  produto: string;
  valorSimulacao: number;
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

  const handlePieClick = (data: any, tipo: "margem" | "simulacao") => {
    if (!data?.leads) return;
    
    const titulo = tipo === "margem" 
      ? `Leads ${data.name}`
      : `Simulações ${data.name}`;
    
    setDialogData({
      titulo,
      subtitulo: `${data.leads.length} leads`,
      leads: data.leads,
    });
    setCurrentPage(1);
    setDialogOpen(true);
  };

  const handleBarClick = (data: any, tipo: "parcela" | "produto") => {
    if (!data?.leads) return;
    
    const titulo = tipo === "parcela" 
      ? `Leads - Parcelamento ${data.parcela}`
      : `Leads - ${data.produtoCompleto || data.produto}`;
    
    setDialogData({
      titulo,
      subtitulo: `${data.leads.length} leads`,
      leads: data.leads,
    });
    setCurrentPage(1);
    setDialogOpen(true);
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
    <div className="space-y-6">
      {/* KPIs Row 1 - Margem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Margem Disponível</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {leadsAnalysis.comMargem.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsAnalysis.percentualComMargem}% do total
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem Margem Disponível</p>
                <p className="text-2xl font-bold text-red-400">
                  {leadsAnalysis.semMargem.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsAnalysis.percentualSemMargem}% do total
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/20">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Simulações Aprovadas</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {leadsAnalysis.simulacoesAprovadas.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsAnalysis.percentualSimAprovadas}% das simulações
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <FileCheck className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Simulações Recusadas</p>
                <p className="text-2xl font-bold text-red-400">
                  {leadsAnalysis.simulacoesRecusadas.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leadsAnalysis.percentualSimRecusadas}% das simulações
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/20">
                <FileX className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Margem */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribuição por Margem
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique para ver os leads de cada categoria
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={margemPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data) => handlePieClick(data, "margem")}
                    style={{ cursor: 'pointer' }}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de Simulações */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribuição de Simulações
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique para ver os leads de cada categoria
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={simulacaoPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data) => handlePieClick(data, "simulacao")}
                    style={{ cursor: 'pointer' }}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tipos de Parcelamento */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Tipos de Parcelamento
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Parcelamentos escolhidos pelos leads aprovados
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {parcelasData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={parcelasData} margin={{ left: 10, right: 20, bottom: 20 }}>
                    <XAxis 
                      dataKey="parcela" 
                      tick={{ fill: '#9ca3af', fontSize: 12 }} 
                      axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis 
                      tick={{ fill: '#9ca3af', fontSize: 11 }} 
                      axisLine={{ stroke: '#374151' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      onClick={(data) => handleBarClick(data, "parcela")}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado de parcelamento disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Produtos mais procurados */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Package className="w-5 h-5 text-purple-400" />
              Produtos Mais Procurados
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Top 10 produtos escolhidos pelos leads aprovados
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {produtosData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={produtosData} 
                    layout="vertical" 
                    margin={{ left: 10, right: 20 }}
                  >
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis 
                      dataKey="produto" 
                      type="category" 
                      tick={{ fill: '#9ca3af', fontSize: 10 }} 
                      width={120}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} leads`, 
                        props.payload.produtoCompleto || 'Produto'
                      ]}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="#8b5cf6" 
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => handleBarClick(data, "produto")}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado de produto disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para exibir lista de leads */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              {dialogData?.titulo}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{dialogData?.subtitulo}</p>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {dialogData && dialogData.leads.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">Parcelas</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dialogData.leads
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{formatCpf(item.cpf)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.nome || "-"}</TableCell>
                        <TableCell>{item.banco}</TableCell>
                        <TableCell className="text-right text-emerald-400">
                          {item.valorMargem > 0 
                            ? `R$ ${item.valorMargem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {item.parcelas > 0 ? `${item.parcelas}x` : "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {item.produto || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleViewLeadDetails(item)}
                            className="p-1.5 rounded-md hover:bg-primary/20 transition-colors"
                            title="Ver detalhes da proposta"
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Paginação */}
                {dialogData.leads.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-4 px-2">
                    <p className="text-sm text-muted-foreground">
                      Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, dialogData.leads.length)} de {dialogData.leads.length} leads
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-muted-foreground px-2">
                        Página {currentPage} de {Math.ceil(dialogData.leads.length / ITEMS_PER_PAGE)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(dialogData.leads.length / ITEMS_PER_PAGE), p + 1))}
                        disabled={currentPage >= Math.ceil(dialogData.leads.length / ITEMS_PER_PAGE)}
                        className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum lead encontrado nesta categoria.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para detalhes do lead individual */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Detalhes do Lead
            </DialogTitle>
            {selectedLead && (
              <p className="text-sm text-muted-foreground">
                CPF: {formatCpf(selectedLead.cpf)} | {selectedLead.banco}
              </p>
            )}
          </DialogHeader>
          {selectedLead && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Informações básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium">{selectedLead.nome || "Não informado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Banco</p>
                  <p className="text-sm font-medium">{selectedLead.banco}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Margem Disponível</p>
                  <p className="text-sm font-medium text-emerald-400">
                    {selectedLead.valorMargem > 0 
                      ? `R$ ${selectedLead.valorMargem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "Não disponível"
                    }
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Parcelas</p>
                  <p className="text-sm font-medium">
                    {selectedLead.parcelas > 0 ? `${selectedLead.parcelas}x` : "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Produto</p>
                  <p className="text-sm font-medium">{selectedLead.produto || "Não informado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`text-sm font-medium ${selectedLead.simulacaoAprovada ? "text-emerald-400" : "text-red-400"}`}>
                    {selectedLead.simulacaoAprovada ? "Aprovado" : "Reprovado"}
                  </p>
                </div>
              </div>

              {/* Motivo do Status */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">Motivo do Status</p>
                <div className={`p-3 rounded-lg ${selectedLead.simulacaoAprovada ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                  <p className={`text-sm ${selectedLead.simulacaoAprovada ? "text-emerald-400" : "text-red-400"}`}>
                    {extrairMotivoStatus(selectedLead.lead)}
                  </p>
                </div>
              </div>

              {/* Dados brutos da proposta */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">Retorno da Proposta (JSON)</p>
                <div className="bg-muted/50 rounded-lg p-3 max-h-[200px] overflow-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {selectedLead.lead.retorno_proposta 
                      ? JSON.stringify(selectedLead.lead.retorno_proposta, null, 2)
                      : "Sem dados de proposta"
                    }
                  </pre>
                </div>
              </div>

              {/* Dados brutos da simulação */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">Retorno da Simulação (JSON)</p>
                <div className="bg-muted/50 rounded-lg p-3 max-h-[200px] overflow-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {selectedLead.lead.retorno_simulacao 
                      ? JSON.stringify(selectedLead.lead.retorno_simulacao, null, 2)
                      : "Sem dados de simulação"
                    }
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnaliseImportacoesPanel;
