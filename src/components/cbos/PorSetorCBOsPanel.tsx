import { Layers, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PorSetorCBOsPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-purple-400" />
            CBOs Bloqueados por Setor de Atuação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise detalhada dos bloqueios organizados por área de trabalho
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum setor identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar CBOs bloqueados organizados 
              por setor de atuação.
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

export default PorSetorCBOsPanel;
