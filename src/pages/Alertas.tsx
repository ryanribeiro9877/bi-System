import { useState } from "react";
import { Bell, BellRing, BellOff, Plus, Settings, AlertTriangle, Trash2, Pencil } from "lucide-react";
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

interface Alerta {
  id: number;
  nome: string;
  descricao: string;
  tipo: string;
  limite?: string;
  banco?: string;
  ativo: boolean;
  criadoEm: string;
}

const alertasIniciais: Alerta[] = [
  {
    id: 1,
    nome: "CBO Bloqueado - Vendedor",
    descricao: "Alerta quando CBO de vendedor for bloqueado",
    tipo: "cbos_bloqueados",
    limite: "10",
    banco: "Todos os bancos",
    ativo: true,
    criadoEm: "2026-01-05",
  },
  {
    id: 2,
    nome: "Reprovação acima de 30%",
    descricao: "Alerta quando taxa de reprovação ultrapassar 30%",
    tipo: "taxa_reprovacao",
    limite: "30",
    banco: "Presença",
    ativo: true,
    criadoEm: "2026-01-03",
  },
  {
    id: 3,
    nome: "Novo banco disponível",
    descricao: "Alerta quando novo banco entrar na plataforma",
    tipo: "volume_leads",
    limite: "500",
    banco: "UY3",
    ativo: false,
    criadoEm: "2026-01-01",
  },
];


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
  const [alertas, setAlertas] = useState<Alerta[]>(alertasIniciais);
  const [openDialog, setOpenDialog] = useState(false);
  const [openConfigDialog, setOpenConfigDialog] = useState(false);
  const [editingAlerta, setEditingAlerta] = useState<Alerta | null>(null);
  const [nomeAlerta, setNomeAlerta] = useState("");
  const [descricaoAlerta, setDescricaoAlerta] = useState("");
  const [tipoAlerta, setTipoAlerta] = useState("");
  const [limite, setLimite] = useState("");
  const [bancoFiltro, setBancoFiltro] = useState("");

  const alertasAtivosCount = alertas.filter(a => a.ativo).length;

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
    const novoAlerta: Alerta = {
      id: Date.now(),
      nome: nomeAlerta,
      descricao: descricaoAlerta,
      tipo: tipoAlerta,
      limite,
      banco: bancoFiltro,
      ativo: true,
      criadoEm: new Date().toISOString().split('T')[0],
    };
    setAlertas([...alertas, novoAlerta]);
    setOpenDialog(false);
    resetForm();
  };

  const handleEditAlerta = (alerta: Alerta) => {
    setEditingAlerta(alerta);
    setNomeAlerta(alerta.nome);
    setDescricaoAlerta(alerta.descricao);
    setTipoAlerta(alerta.tipo);
    setLimite(alerta.limite || "");
    setBancoFiltro(alerta.banco || "");
  };

  const handleSaveEditAlerta = () => {
    if (!editingAlerta) return;
    
    const updatedAlertas = alertas.map(a => 
      a.id === editingAlerta.id
        ? { ...a, nome: nomeAlerta, descricao: descricaoAlerta, tipo: tipoAlerta, limite, banco: bancoFiltro }
        : a
    );
    setAlertas(updatedAlertas);
    setEditingAlerta(null);
    resetForm();
  };

  const handleDeleteAlerta = (id: number) => {
    setAlertas(alertas.filter(a => a.id !== id));
  };

  const resetForm = () => {
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
              title="Total de Alertas"
              value={alertas.length}
              subtitle="Cadastrados"
              icon={Bell}
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
                <Dialog open={openConfigDialog} onOpenChange={setOpenConfigDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Settings className="w-4 h-4" />
                      Configurar Alertas
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Configurar Alertas</DialogTitle>
                    </DialogHeader>
                    {alertas.length === 0 ? (
                      <div className="py-8 text-center">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <p className="text-destructive font-medium">Nenhum alerta encontrado</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Crie um alerta primeiro para poder configurá-lo.
                        </p>
                      </div>
                    ) : editingAlerta ? (
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-nome">Nome do Alerta *</Label>
                          <Input
                            id="edit-nome"
                            placeholder="Digite o nome do alerta"
                            value={nomeAlerta}
                            onChange={(e) => setNomeAlerta(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-descricao">Descrição</Label>
                          <Textarea
                            id="edit-descricao"
                            placeholder="Descrição do alerta..."
                            value={descricaoAlerta}
                            onChange={(e) => setDescricaoAlerta(e.target.value)}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-tipo">Tipo de Alerta *</Label>
                          <Select value={tipoAlerta} onValueChange={(value) => {
                            setTipoAlerta(value);
                            setLimite("");
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
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
                          <Label htmlFor="edit-limite">Limite *</Label>
                          <Input
                            id="edit-limite"
                            type="number"
                            placeholder="Digite o limite"
                            value={limite}
                            onChange={(e) => handleLimiteChange(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-banco">Banco *</Label>
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

                        <DialogFooter className="pt-4">
                          <Button variant="outline" onClick={() => {
                            setEditingAlerta(null);
                            resetForm();
                          }}>
                            Voltar
                          </Button>
                          <Button onClick={handleSaveEditAlerta} disabled={!isFormValid}>
                            Salvar Alterações
                          </Button>
                        </DialogFooter>
                      </div>
                    ) : (
                      <div className="py-4">
                        <ScrollArea className="h-[300px] pr-4">
                          <div className="space-y-3">
                            {alertas.map((alerta) => (
                              <div
                                key={alerta.id}
                                className="p-4 rounded-lg border bg-muted/20 flex items-center justify-between"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <BellRing className={`w-4 h-4 ${alerta.ativo ? 'text-success' : 'text-muted-foreground'}`} />
                                    <span className="font-medium text-sm">{alerta.nome}</span>
                                    <Badge variant={alerta.ativo ? "default" : "secondary"} className="text-xs">
                                      {alerta.ativo ? "Ativo" : "Inativo"}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleEditAlerta(alerta)}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Editar
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alertas.map((alerta) => (
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAlerta(alerta.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default Alertas;
