
## Adicionar datas de rastreamento na tabela notas_fiscais

Atualmente, a tabela `notas_fiscais` possui apenas campos booleanos (nf_emitida, boleto_gerado, pago), mas **nao registra quando** cada evento aconteceu. Para viabilizar KPIs de tempo (ex: dias entre emissao da NF e pagamento), precisamos adicionar colunas de data.

### O que sera feito

**1. Migracao no banco de dados**

Adicionar 3 novas colunas na tabela `notas_fiscais`:

| Coluna | Tipo | Descricao |
|---|---|---|
| `nf_emitida_em` | timestamp with time zone | Data em que a NF foi marcada como emitida |
| `boleto_gerado_em` | timestamp with time zone | Data em que o boleto foi marcado como gerado |
| `pago_em` | timestamp with time zone | Data em que foi marcado como pago |

Todas nullable, preenchidas automaticamente quando o usuario altera o campo correspondente.

**2. Atualizar o codigo da pagina NotasFiscais.tsx**

Modificar a funcao `updateField` para que, ao alterar um campo booleano, tambem salve a data correspondente:

- `nf_emitida = true` --> salva `nf_emitida_em = now()`; se `false` --> limpa `nf_emitida_em = null`
- `boleto_gerado = true` --> salva `boleto_gerado_em = now()`; se `false` --> limpa `boleto_gerado_em = null`
- `pago = true` --> salva `pago_em = now()`; se `false` --> limpa `pago_em = null`

Mesma logica para o upload de arquivos (anexar NF ou boleto).

**3. Atualizar tipos TypeScript**

Adicionar os 3 novos campos na interface `NotaFiscal` e no arquivo de tipos do Supabase.

---

### Detalhes tecnicos

- A migracao sera feita via SQL migration no Supabase
- Nenhuma mudanca visual sera feita agora -- as datas ficam salvas para uso futuro em KPIs
- Os registros existentes terao essas colunas como `null` (dados historicos nao terao data retroativa)
