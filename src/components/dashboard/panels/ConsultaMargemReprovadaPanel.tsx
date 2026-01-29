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
import { classificarMargemReprovada } from "@/lib/leadStatusUtils";

interface LeadMargemReprovada {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  tipo_reprovacao: string | null;
  tipo_reprovacao_classificado: string;
  valor?: number | null;
  retorno_margem: Record<string, unknown> | null;
  retorno_simulacao: Record<string, unknown> | null;
  retorno_autorizacao?: unknown;
  retorno_proposta?: unknown;
  retorno_get_proposta?: unknown;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9"
];

const ConsultaMargemReprovadaPanel = () => {
  const { selectedImportFile } = useDashboard();
  const [leads, setLeads] = useState<LeadMargemReprovada[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ titulo: string; subtitulo: string; leads: LeadMargemReprovada[] } | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadMargemReprovada | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const motivoLabelMap: Record<string, string> = {
    margem_zerada: "Margem zerada",
    margem_negativa: "Margem negativa",
    margem_insuficiente: "Margem baixa",
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleBarClick = (motivo: string, banco: string) => {
    const leadsDoMotivoBanco = leads.filter(lead => {
      // Tratar "Não informado" como null/undefined/vazio
      const motivoLead = lead.tipo_reprovacao_classificado || 'Não informado';
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        // Paginação por cursor (evita offsets grandes) e sem paralelismo (evita 500 / rate limits)
        const pageSize = 500;
        const maxRecords = 20000;

        const allLeads: LeadMargemReprovada[] = [];
        let lastId: string | null = null;

        while (allLeads.length < maxRecords) {
          let query = supabase
            .from('leads')
            .select('id, cpf, nome, banco, tipo_reprovacao, retorno_autorizacao, retorno_margem, retorno_simulacao, retorno_proposta, retorno_get_proposta, valor')
            .order('id', { ascending: true })
            .limit(pageSize);

          if (selectedImportFile) {
            query = query.eq('import_batch_id', selectedImportFile);
          }
          if (lastId) {
            query = query.gt('id', lastId);
          }

          const { data, error } = await query;
          if (error) throw error;

          const rows = (data || []) as unknown as Omit<LeadMargemReprovada, "tipo_reprovacao_classificado">[];
          if (rows.length === 0) break;

          const mapped = rows.map((row) => {
            const info = classificarMargemReprovada(row);
            return {
              ...row,
              tipo_reprovacao_classificado: info.tipo_reprovacao,
              _debug_criterios: info.criterios,
              _debug_valorMargem: info.valorMargemDisponivel,
            } as LeadMargemReprovada & { _debug_criterios: string[]; _debug_valorMargem: number | null };
          });

          const allowed = new Set(["margem_zerada", "margem_negativa", "margem_insuficiente"]);
          const filtered = mapped.filter((l) => allowed.has(l.tipo_reprovacao_classificado));
          
          // DEBUG: Log para diagnóstico (remover depois)
          if (allLeads.length === 0 && rows.length > 0) {
            const tipoCount: Record<string, number> = {};
            mapped.forEach((l) => {
              tipoCount[l.tipo_reprovacao_classificado] = (tipoCount[l.tipo_reprovacao_classificado] || 0) + 1;
            });
            console.log("[DEBUG ConsultaMargemReprovadaPanel] Primeira página:", {
              totalRows: rows.length,
              classificacoes: tipoCount,
              primeiros5: mapped.slice(0, 5).map((l) => ({
                id: l.id,
                tipo: l.tipo_reprovacao_classificado,
                criterios: (l as any)._debug_criterios,
                valorMargem: (l as any)._debug_valorMargem,
                hasRetornoMargem: !!l.retorno_margem,
                hasRetornoSimulacao: !!l.retorno_simulacao,
                retornoMargemKeys: l.retorno_margem ? Object.keys(l.retorno_margem as object).slice(0, 10) : null,
                retornoSimulacaoKeys: l.retorno_simulacao ? Object.keys(l.retorno_simulacao as object).slice(0, 10) : null,
              })),
            });
            // Log de um lead que TEM retorno_margem para ver a estrutura
            const leadComMargem = mapped.find((l) => !!l.retorno_margem);
            if (leadComMargem) {
              console.log("[DEBUG] Lead com retorno_margem:", {
                id: leadComMargem.id,
                retorno_margem: leadComMargem.retorno_margem,
                tipo: leadComMargem.tipo_reprovacao_classificado,
                criterios: (leadComMargem as any)._debug_criterios,
              });
            }
          }
          
          allLeads.push(...filtered);
          lastId = rows[rows.length - 1]?.id ?? null;

          if (rows.length < pageSize) break;
        }

        setLeads(allLeads);
      } catch (err) {
        setLeads([]);
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao buscar leads com margem reprovada');
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

  // Função auxiliar para extrair valor de margem
  // Extrai valorMargemDisponivel de múltiplos caminhos possíveis:
  // 1. Direto em retorno_margem.valorMargemDisponivel
  // 2. Em retorno_margem.details.dataprevValidationResponses[].employeeRelationShip.valorMargemDisponivel
  // 3. Em JSON embutido no campo retorno_margem.error (Response completo: {...})
  const extrairValorMargemLead = (lead: LeadMargemReprovada): number => {
    const margemRaw = lead.retorno_margem;
    if (!margemRaw) return 0;
    
    // retorno_margem pode ser um Array ou um objeto
    let margem: Record<string, unknown> | null = null;
    if (Array.isArray(margemRaw)) {
      margem = margemRaw[0] as Record<string, unknown> | null;
    } else {
      margem = margemRaw as Record<string, unknown>;
    }
    
    if (!margem) return 0;
    
    // 1. Tentar direto em valorMargemDisponivel
    const valorDireto = margem?.valorMargemDisponivel;
    if (typeof valorDireto === 'number') return valorDireto;
    if (typeof valorDireto === 'string' && !isNaN(parseFloat(valorDireto))) return parseFloat(valorDireto);
    
    // 2. Tentar em details.dataprevValidationResponses[].employeeRelationShip.valorMargemDisponivel
    const details = margem?.details as Record<string, unknown> | undefined;
    if (details) {
      const dataprevResponses = details?.dataprevValidationResponses;
      if (Array.isArray(dataprevResponses) && dataprevResponses.length > 0) {
        for (const response of dataprevResponses) {
          const employee = (response as Record<string, unknown>)?.employeeRelationShip as Record<string, unknown> | undefined;
          if (employee) {
            const valor = employee?.valorMargemDisponivel;
            if (typeof valor === 'number') return valor;
            if (typeof valor === 'string' && !isNaN(parseFloat(valor))) return parseFloat(valor);
          }
        }
      }
    }
    
    // 3. Tentar extrair do JSON embutido no campo error
    const errorStr = typeof margem?.error === 'string' ? margem.error : null;
    if (errorStr) {
      const match = errorStr.match(/Response completo:\s*(\{[\s\S]*\})/);
      if (match?.[1]) {
        try {
          const cleanJson = match[1].replace(/\\n/g, "").replace(/\\t/g, "").replace(/\\"/g, '"');
          const parsed = JSON.parse(cleanJson) as Record<string, unknown>;
          const parsedDetails = parsed?.details as Record<string, unknown> | undefined;
          if (parsedDetails) {
            const dataprevResponses = parsedDetails?.dataprevValidationResponses;
            if (Array.isArray(dataprevResponses) && dataprevResponses.length > 0) {
              for (const response of dataprevResponses) {
                const employee = (response as Record<string, unknown>)?.employeeRelationShip as Record<string, unknown> | undefined;
                if (employee) {
                  const valor = employee?.valorMargemDisponivel;
                  if (typeof valor === 'number') return valor;
                  if (typeof valor === 'string' && !isNaN(parseFloat(valor))) return parseFloat(valor);
                }
              }
            }
          }
        } catch {
          // Ignorar erro de parse
        }
      }
    }
    
    return 0;
  };

  // KPIs
  const kpis = useMemo(() => {
    const quantidade = leadsFiltrados.length;
    
    // Separar margens positivas e negativas baseado em valorMargemDisponivel
    let somaPositivas = 0;
    let somaNegativas = 0;
    
    leadsFiltrados.forEach(lead => {
      const valor = extrairValorMargemLead(lead);
      
      if (valor > 0) {
        somaPositivas += valor;
      } else if (valor < 0) {
        somaNegativas += valor; // Mantém o valor negativo
      }
    });

    // Soma Total = soma das margens positivas + soma das margens negativas (negativas já são negativas)
    const somaMargens = somaPositivas + somaNegativas;
    // Média = soma total / quantidade de leads com margem reprovada
    const mediaMargens = quantidade > 0 ? somaMargens / quantidade : 0;

    // Valor em produção gasto - REGRA: cada lead tem custo de R$ 1,15
    const custoporLead = 1.15;
    const valorProducao = quantidade * custoporLead;

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
      const motivo = lead.tipo_reprovacao_classificado || 'Não informado';

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

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Falha ao carregar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </CardContent>
        </Card>
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
                <p className="text-lg sm:text-2xl font-bold text-red-500 truncate">{kpis.quantidade.toLocaleString('pt-BR')}</p>
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
                  <h4
                    className="text-sm font-medium text-foreground mb-4 line-clamp-2"
                    title={motivoLabelMap[item.motivo] || item.motivo}
                  >
                    {motivoLabelMap[item.motivo] || item.motivo}
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={item.dados} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis 
                          dataKey="banco" 
                          type="category" 
                          width={80}
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                          wrapperStyle={{ outline: 'none', zIndex: 1000 }}
                          labelFormatter={() => ''}
                          formatter={(value: number) => {
                            return [
                              <span key="val" style={{ color: '#ef4444', fontWeight: 'bold' }}>{value?.toLocaleString('pt-BR')}</span>,
                              <span key="label" style={{ color: '#ffffff' }}>Quantidade</span>
                            ];
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            padding: '8px 12px'
                          }}
                          itemStyle={{ color: '#ffffff' }}
                          labelStyle={{ display: 'none' }}
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
                      <span className="ml-2 text-red-400">{motivoLabelMap[selectedLead.tipo_reprovacao_classificado] || selectedLead.tipo_reprovacao_classificado || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Motivo da Reprovação - Apenas valor da margem */}
                {(() => {
                  const valorMargem = extrairValorMargemLead(selectedLead);
                  const tipoMargem = selectedLead.tipo_reprovacao_classificado;
                  
                  // Determinar cor e descrição baseado no tipo/valor
                  let corFundo = "bg-yellow-500/10 border-yellow-500/30";
                  let corTexto = "text-yellow-500";
                  let descricaoTipo = "Margem baixa";
                  
                  if (tipoMargem === "margem_zerada" || valorMargem === 0) {
                    corFundo = "bg-orange-500/10 border-orange-500/30";
                    corTexto = "text-orange-500";
                    descricaoTipo = "Margem zerada";
                  } else if (tipoMargem === "margem_negativa" || valorMargem < 0) {
                    corFundo = "bg-red-500/10 border-red-500/30";
                    corTexto = "text-red-500";
                    descricaoTipo = "Margem negativa";
                  }
                  
                  return (
                    <div className={`p-6 rounded-lg border ${corFundo}`}>
                      <h4 className={`font-medium ${corTexto} mb-4 flex items-center gap-2 justify-center`}>
                        <AlertTriangle className="w-5 h-5" />
                        Motivo da Reprovação: {descricaoTipo}
                      </h4>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Valor da Margem Disponível</p>
                        <p className={`text-5xl font-bold ${corTexto}`}>
                          {formatCurrency(valorMargem)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-3">
                          {valorMargem < 0 
                            ? "Cliente possui margem negativa, impossibilitando a contratação"
                            : valorMargem === 0 
                            ? "Cliente não possui margem disponível para contratação"
                            : "Cliente possui margem insuficiente para o valor solicitado"}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Informações Adicionais de Margem (sem JSON) */}
                {selectedLead.retorno_margem && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-3">Informações Adicionais</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(() => {
                        const m = selectedLead.retorno_margem as Record<string, unknown>;
                        const campos: { label: string; valor: string }[] = [];
                        
                        if (typeof m.valorMargemBase !== 'undefined') campos.push({ label: 'Margem Base', valor: formatCurrency(Number(m.valorMargemBase)) });
                        if (typeof m.margemDisponivel !== 'undefined' && m.margemDisponivel !== m.valorMargemDisponivel) {
                          campos.push({ label: 'Margem', valor: formatCurrency(Number(m.margemDisponivel)) });
                        }
                        if (m.status) campos.push({ label: 'Status', valor: String(m.status) });
                        if (m.matricula) campos.push({ label: 'Matrícula', valor: String(m.matricula) });
                        if (m.convenio) campos.push({ label: 'Convênio', valor: String(m.convenio) });
                        if (m.empregador) campos.push({ label: 'Empregador', valor: String(m.empregador) });
                        
                        if (campos.length === 0) {
                          return <p className="text-muted-foreground col-span-2">Nenhuma informação adicional disponível</p>;
                        }
                        
                        return campos.map((c, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded bg-background/50">
                            <span className="text-muted-foreground">{c.label}</span>
                            <span className="text-foreground font-medium">{c.valor}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Dados de Simulação (sem JSON) */}
                {selectedLead.retorno_simulacao && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-3">Dados de Simulação</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {(() => {
                        const s = selectedLead.retorno_simulacao as Record<string, unknown>;
                        const campos: { label: string; valor: string }[] = [];
                        
                        if (s.status) campos.push({ label: 'Status', valor: String(s.status) });
                        if (typeof s.requestedAmount !== 'undefined') campos.push({ label: 'Valor Solicitado', valor: formatCurrency(Number(s.requestedAmount)) });
                        if (typeof s.liquidValue !== 'undefined') campos.push({ label: 'Valor Líquido', valor: formatCurrency(Number(s.liquidValue)) });
                        if (typeof s.availableBalance !== 'undefined') campos.push({ label: 'Saldo Disponível', valor: formatCurrency(Number(s.availableBalance)) });
                        if (s.numberOfPayments) campos.push({ label: 'Parcelas', valor: String(s.numberOfPayments) });
                        if (s.productName) campos.push({ label: 'Produto', valor: String(s.productName) });
                        
                        if (campos.length === 0) {
                          return <p className="text-muted-foreground col-span-2">Nenhum dado de simulação disponível</p>;
                        }
                        
                        return campos.map((c, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded bg-background/50">
                            <span className="text-muted-foreground">{c.label}</span>
                            <span className="text-foreground font-medium">{c.valor}</span>
                          </div>
                        ));
                      })()}
                    </div>
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
