-- Adiciona colunas para armazenar CBOs bloqueados extraídos das mensagens de erro
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS cbo_block_code text,
ADD COLUMN IF NOT EXISTS cbo_block_name text;

-- Índice para otimizar queries de agrupamento por CBO bloqueado
CREATE INDEX IF NOT EXISTS idx_leads_cbo_block_code ON public.leads (cbo_block_code) WHERE cbo_block_code IS NOT NULL;