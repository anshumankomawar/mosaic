from fastapi import Request, Response

from app.common.text import chunk_text
from app.models.document import CreateDocumentRequest, DeleteDocumentRequest, UpdateDocumentRequest
from app.logging import logger

CHUNKS_TABLE = "Chunks"
DOCUMENTS_TABLE = "Documents"


async def create_document(document: CreateDocumentRequest, request: Request):
    supabase_client = request.state.supabase
    try:
        response = supabase_client.table(DOCUMENTS_TABLE).insert({
            "user_id": request.state.user_id,
            "name": document.name,
            "file_type": document.file_type,  
        }).execute()
    except Exception as e:
        logger.e(f"Failed to save chunk with exception: {e}") 
        return {
                "message": f"Failed to save chunk with exception: {e}"
        }
          
    # If the document is empty, don't bother encoding saving content
    if document.file_content.strip() == "":
        return {
            "document_id": response.data[0]["id"],
            "total_chunks": 0,
            "chunks": []
        }

    document_id = response.data[0]["id"]
    chunks = chunk_text(request.state.openai, document.file_content)
    saved_chunks = []

    for idx, chunk in enumerate(chunks):
        chunk_data = {
            "document_id": document_id,
            "chunk_index": idx,
            "content": chunk["content"],
            "embedding":chunk["embedding"], 
        }

        try:
            response = supabase_client.table(CHUNKS_TABLE).insert(chunk_data).execute()
            if response.data:
                saved_chunks.append(response.data[0])
        except Exception as e:
            logger.e(f"Failed to save chunk with exception: {e}") 
            return {
                    "message": f"Failed to save chunk with exception: {e}"
            }
          
    return {
        "document_id": document_id,
        "total_chunks": len(saved_chunks),
        "chunks": saved_chunks
    }


async def delete_document(delete: DeleteDocumentRequest, request: Request):
    document_id = delete.document_id
    supabase_client = request.state.supabase
    try:
        supabase_client.table(DOCUMENTS_TABLE).delete().eq("id", document_id).execute()
        supabase_client.table(CHUNKS_TABLE).delete().eq("document_id", document_id).execute()
        return Response("Document deleted successfully", status_code=200)
    except Exception as e:
        logger.e(f"Failed to delete document with exception: {e}")


async def update_document(update: UpdateDocumentRequest, request: Request):
    if update.file_content.strip() == "":
        return Response("Received empty file content, skipping chunk deletion", status_code=200)
    
    document_id = update.document_id
    supabase_client = request.state.supabase
    
    # Update file_type if provided
    if update.file_type:
        try:
            supabase_client.table(DOCUMENTS_TABLE).update(
                {"file_type": update.file_type}
            ).eq("id", document_id).execute()
        except Exception as e:
            logger.e(f"Failed to update file type with exception: {e}")
            return Response(f"Failed to update file type: {e}", status_code=500)
    
    # Process chunks as before
    chunks = chunk_text(request.state.openai, update.file_content)
    
    # First, delete existing chunks for the document
    try:
        supabase_client.table(CHUNKS_TABLE).delete().eq("document_id", document_id).execute()
    except Exception as e:
        logger.e(f"Failed to delete existing chunks with exception: {e}")
        return Response(f"Failed to delete existing chunks with exception: {e}", status_code=500)
    for idx, chunk in enumerate(chunks):
        
        # Then, insert new chunks
        chunk_data = {
            "document_id": document_id,
            "chunk_index": idx,
            "content": chunk["content"],
            "embedding": chunk["embedding"],
        }

        try:
            _ = supabase_client.table(CHUNKS_TABLE).insert(chunk_data).execute()
        except Exception as e:
            logger.e(f"Failed to save chunk with exception: {e}") 
            return Response(f"Failed to save chunk with exception: {e}", status_code=500)
          
    return Response("Document updated successfully", status_code=200)

async def get_documents(request: Request):
    supabase_client = request.state.supabase
    user_id = request.state.user_id
    
    try:
        # Fetch all documents for the current user
        response = supabase_client.table(DOCUMENTS_TABLE) \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()
        
        documents = response.data
        return {
            "documents": documents,
            "count": len(documents)
        }
    except Exception as e:
        logger.e(f"Failed to fetch documents with exception: {e}")
        return {
            "message": f"Failed to fetch documents with exception: {e}"
        }
