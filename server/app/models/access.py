from typing import Optional
from pydantic import BaseModel


# Specify document_id and oneof user_id or group_id
class AddDocumentAccessRequest(BaseModel):
    document_id: str
    user_id: Optional[str] = None
    group_id: Optional[str] = None
