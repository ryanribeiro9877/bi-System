import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ban, Search, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const cbosData = [
  { 
    codigo: "717020", 
    descricao: "Servente de Obras", 
    setor: "Construção Civil", 
    leadsAfetados: 245, 
    margemPerdida: 125000, 
    bancos: ["UY3", "Presença", "V8"] 
  },
  { 
    codigo: "521105", 
    descricao: "Vendedor em Comércio Atacadista", 
    setor: "Comércio", 
    leadsAfetados: 189, 
    margemPerdida: 98500, 
    bancos: ["UY3", "Presença"] 
  },
  { 
    codigo: "513435", 
    descricao: "Atendente de Lanchonete", 
    setor: "Alimentação", 
    leadsAfetados: 156, 
    margemPerdida: 72000, 
    bancos: ["UY3", "Presença", "V8"] 
  },
  { 
    codigo: "514320", 
    descricao: "Faxineiro", 
    setor: "Serviços Gerais", 
    leadsAfetados: 134, 
    margemPerdida: 65000, 
    bancos: ["UY3", "V8"] 
  },
  { 
    codigo: "422105", 
    descricao: "Recepcionista em Geral", 
    setor: "Administrativo", 
    leadsAfetados: 98, 
    margemPerdida: 48000, 
    bancos: ["Presença"] 
  },
  { 
    codigo: "784205", 
    descricao: "Alimentador de Linha de Produção", 
    setor: "Indústria", 
    leadsAfetados: 87, 
    margemPerdida: 42000, 
    bancos: ["UY3"] 
  },
  { 
    codigo: "782510", 
    descricao: "Motorista de Caminhão", 
    setor: "Transporte", 
    leadsAfetados: 76, 
    margemPerdida: 38000, 
    bancos: ["V8"] 
  },
  { 
    codigo: "411010", 
    descricao: "Auxiliar de Escritório", 
    setor: "Administrativo", 
    leadsAfetados: 65, 
    margemPerdida: 32000, 
    bancos: ["Presença", "V8"] 
  },
];

const getBancoColor = (banco: string) => {
  const colors: Record<string, string> = {
    "UY3": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Presença": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "V8": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  };
  return colors[banco] || "bg-muted text-muted-foreground";
};

const ListaCompletaCBOsPanel = () => {
  const [search, setSearch] = useState("");

  const filteredData = cbosData.filter(
    (cbo) =>
      cbo.codigo.includes(search) ||
      cbo.descricao.toLowerCase().includes(search.toLowerCase())
  );

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
              Todas as ocupações que bloqueiam aprovações nos bancos
            </p>
          </div>
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            {cbosData.length} CBOs
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todos os bancos</option>
            <option value="uy3">UY3</option>
            <option value="presenca">Presença</option>
            <option value="v8">V8</option>
          </select>
          <select className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todos os setores</option>
            <option value="construcao">Construção Civil</option>
            <option value="comercio">Comércio</option>
            <option value="alimentacao">Alimentação</option>
            <option value="servicos">Serviços Gerais</option>
            <option value="administrativo">Administrativo</option>
            <option value="industria">Indústria</option>
            <option value="transporte">Transporte</option>
          </select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Código</TableHead>
                <TableHead className="text-muted-foreground">Descrição</TableHead>
                <TableHead className="text-muted-foreground">Setor</TableHead>
                <TableHead className="text-muted-foreground text-right">Leads Afetados</TableHead>
                <TableHead className="text-muted-foreground text-right">Margem Perdida</TableHead>
                <TableHead className="text-muted-foreground">Bancos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((cbo) => (
                <TableRow key={cbo.codigo} className="border-border/50 hover:bg-muted/30">
                  <TableCell className="font-mono text-foreground">{cbo.codigo}</TableCell>
                  <TableCell className="font-medium text-foreground">{cbo.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/50">
                      {cbo.setor}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-orange-400 font-medium">
                    {cbo.leadsAfetados}
                  </TableCell>
                  <TableCell className="text-right text-amber-400 font-medium">
                    R$ {cbo.margemPerdida.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {cbo.bancos.map((banco) => (
                        <Badge key={banco} variant="outline" className={getBancoColor(banco)}>
                          {banco}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListaCompletaCBOsPanel;
