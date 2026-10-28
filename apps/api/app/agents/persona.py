"""The conversation/persona agent (section 6, agent #1 in CONTEXT.md).

Phase 1 scope: build the message list for a single-persona chat turn. The
error-tracking and lesson-planner agents (#2 and #3) are Phase 4.
"""
from ..langpacks import get_langpack


def build_messages(langpack: str, history: list[dict], user_text: str) -> list[dict]:
    lp = get_langpack(langpack)
    system_prompt = lp.persona_prompt("persona")

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_text})
    return messages
