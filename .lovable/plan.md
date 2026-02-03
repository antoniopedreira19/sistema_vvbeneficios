
# Plano: Suporte a Múltiplas Empresas por Usuário Cliente

## Visão Geral

Este plano implementa a funcionalidade que permite um usuário cliente estar vinculado a múltiplas empresas/CNPJs. Após o login, o usuário seleciona qual empresa quer acessar e pode trocar a qualquer momento.

## Fluxo do Usuário

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE LOGIN CLIENTE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Login → Primeiro Acesso?                                                   │
│              │                                                               │
│         ┌────┴────┐                                                          │
│        SIM       NÃO                                                         │
│         │         │                                                          │
│         ▼         │                                                          │
│   Troca Senha +   │                                                          │
│   Completa Dados  │                                                          │
│         │         │                                                          │
│         ▼         ▼                                                          │
│   Múltiplas Empresas?                                                        │
│         │                                                                    │
│    ┌────┴────┐                                                               │
│   SIM       NÃO                                                              │
│    │         │                                                               │
│    ▼         │                                                               │
│  Tela de     │                                                               │
│  Seleção     │                                                               │
│  de Empresa  │                                                               │
│    │         │                                                               │
│    ▼         ▼                                                               │
│   Sistema Normal (Dashboard Cliente)                                         │
│    │                                                                         │
│    ▼                                                                         │
│   Botão "Trocar Empresa" no Sidebar                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## O Que Vai Mudar

### 1. Banco de Dados
- Nova tabela `user_empresas` para vincular usuários a múltiplas empresas
- O campo `empresa_id` na tabela `profiles` continua existindo para a empresa "ativa" atual

### 2. Tela do Admin
- O formulário de criar/editar usuário permitirá selecionar múltiplas empresas
- Exibição das empresas vinculadas na listagem de usuários

### 3. Experiência do Cliente
- Nova tela bonita para escolher empresa após login
- Botão no sidebar para trocar de empresa
- Sistema funciona normalmente após escolha

---

## Detalhes Técnicos

### Fase 1: Banco de Dados

#### Nova Tabela `user_empresas`

```sql
CREATE TABLE user_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE user_empresas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin e Operacional podem gerenciar user_empresas"
ON user_empresas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operacional'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operacional'));

CREATE POLICY "Usuários podem ver suas empresas vinculadas"
ON user_empresas FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

#### Migração de Dados Existentes
```sql
-- Copiar vínculos existentes de profiles.empresa_id para user_empresas
INSERT INTO user_empresas (user_id, empresa_id)
SELECT id, empresa_id FROM profiles 
WHERE empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

### Fase 2: Edge Function `create-user`

Modificar para aceitar array de empresas:
- Parâmetro `empresa_ids: string[]` (array de IDs)
- Inserir múltiplos registros em `user_empresas`
- Definir `profiles.empresa_id` como a primeira empresa do array (empresa inicial)

### Fase 3: Componentes Admin

#### `NovoUsuarioDialog.tsx`
- Trocar Select simples por multi-select com checkboxes
- Validar que cliente tem pelo menos 1 empresa selecionada

#### `EditarUsuarioDialog.tsx`
- Carregar empresas vinculadas do usuário da tabela `user_empresas`
- Permitir adicionar/remover empresas
- Sincronizar alterações com `user_empresas`

### Fase 4: Seleção de Empresa (Nova Tela)

#### Novo Componente `EmpresaSelectorPage.tsx`
Uma página com UI elegante para escolher empresa:
- Cards grandes com nome e CNPJ de cada empresa
- Efeito hover suave
- Transição animada ao selecionar
- Armazenar escolha em `sessionStorage` ou atualizar `profiles.empresa_id`

### Fase 5: Fluxo de Login

#### Modificar `Index.tsx`
Após verificar primeiro login:
1. Buscar empresas vinculadas do usuário em `user_empresas`
2. Se só tem 1 empresa: ir direto para dashboard
3. Se tem múltiplas: redirecionar para `/cliente/selecionar-empresa`

### Fase 6: Botão de Troca no Sidebar

#### Modificar `AppSidebar.tsx`
- Adicionar botão "Trocar Empresa" para clientes com múltiplas empresas
- Exibir nome da empresa atual no header
- Ao clicar, redireciona para tela de seleção

### Fase 7: Hook `useUserRole`

Modificar para:
- Expor lista de empresas vinculadas (`empresasVinculadas`)
- Expor empresa ativa atual (`empresaAtiva`)
- Função `setEmpresaAtiva(empresaId)` para trocar empresa

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx.sql` | Criar | Tabela `user_empresas` + migração |
| `src/pages/cliente/SelecionarEmpresa.tsx` | Criar | Tela de seleção de empresa |
| `src/hooks/useUserRole.tsx` | Modificar | Adicionar suporte multi-empresa |
| `src/components/admin/NovoUsuarioDialog.tsx` | Modificar | Multi-select de empresas |
| `src/components/admin/EditarUsuarioDialog.tsx` | Modificar | Multi-select de empresas |
| `src/components/admin/CriarUsuariosMassaDialog.tsx` | Modificar | Criar vinculos em `user_empresas` |
| `supabase/functions/create-user/index.ts` | Modificar | Aceitar array de empresas |
| `src/components/AppSidebar.tsx` | Modificar | Botão trocar empresa + nome atual |
| `src/pages/Index.tsx` | Modificar | Lógica de redirecionamento |
| `src/App.tsx` | Modificar | Adicionar rota `/cliente/selecionar-empresa` |
| `src/integrations/supabase/types.ts` | Atualizar | Incluir tipos da nova tabela |

---

## Compatibilidade com Sistema Atual

- Usuários com apenas 1 empresa vinculada funcionam exatamente como antes
- O campo `profiles.empresa_id` continua sendo a empresa "ativa"
- Todas as queries existentes que usam `profile.empresa_id` continuam funcionando
- Não há breaking changes para usuários existentes

---

## Estimativa de Complexidade

**Nível: Médio**

O sistema atual já tem uma boa arquitetura. As mudanças são incrementais e não destrutivas. A maior parte do trabalho está na UI do multi-select e na nova tela de seleção de empresa.

