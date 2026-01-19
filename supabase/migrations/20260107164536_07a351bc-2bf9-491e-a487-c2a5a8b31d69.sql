-- Add JSONB columns to store raw import data
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS retorno_autorizacao jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retorno_margem jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retorno_simulacao jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retorno_proposta jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retorno_get_proposta jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ultimo_log timestamp with time zone DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.retorno_autorizacao IS 'JSON com autorizacaoId e shortUrl';
COMMENT ON COLUMN public.leads.retorno_margem IS 'JSON com dados de margem, empregador e dados pessoais';
COMMENT ON COLUMN public.leads.retorno_simulacao IS 'JSON com detalhes da simulação de crédito';
COMMENT ON COLUMN public.leads.retorno_proposta IS 'JSON com retorno da proposta';
COMMENT ON COLUMN public.leads.retorno_get_proposta IS 'JSON com dados da proposta consultada';
COMMENT ON COLUMN public.leads.ultimo_log IS 'Data/hora da última consulta';