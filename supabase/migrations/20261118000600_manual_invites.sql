-- Solicitações não autenticadas nunca criam contas; somente o dono pode emitir convites.
create table public.eleao_access_requests (
 id uuid primary key default gen_random_uuid(), display_name text not null, email text not null,
 status text not null default 'pending' check(status in ('pending','invited','processing','completed','rejected')),
 token_hash text unique, expires_at timestamptz, created_at timestamptz not null default now(),
 check(length(display_name) between 1 and 80), check(length(email) between 3 and 254)
);
create unique index eleao_one_open_request on public.eleao_access_requests (lower(email)) where status in ('pending','invited','processing');
alter table public.eleao_access_requests enable row level security;
revoke all on public.eleao_access_requests from public, anon, authenticated;
create function public.eleao_request_access(request_name text,request_email text) returns void language plpgsql security definer set search_path='' as $$
declare e text := lower(trim(request_email)); n text := trim(request_name);
begin
 if length(n) not between 1 and 80 or length(e) not between 3 and 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or e='ademirvarjao@gmail.com' then raise exception 'Solicitação inválida'; end if;
 -- Limite global conservador para reduzir abuso; não substitui CAPTCHA/WAF.
 if (select count(*) from public.eleao_access_requests where created_at > now()-interval '1 day') >= 100 then raise exception 'Limite de solicitações atingido. Tente mais tarde.'; end if;
 if exists(select 1 from auth.users where lower(email)=e) then return; end if;
 insert into public.eleao_access_requests(display_name,email) values(n,e) on conflict do nothing;
end;$$;
create function public.eleao_owner_check() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.eleao_profiles p on p.id=u.id where u.id=auth.uid() and lower(u.email)='ademirvarjao@gmail.com' and u.email_confirmed_at is not null and p.role='admin' and p.active)
$$;
create function public.eleao_list_access_requests() returns table(id uuid,display_name text,email text,status text,expires_at timestamptz,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if not public.eleao_owner_check() then raise exception 'Acesso restrito' using errcode='42501'; end if;
 return query select r.id,r.display_name,r.email,r.status,r.expires_at,r.created_at from public.eleao_access_requests r where r.status in ('pending','invited','processing') order by r.created_at;
end;$$;
create function public.eleao_issue_invite(request_id uuid,hash_value text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.eleao_owner_check() then raise exception 'Acesso restrito' using errcode='42501'; end if;
 if hash_value !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido'; end if;
 update public.eleao_access_requests set status='invited',token_hash=hash_value,expires_at=now()+interval '48 hours' where id=request_id and status in ('pending','invited');
 if not found then raise exception 'Solicitação indisponível'; end if;
end;$$;
create function public.eleao_reject_access(request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.eleao_owner_check() then raise exception 'Acesso restrito' using errcode='42501'; end if;
 update public.eleao_access_requests set status='rejected',token_hash=null,expires_at=null where id=request_id and status in ('pending','invited');
 if not found then raise exception 'Solicitação indisponível'; end if;
end;$$;
-- Somente service_role pode reservar/finalizar; transição atômica impede reuso e concorrência.
create function public.eleao_reserve_invite(hash_value text) returns table(request_id uuid,email text,display_name text) language plpgsql security definer set search_path='' as $$
begin
 return query update public.eleao_access_requests r set status='processing',token_hash=null where r.token_hash=hash_value and r.status='invited' and r.expires_at>now() and r.email<>'ademirvarjao@gmail.com' returning r.id,r.email,r.display_name;
end;$$;
create function public.eleao_finish_invite(request_id uuid,user_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.eleao_access_requests%rowtype;
begin
 select * into r from public.eleao_access_requests where id=request_id and status='processing' for update;
 if not found or not exists(select 1 from auth.users u where u.id=user_id and lower(u.email)=r.email and u.email_confirmed_at is not null) then raise exception 'Convite inválido'; end if;
 update public.eleao_profiles set active=true,approval_status='approved' where id=user_id and role='member';
 if not found then raise exception 'Perfil indisponível'; end if;
 update public.eleao_access_requests set status='completed',expires_at=null where id=request_id;
end;$$;
revoke all on function public.eleao_request_access(text,text),public.eleao_owner_check(),public.eleao_list_access_requests(),public.eleao_issue_invite(uuid,text),public.eleao_reject_access(uuid),public.eleao_reserve_invite(text),public.eleao_finish_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.eleao_request_access(text,text) to anon,authenticated;
grant execute on function public.eleao_owner_check(),public.eleao_list_access_requests(),public.eleao_issue_invite(uuid,text),public.eleao_reject_access(uuid) to authenticated;
grant execute on function public.eleao_reserve_invite(text),public.eleao_finish_invite(uuid,uuid) to service_role;
