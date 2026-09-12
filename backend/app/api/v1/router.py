from fastapi import APIRouter
from app.api.v1.products import router as products_router
from app.api.v1.basket import router as basket_router
from app.api.v1.receipts import router as receipts_router
from app.api.v1.flyers import router as flyers_router
from app.api.v1.stores import router as stores_router
from app.api.v1.categories import router as categories_router
from app.api.v1.users import router as users_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.ledger import router as ledger_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter()

api_router.include_router(products_router)
api_router.include_router(recommendations_router)
api_router.include_router(basket_router)
api_router.include_router(receipts_router)
api_router.include_router(flyers_router)
api_router.include_router(stores_router)
api_router.include_router(categories_router)
api_router.include_router(users_router)
api_router.include_router(ledger_router)
api_router.include_router(analytics_router)


