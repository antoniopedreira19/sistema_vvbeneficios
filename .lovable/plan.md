

# Corrigir erro de RLS no upload de Notas Fiscais

## Problema Identificado

O erro **"new row violates row-level security policy"** acontece no **storage** (bucket `notas-fiscais`), e nao na tabela `notas_fiscais`.

As politicas de storage do bucket `notas-fiscais` permitem upload apenas para os cargos `admin`, `operacional` e `financeiro` -- mas **nao incluem `master_admin`**. Como o usuario logado (`antoniopvo19@outlook.com.br`) possui o cargo `master_admin`, o upload e bloqueado.

## Solucao

Adicionar o cargo `master_admin` em todas as 4 politicas de storage do bucket `notas-fiscais`:

1. **INSERT** (upload) - "Admins e Financeiro podem fazer upload de notas fiscais"
2. **SELECT** (leitura) - "Admins e Financeiro podem ver notas fiscais storage"
3. **UPDATE** (atualizacao) - "Admins e Financeiro podem atualizar notas fiscais storage"
4. **DELETE** (exclusao) - "Admins e Financeiro podem deletar notas fiscais storage"

## Detalhes Tecnicos

Sera executada uma migracao SQL que remove as politicas atuais e as recria incluindo `has_role(auth.uid(), 'master_admin'::app_role)` em cada uma delas. Exemplo da condicao atualizada:

```text
has_role(auth.uid(), 'admin') 
OR has_role(auth.uid(), 'master_admin')
OR has_role(auth.uid(), 'operacional') 
OR has_role(auth.uid(), 'financeiro')
```

Nenhuma alteracao de codigo frontend e necessaria.

