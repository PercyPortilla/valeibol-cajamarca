-- Valeibol · endurece search_path de la validación server-to-server ya desplegada.
alter function public.validate_server_integration_secret(text, text)
  set search_path = public, pg_temp;
