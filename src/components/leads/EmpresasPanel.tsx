import { Building2, Upload, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { extrairEmpresa, extrairTodosDados, formatarCNPJ } from "@/lib/leadDataExtractor";

const EmpresasPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const empresas = useMemo(() => {
    const map: Record<string, { cnpj: string; razaoSocial: string; aprovados: number; reprovados: number; total: number }> = {};

    leads.forEach((lead) => {
      const empresa = extrairEmpresa(lead);
      if (!empresa || (!empresa.cnpj && !empresa.razaoSocial)) return;

      const key = empresa.cnpj || empresa.razaoSocial;
      if (!map[key]) {
        map[key] = { cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial, aprovados: 0, reprovados: 0, total: 0 };
      }
      map[key].total++;
      
      // Atualiza razão social se ainda não tinha
      if (!map[key].razaoSocial && empresa.razaoSocial) {
        map[key].razaoSocial = empresa.razaoSocial;
      }
      
      const dados = extrairTodosDados(lead);
      if (dados.statusNormalizado === "aprovado") map[key].aprovados++;
      if (dados.statusNormalizado === "reprovado") map[key].reprovados++;
    });

    return Object.values(map)
      .map((e) => ({ ...e, taxaAprovacao: e.total > 0 ? Math.round((e.aprovados / e.total) * 100) : 0 }))
      .sort((a, b) => b.aprovados - a.aprovados || b.taxaAprovacao - a.taxaAprovacao)
      .slice(0, 30);
  }, [leads]);

  // Top 10 para gráfico
  const chartData = empresas.slice(0, 10).map(e => ({
    name: e.razaoSocial ? (e.razaoSocial.length > 20 ? e.razaoSocial.substring(0, 17) + "..." : e.razaoSocial) : formatarCNPJ(e.cnpj).substring(0, 10),
    aprovados: e.aprovados,
    total: e.total,
  }));

  if (stats.totalLeads === 0) {
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

  if (empresas.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            Top Empresas com Maior Aprovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            Dados de empresa (CNPJ) não estão disponíveis nos leads importados.
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
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Top 10 Empresas por Aprovações
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Empregadores com mais leads aprovados
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
                  width={150}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [
                    `${value} ${name === 'aprovados' ? 'aprovados' : 'total'}`,
                    name === 'aprovados' ? 'Aprovados' : 'Total'
                  ]}
                />
                <Bar dataKey="aprovados" fill="#3b82f6" radius={[0, 4, 4, 0]} name="aprovados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            Detalhamento por Empresa
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Empregadores com melhores taxas de aprovação
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">% Aprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((e) => (
                  <TableRow key={e.cnpj || e.razaoSocial}>
                    <TableCell className="text-muted-foreground font-mono">{e.cnpj ? formatarCNPJ(e.cnpj) : "-"}</TableCell>
                    <TableCell className="text-foreground truncate max-w-[200px]">{e.razaoSocial || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{e.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{e.aprovados}</TableCell>
                    <TableCell className="text-right text-emerald-400">{e.taxaAprovacao}%</TableCell>
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

export default EmpresasPanel;
