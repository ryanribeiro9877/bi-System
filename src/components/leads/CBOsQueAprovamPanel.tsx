import { Briefcase, Upload, TrendingUp, Eye, Building2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useApprovedLeadsAnalysis } from "@/hooks/useApprovedLeadsAnalysis";

interface CBOsQueAprovamPanelProps {
  bancoFilter?: string;
  importBatchId?: string;
}

interface LeadPorCBO {
  cpf: string;
  nome: string;
  banco: string;
  cboCodigo: string;
  cboDescricao: string;
}

interface CBOComEmpresa {
  codigo: string;
  descricao: string;
  quantidade: number;
  nomeExibicao: string;
  rank: number;
  topEmpresa: string;
  topEmpresaQtd: number;
}

const CBOsQueAprovamPanel = ({ bancoFilter = "todos", importBatchId }: CBOsQueAprovamPanelProps) => {
  const navigate = useNavigate();
  const { analysis, isLoading } = useApprovedLeadsAnalysis(bancoFilter === "todos" ? undefined : bancoFilter, importBatchId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ titulo: string; subtitulo: string; leads: LeadPorCBO[] } | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [cboEmpresaMap, setCboEmpresaMap] = useState<Record<string, { empresa: string; quantidade: number }>>({});
  const [loadingCboEmpresa, setLoadingCboEmpresa] = useState(false);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Buscar relação CBO X Empresa usando RPC do Supabase
  useEffect(() => {
    const fetchCboEmpresaRelation = async () => {
      if (!analysis.topCBOs || analysis.topCBOs.length === 0) return;
      
      setLoadingCboEmpresa(true);
      try {
        const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: Array<{ cbo_codigo: string; empresa_nome: string; quantidade: number }> | null; error: Error | null }>)('get_cbo_empresa_relation', {
          p_banco: bancoFilter !== "todos" ? bancoFilter : null,
          p_import_batch_id: importBatchId || null,
        });

        if (error) throw error;

        const resultObj: Record<string, { empresa: string; quantidade: number }> = {};
        data?.forEach(item => {
          if (item.cbo_codigo && item.empresa_nome) {
            resultObj[item.cbo_codigo] = { 
              empresa: item.empresa_nome, 
              quantidade: Number(item.quantidade) 
            };
          }
        });

        setCboEmpresaMap(resultObj);
      } catch (err) {
        console.error('Erro ao buscar relação CBO-Empresa:', err);
      } finally {
        setLoadingCboEmpresa(false);
      }
    };

    fetchCboEmpresaRelation();
  }, [analysis.topCBOs, bancoFilter, importBatchId]);

  const handleCBOClick = async (data: { codigo: string; descricao: string; quantidade: number }) => {
    if (!data?.codigo) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads - ${data.descricao}`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: LeadPorCBO[] | null; error: Error | null }>)('get_leads_by_cbo', {
        p_cbo_codigo: data.codigo,
        p_import_batch_id: importBatchId || null,
        p_limit: 100,
      });
      if (error) throw error;
      setDialogData({ titulo: `Leads - ${data.descricao}`, subtitulo: `${(leads || []).length} leads encontrados`, leads: leads || [] });
    } catch (err) {
      console.error('Erro ao buscar leads por CBO:', err);
      setDialogData({ titulo: `Leads - ${data.descricao}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const top10CBOs = useMemo((): CBOComEmpresa[] => {
    return (analysis.topCBOs || []).map((item, index) => {
      const empresaInfo = cboEmpresaMap[item.codigo] || cboEmpresaMap[String(item.codigo)];

      return {
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: item.quantidade,
        nomeExibicao: item.descricao.length > 25 
          ? item.descricao.substring(0, 22) + "..." 
          : item.descricao,
        rank: index + 1,
        topEmpresa: empresaInfo?.empresa || 'N/A',
        topEmpresaQtd: empresaInfo?.quantidade || 0,
      };
    });
  }, [analysis.topCBOs, cboEmpresaMap]);

  const totalAprovados = analysis.totalAprovados;

  const [downloadingReport, setDownloadingReport] = useState(false);

  // Função para download do relatório CSV com TODOS os CBOs aprovados
  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      // Buscar todos os CBOs aprovados do banco
      const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: Array<{ cbo_codigo: string; cbo_descricao: string; quantidade: number; empresa_principal: string; leads_empresa: number }> | null; error: Error | null }>)('get_all_cbos_aprovados', {
        p_banco: bancoFilter !== "todos" ? bancoFilter : null,
        p_import_batch_id: importBatchId || null,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Nenhum CBO aprovado encontrado para download.');
        return;
      }

      // Cabeçalho do CSV
      const headers = ['Ranking', 'Código CBO', 'Descrição CBO', 'Aprovações', 'Empresa Principal', 'Leads da Empresa'];
      
      // Dados
      const rows = data.map((cbo, index) => [
        index + 1,
        cbo.cbo_codigo,
        `"${cbo.cbo_descricao || ''}"`,
        cbo.quantidade,
        `"${cbo.empresa_principal || 'N/A'}"`,
        cbo.leads_empresa || 0
      ]);

      // Montar CSV
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      // Adicionar BOM para UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Criar link de download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_todos_cbos_aprovados_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      alert('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setDownloadingReport(false);
    }
  };

  const COLORS = [
    "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5",
    "#059669", "#047857", "#065f46", "#064e3b", "#022c22"
  ];

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">CBOs que Aprovam</CardTitle>
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
          <CardTitle className="text-lg">CBOs que Aprovam</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO analisado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar CBOs.
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

  if (top10CBOs.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Top 10 CBOs que Aprovam
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p>Nenhum lead aprovado com CBO encontrado no banco UY3.</p>
            <p className="text-sm mt-2">Os dados de CBO são extraídos do retorno de margem do UY3.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Top 10 CBOs que Aprovam
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {downloadingReport ? 'Gerando...' : 'Baixar Relatório'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            CBOs com maior número de aprovações no banco UY3 • {totalAprovados} leads aprovados
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={top10CBOs} 
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
                  cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-xl p-3 shadow-xl min-w-[200px]">
                          <p className="font-semibold text-foreground text-sm mb-1">
                            {data.descricao}
                          </p>
                          {data.codigo && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Código CBO: {data.codigo}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className="text-emerald-400 font-bold">
                              {data.quantidade} leads aprovados
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} onClick={(data) => handleCBOClick(data)} style={{ cursor: 'pointer' }}>
                  {top10CBOs.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela CBO X Empresa */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            CBOs que Aprovam
            <span className="text-muted-foreground mx-2">×</span>
            <Building2 className="w-4 h-4 text-blue-400" />
            Empresas que Aprovam
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Relação entre CBO e a empresa com mais aprovações para aquele CBO
          </p>
        </CardHeader>
        <CardContent>
          {loadingCboEmpresa ? (
            <div className="py-8 text-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {top10CBOs.map((cbo, index) => (
                <div 
                  key={cbo.codigo || cbo.descricao}
                  className="p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* CBO Side */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: COLORS[index] }}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm truncate">{cbo.descricao}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {cbo.codigo && (
                            <span className="text-xs text-muted-foreground">Código: {cbo.codigo}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {cbo.quantidade} aprovações
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="hidden lg:flex items-center justify-center px-4">
                      <div className="w-8 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded"></div>
                      <span className="mx-2 text-muted-foreground font-bold">×</span>
                      <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 rounded"></div>
                    </div>
                    <div className="lg:hidden flex items-center justify-center py-1">
                      <div className="w-full h-0.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500 rounded"></div>
                    </div>

                    {/* Empresa Side */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm truncate">
                          {cbo.topEmpresa !== 'N/A' 
                            ? (cbo.topEmpresa.length > 35 ? cbo.topEmpresa.substring(0, 32) + '...' : cbo.topEmpresa)
                            : 'Empresa não identificada'
                          }
                        </p>
                        {cbo.topEmpresa !== 'N/A' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 mt-1 inline-block">
                            {cbo.topEmpresaQtd} leads com este CBO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialog para exibir leads por CBO */}
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
                    <TableHead className="text-center">CBO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm text-center">{formatCpf(item.cpf)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-center">{item.nome || "-"}</TableCell>
                      <TableCell className="text-center">{item.banco}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-center">{item.cboDescricao || "-"}</TableCell>
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

export default CBOsQueAprovamPanel;
