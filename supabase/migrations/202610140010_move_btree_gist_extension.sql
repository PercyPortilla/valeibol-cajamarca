-- Valeibol · mover btree_gist fuera del esquema expuesto public
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
