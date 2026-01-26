import { useState, useEffect } from "react";
import { Users, CheckCircle, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CriarUsuariosMassaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmpresaElegivel {
  id: string;
  nome: string;
  email_contato: string;
}

interface ResultadoCriacao {
  empresa: string;
  email: string;
  status: "sucesso" | "duplicado" | "erro";
  mensagem?: string;
}

type Etapa = "carregando" | "preview" | "processando" | "concluido";

export function CriarUsuariosMassaDialog({ open, onOpenChange }: CriarUsuariosMassaDialogProps) {
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [empresasElegiveis, setEmpresasElegiveis] = useState<EmpresaElegivel[]>([]);
  const [resultados, setResultados] = useState<ResultadoCriacao[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (open) {
      carregarEmpresasElegiveis();
    } else {
      // Reset state when dialog closes
      setEtapa("carregando");
      setEmpresasElegiveis([]);
      setResultados([]);
      setProgresso(0);
      setProcessando(false);
    }
  }, [open]);

  const carregarEmpresasElegiveis = async () => {
    setEtapa("carregando");
    
    try {
      // Buscar empresas ativas com email_contato
      const { data: empresas, error: empresasError } = await supabase
        .from("empresas")
        .select("id, nome, email_contato")
        .eq("status", "ativa")
        .not("email_contato", "is", null)
        .neq("email_contato", "");

      if (empresasError) throw empresasError;

      // Buscar empresa_ids que já têm usuário vinculado
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("empresa_id")
        .not("empresa_id", "is", null);

      if (profilesError) throw profilesError;

      const empresasComUsuario = new Set(profiles?.map(p => p.empresa_id) || []);

      // Filtrar empresas elegíveis (sem usuário vinculado)
      const elegiveis = (empresas || []).filter(
        (e) => !empresasComUsuario.has(e.id) && e.email_contato
      ) as EmpresaElegivel[];

      setEmpresasElegiveis(elegiveis);
      setEtapa("preview");
    } catch (error: any) {
      console.error("Erro ao carregar empresas:", error);
      toast.error("Erro ao carregar empresas elegíveis");
      onOpenChange(false);
    }
  };

  const criarUsuarios = async () => {
    setProcessando(true);
    setEtapa("processando");
    setResultados([]);
    setProgresso(0);

    const total = empresasElegiveis.length;
    const resultadosTemp: ResultadoCriacao[] = [];

    for (let i = 0; i < empresasElegiveis.length; i++) {
      const empresa = empresasElegiveis[i];
      
      try {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            email: empresa.email_contato,
            password: "@VV2026",
            nome: empresa.nome,
            role: "cliente",
            empresa_id: empresa.id,
          },
        });

        if (error) {
          // Verificar se é erro de email duplicado
          const isDuplicado = error.message?.includes("já está cadastrado") || 
                              error.message?.includes("already been registered");
          
          resultadosTemp.push({
            empresa: empresa.nome,
            email: empresa.email_contato,
            status: isDuplicado ? "duplicado" : "erro",
            mensagem: error.message,
          });
        } else if (data?.error) {
          const isDuplicado = data.error?.includes("já está cadastrado") || 
                              data.error?.includes("already been registered");
          
          resultadosTemp.push({
            empresa: empresa.nome,
            email: empresa.email_contato,
            status: isDuplicado ? "duplicado" : "erro",
            mensagem: data.error,
          });
        } else {
          resultadosTemp.push({
            empresa: empresa.nome,
            email: empresa.email_contato,
            status: "sucesso",
          });
        }
      } catch (err: any) {
        resultadosTemp.push({
          empresa: empresa.nome,
          email: empresa.email_contato,
          status: "erro",
          mensagem: err.message || "Erro desconhecido",
        });
      }

      setProgresso(Math.round(((i + 1) / total) * 100));
      setResultados([...resultadosTemp]);
    }

    setProcessando(false);
    setEtapa("concluido");
    
    const sucessos = resultadosTemp.filter(r => r.status === "sucesso").length;
    if (sucessos > 0) {
      toast.success(`${sucessos} usuário(s) criado(s) com sucesso!`);
    }
  };

  const contadores = {
    sucesso: resultados.filter(r => r.status === "sucesso").length,
    duplicado: resultados.filter(r => r.status === "duplicado").length,
    erro: resultados.filter(r => r.status === "erro").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Criar Usuários em Massa
          </DialogTitle>
          <DialogDescription>
            {etapa === "carregando" && "Carregando empresas elegíveis..."}
            {etapa === "preview" && "Confirme a criação de usuários para as empresas abaixo"}
            {etapa === "processando" && "Criando usuários..."}
            {etapa === "concluido" && "Processo concluído!"}
          </DialogDescription>
        </DialogHeader>

        {etapa === "carregando" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {etapa === "preview" && (
          <>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>{empresasElegiveis.length}</strong> empresa(s) elegível(eis) para criação de usuário.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Senha padrão: <code className="bg-muted px-1 rounded">@VV2026</code>
                </p>
              </div>

              {empresasElegiveis.length > 0 ? (
                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <div className="space-y-2">
                    {empresasElegiveis.map((empresa) => (
                      <div
                        key={empresa.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                      >
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {empresa.nome}
                        </span>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {empresa.email_contato}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Todas as empresas ativas já possuem usuário vinculado.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={criarUsuarios}
                disabled={empresasElegiveis.length === 0}
              >
                Criar {empresasElegiveis.length} Usuário(s)
              </Button>
            </DialogFooter>
          </>
        )}

        {(etapa === "processando" || etapa === "concluido") && (
          <>
            <div className="space-y-4">
              {etapa === "processando" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span>{progresso}%</span>
                  </div>
                  <Progress value={progresso} />
                </div>
              )}

              {etapa === "concluido" && (
                <div className="flex gap-4 justify-center">
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {contadores.sucesso} criado(s)
                  </Badge>
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {contadores.duplicado} duplicado(s)
                  </Badge>
                  {contadores.erro > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {contadores.erro} erro(s)
                    </Badge>
                  )}
                </div>
              )}

              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-2">
                  {resultados.map((resultado, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-md ${
                        resultado.status === "sucesso"
                          ? "bg-green-500/10"
                          : resultado.status === "duplicado"
                          ? "bg-yellow-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {resultado.status === "sucesso" && (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {resultado.status === "duplicado" && (
                          <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        {resultado.status === "erro" && (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">
                          {resultado.empresa}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {resultado.status === "sucesso"
                          ? resultado.email
                          : resultado.mensagem || resultado.email}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>
                {etapa === "processando" ? "Processando..." : "Fechar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
