-- Optional focus/angle for AI quiz generation (how questions should be framed)
alter table public.quizzes
  add column if not exists focus text;

comment on column public.quizzes.focus is
  'Optional instructions for how AI should angle/focus the quiz questions';
