import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, Users, DollarSign, Building2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

interface CBOStats {
  totalBloqueados: number;
  leadsAfetados: number;
  margemPerdida: number;
  setoresAfetados: number;
}

const CBOsBloqueados = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [stats] = useState<CBOStats>({
    totalBloqueados: 8,
    leadsAfetados: 1050,
    margemPerdida: 521000,
    setoresAfetados: 7,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return `R$ ${value.toLocaleString("pt-BR")}`;
  };

  const kpiCards = [
    {
      title: "Total de CBOs Bloqueados",
      value: stats.totalBloqueados.toString(),
      subtitle: "Ocupações não elegíveis",
      icon: Ban,
      bgGradient: "from-red-950/50 to-red-900/30",
      borderColor: "border-l-red-500",
      textColor: "text-red-400",
      iconColor: "text-red-400",
    },
    {
      title: "Leads Afetados",
      value: stats.leadsAfetados.toLocaleString("pt-BR"),
      subtitle: "Reprovados por CBO",
      icon: Users,
      bgGradient: "from-orange-950/50 to-orange-900/30",
      borderColor: "border-l-orange-500",
      textColor: "text-orange-400",
      iconColor: "text-orange-400",
    },
    {
      title: "Margem Perdida",
      value: formatCurrency(stats.margemPerdida),
      subtitle: "Potencial não aproveitado",
      icon: DollarSign,
      bgGradient: "from-amber-950/50 to-amber-900/30",
      borderColor: "border-l-amber-500",
      textColor: "text-amber-400",
      iconColor: "text-amber-400",
    },
    {
      title: "Setores Afetados",
      value: stats.setoresAfetados.toString(),
      subtitle: "Áreas de atuação",
      icon: Building2,
      bgGradient: "from-purple-950/50 to-purple-900/30",
      borderColor: "border-l-purple-500",
      textColor: "text-purple-400",
      iconColor: "text-purple-400",
    },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">CBOs Bloqueados</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie ocupações não elegíveis para aprovação
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => (
              <Card 
                key={kpi.title} 
                className={`bg-gradient-to-br ${kpi.bgGradient} border-l-4 ${kpi.borderColor} border-t-0 border-r-0 border-b-0`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {kpi.title}
                      </p>
                      <p className={`text-3xl font-bold ${kpi.textColor}`}>
                        {kpi.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {kpi.subtitle}
                      </p>
                    </div>
                    <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CBOsBloqueados;
