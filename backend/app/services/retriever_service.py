import logging
from typing import List, Dict, Any
from app.services.embedding_service import SentenceTransformersEmbeddingProvider
from app.services.vector_store_service import VectorStoreService

logger = logging.getLogger(__name__)

class RetrieverService:
    @staticmethod
    def retrieve_context(question: str) -> Dict[str, Any]:
        """
        Converts the user question into an embedding, queries ChromaDB for the Top 3 chunks,
        and constructs a context string for LLM parsing.
        """
        if not question.strip():
            return {
                "query": question,
                "context": "",
                "sources": [],
                "similarity_scores": []
            }

        # 1. Generate Query Embedding
        embed_provider = SentenceTransformersEmbeddingProvider()
        query_embeddings = embed_provider.embed_documents([question])
        query_embedding = query_embeddings[0]

        # 2. Chroma Similarity Search (Retrieve Top 3 Chunks Only)
        search_results = VectorStoreService.query_similar_chunks(query_embedding, n_results=3)

        documents = search_results.get("documents", [[]])[0]
        metadatas = search_results.get("metadatas", [[]])[0]
        distances = search_results.get("distances", [[]])[0]

        context_blocks = []
        sources = []
        similarity_scores = []

        # 3. Group retrieved chunks by document to avoid duplicate headers
        grouped_docs = {}
        for idx in range(len(documents)):
            chunk_text = documents[idx]
            meta = metadatas[idx] if idx < len(metadatas) else {}
            dist = distances[idx] if idx < len(distances) else 1.0

            similarity = round(1.0 / (1.0 + dist), 4)
            similarity_scores.append(similarity)

            doc_id = meta.get("document_id", "unknown")
            filename = meta.get("filename", "unknown")
            chunk_index = meta.get("chunk_index", 0)

            if doc_id not in grouped_docs:
                grouped_docs[doc_id] = {
                    "filename": filename,
                    "chunks": []
                }
            
            # Avoid duplicate chunks if they are identical
            if chunk_text not in grouped_docs[doc_id]["chunks"]:
                grouped_docs[doc_id]["chunks"].append(chunk_text)

            sources.append({
                "document_id": doc_id,
                "filename": filename,
                "chunk_index": chunk_index,
                "text": chunk_text
            })

        # Build context by grouping chunks under their parent document
        context_parts = []
        for doc_id, doc_info in grouped_docs.items():
            merged_text = "\n[...]\n".join(doc_info["chunks"])
            context_parts.append(f"--- DOCUMENT: {doc_info['filename']} ---\n{merged_text}")

        context = "\n\n".join(context_parts)

        return {
            "query": question,
            "context": context,
            "sources": sources,
            "similarity_scores": similarity_scores
        }
