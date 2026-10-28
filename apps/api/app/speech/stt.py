"""Speech-to-text: faster-whisper, self-hosted, same model class for both
langpacks. Accuracy on Yoruba is a known weak point (see langpacks/yoruba's
config.yaml comment) - this wires the pipeline, it doesn't fix that.
"""
import functools
import tempfile

from faster_whisper import WhisperModel

from ..langpacks import get_langpack


@functools.lru_cache
def _load_model(model_size_or_path: str) -> WhisperModel:
    # int8 on CPU: good enough accuracy, much lower memory than float32 -
    # matters on a small Fly VM.
    return WhisperModel(model_size_or_path, device="cpu", compute_type="int8")


def transcribe(langpack: str, audio_bytes: bytes) -> str:
    lp = get_langpack(langpack)
    model = _load_model(lp.stt_model)

    # Written to a real temp file rather than passed in-memory: faster-whisper
    # decodes via PyAV/ffmpeg, which needs to seek the input, and this way it
    # auto-detects the container format (webm/opus, ogg/opus, wav, ...)
    # instead of us having to guess it from the browser's MediaRecorder output.
    with tempfile.NamedTemporaryFile(suffix=".audio") as f:
        f.write(audio_bytes)
        f.flush()
        segments, _info = model.transcribe(f.name, language=lp.whisper_language or None)
        return "".join(segment.text for segment in segments).strip()
