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

// Função para extrair a mensagem útil de um erro técnico (para o tooltip)
const extractCleanMessage = (fullText: string): string => {
  const lowerText = fullText.toLowerCase();
  
  // Extrai a mensagem "message" do JSON se existir
  const messageMatch = fullText.match(/"message"\s*:\s*"([^"]+)"/);
  if (messageMatch) {
    return messageMatch[1];
  }
  
  // Se tem padrão "Requisição falhou...: Mensagem real", pega só a parte útil
  if (lowerText.includes("requisição falhou") && fullText.includes(":")) {
    const parts = fullText.split(":");
    if (parts.length >= 2) {
      // Pega a segunda parte que geralmente é a mensagem real
      const cleanPart = parts[1].trim().split("(")[0].trim();
      if (cleanPart.length > 10) {
        return cleanPart;
      }
    }
  }
  
  // Remove padrões técnicos comuns
  let cleaned = fullText
    .replace(/\s*\(Code:\s*[A-Z_]+\)/gi, "")
    .replace(/\s*\|\s*Response completo:.*/gi, "")
    .replace(/\s*\{[^}]*\}/g, "")
    .replace(/Requisição falhou com status \d+:\s*/gi, "")
    .trim();
  
  return cleaned || fullText;
};

// Função para criar resumos curtos (para o eixo X do gráfico)
const summarizeRejectionReason = (fullText: string): string => {
  const cleanText = extractCleanMessage(fullText);
  const lowerText = cleanText.toLowerCase();
  
  // Mapeia padrões comuns para resumos curtos
  if (lowerText.includes("valor solicitado") && lowerText.includes("maior")) {
    return "Valor acima do limite";
  }
  if (lowerText.includes("produto não encontrado") || lowerText.includes("não possui permissão")) {
    return "Sem permissão/Não encontrado";
  }
  if (lowerText.includes("registro inferior") || lowerText.includes("meses de carteira")) {
    return "Tempo de registro insuf.";
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
  
  // Se ainda for longo, trunca
  if (cleanText.length > 25) {
    return cleanText.substring(0, 22) + "...";
  }
  
  return cleanText;
};

const RejectionTypesChart = () => {
  const { stats } = useDashboard();

  const maxValue = Math.max(...stats.reprovacoesPorTipo.map(item => item.quantidade), 1);
  
  const data = stats.reprovacoesPorTipo.slice(0, 8).map(item => {
    const fullText = item.tipoCompleto || item.tipo;
    return {
      name: summarizeRejectionReason(fullText),
      value: item.quantidade,
      fullName: extractCleanMessage(fullText), // Mensagem limpa sem JSON técnico
    };
  });

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
