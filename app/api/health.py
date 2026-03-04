from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def read_root():
    return {"message": "Welcome to app"}


@router.get("/health")
def health():
    return {"message": "Server is healthy"}
