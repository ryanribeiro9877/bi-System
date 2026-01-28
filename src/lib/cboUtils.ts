import { parseJsonSafe } from "@/types/lead";

// CBO pode vir como string ou como objeto { codigo, descricao }
const formatCbo = (cbo: unknown): string | null => {
  if (!cbo) return null;

  if (typeof cbo === "string") {
    const v = cbo.trim();
    return v ? v : null;
  }

  if (typeof cbo === "object") {
    const o = cbo as Record<string, unknown>;
    const codigo = o["codigo"] ?? o["code"] ?? "";
    const descricao = o["descricao"] ?? o["description"] ?? o["name"] ?? "";

    const codeStr = codigo ? String(codigo) : "";
    const descStr = descricao ? String(descricao) : "";

    if (descStr && codeStr) return `${codeStr} - ${descStr}`.trim();
    if (descStr) return descStr.trim();
    if (codeStr) return codeStr.trim();
  }

  return null;
};

const extractResponseCompletoFromText = (
  errorText?: string
): Record<string, unknown> | null => {
  if (!errorText || typeof errorText !== "string") return null;
  const marker = "Response completo:";
  const idx = errorText.indexOf(marker);
  if (idx === -1) return null;

  const tail = errorText.slice(idx + marker.length).trim();
  const start = tail.indexOf("{");
  const end = tail.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  return parseJsonSafe<Record<string, unknown>>(tail.slice(start, end + 1));
};

// Extrai CBO de várias estruturas possíveis (UY3/Dataprev + variações)
export const extrairCBOUniversal = (retorno: unknown): string | null => {
  const margem = parseJsonSafe<any>(retorno);
  if (!margem) return null;

  // 1) UY3 Dataprev: details.dataprevValidationResponses[0].employeeRelationShip.cbo
  const dvr = margem?.details?.dataprevValidationResponses;
  if (Array.isArray(dvr) && dvr.length > 0) {
    const employee =
      dvr[0]?.employeeRelationShip ??
      dvr[0]?.employeeRelationship ??
      dvr[0]?.employeeRelationshipInfo;
    const formatted = formatCbo(employee?.cbo);
    if (formatted) return formatted;
  }

  // 2) Estrutura "result": result[0].cbo
  if (Array.isArray(margem?.result) && margem.result.length > 0) {
    const formatted = formatCbo(margem.result[0]?.cbo);
    if (formatted) return formatted;
  }

  // 3) Estrutura array: [0].result[0].cbo
  if (Array.isArray(margem) && margem[0]?.result?.[0]) {
    const formatted = formatCbo(margem[0].result[0]?.cbo);
    if (formatted) return formatted;
  }

  // 4) CBO "solto" em chaves alternativas
  const formattedLoose =
    formatCbo(margem?.registroEmpregaticio?.cbo) ||
    formatCbo(margem?.registroEmpregaticio?.occupation) ||
    formatCbo(margem?.cbo) ||
    formatCbo(margem?.occupation);
  if (formattedLoose) return formattedLoose;

  // 5) Quando vem em erro: margem.error ou details.reason podem conter "Response completo: {...}"
  const inner =
    extractResponseCompletoFromText(
      typeof margem?.error === "string" ? margem.error : undefined
    ) ||
    extractResponseCompletoFromText(
      typeof margem?.details?.reason === "string" ? margem.details.reason : undefined
    );
  if (inner) return extrairCBOUniversal(inner);

  return null;
};
