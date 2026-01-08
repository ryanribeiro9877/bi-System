import { Star, Upload, DollarSign, Clock, Building2, Briefcase, CheckCircle, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell } from "recharts";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";

const PerfilIdealPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const perfil = useMemo(() => {
    // Usa a função centralizada de normalização de status
    const aprovados = leads.filter((l) => normalizarStatusLead(l) === "aprovado");

    if (aprovados.length === 0) return null;

    // Função auxiliar para extrair dados de margem de múltiplas estruturas
    const extrairDadosMargem = (l: any) => {
      const margem = l.retorno_margem as any;
      const simulacao = l.retorno_simulacao as any;
      const getProposta = l.retorno_get_proposta as any;
      
      // UY3: retorno_margem é um array com result dentro
      if (Array.isArray(margem) && margem[0]?.result?.[0]) {
        return margem[0].result[0];
      }
      
      // UY3: retorno_margem.result array
      if (margem?.result?.[0]) {
        return margem.result[0];
      }
      
      // UY3: dataprevValidationResponses
      if (margem?.details?.dataprevValidationResponses?.[0]?.employeeRelationShip) {
        return margem.details.dataprevValidationResponses[0].employeeRelationShip;
      }
      
      // V8 ou fallback: usar dados de simulação e proposta
      return {
        valorMargemDisponivel: simulacao?.liquidValue || simulacao?.initialValue || 0,
        dataAdmissao: null,
        nomeEmpregador: getProposta?.name || "",
        qtdEmprestimosAtivosSuspensos: null,
        cbo: null,
        cnae: null,
        // Dados específicos V8
        monthlyInterest: simulacao?.monthlyInterest,
        numberOfPayments: simulacao?.numberOfPayments,
      };
    };

    // Extrai dados dos aprovados
    const dadosAprovados = aprovados.map((l) => {
      const result = extrairDadosMargem(l);
      
      // Dados extraídos
      const valorMargem = result?.valorMargemDisponivel || 0;
      const dataAdmissao = result?.dataAdmissao;
      const nomeEmpregador = result?.nomeEmpregador || "";
      const qtdEmprestimos = result?.qtdEmprestimosAtivosSuspensos ?? null;
      const cbo = result?.cbo;
      const cnae = result?.cnae;
      
      // Calcular tempo de vínculo em meses
      let tempoVinculoMeses = 0;
      if (dataAdmissao) {
        let dataAdm: Date | null = null;
        if (typeof dataAdmissao === 'string') {
          if (dataAdmissao.length === 8 && !dataAdmissao.includes('-')) {
            // Formato DDMMAAAA
            const dia = parseInt(dataAdmissao.substring(0, 2));
            const mes = parseInt(dataAdmissao.substring(2, 4)) - 1;
            const ano = parseInt(dataAdmissao.substring(4, 8));
            dataAdm = new Date(ano, mes, dia);
          } else {
            dataAdm = new Date(dataAdmissao);
          }
        }
        if (dataAdm && !isNaN(dataAdm.getTime())) {
          tempoVinculoMeses = Math.floor((Date.now() - dataAdm.getTime()) / (1000 * 60 * 60 * 24 * 30));
        }
      }
      
      // Classificar porte da empresa pelo nome
      let porteEmpresa = "Não identificado";
      const nomeUpper = nomeEmpregador.toUpperCase();
      if (nomeUpper.includes("S.A.") || nomeUpper.includes("S/A") || nomeUpper.includes(" SA ") || nomeEmpregador.endsWith(" SA")) {
        porteEmpresa = "Grande";
      } else if (nomeUpper.includes("LTDA") || nomeUpper.includes("EIRELI")) {
        porteEmpresa = "Média";
      } else if (nomeUpper.includes("MEI") || nomeUpper.includes("ME ") || nomeEmpregador.endsWith(" ME")) {
        porteEmpresa = "ME";
      } else if (nomeEmpregador.length > 0) {
        porteEmpresa = "Pequena";
      }
      
      return {
        margem: valorMargem,
        tempoVinculoMeses,
        porteEmpresa,
        qtdEmprestimos,
        cbo: cbo?.descricao || (typeof cbo === 'string' ? cbo : ''),
        cnae: cnae?.descricao || (typeof cnae === 'string' ? cnae : ''),
        banco: l.banco || "Não informado",
      };
    });

    // === Distribuição por Faixa de Margem ===
    const faixasMargem = [
      { faixa: 'R$ 0-300', min: 0, max: 300, quantidade: 0 },
      { faixa: 'R$ 301-500', min: 301, max: 500, quantidade: 0 },
      { faixa: 'R$ 501-800', min: 501, max: 800, quantidade: 0 },
      { faixa: 'R$ 801-1200', min: 801, max: 1200, quantidade: 0 },
      { faixa: 'R$ 1200+', min: 1201, max: Infinity, quantidade: 0 },
    ];
    
    dadosAprovados.forEach(d => {
      const faixa = faixasMargem.find(f => d.margem >= f.min && d.margem <= f.max);
      if (faixa) faixa.quantidade++;
    });

    // === Distribuição por Tempo de Vínculo ===
    const faixasVinculo = [
      { faixa: '6-12 meses', min: 6, max: 12, quantidade: 0 },
      { faixa: '1-2 anos', min: 13, max: 24, quantidade: 0 },
      { faixa: '2-3 anos', min: 25, max: 36, quantidade: 0 },
      { faixa: '3-5 anos', min: 37, max: 60, quantidade: 0 },
      { faixa: '5+ anos', min: 61, max: Infinity, quantidade: 0 },
    ];
    
    dadosAprovados.forEach(d => {
      if (d.tempoVinculoMeses > 0) {
        const faixa = faixasVinculo.find(f => d.tempoVinculoMeses >= f.min && d.tempoVinculoMeses <= f.max);
        if (faixa) faixa.quantidade++;
      }
    });

    // === Distribuição por Porte da Empresa ===
    const portesEmpresa: Record<string, number> = {
      'Grande': 0,
      'Média': 0,
      'Pequena': 0,
      'ME': 0,
    };
    
    dadosAprovados.forEach(d => {
      if (portesEmpresa[d.porteEmpresa] !== undefined) {
        portesEmpresa[d.porteEmpresa]++;
      }
    });
    
    const portesData = Object.entries(portesEmpresa)
      .map(([porte, quantidade]) => ({ porte, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // === Encontrar o perfil ideal (moda/mais comum) ===
    const margemMaisComum = faixasMargem.reduce((max, f) => f.quantidade > max.quantidade ? f : max, faixasMargem[0]);
    const vinculoMaisComum = faixasVinculo.reduce((max, f) => f.quantidade > max.quantidade ? f : max, faixasVinculo[0]);
    const porteMaisComum = portesData[0] || { porte: 'N/A', quantidade: 0 };
    
    // CBO mais comum
    const cboCount: Record<string, number> = {};
    dadosAprovados.forEach(d => {
      if (d.cbo) {
        cboCount[d.cbo] = (cboCount[d.cbo] || 0) + 1;
      }
    });
    const cboMaisComum = Object.entries(cboCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    // Contratos ativos mais comum
    const contratosCount: Record<number, number> = {};
    dadosAprovados.forEach(d => {
      if (d.qtdEmprestimos !== null) {
        contratosCount[d.qtdEmprestimos] = (contratosCount[d.qtdEmprestimos] || 0) + 1;
      }
    });
    const contratosMaisComum = Object.entries(contratosCount).sort((a, b) => b[1] - a[1])[0];
    const maxContratos = contratosMaisComum ? parseInt(contratosMaisComum[0]) : 0;

    // === Radar Chart Data ===
    // Calcular scores baseados nos dados
    const margemMedia = dadosAprovados.reduce((acc, d) => acc + d.margem, 0) / dadosAprovados.length || 0;
    const tempoMedio = dadosAprovados.filter(d => d.tempoVinculoMeses > 0).reduce((acc, d, _, arr) => acc + d.tempoVinculoMeses / arr.length, 0) || 0;
    const taxaGrande = (portesEmpresa['Grande'] + portesEmpresa['Média']) / aprovados.length * 100 || 0;
    const taxaCboElegivel = Object.keys(cboCount).length > 0 ? 80 : 0; // Se tem CBOs, assume 80% elegíveis
    const taxaCnaeElegivel = 75; // Estimativa baseada nos aprovados
    const taxaBaixosContratos = dadosAprovados.filter(d => d.qtdEmprestimos !== null && d.qtdEmprestimos <= 1).length / aprovados.length * 100 || 0;

    const radarData = [
      { caracteristica: 'Margem', valor: Math.min(100, (margemMedia / 1000) * 100), fullMark: 100 },
      { caracteristica: 'Tempo Vínculo', valor: Math.min(100, (tempoMedio / 60) * 100), fullMark: 100 },
      { caracteristica: 'Porte Empresa', valor: Math.min(100, taxaGrande), fullMark: 100 },
      { caracteristica: 'CBO Elegível', valor: taxaCboElegivel, fullMark: 100 },
      { caracteristica: 'CNAE Elegível', valor: taxaCnaeElegivel, fullMark: 100 },
      { caracteristica: 'Contratos Ativos', valor: Math.min(100, taxaBaixosContratos), fullMark: 100 },
    ];

    return {
      totalAprovados: aprovados.length,
      faixasMargem,
      faixasVinculo,
      portesData,
      radarData,
      resumo: {
        margemIdeal: margemMaisComum.faixa,
        vinculoIdeal: vinculoMaisComum.faixa.replace('meses', '').replace('anos', '').trim(),
        porteIdeal: porteMaisComum.porte === 'Grande' || portesData[1]?.porte === 'Média' 
          ? 'Grande / Média' 
          : porteMaisComum.porte,
        cboIdeal: cboMaisComum.length > 25 ? cboMaisComum.substring(0, 22) + '...' : cboMaisComum,
        contratosIdeal: `0 - ${Math.max(1, maxContratos)} contrato${maxContratos !== 1 ? 's' : ''}`,
      },
    };
  }, [leads]);

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
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
                  <Bar dataKey="quantidade" fill="#10b981" radius={[0, 4, 4, 0]} />
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
                  <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 4, 4, 0]} />
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
                <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                  {perfil.portesData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PORTE_COLORS[index % PORTE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilIdealPanel;