from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("sebet")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting Sebet Backend API...")
    try:
        await init_db()
        logger.info("✅ Database tables ensured.")
    except Exception as e:
        logger.error(f"⚠️ Database initialization error (will retry on request): {e}")
    yield
    logger.info("🛑 Shutting down Sebet Backend API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Consumer Grocery Price Intelligence & Local Shelf-Stock Tracker for Baku, Azerbaijan",
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS configuration
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "city": "Baku, Azerbaijan",
    }


@app.get("/", tags=["root"])
async def root():
    return {
        "message": "Welcome to Sebet API — Baku Grocery Price Intelligence",
        "docs_url": "/docs",
        "version": settings.VERSION,
    }

