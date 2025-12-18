from fastapi import APIRouter, Depends

from app.api import deps
from app.schemas import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def read_me(current_user=Depends(deps.get_current_user)):
    return current_user
