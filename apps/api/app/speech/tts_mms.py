"""Text-to-speech for Yoruba via Meta MMS (transformers VITS model).

Needs torch - this is the heavy dependency that was the whole reason we
deployed the backend to Fly instead of running everything on a disk-limited
laptop. The model itself (facebook/mms-tts-yor, CC-BY-NC-4.0, non-commercial
only) is not baked into the Docker image - transformers downloads and caches
it under ~/.cache/huggingface on first use, which means the first Yoruba TTS
call after a fresh deploy will be slower than later ones.
"""
import functools
import io
import wave

import numpy as np
import torch
from transformers import AutoTokenizer, VitsModel


@functools.lru_cache
def _load(model_id: str):
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = VitsModel.from_pretrained(model_id)
    model.eval()
    return tokenizer, model


def synthesize(model_id: str, text: str) -> bytes:
    tokenizer, model = _load(model_id)
    inputs = tokenizer(text, return_tensors="pt")

    with torch.no_grad():
        waveform = model(**inputs).waveform

    samples = waveform.squeeze().cpu().numpy()
    sample_rate = model.config.sampling_rate

    pcm = np.clip(samples, -1.0, 1.0)
    pcm_int16 = (pcm * 32767).astype(np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_int16.tobytes())
    return buffer.getvalue()
