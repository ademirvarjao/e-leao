-- Research is an internal assistant tool for approved, active accounts. Check
-- both flags in the charged RPC, not just in the browser. Preserve counters,
-- table policies and the authenticated-only EXECUTE grant from 01500.
create or replace function public.eleao_take_research_quota() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.eleao_profiles
                 where id=auth.uid() and active and approval_status='approved') then
    return false;
  end if;
  insert into public.eleao_research_usage(owner_id,uses) values(auth.uid(),1)
  on conflict(owner_id,day) do update set uses=eleao_research_usage.uses+1 where eleao_research_usage.uses<40;
  return found;
end;
$$;
