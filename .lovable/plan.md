
## Diagnóstico (o que está acontecendo de verdade)

Pelos requests do navegador, o app **está consultando `user_empresas` corretamente**, e o usuário realmente tem 2 vínculos. Porém o retorno vem assim:

- 1º vínculo: `empresas: { id, nome, cnpj }` (ok)
- 2º vínculo: `empresas: null` (quebra a multi-empresa)

Isso significa que:
- a linha existe em `user_empresas`, **mas o cliente não tem permissão de SELECT na linha correspondente em `public.empresas`** (RLS), então o “join” embutido (`empresas:empresa_id(...)`) volta `null`.

E por que isso acontece?  
Porque a policy atual **“Cliente pode ver empresas vinculadas”** na tabela `empresas` está com a condição errada:

```sql
ue.empresa_id = ue.id
```

Ou seja: ela compara `empresa_id` com o **id da própria linha da junction (`user_empresas.id`)**, o que nunca bate e não libera as empresas vinculadas.

Resultado no frontend:
- `useUserRole.fetchEmpresasVinculadas()` faz `.map(item => item.empresas).filter(Boolean)`
- como uma empresa vem `null`, ela é descartada
- então `empresasVinculadas.length` vira 1 e `hasMultipleEmpresas` fica `false`
- por isso **não aparece a tela de selecionar empresa no login** e **não aparece “Trocar Empresa” na sidebar**

## Melhor solução arquitetural (sem mudar funcionalidades do sistema)

**Não** recomendo remover `profiles.empresa_id`.

Motivo: hoje o sistema usa `profiles.empresa_id` como **empresa ativa** e várias RLS policies (ex.: `colaboradores`, `obras`, `lotes_mensais`, etc.) já filtram dados por `profiles.empresa_id`.  
Se você remover isso, terá um efeito dominó: precisará reescrever políticas e lógica de dados para todas as telas do cliente (mudança grande e arriscada).

O desenho correto para o seu caso é:
- `user_empresas`: “quais empresas o usuário pode acessar”
- `profiles.empresa_id`: “qual empresa está ativa agora (contexto da sessão)”

Então a correção deve ser **apenas** garantir que o cliente consiga listar as empresas vinculadas via `user_empresas`.

## Correção proposta (passo a passo, mínima e focada)

### 1) Corrigir a policy RLS de `public.empresas` (principal causa)

Aplicar este SQL (em uma migração/alteração de banco):

```sql
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
```

Ponto crítico: note o `public.empresas.id` totalmente qualificado.
- Isso garante que o PostgreSQL compare com o **id da empresa (linha externa)** e não com `ue.id`.

### 2) Validar que a policy ficou certa (checagem objetiva)

Conferir no banco:

```sql
select policyname, qual
from pg_policies
where schemaname='public' and tablename='empresas'
order by policyname;
```

Esperado: a policy “Cliente pode ver empresas vinculadas” precisa conter `ue.empresa_id = public.empresas.id`.

### 3) Validar no navegador (checagem pelo comportamento)

Após a correção:
1. Fazer logout/login com o usuário cliente que tem 2 empresas.
2. Confirmar que o request:
   `GET /rest/v1/user_empresas?select=empresa_id,empresas:empresa_id(id,nome,cnpj)...`
   volta `empresas` preenchido nas 2 linhas (nada de `null`).
3. Confirmar que:
   - ao logar, redireciona para `/cliente/selecionar-empresa`
   - a sidebar mostra “Trocar Empresa”
   - ao trocar, `profiles.empresa_id` é atualizado e as telas do cliente passam a refletir a empresa ativa

### 4) (Pequena robustez opcional, ainda dentro do mesmo problema)
Mesmo com RLS correta, vale evitar o app “esconder” vínculos quando vier `null`:
- Ajustar `useUserRole.fetchEmpresasVinculadas()` para registrar um erro claro se existir algum item com `empresas === null` (indicando RLS ou dado inválido).
- E, se houver N vínculos em `user_empresas` mas só M detalhes carregados, considerar manter `hasMultipleEmpresas` baseado na contagem de vínculos (para não falhar silenciosamente).

Isso não muda regra de negócio; só evita que um problema de permissão faça a multi-empresa “sumir” sem aviso.

## Riscos / por que isso não afeta outras funcionalidades
- A alteração é só uma policy de SELECT em `empresas` para o role “cliente”.
- Admin/Operacional/Financeiro continuam como estão.
- Não mexe em tabelas de dados do cliente (colaboradores/lotes/etc.).
- Não muda a lógica do fluxo; apenas faz o app conseguir enxergar as empresas que já estão vinculadas.

## Critério de pronto (Definition of Done)
- Cliente com 2 vínculos em `user_empresas` vê as 2 empresas na tela `/cliente/selecionar-empresa`.
- Ao logar, aparece a seleção (ou, no mínimo, o botão “Trocar Empresa” fica disponível).
- Trocar empresa atualiza `profiles.empresa_id` e mantém navegação estável sem tela em branco.
