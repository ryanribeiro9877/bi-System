import { Briefcase, Upload, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { extrairCBO, extrairTodosDados } from "@/lib/leadDataExtractor";

const CBOsQueAprovamPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const cbosAprovam = useMemo(() => {
    const map: Record<string, { codigo: string; descricao: string; aprovados: number; reprovados: number; total: number }> = {};

    leads.forEach((lead) => {
      const cboInfo = extrairCBO(lead);
      if (!cboInfo || (!cboInfo.codigo && !cboInfo.descricao)) return;

      const key = cboInfo.codigo || cboInfo.descricao;
      if (!map[key]) {
        map[key] = { codigo: cboInfo.codigo, descricao: cboInfo.descricao, aprovados: 0, reprovados: 0, total: 0 };
      }
      map[key].total++;
      
      const dados = extrairTodosDados(lead);
      if (dados.statusNormalizado === "aprovado") map[key].aprovados++;
      if (dados.statusNormalizado === "reprovado") map[key].reprovados++;
    });

    return Object.values(map)
      .map((c) => ({ ...c, taxaAprovacao: c.total > 0 ? Math.round((c.aprovados / c.total) * 100) : 0 }))
      .filter((c) => c.aprovados > 0)
      .sort((a, b) => b.taxaAprovacao - a.taxaAprovacao || b.aprovados - a.aprovados)
      .slice(0, 20);
  }, [leads]);

  // Top 10 para gráfico
  const chartData = cbosAprovam.slice(0, 10).map(c => ({
    name: c.descricao.length > 25 ? c.descricao.substring(0, 22) + "..." : c.descricao,
    aprovados: c.aprovados,
    taxa: c.taxaAprovacao,
  }));

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

  if (cbosAprovam.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Top 20 CBOs com Maior Aprovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Nenhum CBO com aprovações encontrado nos leads importados.
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
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Top 10 CBOs por Aprovações
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações com mais leads aprovados
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fill: '#9ca3af', fontSize: 10 }} 
                  width={180}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [
                    name === 'aprovados' ? `${value} aprovados` : `${value}%`,
                    name === 'aprovados' ? 'Quantidade' : 'Taxa'
                  ]}
                />
                <Bar dataKey="aprovados" fill="#10b981" radius={[0, 4, 4, 0]} name="aprovados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Detalhamento por CBO
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações com melhores taxas de aprovação
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">% Aprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cbosAprovam.map((c) => (
                  <TableRow key={c.codigo || c.descricao}>
                    <TableCell className="text-muted-foreground font-mono">{c.codigo || "-"}</TableCell>
                    <TableCell className="text-foreground">{c.descricao || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.aprovados}</TableCell>
                    <TableCell className="text-right text-emerald-400">{c.taxaAprovacao}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsQueAprovamPanel;
