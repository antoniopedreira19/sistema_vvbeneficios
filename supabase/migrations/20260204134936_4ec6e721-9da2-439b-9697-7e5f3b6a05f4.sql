-- Corrigir policy RLS: clientes devem ver TODAS as empresas vinculadas via user_empresas
DROP POLICY IF EXISTS "Cliente pode ver empresas vinculadas" ON public.empresas;

CREATE POLICY "Cliente pode ver empresas vinculadas"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid()
      AND ue.empresa_id = public.empresas.id
  )
);