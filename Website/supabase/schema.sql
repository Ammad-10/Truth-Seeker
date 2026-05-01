-- TruthSeeker Supabase Database Schema
-- Run this block in your Supabase SQL Editor

-- 1. Create the Users profile table (links to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: We do not need a password_hash column in Supabase because 
-- Supabase Auth handles all passwords and authentication natively!

-- 2. Create the Verifications history table
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    headline TEXT,
    article_text TEXT,
    credibility_score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    ai_confidence INTEGER NOT NULL,
    ai_reasoning TEXT,
    source_score INTEGER,
    source_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Set up Row Level Security (RLS) so users can only see their own history
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own verifications"
ON public.verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verifications"
ON public.verifications FOR SELECT
USING (auth.uid() = user_id);

-- Optional: If you want anyone (including the backend Edge Function) to insert without RLS blocking it
-- you can use the Service Role key, which bypasses RLS automatically.
