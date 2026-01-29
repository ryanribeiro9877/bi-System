import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MotivoReprovacao,
  AnaliseMotivosLead,
  analisarMotivosLead,
  formatarQuantidadeMotivos,
  agruparMotivosPorCategoria,
  CORES_CATEGORIA,
  LABELS_CATEGORIA,
} from "@/lib/motivosReprovacaoUtils";

interface MotivosReprovacaoBadgeProps {
  lead: {
    cpf?: string;
    retorno_margem?: unknown;
  };
  showDetails?: boolean;
}

/**
 * Badge que mostra a quantidade de motivos de reprovação
 * Ao clicar, abre um dialog com os detalhes
 */
export const MotivosReprovacaoBadge = ({ lead, showDetails = true }: MotivosReprovacaoBadgeProps) => {
  const analise = analisarMotivosLead(lead);
  
  if (analise.quantidadeMotivos === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sem motivos
      </Badge>
    );
  }

  const corBadge = analise.quantidadeMotivos >= 5 
    ? "bg-red-500/20 text-red-400 border-red-500/30"
    : analise.quantidadeMotivos >= 3
    ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  if (!showDetails) {
    return (
      <Badge className={corBadge}>
        {formatarQuantidadeMotivos(analise.quantidadeMotivos)}
      </Badge>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge className={`${corBadge} cursor-pointer hover:opacity-80`}>
          {formatarQuantidadeMotivos(analise.quantidadeMotivos)}
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Motivos de Reprovação ({analise.quantidadeMotivos})
          </DialogTitle>
        </DialogHeader>
        <MotivosReprovacaoDetalhes analise={analise} />
      </DialogContent>
    </Dialog>
  );
};

interface MotivosReprovacaoDetalhesProps {
  analise: AnaliseMotivosLead;
}

/**
 * Componente que exibe os detalhes dos motivos de reprovação
 * Agrupa por categoria e mostra cada motivo
 */
export const MotivosReprovacaoDetalhes = ({ analise }: MotivosReprovacaoDetalhesProps) => {
  const [showErroOriginal, setShowErroOriginal] = useState(false);
  const grupos = agruparMotivosPorCategoria(analise.motivos);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-sm">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Este lead possui <strong className="text-foreground">{analise.quantidadeMotivos}</strong> motivo(s) 
            de reprovação identificado(s).
          </span>
        </div>
      </div>

      {/* Motivos agrupados por categoria */}
      {Object.entries(grupos).map(([categoria, motivos]) => (
        <div key={categoria} className="space-y-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: CORES_CATEGORIA[categoria] }}
            />
            <h4 className="font-medium text-sm text-foreground">
              {LABELS_CATEGORIA[categoria] || categoria}
            </h4>
            <Badge variant="outline" className="text-xs">
              {motivos.length}
            </Badge>
          </div>
          <div className="ml-5 space-y-1">
            {motivos.map((motivo, idx) => (
              <MotivoItem key={idx} motivo={motivo} />
            ))}
          </div>
        </div>
      ))}

      {/* Erro original (colapsável) */}
      {analise.erroOriginal && (
        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowErroOriginal(!showErroOriginal)}
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <span className="text-xs">Ver mensagem de erro original</span>
            {showErroOriginal ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          {showErroOriginal && (
            <div className="mt-2 p-3 rounded bg-muted/50 text-xs text-muted-foreground font-mono overflow-auto max-h-40">
              {analise.erroOriginal}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MotivoItemProps {
  motivo: MotivoReprovacao;
}

/**
 * Item individual de motivo
 */
const MotivoItem = ({ motivo }: MotivoItemProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors cursor-default">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: CORES_CATEGORIA[motivo.categoria] }}
            />
            <span className="text-sm text-foreground">{motivo.descricao}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Código: {motivo.codigo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface MotivosReprovacaoResumoProps {
  leads: Array<{
    cpf?: string;
    retorno_margem?: unknown;
  }>;
}

/**
 * Componente que exibe um resumo estatístico dos motivos de reprovação
 * para uma lista de leads
 */
export const MotivosReprovacaoResumo = ({ leads }: MotivosReprovacaoResumoProps) => {
  // Analisar todos os leads
  const analises = leads.map(lead => analisarMotivosLead(lead));
  
  // Contar ocorrências de cada motivo
  const contagem: Record<string, number> = {};
  let totalMotivos = 0;
  
  for (const analise of analises) {
    for (const motivo of analise.motivos) {
      contagem[motivo.codigo] = (contagem[motivo.codigo] || 0) + 1;
      totalMotivos++;
    }
  }

  // Ordenar por quantidade
  const motivosOrdenados = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1]);

  // Estatísticas
  const leadsComMotivos = analises.filter(a => a.quantidadeMotivos > 0).length;
  const leadsMultiplosMotivos = analises.filter(a => a.quantidadeMotivos > 1).length;
  const mediaMotivos = leadsComMotivos > 0 
    ? (totalMotivos / leadsComMotivos).toFixed(1) 
    : '0';

  return (
    <div className="space-y-4">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground">Total de Leads</p>
          <p className="text-2xl font-bold">{leads.length}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground">Com Motivos</p>
          <p className="text-2xl font-bold">{leadsComMotivos}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground">Múltiplos Motivos</p>
          <p className="text-2xl font-bold">{leadsMultiplosMotivos}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground">Média de Motivos</p>
          <p className="text-2xl font-bold">{mediaMotivos}</p>
        </div>
      </div>

      {/* Lista de motivos mais comuns */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Motivos Mais Frequentes</h4>
        {motivosOrdenados.slice(0, 10).map(([codigo, count]) => {
          const motivo = analises
            .flatMap(a => a.motivos)
            .find(m => m.codigo === codigo);
          
          const porcentagem = ((count / leadsComMotivos) * 100).toFixed(1);
          
          return (
            <div key={codigo} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: CORES_CATEGORIA[motivo?.categoria || 'OUTRO'] }}
              />
              <span className="text-sm flex-1">
                {motivo?.descricao || codigo}
              </span>
              <span className="text-sm text-muted-foreground">
                {count} ({porcentagem}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MotivosReprovacaoBadge;
