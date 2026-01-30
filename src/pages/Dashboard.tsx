import { useMemo } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Building2,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Loader2,
  Banknote,
  CircleDollarSign,
  XCircle,
} from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const Dashboard = () => {
  const analytics = useDashboardAnalytics();

  const kpis = useMemo(() => [
    {
      title: "Valor Ganho",
      subtitle: "Leads pagos",
      value: formatCurrency(analytics.valorGanho),
      icon: Banknote,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Valor Gasto",
      subtitle: "Leads aprovados",
      value: formatCurrency(analytics.valorGasto),
      icon: CircleDollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Valor Perdido",
      subtitle: "Leads reprovados",
      value: formatCurrency(analytics.valorPerdido),
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ], [analytics]);

  if (analytics.isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Carregando análises...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard de Aprovações</h1>
              <p className="text-muted-foreground mt-1">Análise comparativa e perfil ideal de aprovação</p>
            </div>
            {/* Filtros são aplicados via sidebar */}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {kpis.map((kpi, idx) => (
              <Card key={idx} className="glass-card">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs lg:text-sm text-muted-foreground">{kpi.title}</p>
                      <p className="text-xl lg:text-2xl font-bold mt-1">{kpi.value}</p>
                      {kpi.subtitle && (
                        <p className={`text-sm mt-1 ${kpi.color}`}>{kpi.subtitle}</p>
                      )}
                    </div>
                    <div className={`p-2 lg:p-3 rounded-xl ${kpi.bgColor}`}>
                      <kpi.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Perfil Ideal de Aprovação */}
          <Card className="glass-card border-2 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                <Target className="w-5 h-5 text-primary" />
                Perfil Ideal de Aprovação
              </CardTitle>
              <p className="text-sm text-muted-foreground">Características com maior taxa de aprovação</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CBO Ideal */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-500">CBO Ideal</span>
                  </div>
                  {analytics.perfilIdeal.cboIdeal ? (
                    <>
                      <p className="font-semibold text-foreground truncate" title={analytics.perfilIdeal.cboIdeal.descricao}>
                        {analytics.perfilIdeal.cboIdeal.codigo}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{analytics.perfilIdeal.cboIdeal.descricao}</p>
                      <Badge variant="secondary" className="mt-2 bg-emerald-500/20 text-emerald-500">
                        {formatPercent(analytics.perfilIdeal.cboIdeal.taxaAprovacao)} aprovação
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* Banco Ideal */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-500">Banco Campeão</span>
                  </div>
                  {analytics.perfilIdeal.bancoIdeal ? (
                    <>
                      <p className="font-semibold text-foreground">{analytics.perfilIdeal.bancoIdeal.banco}</p>
                      <Badge variant="secondary" className="mt-2 bg-blue-500/20 text-blue-500">
                        {formatPercent(analytics.perfilIdeal.bancoIdeal.taxaAprovacao)} aprovação
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* Margem Ideal */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500">Margem Ideal</span>
                  </div>
                  {analytics.perfilIdeal.margemIdeal ? (
                    <>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(analytics.perfilIdeal.margemIdeal.media)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Min: {formatCurrency(analytics.perfilIdeal.margemIdeal.min)} | Max: {formatCurrency(analytics.perfilIdeal.margemIdeal.max)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* Melhor Dia */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-500">Melhor Dia</span>
                  </div>
                  {analytics.perfilIdeal.melhorDiaSemana ? (
                    <>
                      <p className="font-semibold text-foreground">{analytics.perfilIdeal.melhorDiaSemana.dia}</p>
                      <Badge variant="secondary" className="mt-2 bg-purple-500/20 text-purple-500">
                        {formatPercent(analytics.perfilIdeal.melhorDiaSemana.taxaAprovacao)} aprovação
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confronto CBO: Mais Aprovação X Mais Reprovação */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Briefcase className="w-5 h-5 text-primary" />
                Confronto de CBOs: Aprovação vs Reprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CBO com mais aprovação */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium text-emerald-500">CBO com Mais Aprovação</span>
                  </div>
                  {analytics.cboMaisAprovacao ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">{analytics.cboMaisAprovacao.codigo}</p>
                      <p className="text-sm text-muted-foreground truncate">{analytics.cboMaisAprovacao.descricao}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
                          {formatPercent(analytics.cboMaisAprovacao.taxaAprovacao)} aprovação
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {analytics.cboMaisAprovacao.aprovados} de {analytics.cboMaisAprovacao.total} leads
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* CBO com mais reprovação */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-500">CBO com Mais Reprovação</span>
                  </div>
                  {analytics.cboMaisReprovacao ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">{analytics.cboMaisReprovacao.codigo}</p>
                      <p className="text-sm text-muted-foreground truncate">{analytics.cboMaisReprovacao.descricao}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                          {formatPercent(100 - analytics.cboMaisReprovacao.taxaAprovacao)} reprovação
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {analytics.cboMaisReprovacao.reprovados} de {analytics.cboMaisReprovacao.total} leads
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confronto Empresa: Mais Aprovações X Mais Reprovações */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                Confronto de Empresas: Aprovações vs Reprovações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Empresa com mais aprovações */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium text-emerald-500">Empresa com Mais Aprovações</span>
                  </div>
                  {analytics.empresaMaisAprovacoes ? (
                    <>
                      <p className="text-lg font-bold text-foreground truncate" title={analytics.empresaMaisAprovacoes.empresa}>
                        {analytics.empresaMaisAprovacoes.empresa}
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
                          {analytics.empresaMaisAprovacoes.aprovados} aprovados
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatPercent(analytics.empresaMaisAprovacoes.taxaAprovacao)} taxa
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* Empresa com mais reprovações */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-500">Empresa com Mais Reprovações</span>
                  </div>
                  {analytics.empresaMaisReprovacoes ? (
                    <>
                      <p className="text-lg font-bold text-foreground truncate" title={analytics.empresaMaisReprovacoes.empresa}>
                        {analytics.empresaMaisReprovacoes.empresa}
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                          {analytics.empresaMaisReprovacoes.reprovados} reprovados
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          de {analytics.empresaMaisReprovacoes.total} leads
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confronto Banco: Mais Aprovações X Menos Aprovações */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                Confronto de Bancos: Mais vs Menos Aprovações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Banco com mais aprovações */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium text-emerald-500">Banco com Mais Aprovações</span>
                  </div>
                  {analytics.bancoMaisAprovacoes ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">{analytics.bancoMaisAprovacoes.banco}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Aprovados</span>
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-500">
                            {analytics.bancoMaisAprovacoes.aprovados}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Taxa</span>
                          <span className="font-medium">{formatPercent(analytics.bancoMaisAprovacoes.taxaAprovacao)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Valor Total</span>
                          <span className="font-medium text-emerald-500">{formatCurrency(analytics.bancoMaisAprovacoes.valorTotal)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>

                {/* Banco com menos aprovações */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                    <span className="font-medium text-amber-500">Banco com Menos Aprovações</span>
                  </div>
                  {analytics.bancoMenosAprovacoes ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">{analytics.bancoMenosAprovacoes.banco}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Aprovados</span>
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">
                            {analytics.bancoMenosAprovacoes.aprovados}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Taxa</span>
                          <span className="font-medium">{formatPercent(analytics.bancoMenosAprovacoes.taxaAprovacao)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Valor Total</span>
                          <span className="font-medium text-amber-500">{formatCurrency(analytics.bancoMenosAprovacoes.valorTotal)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Dados insuficientes</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confronto: % Leads Aprovados X % Leads Pagos */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                Confronto: % Aprovados vs % Pagos por Dia da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.aprovacoesPorDiaSemana.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.aprovacoesPorDiaSemana}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`, 
                        name === 'taxaAprovacao' ? '% Aprovados' : '% Pagos'
                      ]} 
                    />
                    <Legend />
                    <Bar dataKey="taxaAprovacao" name="% Aprovados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="taxaPagamento" name="% Pagos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Dados insuficientes
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
