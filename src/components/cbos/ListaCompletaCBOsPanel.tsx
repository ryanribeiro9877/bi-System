import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ban, Search, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ListaCompletaCBOsPanel = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { stats } = useDashboard();

  // Usar CBOs bloqueados extraídos das mensagens de erro
  const cboList = stats.cbosBloqueados;
  const totalBloqueados = stats.totalCBOsBloqueados;

  const filtered = useMemo(() => {
    if (!search) return cboList;
    const s = search.toLowerCase();
    return cboList.filter((c) => 
      c.code.toLowerCase().includes(s) || 
      (c.name && c.name.toLowerCase().includes(s))
    );
  }, [cboList, search]);

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ban className="w-5 h-5 text-red-400" />
              Lista Completa de CBOs Bloqueados
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Ban className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO bloqueado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar CBOs bloqueados.
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

  if (cboList.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="w-5 h-5 text-red-400" />
            Lista Completa de CBOs Bloqueados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Ban className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO bloqueado identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Não foram encontradas mensagens de erro com o padrão "CBO bloqueado" nos leads importados.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ban className="w-5 h-5 text-red-400" />
              Lista Completa de CBOs Bloqueados
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              CBOs identificados nas mensagens de erro
            </p>
          </div>
          <Badge variant="secondary">{cboList.length} CBOs bloqueados</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <Button variant="outline" className="gap-2" disabled>
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum CBO encontrado para a busca.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Leads Bloqueados</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="text-foreground font-mono">{c.code}</TableCell>
                    <TableCell className="text-foreground">{c.name || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.quantidade.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-foreground">
                      {totalBloqueados > 0 ? ((c.quantidade / totalBloqueados) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ListaCompletaCBOsPanel;