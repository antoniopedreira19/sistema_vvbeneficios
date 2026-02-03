-- Permitir que clientes vejam todas as empresas vinculadas (user_empresas)
-- Isso corrige: seleção/troca de empresa não aparecer quando há múltiplas empresas vinculadas

DROP POLICY IF EXISTS "Cliente pode ver empresas vinculadas" ON public.empresas;

CREATE POLICY "Cliente pode ver empresas vinculadas"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid()
      AND ue.empresa_id = id
  )
);
