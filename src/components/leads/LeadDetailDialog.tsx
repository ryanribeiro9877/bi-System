import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lead } from "@/hooks/useLeadsData";
import { FileText, CheckCircle, Clock, User, CreditCard, FileJson, AlertTriangle } from "lucide-react";
import { normalizarStatusLead, extrairMotivoErro, extrairMotivoReprovacaoTecnica } from "@/lib/leadStatusUtils";

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange }: LeadDetailDialogProps) => {
  const sanitizeMotivo = (value: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();

    const looksLikeJson =
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.includes("Response completo:") ||
      trimmed.includes("\"status\"") ||
      trimmed.includes("\"statusDescription\"");

    const extractFromObject = (obj: unknown): string | null => {
      if (!obj || typeof obj !== "object") return null;
      const o = obj as Record<string, unknown>;
      const fields = ["status", "statusDescription", "message", "error", "detail", "details"];
      for (const f of fields) {
        const v = o[f];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };

    if (looksLikeJson) {
      const tryParse = (text: string): unknown | null => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      };

      const marker = "Response completo:";
      const idx = trimmed.indexOf(marker);
      if (idx >= 0) {
        const candidate = trimmed.slice(idx + marker.length).trim();
        const parsed = tryParse(candidate);
        const extracted = extractFromObject(parsed);
        if (extracted) return extracted;
      }

      const parsed = tryParse(trimmed);
      const extracted = extractFromObject(parsed);
      if (extracted) return extracted;

      return "Pendente";
    }

    if (trimmed.length > 180) return `${trimmed.slice(0, 180)}...`;
    return trimmed;
  };

  const getMotivoAguardandoPagamento = (l: Lead): string => {
    const leadAny = l as unknown as Record<string, unknown>;
    const manualStatus = leadAny.pagamento_status as string | null;

    if (manualStatus === "aguardando") {
      const motivoManual = leadAny.pagamento_descricao as string | null;
      const sanitizedManual = sanitizeMotivo(motivoManual);
      if (sanitizedManual) {
        const normalized = sanitizedManual
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        if (normalized.includes("assinatura")) return "Assinatura pendente";
      }
    }

    const obj = l.retorno_get_proposta as unknown;
    const statusRaw =
      obj && typeof obj === "object" && typeof (obj as Record<string, unknown>).status === "string"
        ? ((obj as Record<string, unknown>).status as string)
        : null;

    if (!statusRaw) return "Pendente";

    const normalized = statusRaw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    if (normalized.includes("assinatura")) return "Assinatura pendente";
    return "Pendente";
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getPagamentoInfo = (l: Lead): { label: string; variant: "success" | "warning" | "danger" | "neutral" } => {
    const leadAny = l as unknown as Record<string, unknown>;
    const manualStatus = leadAny.pagamento_status as string | null;

    if (manualStatus) {
      if (manualStatus === "pago") return { label: "Pago", variant: "success" };
      if (manualStatus === "reprovado_cancelado") return { label: "Reprovado/Cancelado", variant: "danger" };
      if (manualStatus === "aguardando") return { label: "Aguardando", variant: "warning" };
    }

    const obj = l.retorno_get_proposta as unknown;
    const raw =
      obj && typeof obj === "object" && typeof (obj as Record<string, unknown>).statusDescription === "string"
        ? ((obj as Record<string, unknown>).statusDescription as string)
        : null;
    if (!raw) return { label: "-", variant: "neutral" };

    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const sd = normalize(raw);

    const pagos = ["Encerrado", "Liquidação", "Liquidação Manual", "Pago", "Liquidado"].map(normalize);
    const reprovadosCancelados = ["Cancelada", "Cancelado", "Reprovado"].map(normalize);

    if (pagos.includes(sd)) return { label: "Pago", variant: "success" };
    if (reprovadosCancelados.includes(sd)) return { label: "Reprovado/Cancelado", variant: "danger" };
    return { label: "Aguardando", variant: "warning" };
  };

  const getPagamentoBadge = (info: { label: string; variant: "success" | "warning" | "danger" | "neutral" }) => {
    if (info.variant === "success") {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ {info.label}</Badge>;
    }
    if (info.variant === "danger") {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ {info.label}</Badge>;
    }
    if (info.variant === "warning") {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ {info.label}</Badge>;
    }
    return <Badge variant="secondary">{info.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "aprovado") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ Aprovado</Badge>;
    if (status === "pendente") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
    // reprovado é o fallback (inclui CPF não encontrado)
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">✕ Reprovado</Badge>;
  };

  const renderJsonContent = (data: unknown, label: string) => {
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return (
        <div className="text-muted-foreground text-sm italic py-2">
          Nenhum dado disponível
        </div>
      );
    }

    return (
      <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const hasData = (data: unknown) => data && typeof data === "object" && Object.keys(data as object).length > 0;

  // Early return if no lead
  if (!lead) return null;

  // Usa o status normalizado do utilitário
  const statusNormalizado = normalizarStatusLead(lead);
  const pagamentoInfo = getPagamentoInfo(lead);
  const hideMotivoForCancelado = pagamentoInfo.variant === "danger";
  const motivoErro = sanitizeMotivo(extrairMotivoErro(lead));
  const motivoExibido =
    pagamentoInfo.variant === "warning" ? getMotivoAguardandoPagamento(lead) : motivoErro;

  const margem = lead.retorno_margem as Record<string, unknown> | null;
  const nomeFromMargem = (margem?.registroEmpregaticio as Record<string, unknown>)?.nomeEmpregado as string | undefined;
  const nome = lead.nome || nomeFromMargem || (margem?.nomeEmpregado as string) || "-";
  const sim = lead.retorno_simulacao as Record<string, unknown> | null;
  const valor = lead.valor || (sim?.requestedAmount as number) || (sim?.liquidValue as number) || 0;

  const consultaSections = [
    { key: "retorno_autorizacao", label: "Autorização", icon: CheckCircle, data: lead.retorno_autorizacao },
    { key: "retorno_margem", label: "Margem", icon: CreditCard, data: lead.retorno_margem },
    { key: "retorno_simulacao", label: "Simulação", icon: FileJson, data: lead.retorno_simulacao },
    { key: "retorno_proposta", label: "Proposta", icon: FileText, data: lead.retorno_proposta },
    { key: "retorno_get_proposta", label: "Get Proposta", icon: FileText, data: lead.retorno_get_proposta },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
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
                {(lead.status === "reprovacao_tecnica" || statusNormalizado === "reprovacao_tecnica") ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-1">Motivo</p>
                    <p className="text-orange-400 text-sm">{lead.motivo_reprovacao_tecnica || extrairMotivoReprovacaoTecnica(lead) || "-"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    {getStatusBadge(statusNormalizado)}
                  </>
                )}
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
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                {getPagamentoBadge(pagamentoInfo)}
              </div>
              {/* Motivo do erro/pendência - não mostrar para reprovacao_tecnica pois já está no campo Motivo */}
              {motivoExibido &&
                !hideMotivoForCancelado &&
                lead.status !== "reprovacao_tecnica" &&
                statusNormalizado !== "reprovacao_tecnica" && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {statusNormalizado === "pendente" ? "Motivo da Pendência" : 
                     statusNormalizado === "reprovado" ? "Motivo da Reprovação" : "Motivo"}
                  </p>
                  <p className={`${statusNormalizado === "pendente" ? "text-amber-400" : "text-red-400"} whitespace-pre-wrap break-words`}>
                    {motivoExibido}
                  </p>
                </div>
              )}
              {lead.tipo_reprovacao && !motivoErro && lead.status !== "reprovacao_tecnica" && statusNormalizado !== "reprovacao_tecnica" && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1">Motivo da Reprovação</p>
                  <p className="text-red-400 whitespace-pre-wrap break-words">{lead.tipo_reprovacao}</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
