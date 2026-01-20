import { useState, useEffect, useMemo } from "react";
import { Users, TrendingDown, TrendingUp, DollarSign, BarChart3, Building2, AlertTriangle, Percent, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface LeadMargemReprovada {
  cpf: string;
  nome: string | null;
  banco: string | null;
  tipo_reprovacao: string | null;
  valor?: number | null;
  retorno_margem: {
    valorMargemDisponivel?: number;
    valorMargemBase?: number;
    margemDisponivel?: number;
  } | null;
  retorno_simulacao: {
    requestedAmount?: number;
    liquidValue?: number;
    availableBalance?: number;
    valorMargem?: number;
  } | null;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9"
];

const ConsultaMargemReprovadaPanel = () => {
  const { selectedImportFile } = useDashboard();
  const [leads, setLeads] = useState<LeadMargemReprovada[]>([]);
  const [loading, setLoading] = useState(true);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ titulo: string; subtitulo: string; leads: LeadMargemReprovada[] } | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadMargemReprovada | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleBarClick = (motivo: string, banco: string) => {
    const leadsDoMotivoBanco = leads.filter(lead => {
      // Tratar "Não informado" como null/undefined/vazio
      const motivoLead = lead.tipo_reprovacao || 'Não informado';
      const bancoLead = lead.banco || 'Não informado';
      return motivoLead === motivo && bancoLead === banco;
    });
    setDialogData({
      titulo: `Leads - ${banco}`,
      subtitulo: `${leadsDoMotivoBanco.length} leads com erro: ${motivo.substring(0, 50)}${motivo.length > 50 ? '...' : ''}`,
      leads: leadsDoMotivoBanco
    });
    setDialogOpen(true);
  };

  const handleViewDetail = (lead: LeadMargemReprovada) => {
    setSelectedLead(lead);
    setDetailDialogOpen(true);
  };

  // Função para categorizar erro como "Margem" - mesma lógica do ResultadosConsultasPanel
  const isErroMargem = (tipoReprovacao: string | null): boolean => {
    if (!tipoReprovacao) return false;
    const texto = tipoReprovacao.toLowerCase();
    return texto.includes('margem');
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // REGRA: Clientes com Margem Reprovada = leads que apresentaram valor de margem mas a proposta não foi aprovada
        // Ou seja: leads com retorno_margem (contendo valorMargemDisponivel) E status != 'aprovado'
        
        // Buscar leads que NÃO foram aprovados e possuem retorno_margem
        let query = supabase
          .from('leads')
          .select('cpf, nome, banco, tipo_reprovacao, retorno_margem, retorno_simulacao, valor')
          .neq('status', 'aprovado')
          .not('retorno_margem', 'is', null);

        if (selectedImportFile) {
          query = query.eq('import_batch_id', selectedImportFile);
        }

        // Buscar em lotes se houver mais de 1000 registros
        const allLeads: LeadMargemReprovada[] = [];
        const pageSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await query.range(offset, offset + pageSize - 1);
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            // Filtrar leads que possuem valor de margem em qualquer campo
            // Diferentes bancos usam campos diferentes para armazenar o valor de margem
            const leadsComMargem = (data as LeadMargemReprovada[]).filter(lead => {
              const margem = lead.retorno_margem as Record<string, unknown> | null;
              const simulacao = lead.retorno_simulacao as Record<string, unknown> | null;
              if (!margem && !simulacao) return false;
              
              // Verificar campos de margem em retorno_margem (todos os bancos)
              const camposMargem = [
                margem?.valorMargemDisponivel,
                margem?.valorMargemBase,
                margem?.margemDisponivel,
                margem?.valor,
                margem?.availableMarginValue,
                // Campos aninhados
                (margem?.details as Record<string, unknown>)?.availableMarginValue,
              ];
              
              // Verificar campos de margem em retorno_simulacao (alguns bancos armazenam aqui)
              const camposSimulacao = [
                simulacao?.availableMarginValue,
                simulacao?.valorMargem,
                simulacao?.availableBalance,
                (simulacao?.details as Record<string, unknown>)?.availableMarginValue,
              ];
              
              // Verificar se algum campo possui valor numérico definido
              const temValorMargem = [...camposMargem, ...camposSimulacao].some(
                v => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))
              );
              
              return temValorMargem;
            });
            
            allLeads.push(...leadsComMargem);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log('[ConsultaMargemReprovada] Leads com margem mas não aprovados:', allLeads.length);

        setLeads(allLeads);
      } catch (err) {
        console.error('Erro ao buscar leads com margem reprovada:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedImportFile]);

  // Bancos disponíveis
  const bancosDisponiveis = useMemo(() => {
    const bancos = new Set<string>();
    leads.forEach(lead => {
      if (lead.banco) bancos.add(lead.banco);
    });
    return Array.from(bancos).sort();
  }, [leads]);

  // Leads filtrados por banco
  const leadsFiltrados = useMemo(() => {
    if (bancoSelecionado === "todos") return leads;
    return leads.filter(lead => lead.banco === bancoSelecionado);
  }, [leads, bancoSelecionado]);

  // Função auxiliar para extrair valor de margem de qualquer banco
  const extrairValorMargemLead = (lead: LeadMargemReprovada): number => {
    const margem = lead.retorno_margem as Record<string, unknown> | null;
    const simulacao = lead.retorno_simulacao as Record<string, unknown> | null;
    
    // Lista de campos possíveis em ordem de prioridade
    const fontes = [
      // retorno_margem
      margem?.valorMargemDisponivel,
      margem?.valorMargemBase,
      margem?.margemDisponivel,
      margem?.valor,
      margem?.availableMarginValue,
      (margem?.details as Record<string, unknown>)?.availableMarginValue,
      // retorno_simulacao
      simulacao?.valorMargem,
      simulacao?.availableBalance,
      simulacao?.availableMarginValue,
      (simulacao?.details as Record<string, unknown>)?.availableMarginValue,
    ];
    
    for (const v of fontes) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && !isNaN(parseFloat(v))) return parseFloat(v);
    }
    
    return 0;
  };

  // KPIs
  const kpis = useMemo(() => {
    const quantidade = leadsFiltrados.length;
    
    // Separar margens positivas e negativas
    let somaMargens = 0;
    let somaPositivas = 0;
    let somaNegativas = 0;
    
    leadsFiltrados.forEach(lead => {
      const valor = extrairValorMargemLead(lead);
      
      somaMargens += valor;
      
      if (valor >= 0) {
        somaPositivas += valor;
      } else {
        somaNegativas += valor; // Mantém o valor negativo
      }
    });

    const mediaMargens = quantidade > 0 ? somaMargens / quantidade : 0;

    // Valor em produção - REGRA: usar liquidValue do retorno_simulacao
    const valorProducao = leadsFiltrados.reduce((sum, lead) => {
      const simulacao = lead.retorno_simulacao;
      // Prioridade: liquidValue é o valor principal para cálculo de produção gasto
      const valor = simulacao?.liquidValue ?? 0;
      return sum + Math.abs(valor);
    }, 0);

    return {
      quantidade,
      somaMargens,
      somaPositivas,
      somaNegativas,
      mediaMargens,
      valorProducao
    };
  }, [leadsFiltrados]);

  // Motivos de reprovação agrupados
  const motivosPorBanco = useMemo(() => {
    const motivosMap = new Map<string, Map<string, number>>();

    leadsFiltrados.forEach(lead => {
      const banco = lead.banco || 'Não informado';
      const motivo = lead.tipo_reprovacao || 'Não informado';

      if (!motivosMap.has(motivo)) {
        motivosMap.set(motivo, new Map());
      }
      const bancoMap = motivosMap.get(motivo)!;
      bancoMap.set(banco, (bancoMap.get(banco) || 0) + 1);
    });

    // Converter para array de objetos para os gráficos
    const result: { motivo: string; dados: { banco: string; quantidade: number }[] }[] = [];
    
    motivosMap.forEach((bancoMap, motivo) => {
      const dados: { banco: string; quantidade: number }[] = [];
      bancoMap.forEach((quantidade, banco) => {
        dados.push({ banco, quantidade });
      });
      dados.sort((a, b) => b.quantidade - a.quantidade);
      result.push({ motivo, dados });
    });

    // Ordenar por total de ocorrências
    result.sort((a, b) => {
      const totalA = a.dados.reduce((sum, d) => sum + d.quantidade, 0);
      const totalB = b.dados.reduce((sum, d) => sum + d.quantidade, 0);
      return totalB - totalA;
    });

    return result.slice(0, 10); // Top 10 motivos
  }, [leadsFiltrados]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Consulta com Margem Reprovada</h2>
          <p className="text-sm text-muted-foreground">
            Análise de clientes com margem negativa, baixa ou zerada
          </p>
        </div>
      </div>

      {/* Filtro por Banco */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar por banco:</span>
        <Tabs value={bancoSelecionado} onValueChange={setBancoSelecionado}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            {bancosDisponiveis.map(banco => (
              <TabsTrigger key={banco} value={banco}>{banco}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs - Grid uniforme de 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Linha 1 */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Clientes com Margem Reprovada</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{kpis.quantidade.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-emerald-500/10 flex-shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Margens Positivas</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-500 truncate">{formatCurrency(kpis.somaPositivas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linha 2 */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 flex-shrink-0">
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Margens Negativas</p>
                <p className="text-lg sm:text-2xl font-bold text-red-500 truncate">{formatCurrency(kpis.somaNegativas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-orange-500/10 flex-shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Soma Total das Margens</p>
                <p className={`text-lg sm:text-2xl font-bold truncate ${kpis.somaMargens >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(kpis.somaMargens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linha 3 */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-yellow-500/10 flex-shrink-0">
                <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Média das Margens</p>
                <p className={`text-lg sm:text-2xl font-bold truncate ${kpis.mediaMargens >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(kpis.mediaMargens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-purple-500/10 flex-shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Valor em Produção Gasto</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{formatCurrency(kpis.valorProducao)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Motivos por Banco */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Motivos de Reprovação por Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {motivosPorBanco.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado disponível para exibição</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {motivosPorBanco.map((item, idx) => (
                <div key={item.motivo} className="p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-4 line-clamp-2" title={item.motivo}>
                    {item.motivo.length > 60 ? item.motivo.substring(0, 60) + '...' : item.motivo}
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={item.dados} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <YAxis 
                          dataKey="banco" 
                          type="category" 
                          width={80}
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          formatter={(value: number) => [<span style={{ color: '#ffffff' }}>{value.toLocaleString()}</span>, <span style={{ color: '#ffffff' }}>Quantidade</span>]}
                        />
                        <Bar 
                          dataKey="quantidade" 
                          radius={[0, 4, 4, 0]}
                          onClick={(data) => handleBarClick(item.motivo, data.banco)}
                          style={{ cursor: 'pointer' }}
                        >
                          {item.dados.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[idx % COLORS.length]} style={{ cursor: 'pointer' }} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para exibir leads */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-500" />
              {dialogData?.titulo}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{dialogData?.subtitulo}</p>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {dialogData && dialogData.leads.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.slice(0, 100).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{formatCpf(item.cpf)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.nome || "-"}</TableCell>
                      <TableCell>{item.banco}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(item)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Proposta
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum lead encontrado.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para exibir detalhes da proposta */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Detalhes da Proposta
            </DialogTitle>
            {selectedLead && (
              <p className="text-sm text-muted-foreground">
                CPF: {formatCpf(selectedLead.cpf)} • {selectedLead.nome || 'Nome não informado'}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedLead && (
              <div className="space-y-4">
                {/* Informações Básicas */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-medium text-foreground mb-2">Informações Básicas</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Banco:</span>
                      <span className="ml-2 text-foreground">{selectedLead.banco || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo de Erro:</span>
                      <span className="ml-2 text-red-400">{selectedLead.tipo_reprovacao || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Motivo do Erro - Extraído dos dados reais */}
                {(() => {
                  const margem = selectedLead.retorno_margem as Record<string, unknown> | null;
                  const simulacao = selectedLead.retorno_simulacao as Record<string, unknown> | null;
                  
                  // Extrair motivos de erro dos dados reais
                  const motivos: { campo: string; valor: string }[] = [];
                  
                  // Verificar retorno_margem
                  if (margem) {
                    if (margem.error) motivos.push({ campo: 'Erro de Margem', valor: String(margem.error) });
                    if (margem.motivo) motivos.push({ campo: 'Motivo', valor: String(margem.motivo) });
                    if (margem.message) motivos.push({ campo: 'Mensagem', valor: String(margem.message) });
                    if (margem.statusDescription) motivos.push({ campo: 'Descrição do Status', valor: String(margem.statusDescription) });
                    if (margem.descricao) motivos.push({ campo: 'Descrição', valor: String(margem.descricao) });
                    if (typeof margem.valorMargemDisponivel !== 'undefined') {
                      motivos.push({ campo: 'Margem Disponível', valor: formatCurrency(Number(margem.valorMargemDisponivel)) });
                    }
                    if (typeof margem.valorMargemBase !== 'undefined') {
                      motivos.push({ campo: 'Margem Base', valor: formatCurrency(Number(margem.valorMargemBase)) });
                    }
                  }
                  
                  // Verificar retorno_simulacao
                  if (simulacao) {
                    if (simulacao.error) motivos.push({ campo: 'Erro de Simulação', valor: String(simulacao.error) });
                    if (simulacao.motivo) motivos.push({ campo: 'Motivo Simulação', valor: String(simulacao.motivo) });
                    if (simulacao.message) motivos.push({ campo: 'Mensagem Simulação', valor: String(simulacao.message) });
                    const details = simulacao.details as Record<string, unknown> | undefined;
                    if (details?.error) motivos.push({ campo: 'Detalhe do Erro', valor: String(details.error) });
                    if (details?.description) motivos.push({ campo: 'Descrição do Erro', valor: String(details.description) });
                  }
                  
                  if (motivos.length > 0) {
                    return (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <h4 className="font-medium text-red-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Motivo da Reprovação
                        </h4>
                        <div className="space-y-2">
                          {motivos.map((m, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-muted-foreground">{m.campo}:</span>
                              <span className="ml-2 text-foreground">{m.valor}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Dados de Margem */}
                {selectedLead.retorno_margem && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-2">Dados de Margem</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      {(() => {
                        const m = selectedLead.retorno_margem as Record<string, unknown>;
                        const campos: { label: string; valor: string }[] = [];
                        
                        if (typeof m.valorMargemDisponivel !== 'undefined') campos.push({ label: 'Margem Disponível', valor: formatCurrency(Number(m.valorMargemDisponivel)) });
                        if (typeof m.valorMargemBase !== 'undefined') campos.push({ label: 'Margem Base', valor: formatCurrency(Number(m.valorMargemBase)) });
                        if (typeof m.margemDisponivel !== 'undefined') campos.push({ label: 'Margem', valor: formatCurrency(Number(m.margemDisponivel)) });
                        if (m.status) campos.push({ label: 'Status', valor: String(m.status) });
                        if (m.matricula) campos.push({ label: 'Matrícula', valor: String(m.matricula) });
                        if (m.convenio) campos.push({ label: 'Convênio', valor: String(m.convenio) });
                        
                        return campos.map((c, idx) => (
                          <div key={idx}>
                            <span className="text-muted-foreground">{c.label}:</span>
                            <span className="ml-2 text-foreground">{c.valor}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver dados completos</summary>
                      <pre className="text-xs text-muted-foreground overflow-auto max-h-[150px] bg-background p-2 rounded mt-2">
                        {JSON.stringify(selectedLead.retorno_margem, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Dados de Simulação */}
                {selectedLead.retorno_simulacao && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-2">Dados de Simulação</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      {(() => {
                        const s = selectedLead.retorno_simulacao as Record<string, unknown>;
                        const campos: { label: string; valor: string }[] = [];
                        
                        if (s.status) campos.push({ label: 'Status', valor: String(s.status) });
                        if (typeof s.requestedAmount !== 'undefined') campos.push({ label: 'Valor Solicitado', valor: formatCurrency(Number(s.requestedAmount)) });
                        if (typeof s.liquidValue !== 'undefined') campos.push({ label: 'Valor Líquido', valor: formatCurrency(Number(s.liquidValue)) });
                        if (typeof s.availableBalance !== 'undefined') campos.push({ label: 'Saldo Disponível', valor: formatCurrency(Number(s.availableBalance)) });
                        if (s.numberOfPayments) campos.push({ label: 'Parcelas', valor: String(s.numberOfPayments) });
                        if (s.productName) campos.push({ label: 'Produto', valor: String(s.productName) });
                        
                        return campos.map((c, idx) => (
                          <div key={idx}>
                            <span className="text-muted-foreground">{c.label}:</span>
                            <span className="ml-2 text-foreground">{c.valor}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver dados completos</summary>
                      <pre className="text-xs text-muted-foreground overflow-auto max-h-[150px] bg-background p-2 rounded mt-2">
                        {JSON.stringify(selectedLead.retorno_simulacao, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaMargemReprovadaPanel;
