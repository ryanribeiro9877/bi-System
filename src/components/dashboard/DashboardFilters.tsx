import { format } from "date-fns";
import { CalendarIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";

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

const DashboardFilters = ({ filters, onFiltersChange }: DashboardFiltersProps) => {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
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

  const hasFilters = filters.dataInicial || filters.dataFinal || filters.banco || filters.status || filters.cpf;

  return (
    <div className="glass-card p-3 lg:p-4 mb-4 lg:mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-3 lg:gap-4 items-end">
        {/* Data Inicial */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full lg:w-[140px] justify-start text-left font-normal h-9 text-xs sm:text-sm",
                  !filters.dataInicial && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 sm:mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{filters.dataInicial ? format(filters.dataInicial, "dd/MM/yyyy") : "Selecione"}</span>
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
                  "w-full lg:w-[140px] justify-start text-left font-normal h-9 text-xs sm:text-sm",
                  !filters.dataFinal && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 sm:mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{filters.dataFinal ? format(filters.dataFinal, "dd/MM/yyyy") : "Selecione"}</span>
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
            <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs sm:text-sm">
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

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs sm:text-sm">
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
        <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">Busca por CPF</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="000.000.000-00"
              value={filters.cpf}
              onChange={(e) => updateFilter("cpf", e.target.value)}
              className="pl-8 w-full lg:w-[160px] h-9 text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Limpar Filtros */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-muted-foreground hover:text-foreground col-span-2 sm:col-span-1"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
};

export default DashboardFilters;
