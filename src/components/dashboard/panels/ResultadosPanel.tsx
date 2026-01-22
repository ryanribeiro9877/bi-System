import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Loader2,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
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

type StatusAutorizacao = "EXISTING_AUTH" | "TOKEN" | "ERRO_400" | "ERRO_429" | "OUTROS" | "VAZIO";

type StatusConsultaMargem = "OK" | "ERRO_400" | "ERRO_429" | "ERRO_OUTRO" | "OUTRO" | "VAZIO";

type StatusProposta = "SUCCESS" | "ERRO_400" | "ERRO_429" | "OUTRO" | "VAZIO";

type ResultadoNegocio =
  | "APROVADO"
  | "ELEGIVEL"
  | "INELEGIVEL"
  | "SEM_MARGEM"
  | "SEM_CONSULTA_MARGEM"
  | "ERRO_CONSULTA_MARGEM"
  | "NAO_AVALIADO";

type ResultsLeadRow = {
  id: string;
  cpf: string;
  nome: string | null;
  banco: string | null;
  status: string | null;
  valor: number | null;
  created_at: string;
  retorno_autorizacao: unknown;
  retorno_margem: unknown;
  retorno_simulacao: unknown;
  retorno_proposta: unknown;
  retorno_get_proposta: unknown;
};

type PropostaErroInfo = {
  origem: "Proposta" | "Get Proposta" | "Simulação";
  erro: string;
  motivo: string | null;
};

type AnnotatedResultsLead = ResultsLeadRow & {
  statusAutorizacao: StatusAutorizacao;
  statusAutorizacaoLabel: string;
  statusConsultaMargem: StatusConsultaMargem;
  statusConsultaMargemLabel: string;
  statusProposta: StatusProposta;
  statusPropostaLabel: string;
  resultadoNegocio: ResultadoNegocio;
  resultadoNegocioLabel: string;
  propostaErro: PropostaErroInfo | null;
};

type ResultsChartDatum = {
  key: ResultadoNegocio;
  name: string;
  value: number;
};

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

const stringifyUnknown = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const hasHttpStatus = (text: string, status: number): boolean => {
  if (!text) return false;
  return new RegExp(`status\\D{0,15}${status}`, "i").test(text);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseValorNumerico = (valor: unknown): number | null => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const cleaned = valor.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const pickFirstString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const parseJsonString = (value: string): unknown | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
};

const extractErrorInfoFromRecord = (record: Record<string, unknown>): { erro: string; motivo: string | null } | null => {
  const errorCandidate = pickFirstString(record.error, record.message);
  const statusCandidate = typeof record.status === "string" ? record.status.trim() : null;
  const normalizedStatus = statusCandidate ? statusCandidate.toLowerCase() : null;
  const statusAsError = normalizedStatus && !["success", "ok", "approved"].includes(normalizedStatus) ? statusCandidate : null;
  const errorBase = pickFirstString(errorCandidate, statusAsError);
  const details = isRecord(record.details) ? record.details : null;

  const reasonCandidate = details
    ? pickFirstString(details.reason, details.message, details.detail, details.error)
    : null;

  const errorsArray = Array.isArray(details?.errors) ? details?.errors : Array.isArray(record.errors) ? record.errors : null;
  const errorsList = errorsArray
    ? errorsArray
        .map((item) => {
          if (typeof item === "string") return item;
          if (isRecord(item)) return pickFirstString(item.message, item.error, item.reason, item.detail);
          return null;
        })
        .filter(Boolean)
        .join("; ")
    : null;

  const formErrorsArray = Array.isArray(details?.formErrors) ? details.formErrors : null;
  const formErrors = formErrorsArray
    ? formErrorsArray
        .map((item) => {
          if (typeof item === "string") return item;
          if (isRecord(item)) return pickFirstString(item.message, item.messageError, item.errorField, item.error);
          return null;
        })
        .filter(Boolean)
        .join("; ")
    : null;

  const motivo = pickFirstString(reasonCandidate, formErrors, errorsList);
  const erro = errorBase ?? motivo;
  if (!erro) return null;
  return { erro, motivo: motivo && motivo !== erro ? motivo : null };
};

const extractErrorInfo = (raw: unknown, depth = 0): { erro: string; motivo: string | null } | null => {
  if (raw === null || raw === undefined) return null;
  if (depth > 2) return null;

  if (typeof raw === "string") {
    const parsed = parseJsonString(raw);
    if (parsed) return extractErrorInfo(parsed, depth + 1);
    const trimmed = raw.trim();
    return trimmed ? { erro: trimmed, motivo: null } : null;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const info = extractErrorInfo(item, depth + 1);
      if (info) return info;
    }
    return null;
  }

  if (isRecord(raw)) {
    const direct = extractErrorInfoFromRecord(raw);
    if (direct) return direct;

    const nestedKeys = ["error", "details", "original_response", "response", "response_body", "data"];
    for (const key of nestedKeys) {
      if (key in raw) {
        const nestedInfo = extractErrorInfo(raw[key], depth + 1);
        if (nestedInfo) return nestedInfo;
      }
    }
  }

  return null;
};

const extractMargemOkInfo = (raw: unknown): { elegivel: boolean | null; valorMargemDisponivel: number | null } => {
  const pickFromResult = (candidate: unknown): { elegivel: boolean | null; valorMargemDisponivel: number | null } | null => {
    if (!isRecord(candidate)) return null;
    const elegivel = typeof candidate["elegivel"] === "boolean" ? candidate["elegivel"] : null;
    const valorMargemDisponivel = parseValorNumerico(candidate["valorMargemDisponivel"]);
    if (elegivel === null && valorMargemDisponivel === null) return null;
    return { elegivel, valorMargemDisponivel };
  };

  const consider = (node: unknown): { elegivel: boolean | null; valorMargemDisponivel: number | null } | null => {
    if (!isRecord(node)) return null;

    const result = node["result"];
    if (Array.isArray(result) && result.length > 0) {
      const p = pickFromResult(result[0]);
      if (p) return p;
    }

    const pDirect = pickFromResult(node);
    if (pDirect) return pDirect;

    return null;
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const p = consider(item);
      if (p) return p;
    }
  } else {
    const p = consider(raw);
    if (p) return p;
  }

  return { elegivel: null, valorMargemDisponivel: null };
};

const classifyAutorizacaoStatus = (raw: unknown): { status: StatusAutorizacao; label: string } => {
  if (raw === null || raw === undefined || raw === "") {
    return { status: "VAZIO", label: "Vazio" };
  }

  if (Array.isArray(raw)) {
    const hasUuid = raw.some((v) => typeof v === "string" && UUID_RE.test(v));
    if (hasUuid) return { status: "TOKEN", label: "Token/Link" };
    return { status: "OUTROS", label: "Outros" };
  }

  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const status = typeof obj.status === "string" ? obj.status : "";
    const code = typeof obj.code === "string" ? obj.code : "";
    const message = typeof obj.message === "string" ? obj.message : "";
    const error = typeof obj.error === "string" ? obj.error : "";

    if (
      status.toLowerCase().trim() === "existing_authorization" ||
      code.toUpperCase().trim() === "EXISTING_AUTH" ||
      message.toLowerCase().includes("autorização já existente")
    ) {
      return { status: "EXISTING_AUTH", label: "Autorização já existente" };
    }

    const full = stringifyUnknown(raw);
    if (hasHttpStatus(error, 400) || hasHttpStatus(full, 400)) return { status: "ERRO_400", label: "Erro 400" };
    if (hasHttpStatus(error, 429) || hasHttpStatus(full, 429)) return { status: "ERRO_429", label: "Erro 429" };

    const autorizacaoId = typeof obj.autorizacaoId === "string" ? obj.autorizacaoId : "";
    if (autorizacaoId && UUID_RE.test(autorizacaoId)) {
      return { status: "TOKEN", label: "Token/Link" };
    }

    const shortUrl = typeof obj.shortUrl === "string" ? obj.shortUrl : "";
    if (shortUrl) {
      return { status: "TOKEN", label: "Token/Link" };
    }

    const lower = full.toLowerCase();
    if (lower.includes("existing_authorization") || lower.includes("existing_auth") || lower.includes("autorização já existente")) {
      return { status: "EXISTING_AUTH", label: "Autorização já existente" };
    }
    if (UUID_RE.test(full)) return { status: "TOKEN", label: "Token/Link" };
    return { status: "OUTROS", label: "Outros" };
  }

  const s = stringifyUnknown(raw);
  if (hasHttpStatus(s, 400)) return { status: "ERRO_400", label: "Erro 400" };
  if (hasHttpStatus(s, 429)) return { status: "ERRO_429", label: "Erro 429" };
  const lower = s.toLowerCase();
  if (lower.includes("existing_authorization") || lower.includes("existing_auth") || lower.includes("autorização já existente")) {
    return { status: "EXISTING_AUTH", label: "Autorização já existente" };
  }
  if (UUID_RE.test(s)) return { status: "TOKEN", label: "Token/Link" };
  return { status: "OUTROS", label: "Outros" };
};

const classifyConsultaMargem = (raw: unknown): { status: StatusConsultaMargem; label: string } => {
  if (raw === null || raw === undefined || raw === "") {
    return { status: "VAZIO", label: "Vazio" };
  }

  const full = stringifyUnknown(raw);
  if (hasHttpStatus(full, 400)) return { status: "ERRO_400", label: "Erro 400" };
  if (hasHttpStatus(full, 429)) return { status: "ERRO_429", label: "Erro 429" };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const st = typeof item["status"] === "string" ? item["status"].toLowerCase().trim() : "";
      if (st === "ok") return { status: "OK", label: "OK" };
      if (item["error"]) return { status: "ERRO_OUTRO", label: "Erro" };
    }
  } else if (isRecord(raw)) {
    const st = typeof raw["status"] === "string" ? raw["status"].toLowerCase().trim() : "";
    if (st === "ok") return { status: "OK", label: "OK" };
    if (raw["error"]) return { status: "ERRO_OUTRO", label: "Erro" };
  }

  return { status: "OUTRO", label: "Outro" };
};

const classifyProposta = (raw: unknown): { status: StatusProposta; label: string } => {
  if (raw === null || raw === undefined || raw === "") {
    return { status: "VAZIO", label: "Vazio" };
  }

  const full = stringifyUnknown(raw);
  if (hasHttpStatus(full, 400)) return { status: "ERRO_400", label: "Erro 400" };
  if (hasHttpStatus(full, 429)) return { status: "ERRO_429", label: "Erro 429" };

  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const st = typeof item["status"] === "string" ? item["status"].toLowerCase().trim() : "";
    if (st === "success") return { status: "SUCCESS", label: "Success" };
    if (st) return { status: "OUTRO", label: "Outro" };
  }

  if (/"status"\s*:\s*"success"/i.test(full)) return { status: "SUCCESS", label: "Success" };
  return { status: "OUTRO", label: "Outro" };
};

const deriveResultadoNegocio = (params: {
  marginStatus: StatusConsultaMargem;
  marginRaw: unknown;
  propostaStatus: StatusProposta;
}): { resultado: ResultadoNegocio; label: string } => {
  if (params.propostaStatus === "SUCCESS") return { resultado: "APROVADO", label: "Aprovado" };

  if (params.marginStatus === "OK") {
    const info = extractMargemOkInfo(params.marginRaw);
    if (info.elegivel === false) return { resultado: "INELEGIVEL", label: "Inelegível" };
    if (info.valorMargemDisponivel !== null && info.valorMargemDisponivel <= 0) {
      return { resultado: "SEM_MARGEM", label: "Sem margem" };
    }
    if (info.elegivel === true) return { resultado: "ELEGIVEL", label: "Elegível" };
    return { resultado: "NAO_AVALIADO", label: "Não avaliado" };
  }

  if (params.marginStatus === "VAZIO") return { resultado: "SEM_CONSULTA_MARGEM", label: "Sem consulta" };
  if (params.marginStatus === "ERRO_400" || params.marginStatus === "ERRO_429" || params.marginStatus === "ERRO_OUTRO") {
    return { resultado: "ERRO_CONSULTA_MARGEM", label: "Erro consulta" };
  }

  return { resultado: "NAO_AVALIADO", label: "Não avaliado" };
};

const ResultadosPanel = () => {
  const { stats: dashboardStats, filters } = useDashboard();
  const [resultsLeads, setResultsLeads] = useState<ResultsLeadRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedResultado, setSelectedResultado] = useState<ResultadoNegocio | "TODOS">("TODOS");
  const [selectedAutorizacao, setSelectedAutorizacao] = useState<StatusAutorizacao | "TODOS">("TODOS");
  const [selectedConsultaMargem, setSelectedConsultaMargem] = useState<StatusConsultaMargem | "TODOS">("TODOS");
  const [selectedProposta, setSelectedProposta] = useState<StatusProposta | "TODOS">("TODOS");

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useMemo(() => searchTerm, [searchTerm]);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { lead } = useLeadDetails(selectedLeadId);

  const [loadingProgress, setLoadingProgress] = useState<{ fetched: number; batches: number } | null>(null);

  const fetchResultadosLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ fetched: 0, batches: 0 });
    setResultsLeads([]);

    try {
      const pageSizeFetch = 1000;
      let from = 0;
      let allRows: ResultsLeadRow[] = [];

      const buildBaseQuery = () => {
        let query = supabase
          .from("leads")
          .select(
            "id, cpf, nome, banco, status, valor, created_at, retorno_autorizacao, retorno_margem, retorno_simulacao, retorno_proposta, retorno_get_proposta, import_batch_id"
          )
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
        const mapped: ResultsLeadRow[] = batch.map((row) => ({
          id: String(row.id ?? ""),
          cpf: String(row.cpf ?? ""),
          nome: (row.nome as string) ?? null,
          banco: (row.banco as string) ?? null,
          status: (row.status as string) ?? null,
          valor: typeof row.valor === "number" ? row.valor : row.valor === null || row.valor === undefined ? null : Number(row.valor),
          created_at: String(row.created_at ?? ""),
          retorno_autorizacao: row.retorno_autorizacao,
          retorno_margem: row.retorno_margem,
          retorno_simulacao: row.retorno_simulacao,
          retorno_proposta: row.retorno_proposta,
          retorno_get_proposta: row.retorno_get_proposta,
        }));

        allRows = allRows.concat(mapped);
        setResultsLeads(allRows);
        setLoadingProgress((prev) => ({ fetched: (prev?.fetched ?? 0) + mapped.length, batches: (prev?.batches ?? 0) + 1 }));

        if (batch.length < pageSizeFetch) break;
        from += pageSizeFetch;
      }

      setResultsLeads(allRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar resultados");
      setResultsLeads([]);
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [filters]);

  useEffect(() => {
    fetchResultadosLeads();
    setSelectedResultado("TODOS");
    setSelectedAutorizacao("TODOS");
    setSelectedConsultaMargem("TODOS");
    setSelectedProposta("TODOS");
    setSearchTerm("");
    setPage(1);
  }, [fetchResultadosLeads]);

  const annotated = useMemo<AnnotatedResultsLead[]>(() => {
    return resultsLeads.map((l) => {
      const a = classifyAutorizacaoStatus(l.retorno_autorizacao);
      const m = classifyConsultaMargem(l.retorno_margem);
      const p = classifyProposta(l.retorno_proposta);
      const n = deriveResultadoNegocio({ marginStatus: m.status, marginRaw: l.retorno_margem, propostaStatus: p.status });
      const propostaErroBase = p.status === "SUCCESS"
        ? null
        : (() => {
            const propostaInfo = extractErrorInfo(l.retorno_proposta);
            if (propostaInfo) return { origem: "Proposta", ...propostaInfo } as PropostaErroInfo;
            const getInfo = extractErrorInfo(l.retorno_get_proposta);
            if (getInfo) return { origem: "Get Proposta", ...getInfo } as PropostaErroInfo;
            const simInfo = extractErrorInfo(l.retorno_simulacao);
            if (simInfo) return { origem: "Simulação", ...simInfo } as PropostaErroInfo;
            return null;
          })();

      const propostaLabel = (() => {
        if (p.status === "SUCCESS") return p.label;
        if (propostaErroBase) {
          const base = `${propostaErroBase.origem}: ${propostaErroBase.erro}`;
          return propostaErroBase.motivo ? `${base} | ${propostaErroBase.motivo}` : base;
        }
        return p.label;
      })();

      const propostaStatus = (() => {
        if (p.status === "SUCCESS") return "SUCCESS" as StatusProposta;
        if (propostaErroBase) {
          const text = `${propostaErroBase.erro} ${propostaErroBase.motivo ?? ""}`;
          if (hasHttpStatus(text, 400)) return "ERRO_400";
          if (hasHttpStatus(text, 429)) return "ERRO_429";
          return "OUTRO";
        }
        return p.status;
      })();

      return {
        ...l,
        statusAutorizacao: a.status,
        statusAutorizacaoLabel: a.label,
        statusConsultaMargem: m.status,
        statusConsultaMargemLabel: m.label,
        statusProposta: propostaStatus,
        statusPropostaLabel: propostaLabel,
        resultadoNegocio: n.resultado,
        resultadoNegocioLabel: n.label,
        propostaErro: propostaErroBase,
      };
    });
  }, [resultsLeads]);

  const totals = useMemo(() => {
    const byResultado: Record<ResultadoNegocio, number> = {
      APROVADO: 0,
      ELEGIVEL: 0,
      INELEGIVEL: 0,
      SEM_MARGEM: 0,
      SEM_CONSULTA_MARGEM: 0,
      ERRO_CONSULTA_MARGEM: 0,
      NAO_AVALIADO: 0,
    };
    const byAutorizacao: Record<StatusAutorizacao, number> = {
      EXISTING_AUTH: 0,
      TOKEN: 0,
      ERRO_400: 0,
      ERRO_429: 0,
      OUTROS: 0,
      VAZIO: 0,
    };
    const byConsultaMargem: Record<StatusConsultaMargem, number> = {
      OK: 0,
      ERRO_400: 0,
      ERRO_429: 0,
      ERRO_OUTRO: 0,
      OUTRO: 0,
      VAZIO: 0,
    };
    const byProposta: Record<StatusProposta, number> = {
      SUCCESS: 0,
      ERRO_400: 0,
      ERRO_429: 0,
      OUTRO: 0,
      VAZIO: 0,
    };

    for (const l of annotated) {
      byResultado[l.resultadoNegocio]++;
      byAutorizacao[l.statusAutorizacao]++;
      byConsultaMargem[l.statusConsultaMargem]++;
      byProposta[l.statusProposta]++;
    }

    return {
      total: annotated.length,
      byResultado,
      byAutorizacao,
      byConsultaMargem,
      byProposta,
    };
  }, [annotated]);

  const chartData = useMemo<ResultsChartDatum[]>(() => {
    const labelMap: Record<ResultadoNegocio, string> = {
      APROVADO: "Aprovado",
      ELEGIVEL: "Elegível",
      INELEGIVEL: "Inelegível",
      SEM_MARGEM: "Sem margem",
      SEM_CONSULTA_MARGEM: "Sem consulta",
      ERRO_CONSULTA_MARGEM: "Erro consulta",
      NAO_AVALIADO: "Não avaliado",
    };

    return (Object.keys(totals.byResultado) as ResultadoNegocio[]).map((k) => ({
      key: k,
      name: labelMap[k],
      value: totals.byResultado[k],
    }));
  }, [totals.byResultado]);

  const filteredLeads = useMemo(() => {
    let list = annotated;

    if (selectedResultado !== "TODOS") {
      list = list.filter((l) => l.resultadoNegocio === selectedResultado);
    }
    if (selectedAutorizacao !== "TODOS") {
      list = list.filter((l) => l.statusAutorizacao === selectedAutorizacao);
    }
    if (selectedConsultaMargem !== "TODOS") {
      list = list.filter((l) => l.statusConsultaMargem === selectedConsultaMargem);
    }
    if (selectedProposta !== "TODOS") {
      list = list.filter((l) => l.statusProposta === selectedProposta);
    }

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().toLowerCase();
      list = list.filter((l) => l.cpf.includes(term) || (l.nome?.toLowerCase().includes(term) ?? false));
    }

    return list;
  }, [annotated, debouncedSearch, selectedAutorizacao, selectedConsultaMargem, selectedProposta, selectedResultado]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredLeads.length / pageSize)), [filteredLeads.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, page]);

  const clearSelection = () => {
    setSelectedResultado("TODOS");
    setSelectedAutorizacao("TODOS");
    setSelectedConsultaMargem("TODOS");
    setSelectedProposta("TODOS");
    setSearchTerm("");
    setPage(1);
  };

  if (dashboardStats.totalLeads === 0 && !isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center">
            <Shield className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum resultado encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">Importe seus leads para visualizar a distribuição de margem e proposta.</p>
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
          <h2 className="text-lg font-semibold text-foreground">Resultados</h2>
          <p className="text-sm text-muted-foreground">
            Distribuição dos campos <span className="font-mono">retorno_margem</span> e <span className="font-mono">retorno_proposta</span>
          </p>
        </div>

        {(selectedResultado !== "TODOS" ||
          selectedAutorizacao !== "TODOS" ||
          selectedConsultaMargem !== "TODOS" ||
          selectedProposta !== "TODOS" ||
          debouncedSearch.trim()) && (
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <button type="button" onClick={clearSelection} className="text-left">
          <KPICard title="Total" value={totals.total.toLocaleString("pt-BR")} icon={Shield} variant="default" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("APROVADO");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Aprovado" value={totals.byResultado.APROVADO.toLocaleString("pt-BR")} icon={CheckCircle} variant="success" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("ELEGIVEL");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Elegível" value={totals.byResultado.ELEGIVEL.toLocaleString("pt-BR")} icon={TrendingUp} variant="success" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("INELEGIVEL");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Inelegível" value={totals.byResultado.INELEGIVEL.toLocaleString("pt-BR")} icon={TrendingDown} variant="warning" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("SEM_MARGEM");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Sem margem" value={totals.byResultado.SEM_MARGEM.toLocaleString("pt-BR")} icon={TrendingDown} variant="warning" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("SEM_CONSULTA_MARGEM");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Sem consulta" value={totals.byResultado.SEM_CONSULTA_MARGEM.toLocaleString("pt-BR")} icon={TriangleAlert} variant="warning" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("ERRO_CONSULTA_MARGEM");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Erro consulta" value={totals.byResultado.ERRO_CONSULTA_MARGEM.toLocaleString("pt-BR")} icon={AlertTriangle} variant="danger" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedResultado("NAO_AVALIADO");
            setPage(1);
          }}
          className="text-left"
        >
          <KPICard title="Não avaliado" value={totals.byResultado.NAO_AVALIADO.toLocaleString("pt-BR")} icon={Shield} variant="default" />
        </button>
      </div>

      <Card className="glass-card">
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-base lg:text-lg font-semibold text-foreground">Distribuição por resultado</CardTitle>
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
                    const p = payload[0].payload as ResultsChartDatum;
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
                    setSelectedResultado((data as ResultsChartDatum).key);
                    setPage(1);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg">Leads (resultados)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Mostrando {filteredLeads.length.toLocaleString("pt-BR")} registros
                {selectedResultado !== "TODOS" ? ` | Resultado: ${selectedResultado}` : ""}
                {selectedAutorizacao !== "TODOS" ? ` | Autorização: ${selectedAutorizacao}` : ""}
                {selectedConsultaMargem !== "TODOS" ? ` | Margem: ${selectedConsultaMargem}` : ""}
                {selectedProposta !== "TODOS" ? ` | Proposta: ${selectedProposta}` : ""}
                {debouncedSearch.trim() ? ` | Busca: ${debouncedSearch}` : ""}
              </p>
            </div>
            <Button variant="outline" onClick={fetchResultadosLeads} disabled={isLoading}>
              {isLoading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por CPF ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setSearchTerm("")} disabled={!searchTerm.trim()}>
              Limpar busca
            </Button>

            <Select
              value={selectedResultado}
              onValueChange={(value) => {
                setSelectedResultado(value as ResultadoNegocio | "TODOS");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos resultados</SelectItem>
                <SelectItem value="APROVADO">Aprovado</SelectItem>
                <SelectItem value="ELEGIVEL">Elegível</SelectItem>
                <SelectItem value="INELEGIVEL">Inelegível</SelectItem>
                <SelectItem value="SEM_MARGEM">Sem margem</SelectItem>
                <SelectItem value="SEM_CONSULTA_MARGEM">Sem consulta</SelectItem>
                <SelectItem value="ERRO_CONSULTA_MARGEM">Erro consulta</SelectItem>
                <SelectItem value="NAO_AVALIADO">Não avaliado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedAutorizacao}
              onValueChange={(value) => {
                setSelectedAutorizacao(value as StatusAutorizacao | "TODOS");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Autorização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas autorizações</SelectItem>
                <SelectItem value="EXISTING_AUTH">Já existia</SelectItem>
                <SelectItem value="TOKEN">Token/Link</SelectItem>
                <SelectItem value="ERRO_400">Erro 400</SelectItem>
                <SelectItem value="ERRO_429">Erro 429</SelectItem>
                <SelectItem value="OUTROS">Outros</SelectItem>
                <SelectItem value="VAZIO">Vazio</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedConsultaMargem}
              onValueChange={(value) => {
                setSelectedConsultaMargem(value as StatusConsultaMargem | "TODOS");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Margem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas margens</SelectItem>
                <SelectItem value="OK">OK</SelectItem>
                <SelectItem value="ERRO_400">Erro 400</SelectItem>
                <SelectItem value="ERRO_429">Erro 429</SelectItem>
                <SelectItem value="ERRO_OUTRO">Erro</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
                <SelectItem value="VAZIO">Vazio</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedProposta}
              onValueChange={(value) => {
                setSelectedProposta(value as StatusProposta | "TODOS");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Proposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas propostas</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="ERRO_400">Erro 400</SelectItem>
                <SelectItem value="ERRO_429">Erro 429</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
                <SelectItem value="VAZIO">Vazio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-10 h-10 mb-4 animate-spin" />
              <p className="text-lg font-medium text-foreground">Carregando resultados...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-10 h-10 mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground">Nenhum registro encontrado</p>
              <p className="text-sm mt-1">Ajuste os filtros ou limpe a seleção</p>
            </div>
          ) : (
            <>
              {isLoading && loadingProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando... {loadingProgress.fetched.toLocaleString("pt-BR")}{" "}
                  registros (lotes: {loadingProgress.batches})
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">CPF</TableHead>
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Banco</TableHead>
                      <TableHead className="text-muted-foreground">Resultado</TableHead>
                      <TableHead className="text-muted-foreground">Autorização</TableHead>
                      <TableHead className="text-muted-foreground">Margem</TableHead>
                      <TableHead className="text-muted-foreground">Proposta</TableHead>
                      <TableHead className="text-muted-foreground">Data</TableHead>
                      <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLeads.map((l) => (
                      <TableRow key={l.id} className="border-border/50 hover:bg-muted/30">
                        <TableCell className="font-mono text-foreground">{formatCpf(l.cpf)}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[220px]">{l.nome || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{l.banco || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{l.resultadoNegocioLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{l.statusAutorizacaoLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{l.statusConsultaMargemLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {l.propostaErro ? (
                            <div className="space-y-1 max-w-[260px]" title={l.statusPropostaLabel}>
                              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {l.propostaErro.origem}
                              </span>
                              <div className="text-sm font-medium text-foreground line-clamp-2">
                                {l.propostaErro.erro}
                              </div>
                              {l.propostaErro.motivo && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {l.propostaErro.motivo}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">{l.statusPropostaLabel}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(l.created_at)}</TableCell>
                        <TableCell className="text-right">
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
                    ))}
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

export default ResultadosPanel;
