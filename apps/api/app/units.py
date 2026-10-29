"""Per-unit confidence scoring - pure math over FSRS state, no LLM calls.

A unit's score is built from FSRS `stability` (in days), not point-in-time
`retrievability`. Retrievability is "how likely to recall RIGHT NOW given
elapsed time" - immediately after any review, good or bad, elapsed time is
~0 and retrievability is ~1 either way (confirmed empirically before
settling on this), so it can't tell a correct answer from a wrong one at
the moment that matters most: right when a session ends. Stability doesn't
have that problem - a card rated "Again" ends up with low stability, one
rated "Good"/"Easy" repeatedly builds high stability, regardless of when
you check it.

The next unit unlocks once the one before it crosses UNLOCK_THRESHOLD.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession
from srs import card_from_state

from .langpacks import get_langpack
from .models import Card as CardRow

UNLOCK_THRESHOLD = 0.7
# Stability (days) at which a word counts as "confidently learned". FSRS
# stability after a single "Good" review is typically ~2-3 days - this
# target assumes several successful spaced reviews, not just one.
TARGET_STABILITY_DAYS = 21.0


def cards_by_item_id(db: DbSession, langpack_code: str) -> dict[str, CardRow]:
    rows = db.execute(select(CardRow).where(CardRow.langpack == langpack_code)).scalars().all()
    return {row.item_id: row for row in rows}


def word_confidence(row: CardRow | None) -> float:
    if row is None:
        return 0.0
    card = card_from_state(row.fsrs_state)
    stability = card.stability or 0.0
    return min(stability / TARGET_STABILITY_DAYS, 1.0)


def unit_score(unit, langpack_code: str, cards_by_item: dict[str, CardRow]) -> float:
    if not unit.vocab_ids:
        return 0.0
    total = sum(
        word_confidence(cards_by_item.get(f"{langpack_code}:vocab:{vocab_id}"))
        for vocab_id in unit.vocab_ids
    )
    return total / len(unit.vocab_ids)


def units_with_progress(db: DbSession, langpack_code: str) -> list[dict]:
    """Every unit for this langpack, in order, with score + unlocked state.

    One query for all of this langpack's cards, then pure Python - avoids a
    per-unit round trip even for Mandarin's ~392 units.
    """
    lp = get_langpack(langpack_code)
    cards_by_item = cards_by_item_id(db, langpack_code)

    results = []
    unlocked_so_far = True  # the first unit is always open
    for unit in lp.units:
        score = unit_score(unit, langpack_code, cards_by_item)
        results.append(
            {
                "id": unit.id,
                "name": unit.name,
                "level": unit.level,
                "word_count": len(unit.vocab_ids),
                "score": round(score, 4),
                "unlocked": unlocked_so_far,
            }
        )
        unlocked_so_far = unlocked_so_far and score >= UNLOCK_THRESHOLD
    return results
