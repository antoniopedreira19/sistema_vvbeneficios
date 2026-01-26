
# Plano: Criar Usuários em Massa para Empresas Ativas

## Objetivo
Criar uma funcionalidade que permita gerar usuários automaticamente para todas as empresas ativas que possuem `email_contato`, usando a senha padrão `@VV2026`.

## Dados Atuais
- **95** empresas ativas no sistema
- **81** empresas com `email_contato` preenchido
- Algumas empresas podem já ter usuários vinculados

## Implementação

### 1. Novo Botão na Página AdminEmpresas
Adicionar um botão "Criar Usuários em Massa" na página `src/pages/admin/AdminEmpresas.tsx`, ao lado dos botões existentes.

### 2. Dialog de Confirmação
Criar um dialog que:
- Busca todas as empresas ativas com `email_contato`
- Filtra as que **ainda não têm** usuário vinculado (verificando na tabela `profiles`)
- Exibe uma prévia com:
  - Total de empresas elegíveis
  - Lista das empresas que receberão usuários
- Permite confirmar ou cancelar a operação

### 3. Processo de Criação
Para cada empresa elegível:
1. Chamar a Edge Function `create-user` com:
   - `email`: email_contato da empresa
   - `password`: `@VV2026`
   - `nome`: nome da empresa
   - `role`: `cliente`
   - `empresa_id`: id da empresa

### 4. Feedback ao Usuário
- Progress bar durante a criação
- Relatório final com:
  - ✅ Usuários criados com sucesso
  - ⚠️ Emails já cadastrados (ignorados)
  - ❌ Erros (se houver)

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/pages/admin/AdminEmpresas.tsx` | Adicionar botão e importar dialog |
| `src/components/admin/CriarUsuariosMassaDialog.tsx` | **Novo** - Dialog com lógica de criação em massa |

## Segurança
- Apenas admins/operacionais terão acesso ao botão
- A Edge Function `create-user` já valida permissões
- Emails duplicados são tratados (retorna erro específico que será capturado)

## Detalhes Técnicos

```text
┌─────────────────────────────────────────────────────────┐
│                    AdminEmpresas                         │
├─────────────────────────────────────────────────────────┤
│  [Baixar Vidas] [Criar Usuários em Massa] [Nova Empresa] │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           CriarUsuariosMassaDialog                       │
├─────────────────────────────────────────────────────────┤
│  1. Busca empresas ativas com email_contato              │
│  2. Verifica quais já têm usuário em profiles            │
│  3. Exibe lista de empresas elegíveis                    │
│  4. Ao confirmar: loop chamando create-user              │
│  5. Exibe relatório final                                │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Verificação de Duplicados
```sql
-- Empresas elegíveis (sem usuário vinculado)
SELECT e.id, e.nome, e.email_contato
FROM empresas e
WHERE e.status = 'ativa'
  AND e.email_contato IS NOT NULL
  AND e.email_contato != ''
  AND NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.empresa_id = e.id
  )
```

## Observações
- A senha padrão `@VV2026` será usada para todos
- O usuário do primeiro login será solicitado a trocar a senha (se implementado)
- Emails inválidos ou duplicados serão reportados no relatório final
