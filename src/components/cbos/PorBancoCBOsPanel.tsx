import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PorBancoCBOsPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            CBOs Bloqueados por Banco
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações bloqueadas em cada banco (UY3, Presença, V8)
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar quais CBOs estão bloqueados 
              em cada banco.
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

export default PorBancoCBOsPanel;
