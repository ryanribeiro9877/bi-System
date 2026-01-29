import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Eye,
  Link2,
  Loader2,
  Search,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPICard from "../KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { useLeadDetails } from "@/hooks/useLeadsPaginated";
import type { Lead as LeadData } from "@/hooks/useLeadsData";
import { extrairMotivoErro } from "@/lib/leadStatusUtils";

type AuthCategory = "EXISTING_AUTH" | "TOKEN" | "ERRO_400" | "ERRO_429" | "OUTROS" | "VAZIO";

type AuthLeadRow = {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  status: string | null;
  tipo_reprovacao: string | null;
  valor: number | null;
  created_at: string;
  retorno_autorizacao: unknown;
  retorno_margem?: unknown;
  retorno_simulacao?: unknown;
  retorno_proposta?: unknown;
  retorno_get_proposta?: unknown;
};

type AnnotatedAuthLead = AuthLeadRow & {
  authCategory: AuthCategory;
  authReason: string | null;
  authLabel: string;
  auth400Subtype: Auth400Subtype | null;
  auth429Subtype: Auth429Subtype | null;
};

 type AuthChartDatum = {
   key: AuthCategory;
   name: string;
   value: number;
 };

type Auth400Subtype =
  | "INVALID_FORM_PHONE_NUMBER"
  | "BUSINESS_RULE_CPF_NAO_ENCONTRADO"
  | "BUSINESS_RULE_VIRADA_COMPETENCIA"
  | "OUTROS_400";

type Auth429Subtype =
  | "RATE_LIMIT_DATAPREV_TOO_MANY_REQUESTS"
  | "OUTROS_429";

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

const formatCpf = (cpf: string) => {
  const cleaned = (cpf || "").replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
  } catch {
    return "-";
  }
};

const stringifyAuth = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const contarErrosLead = (lead: AuthLeadRow): number => {
  let totalErros = 0;

  const parseJsonString = (str: string): unknown => {
    try {
      const cleanStr = str.replace(/\\n/g, '').replace(/\\"/g, '"');
      const jsonMatch = cleanStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  const contarErrosDeRetorno = (retorno: unknown): number => {
    if (!retorno) return 0;
    
    let obj: Record<string, unknown> | null = null;
    
    if (typeof retorno === 'string') {
      const parsed = parseJsonString(retorno);
      if (parsed && typeof parsed === 'object') {
        obj = parsed as Record<string, unknown>;
      }
    } else if (typeof retorno === 'object') {
      obj = retorno as Record<string, unknown>;
    }

    if (!obj) return 0;

    // Extrair erros do campo 'error' que pode conter JSON embutido
    if (typeof obj.error === 'string') {
      const errorStr = obj.error;
      const innerParsed = parseJsonString(errorStr);
      if (innerParsed && typeof innerParsed === 'object') {
        const innerObj = innerParsed as Record<string, unknown>;
        if (innerObj.details && typeof innerObj.details === 'object') {
          obj = { ...obj, details: innerObj.details };
        }
      }
    }

    // Contar erros do details.dataprevValidationResponses[].reasonForIneligibility[]
    let count = 0;
    const details = obj.details as Record<string, unknown> | undefined;
    if (details && typeof details === 'object') {
      const dataprevResponses = details.dataprevValidationResponses as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(dataprevResponses)) {
        dataprevResponses.forEach((response) => {
          const reasonForIneligibility = response.reasonForIneligibility as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(reasonForIneligibility)) {
            count += reasonForIneligibility.length;
          }
        });
      }
    }

    // Se não encontrou erros estruturados mas tem indicação de erro, contar como 1
    if (count === 0) {
      const str = JSON.stringify(obj).toLowerCase();
      if (str.includes('error') || str.includes('erro') || 
          str.includes('400') || str.includes('429') ||
          str.includes('failed') || str.includes('ineligibility')) {
        count = 1;
      }
    }

    return count;
  };

  totalErros += contarErrosDeRetorno(lead.retorno_autorizacao);
  totalErros += contarErrosDeRetorno(lead.retorno_margem);
  totalErros += contarErrosDeRetorno(lead.retorno_simulacao);
  totalErros += contarErrosDeRetorno(lead.retorno_proposta);
  totalErros += contarErrosDeRetorno(lead.retorno_get_proposta);

  return totalErros || 1;
};

const hasHttpStatus = (text: string, status: number): boolean => {
  if (!text) return false;
  return new RegExp(`status\\D{0,15}${status}`, "i").test(text);
};

const extractAuthErrorText = (raw: unknown): string => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const error = typeof obj.error === "string" ? obj.error : "";
    const message = typeof obj.message === "string" ? obj.message : "";
    const code = typeof obj.code === "string" ? obj.code : "";
    const details = obj.details;
    const detailsStr = details ? stringifyAuth(details) : "";
    return [error, message, code, detailsStr, stringifyAuth(raw)].filter(Boolean).join(" | ");
  }
  return stringifyAuth(raw);
};

const auth429SubtypeLabel = (subtype: Auth429Subtype): string => {
  if (subtype === "RATE_LIMIT_DATAPREV_TOO_MANY_REQUESTS") return "Limite excedido no DataPrev";
  return "Outros 429";
};

const auth400SubtypeLabel = (subtype: Auth400Subtype): string => {
  if (subtype === "BUSINESS_RULE_CPF_NAO_ENCONTRADO") return "CPF não encontrado na base";
  if (subtype === "BUSINESS_RULE_VIRADA_COMPETENCIA") return "Virada de competência";
  if (subtype === "INVALID_FORM_PHONE_NUMBER") return "Número de telefone inválido";
  return "Outros 400";
};

const classify400Subtype = (raw: unknown): Auth400Subtype => {
  const code = extractAuthErrorReason(raw) || "";
  const text = extractAuthErrorText(raw).toLowerCase();
  const codeU = code.toUpperCase();

  const hasInvalidForm = codeU === "INVALID_FORM" || text.includes("invalid_form");
  const hasInvalidBusinessRule = codeU === "INVALID_BUSINESS_RULE" || text.includes("invalid_business_rule");

  const mentionsPhoneNumber =
    text.includes("phonenumber") || text.includes("phone number") || text.includes("phone_number");
  const mentionsVirada = text.includes("virada de competência") || text.includes("virada de competencia");
  const mentionsCpfNaoEncontrado =
    text.includes("cpf") && (text.includes("não encontrado") || text.includes("nao encontrado"));

  if (hasInvalidForm && mentionsPhoneNumber) return "INVALID_FORM_PHONE_NUMBER";

  if (hasInvalidBusinessRule) {
    if (mentionsVirada) return "BUSINESS_RULE_VIRADA_COMPETENCIA";
    if (mentionsCpfNaoEncontrado) return "BUSINESS_RULE_CPF_NAO_ENCONTRADO";
    return "BUSINESS_RULE_CPF_NAO_ENCONTRADO";
  }

  return "OUTROS_400";
};

const classify429Subtype = (raw: unknown): Auth429Subtype => {
  const code = extractAuthErrorReason(raw) || "";
  const text = extractAuthErrorText(raw).toLowerCase();
  const codeL = code.toLowerCase();

  const mentionsTooManyRequests =
    codeL === "too_many_requests" || text.includes("too_many_requests") || text.includes("too many requests");
  const mentionsDataprev = text.includes("dataprev");

  if (mentionsTooManyRequests && mentionsDataprev) return "RATE_LIMIT_DATAPREV_TOO_MANY_REQUESTS";
  return "OUTROS_429";
};

const extractAuthErrorReason = (raw: unknown): string | null => {
  if (!raw) return null;

  const extractFromText = (text: string): string | null => {
    const known = text.match(/\b(INVALID_FORM|INVALID_BUSINESS_RULE|too_many_requests)\b/i);
    if (known) return known[1];
    const m1 = text.match(/Code:\s*([A-Za-z0-9_]+)/i);
    if (m1) return m1[1];
    const m2 = text.match(/"code"\s*:\s*"([A-Za-z0-9_]+)"/i);
    if (m2) return m2[1];
    return null;
  };

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;

    const details = obj.details;
    if (details) {
      if (typeof details === "object" && details !== null) {
        const d = details as Record<string, unknown>;
        if (typeof d.code === "string" && d.code.trim()) return d.code;

        if (typeof d.reason === "string") {
          const extracted = extractFromText(d.reason);
          if (extracted) return extracted;
        }
        if (typeof d.message === "string") {
          const extracted = extractFromText(d.message);
          if (extracted) return extracted;
        }

        const extracted = extractFromText(stringifyAuth(details));
        if (extracted) return extracted;
      }
      if (typeof details === "string") {
        const extracted = extractFromText(details);
        if (extracted) return extracted;
      }
    }

    const err = typeof obj.error === "string" ? obj.error : "";
    if (err) {
      const extracted = extractFromText(err);
      if (extracted) return extracted;
    }

    const message = typeof obj.message === "string" ? obj.message : "";
    if (message) {
      const extracted = extractFromText(message);
      if (extracted) return extracted;
    }

    const fullExtracted = extractFromText(stringifyAuth(raw));
    if (fullExtracted) return fullExtracted;

    const code = obj.code;
    if (typeof code === "string" && code.trim()) return code;
  }

  if (typeof raw === "string") {
    const extracted = extractFromText(raw);
    if (extracted) return extracted;
  }

  return null;
};

const classifyAuth = (raw: unknown): { category: AuthCategory; reason: string | null; label: string } => {
  if (raw === null || raw === undefined || raw === "") {
    return { category: "VAZIO", reason: null, label: "Vazio" };
  }

  if (Array.isArray(raw)) {
    const hasUuid = raw.some((v) => typeof v === "string" && UUID_RE.test(v));
    if (hasUuid) return { category: "TOKEN", reason: null, label: "Token" };
    return { category: "OUTROS", reason: null, label: "Outros" };
  }

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const status = typeof obj.status === "string" ? obj.status : "";
    const code = typeof obj.code === "string" ? obj.code : "";
    const message = typeof obj.message === "string" ? obj.message : "";
    const error = typeof obj.error === "string" ? obj.error : "";
    const full = stringifyAuth(raw);

    if (
      status === "existing_authorization" ||
      code === "EXISTING_AUTH" ||
      message.toLowerCase().includes("autorização já existente")
    ) {
      return { category: "EXISTING_AUTH", reason: null, label: "Autorização já existente" };
    }

    if (hasHttpStatus(error, 400) || hasHttpStatus(full, 400)) {
      const subtype = classify400Subtype(raw);
      return { category: "ERRO_400", reason: extractAuthErrorReason(raw), label: `Erro 400 - ${auth400SubtypeLabel(subtype)}` };
    }
    if (hasHttpStatus(error, 429) || hasHttpStatus(full, 429)) {
      const subtype = classify429Subtype(raw);
      return { category: "ERRO_429", reason: extractAuthErrorReason(raw), label: `Erro 429 - ${auth429SubtypeLabel(subtype)}` };
    }

    const autorizacaoId = typeof obj.autorizacaoId === "string" ? obj.autorizacaoId : "";
    if (autorizacaoId && UUID_RE.test(autorizacaoId)) {
      return { category: "TOKEN", reason: null, label: "Token" };
    }

    const shortUrl = typeof obj.shortUrl === "string" ? obj.shortUrl : "";
    if (shortUrl) {
      return { category: "TOKEN", reason: null, label: "Link" };
    }

    if (
      full.includes("existing_authorization") ||
      full.includes("EXISTING_AUTH") ||
      full.toLowerCase().includes("autorização já existente")
    ) {
      return { category: "EXISTING_AUTH", reason: null, label: "Autorização já existente" };
    }
    if (UUID_RE.test(full)) return { category: "TOKEN", reason: null, label: "Token" };

    return { category: "OUTROS", reason: null, label: "Outros" };
  }

  const s = String(raw);
  if (hasHttpStatus(s, 400)) {
    const subtype = classify400Subtype(s);
    return { category: "ERRO_400", reason: extractAuthErrorReason(s), label: `Erro 400 - ${auth400SubtypeLabel(subtype)}` };
  }
  if (hasHttpStatus(s, 429)) {
    const subtype = classify429Subtype(s);
    return { category: "ERRO_429", reason: extractAuthErrorReason(s), label: `Erro 429 - ${auth429SubtypeLabel(subtype)}` };
  }
  if (
    s.includes("existing_authorization") ||
    s.includes("EXISTING_AUTH") ||
    s.toLowerCase().includes("autorização já existente")
  ) {
    return { category: "EXISTING_AUTH", reason: null, label: "Autorização já existente" };
  }
  if (UUID_RE.test(s)) return { category: "TOKEN", reason: null, label: "Token" };

  return { category: "OUTROS", reason: null, label: "Outros" };
};

const CBOsPanel = () => {
  const { stats: dashboardStats, filters } = useDashboard();
  const [authLeads, setAuthLeads] = useState<AuthLeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<AuthCategory | "TODOS">("TODOS");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selected400Subtype, setSelected400Subtype] = useState<Auth400Subtype | null>(null);
  const [selected429Subtype, setSelected429Subtype] = useState<Auth429Subtype | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useMemo(() => searchTerm, [searchTerm]);
  const [selectedErrorType, setSelectedErrorType] = useState<AuthCategory | "TODOS">("TODOS");

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { lead } = useLeadDetails(selectedLeadId);

  const fetchAuthorizationLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pageSizeFetch = 1000;
      let from = 0;
      let allRows: AuthLeadRow[] = [];

      const buildBaseQuery = () => {
        let query = supabase
          .from("leads")
          .select("id, cpf, nome, banco, status, tipo_reprovacao, valor, created_at, retorno_autorizacao, retorno_margem, retorno_simulacao, retorno_proposta, retorno_get_proposta, import_batch_id")
          .order("created_at", { ascending: false });

        if (filters?.dataInicial) {
          query = query.gte("created_at", filters.dataInicial.toISOString());
        }
        if (filters?.dataFinal) {
          query = query.lte("created_at", filters.dataFinal.toISOString());
        }
        if (filters?.banco) {
          query = query.eq("banco", filters.banco);
        }
        if (filters?.status) {
          query = query.eq("status", filters.status);
        }
        if (filters?.cpf) {
          query = query.ilike("cpf", `%${filters.cpf}%`);
        }
        if (filters?.importBatchId) {
          query = query.eq("import_batch_id", filters.importBatchId);
        }

        return query;
      };

      while (true) {
        const { data, error: fetchError } = await buildBaseQuery().range(from, from + pageSizeFetch - 1);
        if (fetchError) throw fetchError;

        const batch = (data || []) as Record<string, unknown>[];
        const mapped: AuthLeadRow[] = batch.map((row) => ({
          id: String(row.id ?? ""),
          cpf: String(row.cpf ?? ""),
          nome: (row.nome as string) ?? null,
          banco: (row.banco as string) ?? null,
          status: (row.status as string) ?? null,
          tipo_reprovacao: (row.tipo_reprovacao as string) ?? null,
          valor: typeof row.valor === "number" ? row.valor : row.valor === null || row.valor === undefined ? null : Number(row.valor),
          created_at: String(row.created_at ?? ""),
          retorno_autorizacao: row.retorno_autorizacao,
          retorno_margem: row.retorno_margem,
          retorno_simulacao: row.retorno_simulacao,
          retorno_proposta: row.retorno_proposta,
          retorno_get_proposta: row.retorno_get_proposta,
        }));

        allRows = allRows.concat(mapped);

        if (batch.length < pageSizeFetch) break;
        from += pageSizeFetch;
      }

      setAuthLeads(allRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar autorizações");
      setAuthLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAuthorizationLeads();
    setSelectedCategory("TODOS");
    setSelectedReason(null);
    setSelected400Subtype(null);
    setSelected429Subtype(null);
    setPage(1);
  }, [fetchAuthorizationLeads]);

  const annotated = useMemo<AnnotatedAuthLead[]>(() => {
    return authLeads.map((l) => {
      const c = classifyAuth(l.retorno_autorizacao);
      const motivo = extrairMotivoErro(l as unknown as LeadData);
      const motivoExterno = c.category === "TOKEN" || c.category === "EXISTING_AUTH" ? null : motivo ?? l.tipo_reprovacao ?? c.reason;
      const auth400Subtype = c.category === "ERRO_400" ? classify400Subtype(l.retorno_autorizacao) : null;
      const auth429Subtype = c.category === "ERRO_429" ? classify429Subtype(l.retorno_autorizacao) : null;
      return {
        ...l,
        authCategory: c.category,
        authReason: motivoExterno,
        authLabel: c.label,
        auth400Subtype,
        auth429Subtype,
      };
    });
  }, [authLeads]);

  const totals = useMemo(() => {
    const byCategory: Record<AuthCategory, number> = {
      EXISTING_AUTH: 0,
      TOKEN: 0,
      ERRO_400: 0,
      ERRO_429: 0,
      OUTROS: 0,
      VAZIO: 0,
    };
    const by400Subtype: Record<Auth400Subtype, number> = {
      "INVALID_FORM_PHONE_NUMBER": 0,
      "BUSINESS_RULE_CPF_NAO_ENCONTRADO": 0,
      "BUSINESS_RULE_VIRADA_COMPETENCIA": 0,
      "OUTROS_400": 0,
    };
    const by429Subtype: Record<Auth429Subtype, number> = {
      "RATE_LIMIT_DATAPREV_TOO_MANY_REQUESTS": 0,
      "OUTROS_429": 0,
    };
    const reasons400: Record<string, number> = {};
    const reasons429: Record<string, number> = {};

    const isExcludedReason = (reason: string): boolean => {
      const r = reason.trim().toLowerCase();
      if (r === "invalid_business_rule" || r === "too_many_requests") return true;

      const normalized = r.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Duplicados já exibidos como subtipo/label
      const isFormularioInvalido = normalized.includes("validar") && normalized.includes("dados") && normalized.includes("formulario");
      const isCpfNaoEncontrado =
        normalized.includes("cpf") &&
        normalized.includes("nao encontrado") &&
        normalized.includes("base");
      const isViradaCompetencia = normalized.includes("virada") && normalized.includes("competencia");

      // Excluir o motivo genérico "Limite excedido" pois já existe "Limite excedido no DataPrev"
      const isLimiteExcedidoGenerico = normalized === "limite excedido";

      return isFormularioInvalido || isCpfNaoEncontrado || isViradaCompetencia || isLimiteExcedidoGenerico;
    };

    for (const l of annotated) {
      byCategory[l.authCategory]++;
      if (l.authCategory === "ERRO_400") {
        if (l.auth400Subtype) by400Subtype[l.auth400Subtype]++;
        if (l.authReason && !isExcludedReason(l.authReason)) {
          reasons400[l.authReason] = (reasons400[l.authReason] || 0) + 1;
        }
      }
      if (l.authCategory === "ERRO_429") {
        if (l.auth429Subtype) by429Subtype[l.auth429Subtype]++;
        if (l.authReason && !isExcludedReason(l.authReason)) {
          reasons429[l.authReason] = (reasons429[l.authReason] || 0) + 1;
        }
      }
    }

    const topReasons400 = Object.entries(reasons400)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topReasons429 = Object.entries(reasons429)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: annotated.length,
      byCategory,
      by400Subtype,
      by429Subtype,
      topReasons400,
      topReasons429,
    };
  }, [annotated]);

  const chartData = useMemo<AuthChartDatum[]>(() => {
    const labelMap: Record<AuthCategory, string> = {
      EXISTING_AUTH: "Autorização já existente",
      TOKEN: "Token/Link",
      ERRO_400: "Erro 400",
      ERRO_429: "Erro 429",
      OUTROS: "Outros",
      VAZIO: "Vazio",
    };

    return (Object.keys(totals.byCategory) as AuthCategory[]).map((k) => ({
      key: k,
      name: labelMap[k],
      value: totals.byCategory[k],
    }));
  }, [totals.byCategory]);

  const filteredLeads = useMemo(() => {
    let list = annotated;
    if (selectedCategory !== "TODOS") {
      list = list.filter((l) => l.authCategory === selectedCategory);
    }
    if (selectedReason) {
      list = list.filter((l) => l.authReason === selectedReason);
    }
    if (selectedCategory === "ERRO_400" && selected400Subtype) {
      list = list.filter((l) => l.auth400Subtype === selected400Subtype);
    }
    if (selectedCategory === "ERRO_429" && selected429Subtype) {
      list = list.filter((l) => l.auth429Subtype === selected429Subtype);
    }
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase();
      list = list.filter((l) => l.cpf.includes(term) || (l.nome?.toLowerCase().includes(term) ?? false));
    }
    if (selectedErrorType !== "TODOS") {
      list = list.filter((l) => l.authCategory === selectedErrorType);
    }
    return list;
  }, [annotated, selectedCategory, selectedReason, selected400Subtype, selected429Subtype, debouncedSearch, selectedErrorType]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredLeads.length / pageSize)), [filteredLeads.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, page]);

  const clearSelection = () => {
    setSelectedCategory("TODOS");
    setSelectedReason(null);
    setSelected400Subtype(null);
    setSelected429Subtype(null);
    setSearchTerm("");
    setSelectedErrorType("TODOS");
    setPage(1);
  };

  if (dashboardStats.totalLeads === 0 && !isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Autorizações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center">
            <Shield className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma autorização encontrada</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Importe seus leads para visualizar a distribuição de retorno de autorização.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <LeadDetailDialog
        lead={lead ? (lead as unknown as LeadData) : null}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedLeadId(null);
        }}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Autorizações</h2>
          <p className="text-sm text-muted-foreground">
            Distribuição do campo <span className="font-mono">retorno_autorizacao</span> (clique nos KPIs/gráfico para filtrar)
          </p>
        </div>

        {(selectedCategory !== "TODOS" || selectedReason) && (
          <Button variant="outline" onClick={clearSelection}>
            Limpar filtro
          </Button>
        )}
      </div>

      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 text-destructive flex items-center gap-2">
            <TriangleAlert className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-6">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("TODOS");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Total" value={totals.total.toLocaleString("pt-BR")} icon={Shield} variant="default" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("EXISTING_AUTH");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Já existia" value={totals.byCategory.EXISTING_AUTH.toLocaleString("pt-BR")} icon={CheckCircle} variant="success" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("TOKEN");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Token/Link" value={totals.byCategory.TOKEN.toLocaleString("pt-BR")} icon={Link2} variant="default" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("ERRO_400");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Erro 400" value={totals.byCategory.ERRO_400.toLocaleString("pt-BR")} icon={AlertTriangle} variant="danger" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("ERRO_429");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Erro 429" value={totals.byCategory.ERRO_429.toLocaleString("pt-BR")} icon={Clock} variant="warning" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory("OUTROS");
            setSelectedReason(null);
            setSelected400Subtype(null);
            setSelected429Subtype(null);
            setSelectedErrorType("TODOS");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Outros" value={totals.byCategory.OUTROS.toLocaleString("pt-BR")} icon={Shield} variant="default" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
        <Card className="glass-card">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="text-base lg:text-lg font-semibold text-foreground">Distribuição por tipo</CardTitle>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Clique em uma barra para filtrar</p>
          </CardHeader>
          <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const p = payload[0].payload as AuthChartDatum;
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-sm text-muted-foreground">{Number(p.value || 0).toLocaleString("pt-BR")} leads</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    onClick={(data: unknown) => {
                      if (!data || typeof data !== "object" || !("key" in data)) return;
                      setSelectedCategory((data as AuthChartDatum).key);
                      setSelectedReason(null);
                      setSelected400Subtype(null);
                      setSelected429Subtype(null);
                      setSelectedErrorType("TODOS");
                      setPage(1);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="text-base lg:text-lg font-semibold text-foreground">Motivos (400 / 429)</CardTitle>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">Clique em um motivo para filtrar a lista</p>
          </CardHeader>
          <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top erros 400</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(
                      [
                        "INVALID_FORM_PHONE_NUMBER",
                        "BUSINESS_RULE_CPF_NAO_ENCONTRADO",
                        "BUSINESS_RULE_VIRADA_COMPETENCIA",
                        "OUTROS_400",
                      ] as const
                    ).map((sub) => (
                      <button
                        key={sub}
                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm ${
                          selectedCategory === "ERRO_400" && selected400Subtype === sub
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/30 hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedCategory("ERRO_400");
                          setSelected400Subtype(sub);
                          setSelected429Subtype(null);
                          setSelectedReason(null);
                          setPage(1);
                        }}
                      >
                        <Badge variant="secondary">Erro 400 - {auth400SubtypeLabel(sub)}</Badge>
                        <span className="text-muted-foreground">{totals.by400Subtype[sub].toLocaleString("pt-BR")}</span>
                      </button>
                    ))}
                  </div>
                  {totals.topReasons400.length === 0 ? null : (
                    <div className="flex flex-wrap gap-2">
                      {totals.topReasons400.map((r) => (
                        <button
                          key={r.reason}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/50 text-sm"
                          onClick={() => {
                            setSelectedCategory("ERRO_400");
                            setSelectedReason(r.reason);
                            setSelected400Subtype(null);
                            setSelected429Subtype(null);
                            setPage(1);
                          }}
                        >
                          <Badge variant="secondary">{r.reason}</Badge>
                          <span className="text-muted-foreground">{r.count.toLocaleString("pt-BR")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top erros 429</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(
                      ["RATE_LIMIT_DATAPREV_TOO_MANY_REQUESTS", "OUTROS_429"] as const
                    ).map((sub) => (
                      <button
                        key={sub}
                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm ${
                          selectedCategory === "ERRO_429" && selected429Subtype === sub
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/30 hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedCategory("ERRO_429");
                          setSelected429Subtype(sub);
                          setSelected400Subtype(null);
                          setSelectedReason(null);
                          setPage(1);
                        }}
                      >
                        <Badge variant="secondary">Erro 429 - {auth429SubtypeLabel(sub)}</Badge>
                        <span className="text-muted-foreground">{totals.by429Subtype[sub].toLocaleString("pt-BR")}</span>
                      </button>
                    ))}
                  </div>
                  {totals.topReasons429.length === 0 ? null : (
                    <div className="flex flex-wrap gap-2">
                      {totals.topReasons429.map((r) => (
                        <button
                          key={r.reason}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/50 text-sm"
                          onClick={() => {
                            setSelectedCategory("ERRO_429");
                            setSelectedReason(r.reason);
                            setSelected400Subtype(null);
                            setSelected429Subtype(null);
                            setPage(1);
                          }}
                        >
                          <Badge variant="secondary">{r.reason}</Badge>
                          <span className="text-muted-foreground">{r.count.toLocaleString("pt-BR")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg">Leads (retorno autorização)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Mostrando {filteredLeads.length.toLocaleString("pt-BR")} registros
                {selectedCategory !== "TODOS" ? ` | Filtro: ${selectedCategory}` : ""}
                {selectedCategory === "ERRO_400" && selected400Subtype ? ` | Subtipo 400: ${auth400SubtypeLabel(selected400Subtype)}` : ""}
                {selectedCategory === "ERRO_429" && selected429Subtype ? ` | Subtipo 429: ${selected429Subtype}` : ""}
                {selectedReason ? ` | Motivo: ${selectedReason}` : ""}
                {debouncedSearch.trim() ? ` | Busca: ${debouncedSearch}` : ""}
                {selectedErrorType !== "TODOS" ? ` | Tipo erro: ${selectedErrorType}` : ""}
              </p>
            </div>
            <Button variant="outline" onClick={fetchAuthorizationLeads} disabled={isLoading}>
              {isLoading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por CPF ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              disabled={!searchTerm.trim()}
            >
              Limpar busca
            </Button>
            <div className="relative">
              <Select
                value={selectedErrorType}
                onValueChange={(value) => {
                  setSelectedErrorType(value as AuthCategory | "TODOS");
                  setSelectedCategory("TODOS");
                  setSelectedReason(null);
                  setSelected400Subtype(null);
                  setSelected429Subtype(null);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Tipo de erro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="EXISTING_AUTH">Já existia</SelectItem>
                  <SelectItem value="TOKEN">Token/Link</SelectItem>
                  <SelectItem value="ERRO_400">Erro 400</SelectItem>
                  <SelectItem value="ERRO_429">Erro 429</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                  <SelectItem value="VAZIO">Vazio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-10 h-10 mb-4 animate-spin" />
              <p className="text-lg font-medium text-foreground">Carregando autorizações...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-10 h-10 mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground">Nenhum registro encontrado</p>
              <p className="text-sm mt-1">Ajuste os filtros ou limpe a seleção</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-center">CPF</TableHead>
                      <TableHead className="text-muted-foreground text-center">Nome</TableHead>
                      <TableHead className="text-muted-foreground text-center">Banco</TableHead>
                      <TableHead className="text-muted-foreground text-center">Tipo</TableHead>
                      <TableHead className="text-muted-foreground text-center">Motivo</TableHead>
                      <TableHead className="text-muted-foreground text-center">Erros</TableHead>
                      <TableHead className="text-muted-foreground text-center">Data</TableHead>
                      <TableHead className="text-muted-foreground text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((l) => {
                      const numErros = contarErrosLead(l);
                      return (
                        <TableRow key={l.id} className="border-border/50 hover:bg-muted/30">
                          <TableCell className="font-mono text-foreground text-center">{formatCpf(l.cpf)}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[180px] text-center">{l.nome || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-center">{l.banco || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{l.authLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-center max-w-[200px] truncate">{l.authReason || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={numErros > 1 ? "destructive" : "secondary"}>
                              {numErros} {numErros === 1 ? 'erro' : 'erros'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap text-center">{formatDateTime(l.created_at)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setSelectedLeadId(l.id);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-3 text-sm text-muted-foreground">{page}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOsPanel;
