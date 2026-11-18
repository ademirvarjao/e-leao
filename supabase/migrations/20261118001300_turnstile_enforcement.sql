-- Apply only after real Turnstile keys, edge deployment, site deploy and live verification.
-- Cached old clients cannot submit requests after this cutover and must reload.
revoke execute on function public.eleao_request_access_pow(text,text,bigint,text) from public,anon,authenticated;
