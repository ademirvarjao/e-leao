-- Proof-of-work binds each request to its name, email, nonce and recent time.
-- The legacy RPC is left available until clients are upgraded; revoke it at cutover.
create function public.eleao_request_access_pow(request_name text,request_email text,issued_at bigint,nonce text) returns void language plpgsql security definer set search_path='' as $$
declare n text:=trim(request_name); e text:=lower(trim(request_email)); data text; h text;
begin
 if issued_at is null or abs(extract(epoch from now())::bigint-issued_at)>300 or nonce is null or nonce !~ '^[0-9a-f]{16}$' or n is null or e is null or n ~ '[[:cntrl:]]' or e ~ '[[:cntrl:]]' or length(n)>80 or length(e)>254 then raise exception 'Solicitação inválida ou expirada'; end if;
 data:=n||chr(10)||e||chr(10)||issued_at::text||chr(10)||nonce;
 h:=encode(extensions.digest(convert_to(data,'UTF8'),'sha256'),'hex');
 if left(h,4)<>'0000' then raise exception 'Verificação de segurança inválida'; end if;
 perform public.eleao_request_access(n,e);
end;$$;
revoke all on function public.eleao_request_access_pow(text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.eleao_request_access_pow(text,text,bigint,text) to anon,authenticated;
