import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const topEmpresasData = [
  { empresa: "MAGAZINE LUIZA S/A", aprovados: 22 },
  { empresa: "LOJAS AMERICANAS S.A", aprovados: 18 },
  { empresa: "TELEPERFORMANCE CRM S.A", aprovados: 15 },
  { empresa: "ATENTO BRASIL S.A", aprovados: 12 },
  { empresa: "CARREFOUR COMERCIO E INDUSTRIA", aprovados: 10 },
];

const empresasTableData = [
  { empresa: "MAGAZINE LUIZA S/A", cnae: "4751201", aprovados: 22, taxa: 85 },
  { empresa: "LOJAS AMERICANAS S.A", cnae: "4751201", aprovados: 18, taxa: 82 },
  { empresa: "TELEPERFORMANCE CRM S.A", cnae: "8220200", aprovados: 15, taxa: 78 },
  { empresa: "ATENTO BRASIL S.A", cnae: "8220200", aprovados: 12, taxa: 75 },
  { empresa: "CARREFOUR COMERCIO E INDUSTRIA", cnae: "4711302", aprovados: 10, taxa: 72 },
  { empresa: "VIA VAREJO S.A", cnae: "4751201", aprovados: 8, taxa: 68 },
  { empresa: "RIACHUELO S.A", cnae: "4781400", aprovados: 7, taxa: 65 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground text-sm">{label}</p>
        <p className="text-blue-400">Aprovados: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const EmpresasPanel = () => {
  return (
    <div className="space-y-6">
      {/* Top Empresas Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-blue-400" />
            Top Empresas com Maior Taxa de Aprovação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Empregadores que têm as melhores taxas de aprovação
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEmpresasData} layout="vertical" margin={{ left: 50, right: 30 }}>
                <XAxis 
                  type="number" 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 24]}
                />
                <YAxis
                  type="category"
                  dataKey="empresa"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  width={200}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="aprovados" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Empresas */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Lista de Empresas com Aprovações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Empresa</TableHead>
                  <TableHead className="text-muted-foreground">CNAE</TableHead>
                  <TableHead className="text-muted-foreground text-right">Aprovados</TableHead>
                  <TableHead className="text-muted-foreground text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasTableData.map((item) => (
                  <TableRow key={item.empresa} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">{item.empresa}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{item.cnae}</TableCell>
                    <TableCell className="text-right text-foreground">{item.aprovados}</TableCell>
                    <TableCell className="text-right text-blue-400 font-medium">{item.taxa}%</TableCell>
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

export default EmpresasPanel;
