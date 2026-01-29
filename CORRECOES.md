# Correções do Sistema BI - Contagem de Leads e Margem Reprovada

## Problemas Identificados

### Problema 1: Contagem de Leads Aprovados Incorreta
O sistema estava contando leads aprovados incorretamente, mostrando muito mais do que os 78 leads reais.

### Problema 2: Classificação de Margem Reprovada Incorreta
Todos os clientes reprovados estavam sendo classificados como "margem reprovada", quando deveria ser apenas aqueles que falharam especificamente na etapa de `retorno_margem`.

---

## Correções Aplicadas

### 1. Contagem de Leads Aprovados (`normalizarStatusLead`)

**REGRA CORRETA DE APROVAÇÃO**:
- Um lead é **APROVADO** APENAS quando `retorno_proposta.status === "success"`
- `retorno_get_proposta` **NÃO** indica aprovação

| Status | Critério |
|--------|----------|
| **APROVADO** | `retorno_proposta.status === "success"` sem erros técnicos |
| **REPROVAÇÃO TÉCNICA** | `retorno_proposta.status === "success"` mas com erros em etapas anteriores |
| **PENDENTE** | Erros de sistema: rate limit (429), limite excedido |
| **REPROVADO** | Todos os outros casos |

### 2. Classificação de Margem Reprovada (`classificarMargemReprovada`)

**REGRA CORRIGIDA E RIGOROSA**:
Um lead é classificado como "margem reprovada" **APENAS** quando:
1. O `retorno_margem` indica **ERRO/FALHA** (não sucesso)
2. E o erro é devido a margem zerada, negativa ou insuficiente

**NÃO classificar como margem reprovada quando**:
- Não há `retorno_margem` preenchido
- O `retorno_margem` indica **SUCESSO** (status = success/ok/approved)
- A margem foi consultada com sucesso mas a reprovação ocorreu em outra etapa (simulação, proposta, etc)
- O erro é técnico (timeout, rate limit, etc)
- O erro é de inelegibilidade do convênio (CBO bloqueado, etc)
- A margem está OK (valor positivo e suficiente)

**LÓGICA DE VERIFICAÇÃO**:
```
1. Tem retorno_margem? 
   - NÃO → não é margem reprovada
   
2. retorno_margem.status é "success"/"ok"/"approved"?
   - SIM → não é margem reprovada (a reprovação foi em outra etapa)
   
3. retorno_margem tem erro explícito (error/erro/message)?
   - NÃO e margem > 0 → não é margem reprovada
   
4. O erro é técnico (timeout, rate limit)?
   - SIM → não é margem reprovada
   
5. O erro é inelegibilidade (CBO bloqueado)?
   - SIM → classificar como inelegibilidade_convenio
   
6. Valor da margem:
   - < 0 → margem_negativa
   - = 0 → margem_zerada  
   - > 0 e < limiar → margem_insuficiente
   - >= limiar → não é margem reprovada
```

| Tipo de Margem | Critério |
|----------------|----------|
| **margem_negativa** | `valorMargemDisponivel < 0` E retorno_margem indica erro |
| **margem_zerada** | `valorMargemDisponivel === 0` E retorno_margem indica erro |
| **margem_insuficiente** | `0 < valorMargemDisponivel < limiar` E retorno_margem indica erro |
| **nao_aplicavel** | retorno_margem com sucesso, ou margem OK, ou sem dados |
| **inelegibilidade_convenio** | CBO bloqueado, empresa não atende, etc |

---

## Arquivos Alterados

1. **`src/lib/leadStatusUtils.ts`**
   - Corrigida função `normalizarStatusLead` (removido fallback de `retorno_get_proposta`)
   - Reescrita função `classificarMargemReprovada` com lógica correta

2. **`src/hooks/useLeadsData.tsx`**
   - Corrigida contagem de leads por status

---

## Como Aplicar

1. Substitua o arquivo `src/lib/leadStatusUtils.ts` pelo arquivo corrigido
2. Substitua o arquivo `src/hooks/useLeadsData.tsx` pelo arquivo corrigido
3. Faça build e deploy

---

## Verificação

Após aplicar as correções:
- **Leads Aprovados**: Apenas aqueles com `retorno_proposta.status === "success"`
- **Margem Reprovada**: Apenas leads com erro em `retorno_margem` E margem zerada/negativa/insuficiente
