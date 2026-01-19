import { Building2, Upload, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useApprovedLeadsAnalysis } from "@/hooks/useApprovedLeadsAnalysis";

interface EmpresasPanelProps {
  bancoFilter?: string;
  importBatchId?: string;
}

interface LeadPorEmpresa {
  cpf: string;
  nome: string;
  banco: string;
  empresa: string;
}

const EmpresasPanel = ({ bancoFilter = "todos", importBatchId }: EmpresasPanelProps) => {
  const navigate = useNavigate();
  const { analysis, isLoading } = useApprovedLeadsAnalysis(bancoFilter === "todos" ? undefined : bancoFilter, importBatchId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ titulo: string; subtitulo: string; leads: LeadPorEmpresa[] } | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleEmpresaClick = async (data: { nome: string; quantidade: number }) => {
    if (!data?.nome) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads - ${data.nome}`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: LeadPorEmpresa[] | null; error: Error | null }>)('get_leads_by_empresa', {
        p_empresa_nome: data.nome,
        p_import_batch_id: importBatchId || null,
        p_limit: 100,
      });
      if (error) throw error;
      setDialogData({ titulo: `Leads - ${data.nome}`, subtitulo: `${(leads || []).length} leads encontrados`, leads: leads || [] });
    } catch (err) {
      console.error('Erro ao buscar leads por empresa:', err);
      setDialogData({ titulo: `Leads - ${data.nome}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const top10Empresas = useMemo(() => {
    return (analysis.topEmpresas || []).map((item, index) => ({
      nome: item.nome,
      cnpj: item.cnpj,
      quantidade: item.quantidade,
      nomeExibicao: item.nome.length > 25 
        ? item.nome.substring(0, 22) + "..." 
        : item.nome,
      rank: index + 1,
    }));
  }, [analysis.topEmpresas]);

  const totalAprovados = analysis.totalAprovados;

  const COLORS = [
    "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe",
    "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"
  ];

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Top Empresas</CardTitle>
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

  if (totalAprovados === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Top Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma empresa encontrada</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar empresas.
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

  if (top10Empresas.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            Top 10 Empresas com Mais Aprovações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p>Nenhum lead aprovado com dados de empresa encontrado.</p>
            <p className="text-sm mt-2">Os dados de empresa são extraídos do retorno de margem.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de barras */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Top 10 Empresas com Mais Aprovações
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Empresas com maior número de leads aprovados • {totalAprovados} leads aprovados no total
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={top10Empresas} 
                layout="vertical" 
                margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
              >
                <XAxis 
                  type="number" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }} 
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  dataKey="nomeExibicao" 
                  type="category" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }} 
                  width={180}
                  axisLine={{ stroke: '#374151' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '12px',
                    color: 'hsl(var(--foreground))',
                    padding: '12px 16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-xl p-3 shadow-xl min-w-[220px]">
                          <p className="font-semibold text-foreground text-sm mb-1">
                            {data.nome}
                          </p>
                          {data.cnpj && (
                            <p className="text-xs text-muted-foreground mb-2">
                              CNPJ: {data.cnpj}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-blue-400 font-bold">
                              {data.quantidade} leads aprovados
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} onClick={(data) => handleEmpresaClick(data)} style={{ cursor: 'pointer' }}>
                  {top10Empresas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-blue-400" />
            Detalhamento das Empresas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {top10Empresas.map((empresa, index) => (
              <div 
                key={empresa.nome}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: COLORS[index] }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-foreground text-sm">{empresa.nome}</p>
                    {empresa.cnpj && (
                      <p className="text-xs text-muted-foreground">CNPJ: {empresa.cnpj}</p>
                    )}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {empresa.quantidade} aprovações
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Dialog para exibir leads por empresa */}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{formatCpf(item.cpf)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.nome || "-"}</TableCell>
                      <TableCell>{item.banco}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.empresa || "-"}</TableCell>
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

export default EmpresasPanel;
