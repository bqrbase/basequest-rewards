-- Task2Earn Phase 3: additive target payload on existing t2e_tasks.
-- Does not create new tables. Does not modify public.users.
--
-- Shape (jsonb):
--   { "kind": "cast", "url": "...", "castHash": "..."|null, "channelId": "..."|null }
--   { "kind": "follow", "username": "...", "fid": number|null, "displayName": "..."|null }
--   { "kind": "mini_app", "name": "..."|null, "url": "...", "appId": "..."|null, "metadata": {} }
-- FID is stored only when the server resolved it. Client FID is never proof.

alter table public.t2e_tasks
  add column if not exists task_target jsonb not null default '{}'::jsonb;

comment on column public.t2e_tasks.task_target is
  'Off-chain cast/follow/mini-app target. Server-validated. Not proof of completion.';
