

# Plano: Gerar Adendo por Competência com Armazenamento no Supabase

## Resumo da Funcionalidade

A solicitação envolve três mudanças principais:

1. **Filtro por Competência**: Ao clicar em "Gerar Adendo", adicionar um seletor de competência (baseado nos lotes concluídos/faturados da empresa)
2. **Gerar PDF e Salvar no Storage**: Em vez de apenas abrir para impressão, converter o HTML para PDF e salvar no Supabase Storage
3. **Visualizar/Baixar na lista "Competências Enviadas"**: Mostrar botão de download/visualização do adendo salvo para cada competência

---

## Fluxo Proposto

```
┌─────────────────────────────────────────────────────────────────────┐
│  EmpresaDetailDialog                                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Clique em "Gerar Adendo"                                        │
│        ↓                                                            │
│  2. Dialog abre com:                                                │
│     • Seletor de Competência (lotes concluídos/faturados)           │
│     • Número da Apólice                                             │
│     • Datas de Vigência                                             │
│        ↓                                                            │
│  3. Clique em "Gerar e Salvar"                                      │
│        ↓                                                            │
│  4. Busca colaboradores_lote do lote selecionado (status aprovado)  │
│        ↓                                                            │
│  5. Gera HTML → Converte para PDF (via browser print-to-PDF ou      │
│     biblioteca html2pdf/pdfmake)                                    │
│        ↓                                                            │
│  6. Upload do PDF para Supabase Storage (bucket: contratos)         │
│        ↓                                                            │
│  7. Salva URL no campo adendo_url da tabela lotes_mensais           │
│        ↓                                                            │
│  8. Na lista "Competências Enviadas", exibe ícone de download       │
│     quando adendo_url estiver preenchido                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Técnicas

### 1. Migração de Banco de Dados

Adicionar coluna `adendo_url` na tabela `lotes_mensais` para armazenar o link do PDF gerado:

```sql
ALTER TABLE lotes_mensais
ADD COLUMN adendo_url TEXT;
```

### 2. Modificar `GerarAdendoBtn.tsx`

**Mudanças:**
- Receber lista de competências (lotes concluídos/faturados da empresa)
- Adicionar `Select` para escolher a competência
- Ao gerar:
  - Buscar colaboradores do `colaboradores_lote` com `status_seguradora = 'aprovado'` do lote selecionado
  - Gerar HTML do documento
  - Converter para Blob PDF (usando técnica de print-to-PDF ou html2pdf)
  - Fazer upload para Supabase Storage no bucket `contratos` com path: `adendos/{empresa_id}/{competencia}.pdf`
  - Atualizar coluna `adendo_url` do lote
  - Exibir sucesso

**Nova interface de props:**
```typescript
interface GerarAdendoBtnProps {
  empresaId: string;
  lotes: Array<{ id: string; competencia: string; adendo_url?: string }>;
  variant?: "default" | "outline" | "ghost";
  onAdendoGerado?: () => void;
}
```

### 3. Modificar `EmpresaDetailDialog.tsx`

**Mudanças:**
- Buscar lotes com `status IN ('concluido', 'faturado')` para a empresa
- Passar a lista de lotes para o `GerarAdendoBtn`
- Na seção "Competências Enviadas":
  - Exibir ícone de download/visualização quando `adendo_url` existir
  - Adicionar handler para baixar o PDF

**Atualização da interface `LoteCompetencia`:**
```typescript
interface LoteCompetencia {
  id: string;           // Adicionar ID do lote
  competencia: string;
  status: string;
  adendo_url?: string;  // Adicionar URL do adendo
}
```

### 4. Conversão HTML → PDF

Como a geração atual usa `window.print()`, para salvar como arquivo real temos duas opções:

**Opção A - html2canvas + jsPDF** (mais simples, resultado visual)
- Usar html2canvas para capturar o HTML renderizado
- Converter para PDF com jsPDF
- Instalar: `npm install html2canvas jspdf`

**Opção B - Manter impressão + Upload manual**
- Manter o fluxo atual de impressão
- Adicionar botão separado para upload de PDF já salvo pelo usuário

**Recomendação:** Opção A é mais integrada e automática.

---

## Resumo Visual Final

Na seção "Competências Enviadas" do diálogo:

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 COMPETÊNCIAS ENVIADAS                                       │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Janeiro/2026        [Concluído]     📄 ⬇️                   │
│  ✅ Dezembro/2025       [Faturado]      📄 ⬇️                   │
│  ✅ Novembro/2025       [Faturado]      (sem adendo)            │
└─────────────────────────────────────────────────────────────────┘
        │                                    ↑
        │                                    │
        ↓                                    │
   Clica em 📄 → abre PDF               Clica em ⬇️ → baixa PDF
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `package.json` | Adicionar dependências `html2canvas` e `jspdf` |
| `src/components/shared/GerarAdendoBtn.tsx` | Refatorar para receber lotes, gerar PDF e upload |
| `src/components/crm/EmpresaDetailDialog.tsx` | Passar lotes, mostrar ações de download |
| Migração SQL | Adicionar coluna `adendo_url` em `lotes_mensais` |

---

## Dependências Novas

```json
{
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1"
}
```

