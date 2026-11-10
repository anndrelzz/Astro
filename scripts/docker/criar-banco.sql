-- Roda uma vez, quando o volume do PostgreSQL do docker-compose nasce vazio.
--
-- Mesmo arranjo do CI e da producao: o usuario "astro" e dono do banco (roda
-- as migrations), mas NAO e superusuario nem tem BYPASSRLS. Com um
-- superusuario, o PostgreSQL ignora as policies de RLS e uma estetica
-- enxergaria os dados da outra.
CREATE ROLE astro LOGIN PASSWORD 'astro' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE DATABASE astro OWNER astro;
