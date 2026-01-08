import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lead } from "@/hooks/useLeadsData";
import { FileText, CheckCircle, XCircle, Clock, User, Building2, CreditCard, FileJson, AlertTriangle } from "lucide-react";
import { normalizarStatusLead, extrairMotivoErro } from "@/lib/leadStatusUtils";

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange }: LeadDetailDialogProps) => {
  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getStatusBadge = (status: string) => {
    if (status === "aprovado") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Aprovado</Badge>;
    if (status === "pendente") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    // reprovado é o fallback (inclui CPF não encontrado)
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado</Badge>;
  };

  const renderJsonContent = (data: any, label: string) => {
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return (
        <div className="text-muted-foreground text-sm italic py-2">
          Nenhum dado disponível
        </div>
      );
    }

    return (
      <div className="max-h-[300px] overflow-y-auto">
        <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const hasData = (data: any) => data && typeof data === "object" && Object.keys(data).length > 0;

  // Early return AFTER all hooks/functions that could contain hooks
  if (!lead) return null;

  // Usa o status normalizado do utilitário
  const statusNormalizado = normalizarStatusLead(lead);
  const motivoErro = extrairMotivoErro(lead);

  const margem = lead.retorno_margem as any;
  const nome = lead.nome || margem?.registroEmpregaticio?.nomeEmpregado || margem?.nomeEmpregado || "-";
  const sim = lead.retorno_simulacao as any;
  const valor = lead.valor || sim?.requestedAmount || sim?.liquidValue || 0;

  const consultaSections = [
    { key: "retorno_autorizacao", label: "Autorização", icon: CheckCircle, data: lead.retorno_autorizacao },
    { key: "retorno_margem", label: "Margem", icon: CreditCard, data: lead.retorno_margem },
    { key: "retorno_simulacao", label: "Simulação", icon: FileJson, data: lead.retorno_simulacao },
    { key: "retorno_proposta", label: "Proposta", icon: FileText, data: lead.retorno_proposta },
    { key: "retorno_get_proposta", label: "Get Proposta", icon: FileText, data: lead.retorno_get_proposta },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[calc(85vh-100px)] pr-4">
          <div className="space-y-6">
            {/* Dados básicos */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">CPF</p>
                <p className="font-mono text-foreground">{formatCpf(lead.cpf)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nome</p>
                <p className="text-foreground truncate">{nome}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                {getStatusBadge(statusNormalizado)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Banco</p>
                <p className="text-foreground">{lead.banco || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">CBO</p>
                <p className="text-foreground truncate">{lead.cbo || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Valor</p>
                <p className="text-foreground">
                  {valor > 0 ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                </p>
              </div>
              {/* Motivo do erro/pendência */}
              {motivoErro && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {statusNormalizado === "pendente" ? "Motivo da Pendência" : 
                     statusNormalizado === "reprovado" ? "Motivo da Reprovação" : "Motivo"}
                  </p>
                  <div className="max-h-[180px] overflow-y-auto pr-2">
                    <p className={`${statusNormalizado === "pendente" ? "text-amber-400" : "text-red-400"} whitespace-pre-wrap break-words`}>
                      {motivoErro}
                    </p>
                  </div>
                </div>
              )}
              {lead.tipo_reprovacao && !motivoErro && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1">Motivo da Reprovação</p>
                  <div className="max-h-[180px] overflow-y-auto pr-2">
                    <p className="text-red-400 whitespace-pre-wrap break-words">{lead.tipo_reprovacao}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Consultas */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Respostas das Consultas
              </h3>

              <Accordion type="multiple" className="space-y-2">
                {consultaSections.map((section) => (
                  <AccordionItem
                    key={section.key}
                    value={section.key}
                    className="border border-border rounded-lg px-4 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <section.icon className={`w-4 h-4 ${hasData(section.data) ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium">{section.label}</span>
                        {hasData(section.data) ? (
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            Com dados
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Vazio
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {renderJsonContent(section.data, section.label)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Observações */}
            {lead.observacoes && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-2">Observações</p>
                <p className="text-foreground text-sm">{lead.observacoes}</p>
              </div>
            )}

            {/* Datas */}
            <div className="flex gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Criado: {new Date(lead.created_at).toLocaleString("pt-BR")}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Atualizado: {new Date(lead.updated_at).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
