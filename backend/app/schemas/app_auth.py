from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


# Auth Settings schemas
class AuthSettingsOut(BaseModel):
    enable_email_password: bool
    enable_magic_link: bool
    enable_otp: bool
    enable_oauth_google: bool
    enable_oauth_github: bool
    access_ttl_minutes: int
    refresh_ttl_days: int
    session_mode: str
    allow_public_signup: bool
    require_email_verification: bool

    class Config:
        from_attributes = True


class AuthSettingsUpdate(BaseModel):
    enable_email_password: bool | None = None
    enable_magic_link: bool | None = None
    enable_otp: bool | None = None
    enable_oauth_google: bool | None = None
    enable_oauth_github: bool | None = None
    access_ttl_minutes: int | None = Field(None, ge=1, le=1440)
    refresh_ttl_days: int | None = Field(None, ge=1, le=365)
    session_mode: str | None = Field(None, pattern="^(header|cookie)$")
    allow_public_signup: bool | None = None
    require_email_verification: bool | None = None


# App User Auth schemas
class AppUserRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class AppUserLoginIn(BaseModel):
    email: EmailStr
    password: str


class AppUserRefreshIn(BaseModel):
    refresh_token: str


class AppUserTokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires


class AppUserOut(BaseModel):
    id: str
    email: str
    is_email_verified: bool
    is_disabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AppUserMeOut(BaseModel):
    id: str
    email: str
    is_email_verified: bool

    class Config:
        from_attributes = True


# Auth Providers discovery
class AuthProvidersOut(BaseModel):
    email_password: bool
    magic_link: bool
    otp: bool
    oauth_google: bool
    oauth_github: bool
    session_mode: str
    allow_public_signup: bool


# OTP / Magic Link schemas
class OtpSendIn(BaseModel):
    email: EmailStr
    purpose: str = Field(..., pattern="^(login|verify_email|reset_password)$")


class OtpVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


# Password reset schemas
class PasswordResetSendIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


# Email verification schemas
class EmailVerifySendIn(BaseModel):
    pass  # Uses current logged-in user's email


class EmailVerifyConfirmIn(BaseModel):
    token: str


# App User management (admin)
class AppUserListOut(BaseModel):
    id: str
    email: str
    is_email_verified: bool
    is_disabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AppUserCreateIn(BaseModel):
    email: EmailStr
    password: str | None = Field(None, min_length=8, max_length=128)
    is_email_verified: bool = False
    is_disabled: bool = False


class AppUserUpdateIn(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=8, max_length=128)
    is_disabled: bool | None = None
    is_email_verified: bool | None = None
