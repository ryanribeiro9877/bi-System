import { format } from "date-fns";
import { CalendarIcon, Search, X, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/DashboardContext";

export interface FilterState {
  dataInicial: Date | undefined;
  dataFinal: Date | undefined;
  banco: string;
  tipoReprovacao: string;
  tiposReprovacaoMultiplos: string[];
  status: string;
  cpf: string;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const bancos = ["UY3", "Presença", "V8"];
const statusOptions = [
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "pendente", label: "Pendente" },
];

// Cores para tipos de reprovação (HSL)
const REJECTION_COLORS = [
  "340 82% 52%",  // Rosa
  "262 83% 58%",  // Roxo
  "199 89% 48%",  // Azul
  "142 71% 45%",  // Verde
  "25 95% 53%",   // Laranja
  "47 96% 53%",   // Amarelo
  "174 84% 40%",  // Teal
  "280 87% 55%",  // Violeta
  "15 90% 55%",   // Vermelho-laranja
  "210 78% 60%",  // Azul claro
  "320 72% 50%",  // Magenta
  "88 50% 50%",   // Lima
  "200 90% 40%",  // Azul escuro
  "35 92% 50%",   // Ouro
  "160 70% 40%",  // Verde-água
  "290 75% 45%",  // Púrpura
];

// Função para extrair resumo limpo do tipo de reprovação
const extractCleanType = (fullText: string): string => {
  const lowerText = fullText.toLowerCase();
  
  const messageMatch = fullText.match(/"message"\s*:\s*"([^"]+)"/);
  if (messageMatch) {
    return messageMatch[1];
  }
  
  if (lowerText.includes("requisição falhou") && fullText.includes(":")) {
    const parts = fullText.split(":");
    if (parts.length >= 2) {
      const cleanPart = parts[1].trim().split("(")[0].trim();
      if (cleanPart.length > 10) {
        return cleanPart;
      }
    }
  }
  
  let cleaned = fullText
    .replace(/\s*\(Code:\s*[A-Z_]+\)/gi, "")
    .replace(/\s*\|\s*Response completo:.*/gi, "")
    .replace(/\s*\{[^}]*\}/g, "")
    .replace(/Requisição falhou com status \d+:\s*/gi, "")
    .trim();
  
  return cleaned || fullText;
};

// Função para resumo curto
const summarizeType = (fullText: string): string => {
  const cleanText = extractCleanType(fullText);
  if (cleanText.length > 35) {
    return cleanText.substring(0, 32) + "...";
  }
  return cleanText;
};

const DashboardFilters = ({ filters, onFiltersChange }: DashboardFiltersProps) => {
  const { stats } = useDashboard();
  
  // Obtém tipos de reprovação das estatísticas
  const tiposReprovacaoDisponiveis = stats.reprovacoesPorTipo.map((item, index) => ({
    original: item.tipoCompleto || item.tipo,
    resumido: summarizeType(item.tipoCompleto || item.tipo),
    limpo: extractCleanType(item.tipoCompleto || item.tipo),
    quantidade: item.quantidade,
    cor: REJECTION_COLORS[index % REJECTION_COLORS.length],
  }));

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleTipoReprovacao = (tipo: string) => {
    const current = filters.tiposReprovacaoMultiplos || [];
    const newSelection = current.includes(tipo)
      ? current.filter(t => t !== tipo)
      : [...current, tipo];
    onFiltersChange({ ...filters, tiposReprovacaoMultiplos: newSelection });
  };

  const clearFilters = () => {
    onFiltersChange({
      dataInicial: undefined,
      dataFinal: undefined,
      banco: "",
      tipoReprovacao: "",
      tiposReprovacaoMultiplos: [],
      status: "",
      cpf: "",
    });
  };

  const hasFilters = filters.dataInicial || filters.dataFinal || filters.banco || filters.tipoReprovacao || (filters.tiposReprovacaoMultiplos && filters.tiposReprovacaoMultiplos.length > 0) || filters.status || filters.cpf;

  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Data Inicial */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal h-9",
                  !filters.dataInicial && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dataInicial ? format(filters.dataInicial, "dd/MM/yyyy") : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dataInicial}
                onSelect={(date) => updateFilter("dataInicial", date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Data Final */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Data Final</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal h-9",
                  !filters.dataFinal && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dataFinal ? format(filters.dataFinal, "dd/MM/yyyy") : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dataFinal}
                onSelect={(date) => updateFilter("dataFinal", date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Banco */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Banco</label>
          <Select value={filters.banco} onValueChange={(value) => updateFilter("banco", value)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {bancos.map((banco) => (
                <SelectItem key={banco} value={banco}>
                  {banco}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro Multi-Seleção de Tipos de Reprovação */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipos de Reprovação</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[220px] justify-start text-left font-normal h-9 gap-2",
                  filters.tiposReprovacaoMultiplos.length === 0 && "text-muted-foreground"
                )}
              >
                <Filter className="h-4 w-4" />
                {filters.tiposReprovacaoMultiplos.length === 0 
                  ? "Selecionar tipos" 
                  : `${filters.tiposReprovacaoMultiplos.length} selecionado(s)`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <div className="p-3 border-b">
                <p className="text-sm font-medium">Selecione os tipos de reprovação</p>
                <p className="text-xs text-muted-foreground">Clique para selecionar múltiplos tipos</p>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-1">
                  {tiposReprovacaoDisponiveis.map((tipo, index) => {
                    const isSelected = filters.tiposReprovacaoMultiplos.includes(tipo.original);
                    return (
                      <button
                        key={index}
                        onClick={() => toggleTipoReprovacao(tipo.original)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors text-sm",
                          isSelected 
                            ? "bg-primary/10 border border-primary/30" 
                            : "hover:bg-muted border border-transparent"
                        )}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: `hsl(${tipo.cor})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{tipo.resumido}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {tipo.quantidade}
                        </Badge>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              {filters.tiposReprovacaoMultiplos.length > 0 && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => updateFilter("tiposReprovacaoMultiplos", [])}
                  >
                    Limpar seleção
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Busca por CPF */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Busca por CPF</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="000.000.000-00"
              value={filters.cpf}
              onChange={(e) => updateFilter("cpf", e.target.value)}
              className="pl-8 w-[160px] h-9"
            />
          </div>
        </div>

        {/* Limpar Filtros */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Badges dos tipos selecionados */}
      {filters.tiposReprovacaoMultiplos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.tiposReprovacaoMultiplos.map((tipo, index) => {
            const tipoInfo = tiposReprovacaoDisponiveis.find(t => t.original === tipo);
            const cor = tipoInfo?.cor || REJECTION_COLORS[index % REJECTION_COLORS.length];
            return (
              <Badge 
                key={index}
                variant="outline"
                className="gap-2 pr-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => toggleTipoReprovacao(tipo)}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: `hsl(${cor})` }}
                />
                <span className="max-w-[200px] truncate">{tipoInfo?.resumido || tipo}</span>
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
