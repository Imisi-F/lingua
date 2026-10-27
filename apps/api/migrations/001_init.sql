-- Run this once in the Supabase SQL Editor (or via psql) before starting the
-- backend. Safe to re-run (uses IF NOT EXISTS throughout).

create extension if not exists pgcrypto;

create table if not exists cards (
    id uuid primary key default gen_random_uuid(),
    item_id text not null unique,
    langpack text not null,
    item_type text not null, -- 'vocab' | 'sentence'
    fsrs_state jsonb not null,
    due_at timestamptz not null,
    reps integer not null default 0,
    lapses integer not null default 0,
    last_review_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_cards_due_at on cards (due_at);
create index if not exists idx_cards_langpack on cards (langpack);

create table if not exists conversation_log (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    langpack text not null,
    role text not null, -- 'user' | 'assistant' | 'system'
    content text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_conversation_log_session on conversation_log (session_id);

create table if not exists error_log (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null,
    langpack text not null,
    item_id text,
    category text not null, -- 'grammar' | 'vocab' | 'pronunciation'
    detail text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_error_log_session on error_log (session_id);
