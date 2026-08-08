-- user_settings: OpenRouter + SiliconFlow keys/toggles (match client UserSettingsRow)

alter table public.user_settings
  add column if not exists openrouter_api_key text,
  add column if not exists siliconflow_api_key text,
  add column if not exists enable_openrouter boolean not null default true,
  add column if not exists enable_siliconflow boolean not null default true;

-- Keep default priority in sync with app AI_PRIORITY_DEFAULT (new rows only via column default)
alter table public.user_settings
  alter column ai_priority set default '["kilo","openrouter","siliconflow","groq","gemini","local"]'::jsonb;
