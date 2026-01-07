import { useState } from "react";
import { Bell, BellRing, BellOff, Plus, Settings, Clock, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import KPICard from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const alertasAtivos = [
  {
    id: 1,
    nome: "CBO Bloqueado - Vendedor",
    descricao: "Alerta quando CBO de vendedor for bloqueado",
    tipo: "cbo",
    ativo: true,
    criadoEm: "2026-01-05",
  },
  {
    id: 2,
    nome: "Reprovação acima de 30%",
    descricao: "Alerta quando taxa de reprovação ultrapassar 30%",
    tipo: "taxa",
    ativo: true,
    criadoEm: "2026-01-03",
  },
  {
    id: 3,
    nome: "Novo banco disponível",
    descricao: "Alerta quando novo banco entrar na plataforma",
    tipo: "banco",
    ativo: false,
    criadoEm: "2026-01-01",
  },
];

const historicoAlertas = [
  {
    id: 1,
    titulo: "CBO Bloqueado - Vendedor",
    mensagem: "O CBO 5211-10 foi bloqueado pelo Banco Pan",
    data: "2026-01-07 09:45",
    lido: false,
    tipo: "warning",
  },
  {
    id: 2,
    titulo: "Taxa de reprovação alta",
    mensagem: "Taxa de reprovação atingiu 35% no Banco Bradesco",
    data: "2026-01-07 08:30",
    lido: false,
    tipo: "error",
  },
  {
    id: 3,
    titulo: "CBO Bloqueado - Motorista",
    mensagem: "O CBO 7823-05 foi bloqueado pelo Banco Itaú",
    data: "2026-01-06 16:20",
    lido: true,
    tipo: "warning",
  },
  {
    id: 4,
    titulo: "Meta de aprovação atingida",
    mensagem: "Você atingiu 85% de aprovação no Banco Santander",
    data: "2026-01-06 14:00",
    lido: true,
    tipo: "success",
  },
  {
    id: 5,
    titulo: "Novo banco disponível",
    mensagem: "Banco C6 agora está disponível para envio de leads",
    data: "2026-01-05 10:15",
    lido: true,
    tipo: "info",
  },
];

const tipoIcone = {
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  error: <AlertTriangle className="w-4 h-4 text-destructive" />,
  success: <CheckCircle2 className="w-4 h-4 text-success" />,
  info: <Bell className="w-4 h-4 text-primary" />,
};

const tipoBadge = {
  warning: "bg-warning/20 text-warning border-warning/30",
  error: "bg-destructive/20 text-destructive border-destructive/30",
  success: "bg-success/20 text-success border-success/30",
  info: "bg-primary/20 text-primary border-primary/30",
};

const bancosCadastrados = [
  "Todos os bancos",
  "Presença",
  "UY3",
  "V8",
];

const tiposAlerta = [
  { value: "taxa_reprovacao", label: "Taxa de Reprovação" },
  { value: "taxa_aprovacao", label: "Taxa de Aprovação" },
  { value: "cbos_bloqueados", label: "CBOs Bloqueados" },
  { value: "volume_leads", label: "Volume de Leads" },
];

const Alertas = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [nomeAlerta, setNomeAlerta] = useState("");
  const [descricaoAlerta, setDescricaoAlerta] = useState("");
  const [tipoAlerta, setTipoAlerta] = useState("");
  const [limite, setLimite] = useState("");
  const [bancoFiltro, setBancoFiltro] = useState("");

  const alertasAtivosCount = alertasAtivos.filter(a => a.ativo).length;
  const naoLidosCount = historicoAlertas.filter(a => !a.lido).length;
  const totalDisparados = historicoAlertas.length;

  const isPercentageType = tipoAlerta === "taxa_reprovacao" || tipoAlerta === "taxa_aprovacao";
  const isVolumeType = tipoAlerta === "volume_leads";
  const isCBOsType = tipoAlerta === "cbos_bloqueados";

  const handleLimiteChange = (value: string) => {
    if (isPercentageType) {
      const numValue = parseInt(value);
      if (numValue >= 0 && numValue <= 100) {
        setLimite(value);
      } else if (value === "") {
        setLimite("");
      }
    } else if (isVolumeType) {
      const numValue = parseInt(value);
      if (numValue >= 100 || value === "") {
        setLimite(value);
      }
    } else if (isCBOsType) {
      const numValue = parseInt(value);
      if (numValue >= 5 || value === "") {
        setLimite(value);
      }
    } else {
      setLimite(value);
    }
  };

  const handleCreateAlerta = () => {
    // Aqui seria a lógica para criar o alerta
    console.log({
      nome: nomeAlerta,
      descricao: descricaoAlerta,
      tipo: tipoAlerta,
      limite,
      banco: bancoFiltro,
    });
    setOpenDialog(false);
    setNomeAlerta("");
    setDescricaoAlerta("");
    setTipoAlerta("");
    setLimite("");
    setBancoFiltro("");
  };

  const isFormValid = nomeAlerta.trim() !== "" && tipoAlerta !== "" && limite !== "" && bancoFiltro !== "";

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alertas</h1>
            <p className="text-muted-foreground mt-1">
              Configure e gerencie seus alertas personalizados
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard
              title="Alertas Ativos"
              value={alertasAtivosCount}
              subtitle="Monitorando"
              icon={BellRing}
              variant="success"
            />
            <KPICard
              title="Não Lidos"
              value={naoLidosCount}
              subtitle="Aguardando leitura"
              icon={Bell}
              variant="warning"
            />
            <KPICard
              title="Total Disparados"
              value={totalDisparados}
              subtitle="Últimos 30 dias"
              icon={BellOff}
              variant="default"
            />
          </div>

          {/* Área de Gerenciamento de Alertas */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">Meus Alertas</CardTitle>
              <div className="flex gap-3">
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Criar Novo Alerta
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Criar Novo Alerta</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Alerta *</Label>
                        <Input
                          id="nome"
                          placeholder="Digite o nome do alerta"
                          value={nomeAlerta}
                          onChange={(e) => setNomeAlerta(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tipo">Tipo de Alerta *</Label>
                        <Select value={tipoAlerta} onValueChange={(value) => {
                          setTipoAlerta(value);
                          setLimite("");
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de alerta" />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposAlerta.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                {tipo.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="limite">
                          Limite * {isPercentageType && "(%)"}
                          {isVolumeType && "(mínimo 100)"}
                          {isCBOsType && "(mínimo 5)"}
                        </Label>
                        <div className="relative">
                          <Input
                            id="limite"
                            type="number"
                            placeholder={isPercentageType ? "Ex: 30" : isVolumeType ? "Mínimo 100" : isCBOsType ? "Mínimo 5" : "Digite o limite"}
                            value={limite}
                            onChange={(e) => handleLimiteChange(e.target.value)}
                            min={isVolumeType ? 100 : isCBOsType ? 5 : 0}
                            max={isPercentageType ? 100 : undefined}
                            disabled={!tipoAlerta}
                          />
                          {isPercentageType && limite && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          )}
                        </div>
                        {isVolumeType && limite && parseInt(limite) < 100 && (
                          <p className="text-xs text-destructive">O volume mínimo é 100 leads</p>
                        )}
                        {isCBOsType && limite && parseInt(limite) < 5 && (
                          <p className="text-xs text-destructive">O mínimo é 5 CBOs bloqueados</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="banco">Filtrar por Banco *</Label>
                        <Select value={bancoFiltro} onValueChange={setBancoFiltro}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {bancosCadastrados.map((banco) => (
                              <SelectItem key={banco} value={banco}>
                                {banco}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="descricao">Descrição (opcional)</Label>
                        <Textarea
                          id="descricao"
                          placeholder="Adicione informações adicionais sobre o alerta..."
                          value={descricaoAlerta}
                          onChange={(e) => setDescricaoAlerta(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateAlerta} disabled={!isFormValid}>
                        Criar Alerta
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Configurar Alertas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alertasAtivos.map((alerta) => (
                  <Card key={alerta.id} className={`border ${alerta.ativo ? 'border-success/30 bg-success/5' : 'border-muted bg-muted/20'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <BellRing className={`w-4 h-4 ${alerta.ativo ? 'text-success' : 'text-muted-foreground'}`} />
                          <span className="font-medium text-sm">{alerta.nome}</span>
                        </div>
                        <Badge variant={alerta.ativo ? "default" : "secondary"} className="text-xs">
                          {alerta.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{alerta.descricao}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Criado em {new Date(alerta.criadoEm).toLocaleDateString('pt-BR')}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Alertas */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Histórico de Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {historicoAlertas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={`p-4 rounded-lg border ${!alerta.lido ? 'bg-primary/5 border-primary/20' : 'bg-muted/20 border-muted'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${tipoBadge[alerta.tipo as keyof typeof tipoBadge]}`}>
                            {tipoIcone[alerta.tipo as keyof typeof tipoIcone]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{alerta.titulo}</span>
                              {!alerta.lido && (
                                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                                  Novo
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{alerta.mensagem}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{alerta.data}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Alertas;
