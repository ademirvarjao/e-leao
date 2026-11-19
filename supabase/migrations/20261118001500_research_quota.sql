-- Separate from the RTC allowance. No prompts, search terms or results are stored.
create table public.eleao_research_usage (
  owner_id uuid not null references public.eleao_profiles(id) on delete cascade,
  day date not null default current_date,
  uses integer not null check (uses between 1 and 40),
  primary key(owner_id, day)
);
alter table public.eleao_research_usage enable row level security;
revoke all on public.eleao_research_usage from public, anon, authenticated;

create function public.eleao_take_research_quota() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.eleao_is_active() then return false; end if;
  insert into public.eleao_research_usage(owner_id,uses) values(auth.uid(),1)
  on conflict(owner_id,day) do update set uses=eleao_research_usage.uses+1 where eleao_research_usage.uses<40;
  return found;
end;
$$;
revoke all on function public.eleao_take_research_quota() from public, anon, authenticated;
grant execute on function public.eleao_take_research_quota() to authenticated;
