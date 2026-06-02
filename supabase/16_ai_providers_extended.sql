-- =============================================================
-- 16_ai_providers_extended.sql
-- Extend ai_settings provider CHECK constraint to include
-- groq and anthropic alongside the original providers.
-- Run after 11_ai_settings.sql
-- =============================================================

ALTER TABLE public.ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_provider_check;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_provider_check
  CHECK (provider IN ('gemini', 'groq', 'anthropic', 'openai', 'ollama'));
