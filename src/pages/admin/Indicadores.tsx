import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, CheckCircle, AlertCircle, Users, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Loader2 } from "lucide-react";

// Mapeamento para converter nome do mês em número para ordenação
const mesesMap: Record<string, number> = {
  Janeiro: 0,
  Fevereiro: 1,
  Março: 2,
  Abril: 3,
  Maio: 4,
  Junho: 5,
  Julho: 6,
  Agosto: 7,
  Setembro: 8,
  Outubro: 9,
  Novembro: 10,
  Dezembro: 11,
};

// Função para transformar "Janeiro/2026" em um objeto Date ordenável
const parseCompetencia = (comp: string) => {
  if (!comp) return new Date(0);
  const parts = comp.split("/");
  if (parts.length !== 2) return new Date(0);

  const [mesName, anoStr] = parts;
  const mesIndex = mesesMap[mesName];
  const ano = parseInt(anoStr);

  if (mesIndex === undefined || isNaN(ano)) return new Date(0);

  return new Date(ano, mesIndex, 1);
};

const Indicadores = () => {
  // Busca e processa os dados
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-indicadores"],
    queryFn: async () => {
      // 1. Buscar lotes processados
      const { data: lotes, error } = await supabase
        .from("lotes_mensais")
        .select("id, competencia, total_colaboradores, valor_total, status, created_at")
        .in("status", ["concluido", "faturado"]);

      if (error) throw error;

      // 2. Agrupar dados por competência
      const agrupadoPorCompetencia: Record<string, { name: string; vidas: number; valor: number }> = {};

      lotes.forEach((lote) => {
        if (!agrupadoPorCompetencia[lote.competencia]) {
          agrupadoPorCompetencia[lote.competencia] = {
            name: lote.competencia,
            vidas: 0,
            valor: 0,
          };
        }
        agrupadoPorCompetencia[lote.competencia].vidas += lote.total_colaboradores || 0;
        agrupadoPorCompetencia[lote.competencia].valor += lote.valor_total || 0;
      });

      // 3. Converter objeto em array
      const chartData = Object.values(agrupadoPorCompetencia);

      // 4. ORDENAÇÃO CRONOLÓGICA (O Pulo do Gato)
      // Ordena do mais antigo para o mais recente baseando-se na data real
      chartData.sort((a, b) => {
        const dateA = parseCompetencia(a.name);
        const dateB = parseCompetencia(b.name);
        return dateA.getTime() - dateB.getTime();
      });

      // Calcular KPIs simples (exemplo baseados nos dados retornados)
      const totalVidas = chartData.reduce((acc, curr) => acc + curr.vidas, 0);
      const mediaVidas = chartData.length > 0 ? Math.round(totalVidas / chartData.length) : 0;

      return {
        chartData,
        totalVidas,
        mediaVidas,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = metrics?.chartData || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Indicadores</h1>
        <p className="text-muted-foreground">Acompanhe as métricas e evolução do sistema</p>
      </div>

      {/* KPIs Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vidas Ativas (Último Mês)</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chartData.length > 0 ? chartData[chartData.length - 1].vidas : 0}</div>
            <p className="text-xs text-muted-foreground">colaboradores no último ciclo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média de Vidas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.mediaVidas}</div>
            <p className="text-xs text-muted-foreground">média mensal histórica</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">média geral do sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Último Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.length > 0
                ? chartData[chartData.length - 1].valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "R$ 0,00"}
            </div>
            <p className="text-xs text-muted-foreground">estimado base R$ 50/vida</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Evolução de Vidas */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evolução de Vidas</CardTitle>
            <CardDescription>Quantidade de colaboradores processados por competência</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="vidas" fill="#203455" radius={[4, 4, 0, 0]} name="Vidas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Dados insuficientes para gerar gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Evolução Financeira */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evolução Financeira</CardTitle>
            <CardDescription>Valor total processado por competência</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#16a34a" }}
                    activeDot={{ r: 6 }}
                    name="Faturamento"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Dados insuficientes para gerar gráfico
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Indicadores;
