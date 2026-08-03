-- Optional legacy column. Deploy Contract daily XP is tracked in
-- users.completed_quests via markers: "deploy-contract:YYYY-MM-DD".
-- This column is unused by the app but safe to keep if already applied.

alter table if exists users
  add column if not exists last_deploy_reward_date date;
