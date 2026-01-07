import { Building2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PorBancoPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Comparativo por Banco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Análise comparativa das taxas de aprovação entre UY3, Presença e V8
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar estatísticas detalhadas de aprovação 
              e reprovação por banco.
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

export default PorBancoPanel;
