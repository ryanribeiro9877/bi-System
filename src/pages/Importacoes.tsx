import { useState, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, FileText, Check, X, Loader2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { importEvents } from "@/events/importEvents";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { parseJsonSafe } from "@/types/lead";

interface ImportRecord {
  id: string;
  file_name: string;
  file_type: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  status: string;
  created_at: string;
}

interface ParsedLead {
  cpf: string;
  nome?: string;
  banco?: string;
  cbo?: string;
  status?: string;
  tipo_reprovacao?: string;
  valor?: number;
  data_envio?: string;
  data_retorno?: string;
  observacoes?: string;
  // Novos campos JSONB
  retorno_autorizacao?: any;
  retorno_margem?: any;
  retorno_simulacao?: any;
  retorno_proposta?: any;
  retorno_get_proposta?: any;
  ultimo_log?: string;
}

// Função para extrair nome do JSON - suporta múltiplos formatos
const extrairNomeDoJson = (margem: any, simulacao?: any): string | undefined => {
  // Primeiro tenta do retorno_margem
  if (margem) {
    if (margem.registroEmpregaticio?.nomeEmpregado) return margem.registroEmpregaticio.nomeEmpregado;
    if (margem.nomeEmpregado) return margem.nomeEmpregado;
  }
  // Tenta do retorno_simulacao.details (novo formato)
  if (simulacao?.details?.name) return simulacao.details.name;
  if (simulacao?.name) return simulacao.name;
  return undefined;
};

// Função para extrair CBO do JSON - suporta múltiplos formatos
const extrairCBODoJson = (margem: any): string | undefined => {
  if (!margem) return undefined;
  if (margem.registroEmpregaticio?.cbo) return margem.registroEmpregaticio.cbo;
  if (margem.cbo) return margem.cbo;
  return undefined;
};

// Função para determinar o banco baseado em todas as fontes JSON disponíveis
const extrairBancoDoJson = (simulacao: any, autorizacao?: any, proposta?: any, getProposta?: any): string | undefined => {
  // Concatenar todos os campos possíveis para buscar padrões
  const haystack = [
    simulacao?.productName,
    simulacao?.productId,
    simulacao?.banco,
    simulacao?.details?.partnerId,
    autorizacao?.shortUrl,
    autorizacao?.banco,
    proposta?.banco,
    proposta?.instituicao,
    getProposta?.banco,
    getProposta?.instituicao,
  ].filter(Boolean).join(" ").toLowerCase();

  // Identificar banco por padrões conhecidos
  if (haystack.includes("presen") || haystack.includes("privado")) return "Presença";
  if (haystack.includes("uy3")) return "UY3";
  if (haystack.includes("v8")) return "V8";
  if (haystack.includes("safra")) return "Safra";
  if (haystack.includes("itau") || haystack.includes("itaú")) return "Itaú";
  if (haystack.includes("santander")) return "Santander";
  if (haystack.includes("bradesco")) return "Bradesco";
  if (haystack.includes("caixa")) return "Caixa";
  if (haystack.includes("bb") || haystack.includes("brasil")) return "Banco do Brasil";
  if (haystack.includes("d1231") || haystack.includes("10253")) return "D1231";

  // Se productName existe mas não encontrou padrão, usar o próprio productName
  if (simulacao?.productName) {
    return simulacao.productName;
  }

  return undefined;
};

// Função para extrair tipo de reprovação
const extrairTipoReprovacao = (simulacao: any, margem: any): string | undefined => {
  // Tenta do retorno_simulacao.details (novo formato)
  if (simulacao?.details?.error) return simulacao.details.error;
  if (simulacao?.error) return simulacao.error;
  // Tenta do retorno_margem
  if (margem?.error) return margem.error;
  return undefined;
};

// Função para extrair valor de margem disponível
const extrairValorMargem = (simulacao: any, margem: any): number | undefined => {
  // Tenta do retorno_margem
  if (margem?.valorMargemDisponivel !== undefined && margem?.valorMargemDisponivel !== null) {
    return parseFloat(margem.valorMargemDisponivel);
  }
  // Tenta do retorno_simulacao.details (novo formato)
  if (simulacao?.details?.availableMarginValue !== undefined && simulacao?.details?.availableMarginValue !== null) {
    return parseFloat(simulacao.details.availableMarginValue);
  }
  return undefined;
};

// Função para determinar status baseado nos retornos - suporta múltiplos formatos
const determinarStatus = (simulacao: any, proposta: any, getProposta: any, margem: any): string => {
  // Se tem proposta, provavelmente foi aprovado
  if (proposta && Object.keys(proposta).length > 0) return "aprovado";
  if (getProposta && Object.keys(getProposta).length > 0) return "aprovado";
  
  // Verificar status explícito no retorno_simulacao.details (novo formato)
  const detailsStatus = simulacao?.details?.status?.toUpperCase();
  if (detailsStatus === "APPROVED" || detailsStatus === "SUCCESS") return "aprovado";
  if (detailsStatus === "REJECTED" || detailsStatus === "FAILED") {
    // Verificar se é CPF não encontrado ou reprovado por margem
    const error = simulacao?.details?.error || "";
    if (error.includes("não encontrado") || error.includes("inelegível") || error.includes("não elegível")) {
      return "cpf_nao_encontrado";
    }
    return "reprovado";
  }
  
  // Se tem margem disponível > 0 = aprovado (retorno_margem)
  const valorMargem = margem?.valorMargemDisponivel;
  if (valorMargem !== undefined && valorMargem !== null && valorMargem > 0) {
    return "aprovado";
  }
  
  // Se tem availableMarginValue > 0 = aprovado (retorno_simulacao.details)
  const availableMargin = simulacao?.details?.availableMarginValue;
  if (availableMargin !== undefined && availableMargin !== null && parseFloat(availableMargin) > 0) {
    return "aprovado";
  }
  
  // Se não tem margem ou tem erro = CPF não encontrado ou reprovado
  if (!margem && !simulacao?.details) {
    return "cpf_nao_encontrado";
  }
  
  // Se tem erro de timeout ou rate limit = CPF não encontrado
  const erro = margem?.error || simulacao?.error || "";
  if (erro.includes("timeout") || erro.includes("cURL error") || erro.includes("Rate limit")) {
    return "cpf_nao_encontrado";
  }
  
  // Se tem margem <= 0 ou erro de margem indisponível = reprovado
  return "reprovado";
};

const Importacoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [previewData, setPreviewData] = useState<ParsedLead[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch import history
  const fetchImports = useCallback(async () => {
    const { data, error } = await supabase
      .from("imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setImports(data);
    }
  }, []);

  // Load imports on mount
  useEffect(() => {
    if (user) {
      fetchImports();
    }
  }, [user, fetchImports]);

  const normalizeColumnName = (col: string): string => {
    const normalized = col.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_");
    
    const mappings: Record<string, string> = {
      // Mapeamentos originais
      "cpf": "cpf",
      "documento": "cpf",
      "nome": "nome",
      "nome_completo": "nome",
      "banco": "banco",
      "instituicao": "banco",
      "cbo": "cbo",
      "ocupacao": "cbo",
      "status": "status",
      "situacao": "status",
      "tipo_reprovacao": "tipo_reprovacao",
      "motivo_reprovacao": "tipo_reprovacao",
      "motivo": "tipo_reprovacao",
      "valor": "valor",
      "valor_contrato": "valor",
      "data_envio": "data_envio",
      "data_retorno": "data_retorno",
      "observacoes": "observacoes",
      "obs": "observacoes",
      // Novos mapeamentos para os campos JSON
      "retorno_autorizacao": "retorno_autorizacao",
      "retorno_margem": "retorno_margem",
      "retorno_simulacao": "retorno_simulacao",
      "retorno_proposta": "retorno_proposta",
      "retorno_get_proposta": "retorno_get_proposta",
      "ultimo_log": "ultimo_log",
    };

    return mappings[normalized] || normalized;
  };

  // Função para converter data do Excel para string formatada
  const parseExcelDate = (value: any): string | undefined => {
    if (!value) return undefined;
    
    // Se já é uma string no formato esperado, retorna direto
    if (typeof value === 'string') {
      // Verificar se já está no formato correto (YYYY-MM-DD HH:MM:SS ou similar)
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
        return value;
      }
    }
    
    // Se é um número serial do Excel
    if (typeof value === 'number') {
      // Excel usa epoch 1900-01-01, com bug do ano bissexto
      // Número serial = dias desde 1899-12-30 (Excel considera 1900 como bissexto incorretamente)
      const excelEpoch = new Date(1899, 11, 30);
      const days = Math.floor(value);
      const fraction = value - days;
      
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      
      // Calcular horas, minutos, segundos da fração do dia
      const totalSeconds = Math.round(fraction * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
    }
    
    return String(value);
  };

  const parseExcel = (file: File): Promise<ParsedLead[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          // Usar raw: true para obter números seriais de datas, depois converter manualmente
          const workbook = XLSX.read(data, { type: "array", cellDates: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
          
          const leads: ParsedLead[] = jsonData.map((row: any) => {
            const lead: ParsedLead = { cpf: "" };
            
            // Processar cada coluna
            Object.keys(row).forEach(key => {
              const normalizedKey = normalizeColumnName(key);
              const value = row[key];
              
              if (normalizedKey === "cpf") {
                lead.cpf = String(value).replace(/\D/g, "");
              } else if (normalizedKey === "nome") {
                lead.nome = value;
              } else if (normalizedKey === "banco") {
                lead.banco = value;
              } else if (normalizedKey === "cbo") {
                lead.cbo = value;
              } else if (normalizedKey === "status") {
                lead.status = value;
              } else if (normalizedKey === "tipo_reprovacao") {
                lead.tipo_reprovacao = value;
              } else if (normalizedKey === "valor") {
                lead.valor = parseFloat(value) || undefined;
              } else if (normalizedKey === "data_envio") {
                lead.data_envio = value;
              } else if (normalizedKey === "data_retorno") {
                lead.data_retorno = value;
              } else if (normalizedKey === "observacoes") {
                lead.observacoes = value;
              } else if (normalizedKey === "retorno_autorizacao") {
                lead.retorno_autorizacao = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_margem") {
                lead.retorno_margem = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_simulacao") {
                lead.retorno_simulacao = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_proposta") {
                lead.retorno_proposta = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_get_proposta") {
                lead.retorno_get_proposta = parseJsonSafe(value);
              } else if (normalizedKey === "ultimo_log") {
                lead.ultimo_log = parseExcelDate(value);
              }
            });
            
            // Extrair dados adicionais dos JSONs se não foram preenchidos diretamente
            if (!lead.nome) {
              lead.nome = extrairNomeDoJson(lead.retorno_margem, lead.retorno_simulacao);
            }
            if (!lead.cbo) {
              lead.cbo = extrairCBODoJson(lead.retorno_margem);
            }
            if (!lead.banco) {
              lead.banco = extrairBancoDoJson(
                lead.retorno_simulacao, 
                lead.retorno_autorizacao, 
                lead.retorno_proposta, 
                lead.retorno_get_proposta
              );
            }
            if (!lead.status) {
              lead.status = determinarStatus(lead.retorno_simulacao, lead.retorno_proposta, lead.retorno_get_proposta, lead.retorno_margem);
            }
            // Extrair tipo de reprovação se status for reprovado
            if (!lead.tipo_reprovacao && lead.status === "reprovado") {
              lead.tipo_reprovacao = extrairTipoReprovacao(lead.retorno_simulacao, lead.retorno_margem);
            }
            // Extrair valor da margem disponível
            if (!lead.valor) {
              lead.valor = extrairValorMargem(lead.retorno_simulacao, lead.retorno_margem);
            }
            
            return lead;
          });
          
          resolve(leads.filter(l => l.cpf));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseCSV = (file: File): Promise<ParsedLead[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const leads: ParsedLead[] = results.data.map((row: any) => {
            const lead: ParsedLead = { cpf: "" };
            
            Object.keys(row).forEach(key => {
              const normalizedKey = normalizeColumnName(key);
              const value = row[key];
              
              if (normalizedKey === "cpf") {
                lead.cpf = String(value).replace(/\D/g, "");
              } else if (normalizedKey === "nome") {
                lead.nome = value;
              } else if (normalizedKey === "banco") {
                lead.banco = value;
              } else if (normalizedKey === "cbo") {
                lead.cbo = value;
              } else if (normalizedKey === "status") {
                lead.status = value;
              } else if (normalizedKey === "tipo_reprovacao") {
                lead.tipo_reprovacao = value;
              } else if (normalizedKey === "valor") {
                lead.valor = parseFloat(value) || undefined;
              } else if (normalizedKey === "data_envio") {
                lead.data_envio = value;
              } else if (normalizedKey === "data_retorno") {
                lead.data_retorno = value;
              } else if (normalizedKey === "observacoes") {
                lead.observacoes = value;
              } else if (normalizedKey === "retorno_autorizacao") {
                lead.retorno_autorizacao = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_margem") {
                lead.retorno_margem = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_simulacao") {
                lead.retorno_simulacao = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_proposta") {
                lead.retorno_proposta = parseJsonSafe(value);
              } else if (normalizedKey === "retorno_get_proposta") {
                lead.retorno_get_proposta = parseJsonSafe(value);
              } else if (normalizedKey === "ultimo_log") {
                lead.ultimo_log = value;
              }
            });
            
            // Extrair dados adicionais dos JSONs
            if (!lead.nome) {
              lead.nome = extrairNomeDoJson(lead.retorno_margem, lead.retorno_simulacao);
            }
            if (!lead.cbo) {
              lead.cbo = extrairCBODoJson(lead.retorno_margem);
            }
            if (!lead.banco) {
              lead.banco = extrairBancoDoJson(
                lead.retorno_simulacao, 
                lead.retorno_autorizacao, 
                lead.retorno_proposta, 
                lead.retorno_get_proposta
              );
            }
            if (!lead.status) {
              lead.status = determinarStatus(lead.retorno_simulacao, lead.retorno_proposta, lead.retorno_get_proposta, lead.retorno_margem);
            }
            // Extrair tipo de reprovação se status for reprovado
            if (!lead.tipo_reprovacao && lead.status === "reprovado") {
              lead.tipo_reprovacao = extrairTipoReprovacao(lead.retorno_simulacao, lead.retorno_margem);
            }
            // Extrair valor da margem disponível
            if (!lead.valor) {
              lead.valor = extrairValorMargem(lead.retorno_simulacao, lead.retorno_margem);
            }
            
            return lead;
          });
          
          resolve(leads.filter(l => l.cpf));
        },
        error: reject,
      });
    });
  };

  const handleFileSelect = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    
    if (!["xlsx", "xls", "csv"].includes(extension || "")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      let parsed: ParsedLead[];
      
      if (extension === "csv") {
        parsed = await parseCSV(file);
      } else {
        parsed = await parseExcel(file);
      }

      setPreviewData(parsed.slice(0, 10));
      toast({
        title: "Arquivo processado",
        description: `${parsed.length} registros encontrados. Clique em "Importar" para confirmar.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto.",
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !user) return;

    setIsProcessing(true);
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    try {
      let parsed: ParsedLead[];
      if (extension === "csv") {
        parsed = await parseCSV(selectedFile);
      } else {
        parsed = await parseExcel(selectedFile);
      }

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from("imports")
        .insert({
          file_name: selectedFile.name,
          file_type: extension || "unknown",
          total_records: parsed.length,
          imported_by: user.id,
          status: "processing",
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert leads in batches
      const batchSize = 100;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize).map(lead => ({
          cpf: lead.cpf,
          nome: lead.nome,
          banco: lead.banco,
          cbo: lead.cbo,
          status: lead.status,
          tipo_reprovacao: lead.tipo_reprovacao,
          valor: lead.valor,
          data_envio: lead.data_envio,
          data_retorno: lead.data_retorno,
          observacoes: lead.observacoes,
          retorno_autorizacao: lead.retorno_autorizacao,
          retorno_margem: lead.retorno_margem,
          retorno_simulacao: lead.retorno_simulacao,
          retorno_proposta: lead.retorno_proposta,
          retorno_get_proposta: lead.retorno_get_proposta,
          ultimo_log: lead.ultimo_log,
          import_batch_id: importRecord.id,
          imported_by: user.id,
        }));

        const { error } = await supabase.from("leads").insert(batch);
        
        if (error) {
          console.error("Erro ao inserir batch:", error);
          failCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Update import record
      await supabase
        .from("imports")
        .update({
          successful_records: successCount,
          failed_records: failCount,
          status: failCount === 0 ? "completed" : "completed_with_errors",
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);

      toast({
        title: "Importação concluída",
        description: `${successCount} registros importados com sucesso${failCount > 0 ? `, ${failCount} falharam` : ""}.`,
      });

      // Emitir evento para sincronização global
      console.log('[Importacoes] Emitindo evento de importação concluída...');
      importEvents.emit();

      setSelectedFile(null);
      setPreviewData([]);
      fetchImports();
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao importar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Concluído</Badge>;
      case "completed_with_errors":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Com Erros</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Importações</h1>
            <p className="text-muted-foreground mt-1">
              Importe dados de leads através de arquivos Excel ou CSV
            </p>
          </div>

          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar Arquivo
              </CardTitle>
              <CardDescription>
                Arraste e solte um arquivo ou clique para selecionar. Formatos aceitos: .xlsx, .xls, .csv
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                  ${isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Processando arquivo...</p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {selectedFile.name.endsWith(".csv") ? (
                        <FileText className="w-8 h-8 text-primary" />
                      ) : (
                        <FileSpreadsheet className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Arraste um arquivo aqui ou clique para selecionar
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Suporta arquivos Excel (.xlsx, .xls) e CSV (.csv)
                      </p>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        CSV
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedFile && !isProcessing && (
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewData([]);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleImport}>
                    <Check className="w-4 h-4 mr-2" />
                    Importar {previewData.length > 0 && `(${previewData.length}+ registros)`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Pré-visualização (primeiros 10 registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CPF</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Margem</TableHead>
                        <TableHead>Valor Simulação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((lead, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{formatCpf(lead.cpf)}</TableCell>
                          <TableCell>{lead.nome || "-"}</TableCell>
                          <TableCell>{lead.banco || "-"}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                lead.status === "aprovado" 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : lead.status === "reprovado"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }
                            >
                              {lead.status || "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lead.retorno_margem?.valorMargemDisponivel 
                              ? `R$ ${Number(lead.retorno_margem.valorMargemDisponivel).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {lead.retorno_simulacao?.requestedAmount || lead.retorno_simulacao?.liquidValue
                              ? `R$ ${Number(lead.retorno_simulacao.requestedAmount || lead.retorno_simulacao.liquidValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Importações</CardTitle>
              <CardDescription>
                Últimas importações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma importação realizada ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead>Sucesso</TableHead>
                      <TableHead>Falhas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => (
                      <TableRow key={imp.id}>
                        <TableCell className="font-medium">{imp.file_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {imp.file_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{imp.total_records}</TableCell>
                        <TableCell className="text-emerald-400">{imp.successful_records}</TableCell>
                        <TableCell className="text-red-400">{imp.failed_records}</TableCell>
                        <TableCell>{getStatusBadge(imp.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(imp.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Modelo de Arquivo
              </CardTitle>
              <CardDescription>
                Baixe um modelo para garantir que seus dados estão no formato correto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const headers = [
                      "CPF", 
                      "RETORNO AUTORIZACAO", 
                      "RETORNO MARGEM", 
                      "RETORNO SIMULACAO", 
                      "RETORNO PROPOSTA", 
                      "RETORNO GET PROPOSTA", 
                      "ULTIMO LOG"
                    ];
                    const sampleRow = [
                      "12345678901", 
                      '{"autorizacaoId":"xxx","shortUrl":"https://..."}',
                      '{"valorMargemDisponivel":1000,"registroEmpregaticio":{"nomeEmpregado":"João"}}',
                      '{"requestedAmount":5000,"numberOfPayments":24}',
                      "",
                      "",
                      "2024-01-01 10:00:00"
                    ];
                    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
                    XLSX.writeFile(wb, "modelo_importacao.xlsx");
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Baixar Modelo Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const csv = `CPF,RETORNO AUTORIZACAO,RETORNO MARGEM,RETORNO SIMULACAO,RETORNO PROPOSTA,RETORNO GET PROPOSTA,ULTIMO LOG
12345678901,"{""autorizacaoId"":""xxx""}","{""valorMargemDisponivel"":1000}","{""requestedAmount"":5000}","","","2024-01-01 10:00:00"`;
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = "modelo_importacao.csv";
                    link.click();
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Baixar Modelo CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Importacoes;
