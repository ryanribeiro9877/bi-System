import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";

// Extrai CNPJ/Razão Social e agrupa estatísticas
const EmpresasPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  // Agrupa por CNPJ do empregador (retorno_margem.cnpjEmpregador)
  const empresas = useMemo(() => {
    const map: Record<string, { cnpj: string; razao: string; aprovados: number; reprovados: number; total: number }> = {};

    leads.forEach((lead) => {
      const margem = lead.retorno_margem as any;
      const cnpj = margem?.cnpjEmpregador || margem?.registroEmpregaticio?.cnpjEmpregador || "";
      const razao = margem?.registroEmpregaticio?.razaoSocial || margem?.razaoSocial || "";

      if (!cnpj) return;

      const key = cnpj;
      if (!map[key]) {
        map[key] = { cnpj, razao, aprovados: 0, reprovados: 0, total: 0 };
      }
      map[key].total++;
      const status = lead.status?.toLowerCase();
      if (status === "aprovado") map[key].aprovados++;
      if (status === "reprovado") map[key].reprovados++;
    });

    return Object.values(map)
      .map((e) => ({ ...e, taxaAprovacao: e.total > 0 ? Math.round((e.aprovados / e.total) * 100) : 0 }))
      .sort((a, b) => b.aprovados - a.aprovados)
      .slice(0, 30);
  }, [leads]);

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
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-blue-400" />
          Top Empresas com Maior Aprovação
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
                <TableRow key={e.cnpj}>
                  <TableCell className="text-muted-foreground">{e.cnpj}</TableCell>
                  <TableCell className="text-foreground truncate max-w-[200px]">{e.razao || "-"}</TableCell>
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
  );
};

export default EmpresasPanel;
