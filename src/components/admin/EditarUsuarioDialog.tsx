import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { EmpresaMultiSelect } from "./EmpresaMultiSelect";

const usuarioSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  celular: z.string().optional(),
  role: z.enum(["admin", "operacional", "cliente", "financeiro"], {
    required_error: "Selecione um tipo de usuário",
  }),
  empresa_ids: z.array(z.string()).default([]),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

interface Usuario {
  id: string;
  nome: string;
  email: string;
  celular: string | null;
  empresa_id: string | null;
  role: string | null;
}

interface EditarUsuarioDialogProps {
  usuario: Usuario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditarUsuarioDialog = ({ usuario, open, onOpenChange, onSuccess }: EditarUsuarioDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const { isOperacional } = useUserRole();

  const form = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nome: "",
      celular: "",
      role: "cliente",
      empresa_ids: [],
    },
  });

  const role = form.watch("role");

  // Carregar dados do usuário e empresas vinculadas
  useEffect(() => {
    const loadUserData = async () => {
      if (!usuario || !open) return;

      setLoadingEmpresas(true);
      try {
        // Carregar empresas vinculadas da tabela user_empresas
        const { data: userEmpresas, error } = await supabase
          .from("user_empresas")
          .select("empresa_id")
          .eq("user_id", usuario.id);

        const empresaIds = error ? [] : (userEmpresas || []).map(ue => ue.empresa_id);

        form.reset({
          nome: usuario.nome,
          celular: usuario.celular || "",
          role: (usuario.role as "admin" | "operacional" | "cliente" | "financeiro") || "cliente",
          empresa_ids: empresaIds,
        });
      } catch (error) {
        console.error("Error loading user empresas:", error);
        form.reset({
          nome: usuario.nome,
          celular: usuario.celular || "",
          role: (usuario.role as "admin" | "operacional" | "cliente" | "financeiro") || "cliente",
          empresa_ids: usuario.empresa_id ? [usuario.empresa_id] : [],
        });
      } finally {
        setLoadingEmpresas(false);
      }
    };

    loadUserData();
  }, [usuario, open, form]);

  // Reset empresa_ids when role changes away from cliente
  useEffect(() => {
    if (role !== "cliente") {
      form.setValue("empresa_ids", []);
    }
  }, [role, form]);

  const onSubmit = async (data: UsuarioFormData) => {
    if (!usuario) return;

    // Validar que cliente tem pelo menos 1 empresa
    if (data.role === 'cliente' && data.empresa_ids.length === 0) {
      toast.error("Usuários cliente precisam ter pelo menos uma empresa vinculada.");
      return;
    }
    
    setLoading(true);
    try {
      // Update profile - empresa_id é a primeira empresa do array
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: data.nome,
          celular: data.celular || null,
          empresa_id: data.role === 'cliente' && data.empresa_ids.length > 0 
            ? data.empresa_ids[0] 
            : null,
        })
        .eq("id", usuario.id);

      if (profileError) throw profileError;

      // Update role - delete existing and insert new
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", usuario.id);

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: usuario.id, role: data.role as any });

      if (roleError) throw roleError;

      // Atualizar user_empresas para clientes
      if (data.role === 'cliente') {
        // Remover vínculos antigos
        await supabase
          .from("user_empresas")
          .delete()
          .eq("user_id", usuario.id);

        // Inserir novos vínculos
        if (data.empresa_ids.length > 0) {
          const inserts = data.empresa_ids.map(empresaId => ({
            user_id: usuario.id,
            empresa_id: empresaId
          }));

          const { error: userEmpresasError } = await supabase
            .from("user_empresas")
            .insert(inserts);

          if (userEmpresasError) throw userEmpresasError;
        }
      } else {
        // Se não for mais cliente, remover vínculos
        await supabase
          .from("user_empresas")
          .delete()
          .eq("user_id", usuario.id);
      }

      toast.success(
        data.role === 'cliente' && data.empresa_ids.length > 1
          ? `Usuário atualizado! Vinculado a ${data.empresa_ids.length} empresas.`
          : "Usuário atualizado com sucesso!"
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar usuário");
    } finally {
      setLoading(false);
    }
  };

  if (!usuario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações de <strong>{usuario.email}</strong>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="celular"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
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
                      disabled={loadingEmpresas}
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
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || loadingEmpresas}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
