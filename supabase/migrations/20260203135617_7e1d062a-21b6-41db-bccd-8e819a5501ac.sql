-- Criar tabela user_empresas para vincular usuários a múltiplas empresas
CREATE TABLE public.user_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Policy: Admin e Operacional podem gerenciar user_empresas
CREATE POLICY "Admin e Operacional podem gerenciar user_empresas"
ON public.user_empresas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operacional'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operacional'));

-- Policy: Usuários podem ver suas empresas vinculadas
CREATE POLICY "Usuários podem ver suas empresas vinculadas"
ON public.user_empresas FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Migrar dados existentes: copiar vínculos de profiles.empresa_id para user_empresas
INSERT INTO public.user_empresas (user_id, empresa_id)
SELECT id, empresa_id FROM public.profiles 
WHERE empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;