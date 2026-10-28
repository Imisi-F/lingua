from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import chat, health, langpacks, review

app = FastAPI(title="Lingua API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # single-user personal app; tighten if ever made public
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(langpacks.router)
app.include_router(review.router)
