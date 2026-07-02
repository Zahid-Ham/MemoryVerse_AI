from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database.connection import get_db
from app.models.document import Document, DocumentMetadata

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("/index-stats")
def get_vector_index_stats():
    """
    GET /api/search/index-stats
    Returns count and health state of ChromaDB collection index.
    """
    from app.services.vector_store_service import VectorStoreService
    return VectorStoreService.get_stats()

@router.get("/suggestions")
def get_search_suggestions(db: Session = Depends(get_db)):
    """
    GET /api/search/suggestions
    Compiles contextual search questions based on SQLite metadata elements.
    """
    from collections import Counter
    all_meta = db.query(DocumentMetadata).all()
    
    tags = []
    people = []
    locations = []
    
    for meta in all_meta:
        if meta.tags:
            tags.extend([t.strip() for t in meta.tags.split(",") if t.strip()])
        if meta.people:
            people.extend([p.strip() for p in meta.people.split(",") if p.strip()])
        if meta.locations:
            locations.extend([l.strip() for l in meta.locations.split(",") if l.strip()])
            
    top_tag = Counter(tags).most_common(1)
    top_person = Counter(people).most_common(1)
    top_location = Counter(locations).most_common(1)
    
    suggestions = []
    
    if top_tag:
        suggestions.append(f"What documents mention {top_tag[0][0]}?")
    else:
        suggestions.append("What documents mention AI?")
        
    if top_person:
        suggestions.append(f"Does {top_person[0][0]} appear in my memories?")
    else:
        suggestions.append("Who appears most frequently?")
        
    if top_location:
        suggestions.append(f"Show memories related to {top_location[0][0]}.")
    else:
        suggestions.append("Show memories related to Mumbai.")
        
    suggestions.append("What was uploaded this month?")
    
    return {"suggestions": suggestions}

@router.get("")
def search_metadata(q: str = Query("", description="Search query"), db: Session = Depends(get_db)):
    if not q.strip():
        return []

    query_words = q.lower().split()
    results = db.query(Document, DocumentMetadata).outerjoin(
        DocumentMetadata, Document.id == DocumentMetadata.document_id
    ).all()

    ranked_matches = []

    for doc, meta in results:
        score = 0
        match_reasons = []

        filename_lower = doc.filename.lower() if doc.filename else ""
        title_lower = meta.title.lower() if (meta and meta.title) else ""
        summary_lower = meta.summary.lower() if (meta and meta.summary) else ""
        tags_lower = meta.tags.lower() if (meta and meta.tags) else ""
        people_lower = meta.people.lower() if (meta and meta.people) else ""
        locations_lower = meta.locations.lower() if (meta and meta.locations) else ""
        organizations_lower = meta.organizations.lower() if (meta and meta.organizations) else ""

        for word in query_words:
            # Score ranking
            if word in filename_lower:
                score += 8
                if "Filename matched" not in match_reasons:
                    match_reasons.append(f"Filename matched ('{doc.filename}')")
            if word in title_lower:
                score += 10
                if "Title matched" not in match_reasons:
                    match_reasons.append(f"Title matched ('{meta.title}')")
            if word in tags_lower:
                score += 6
                matching_tags = [t.strip() for t in meta.tags.split(",") if word in t.lower()]
                if matching_tags:
                    match_reasons.append(f"Tags matched ({', '.join(matching_tags)})")
            if word in people_lower:
                score += 5
                matching_people = [p.strip() for p in meta.people.split(",") if word in p.lower()]
                if matching_people:
                    match_reasons.append(f"People mentioned ({', '.join(matching_people)})")
            if word in locations_lower:
                score += 5
                matching_locs = [l.strip() for l in meta.locations.split(",") if word in l.lower()]
                if matching_locs:
                    match_reasons.append(f"Locations mentioned ({', '.join(matching_locs)})")
            if word in organizations_lower:
                score += 5
                matching_orgs = [o.strip() for o in meta.organizations.split(",") if word in o.lower()]
                if matching_orgs:
                    match_reasons.append(f"Organizations mentioned ({', '.join(matching_orgs)})")
            if word in summary_lower:
                score += 3
                if "Summary content matched" not in match_reasons:
                    match_reasons.append("Summary content matched")

        if score > 0:
            ranked_matches.append({
                "id": doc.id,
                "title": meta.title if (meta and meta.title) else doc.filename,
                "document_type": doc.filetype,
                "matched_reason": "; ".join(match_reasons) if match_reasons else "Metadata match",
                "score": score
            })

    # Sort by score descending
    ranked_matches.sort(key=lambda x: x["score"], reverse=True)

    # Strip score before returning
    for item in ranked_matches:
        del item["score"]

    return ranked_matches


from pydantic import BaseModel

class SemanticSearchRequest(BaseModel):
    query: str

@router.post("/semantic")
def semantic_search(request: SemanticSearchRequest):
    """
    POST /api/search/semantic
    Performs semantic vector similarity search against ChromaDB index chunks.
    """
    query_text = request.query
    if not query_text.strip():
        return []

    # 1. Generate Query Embedding
    from app.services.embedding_service import SentenceTransformersEmbeddingProvider
    embed_provider = SentenceTransformersEmbeddingProvider()
    query_embeddings = embed_provider.embed_documents([query_text])
    query_embedding = query_embeddings[0]

    # 2. Chroma Similarity Search (Top K = 5)
    from app.services.vector_store_service import VectorStoreService
    search_results = VectorStoreService.query_similar_chunks(query_embedding, n_results=5)

    # 3. Format ranked matches
    formatted_results = []
    
    ids = search_results.get("ids", [[]])[0]
    documents = search_results.get("documents", [[]])[0]
    metadatas = search_results.get("metadatas", [[]])[0]
    distances = search_results.get("distances", [[]])[0]

    for idx in range(len(ids)):
        dist = distances[idx] if idx < len(distances) else 1.0
        # Convert distance to normalized similarity score
        similarity_score = round(1.0 / (1.0 + dist), 4)

        meta = metadatas[idx] if idx < len(metadatas) else {}
        document_id = meta.get("document_id", "")
        
        # Hybrid Metadata Boost: If search query keywords match metadata attributes, boost score
        query_words = query_text.lower().split()
        boost = 0.0
        
        meta_tags = meta.get("tags", "").lower()
        meta_people = meta.get("people", "").lower()
        meta_locations = meta.get("locations", "").lower()
        meta_orgs = meta.get("organizations", "").lower()
        meta_title = meta.get("title", "").lower()
        
        for word in query_words:
            # Skip short query stopwords
            if len(word) < 3 or word in ["show", "memories", "related", "documents", "mention", "what", "does", "appear", "the", "and"]:
                continue
            if word in meta_tags or word in meta_people or word in meta_locations or word in meta_orgs or word in meta_title:
                boost += 0.20 # 20% boost per matching keyword
                
        if boost > 0:
            similarity_score = min(1.0, similarity_score + boost)
        
        # Clean metadata for response
        clean_meta = {
            "filename": meta.get("filename", "unknown"),
            "document_type": meta.get("document_type", "unknown"),
            "title": meta.get("title", ""),
            "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()] if meta.get("tags") else [],
            "people": [p.strip() for p in meta.get("people", "").split(",") if p.strip()] if meta.get("people") else [],
            "locations": [l.strip() for l in meta.get("locations", "").split(",") if l.strip()] if meta.get("locations") else [],
            "organizations": [o.strip() for o in meta.get("organizations", "").split(",") if o.strip()] if meta.get("organizations") else [],
            "emotions": [e.strip() for e in meta.get("emotions", "").split(",") if e.strip()] if meta.get("emotions") else []
        }

        if similarity_score >= 0.40:
            formatted_results.append({
                "document_id": document_id,
                "chunk_text": documents[idx],
                "score": similarity_score,
                "metadata": clean_meta
            })

    return formatted_results

