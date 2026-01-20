import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, BarChart3, PieChart, Download, Building2, Clock, Ban, Wifi, FileWarning, Eye, Filter, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

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

interface LeadPorErro {
  cpf: string;
  nome: string;
  banco: string;
  tipo_reprovacao: string;
  retorno_margem: unknown;
  retorno_simulacao: unknown;
}

const ResultadosConsultasPanel = () => {
  const { selectedImportFile } = useDashboard();
  const [resumo, setResumo] = useState<ErroResumo | null>(null);
  const [errosAnalise, setErrosAnalise] = useState<ErroAnalise[]>([]);
  const [errosPorBanco, setErrosPorBanco] = useState<ErroPorBanco[]>([]);
  const [loading, setLoading] = useState(true);
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ titulo: string; subtitulo: string; leads: LeadPorErro[] } | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadPorErro | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [errosSelecionados, setErrosSelecionados] = useState<string[]>([]);
  const [erroFilterOpen, setErroFilterOpen] = useState(false);
  const [gradeData, setGradeData] = useState<{ name: string; value: number }[]>([]);
  const [bancosDoErro, setBancosDoErro] = useState<{ banco: string; quantidade: number }[]>([]);

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleBarClick = async (data: { nomeCompleto: string; quantidade: number; banco: string }) => {
    if (!data?.nomeCompleto) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads com Erro`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('cpf, nome, banco, tipo_reprovacao, retorno_margem, retorno_simulacao')
        .eq('tipo_reprovacao', data.nomeCompleto)
        .eq('status', 'reprovado')
        .limit(100);
      
      if (error) throw error;
      setDialogData({ 
        titulo: `Leads - ${data.nomeCompleto.substring(0, 50)}${data.nomeCompleto.length > 50 ? '...' : ''}`, 
        subtitulo: `${(leads || []).length} leads encontrados`, 
        leads: (leads || []) as LeadPorErro[]
      });
    } catch (err) {
      console.error('Erro ao buscar leads por erro:', err);
      setDialogData({ titulo: `Leads com Erro`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleViewDetail = (lead: LeadPorErro) => {
    setSelectedLead(lead);
    setDetailDialogOpen(true);
  };

  const handlePieClick = async (data: { name: string; value: number }) => {
    if (!data?.name) return;
    
    // Ignorar clique em categorias vazias ou "Não Categorizado" sem dados
    if (data.value === 0 || (data.name === 'Não Categorizado' && data.value === 0)) {
      return;
    }
    
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads - Categoria: ${data.name}`, subtitulo: `Carregando...`, leads: [] });
    try {
      // Buscar os tipos de erro que pertencem a esta categoria
      // Usar categoria_erro do banco de dados para consistência
      const errosDaCategoria = errosAnalise
        .filter(e => {
          return e.categoria_erro === data.name && (bancoSelecionado === "todos" || e.banco === bancoSelecionado);
        })
        .map(e => e.tipo_erro);

      if (errosDaCategoria.length === 0) {
        setDialogData({ titulo: `Leads - Categoria: ${data.name}`, subtitulo: `Nenhum erro encontrado nesta categoria`, leads: [] });
        setLoadingLeads(false);
        return;
      }

      const { data: leads, error, count } = await supabase
        .from('leads')
        .select('cpf, nome, banco, tipo_reprovacao, retorno_margem, retorno_simulacao', { count: 'exact' })
        .in('tipo_reprovacao', errosDaCategoria)
        .eq('status', 'reprovado')
        .limit(100);
      
      if (error) throw error;
      const totalLeads = count || (leads || []).length;
      const exibindo = (leads || []).length;
      setDialogData({ 
        titulo: `Leads - Categoria: ${data.name}`, 
        subtitulo: totalLeads > exibindo ? `${totalLeads.toLocaleString('pt-BR')} leads encontrados (exibindo ${exibindo})` : `${totalLeads.toLocaleString('pt-BR')} leads encontrados`, 
        leads: (leads || []) as LeadPorErro[]
      });
    } catch (err) {
      console.error('Erro ao buscar leads por categoria:', err);
      setDialogData({ titulo: `Leads - Categoria: ${data.name}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const categorizarErro = (tipoReprovacao: string | null): string => {
    if (!tipoReprovacao) return 'Não Categorizado';
    const texto = tipoReprovacao.toLowerCase();
    if (texto.includes('autorização') || texto.includes('autorizacao')) return 'Autorização';
    if (texto.includes('margem')) return 'Margem';
    if (texto.includes('6 meses') || texto.includes('vínculo') || texto.includes('vinculo') || texto.includes('tempo de atividade')) return 'Tempo de Vínculo';
    if (texto.includes('cbo') || texto.includes('ocupação') || texto.includes('ocupacao')) return 'CBO Bloqueado';
    if (texto.includes('timeout') || texto.includes('timed out') || texto.includes('curl error')) return 'Timeout/Conexão';
    if (texto.includes('email') || texto.includes('phone') || texto.includes('cpf') || texto.includes('nome') || texto.includes('validar')) return 'Validação de Dados';
    if (texto.includes('política') || texto.includes('politica') || texto.includes('elegível') || texto.includes('elegivel') || texto.includes('porte') || texto.includes('cnpj')) return 'Política/Elegibilidade';
    if (texto.includes('horário') || texto.includes('horario') || texto.includes('noturno')) return 'Horário';
    if (texto.includes('limite') || texto.includes('valor') || texto.includes('parcelas') || texto.includes('rate limit')) return 'Limite/Valor';
    if (texto.includes('idade')) return 'Idade';
    if (texto.includes('contrato') || texto.includes('afastamento')) return 'Contrato';
    if (texto.includes('servidor') || texto.includes('server') || texto.includes('interno')) return 'Sistema/Servidor';
    if (texto.includes('proposta') || texto.includes('operação') || texto.includes('operacao')) return 'Proposta';
    return 'Outros';
  };

  // Lista única de todos os tipos de erro disponíveis
  const tiposErroDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    errosAnalise.forEach(e => {
      if (e.tipo_erro && e.tipo_erro !== 'Não informado') {
        tipos.add(e.tipo_erro);
      }
    });
    return Array.from(tipos).sort();
  }, [errosAnalise]);

  // Função para extrair a grade/detalhamento de um erro (ex: meses de vínculo)
  const extrairGradeDoErro = (tipoErro: string): string => {
    const texto = tipoErro.toLowerCase();
    
    // Extrair meses para erros de tempo de vínculo
    const mesesMatch = texto.match(/(\d+)\s*m[eê]s/i);
    if (mesesMatch) {
      return `${mesesMatch[1]} mês(es)`;
    }
    
    // Extrair valores monetários
    const valorMatch = texto.match(/r\$\s*([\d.,]+)/i);
    if (valorMatch) {
      return `R$ ${valorMatch[1]}`;
    }
    
    // Extrair percentuais
    const percentMatch = texto.match(/(\d+(?:,\d+)?)\s*%/);
    if (percentMatch) {
      return `${percentMatch[1]}%`;
    }
    
    // Extrair idade
    const idadeMatch = texto.match(/(\d+)\s*anos?/i);
    if (idadeMatch) {
      return `${idadeMatch[1]} anos`;
    }
    
    // Retornar uma versão resumida do erro
    if (tipoErro.length > 30) {
      return tipoErro.substring(0, 30) + '...';
    }
    return tipoErro;
  };

  // Atualizar gráficos quando erros selecionados mudam
  useEffect(() => {
    if (errosSelecionados.length === 0) {
      setBancosDoErro([]);
      setGradeData([]);
      return;
    }

    // Calcular quantidade por banco para os erros selecionados
    const bancoMap = new Map<string, number>();
    const gradeMap = new Map<string, number>();

    errosAnalise
      .filter(e => errosSelecionados.includes(e.tipo_erro))
      .forEach(e => {
        // Agrupar por banco
        bancoMap.set(e.banco, (bancoMap.get(e.banco) || 0) + Number(e.quantidade));
        
        // Agrupar por grade/detalhamento
        const grade = extrairGradeDoErro(e.tipo_erro);
        gradeMap.set(grade, (gradeMap.get(grade) || 0) + Number(e.quantidade));
      });

    setBancosDoErro(
      Array.from(bancoMap.entries())
        .map(([banco, quantidade]) => ({ banco, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
    );

    setGradeData(
      Array.from(gradeMap.entries())
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
    );
  }, [errosSelecionados, errosAnalise]);

  const toggleErroSelecionado = (erro: string) => {
    setErrosSelecionados(prev => 
      prev.includes(erro) 
        ? prev.filter(e => e !== erro)
        : [...prev, erro]
    );
  };

  const limparErrosSelecionados = () => {
    setErrosSelecionados([]);
  };

  const handleDownloadAnaliseDetalhada = () => {
    if (errosSelecionados.length === 0) return;

    // Calcular dados por erro e banco
    const dadosPorErroEBanco: { tipoErro: string; quantidade: number; banco: string; percentual: string }[] = [];
    
    // Para cada erro selecionado, buscar a quantidade por banco
    errosSelecionados.forEach(erro => {
      const errosDoTipo = errosAnalise.filter(e => e.tipo_erro === erro);
      
      if (errosDoTipo.length === 0) {
        // Se não encontrar dados específicos, adiciona linha sem banco
        dadosPorErroEBanco.push({
          tipoErro: erro,
          quantidade: 0,
          banco: '-',
          percentual: '0%'
        });
      } else {
        // Calcular total para percentual
        const totalDoErro = errosDoTipo.reduce((sum, e) => sum + Number(e.quantidade), 0);
        
        // Adicionar uma linha para cada banco
        errosDoTipo.forEach(e => {
          const percent = totalDoErro > 0 ? ((Number(e.quantidade) / totalDoErro) * 100).toFixed(1) : '0';
          dadosPorErroEBanco.push({
            tipoErro: erro,
            quantidade: Number(e.quantidade),
            banco: e.banco,
            percentual: `${percent}%`
          });
        });
      }
    });

    // Cabeçalhos (usando ponto e vírgula como separador para Excel em português)
    let csvContent = 'TIPO DE ERROS;QUANTIDADE;BANCO;PERCENTUAL\n';
    
    // Preencher linhas
    dadosPorErroEBanco.forEach(item => {
      const tipoErro = item.tipoErro.replace(/;/g, ',');
      csvContent += `${tipoErro};${item.quantidade};${item.banco};${item.percentual}\n`;
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analise_detalhada_erros_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBancoErroClick = async (data: { banco: string; quantidade: number }) => {
    if (!data?.banco || errosSelecionados.length === 0) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads - ${data.banco}`, subtitulo: `Carregando...`, leads: [] });
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('cpf, nome, banco, tipo_reprovacao, retorno_margem, retorno_simulacao')
        .eq('banco', data.banco)
        .in('tipo_reprovacao', errosSelecionados)
        .eq('status', 'reprovado')
        .limit(100);
      
      if (error) throw error;
      setDialogData({ 
        titulo: `Leads - ${data.banco}`, 
        subtitulo: `${(leads || []).length} leads encontrados com os erros selecionados`, 
        leads: (leads || []) as LeadPorErro[]
      });
    } catch (err) {
      console.error('Erro ao buscar leads por banco:', err);
      setDialogData({ titulo: `Leads - ${data.banco}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleGradeClick = async (data: { name: string; value: number }) => {
    if (!data?.name || errosSelecionados.length === 0) return;
    setLoadingLeads(true);
    setDialogOpen(true);
    setDialogData({ titulo: `Leads - ${data.name}`, subtitulo: `Carregando...`, leads: [] });
    try {
      // Filtrar erros que correspondem a esta grade
      const errosComGrade = errosSelecionados.filter(erro => {
        const grade = extrairGradeDoErro(erro);
        return grade === data.name;
      });

      if (errosComGrade.length === 0) {
        setDialogData({ titulo: `Leads - ${data.name}`, subtitulo: `Nenhum erro encontrado`, leads: [] });
        setLoadingLeads(false);
        return;
      }

      const { data: leads, error } = await supabase
        .from('leads')
        .select('cpf, nome, banco, tipo_reprovacao, retorno_margem, retorno_simulacao')
        .in('tipo_reprovacao', errosComGrade)
        .eq('status', 'reprovado')
        .limit(100);
      
      if (error) throw error;
      setDialogData({ 
        titulo: `Leads - ${data.name}`, 
        subtitulo: `${(leads || []).length} leads encontrados`, 
        leads: (leads || []) as LeadPorErro[]
      });
    } catch (err) {
      console.error('Erro ao buscar leads por grade:', err);
      setDialogData({ titulo: `Leads - ${data.name}`, subtitulo: `Erro ao carregar leads`, leads: [] });
    } finally {
      setLoadingLeads(false);
    }
  };

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

  // Agrupar erros por categoria (apenas categorias com dados > 0 e excluindo "Não Categorizado" vazio)
  const errosPorCategoria = useMemo(() => {
    const grouped = new Map<string, number>();
    errosAnalise
      .filter(e => bancoSelecionado === "todos" || e.banco === bancoSelecionado)
      .filter(e => e.tipo_erro && e.tipo_erro !== 'Não informado') // Excluir erros sem tipo
      .forEach(e => {
        const categoria = e.categoria_erro || 'Outros';
        grouped.set(categoria, (grouped.get(categoria) || 0) + Number(e.quantidade));
      });
    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0 && item.name !== 'Não Categorizado') // Excluir "Não Categorizado"
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

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 bg-muted rounded mb-4"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Resultados das Consultas de Margem
          </h2>
          <p className="text-sm text-muted-foreground">
            Análise detalhada dos erros e resultados das consultas
          </p>
        </div>
        <Button onClick={handleDownloadReport} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Baixar Relatório
        </Button>
      </div>

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
            {errosPorBanco.map((banco) => (
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
            <div className="flex h-[350px]">
              {/* Gráfico à esquerda */}
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={errosPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data) => handlePieClick(data)}
                      style={{ cursor: 'pointer' }}
                    >
                      {errosPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [<span style={{ color: 'hsl(var(--foreground))' }}>{value.toLocaleString()}</span>, 'Quantidade']}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              {/* Legenda à direita */}
              <div className="w-[200px] flex flex-col justify-center pl-4 overflow-y-auto">
                {(() => {
                  const total = errosPorCategoria.reduce((sum, e) => sum + e.value, 0);
                  return errosPorCategoria
                    .map((item, index) => ({ ...item, originalIndex: index, percent: (item.value / total) * 100 }))
                    .filter(item => item.percent >= 0.1)
                    .map((item) => (
                      <div key={item.name} className="flex items-center gap-2 py-1">
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: COLORS[item.originalIndex % COLORS.length] }}
                        />
                        <span className="text-xs text-foreground truncate" title={`${item.name} (${item.percent.toFixed(0)}%)`}>
                          {item.name} ({item.percent.toFixed(0)}%)
                        </span>
                      </div>
                    ));
                })()}
              </div>
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
                  <Bar dataKey="quantidade" fill="#ef4444" radius={[0, 4, 4, 0]} onClick={(data) => handleBarClick(data)} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise Detalhada por Erro */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-500" />
              Análise Detalhada por Erro
            </div>
            <div className="flex items-center gap-2">
              {errosSelecionados.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={limparErrosSelecionados} className="gap-1 text-muted-foreground">
                    <X className="w-4 h-4" />
                    Limpar ({errosSelecionados.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadAnaliseDetalhada} className="gap-1">
                    <Download className="w-4 h-4" />
                    Baixar
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setErroFilterOpen(true)} className="gap-1">
                <Filter className="w-4 h-4" />
                Selecionar Erros
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Erros selecionados */}
          {errosSelecionados.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {errosSelecionados.map(erro => (
                <Badge key={erro} variant="secondary" className="gap-1 max-w-[300px]">
                  <span className="truncate">{erro.length > 40 ? erro.substring(0, 40) + '...' : erro}</span>
                  <X className="w-3 h-3 cursor-pointer" onClick={() => toggleErroSelecionado(erro)} />
                </Badge>
              ))}
            </div>
          )}

          {errosSelecionados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Selecione um ou mais erros para visualizar a análise detalhada</p>
              <Button variant="outline" size="sm" onClick={() => setErroFilterOpen(true)} className="mt-4 gap-1">
                <Filter className="w-4 h-4" />
                Selecionar Erros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Barras - Quantidade por Banco */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  Quantidade por Banco
                </h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bancosDoErro} layout="vertical" margin={{ left: 10, right: 30 }}>
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
                        formatter={(value: number) => [value.toLocaleString(), 'Quantidade']}
                      />
                      <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 4, 4, 0]} onClick={(data) => handleBancoErroClick(data)} style={{ cursor: 'pointer' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico de Pizza - Grade/Detalhamento */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-500" />
                  Detalhamento do Erro
                </h4>
                <div className="flex h-[300px]">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={gradeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data) => handleGradeClick(data)}
                          style={{ cursor: 'pointer' }}
                        >
                          {gradeData.map((entry, index) => (
                            <Cell key={`cell-grade-${index}`} fill={COLORS[index % COLORS.length]} style={{ cursor: 'pointer' }} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          formatter={(value: number) => [<span style={{ color: 'hsl(var(--foreground))' }}>{value.toLocaleString()}</span>, 'Quantidade']}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  {/* Legenda */}
                  <div className="w-[180px] flex flex-col justify-center pl-4 overflow-y-auto">
                    {(() => {
                      const total = gradeData.reduce((sum, e) => sum + e.value, 0);
                      return gradeData
                        .map((item, index) => ({ ...item, originalIndex: index, percent: (item.value / total) * 100 }))
                        .filter(item => item.percent >= 0.1)
                        .map((item) => (
                          <div key={item.name} className="flex items-center gap-2 py-1">
                            <div 
                              className="w-3 h-3 rounded-sm flex-shrink-0" 
                              style={{ backgroundColor: COLORS[item.originalIndex % COLORS.length] }}
                            />
                            <span className="text-xs text-foreground truncate" title={`${item.name} (${item.percent.toFixed(0)}%)`}>
                              {item.name} ({item.percent.toFixed(0)}%)
                            </span>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para selecionar erros */}
      <Dialog open={erroFilterOpen} onOpenChange={setErroFilterOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-500" />
              Selecionar Erros para Análise
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Selecione um ou mais erros para visualizar a análise detalhada por banco e grade.
            </p>
          </DialogHeader>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">
              {errosSelecionados.length} de {tiposErroDisponiveis.length} selecionados
            </span>
            {errosSelecionados.length > 0 && (
              <Button variant="ghost" size="sm" onClick={limparErrosSelecionados}>
                Limpar seleção
              </Button>
            )}
          </div>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2 py-2">
              {tiposErroDisponiveis.map(erro => (
                <div 
                  key={erro} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleErroSelecionado(erro)}
                >
                  <Checkbox 
                    checked={errosSelecionados.includes(erro)}
                    onCheckedChange={() => toggleErroSelecionado(erro)}
                  />
                  <span className="text-sm text-foreground flex-1">{erro}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setErroFilterOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setErroFilterOpen(false)}>
              Aplicar ({errosSelecionados.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Dialog para exibir leads por erro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
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
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogData.leads.map((item, index) => (
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
                Nenhum lead encontrado com este erro.
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
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-medium text-foreground mb-2">Informações Básicas</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Banco:</span>
                      <span className="ml-2 text-foreground">{selectedLead.banco}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo de Erro:</span>
                      <span className="ml-2 text-red-400">{selectedLead.tipo_reprovacao}</span>
                    </div>
                  </div>
                </div>

                {selectedLead.retorno_margem && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-2">Retorno de Margem</h4>
                    <pre className="text-xs text-muted-foreground overflow-auto max-h-[200px] bg-background p-2 rounded">
                      {JSON.stringify(selectedLead.retorno_margem, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLead.retorno_simulacao && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-medium text-foreground mb-2">Retorno de Simulação</h4>
                    <pre className="text-xs text-muted-foreground overflow-auto max-h-[200px] bg-background p-2 rounded">
                      {JSON.stringify(selectedLead.retorno_simulacao, null, 2)}
                    </pre>
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

export default ResultadosConsultasPanel;
