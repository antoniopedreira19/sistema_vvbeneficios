
# Plano: Botões de Resolução de Pendências

## Objetivo
Adicionar funcionalidade para resolver ou descartar lotes com pendências na aba "Pendências" do Operacional admin.

## Comportamento Esperado

| Ação | Comportamento |
|------|---------------|
| ✅ **Resolvido** | Busca outro lote da mesma empresa, obra e competência → Incrementa `total_colaboradores` com os reprovados → Exclui o lote pendente |
| ❌ **Não Resolvido** | Exclui o lote pendente diretamente |

## Fluxo de Resolução

```text
┌─────────────────────────────────────────┐
│        Lote Com Pendência               │
│  Empresa: ABC | Obra: X | 01/2026       │
│  3 reprovados                           │
├─────────────────────────────────────────┤
│               [✅]  [❌]                │
└─────────────────────────────────────────┘
          │              │
          ▼              ▼
   ┌──────────────┐  ┌──────────────┐
   │  Resolvido   │  │ Não Resolvido│
   │              │  │              │
   │ Busca lote   │  │ Exclui lote  │
   │ mesma        │  │ pendente     │
   │ empresa/obra │  │              │
   │ competência  │  │              │
   │              │  └──────────────┘
   │ Incrementa   │
   │ vidas no     │
   │ lote alvo    │
   │              │
   │ Exclui lote  │
   │ pendente     │
   └──────────────┘
```

## Implementação

### 1. Modificar LotesTable.tsx
- Adicionar novo `actionType: "resolver_pendencia"`
- Criar dois botões lado a lado:
  - Botão verde com ícone `Check` → chama `onResolve(lote)`
  - Botão vermelho com ícone `X` → chama `onReject(lote)`
- Adicionar novas props: `onResolve` e `onReject`

### 2. Modificar Operacional.tsx
- Criar mutação `resolverPendenciaMutation`:
  1. Buscar lote destino (mesma empresa_id, obra_id, competencia, status "concluido" ou "faturado")
  2. Se encontrar: incrementar `total_colaboradores` do lote destino com `total_reprovados` do pendente
  3. Excluir o lote pendente
  4. Se não encontrar lote destino: exibir erro informativo

- Criar mutação `rejeitarPendenciaMutation`:
  1. Excluir o lote pendente diretamente

- Criar dialogs de confirmação para ambas as ações

### 3. Lógica de Busca do Lote Destino

```sql
-- Encontrar lote para mesclar (mesmo contexto)
SELECT id, total_colaboradores FROM lotes_mensais
WHERE empresa_id = [empresa_id]
  AND obra_id = [obra_id]  -- ou IS NULL se obra_id for null
  AND competencia = [competencia]
  AND status IN ('concluido', 'faturado')
  AND id != [lote_pendente_id]
LIMIT 1
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/operacional/LotesTable.tsx` | Adicionar botões ✅/❌ e novas props |
| `src/pages/admin/Operacional.tsx` | Adicionar mutações e handlers para resolver/rejeitar |

## Interface Visual (Pendências)

| Empresa | Obra | Competência | Reprovados | Ações |
|---------|------|-------------|------------|-------|
| EMPRESA ABC | OBRA X | Janeiro/2026 | 3 | [✅ verde] [❌ vermelho] |

## Detalhes Técnicos

### Props Adicionadas no LotesTable
```typescript
interface LotesTableProps {
  // ... props existentes
  onResolve?: (lote: LoteOperacional) => void;
  onReject?: (lote: LoteOperacional) => void;
}
```

### Mutação de Resolução
```typescript
const resolverPendenciaMutation = useMutation({
  mutationFn: async (lote: LoteOperacional) => {
    // 1. Buscar lote destino
    const { data: loteDestino } = await supabase
      .from("lotes_mensais")
      .select("id, total_colaboradores")
      .eq("empresa_id", lote.empresa_id)
      .eq("obra_id", lote.obra?.id || null)
      .eq("competencia", lote.competencia)
      .in("status", ["concluido", "faturado"])
      .neq("id", lote.id)
      .single();
    
    if (!loteDestino) throw new Error("Nenhum lote encontrado para mesclar");
    
    // 2. Incrementar vidas
    await supabase
      .from("lotes_mensais")
      .update({ 
        total_colaboradores: (loteDestino.total_colaboradores || 0) + (lote.total_reprovados || 0)
      })
      .eq("id", loteDestino.id);
    
    // 3. Excluir lote pendente
    await supabase.from("lotes_mensais").delete().eq("id", lote.id);
  }
});
```

## Observações
- Será exibido um dialog de confirmação antes de cada ação
- Se não houver lote destino para mesclar ao resolver, será exibido erro informativo
- A exclusão do lote pendente também remove os colaboradores_lote associados (se houver cascade)
