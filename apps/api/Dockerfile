# Built by Fly.io's remote builder (fly deploy run from the repo root) --
# no local Docker install is required on the dev machine.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY packages/srs ./packages/srs
COPY packages/core ./packages/core
COPY apps/api/requirements.txt ./apps/api/requirements.txt

# CPU-only torch wheel: the default PyPI linux wheel bundles CUDA and is
# much larger (~1-2GB extra) - MMS (Yoruba TTS) only ever runs on CPU here.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r apps/api/requirements.txt \
    && pip install --no-cache-dir ./packages/srs ./packages/core

COPY apps/api/app ./apps/api/app
COPY langpacks ./langpacks

# Mandarin Piper voice is baked into the image so first request isn't slow.
# Yoruba's MMS weights are left to lazy-download+cache at first use instead
# (handled by transformers itself) - smaller, and not worth the build-time
# cost for a model that already downloads reasonably fast.
RUN mkdir -p /app/voices/piper \
    && curl -fL -o /app/voices/piper/zh_CN-huayan-medium.onnx \
         https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx \
    && curl -fL -o /app/voices/piper/zh_CN-huayan-medium.onnx.json \
         https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json

ENV LANGPACKS_ROOT=/app/langpacks
ENV PIPER_VOICES_DIR=/app/voices/piper
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
