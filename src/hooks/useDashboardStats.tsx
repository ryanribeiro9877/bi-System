import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";
import { normalizarStatusLead } from "@/lib/leadStatusUtils";
import { parseJsonSafe, RetornoMargem, RetornoSimulacao } from "@/types/lead";
import { useAuth } from "@/hooks/useAuth";

export interface DashboardStatsOptimized {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaReprovacao: number;
  taxaAprovacao: number;
  margemMedia: number;
  bancos: string[];
  reprovacoesPorBanco: { banco: string; aprovados: number; reprovados: number; pendentes: number; total: number; taxaAprovacao: number; taxaReprovacao: number }[];
}

/**
 * Hook otimizado que busca estatísticas do banco
 * Usa a mesma lógica de normalização de status do frontend para consistência
 * Aguarda autenticação antes de buscar dados
 */
export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStatsOptimized>({
    totalLeads: 0,
    leadsAprovados: 0,
    leadsReprovados: 0,
    leadsPendentes: 0,
    taxaReprovacao: 0,
    taxaAprovacao: 0,
    margemMedia: 0,
    bancos: [],
    reprovacoesPorBanco: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) {
      console.log('[useDashboardStats] Sem usuário autenticado, pulando fetch');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // Buscar todos os leads com campos necessários para normalização
      // Usamos paginação para não estourar o limite de 1000
      const pageSize = 1000;
      let allLeads: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .from("leads")
          .select("id,banco,status,retorno_autorizacao,retorno_margem,retorno_simulacao,retorno_proposta,retorno_get_proposta")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          allLeads = allLeads.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Normalizar status de cada lead usando a mesma lógica do frontend
      const leadsNormalizados = allLeads.map((lead: any) => {
        const leadParsed = {
          ...lead,
          retorno_autorizacao: parseJsonSafe(lead.retorno_autorizacao),
          retorno_margem: parseJsonSafe<RetornoMargem>(lead.retorno_margem),
          retorno_simulacao: parseJsonSafe<RetornoSimulacao>(lead.retorno_simulacao),
          retorno_proposta: parseJsonSafe(lead.retorno_proposta),
          retorno_get_proposta: parseJsonSafe(lead.retorno_get_proposta),
        };
        return {
          ...leadParsed,
          statusNormalizado: normalizarStatusLead(leadParsed),
          banco: lead.banco || "Não Informado",
        };
      });

      // Calcular estatísticas
      const total = leadsNormalizados.length;
      const aprovados = leadsNormalizados.filter(l => l.statusNormalizado === "aprovado").length;
      const reprovados = leadsNormalizados.filter(l => l.statusNormalizado === "reprovado").length;
      const pendentes = leadsNormalizados.filter(l => l.statusNormalizado === "pendente").length;

      // Calcula taxas
      const taxaReprovacao = total > 0 ? parseFloat(((reprovados / total) * 100).toFixed(2)) : 0;
      const taxaAprovacao = total > 0 ? parseFloat(((aprovados / total) * 100).toFixed(2)) : 0;

      // Extrai bancos únicos
      const bancosUnicos = [...new Set(leadsNormalizados.map(l => l.banco))] as string[];

      // Calcular estatísticas por banco
      const bancoStats: Record<string, { aprovados: number; reprovados: number; pendentes: number; total: number }> = {};
      leadsNormalizados.forEach(l => {
        const banco = l.banco;
        if (!bancoStats[banco]) {
          bancoStats[banco] = { aprovados: 0, reprovados: 0, pendentes: 0, total: 0 };
        }
        bancoStats[banco].total++;
        if (l.statusNormalizado === "aprovado") {
          bancoStats[banco].aprovados++;
        } else if (l.statusNormalizado === "reprovado") {
          bancoStats[banco].reprovados++;
        } else {
          bancoStats[banco].pendentes++;
        }
      });

      const reprovacoesPorBanco = Object.entries(bancoStats)
        .map(([banco, stats]) => ({
          banco,
          ...stats,
          taxaAprovacao: stats.total > 0 ? parseFloat(((stats.aprovados / stats.total) * 100).toFixed(2)) : 0,
          taxaReprovacao: stats.total > 0 ? parseFloat(((stats.reprovados / stats.total) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Busca margem média apenas dos aprovados (amostra de 100 para performance)
      let margemMedia = 0;
      if (aprovados > 0) {
        const { data: margensData } = await supabase
          .from("leads")
          .select("retorno_margem")
          .eq("status", "aprovado")
          .not("retorno_margem", "is", null)
          .limit(100);

        if (margensData && margensData.length > 0) {
          const margens = margensData
            .map((l: any) => {
              const margem = parseJsonSafe<RetornoMargem>(l.retorno_margem) as any;
              return margem?.valorMargemDisponivel || 0;
            })
            .filter((v: number) => v > 0);

          if (margens.length > 0) {
            margemMedia = margens.reduce((a: number, b: number) => a + b, 0) / margens.length;
          }
        }
      }

      setStats({
        totalLeads: total,
        leadsAprovados: aprovados,
        leadsReprovados: reprovados,
        leadsPendentes: pendentes,
        taxaReprovacao,
        taxaAprovacao,
        margemMedia,
        bancos: bancosUnicos,
        reprovacoesPorBanco,
      });
      setHasFetched(true);
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      setError(err.message || "Erro ao buscar estatísticas");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch quando usuário autenticar
  useEffect(() => {
    if (user && !authLoading && !hasFetched) {
      console.log('[useDashboardStats] Usuário autenticado, buscando stats...');
      fetchStats();
    }
  }, [user, authLoading, hasFetched, fetchStats]);

  // Atualiza quando houver nova importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log("[useDashboardStats] Recebido evento de importação, atualizando...");
      if (user) {
        fetchStats();
      }
    });
    return unsubscribe;
  }, [fetchStats, user]);

  return { stats, isLoading: authLoading || isLoading, error, refetch: fetchStats };
};