insert into llm_providers (key, name, enabled)
values ('deepseek', 'DeepSeek', true)
on conflict (key) do update
set name = excluded.name,
    enabled = excluded.enabled;
