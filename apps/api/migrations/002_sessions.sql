-- Adds the units/path feature's session tracking. Run this once in the
-- Supabase SQL Editor, after 001_init.sql. Safe to re-run.

create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    langpack text not null,
    unit_id text not null,
    activity text not null, -- 'chat' | 'review'
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    score double precision,
    feedback text
);
create index if not exists idx_sessions_langpack on sessions (langpack);
create index if not exists idx_sessions_started_at on sessions (started_at);

-- One row per FSRS rating event, whether it came from an explicit review
-- answer or from the chat vocab-detection heuristic. This is what lets the
-- Summary/History screens show "words touched this session" without
-- re-deriving it from conversation text every time.
create table if not exists review_events (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sessions(id),
    item_id text not null,
    rating text not null, -- 'again' | 'hard' | 'good' | 'easy'
    source text not null, -- 'review' | 'chat'
    created_at timestamptz not null default now()
);
create index if not exists idx_review_events_session on review_events (session_id);
