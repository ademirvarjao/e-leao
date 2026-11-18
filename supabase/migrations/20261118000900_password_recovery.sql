-- Recovery is explicitly authorized by the owner and never discloses a password to them.
create table public.eleao_password_recovery (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text unique, status text not null default 'issued' check(status in ('issued','processing','completed','revoked')),
 created_at timestamptz not null default now(), expires_at timestamptz not null
);
create unique index eleao_one_reset_per_user on public.eleao_password_recovery(user_id) where status='issued';
alter table public.eleao_password_recovery enable row level security;
revoke all on public.eleao_password_recovery from public,anon,authenticated;
create function public.eleao_issue_password_reset(member_id uuid,hash_value text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.eleao_owner_check() then raise exception 'Acesso restrito' using errcode='42501'; end if;
 if hash_value !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido'; end if;
 if not exists(select 1 from public.eleao_profiles p where p.id=member_id and p.role='member' and p.active and p.approval_status='approved') then raise exception 'Conta indisponível'; end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended(member_id::text,0));
 update public.eleao_password_recovery set status='revoked',token_hash=null where user_id=member_id and status='issued';
 insert into public.eleao_password_recovery(user_id,token_hash,expires_at) values(member_id,hash_value,now()+interval '1 hour');
end;$$;
create function public.eleao_reserve_password_reset(hash_value text) returns table(reset_id uuid,member_id uuid) language plpgsql security definer set search_path='' as $$
begin
 return query update public.eleao_password_recovery r set status='processing',token_hash=null
 where r.token_hash=hash_value and r.status='issued' and r.expires_at>now()
 and exists(select 1 from public.eleao_profiles p where p.id=r.user_id and p.role='member' and p.active and p.approval_status='approved')
 returning r.id,r.user_id;
end;$$;
create function public.eleao_finish_password_reset(reset_id uuid,member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.eleao_password_recovery r set status='completed' where r.id=reset_id and r.user_id=member_id and r.status='processing';
 if not found then raise exception 'Recuperação indisponível'; end if;
 -- Revogação de sessões: elimina refresh tokens por cascata do Supabase Auth.
 delete from auth.sessions where user_id=member_id;
end;$$;
revoke all on function public.eleao_issue_password_reset(uuid,text),public.eleao_reserve_password_reset(text),public.eleao_finish_password_reset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.eleao_issue_password_reset(uuid,text) to authenticated;
grant execute on function public.eleao_reserve_password_reset(text),public.eleao_finish_password_reset(uuid,uuid) to service_role;
