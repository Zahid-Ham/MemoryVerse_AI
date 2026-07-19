import os
import json
import time
from typing import Dict, Any, List, Generator
from app.services.embedding import EmbeddingService
from app.services.vectorstore import VectorStoreService
from app.utils.key_manager import GroqKeyManager

class RAGEngine:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStoreService()
        self.key_manager = GroqKeyManager()

    def query(self, question: str, limit: int = 3, user_id: str = None) -> Dict[str, Any]:
        """
        Coordinates the entire RAG flow:
        User Question -> Embedding -> Similarity Search -> Top 3 Chunks -> Context Builder -> Groq Response
        """
        from app.database.connection import SessionLocal
        db = SessionLocal()
        try:
            from app.services.rag_service import RAGService
            res = RAGService.answer_question(db, question, user_id=user_id)
            
            citations = []
            for src in res.get("sources", []):
                citations.append({
                    "id": f"{src.get('document_id')}_chunk_{src.get('chunk_index')}",
                    "document_id": src.get("document_id"),
                    "title": src.get("filename"),
                    "score": src.get("score") or 0.85,
                    "text": src.get("text")
                })

            return {
                "answer": res.get("answer"),
                "citations": citations,
                "confidence_score": res.get("confidence_score"),
                "suggested_follow_ups": res.get("follow_up_questions")
            }
        finally:
            db.close()

    def query_stream(self, question: str, limit: int = 3, user_id: str = None) -> Generator[str, None, None]:
        """
        Streams RAG responses using Server-Sent Events (SSE).
        Yields JSON packets representing metadata, token streams, and suggested follow-ups.
        Supports key rotation through the fallback key pool.
        """
        from app.services.retriever_service import RetrieverService
        retrieval = RetrieverService.retrieve_context(question, user_id=user_id)
        context_text = retrieval.get("context", "")
        sources = retrieval.get("sources", [])
        scores = retrieval.get("similarity_scores", [])

        citations = []
        for i, src in enumerate(sources):
            score = scores[i] if i < len(scores) else 0.8
            citations.append({
                "id": f"{src.get('document_id')}_chunk_{src.get('chunk_index')}",
                "document_id": src.get("document_id"),
                "title": src.get("filename"),
                "score": score,
                "text": src.get("text")
            })

        confidence_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        # 1. Send metadata block first
        yield "data: " + json.dumps({'event': 'metadata', 'citations': citations, 'confidence_score': confidence_score}) + "\n\n"

        if not context_text.strip():
            yield "data: " + json.dumps({'event': 'token', 'token': "Information was not found in the uploaded documents."}) + "\n\n"
            yield "data: " + json.dumps({'event': 'suggested_follow_ups', 'follow_ups': []}) + "\n\n"
            return

        # 2. Stream tokens from Groq
        prompt = (
            "You are a helpful assistant answering questions based on the provided document context from the user's second brain.\n"
            "Instructions:\n"
            "- Answer the question using the provided context. If the query asks to show, summarize, or describe documents, summarize the matching document details found in the context.\n"
            "- Format your response content clearly using Markdown (bold headers and uniform bulleted lists) so it is easy to read. Prefer bullet points and short sentences over large text paragraphs.\n"
            "- IMPORTANT: Keep your list styling uniform. Do not mix bullet points with numbered lists. If listing details, use a single consistent bulleted list (using '- '). Do not carry over original section or clause numbers (e.g. '1.', '4.', '5.') from the document text into your bullets.\n"
            "- If the context does not contain any relevant information to answer the question, respond with: 'Information was not found.'\n\n"
            f"Context:\n{context_text}\n\nQuestion:\n{question}\n\nAnswer:"
        )

        total_keys = len(self.key_manager.KEYS)
        stream = None
        
        # Try finding a working key to start the stream
        for attempt in range(total_keys):
            client = self.key_manager.get_client()
            try:
                stream = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": "You are a helpful, secure personal memory assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=600,
                    stream=True
                )
                break
            except Exception as e:
                # Rotate key and try again
                self.key_manager.rotate_key()
                if attempt == total_keys - 1:
                    yield "data: " + json.dumps({'event': 'token', 'token': f'Error streaming answer: {str(e)}'}) + "\n\n"
                    yield "data: " + json.dumps({'event': 'suggested_follow_ups', 'follow_ups': []}) + "\n\n"
                    return
                time.sleep(0.5)

        if stream:
            try:
                for chunk in stream:
                    token = chunk.choices[0].delta.content
                    if token:
                        yield "data: " + json.dumps({'event': 'token', 'token': token}) + "\n\n"
            except Exception as e:
                yield "data: " + json.dumps({'event': 'token', 'token': f'\n[Stream interrupted: {str(e)}]'}) + "\n\n"

        # 3. Send suggested follow-ups
        follow_ups = []
        for src in sources:
            filename = src.get("filename", "")
            if filename and f"Tell me more about {filename}" not in follow_ups:
                follow_ups.append(f"Tell me more about {filename}")
        if not follow_ups:
            follow_ups = ["Show me my recent upload memories.", "What tags are available?"]

        yield "data: " + json.dumps({'event': 'suggested_follow_ups', 'follow_ups': follow_ups[:3]}) + "\n\n"
