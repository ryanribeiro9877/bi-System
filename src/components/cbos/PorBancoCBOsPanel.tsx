import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const bancosData = [
  {
    nome: "UY3",
    cbos: 5,
    lista: [
      { descricao: "Servente de Obras", codigo: "717020", leads: 245 },
      { descricao: "Vendedor em Comércio Atacadista", codigo: "521105", leads: 189 },
      { descricao: "Atendente de Lanchonete", codigo: "513435", leads: 156 },
      { descricao: "Faxineiro", codigo: "514320", leads: 134 },
      { descricao: "Recepcionista em Geral", codigo: "422105", leads: 98 },
    ],
  },
  {
    nome: "Presença",
    cbos: 5,
    lista: [
      { descricao: "Servente de Obras", codigo: "717020", leads: 245 },
      { descricao: "Vendedor em Comércio Atacadista", codigo: "521105", leads: 189 },
      { descricao: "Atendente de Lanchonete", codigo: "513435", leads: 156 },
      { descricao: "Recepcionista em Geral", codigo: "422105", leads: 98 },
    ],
  },
  {
    nome: "V8",
    cbos: 5,
    lista: [
      { descricao: "Servente de Obras", codigo: "717020", leads: 245 },
      { descricao: "Atendente de Lanchonete", codigo: "513435", leads: 156 },
      { descricao: "Faxineiro", codigo: "514320", leads: 134 },
      { descricao: "Motorista de Caminhão", codigo: "782510", leads: 76 },
    ],
  },
];

const PorBancoCBOsPanel = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {bancosData.map((banco) => (
        <Card key={banco.nome} className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{banco.nome}</h3>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                {banco.cbos} CBOs
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">CBOs bloqueados neste banco</p>
            
            <div className="space-y-3">
              {banco.lista.map((cbo) => (
                <div 
                  key={cbo.codigo} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">{cbo.descricao}</p>
                    <p className="text-xs text-muted-foreground">{cbo.codigo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-400">{cbo.leads}</p>
                    <p className="text-xs text-muted-foreground">leads</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PorBancoCBOsPanel;
