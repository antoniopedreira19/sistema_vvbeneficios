import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MailWarning, Loader2, Send, Building2, Mail, History, Clock } from "lucide-react";
import { formatCNPJ } from "@/lib/validators";

// Gera competência atual no formato "Mês/Ano"
const getCompetenciaAtual = () => {
  const now = new Date();
  const mes = format(now, "MMMM", { locale: ptBR });
  const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${mesCapitalizado}/${now.getFullYear()}`;
};

// Gera lista de competências (últimos 3 meses + próximos 3 meses)
const gerarCompetencias = () => {
  const competencias: string[] = [];
  const now = new Date();
  
  for (let i = -3; i <= 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mes = format(date, "MMMM", { locale: ptBR });
    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
    competencias.push(`${mesCapitalizado}/${date.getFullYear()}`);
  }
  
  return competencias;
};

interface HistoricoCobranca {
  id: string;
  competencia: string;
  total_empresas: number;
  empresas_notificadas: { nome: string; email: string }[] | unknown;
  created_at: string;
}

interface EmpresaPendente {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  responsavel: string;
}

export function CobrancaMassaDialog() {
  const [open, setOpen] = useState(false);
  const [competencia, setCompetencia] = useState(getCompetenciaAtual());
  const [disparando, setDisparando] = useState(false);
  const [activeTab, setActiveTab] = useState("disparar");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const competencias = gerarCompetencias();

  // 1. Busca prévia: Quem está pendente?
  const {
    data: pendentes = [] as EmpresaPendente[],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["empresas-pendentes", competencia],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_empresas_pendentes", {
        p_competencia: competencia,
      });
      if (error) throw error;
      return (data || []) as EmpresaPendente[];
    },
  });

  // Reset seleção quando muda competência ou fecha dialog
  useEffect(() => {
    setSelectedIds(new Set());
  }, [competencia, open]);

  // 2. Busca histórico de cobranças
  const { data: historico = [], isLoading: historicoLoading } = useQuery({
    queryKey: ["historico-cobrancas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_cobrancas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as HistoricoCobranca[];
    },
  });

  // Toggle individual
  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all
  const handleToggleAll = () => {
    if (selectedIds.size === pendentes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendentes.map((e) => e.id)));
    }
  };

  const empresasSelecionadas = pendentes.filter((e) => selectedIds.has(e.id));

  // 3. Ação: Chamar edge function para enviar via n8n
  const handleDispararCobranca = async (tipo: "primeira" | "proximas") => {
    if (empresasSelecionadas.length === 0) {
      toast.warning("Selecione pelo menos uma empresa.");
      return;
    }

    const tipoLabel = tipo === "primeira" ? "Primeira Cobrança" : "Próximas Cobranças";
    if (!confirm(`Deseja realmente enviar "${tipoLabel}" para ${empresasSelecionadas.length} empresas?`)) return;

    setDisparando(true);
    try {
      const empresasPayload = empresasSelecionadas.map((emp) => ({
        nome: emp.nome,
        email: emp.email,
      }));

      // Webhook diferente para próximas cobranças
      const webhookUrl = tipo === "proximas" 
        ? "https://grifoworkspace.app.n8n.cloud/webhook/cobrancas-listas-posteriores"
        : undefined; // undefined usa o webhook padrão

      const { data, error } = await supabase.functions.invoke("disparar-cobranca-massa", {
        body: { 
          competencia,
          empresas: empresasPayload,
          webhook_url: webhookUrl,
        },
      });

      if (error) throw error;

      toast.success(`${tipoLabel} enviada para ${empresasSelecionadas.length} empresas!`);
      queryClient.invalidateQueries({ queryKey: ["historico-cobrancas"] });
      setSelectedIds(new Set());
      setActiveTab("historico");
    } catch (error) {
      toast.error("Erro ao disparar cobrança.");
      console.error(error);
    } finally {
      setDisparando(false);
    }
  };

  const allSelected = pendentes.length > 0 && selectedIds.size === pendentes.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < pendentes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <MailWarning className="h-4 w-4" />
          Cobranças
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Disparo de Cobrança em Massa</DialogTitle>
          <DialogDescription>
            Envie e-mails automáticos para empresas ativas que ainda não enviaram a lista.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="disparar" className="gap-2">
              <Send className="h-4 w-4" />
              Disparar
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disparar" className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label>Selecione a Competência</Label>
              <Select
                value={competencia}
                onValueChange={(val) => {
                  setCompetencia(val);
                  setTimeout(() => refetch(), 100);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competencias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : pendentes.length === 0 ? (
                <div className="text-center py-6">
                  <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Nenhuma empresa pendente encontrada</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Todas as empresas ativas já enviaram a lista para {competencia}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={allSelected}
                        onCheckedChange={handleToggleAll}
                        className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                        {...(someSelected ? { "data-state": "indeterminate" } : {})}
                      />
                      <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                        Empresas Pendentes
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
                        {pendentes.length} {pendentes.length === 1 ? "empresa" : "empresas"}
                      </span>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-[200px] pr-3">
                    <div className="space-y-2">
                      {pendentes.map((emp) => (
                        <div
                          key={emp.id}
                          className={`bg-background p-3 rounded-md border flex items-start gap-3 cursor-pointer transition-colors ${
                            selectedIds.has(emp.id) ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleToggle(emp.id)}
                        >
                          <Checkbox
                            checked={selectedIds.has(emp.id)}
                            onCheckedChange={() => handleToggle(emp.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5"
                          />
                          <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{emp.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCNPJ(emp.cnpj || "")}
                            </p>
                            {emp.email && (
                              <div className="flex items-center gap-1 mt-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground truncate">
                                  {emp.email}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleDispararCobranca("primeira")}
                disabled={selectedIds.size === 0 || disparando || isLoading}
                variant="default"
              >
                {disparando ? (
                  <>
                    Enviando... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Primeira Cobrança ({selectedIds.size}) <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleDispararCobranca("proximas")}
                disabled={selectedIds.size === 0 || disparando || isLoading}
                variant="secondary"
              >
                {disparando ? (
                  <>
                    Enviando... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Próximas Cobranças ({selectedIds.size}) <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              {historicoLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-6">
                  <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Nenhum disparo registrado</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-3">
                  <div className="space-y-3">
                    {historico.map((item) => (
                      <div
                        key={item.id}
                        className="bg-background p-4 rounded-md border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{item.competencia}</span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {item.total_empresas} {item.total_empresas === 1 ? "empresa" : "empresas"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Empresas:</span>{" "}
                          {Array.isArray(item.empresas_notificadas)
                            ? item.empresas_notificadas
                                .slice(0, 3)
                                .map((e: { nome: string }) => e.nome)
                                .join(", ")
                            : "N/A"}
                          {Array.isArray(item.empresas_notificadas) && item.empresas_notificadas.length > 3 && (
                            <span> +{item.empresas_notificadas.length - 3} mais</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}