update todos
set category = 'work'
where category = 'general';

alter table todos
  alter column category set default 'work';
