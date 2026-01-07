import { Briefcase, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";

// Identifica CBOs com melhor taxa de aprovação
const CBOsQueAprovamPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const cbosAprovam = useMemo(() => {
    const map: Record<string, { cbo: string; aprovados: number; reprovados: number; total: number }> = {};

    leads.forEach((lead) => {
      const cbo = lead.cbo;
      if (!cbo) return;

      if (!map[cbo]) {
        map[cbo] = { cbo, aprovados: 0, reprovados: 0, total: 0 };
      }
      map[cbo].total++;
      const status = lead.status?.toLowerCase();
      if (status === "aprovado") map[cbo].aprovados++;
      if (status === "reprovado") map[cbo].reprovados++;
    });

    return Object.values(map)
      .map((c) => ({ ...c, taxaAprovacao: c.total > 0 ? Math.round((c.aprovados / c.total) * 100) : 0 }))
      .filter((c) => c.aprovados > 0)
      .sort((a, b) => b.taxaAprovacao - a.taxaAprovacao || b.aprovados - a.aprovados)
      .slice(0, 20);
  }, [leads]);

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
            Top 10 CBOs com Maior Aprovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            O campo CBO não está preenchido nos leads importados.
            Adicione a coluna CBO na planilha de importação.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="w-5 h-5 text-emerald-400" />
          Top CBOs com Maior Aprovação
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
                <TableHead>CBO</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aprovados</TableHead>
                <TableHead className="text-right">% Aprovação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cbosAprovam.map((c) => (
                <TableRow key={c.cbo}>
                  <TableCell className="text-foreground">{c.cbo}</TableCell>
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
  );
};

export default CBOsQueAprovamPanel;
