import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Lead {
  cpf: string;
  nome: string;
  empregador: string;
  cbo: string;
  margem: string;
  status: "Aprovado" | "Reprovado" | "Pendente";
  data: string;
}

const mockLeads: Lead[] = [
  { cpf: "002.148.783-92", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.118.800-94", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.138.993-45", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.122.500-19", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.117.735-06", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.112.970-38", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.138.682-02", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.124.465-09", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.120.940-50", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
  { cpf: "002.146.495-20", nome: "-", empregador: "-", cbo: "-", margem: "R$ 0,00", status: "Reprovado", data: "02/01/2026, 20:41" },
];

const LeadsPanel = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalLeads = 1399;
  const leadsPerPage = 10;
  const totalPages = Math.ceil(totalLeads / leadsPerPage);

  const getStatusBadge = (status: Lead["status"]) => {
    const variants = {
      Aprovado: "bg-success/20 text-success border-success/30",
      Reprovado: "bg-destructive/20 text-destructive border-destructive/30",
      Pendente: "bg-warning/20 text-warning border-warning/30",
    };

    return (
      <Badge variant="outline" className={`${variants[status]} font-medium`}>
        ⊘ {status}
      </Badge>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">
          Leads ({totalLeads.toLocaleString()})
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Página <span className="text-primary">{currentPage}</span> de {totalPages}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">CPF</TableHead>
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Empregador</TableHead>
                <TableHead className="text-muted-foreground">CBO</TableHead>
                <TableHead className="text-muted-foreground">Margem</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Data</TableHead>
                <TableHead className="text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeads.map((lead, index) => (
                <TableRow key={index} className="border-border/50 hover:bg-muted/30">
                  <TableCell className="font-mono text-foreground">{lead.cpf}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.empregador}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.cbo}</TableCell>
                  <TableCell className="text-foreground">{lead.margem}</TableCell>
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.data}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * leadsPerPage + 1} a {Math.min(currentPage * leadsPerPage, totalLeads)} de {totalLeads.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadsPanel;
