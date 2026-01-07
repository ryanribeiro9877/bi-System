import { Layers, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";

const PorSetorCBOsPanel = () => {
  const navigate = useNavigate();
  const { stats } = useDashboard();

  if (stats.totalLeads === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">CBOs por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum setor identificado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Importe seus leads para visualizar CBOs por setor.
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

  // A análise por setor requer mapeamento de CBO → setor.
  // Atualmente o arquivo importado não inclui essa informação.
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="w-5 h-5 text-purple-400" />
          CBOs por Setor de Atuação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Análise detalhada por área de trabalho
        </p>
      </CardHeader>
      <CardContent>
        <div className="py-12 text-center">
          <Layers className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Dados de setor não disponíveis
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            A planilha importada não inclui mapeamento de setores para CBOs.
            Para habilitar essa análise, adicione uma coluna "Setor" na planilha
            ou mantenha o campo CBO seguindo a tabela oficial para classificação.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PorSetorCBOsPanel;
