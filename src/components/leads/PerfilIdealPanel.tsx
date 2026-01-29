import { Star, Upload, DollarSign, Clock, Building2, Briefcase, CheckCircle, Award, Eye, CreditCard, Package, Calendar, Timer, Banknote, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useApprovedLeadsAnalysis } from "@/hooks/useApprovedLeadsAnalysis";
import { useContratosAprovadosAnalysis, LeadPago } from "@/hooks/useContratosAprovadosAnalysis";

interface PerfilIdealPanelProps {
  bancoFilter?: string;
  importBatchId?: string;
}

interface LeadPorPorte {
  cpf: string;
  nome: string;
  banco: string;
  empresa: string;
  porte: string;
}

interface DialogData {
  titulo: string;
  subtitulo: string;
  leads: LeadPorPorte[];
}

const PerfilIdealPanel = ({ bancoFilter = "todos", importBatchId }: PerfilIdealPanelProps) => {
  const navigate = useNavigate();
  const { analysis, isLoading } = useApprovedLeadsAnalysis(bancoFilter === "todos" ? undefined : bancoFilter, importBatchId);
  const { analysis: contratosAnalysis, isLoading: isLoadingContratos } = useContratosAprovadosAnalysis(bancoFilter === "todos" ? undefined : bancoFilter, importBatchId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<DialogData | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [pagosDialogOpen, setPagosDialogOpen] = useState(false);
  const [pagosDialogData, setPagosDialogData] = useState<{ titulo: string; leads: LeadPago[]; tipo: 'pagos' | 'naoPagos' } | null>(null);
  const [selectedLeadProposta, setSelectedLeadProposta] = useState<string | null>(null);
  const [propostaDialogOpen, setPropostaDialogOpen] = useState(false);
  const [propostaData, setPropostaData] = useState<Record<string, unknown> | null>(null);
  const [loadingProposta, setLoadingProposta] = useState(false);
  const [leadsSemParcelamento, setLeadsSemParcelamento] = useState<Array<{cpf: string; nome: string; banco: string; motivo: string; statusDescription: string}>>([]);
  const [semParcelamentoDialogOpen, setSemParcelamentoDialogOpen] = useState(false);

  // Investigar leads sem parcelamento - compara com a RPC para encontrar os faltantes
  const investigarLeadsSemParcelamento = async () => {
    try {
      let query = supabase
        .from('leads')
        .select('id, cpf, nome, banco, retorno_simulacao, retorno_get_proposta, retorno_proposta, retorno_margem')
        .eq('status', 'aprovado');
      
      if (importBatchId) {
        query = query.eq('import_batch_id', importBatchId);
      }
      if (bancoFilter && bancoFilter !== 'todos') {
        query = query.eq('banco', bancoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Obter CPFs que estão na distribuição de parcelas (da RPC)
      const totalNaDistribuicao = (analysis.distribuicaoParcelas || []).reduce((sum, p) => sum + p.quantidade, 0);
      const totalAprovados = data?.length || 0;
      
      // Se não há diferença, não há leads sem parcelamento
      if (totalNaDistribuicao >= totalAprovados) {
        setLeadsSemParcelamento([]);
        setSemParcelamentoDialogOpen(true);
        return;
      }

      // Função para extrair número de parcelas de um lead (campo: numberOfPayments)
      const extrairParcelas = (lead: typeof data[0]): number | null => {
        const sim = lead.retorno_simulacao as Record<string, unknown> | null;
        const getProp = lead.retorno_get_proposta as Record<string, unknown> | null;
        
        // Verificar numberOfPayments no retorno_get_proposta
        if (getProp?.numberOfPayments && Number(getProp.numberOfPayments) > 0) {
          return Number(getProp.numberOfPayments);
        }
        
        // Verificar numberOfPayments no retorno_simulacao
        if (sim?.numberOfPayments && Number(sim.numberOfPayments) > 0) {
          return Number(sim.numberOfPayments);
        }
        
        return null;
      };

      // Função para extrair motivo da falta de dados de parcelamento
      const extrairMotivo = (lead: typeof data[0]): string => {
        const sim = lead.retorno_simulacao as Record<string, unknown> | null;
        const getProp = lead.retorno_get_proposta as Record<string, unknown> | null;
        
        // Verificar se retorno_get_proposta existe
        if (!getProp || Object.keys(getProp).length === 0) {
          if (!sim || Object.keys(sim).length === 0) {
            return 'Sem retorno de proposta e simulação';
          }
          return 'Sem retorno de proposta (numberOfPayments ausente)';
        }
        
        // Verificar se numberOfPayments está ausente
        if (!getProp.numberOfPayments) {
          return 'Campo numberOfPayments não preenchido no retorno';
        }
        
        return 'Dados incompletos';
      };

      // Função para extrair status de pagamento
      const extrairStatusPagamento = (lead: typeof data[0]): string => {
        const getProp = lead.retorno_get_proposta as Record<string, unknown> | null;
        if (getProp?.statusDescription) {
          return String(getProp.statusDescription);
        }
        return 'Status não disponível';
      };

      // Filtrar leads que não têm parcelas válidas (numberOfPayments)
      const semParcelas = (data || []).filter(lead => {
        const parcelas = extrairParcelas(lead);
        return parcelas === null;
      }).map(l => ({
        cpf: l.cpf,
        nome: l.nome || '-',
        banco: l.banco || '-',
        motivo: extrairMotivo(l),
        statusDescription: extrairStatusPagamento(l)
      }));

      setLeadsSemParcelamento(semParcelas);
      setSemParcelamentoDialogOpen(true);
      
      console.log('[DEBUG] Leads sem parcelamento:', semParcelas);
    } catch (err) {
      console.error('Erro ao investigar leads sem parcelamento:', err);
    }
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleMargemClick = async (data: { faixa: string; quantidade: number }) => {
    if (!data?.faixa) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads por Margem - ${data.faixa}`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: LeadPorPorte[] | null; error: Error | null }>)('get_leads_by_faixa_margem', {
        p_faixa: data.faixa,
        p_import_batch_id: importBatchId || null,
        p_limit: 100,
      });
      if (error) throw error;
      const mappedLeads = (leads || []).map((l) => ({ cpf: String((l as { cpf?: string }).cpf || ''), nome: String((l as { nome?: string }).nome || ''), banco: String((l as { banco?: string }).banco || ''), empresa: '-', porte: `R$ ${(l as { margem?: number }).margem || 0}` }));
      setDialogData({ titulo: `Leads por Margem - ${data.faixa}`, subtitulo: `${mappedLeads.length} leads encontrados`, leads: mappedLeads });
    } catch (err) {
      console.error('Erro ao buscar leads por margem:', err);
      setDialogData({ titulo: `Leads por Margem - ${data.faixa}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleVinculoClick = async (data: { faixa: string; quantidade: number }) => {
    if (!data?.faixa) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads por Vínculo - ${data.faixa}`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: LeadPorPorte[] | null; error: Error | null }>)('get_leads_by_vinculo', {
        p_faixa: data.faixa,
        p_import_batch_id: importBatchId || null,
        p_limit: 100,
      });
      if (error) throw error;
      const mappedLeads = (leads || []).map((l) => ({ cpf: String((l as { cpf?: string }).cpf || ''), nome: String((l as { nome?: string }).nome || ''), banco: String((l as { banco?: string }).banco || ''), empresa: '-', porte: `${(l as { tempoMeses?: number }).tempoMeses || 0} meses` }));
      setDialogData({ titulo: `Leads por Vínculo - ${data.faixa}`, subtitulo: `${mappedLeads.length} leads encontrados`, leads: mappedLeads });
    } catch (err) {
      console.error('Erro ao buscar leads por vínculo:', err);
      setDialogData({ titulo: `Leads por Vínculo - ${data.faixa}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const handlePorteClick = async (data: { porte: string; quantidade: number }) => {
    if (!data?.porte) return;
    
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({
      titulo: `Leads Aprovados - ${data.porte}`,
      subtitulo: `Carregando...`,
      leads: [],
    });

    try {
      // Usar RPC para buscar leads por porte (mesma lógica de classificação do gráfico)
      const { data: leads, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: LeadPorPorte[] | null; error: Error | null }>)('get_leads_by_porte', {
        p_porte: data.porte,
        p_limit: 100,
      });

      if (error) throw error;

      const leadsDoPorte = leads || [];

      setDialogData({
        titulo: `Leads Aprovados - ${data.porte}`,
        subtitulo: `${leadsDoPorte.length} leads encontrados`,
        leads: leadsDoPorte,
      });
    } catch (err) {
      console.error('Erro ao buscar leads por porte:', err);
      setDialogData({
        titulo: `Leads Aprovados - ${data.porte}`,
        subtitulo: `Erro ao carregar leads`,
        leads: [],
      });
    } finally {
      setLoadingLeads(false);
    }
  };

  const handlePagosClick = (banco: string, tipo: 'pagos' | 'naoPagos') => {
    const leads = tipo === 'pagos' 
      ? contratosAnalysis.leadsPagos.filter(l => l.banco === banco)
      : contratosAnalysis.leadsNaoPagos.filter(l => l.banco === banco);
    
    setPagosDialogData({
      titulo: tipo === 'pagos' ? `Leads Pagos - ${banco}` : `Leads Não Pagos - ${banco}`,
      leads,
      tipo,
    });
    setPagosDialogOpen(true);
  };

  const handleViewProposta = async (leadId: string) => {
    setLoadingProposta(true);
    setPropostaDialogOpen(true);
    setSelectedLeadProposta(leadId);
    
    try {
      const { data: lead, error } = await supabase
        .from('leads')
        .select('retorno_get_proposta, retorno_proposta, retorno_simulacao')
        .eq('id', leadId)
        .single();
      
      if (error) throw error;
      
      // Combinar dados de proposta de várias fontes
      const propostaCompleta = {
        ...(lead.retorno_get_proposta as Record<string, unknown> || {}),
        ...(lead.retorno_proposta as Record<string, unknown> || {}),
        simulacao: lead.retorno_simulacao,
      };
      
      setPropostaData(propostaCompleta);
    } catch (err) {
      console.error('Erro ao buscar proposta:', err);
      setPropostaData(null);
    } finally {
      setLoadingProposta(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const perfil = useMemo(() => {
    if (analysis.totalAprovados === 0) return null;

    // Usar dados da RPC
    const faixasMargem = analysis.faixasMargem || [];
    const topCBO = analysis.topCBOs?.[0];
    const topEmpresa = analysis.topEmpresas?.[0];
    
    // Encontrar faixa de margem mais comum
    const margemMaisComum = faixasMargem.reduce(
      (max, f) => f.quantidade > max.quantidade ? f : max, 
      { faixa: 'N/A', quantidade: 0 }
    );

    // Distribuição por tempo de vínculo (carteira assinada)
    const vinculoData = (analysis.distribuicaoVinculo || []).map(v => ({
      faixa: v.faixa,
      quantidade: v.quantidade,
    }));

    // Distribuição por porte da empresa
    const portesData = (analysis.distribuicaoPorte || []).map(p => ({
      porte: p.porte,
      quantidade: p.quantidade,
    }));

    // Calcular score de tempo de vínculo baseado na distribuição
    // Faixas maiores (ex: "5+ anos") recebem peso maior
    const calcularVinculoScore = () => {
      if (!vinculoData.length) return 0;
      const pesosFaixa: Record<string, number> = {
        '0-6 meses': 10,
        '6-12 meses': 25,
        '1-2 anos': 40,
        '2-3 anos': 55,
        '3-5 anos': 75,
        '5+ anos': 100,
      };
      let somaScore = 0;
      let totalLeads = 0;
      vinculoData.forEach(v => {
        const peso = pesosFaixa[v.faixa] || 50;
        somaScore += peso * v.quantidade;
        totalLeads += v.quantidade;
      });
      return totalLeads > 0 ? Math.min(100, somaScore / totalLeads) : 0;
    };

    // Calcular score de porte da empresa baseado na distribuição
    // Pequena = 33 (pentágono menor), Média = 66 (pentágono médio), Grande = 100 (pentágono maior)
    const calcularPorteScore = () => {
      if (!portesData.length) return 0;
      const pesosPorte: Record<string, number> = {
        'Pequena': 33,
        'Média': 66,
        'Grande': 100,
      };
      let somaScore = 0;
      let totalLeads = 0;
      portesData.forEach(p => {
        const peso = pesosPorte[p.porte] || 50;
        somaScore += peso * p.quantidade;
        totalLeads += p.quantidade;
      });
      return totalLeads > 0 ? Math.round(somaScore / totalLeads) : 0;
    };

    // Radar Chart Data baseado nos dados reais
    const margemScore = Math.min(100, (analysis.margemMedia / 2000) * 100);
    const vinculoScore = calcularVinculoScore();
    const porteScore = calcularPorteScore();
    const radarData = [
      { caracteristica: 'Margem Média', valor: margemScore, fullMark: 100 },
      { caracteristica: 'Com Margem', valor: (analysis.comMargem / analysis.totalAprovados) * 100, fullMark: 100 },
      { caracteristica: 'Porte da Empresa', valor: porteScore, fullMark: 100 },
      { caracteristica: 'Tempo de Vínculo', valor: vinculoScore, fullMark: 100 },
      { caracteristica: 'Diversidade', valor: Math.min(100, (analysis.topCBOs?.length || 0) * 10), fullMark: 100 },
    ];

    return {
      totalAprovados: analysis.totalAprovados,
      faixasMargem,
      faixasVinculo: vinculoData,
      portesData,
      radarData,
      resumo: {
        margemIdeal: margemMaisComum.faixa,
        vinculoIdeal: vinculoData[0]?.faixa || 'N/A',
        porteIdeal: portesData[0]?.porte || 'N/A',
        cboIdeal: topCBO?.descricao 
          ? (topCBO.descricao.length > 25 ? topCBO.descricao.substring(0, 22) + '...' : topCBO.descricao)
          : 'N/A',
        contratosIdeal: `R$ ${analysis.margemMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    };
  }, [analysis]);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-amber-400" />
            Perfil Ideal do Lead Aprovado
          </CardTitle>
          <CardTitle className="text-lg">Perfil Ideal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Star className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Dados insuficientes</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar o perfil ideal.
            </p>
            <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
              <Upload className="w-4 h-4" />
              Ir para Importações
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!perfil) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-amber-400" />
            Perfil Ideal do Lead Aprovado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Ainda não há leads aprovados para calcular o perfil ideal.
          </div>
        </CardContent>
      </Card>
    );
  }

  const PORTE_COLORS = ['#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9'];

  const resumoItems = [
    {
      icon: DollarSign,
      title: "Margem Disponível",
      subtitle: "Faixa ideal",
      value: perfil.resumo.margemIdeal,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
    },
    {
      icon: Clock,
      title: "Tempo de Vínculo",
      subtitle: "Período ideal",
      value: perfil.resumo.vinculoIdeal,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-500/30",
    },
    {
      icon: Building2,
      title: "Porte da Empresa",
      subtitle: "Melhor taxa",
      value: perfil.resumo.porteIdeal,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      borderColor: "border-amber-500/30",
    },
    {
      icon: Briefcase,
      title: "CBO Elegível",
      subtitle: "Top ocupação",
      value: perfil.resumo.cboIdeal,
      color: "text-pink-400",
      bgColor: "bg-pink-500/20",
      borderColor: "border-pink-500/30",
    },
    {
      icon: CheckCircle,
      title: "Contratos Ativos",
      subtitle: "Máximo permitido",
      value: perfil.resumo.contratosIdeal,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row - Radar + Resumo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Radar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-400" />
              Perfil Ideal do Lead Aprovado
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Características que maximizam a chance de aprovação
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={perfil.radarData} cx="50%" cy="50%" outerRadius="65%">
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis 
                    dataKey="caracteristica" 
                    tick={{ fill: '#9ca3af', fontSize: 9 }} 
                    className="text-[8px] sm:text-[11px]"
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickCount={5}
                  />
                  <Radar 
                    name="Perfil" 
                    dataKey="valor" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Perfil */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-amber-400" />
              Resumo do Perfil que Aprova
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Características mais comuns entre leads aprovados
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              {resumoItems.map((item) => (
                <div 
                  key={item.title}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 rounded-lg bg-muted/30 border border-border gap-2 sm:gap-3"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${item.bgColor} flex-shrink-0`}>
                      <item.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${item.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm sm:text-base truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${item.bgColor} ${item.color} ${item.borderColor} self-start sm:self-center whitespace-nowrap flex-shrink-0`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Margem + Vínculo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Distribuição por Faixa de Margem */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribuição por Faixa de Margem
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Leads aprovados por faixa de margem disponível
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfil.faixasMargem} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis 
                    dataKey="faixa" 
                    type="category" 
                    tick={{ fill: '#9ca3af', fontSize: 11 }} 
                    width={80} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                  />
                  <Bar dataKey="quantidade" fill="#10b981" radius={[0, 4, 4, 0]} onClick={(data) => handleMargemClick(data)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Tempo de Vínculo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribuição por Tempo de Vínculo
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Leads aprovados por tempo de emprego
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfil.faixasVinculo} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis 
                    dataKey="faixa" 
                    type="category" 
                    tick={{ fill: '#9ca3af', fontSize: 11 }} 
                    width={80} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                  />
                  <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 4, 4, 0]} onClick={(data) => handleVinculoClick(data)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Porte da Empresa */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Distribuição por Porte da Empresa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Taxa de aprovação por porte do empregador
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfil.portesData} margin={{ left: 20, right: 20, bottom: 20 }}>
                <XAxis 
                  dataKey="porte" 
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
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value} leads aprovados`, 'Quantidade']}
                />
                <Bar 
                  dataKey="quantidade" 
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => handlePorteClick(data)}
                  style={{ cursor: 'pointer' }}
                >
                  {perfil.portesData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PORTE_COLORS[index % PORTE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row - Parcelamento + Produtos */}
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
              {analysis.totalAprovados > 0 && (analysis.distribuicaoParcelas || []).reduce((sum, p) => sum + p.quantidade, 0) < analysis.totalAprovados && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-amber-400 p-0 h-auto ml-2"
                  onClick={investigarLeadsSemParcelamento}
                >
                  ({analysis.totalAprovados - (analysis.distribuicaoParcelas || []).reduce((sum, p) => sum + p.quantidade, 0)} sem dados)
                </Button>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {(analysis.distribuicaoParcelas || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(analysis.distribuicaoParcelas || []).map(p => ({ parcela: `${p.parcelas}x`, quantidade: p.quantidade }))} 
                    margin={{ left: 10, right: 20, bottom: 20 }}
                  >
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
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
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

        {/* Distribuição por Banco */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Package className="w-5 h-5 text-purple-400" />
              Distribuição por Banco
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Leads aprovados por banco
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {(analysis.distribuicaoBanco || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(analysis.distribuicaoBanco || []).slice(0, 10).map(b => ({ 
                      banco: b.banco.length > 25 ? b.banco.substring(0, 22) + '...' : b.banco, 
                      bancoCompleto: b.banco,
                      quantidade: b.quantidade 
                    }))} 
                    layout="vertical" 
                    margin={{ left: 10, right: 20 }}
                  >
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis 
                      dataKey="banco" 
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
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                    />
                    <Bar 
                      dataKey="quantidade" 
                      fill="#8b5cf6" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum dado de banco disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Contratos Aprovados */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Contratos Aprovados
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise detalhada dos contratos aprovados
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingContratos ? (
            <div className="py-8 text-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Row 1: Data de Digitação + Tempo de Digitação */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 3 Datas de Digitação */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <h4 className="font-semibold text-foreground">Top 3 Datas de Digitação</h4>
                  </div>
                  {contratosAnalysis.topDatasDigitacao.length > 0 ? (
                    <div className="space-y-3">
                      {contratosAnalysis.topDatasDigitacao.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </span>
                            <span className="text-foreground font-medium">{item.data}</span>
                          </div>
                          <span className="text-muted-foreground">{item.quantidade} leads</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      Nenhum dado disponível
                    </div>
                  )}
                </div>

                {/* Top 3 Tempos de Digitação */}
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Timer className="w-5 h-5 text-purple-400" />
                    <h4 className="font-semibold text-foreground">Top 3 Tempos de Digitação</h4>
                  </div>
                  {contratosAnalysis.topTemposDigitacao.length > 0 ? (
                    <div className="space-y-3">
                      {contratosAnalysis.topTemposDigitacao.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </span>
                            <span className="text-foreground font-medium">{item.faixa}</span>
                          </div>
                          <span className="text-muted-foreground">{item.quantidade} leads</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      Nenhum dado disponível
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Pago/Não Pago por Banco */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-semibold text-foreground">Pagos vs Não Pagos por Banco</h4>
                </div>
                {contratosAnalysis.pagoPorBanco.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={contratosAnalysis.pagoPorBanco.slice(0, 5)} 
                        margin={{ left: 10, right: 20, bottom: 20 }}
                      >
                        <XAxis 
                          dataKey="banco" 
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
                          formatter={(value: number, name: string) => [
                            `${value} leads`, 
                            name === 'pagos' ? 'Pagos' : 'Não Pagos'
                          ]}
                        />
                        <Bar 
                          dataKey="pagos" 
                          fill="#10b981" 
                          radius={[4, 4, 0, 0]}
                          name="pagos"
                          onClick={(data) => handlePagosClick(data.banco, 'pagos')}
                          style={{ cursor: 'pointer' }}
                        />
                        <Bar 
                          dataKey="naoPagos" 
                          fill="#ef4444" 
                          radius={[4, 4, 0, 0]}
                          name="naoPagos"
                          onClick={(data) => handlePagosClick(data.banco, 'naoPagos')}
                          style={{ cursor: 'pointer' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum dado de pagamento disponível
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Clique nas barras para visualizar os leads
                </p>
              </div>

              {/* Row 3: Top 3 Datas de Pagamento */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-semibold text-foreground">Top 3 Datas de Pagamento</h4>
                </div>
                {contratosAnalysis.topDatasPagamento.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {contratosAnalysis.topDatasPagamento.map((item, index) => (
                      <div key={index} className="p-4 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <span className="text-foreground font-medium">{item.data}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.quantidade} pagamentos
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    Nenhum dado de pagamento disponível
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para exibir leads pagos/não pagos */}
      <Dialog open={pagosDialogOpen} onOpenChange={setPagosDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              {pagosDialogData?.titulo}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {pagosDialogData?.leads.length || 0} leads encontrados
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {pagosDialogData && pagosDialogData.leads.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Digitação</TableHead>
                    {pagosDialogData.tipo === 'pagos' && <TableHead>Data Pagamento</TableHead>}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosDialogData.leads.map((lead, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{formatCpf(lead.cpf)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{lead.nome || "-"}</TableCell>
                      <TableCell>{lead.banco}</TableCell>
                      <TableCell className="text-emerald-400 font-medium">
                        {formatCurrency(lead.valorPago)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(lead.dataDigitacao).toLocaleDateString('pt-BR')}
                      </TableCell>
                      {pagosDialogData.tipo === 'pagos' && (
                        <TableCell className="text-muted-foreground">
                          {lead.dataPagamento ? new Date(lead.dataPagamento).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewProposta(lead.id)}
                          title="Ver proposta"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Dialog para visualizar proposta */}
      <Dialog open={propostaDialogOpen} onOpenChange={setPropostaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Situação do Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingProposta ? (
              <div className="py-8 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                  <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
              </div>
            ) : propostaData ? (
              (() => {
                const statusDescription = propostaData.statusDescription as string || '';
                const normalizedStatus = statusDescription
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .trim();
                
                const statusPagos = ['encerrado', 'liquidacao', 'liquidacao manual', 'pago', 'liquidado'];
                const statusCancelados = ['cancelada', 'cancelado', 'reprovado'];
                
                let situacao = 'Aguardando';
                let situacaoClass = 'text-amber-400';
                let badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                
                if (statusPagos.some(s => normalizedStatus.includes(s))) {
                  situacao = 'Pago';
                  situacaoClass = 'text-emerald-400';
                  badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                } else if (statusCancelados.some(s => normalizedStatus.includes(s))) {
                  situacao = 'Reprovado/Cancelado';
                  situacaoClass = 'text-red-400';
                  badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
                }
                
                return (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Situação de Pagamento</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${badgeClass}`}>
                        {situacao === 'Pago' && '✓ '}
                        {situacao === 'Reprovado/Cancelado' && '✕ '}
                        {situacao === 'Aguardando' && '⏳ '}
                        {situacao}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Motivo / Status</p>
                      <p className={`${situacaoClass} font-medium`}>
                        {statusDescription || 'Pendente'}
                      </p>
                    </div>
                    {propostaData.disbursementDate && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data de Pagamento</p>
                        <p className="text-foreground">
                          {new Date(String(propostaData.disbursementDate)).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {(propostaData.disbursedIssueAmount || propostaData.requestedAmount) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor</p>
                        <p className="text-foreground">
                          {formatCurrency(Number(propostaData.disbursedIssueAmount || propostaData.requestedAmount || 0))}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum dado de proposta disponível.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para exibir leads sem parcelamento */}
      <Dialog open={semParcelamentoDialogOpen} onOpenChange={setSemParcelamentoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              Leads Aprovados Sem Dados de Parcelamento
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {leadsSemParcelamento.length} leads não possuem informação de parcelamento
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {leadsSemParcelamento.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">CPF</TableHead>
                    <TableHead className="text-center">Nome</TableHead>
                    <TableHead className="text-center">Banco</TableHead>
                    <TableHead className="text-center">Motivo</TableHead>
                    <TableHead className="text-center">Status de Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsSemParcelamento.map((lead, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm text-center">{formatCpf(lead.cpf)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-center">{lead.nome}</TableCell>
                      <TableCell className="text-center">{lead.banco}</TableCell>
                      <TableCell className="max-w-[200px] text-amber-400 text-xs text-center">{lead.motivo}</TableCell>
                      <TableCell className="max-w-[150px] text-xs text-center">{lead.statusDescription}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Todos os leads aprovados possuem dados de parcelamento.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para exibir leads por porte */}
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
            {loadingLeads ? (
              <div className="py-8 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                  <div className="h-4 w-32 bg-muted rounded"></div>
                </div>
              </div>
            ) : dialogData && dialogData.leads.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">CPF</TableHead>
                    <TableHead className="text-center">Nome</TableHead>
                    <TableHead className="text-center">Banco</TableHead>
                    <TableHead className="text-center">Empresa</TableHead>
                    <TableHead className="text-center">Porte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm text-center">{formatCpf(item.cpf)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-center">{item.nome || "-"}</TableCell>
                      <TableCell className="text-center">{item.banco}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-center">{item.empresa}</TableCell>
                      <TableCell className="text-center">{item.porte}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum lead encontrado nesta categoria.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerfilIdealPanel;