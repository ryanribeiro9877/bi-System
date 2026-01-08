import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { importEvents } from "@/events/importEvents";

export interface DashboardStatsOptimized {
  totalLeads: number;
  leadsAprovados: number;
  leadsReprovados: number;
  leadsPendentes: number;
  taxaReprovacao: number;
  taxaAprovacao: number;
  margemMedia: number;
  bancos: string[];
}

/**
 * Hook otimizado que busca estatísticas diretamente do banco usando COUNT
 * em vez de carregar todos os leads para o frontend
 */
export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStatsOptimized>({
    totalLeads: 0,
    leadsAprovados: 0,
    leadsReprovados: 0,
    leadsPendentes: 0,
    taxaReprovacao: 0,
    taxaAprovacao: 0,
    margemMedia: 0,
    bancos: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Executa todas as queries de contagem em paralelo
      const [
        totalResult,
        aprovadosResult,
        reprovadosResult,
        pendentesResult,
        bancosResult,
      ] = await Promise.all([
        // Total de leads
        supabase.from("leads").select("*", { count: "exact", head: true }),
        // Leads aprovados
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "aprovado"),
        // Leads reprovados
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "reprovado"),
        // Leads pendentes
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        // Lista de bancos únicos
        supabase.from("leads").select("banco").not("banco", "is", null),
      ]);

      const total = totalResult.count || 0;
      const aprovados = aprovadosResult.count || 0;
      const reprovados = reprovadosResult.count || 0;
      const pendentes = pendentesResult.count || 0;

      // Extrai bancos únicos
      const bancosUnicos = [...new Set(
        (bancosResult.data || [])
          .map(b => b.banco)
          .filter(Boolean)
      )] as string[];

      // Calcula taxas
      const taxaReprovacao = total > 0 ? parseFloat(((reprovados / total) * 100).toFixed(2)) : 0;
      const taxaAprovacao = total > 0 ? parseFloat(((aprovados / total) * 100).toFixed(2)) : 0;

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
              const margem = l.retorno_margem as any;
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
      });
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      setError(err.message || "Erro ao buscar estatísticas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Atualiza quando houver nova importação
  useEffect(() => {
    const unsubscribe = importEvents.subscribe(() => {
      console.log("[useDashboardStats] Recebido evento de importação, atualizando...");
      fetchStats();
    });
    return unsubscribe;
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
};