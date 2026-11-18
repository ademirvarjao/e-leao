-- Serialize the global daily bound to prevent parallel requests bypassing it.
create or replace function public.eleao_request_access(request_name text,request_email text) returns void language plpgsql security definer set search_path='' as $$
declare e text := lower(trim(request_email)); n text := trim(request_name);
begin
 if length(n) not between 1 and 80 or length(e) not between 3 and 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or e='ademirvarjao@gmail.com' then raise exception 'Solicitação inválida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(170011002);
 if (select count(*) from public.eleao_access_requests where created_at > now()-interval '1 day') >= 100 then raise exception 'Limite de solicitações atingido. Tente mais tarde.'; end if;
 if exists(select 1 from auth.users where lower(email)=e) then return; end if;
 insert into public.eleao_access_requests(display_name,email) values(n,e) on conflict do nothing;
end;$$;
