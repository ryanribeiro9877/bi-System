-- Script para apagar todos os leads da tabela
-- Execute este script no SQL Editor do Supabase

-- Apaga todos os registros da tabela leads
DELETE FROM leads;

-- Reseta a sequência do ID (opcional)
-- ALTER SEQUENCE leads_id_seq RESTART WITH 1;

-- Verifica se a tabela está vazia
SELECT COUNT(*) FROM leads;

-- Mostra os primeiros registros (deve retornar vazio)
SELECT * FROM leads LIMIT 5;
