from fastapi import Request, Response

from app.logging import logger
from app.models.access import AddDocumentAccessRequest

DOCUMENT_ACCESS_TABLE = "DocumentAccess"

async def add_document_access(access: AddDocumentAccessRequest, request: Request):
    if not access.user_id and not access.group_id:
        return Response("Must provide either user_id or group_id", status_code=400)

    supabase_client = request.state.supabase
    try:
        supabase_client.table(DOCUMENT_ACCESS_TABLE).insert({
            "document_id": access.document_id,
            "user_id": access.user_id or None,
            "group_id": access.group_id or None
        }).execute()
        return Response("Document access added", status_code=200)
    except Exception as e:
        logger.e(f"Failed to add document access with exception: {e}")


