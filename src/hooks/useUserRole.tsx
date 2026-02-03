import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type UserRole = "admin" | "cliente" | "operacional" | "financeiro" | null;

interface Profile {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
}

interface EmpresaVinculada {
  id: string;
  nome: string;
  cnpj: string;
}

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresasVinculadas, setEmpresasVinculadas] = useState<EmpresaVinculada[]>([]);
  const [empresasLoading, setEmpresasLoading] = useState(true);
  const [empresaAtiva, setEmpresaAtivaState] = useState<EmpresaVinculada | null>(null);

  const fetchEmpresasVinculadas = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          empresa_id,
          empresas:empresa_id (
            id,
            nome,
            cnpj
          )
        `)
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching empresas vinculadas:", error);
        return [];
      }

      // Extrair empresas do resultado
      const empresas: EmpresaVinculada[] = (data || [])
        .map((item: any) => item.empresas)
        .filter(Boolean);

      return empresas;
    } catch (error) {
      console.error("Error in fetchEmpresasVinculadas:", error);
      return [];
    }
  }, []);

  const setEmpresaAtiva = useCallback(async (empresaId: string) => {
    if (!user) return;

    try {
      // Atualizar profiles.empresa_id para definir empresa ativa
      const { error } = await supabase
        .from("profiles")
        .update({ empresa_id: empresaId })
        .eq("id", user.id);

      if (error) {
        console.error("Error updating empresa_id:", error);
        return;
      }

      // Atualizar estado local
      const novaEmpresaAtiva = empresasVinculadas.find(e => e.id === empresaId);
      if (novaEmpresaAtiva) {
        setEmpresaAtivaState(novaEmpresaAtiva);
        setProfile(prev => prev ? { ...prev, empresa_id: empresaId } : null);
      }
    } catch (error) {
      console.error("Error in setEmpresaAtiva:", error);
    }
  }, [user, empresasVinculadas]);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setEmpresasVinculadas([]);
      setEmpresaAtivaState(null);
      setLoading(false);
      setEmpresasLoading(false);
      return;
    }

    const fetchRoleAndProfile = async () => {
      setEmpresasLoading(true);
      try {
        // Fetch role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const userRole = roleData?.role as UserRole;
        setRole(userRole);

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        // Se for cliente, buscar empresas vinculadas
        if (userRole === "cliente") {
          const empresas = await fetchEmpresasVinculadas(user.id);
          setEmpresasVinculadas(empresas);

          // Definir empresa ativa baseada em profiles.empresa_id
          if (profileData?.empresa_id && empresas.length > 0) {
            const ativa = empresas.find(e => e.id === profileData.empresa_id);
            setEmpresaAtivaState(ativa || empresas[0]);
          } else if (empresas.length > 0) {
            setEmpresaAtivaState(empresas[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching role and profile:", error);
      } finally {
        setLoading(false);
        setEmpresasLoading(false);
      }
    };

    fetchRoleAndProfile();
  }, [user, fetchEmpresasVinculadas]);

  return { 
    role, 
    profile, 
    loading, 
    empresasLoading,
    isAdmin: role === "admin", 
    isOperacional: role === "operacional",
    isCliente: role === "cliente",
    isFinanceiro: role === "financeiro",
    isAdminOrOperacional: role === "admin" || role === "operacional",
    // Multi-empresa
    empresasVinculadas,
    empresaAtiva,
    setEmpresaAtiva,
    hasMultipleEmpresas: empresasVinculadas.length > 1
  };
};
