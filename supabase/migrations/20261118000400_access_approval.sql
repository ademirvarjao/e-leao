-- Verified accounts are pending until the explicitly authorized owner approves them.
alter table public.eleao_profiles add column approval_status text not null default 'approved' check (approval_status in ('pending','approved','rejected'));
alter table public.eleao_profiles alter column active set default false;
create or replace function public.eleao_join() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.eleao_profiles(id,display_name,active,approval_status)
 select u.id,left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),'Contribuinte'),80),false,'pending'
 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null on conflict(id) do nothing;
 if not exists(select 1 from public.eleao_profiles where id=auth.uid()) then raise exception 'Confirme seu e-mail para continuar.'; end if;
end;$$;
-- Create the request upon email confirmation, even if the applicant never signs in.
create function public.eleao_request_on_confirm() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and (tg_op='INSERT' or old.email_confirmed_at is null) then
  insert into public.eleao_profiles(id,display_name,active,approval_status)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Contribuinte'),80),false,'pending') on conflict(id) do nothing;
 end if; return new;
end;$$;
create trigger eleao_access_request after insert or update of email_confirmed_at on auth.users for each row execute function public.eleao_request_on_confirm();
create function public.eleao_pending_requests() returns table(id uuid,display_name text,email text,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u join public.eleao_profiles p on p.id=u.id where u.id=auth.uid() and lower(u.email)='ademirvarjao@gmail.com' and u.email_confirmed_at is not null and p.role='admin' and p.active) then raise exception 'Acesso restrito' using errcode='42501'; end if;
 return query select p.id,p.display_name,u.email::text,p.created_at from public.eleao_profiles p join auth.users u on u.id=p.id where p.approval_status='pending' and p.role='member' order by p.created_at;
end;$$;
create function public.eleao_review_request(member_id uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u join public.eleao_profiles p on p.id=u.id where u.id=auth.uid() and lower(u.email)='ademirvarjao@gmail.com' and u.email_confirmed_at is not null and p.role='admin' and p.active) then raise exception 'Acesso restrito' using errcode='42501'; end if;
 update public.eleao_profiles set active=approve,approval_status=case when approve then 'approved' else 'rejected' end where id=member_id and role='member' and approval_status='pending';
 if not found then raise exception 'Solicitação não encontrada ou já analisada'; end if;
end;$$;
-- Reactivation cannot bypass approval or rejection.
create or replace function public.eleao_set_active(member_id uuid,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u join public.eleao_profiles p on p.id=u.id where u.id=auth.uid() and lower(u.email)='ademirvarjao@gmail.com' and u.email_confirmed_at is not null and p.role='admin' and p.active) then raise exception 'Acesso restrito' using errcode='42501'; end if;
 update public.eleao_profiles set active=enabled where id=member_id and role='member' and approval_status='approved'; if not found then raise exception 'Conta não alterada'; end if;
end;$$;
revoke all on function public.eleao_request_on_confirm(),public.eleao_pending_requests(),public.eleao_review_request(uuid,boolean) from public,anon,authenticated;
grant execute on function public.eleao_pending_requests(),public.eleao_review_request(uuid,boolean) to authenticated;

-- Owner bootstrap also clears a pending status if the owner was registered after this migration.
create or replace function public.eleao_claim_owner() returns boolean language plpgsql security definer set search_path='' as $$
declare caller_id uuid := auth.uid(); verified_email text; owner_name text;
begin
 if caller_id is null then raise exception 'Entre na sua conta antes de provisionar o perfil do proprietário.' using errcode='42501'; end if;
 select lower(u.email),left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),'Administrador'),80) into verified_email,owner_name from auth.users u where u.id=caller_id and u.email_confirmed_at is not null;
 if verified_email is distinct from 'ademirvarjao@gmail.com' then return false; end if;
 insert into public.eleao_profiles(id,display_name,role,active,approval_status) values(caller_id,owner_name,'admin',true,'approved') on conflict(id) do update set role='admin',active=true,approval_status='approved';
 return true;
end;$$;
