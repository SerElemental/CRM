-- ============================================================================
-- 0005 · El rol anónimo no tiene ningún permiso sobre los datos
-- ============================================================================
-- La RLS ya impide que alguien sin sesión vea filas. Esto es un segundo candado:
-- Supabase le concede permisos por defecto al rol `anon` sobre lo que se crea en
-- `public`; aquí se le retiran, para lo que existe y para lo que se cree después.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
