import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const topCBOsData = [
  { cbo: "Assistente Administrativo", aprovados: 45 },
  { cbo: "Vendedor de Comércio Varejista", aprovados: 38 },
  { cbo: "Operador de Telemarketing", aprovados: 32 },
  { cbo: "Auxiliar de Limpeza", aprovados: 28 },
  { cbo: "Alimentador de Linha de Produção", aprovados: 25 },
];

const cbosTableData = [
  { codigo: "411010", descricao: "Assistente Administrativo", aprovados: 45, taxa: 78 },
  { codigo: "521110", descricao: "Vendedor de Comércio Varejista", aprovados: 38, taxa: 72 },
  { codigo: "422310", descricao: "Operador de Telemarketing", aprovados: 32, taxa: 68 },
  { codigo: "514225", descricao: "Auxiliar de Limpeza", aprovados: 28, taxa: 65 },
  { codigo: "784205", descricao: "Alimentador de Linha de Produção", aprovados: 25, taxa: 62 },
  { codigo: "411005", descricao: "Auxiliar de Escritório", aprovados: 22, taxa: 58 },
  { codigo: "521140", descricao: "Atendente de Loja", aprovados: 20, taxa: 55 },
  { codigo: "782510", descricao: "Operador de Empilhadeira", aprovados: 18, taxa: 52 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-emerald-400">Taxa: {Math.round((payload[0].value / 60) * 100)}%</p>
      </div>
    );
  }
  return null;
};

const CBOsQueAprovamPanel = () => {
  return (
    <div className="space-y-6">
      {/* Top 10 CBOs Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Top 10 CBOs com Maior Taxa de Aprovação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocupações que têm as melhores chances de aprovação nos bancos
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCBOsData} layout="vertical" margin={{ left: 30, right: 30 }}>
                <XAxis 
                  type="number" 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 60]}
                />
                <YAxis
                  type="category"
                  dataKey="cbo"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  width={180}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={() => "Aprovados"}
                  wrapperStyle={{ paddingTop: 20 }}
                />
                <Bar 
                  dataKey="aprovados" 
                  fill="#10b981" 
                  radius={[0, 4, 4, 0]}
                  name="Aprovados"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Lista Completa de CBOs */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Lista Completa de CBOs Elegíveis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Todas as ocupações que têm aprovações registradas
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Código CBO</TableHead>
                  <TableHead className="text-muted-foreground">Descrição</TableHead>
                  <TableHead className="text-muted-foreground text-right">Aprovados</TableHead>
                  <TableHead className="text-muted-foreground text-right">Taxa</TableHead>
                  <TableHead className="text-muted-foreground text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cbosTableData.map((cbo) => (
                  <TableRow key={cbo.codigo} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="font-mono text-foreground">{cbo.codigo}</TableCell>
                    <TableCell className="text-foreground">{cbo.descricao}</TableCell>
                    <TableCell className="text-right text-foreground">{cbo.aprovados}</TableCell>
                    <TableCell className="text-right text-foreground">{cbo.taxa}%</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        Elegível
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsQueAprovamPanel;
