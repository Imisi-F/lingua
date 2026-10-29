"""The conversation/persona agent (section 6, agent #1 in CONTEXT.md).

Phase 1 scope: build the message list for a single-persona chat turn. The
error-tracking and lesson-planner agents (#2 and #3) are Phase 4.
"""
from ..langpacks import get_langpack


def build_messages(langpack: str, unit, history: list[dict], user_text: str) -> list[dict]:
    lp = get_langpack(langpack)
    system_prompt = lp.persona_prompt("persona")

    if unit is not None and unit.vocab_ids:
        words = [lp.get_item(f"{lp.code}:vocab:{vid}").word for vid in unit.vocab_ids]
        system_prompt += (
            f"\n\nThis conversation is focused on the topic '{unit.name}'. Work ONE OR TWO of "
            "these words into each reply where they fit naturally, rather than drifting to "
            "unrelated vocabulary - do not try to cram many of them into a single message, that "
            f"reads like a vocabulary demo, not a conversation: {', '.join(words)}"
        )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_text})
    return messages
