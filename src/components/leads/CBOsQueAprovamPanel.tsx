import { Briefcase, Upload, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";

interface CBOsQueAprovamPanelProps {
  bancoFilter?: string;
}

const CBOsQueAprovamPanel = ({ bancoFilter = "todos" }: CBOsQueAprovamPanelProps) => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  // Filtra leads por banco se necessário
  const leadsFiltrados = useMemo(() => {
    if (bancoFilter === "todos") return leads;
    return leads.filter((l) => (l.banco || "Não Informado") === bancoFilter);
  }, [leads, bancoFilter]);

  const top10CBOs = useMemo(() => {
    // Filtra apenas leads aprovados (do banco filtrado ou todos)
    const aprovados = leadsFiltrados.filter(
      (l) => normalizarStatusLead(l) === "aprovado"
    );

    // Extrai CBO de cada lead aprovado
    const cboCount: Record<string, { codigo: string; descricao: string; quantidade: number }> = {};

    aprovados.forEach((lead) => {
      const margem = lead.retorno_margem as any;
      
      // UY3: retorno_margem é um array com result dentro
      let cbo = null;
      if (Array.isArray(margem) && margem[0]?.result?.[0]?.cbo) {
        cbo = margem[0].result[0].cbo;
      } else if (margem?.result?.[0]?.cbo) {
        cbo = margem.result[0].cbo;
      } else if (margem?.details?.dataprevValidationResponses?.[0]?.employeeRelationShip?.cbo) {
        cbo = margem.details.dataprevValidationResponses[0].employeeRelationShip.cbo;
      }

      if (cbo) {
        const codigo = cbo.codigo?.toString() || "";
        const descricao = cbo.descricao || codigo;
        const key = codigo || descricao;
        
        if (!cboCount[key]) {
          cboCount[key] = { codigo, descricao, quantidade: 0 };
        }
        cboCount[key].quantidade++;
      }
    });

    // Ordena por quantidade e pega top 10
    return Object.values(cboCount)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        // Trunca nome para exibição no gráfico
        nomeExibicao: item.descricao.length > 25 
          ? item.descricao.substring(0, 22) + "..." 
          : item.descricao,
        rank: index + 1,
      }));
  }, [leadsFiltrados]);

  const totalAprovados = useMemo(() => {
    return leadsFiltrados.filter(
      (l) => normalizarStatusLead(l) === "aprovado"
    ).length;
  }, [leadsFiltrados]);

  const COLORS = [
    "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5",
    "#059669", "#047857", "#065f46", "#064e3b", "#022c22"
  ];

  if (stats.totalLeads === 0) {
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Top 10 CBOs que Aprovam
          </CardTitle>
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
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]}>
                  {top10CBOs.map((entry, index) => (
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
            <Briefcase className="w-4 h-4 text-emerald-400" />
            Detalhamento dos CBOs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {top10CBOs.map((cbo, index) => (
              <div 
                key={cbo.codigo || cbo.descricao}
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
                    <p className="font-medium text-foreground text-sm">{cbo.descricao}</p>
                    {cbo.codigo && (
                      <p className="text-xs text-muted-foreground">Código: {cbo.codigo}</p>
                    )}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {cbo.quantidade} aprovações
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsQueAprovamPanel;
