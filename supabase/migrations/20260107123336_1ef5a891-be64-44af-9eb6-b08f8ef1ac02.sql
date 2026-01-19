-- Create leads table to store imported data
CREATE TABLE public.leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cpf TEXT NOT NULL,
    nome TEXT,
    banco TEXT,
    cbo TEXT,
    status TEXT DEFAULT 'pendente',
    tipo_reprovacao TEXT,
    valor DECIMAL(12,2),
    data_envio TIMESTAMP WITH TIME ZONE,
    data_retorno TIMESTAMP WITH TIME ZONE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    imported_by UUID REFERENCES auth.users(id),
    import_batch_id UUID
);

-- Create imports table to track import batches
CREATE TABLE public.imports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    total_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    error_message TEXT,
    imported_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads - authenticated users can view all leads
CREATE POLICY "Authenticated users can view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (is_admin());

-- RLS policies for imports
CREATE POLICY "Authenticated users can view imports"
ON public.imports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert imports"
ON public.imports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = imported_by);

CREATE POLICY "Users can update their own imports"
ON public.imports
FOR UPDATE
TO authenticated
USING (auth.uid() = imported_by);

-- Create trigger for updating updated_at on leads
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_leads_cpf ON public.leads(cpf);
CREATE INDEX idx_leads_banco ON public.leads(banco);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_import_batch ON public.leads(import_batch_id);