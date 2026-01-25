-- Adicionar coluna para URL da nota fiscal anexada
ALTER TABLE public.notas_fiscais 
ADD COLUMN IF NOT EXISTS nf_url TEXT DEFAULT NULL;

-- Criar bucket para armazenar notas fiscais (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', true)
ON CONFLICT (id) DO NOTHING;

-- Policy para admins/operacionais/financeiro verem notas fiscais
CREATE POLICY "Admins e Financeiro podem ver notas fiscais storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'notas-fiscais' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'operacional') OR
  public.has_role(auth.uid(), 'financeiro')
));

-- Policy para admins/operacionais/financeiro fazerem upload
CREATE POLICY "Admins e Financeiro podem fazer upload de notas fiscais"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notas-fiscais' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'operacional') OR
  public.has_role(auth.uid(), 'financeiro')
));

-- Policy para admins/operacionais/financeiro atualizarem
CREATE POLICY "Admins e Financeiro podem atualizar notas fiscais storage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'notas-fiscais' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'operacional') OR
  public.has_role(auth.uid(), 'financeiro')
));

-- Policy para admins/operacionais/financeiro deletarem
CREATE POLICY "Admins e Financeiro podem deletar notas fiscais storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'notas-fiscais' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'operacional') OR
  public.has_role(auth.uid(), 'financeiro')
));