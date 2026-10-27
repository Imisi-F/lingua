import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents.deepseek_client import chat_completion
from ..agents.persona import build_messages
from ..config import settings
from ..db import get_db
from ..models import ConversationLog

router = APIRouter(prefix="/chat")


class ChatRequest(BaseModel):
    session_id: uuid.UUID | None = None
    text: str


class ChatResponse(BaseModel):
    session_id: uuid.UUID
    reply: str


@router.post("/message")
def send_message(req: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    session_id = req.session_id or uuid.uuid4()
    langpack = settings.active_langpack

    history_rows = (
        db.execute(
            select(ConversationLog)
            .where(ConversationLog.session_id == session_id)
            .order_by(ConversationLog.created_at)
        )
        .scalars()
        .all()
    )
    history = [{"role": row.role, "content": row.content} for row in history_rows]

    messages = build_messages(history, req.text)
    reply = chat_completion(messages)

    db.add(ConversationLog(session_id=session_id, langpack=langpack, role="user", content=req.text))
    db.add(ConversationLog(session_id=session_id, langpack=langpack, role="assistant", content=reply))
    db.commit()

    return ChatResponse(session_id=session_id, reply=reply)
