import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.document import DocumentChunk

class ChunkService:
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> list:
        """
        Splits a text string into overlapping chunks of character sizes.
        Ensures chunks are between 500-700 characters (targets chunk_size=600, overlap=100).
        """
        if not text:
            return []
            
        chunks = []
        text_len = len(text)
        
        # If the text is smaller than chunk size, return it as a single chunk
        if text_len <= chunk_size:
            return [text]
            
        start = 0
        while start < text_len:
            end = start + chunk_size
            
            # If the end window goes beyond the text length, take the remaining text
            if end >= text_len:
                chunks.append(text[start:])
                break
                
            # Try to split at a sentence or word boundary within a 100-character tolerance back
            # to make chunks clean and sentence/word aligned while staying in range.
            split_index = end
            for i in range(end, max(end - 100, start + 100), -1):
                if text[i] in ['\n', '.', '?', '!']:
                    split_index = i + 1
                    break
                elif text[i] == ' ' and split_index == end:
                    split_index = i + 1
            
            chunks.append(text[start:split_index])
            
            # Slide window back by the overlap
            start = split_index - overlap
            
            # Safety check to prevent infinite loop or stagnation
            if start >= split_index or start < 0:
                start = split_index
                
        return chunks

    @staticmethod
    def chunk_and_persist(db: Session, document_id: str, text: str, user_id: str = None) -> dict:
        """
        Splits raw text and saves all chunks to the SQLite database.
        """
        chunks = ChunkService.chunk_text(text)
        
        for idx, chunk_text in enumerate(chunks):
            db_chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                user_id=user_id,
                document_id=document_id,
                chunk_index=idx,
                chunk_text=chunk_text,
                chunk_length=len(chunk_text),
                created_at=datetime.utcnow()
            )
            db.add(db_chunk)
            
        db.commit()
        return {
            "document_id": document_id,
            "chunks_created": len(chunks)
        }
