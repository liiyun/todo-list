-- Per-user todos: each anonymous auth user only sees rows where user_id = auth.uid().
-- Run after temporary "Allow all access" policies from dev.

drop policy if exists "Allow all access for now" on todos;

drop policy if exists "Users can read own todos" on todos;
drop policy if exists "Users can create own todos" on todos;
drop policy if exists "Users can update own todos" on todos;
drop policy if exists "Users can delete own todos" on todos;

create policy "Users can read own todos"
  on todos for select
  using (auth.uid() = user_id);

create policy "Users can create own todos"
  on todos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own todos"
  on todos for update
  using (auth.uid() = user_id);

create policy "Users can delete own todos"
  on todos for delete
  using (auth.uid() = user_id);
