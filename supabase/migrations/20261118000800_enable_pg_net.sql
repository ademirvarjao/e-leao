-- Used for controlled server-side connectivity checks; no automatic requests are scheduled.
create extension if not exists pg_net with schema extensions;
