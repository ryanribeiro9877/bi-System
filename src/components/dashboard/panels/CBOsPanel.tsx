import { Briefcase, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CBOsPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Análise de CBOs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Briefcase className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum CBO analisado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para identificar CBOs bloqueados e visualizar 
              estatísticas de reprovação por ocupação.
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

export default CBOsPanel;
