from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database.connection import get_db
from app.rag.rag_engine import RAGEngine
from app.api.auth import get_current_user
from app.models.user import UserModel

router = APIRouter(prefix="/api/chat", tags=["chat"])
rag_engine = RAGEngine()

class QueryRequest(BaseModel):
    question: str

@router.post("/query")
def query_second_brain(request: QueryRequest, current_user: UserModel = Depends(get_current_user)):
    """
    POST route allowing users to ask questions, returning similarity matching,
    summarizations, citations, and confidence metrics.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
        
    try:
        response = rag_engine.query(request.question, user_id=current_user.id)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
def query_second_brain_stream(request: QueryRequest, current_user: UserModel = Depends(get_current_user)):
    """
    POST route to stream RAG response from Groq using Server-Sent Events (SSE).
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
        
    try:
        return StreamingResponse(
            rag_engine.query_stream(request.question, user_id=current_user.id),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
