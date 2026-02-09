
-- Drop existing storage policies for notas-fiscais bucket
DROP POLICY IF EXISTS "Admins e Financeiro podem fazer upload de notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "Admins e Financeiro podem ver notas fiscais storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins e Financeiro podem atualizar notas fiscais storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins e Financeiro podem deletar notas fiscais storage" ON storage.objects;

-- Recreate with master_admin included
CREATE POLICY "Admins e Financeiro podem fazer upload de notas fiscais"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'notas-fiscais' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'master_admin'::app_role) OR
    has_role(auth.uid(), 'operacional'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Admins e Financeiro podem ver notas fiscais storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'notas-fiscais' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'master_admin'::app_role) OR
    has_role(auth.uid(), 'operacional'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Admins e Financeiro podem atualizar notas fiscais storage"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'notas-fiscais' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'master_admin'::app_role) OR
    has_role(auth.uid(), 'operacional'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  )
);

CREATE POLICY "Admins e Financeiro podem deletar notas fiscais storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'notas-fiscais' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'master_admin'::app_role) OR
    has_role(auth.uid(), 'operacional'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  )
);
