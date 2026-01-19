import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, BarChart3, PieChart, Download, Building2, Clock, Ban, Wifi, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useDashboard } from "@/contexts/DashboardContext";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface ErroResumo {
  total_consultas: number;
  total_erros: number;
  total_aprovados: number;
  taxa_erro: number;
  erro_mais_comum: string;
  erro_mais_comum_qtd: number;
  erro_menos_comum: string;
  erro_menos_comum_qtd: number;
  categoria_mais_comum: string;
  categoria_mais_comum_qtd: number;
}

interface ErroAnalise {
  categoria_erro: string;
  tipo_erro: string;
  banco: string;
  quantidade: number;
  percentual: number;
}

interface ErroPorBanco {
  banco: string;
  total_consultas: number;
  total_erros: number;
  taxa_erro: number;
  erro_mais_comum: string;
  erro_mais_comum_qtd: number;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#0ea5e9"
];

const CATEGORIA_ICONS: Record<string, React.ReactNode> = {
  "Autorização": <Ban className="w-4 h-4" />,
  "Margem": <TrendingDown className="w-4 h-4" />,
  "Tempo de Vínculo": <Clock className="w-4 h-4" />,
  "CBO Bloqueado": <FileWarning className="w-4 h-4" />,
  "Timeout/Conexão": <Wifi className="w-4 h-4" />,
  "Horário": <Clock className="w-4 h-4" />,
  "Política/Elegibilidade": <Building2 className="w-4 h-4" />,
};

const ResultadosConsultasMargem = () => {
  const { selectedImportFile } = useDashboard();
  const [resumo, setResumo] = useState<ErroResumo | null>(null);
  const [errosAnalise, setErrosAnalise] = useState<ErroAnalise[]>([]);
  const [errosPorBanco, setErrosPorBanco] = useState<ErroPorBanco[]>([]);
  const [loading, setLoading] = useState(true);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("todos");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const importBatchId = selectedImportFile || null;
        
        // Buscar resumo
        const { data: resumoData } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: ErroResumo[] | null; error: Error | null }>)('get_erros_resumo', {
          p_banco: null,
          p_import_batch_id: importBatchId,
        });
        if (resumoData && resumoData.length > 0) {
          setResumo(resumoData[0]);
        }

        // Buscar análise detalhada
        const { data: analiseData } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: ErroAnalise[] | null; error: Error | null }>)('get_erros_consultas_analysis', {
          p_banco: null,
          p_import_batch_id: importBatchId,
        });
        if (analiseData) {
          setErrosAnalise(analiseData);
        }

        // Buscar erros por banco
        const { data: bancoData } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: ErroPorBanco[] | null; error: Error | null }>)('get_erros_por_banco', {
          p_import_batch_id: importBatchId,
        });
        if (bancoData) {
          setErrosPorBanco(bancoData);
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedImportFile]);

  // Agrupar erros por categoria
  const errosPorCategoria = useMemo(() => {
    const grouped = new Map<string, number>();
    errosAnalise
      .filter(e => bancoSelecionado === "todos" || e.banco === bancoSelecionado)
      .forEach(e => {
        grouped.set(e.categoria_erro, (grouped.get(e.categoria_erro) || 0) + Number(e.quantidade));
      });
    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [errosAnalise, bancoSelecionado]);

  // Top 10 erros específicos
  const top10Erros = useMemo(() => {
    return errosAnalise
      .filter(e => bancoSelecionado === "todos" || e.banco === bancoSelecionado)
      .filter(e => e.tipo_erro !== 'Não informado')
      .slice(0, 10)
      .map(e => ({
        nome: e.tipo_erro.length > 50 ? e.tipo_erro.substring(0, 47) + '...' : e.tipo_erro,
        nomeCompleto: e.tipo_erro,
        quantidade: Number(e.quantidade),
        banco: e.banco,
        categoria: e.categoria_erro,
      }));
  }, [errosAnalise, bancoSelecionado]);

  // Função para download do relatório
  const handleDownloadReport = () => {
    if (errosAnalise.length === 0) return;

    const headers = ['Categoria', 'Tipo de Erro', 'Banco', 'Quantidade', 'Percentual (%)'];
    const rows = errosAnalise.map(e => [
      e.categoria_erro,
      `"${e.tipo_erro}"`,
      e.banco,
      e.quantidade,
      e.percentual
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_erros_consultas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const bancosDisponiveis = ['todos', ...errosPorBanco.map(b => b.banco)];

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar />
      
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                Resultados das Consultas de Margem
              </h1>
              <p className="text-muted-foreground mt-1">
                Análise detalhada dos erros e resultados das consultas
              </p>
            </div>
            <Button onClick={handleDownloadReport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Baixar Relatório
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-48 bg-muted rounded mb-4"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Consultas</p>
                        <p className="text-3xl font-bold text-foreground">{resumo?.total_consultas?.toLocaleString() || 0}</p>
                      </div>
                      <BarChart3 className="w-10 h-10 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Erros</p>
                        <p className="text-3xl font-bold text-red-500">{resumo?.total_erros?.toLocaleString() || 0}</p>
                      </div>
                      <AlertTriangle className="w-10 h-10 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Taxa de Erro</p>
                        <p className="text-3xl font-bold text-amber-500">{resumo?.taxa_erro || 0}%</p>
                      </div>
                      <TrendingDown className="w-10 h-10 text-amber-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Aprovados</p>
                        <p className="text-3xl font-bold text-emerald-500">{resumo?.total_aprovados?.toLocaleString() || 0}</p>
                      </div>
                      <TrendingUp className="w-10 h-10 text-emerald-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KPIs de Erros Específicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Erro Mais Comum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground line-clamp-2" title={resumo?.erro_mais_comum}>
                      {resumo?.erro_mais_comum || 'N/A'}
                    </p>
                    <p className="text-2xl font-bold text-red-500 mt-2">
                      {resumo?.erro_mais_comum_qtd?.toLocaleString() || 0} ocorrências
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Categoria Mais Comum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground">
                      {resumo?.categoria_mais_comum || 'N/A'}
                    </p>
                    <p className="text-2xl font-bold text-amber-500 mt-2">
                      {resumo?.categoria_mais_comum_qtd?.toLocaleString() || 0} ocorrências
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Erro Menos Comum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium text-foreground line-clamp-2" title={resumo?.erro_menos_comum}>
                      {resumo?.erro_menos_comum || 'N/A'}
                    </p>
                    <p className="text-2xl font-bold text-emerald-500 mt-2">
                      {resumo?.erro_menos_comum_qtd?.toLocaleString() || 0} ocorrências
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Erros por Banco */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-500" />
                    Erros por Banco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {errosPorBanco.map((banco, idx) => (
                      <div key={banco.banco} className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-foreground">{banco.banco}</h4>
                          <span className="text-sm text-red-400">{banco.taxa_erro}% erros</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Total: <span className="text-foreground font-medium">{banco.total_consultas?.toLocaleString()}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Erros: <span className="text-red-400 font-medium">{banco.total_erros?.toLocaleString()}</span>
                          </p>
                          <p className="text-muted-foreground mt-2">Erro mais comum:</p>
                          <p className="text-xs text-foreground line-clamp-2" title={banco.erro_mais_comum}>
                            {banco.erro_mais_comum || 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Filtro por Banco */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtrar por banco:</span>
                <Tabs value={bancoSelecionado} onValueChange={setBancoSelecionado}>
                  <TabsList>
                    {bancosDisponiveis.map(banco => (
                      <TabsTrigger key={banco} value={banco}>
                        {banco === 'todos' ? 'Todos' : banco}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Pizza - Categorias */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-blue-500" />
                      Distribuição por Categoria de Erro
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={errosPorCategoria}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {errosPorCategoria.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [value.toLocaleString(), 'Quantidade']}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico de Barras - Top 10 Erros */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-red-500" />
                      Top 10 Erros Mais Frequentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10Erros} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <YAxis 
                            dataKey="nome" 
                            type="category" 
                            width={200}
                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--popover))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-popover border border-border rounded-lg p-3 shadow-xl max-w-[300px]">
                                    <p className="text-xs text-foreground mb-2">{data.nomeCompleto}</p>
                                    <p className="text-sm font-bold text-red-400">{data.quantidade.toLocaleString()} ocorrências</p>
                                    <p className="text-xs text-muted-foreground mt-1">Banco: {data.banco}</p>
                                    <p className="text-xs text-muted-foreground">Categoria: {data.categoria}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="quantidade" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Categorias */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileWarning className="w-5 h-5 text-amber-500" />
                    Detalhamento por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {errosPorCategoria.map((cat, idx) => (
                      <div 
                        key={cat.name} 
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                        style={{ borderLeftColor: COLORS[idx % COLORS.length], borderLeftWidth: '4px' }}
                      >
                        <div className="flex items-center gap-2">
                          {CATEGORIA_ICONS[cat.name] || <AlertTriangle className="w-4 h-4" />}
                          <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                          {cat.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResultadosConsultasMargem;
