-- Persist verified X follow for the Follow X community quest.
alter table users add column if not exists twitter_user_id text;
alter table users add column if not exists x_follow_verified_at timestamptz;

-- Keep legacy x_user_id in sync when present.
alter table users add column if not exists x_user_id text;
alter table users add column if not exists x_username text;

create index if not exists users_twitter_user_id_idx
  on users (twitter_user_id);
