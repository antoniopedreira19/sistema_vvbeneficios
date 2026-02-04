import { useEffect, useState, useCallback, useRef } from "react";
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
  
  // Prevent duplicate fetches
  const fetchedRef = useRef<string | null>(null);

  const setEmpresaAtiva = useCallback(async (empresaId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ empresa_id: empresaId })
        .eq("id", user.id);

      if (error) {
        console.error("Error updating empresa_id:", error);
        return;
      }

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
      fetchedRef.current = null;
      return;
    }

    // Prevent duplicate fetches for the same user
    if (fetchedRef.current === user.id) {
      return;
    }
    fetchedRef.current = user.id;

    const fetchAllData = async () => {
      try {
        // Fetch role, profile, and empresas in PARALLEL
        const [roleResult, profileResult, empresasResult] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          supabase
            .from("user_empresas")
            .select(`
              empresa_id,
              empresas:empresa_id (
                id,
                nome,
                cnpj
              )
            `)
            .eq("user_id", user.id)
        ]);

        const userRole = roleResult.data?.role as UserRole;
        setRole(userRole);
        setProfile(profileResult.data);

        // Process empresas only for clients
        if (userRole === "cliente" && empresasResult.data) {
          const empresas: EmpresaVinculada[] = empresasResult.data
            .map((item: any) => item.empresas)
            .filter(Boolean);

          // Log warning if some empresas came back null (RLS issue)
          const nullCount = empresasResult.data.filter((item: any) => !item.empresas).length;
          if (nullCount > 0) {
            console.warn(`[useUserRole] ${nullCount} empresa(s) returned null - possible RLS issue`);
          }

          setEmpresasVinculadas(empresas);

          // Set active empresa
          if (profileResult.data?.empresa_id && empresas.length > 0) {
            const ativa = empresas.find(e => e.id === profileResult.data.empresa_id);
            setEmpresaAtivaState(ativa || empresas[0]);
          } else if (empresas.length > 0) {
            setEmpresaAtivaState(empresas[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
        setEmpresasLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

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
    empresasVinculadas,
    empresaAtiva,
    setEmpresaAtiva,
    hasMultipleEmpresas: empresasVinculadas.length > 1
  };
};