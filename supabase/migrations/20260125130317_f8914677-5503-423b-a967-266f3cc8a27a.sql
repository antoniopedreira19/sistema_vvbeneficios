-- Adicionar política para clientes verem notas fiscais da sua empresa
CREATE POLICY "Cliente pode ver notas fiscais da sua empresa"
ON public.notas_fiscais
FOR SELECT
USING (
  empresa_id IN (
    SELECT profiles.empresa_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
);