import { FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LeadsPanel = () => {
  const navigate = useNavigate();

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Leads (0)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="py-12 text-center">
          <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lead importado</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Importe seus dados de leads CLT para visualizar análises detalhadas, 
            taxas de aprovação e estatísticas por banco.
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

export default LeadsPanel;
