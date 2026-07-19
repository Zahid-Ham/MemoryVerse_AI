import json
import uuid
import logging
from typing import Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.document import RAGCache
from app.services.retriever_service import RetrieverService
from app.utils.key_manager import GroqKeyManager

logger = logging.getLogger(__name__)

class RAGService:
    @staticmethod
    def answer_question(db: Session, question: str, user_id: str = None) -> Dict[str, Any]:
        """
        Flow:
        1. Check SQLite RAGCache for duplicate query.
        2. Call RetrieverService to extract Top 3 chunks.
        3. Compile context and query Groq LLM in JSON mode.
        4. Cache and return the structured RAG payload.
        """
        question_clean = question.strip()
        if not question_clean:
            return {
                "answer": "Please ask a valid question.",
                "sources": [],
                "confidence_score": 0.0,
                "follow_up_questions": []
            }

        # 1. Check persistent SQLite cache to prevent redundant API calls
        cached_res = db.query(RAGCache).filter(
            RAGCache.query == question_clean.lower(),
            RAGCache.user_id == user_id
        ).first()

        if cached_res:
            logger.info(f"RAG Cache Hit for query: '{question_clean}'")
            try:
                return {
                    "answer": cached_res.answer,
                    "sources": json.loads(cached_res.sources) if cached_res.sources else [],
                    "confidence_score": cached_res.confidence_score,
                    "follow_up_questions": json.loads(cached_res.follow_up_questions) if cached_res.follow_up_questions else []
                }
            except Exception as parse_cache_error:
                logger.error(f"Failed to parse cached RAG results: {str(parse_cache_error)}")

        # 2. Retrieve Top 3 context chunks via RetrieverService
        retrieval = RetrieverService.retrieve_context(question_clean, user_id=user_id)
        context = retrieval.get("context", "")
        sources = retrieval.get("sources", [])

        if not context.strip():
            # No context found in documents
            return {
                "answer": "Information was not found in the uploaded documents.",
                "sources": [],
                "confidence_score": 0.0,
                "follow_up_questions": []
            }

        # 3. Compile prompt constraints
        system_prompt = (
            "You are a helpful assistant answering questions based on the provided document context from the second brain.\n"
            "Instructions:\n"
            "- Answer the question using the provided context. If the query asks to show, summarize, or describe documents, summarize the matching document details found in the context.\n"
            "- Format your response content clearly using Markdown (bold headers and uniform bulleted lists) so it is easy to read. Prefer bullet points and short sentences over large text paragraphs.\n"
            "- IMPORTANT: Keep your list styling uniform. Do not mix bullet points with numbered lists. If listing details, use a single consistent bulleted list (using '- '). Do not carry over original section or clause numbers (e.g. '1.', '4.', '5.') from the document text into your bullets.\n"
            "- If the context does not contain any relevant information to answer the question, respond with: 'Information was not found.'\n"
            "- You must respond ONLY with a valid JSON object matching the schema below:\n"
            "{\n"
            "  \"answer\": \"your helpful response synthesized from the context\",\n"
            "  \"confidence_score\": 0.0 to 1.0 (float reflecting how well the context answered the question),\n"
            "  \"follow_up_questions\": [\"question 1\", \"question 2\"]\n"
            "}"
        )

        user_prompt = f"Context:\n{context}\n\nQuestion:\n{question_clean}"

        # 4. Invoke Groq with retry loop
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                client = GroqKeyManager.get_client()
                
                # Execute completion query using rotating key fallback
                completion = GroqKeyManager.execute_with_fallback(
                    client.chat.completions.create,
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=800
                )
                
                content = completion.choices[0].message.content
                parsed_json = json.loads(content)

                answer = parsed_json.get("answer", "Information was not found.")
                confidence = float(parsed_json.get("confidence_score", 0.0))
                follow_ups = parsed_json.get("follow_up_questions", [])

                # 5. Cache response in SQLite
                cache_record = RAGCache(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    query=question_clean.lower(),
                    answer=answer,
                    sources=json.dumps(sources),
                    confidence_score=confidence,
                    follow_up_questions=json.dumps(follow_ups),
                    cached_at=datetime.utcnow()
                )
                db.add(cache_record)
                db.commit()

                return {
                    "answer": answer,
                    "sources": sources,
                    "confidence_score": confidence,
                    "follow_up_questions": follow_ups
                }

            except Exception as groq_error:
                logger.error(f"Groq RAG prompt generation failed on attempt {attempt}: {str(groq_error)}")
                if attempt == max_retries:
                    # Final attempt failed, return empty response safely
                    return {
                        "answer": "Information was not found (request failed).",
                        "sources": sources,
                        "confidence_score": 0.0,
                        "follow_up_questions": []
                    }
