import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

const getBarColor = (value: number, max: number) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  if (percentage >= 70) return "hsl(var(--destructive))";
  if (percentage >= 50) return "hsl(var(--warning))";
  if (percentage >= 30) return "hsl(25 95% 53%)";
  return "hsl(var(--success))";
};

// Função para criar resumos inteligentes de mensagens de erro longas
const summarizeRejectionReason = (fullText: string): string => {
  const lowerText = fullText.toLowerCase();
  
  // Mapeia padrões comuns para resumos curtos
  if (lowerText.includes("valor solicitado") && lowerText.includes("maior")) {
    return "Valor acima do limite";
  }
  if (lowerText.includes("record_not_exists") || lowerText.includes("produto não encontrado")) {
    return "Produto não encontrado";
  }
  if (lowerText.includes("missing_permission") || lowerText.includes("permissão de acesso")) {
    return "Sem permissão de acesso";
  }
  if (lowerText.includes("requisição falhou") && lowerText.includes("status 400")) {
    return "Erro na requisição (400)";
  }
  if (lowerText.includes("registro inferior") || lowerText.includes("meses de carteira")) {
    return "Tempo de registro insuficiente";
  }
  if (lowerText.includes("margem")) {
    return "Problema com margem";
  }
  if (lowerText.includes("idade")) {
    return "Restrição de idade";
  }
  if (lowerText.includes("cpf") && (lowerText.includes("inválido") || lowerText.includes("irregular"))) {
    return "CPF inválido/irregular";
  }
  if (lowerText.includes("negativado") || lowerText.includes("restrição")) {
    return "Cliente com restrição";
  }
  
  // Se não encontrar padrão, trunca de forma inteligente
  if (fullText.length > 25) {
    // Tenta pegar até o primeiro ":" ou "." ou limite de caracteres
    const colonIndex = fullText.indexOf(":");
    const dotIndex = fullText.indexOf(".");
    
    if (colonIndex > 0 && colonIndex < 30) {
      return fullText.substring(0, colonIndex);
    }
    if (dotIndex > 0 && dotIndex < 30) {
      return fullText.substring(0, dotIndex);
    }
    return fullText.substring(0, 22) + "...";
  }
  
  return fullText;
};

const RejectionTypesChart = () => {
  const { stats } = useDashboard();

  const maxValue = Math.max(...stats.reprovacoesPorTipo.map(item => item.quantidade), 1);
  
  const data = stats.reprovacoesPorTipo.slice(0, 8).map(item => ({
    name: summarizeRejectionReason(item.tipoCompleto || item.tipo),
    value: item.quantidade,
    fullName: item.tipoCompleto || item.tipo,
  }));

  if (data.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Tipos de Reprovação - Análise de Leads CLT
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Tipos de Reprovação - Análise de Leads CLT
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="horizontal" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={100} fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
                maxWidth: "320px",
                whiteSpace: "normal",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
              labelStyle={{ 
                color: "hsl(var(--foreground))", 
                fontWeight: "bold", 
                marginBottom: "4px",
                whiteSpace: "normal",
                wordWrap: "break-word",
                display: "block",
                lineHeight: "1.4",
              }}
              itemStyle={{ color: "hsl(var(--muted-foreground))" }}
              labelFormatter={(label: string, payload: any[]) => {
                const item = payload?.[0]?.payload;
                return item?.fullName || label;
              }}
              formatter={(value: number) => [value, "Quantidade"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.value, maxValue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RejectionTypesChart;
