from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from ..config import settings
from ..langpacks import get_langpack
from ..speech import stt, tts_mms, tts_piper

router = APIRouter(prefix="/speech")


class SynthesizeRequest(BaseModel):
    langpack: str | None = None
    text: str


@router.post("/transcribe")
async def transcribe(langpack: str = Form(...), audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    text = stt.transcribe(langpack, audio_bytes)
    return {"text": text}


@router.post("/synthesize")
def synthesize(req: SynthesizeRequest):
    langpack = req.langpack or settings.active_langpack
    lp = get_langpack(langpack)

    if lp.tts_engine == "piper":
        audio_bytes = tts_piper.synthesize(lp.tts_voice, req.text)
    elif lp.tts_engine == "mms":
        audio_bytes = tts_mms.synthesize(lp.tts_voice, req.text)
    else:
        raise HTTPException(status_code=400, detail=f"unknown tts_engine: {lp.tts_engine!r}")

    return Response(content=audio_bytes, media_type="audio/wav")
