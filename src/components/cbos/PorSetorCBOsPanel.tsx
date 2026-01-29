import { Layers, Upload, DollarSign, Users, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { extrairValorMargemDisponivelLead } from "@/lib/leadStatusUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Definição dos setores com palavras-chave para classificação
const SETORES_CONFIG: Record<string, { nome: string; cor: string; palavras: string[] }> = {
  "comercio_vendas": {
    nome: "Comércio e Vendas",
    cor: "#8B5CF6",
    palavras: ["vendedor", "varejista", "atacadista", "balconista", "atendente de loja", "atendente de farmacia", "repositor", "operador de caixa", "frentista", "promotor de vendas", "demonstrador", "fiscal de loja", "mercado", "comercio"]
  },
  "limpeza_conservacao": {
    nome: "Limpeza e Conservação",
    cor: "#F59E0B",
    palavras: ["faxineiro", "zelador", "limpador", "manutencao predial", "manutencao de edificacoes", "auxiliar de manutencao", "garagista", "piscina"]
  },
  "alimentacao_gastronomia": {
    nome: "Alimentação e Gastronomia",
    cor: "#14B8A6",
    palavras: ["cozinheiro", "garcom", "copeiro", "barman", "barista", "lanchonete", "alimentacao", "cumim", "mordomo", "catering"]
  },
  "construcao_civil": {
    nome: "Construção Civil",
    cor: "#6366F1",
    palavras: ["pedreiro", "servente de obras", "calceteiro", "martelete", "pintor", "edificacoes", "estruturas metalicas"]
  },
  "seguranca_vigilancia": {
    nome: "Segurança e Vigilância",
    cor: "#EF4444",
    palavras: ["porteiro", "vigia", "fiscal", "vigilante"]
  },
  "logistica_transporte": {
    nome: "Logística e Transporte",
    cor: "#10B981",
    palavras: ["carregador", "estivador", "ajudante de motorista", "embalador", "aeronaves", "veiculos", "armazem"]
  },
  "telemarketing_atendimento": {
    nome: "Telemarketing e Atendimento",
    cor: "#3B82F6",
    palavras: ["telemarketing", "teleoperador", "telefonista", "teleatendimento", "operador de radio", "recepcionista", "atendente comercial"]
  },
  "servico_domestico": {
    nome: "Serviço Doméstico",
    cor: "#EC4899",
    palavras: ["domestico", "domestica", "arrumador", "residencia"]
  },
  "frigorifico_abate": {
    nome: "Frigorífico e Abate",
    cor: "#DC2626",
    palavras: ["acougueiro", "magarefe", "abatedor", "desossador", "retalhador", "carne"]
  },
  "hotelaria_hospedagem": {
    nome: "Hotelaria e Hospedagem",
    cor: "#A855F7",
    palavras: ["camareiro", "camareira", "hotel", "governanta", "recepcionista de hotel", "porteiro de hotel", "concierge", "embarcacoes"]
  },
  "saude_cuidados": {
    nome: "Saúde e Cuidados",
    cor: "#F97316",
    palavras: ["enfermagem", "cuidador", "saude", "hospital", "visitador sanitario", "agente comunitario", "baba", "idosos"]
  },
  "agropecuaria": {
    nome: "Agropecuária",
    cor: "#22C55E",
    palavras: ["pecuaria", "bovinos", "avicultura", "agricola", "agropecuaria", "incubadora", "corte", "leite", "postura"]
  },
  "mineracao": {
    nome: "Mineração",
    cor: "#78716C",
    palavras: ["mineiro", "minerio", "pedra", "canteiro", "amostrador"]
  },
  "outros": {
    nome: "Outros",
    cor: "#64748B",
    palavras: []
  }
};

function classificarCBOPorSetor(descricao: string): string {
  if (!descricao) return "outros";
  const descLower = descricao.toLowerCase();
  
  for (const [setorKey, config] of Object.entries(SETORES_CONFIG)) {
    if (setorKey === "outros") continue;
    for (const palavra of config.palavras) {
      if (descLower.includes(palavra)) {
        return setorKey;
      }
    }
  }
  return "outros";
}

interface CBOBloqueadoInfo {
  codigo: string;
  descricao: string;
  totalLeads: number;
  margemTotal: number;
  margemMedia: number;
  setor: string;
}

interface SetorAgrupado {
  setor: string;
  setorNome: string;
  cor: string;
  totalLeads: number;
  totalCBOs: number;
  margemTotal: number;
  margemMedia: number;
  cbos: CBOBloqueadoInfo[];
}

const PorSetorCBOsPanel = () => {
  const navigate = useNavigate();
  const { stats, leads } = useDashboard();
  const [expandedSetores, setExpandedSetores] = useState<Set<string>>(new Set());

  // Extrair CBOs bloqueados com margem diretamente dos leads
  const cbosBloqueadosComMargem = useMemo(() => {
    const cboMap = new Map<string, CBOBloqueadoInfo>();
    
    leads.forEach(lead => {
      const margemTexto = lead.retorno_margem;
      if (!margemTexto) return;
      
      const texto = typeof margemTexto === 'string' ? margemTexto : JSON.stringify(margemTexto);
      
      // Verificar se é CBO bloqueado
      const cboBloqueadoMatch = texto.match(/CBO bloqueado[:\s]+(\d{6})\s*[-–]\s*([^,\.\n"\\]+)/i);
      if (!cboBloqueadoMatch) return;
      
      const codigo = cboBloqueadoMatch[1];
      const descricao = cboBloqueadoMatch[2].trim();
      
      // Extrair margem disponível
      const margem = extrairValorMargemDisponivelLead(lead) || 0;
      
      const key = codigo;
      if (cboMap.has(key)) {
        const existing = cboMap.get(key)!;
        existing.totalLeads += 1;
        existing.margemTotal += margem;
      } else {
        cboMap.set(key, {
          codigo,
          descricao,
          totalLeads: 1,
          margemTotal: margem,
          margemMedia: 0,
          setor: classificarCBOPorSetor(descricao)
        });
      }
    });
    
    // Calcular margem média
    cboMap.forEach(cbo => {
      cbo.margemMedia = cbo.totalLeads > 0 ? cbo.margemTotal / cbo.totalLeads : 0;
    });
    
    return Array.from(cboMap.values()).sort((a, b) => b.totalLeads - a.totalLeads);
  }, [leads]);

  // Agrupar por setor
  const setoresAgrupados = useMemo((): SetorAgrupado[] => {
    const setorMap = new Map<string, SetorAgrupado>();
    
    cbosBloqueadosComMargem.forEach(cbo => {
      const setorKey = cbo.setor;
      const setorConfig = SETORES_CONFIG[setorKey] || SETORES_CONFIG.outros;
      
      if (!setorMap.has(setorKey)) {
        setorMap.set(setorKey, {
          setor: setorKey,
          setorNome: setorConfig.nome,
          cor: setorConfig.cor,
          totalLeads: 0,
          totalCBOs: 0,
          margemTotal: 0,
          margemMedia: 0,
          cbos: []
        });
      }
      
      const setor = setorMap.get(setorKey)!;
      setor.totalLeads += cbo.totalLeads;
      setor.totalCBOs += 1;
      setor.margemTotal += cbo.margemTotal;
      setor.cbos.push(cbo);
    });
    
    // Calcular margem média e ordenar CBOs dentro de cada setor
    setorMap.forEach(setor => {
      setor.margemMedia = setor.totalLeads > 0 ? setor.margemTotal / setor.totalLeads : 0;
      setor.cbos.sort((a, b) => b.totalLeads - a.totalLeads);
    });
    
    return Array.from(setorMap.values()).sort((a, b) => b.totalLeads - a.totalLeads);
  }, [cbosBloqueadosComMargem]);

  const totalLeadsAfetados = useMemo(() => {
    return setoresAgrupados.reduce((acc, setor) => acc + setor.totalLeads, 0);
  }, [setoresAgrupados]);

  const totalMargemPerdida = useMemo(() => {
    return setoresAgrupados.reduce((acc, setor) => acc + setor.margemTotal, 0);
  }, [setoresAgrupados]);

  const totalCBOs = useMemo(() => {
    return setoresAgrupados.reduce((acc, setor) => acc + setor.totalCBOs, 0);
  }, [setoresAgrupados]);

  const toggleSetor = (setorKey: string) => {
    setExpandedSetores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setorKey)) {
        newSet.delete(setorKey);
      } else {
        newSet.add(setorKey);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">CBOs por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum setor identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar CBOs por setor.
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

  if (cbosBloqueadosComMargem.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-purple-400" />
            CBOs por Setor de Atuação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum CBO bloqueado encontrado
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Os leads importados não possuem CBOs bloqueados ou as informações de bloqueio não estão disponíveis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Dados para gráfico de pizza
  const chartData = setoresAgrupados.map(setor => ({
    name: setor.setorNome,
    value: setor.totalLeads,
    color: setor.cor,
  }));

  // Dados para gráfico de barras (margem por setor)
  const barChartData = setoresAgrupados.slice(0, 8).map(setor => ({
    name: setor.setorNome.length > 15 ? setor.setorNome.substring(0, 12) + "..." : setor.setorNome,
    leads: setor.totalLeads,
    margem: setor.margemTotal,
    margemMedia: setor.margemMedia,
    cor: setor.cor,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} leads ({((data.value / totalLeadsAfetados) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPIs do Setor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-purple-950/50 to-purple-900/30 border-l-4 border-l-purple-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Setores</p>
                <p className="text-2xl font-bold text-purple-400">{setoresAgrupados.length}</p>
              </div>
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-950/50 to-red-900/30 border-l-4 border-l-red-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">CBOs Bloqueados</p>
                <p className="text-2xl font-bold text-red-400">{totalCBOs}</p>
              </div>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-950/50 to-orange-900/30 border-l-4 border-l-orange-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Leads Afetados</p>
                <p className="text-2xl font-bold text-orange-400">{totalLeadsAfetados.toLocaleString("pt-BR")}</p>
              </div>
              <Users className="w-5 h-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-950/50 to-amber-900/30 border-l-4 border-l-amber-500 border-t-0 border-r-0 border-b-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Margem Perdida</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(totalMargemPerdida)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos lado a lado */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="w-4 h-4 text-purple-400" />
              Distribuição por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Margem por Setor */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Margem Perdida por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela resumo por setor */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resumo por Setor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de CBOs bloqueados por área de atuação
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/30">
                  <TableHead className="text-muted-foreground text-center">Setor</TableHead>
                  <TableHead className="text-muted-foreground text-center">CBOs</TableHead>
                  <TableHead className="text-muted-foreground text-center">Leads</TableHead>
                  <TableHead className="text-muted-foreground text-center">Margem Total</TableHead>
                  <TableHead className="text-muted-foreground text-center">Margem Média</TableHead>
                  <TableHead className="text-muted-foreground text-center">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setoresAgrupados.map((setor) => (
                  <TableRow key={setor.setor} className="border-border hover:bg-muted/20">
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: setor.cor }}
                        />
                        <span className="font-medium text-foreground">{setor.setorNome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {setor.totalCBOs}
                    </TableCell>
                    <TableCell className="text-center font-medium text-foreground">
                      {setor.totalLeads.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-center text-amber-400 font-medium">
                      {formatCurrency(setor.margemTotal)}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatCurrency(setor.margemMedia)}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {((setor.totalLeads / totalLeadsAfetados) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {/* Linha de total */}
                <TableRow className="border-border bg-muted/50 font-bold">
                  <TableCell className="text-center text-foreground">TOTAL</TableCell>
                  <TableCell className="text-center text-foreground">{totalCBOs}</TableCell>
                  <TableCell className="text-center text-foreground">{totalLeadsAfetados.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-center text-amber-400">{formatCurrency(totalMargemPerdida)}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatCurrency(totalMargemPerdida / totalLeadsAfetados)}
                  </TableCell>
                  <TableCell className="text-center text-foreground">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento por setor com CBOs */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Detalhamento de CBOs por Setor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clique em um setor para expandir a lista de CBOs
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {setoresAgrupados.map((setor) => (
            <Collapsible
              key={setor.setor}
              open={expandedSetores.has(setor.setor)}
              onOpenChange={() => toggleSetor(setor.setor)}
            >
              <CollapsibleTrigger asChild>
                <div className="w-full p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: setor.cor }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{setor.setorNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {setor.totalCBOs} CBOs • {setor.totalLeads} leads • Margem: {formatCurrency(setor.margemTotal)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-background">
                        {((setor.totalLeads / totalLeadsAfetados) * 100).toFixed(1)}%
                      </Badge>
                      {expandedSetores.has(setor.setor) ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 ml-7 rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border bg-muted/20">
                        <TableHead className="text-muted-foreground text-center text-xs">Código</TableHead>
                        <TableHead className="text-muted-foreground text-center text-xs">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-center text-xs">Leads</TableHead>
                        <TableHead className="text-muted-foreground text-center text-xs">Margem Total</TableHead>
                        <TableHead className="text-muted-foreground text-center text-xs">Margem Média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {setor.cbos.map((cbo) => (
                        <TableRow key={cbo.codigo} className="border-border">
                          <TableCell className="text-center font-mono text-xs text-foreground">
                            {cbo.codigo}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground max-w-[200px] truncate" title={cbo.descricao}>
                            {cbo.descricao}
                          </TableCell>
                          <TableCell className="text-center text-xs font-medium text-foreground">
                            {cbo.totalLeads}
                          </TableCell>
                          <TableCell className="text-center text-xs text-amber-400">
                            {formatCurrency(cbo.margemTotal)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatCurrency(cbo.margemMedia)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PorSetorCBOsPanel;
