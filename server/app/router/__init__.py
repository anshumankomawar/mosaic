from fastapi import Depends, FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

from app.router.dependencies import get_router_deps
from app.router.endpoints.document import create_document, delete_document, update_document, get_documents
from app.router.endpoints.friend import add_friend
from app.router.endpoints.login import login
from app.router.endpoints.register import register
from app.router.endpoints.search import search_chunks, search_friends
from app.router.endpoints.summarize import summarize
from app.router.endpoints.file_search import file_search
from app.router.middleware.http import AuthMiddleware


# Main entrypoint for scratchpad backend. Defines secure and public routes. Add new
# endpoints via the `app.router.endpoints` subpackage
def init_router():
    secure_app = FastAPI(dependencies=[Depends(get_router_deps)],
                         root_path="/secure")
    
    auth_middleware = AuthMiddleware()
    secure_app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)
    
    secure_app.add_api_route("/document", create_document, methods=["POST"])
    secure_app.add_api_route("/document", delete_document, methods=["DELETE"])
    secure_app.add_api_route("/document", update_document, methods=["PATCH"])
    secure_app.add_api_route("/document", get_documents, methods=["GET"])
    secure_app.add_api_route("/friend", add_friend, methods=["POST"])
    secure_app.add_api_route("/search_chunks", search_chunks, methods=["POST"])
    secure_app.add_api_route("/search_friends", search_friends, methods=["POST"])
    secure_app.add_api_route("/summarize", summarize, methods=["POST"])
    secure_app.add_api_route("/file_search", file_search, methods=["POST"])

    public_app = FastAPI(dependencies=[Depends(get_router_deps)], root_path="/public")
    public_app.add_api_route("/login", login, methods=["POST"])
    public_app.add_api_route("/register", register, methods=["POST"])

    router = FastAPI(dependencies=[Depends(get_router_deps)])
    
    # Add CORS to main router 
    router.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    router.mount("/secure", secure_app)
    router.mount("/public", public_app)

    return router
