# Built by Fly.io's remote builder (fly deploy run from the repo root) --
# no local Docker install is required on the dev machine.
FROM python:3.12-slim

WORKDIR /app

COPY packages/srs ./packages/srs
COPY packages/core ./packages/core
COPY apps/api/requirements.txt ./apps/api/requirements.txt

RUN pip install --no-cache-dir -r apps/api/requirements.txt \
    && pip install --no-cache-dir ./packages/srs ./packages/core

COPY apps/api/app ./apps/api/app
COPY langpacks ./langpacks

ENV LANGPACKS_ROOT=/app/langpacks
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
