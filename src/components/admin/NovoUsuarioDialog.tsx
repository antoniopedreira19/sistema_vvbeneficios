import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EmpresaMultiSelect } from "./EmpresaMultiSelect";

const usuarioSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100, "Senha muito longa"),
  role: z.enum(["admin", "operacional", "cliente", "financeiro"], {
    required_error: "Selecione um tipo de usuário",
  }),
  empresa_ids: z.array(z.string()).default([]),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

interface NovoUsuarioDialogProps {
  onSuccess?: () => void;
}

export const NovoUsuarioDialog = ({ onSuccess }: NovoUsuarioDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isOperacional } = useUserRole();

  const form = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "cliente",
      empresa_ids: [],
    },
  });

  const role = form.watch("role");
  const empresaIds = form.watch("empresa_ids");

  // Reset empresa_ids when role changes away from cliente
  useEffect(() => {
    if (role !== "cliente") {
      form.setValue("empresa_ids", []);
    }
  }, [role, form]);

  const onSubmit = async (data: UsuarioFormData) => {
    // Validar que cliente tem pelo menos 1 empresa
    if (data.role === 'cliente' && data.empresa_ids.length === 0) {
      toast({
        title: "Selecione uma empresa",
        description: "Usuários cliente precisam ter pelo menos uma empresa vinculada.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          nome: data.nome,
          role: data.role,
          empresa_ids: data.role === 'cliente' ? data.empresa_ids : null,
        },
      });

      if (error) throw error;

      toast({
        title: "Usuário cadastrado!",
        description: data.role === 'cliente' && data.empresa_ids.length > 1
          ? `O usuário foi vinculado a ${data.empresa_ids.length} empresas.`
          : "O usuário foi cadastrado com sucesso.",
      });

      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Novo Usuário</DialogTitle>
          <DialogDescription>
            Cadastre um novo usuário no sistema
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 px-1">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="usuario@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Usuário</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {!isOperacional && <SelectItem value="admin">Administrador</SelectItem>}
                      <SelectItem value="operacional">Operacional</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {role === "cliente" && (
              <FormField
                control={form.control}
                name="empresa_ids"
                render={({ field }) => (
                  <FormItem>
                    <EmpresaMultiSelect
                      selectedIds={field.value}
                      onChange={field.onChange}
                      label="Empresas Vinculadas"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
