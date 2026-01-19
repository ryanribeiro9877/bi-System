-- Remove the overly permissive policy and keep only admin insert
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;