import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";

// Extrai dados da empresa do lead de múltiplas fontes
const extrairEmpresa = (lead: any): { cnpj: string; razaoSocial: string } | null => {
  const margem = lead.retorno_margem as any;
  
  // 1. Verifica retorno_margem.details.dataprevValidationResponses[0].employeeRelationShip
  const empRel = margem?.details?.dataprevValidationResponses?.[0]?.employeeRelationShip;
  if (empRel) {
    const cnpj = empRel.numeroInscricaoEmpregador || "";
    const razao = empRel.nomeEmpregador || "";
    if (cnpj || razao) {
      return { cnpj, razaoSocial: razao };
    }
  }
  
  // 2. Verifica retorno_margem.cnpjEmpregador
  if (margem?.cnpjEmpregador) {
    return { 
      cnpj: margem.cnpjEmpregador, 
      razaoSocial: margem?.nomeEmpregador || margem?.registroEmpregaticio?.razaoSocial || "" 
    };
  }
  
  return null;
};

// Formata CNPJ
const formatCnpj = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

// Agrupa estatísticas por empresa
const EmpresasPanel = () => {
  const navigate = useNavigate();
  const { leads, stats } = useDashboard();

  const empresas = useMemo(() => {
    const map: Record<string, { cnpj: string; razaoSocial: string; aprovados: number; reprovados: number; total: number }> = {};

    leads.forEach((lead) => {
      const empresa = extrairEmpresa(lead);
      if (!empresa || !empresa.cnpj) return;

      const key = empresa.cnpj;
      if (!map[key]) {
        map[key] = { cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial, aprovados: 0, reprovados: 0, total: 0 };
      }
      map[key].total++;
      
      // Atualiza razão social se ainda não tinha
      if (!map[key].razaoSocial && empresa.razaoSocial) {
        map[key].razaoSocial = empresa.razaoSocial;
      }
      
      const status = normalizarStatusLead(lead);
      if (status === "aprovado") map[key].aprovados++;
      if (status === "reprovado") map[key].reprovados++;
    });

    return Object.values(map)
      .map((e) => ({ ...e, taxaAprovacao: e.total > 0 ? Math.round((e.aprovados / e.total) * 100) : 0 }))
      .sort((a, b) => b.aprovados - a.aprovados || b.taxaAprovacao - a.taxaAprovacao)
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
                  <TableCell className="text-muted-foreground font-mono">{formatCnpj(e.cnpj)}</TableCell>
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
  );
};

export default EmpresasPanel;
