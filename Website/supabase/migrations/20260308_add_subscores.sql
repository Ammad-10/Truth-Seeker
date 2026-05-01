-- Migration: Add topic + sub-score columns to verifications table
-- Run this in Supabase SQL Editor first.

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS topic TEXT;

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS model_score INTEGER;

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS news_api_score INTEGER;

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS google_fc_score INTEGER;

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS groq_score INTEGER;

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS groq_reasoning TEXT;
