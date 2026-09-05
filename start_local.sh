#!/usr/bin/env bash
set -e

echo "🚀 Starting SebEt MVP Local Environment..."

# 1. Seed database if needed
echo "🌱 Ensuring local database is seeded..."
DATABASE_URL="sqlite+aiosqlite:///./sebet.db" .venv/bin/python backend/scripts/seed_baku_data.py

# 2. Start backend in background
echo "⚡ Starting FastAPI Backend on http://localhost:8000..."
DATABASE_URL="sqlite+aiosqlite:///./sebet.db" .venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 3. Start frontend in background
echo "✨ Starting Next.js 15 Frontend on http://localhost:3000..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo "✅ SebEt MVP is running live!"
echo "🌐 Frontend App:    http://localhost:3000"
echo "📚 Backend Swagger: http://localhost:8000/docs"
echo "=========================================================="
echo ""

# Handle graceful shutdown
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT INT TERM
wait
