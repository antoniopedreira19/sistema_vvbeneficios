
-- === apolices ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar apólices" ON public.apolices;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar apólices"
ON public.apolices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todas apólices" ON public.apolices;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todas apólices"
ON public.apolices FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === colaboradores ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar todos colaboradores" ON public.colaboradores;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar todos colaboradores"
ON public.colaboradores FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todos colaboradores" ON public.colaboradores;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todos colaboradores"
ON public.colaboradores FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === colaboradores_lote ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar todos colaboradores de lote" ON public.colaboradores_lote;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar todos colaboradores de lote"
ON public.colaboradores_lote FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todos colaboradores de lote" ON public.colaboradores_lote;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todos colaboradores de lote"
ON public.colaboradores_lote FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === empresa_import_layouts ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar layouts" ON public.empresa_import_layouts;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar layouts"
ON public.empresa_import_layouts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === empresas ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar empresas" ON public.empresas;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar empresas"
ON public.empresas FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todas empresas" ON public.empresas;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todas empresas"
ON public.empresas FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === historico_cobrancas ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar histórico cobrancas" ON public.historico_cobrancas;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar histórico cobrancas"
ON public.historico_cobrancas FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver histórico cobrancas" ON public.historico_cobrancas;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver histórico cobrancas"
ON public.historico_cobrancas FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === historico_logs ===
DROP POLICY IF EXISTS "Admin e Operacional podem ver todos logs" ON public.historico_logs;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todos logs"
ON public.historico_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === lotes_mensais ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar todos lotes" ON public.lotes_mensais;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar todos lotes"
ON public.lotes_mensais FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todos lotes" ON public.lotes_mensais;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todos lotes"
ON public.lotes_mensais FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === notas_fiscais ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar notas fiscais" ON public.notas_fiscais;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar notas fiscais"
ON public.notas_fiscais FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin, Operacional e Financeiro podem ver notas fiscais" ON public.notas_fiscais;
CREATE POLICY "Admin, MasterAdmin, Operacional e Financeiro podem ver notas fiscais"
ON public.notas_fiscais FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- === notificacoes ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar notificacoes" ON public.notificacoes;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar notificacoes"
ON public.notificacoes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === obras ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar obras" ON public.obras;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar obras"
ON public.obras FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todas obras" ON public.obras;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todas obras"
ON public.obras FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === precos_planos ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar preços" ON public.precos_planos;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar preços"
ON public.precos_planos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === profiles ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar perfis" ON public.profiles;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar perfis"
ON public.profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

DROP POLICY IF EXISTS "Admin e Operacional podem ver todos perfis" ON public.profiles;
CREATE POLICY "Admin, MasterAdmin e Operacional podem ver todos perfis"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === user_empresas ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar user_empresas" ON public.user_empresas;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar user_empresas"
ON public.user_empresas FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));

-- === user_roles ===
DROP POLICY IF EXISTS "Admin e Operacional podem gerenciar roles" ON public.user_roles;
CREATE POLICY "Admin, MasterAdmin e Operacional podem gerenciar roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master_admin'::app_role) OR has_role(auth.uid(), 'operacional'::app_role));
