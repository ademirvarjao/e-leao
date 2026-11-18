-- Install before deployment. This does not disable the existing public API.
-- Tokens are stored only as hashes, and are consumed atomically with the request.
create table public.eleao_captcha_tokens (digest text primary key, consumed_at timestamptz not null default now());
create index eleao_captcha_tokens_consumed_at on public.eleao_captcha_tokens(consumed_at);
alter table public.eleao_captcha_tokens enable row level security;
revoke all on public.eleao_captcha_tokens from public,anon,authenticated;
create function public.eleao_request_access_verified(request_name text,request_email text,issued_at bigint,nonce text,token_digest text) returns void language plpgsql security definer set search_path='' as $$
begin
 if token_digest is null or token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Verificação inválida'; end if;
 delete from public.eleao_captcha_tokens where consumed_at < now()-interval '15 minutes';
 insert into public.eleao_captcha_tokens(digest) values(token_digest) on conflict do nothing;
 if not found then raise exception 'Verificação já utilizada'; end if;
 perform public.eleao_request_access_pow(request_name,request_email,issued_at,nonce);
end;$$;
revoke all on function public.eleao_request_access_verified(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.eleao_request_access_verified(text,text,bigint,text,text) to service_role;
