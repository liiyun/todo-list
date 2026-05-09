alter table todos
  add column priority text not null default 'medium';

alter table todos
  add constraint todos_priority_check
  check (priority in ('high', 'medium', 'low'));
