from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    email: EmailStr

    model_config = {"from_attributes": True}
