from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas import LoginIn, RefreshIn, RegisterIn, TokenPair
from app.services.auth import login_user, logout_refresh_token, refresh_tokens, register_user

router = APIRouter()


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(deps.get_db)):
    _, access_token, refresh_token = register_user(db, email=payload.email, password=payload.password)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginIn, db: Session = Depends(deps.get_db)):
    _, access_token, refresh_token = login_user(db, email=payload.email, password=payload.password)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db: Session = Depends(deps.get_db)):
    _, access_token, refresh_token = refresh_tokens(db, refresh_token=payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshIn, db: Session = Depends(deps.get_db)):
    logout_refresh_token(db, refresh_token=payload.refresh_token)
    return None
