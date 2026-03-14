"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from energy_management.api.routes import router
from energy_management.config import settings
from energy_management.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
