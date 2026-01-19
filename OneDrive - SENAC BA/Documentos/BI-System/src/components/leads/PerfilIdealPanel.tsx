import { Star, Upload, DollarSign, Clock, Building2, Briefcase, CheckCircle, Award, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useApprovedLeadsAnalysis } from "@/hooks/useApprovedLeadsAnalysis";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<DialogData | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

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

    // Radar Chart Data baseado nos dados reais
    const margemScore = Math.min(100, (analysis.margemMedia / 2000) * 100);
    const radarData = [
      { caracteristica: 'Margem Média', valor: margemScore, fullMark: 100 },
      { caracteristica: 'Com Margem', valor: (analysis.comMargem / analysis.totalAprovados) * 100, fullMark: 100 },
      { caracteristica: 'Top CBO', valor: topCBO ? Math.min(100, (topCBO.quantidade / analysis.totalAprovados) * 500) : 0, fullMark: 100 },
      { caracteristica: 'Top Empresa', valor: topEmpresa ? Math.min(100, (topEmpresa.quantidade / analysis.totalAprovados) * 500) : 0, fullMark: 100 },
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={perfil.radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis 
                    dataKey="caracteristica" 
                    tick={{ fill: '#9ca3af', fontSize: 11 }} 
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
            <div className="space-y-4">
              {resumoItems.map((item) => (
                <div 
                  key={item.title}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${item.bgColor} ${item.color} ${item.borderColor}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Margem + Vínculo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Porte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{formatCpf(item.cpf)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.nome || "-"}</TableCell>
                      <TableCell>{item.banco}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.empresa}</TableCell>
                      <TableCell>{item.porte}</TableCell>
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