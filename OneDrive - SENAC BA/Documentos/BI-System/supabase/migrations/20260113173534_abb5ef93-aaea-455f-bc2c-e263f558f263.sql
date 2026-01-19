-- Adicionar política para permitir que usuários deletem suas próprias importações
CREATE POLICY "Users can delete their own imports" 
ON public.imports 
FOR DELETE 
USING (auth.uid() = imported_by);

-- Nota: A exclusão de leads já está permitida para admins via política existente
-- Como o auth foi desabilitado temporariamente, vamos adicionar uma política temporária
-- para permitir DELETE de leads quando não há auth.uid()
-- (isso deve ser removido quando o auth for reativado)