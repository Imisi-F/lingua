"""Thin, language-agnostic wrapper around the `fsrs` library.

Nothing here knows about Yoruba, Mandarin, vocab vs. sentences, or the
database. It only knows how to create a new FSRS card, score a review, and
convert a card to/from a plain dict for storage.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fsrs import Card, Rating, Scheduler

RATING_MAP = {
    "again": Rating.Again,
    "hard": Rating.Hard,
    "good": Rating.Good,
    "easy": Rating.Easy,
}

_scheduler = Scheduler()


def new_card() -> Card:
    return Card()


def review(card: Card, rating_name: str) -> Card:
    """Score a review and return the updated card. Does not persist anything."""
    rating = RATING_MAP[rating_name]
    updated_card, _log = _scheduler.review_card(card, rating)
    return updated_card


def card_to_state(card: Card) -> dict:
    return card.to_dict()


def card_from_state(state: dict) -> Card:
    return Card.from_dict(state)


def is_due(card: Card, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    return card.due <= now
