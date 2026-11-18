-- Apply only after all public clients use eleao_request_access_pow.
-- Proof digests are retained for longer than the full accepted timestamp window.
create table public.eleao_request_proofs (
 digest text primary key,
 consumed_at timestamptz not null default now()
);
create index eleao_request_proofs_consumed_at on public.eleao_request_proofs(consumed_at);
alter table public.eleao_request_proofs enable row level security;
revoke all on public.eleao_request_proofs from public, anon, authenticated;

create or replace function public.eleao_request_access_pow(request_name text,request_email text,issued_at bigint,nonce text) returns void language plpgsql security definer set search_path='' as $$
declare n text:=trim(request_name); e text:=lower(trim(request_email)); data text; h text;
begin
 if issued_at is null or issued_at < extract(epoch from now())::bigint-300 or issued_at > extract(epoch from now())::bigint+300 or nonce is null or nonce !~ '^[0-9a-f]{16}$' or n is null or e is null or n ~ '[[:cntrl:]]' or e ~ '[[:cntrl:]]' or length(n)>80 or length(e)>254 then raise exception 'Solicitação inválida ou expirada'; end if;
 data:=n||chr(10)||e||chr(10)||issued_at::text||chr(10)||nonce;
 h:=encode(extensions.digest(convert_to(data,'UTF8'),'sha256'),'hex');
 if left(h,4)<>'0000' then raise exception 'Verificação de segurança inválida'; end if;
 -- A unique constraint serializes concurrent replays. Cleanup uses server time,
 -- not the untrusted client timestamp, and retains entries for the full window.
 delete from public.eleao_request_proofs where consumed_at < now()-interval '15 minutes';
 insert into public.eleao_request_proofs(digest) values(h) on conflict do nothing;
 if not found then raise exception 'Verificação já utilizada'; end if;
 perform public.eleao_request_access(n,e);
end;$$;
revoke all on function public.eleao_request_access_pow(text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.eleao_request_access_pow(text,text,bigint,text) to anon,authenticated;
revoke execute on function public.eleao_request_access(text,text) from public,anon,authenticated;
