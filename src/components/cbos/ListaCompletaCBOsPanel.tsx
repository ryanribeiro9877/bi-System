import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ban, Search, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ListaCompletaCBOsPanel = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

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
          <Badge className="bg-muted text-muted-foreground border-border">
            0 CBOs
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
          <Button variant="outline" className="gap-2" disabled>
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="py-12 text-center">
          <Ban className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO bloqueado</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Importe seus leads para identificar os CBOs que estão bloqueando 
            aprovações nos bancos.
          </p>
          <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
            <Upload className="w-4 h-4" />
            Ir para Importações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ListaCompletaCBOsPanel;
