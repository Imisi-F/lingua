"""Text-to-speech for Mandarin via Piper (CPU, no torch needed).

Voice files (.onnx + .onnx.json) aren't committed to the repo - they're
baked into the Docker image at build time (see apps/api/Dockerfile) from
rhasspy/piper-voices. For local dev without Docker, download them yourself
into PIPER_VOICES_DIR (default: <repo root>/voices/piper/) if you want to
test this locally rather than only after `fly deploy`:

    mkdir -p voices/piper && cd voices/piper
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json
"""
import functools
import io
import os
import pathlib
import wave

from piper import PiperVoice


def _default_voices_dir() -> pathlib.Path:
    repo_root = pathlib.Path(__file__).resolve().parents[4]
    return repo_root / "voices" / "piper"


VOICES_DIR = pathlib.Path(os.environ.get("PIPER_VOICES_DIR", str(_default_voices_dir())))


@functools.lru_cache
def _load_voice(voice_name: str) -> PiperVoice:
    model_path = VOICES_DIR / f"{voice_name}.onnx"
    return PiperVoice.load(model_path)


def synthesize(voice_name: str, text: str) -> bytes:
    voice = _load_voice(voice_name)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    return buffer.getvalue()
