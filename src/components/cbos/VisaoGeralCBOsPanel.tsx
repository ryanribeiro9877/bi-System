import { AlertTriangle, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const VisaoGeralCBOsPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Visão Geral de CBOs Bloqueados
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações que mais geram reprovações nos bancos
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <AlertTriangle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO bloqueado identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar CBOs bloqueados, setores afetados 
              e impacto por banco.
            </p>
            <Button onClick={() => navigate("/dashboard/importacoes")} className="gap-2">
              <Upload className="w-4 h-4" />
              Ir para Importações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisaoGeralCBOsPanel;
