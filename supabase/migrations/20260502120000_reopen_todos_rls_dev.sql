-- Open RLS for local/demo so the browser client works with only the anon key
-- (no anonymous auth required). Replace with user-scoped policies before production.

drop policy if exists "Users can read own todos" on todos;
drop policy if exists "Users can create own todos" on todos;
drop policy if exists "Users can update own todos" on todos;
drop policy if exists "Users can delete own todos" on todos;
drop policy if exists "Allow all access for now" on todos;

create policy "Allow all access for now"
  on todos for all
  using (true)
  with check (true);
