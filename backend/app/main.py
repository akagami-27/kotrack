from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.balance import router as balance_router
from app.api.payments import router as payments_router
from app.api.sessions import router as sessions_router
from app.api.users import router as users_router
from app.api.session_requests import router as session_requests_router


app = FastAPI(
    title="Drink Tracker (KoTrack) API",
    description="Backend API for tracking shared drink costs and payments.",
    version="0.1.0",
)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(balance_router)
app.include_router(sessions_router)
app.include_router(payments_router)
app.include_router(session_requests_router)
app.include_router(admin_router)

# Admin-only analytics and administration endpoints
app.include_router(admin_router)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {"status": "ok"}