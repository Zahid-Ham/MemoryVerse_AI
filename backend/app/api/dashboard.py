from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import Counter
from app.database.connection import get_db
from app.models.document import Document, DocumentMetadata
from app.api.auth import get_current_user
from app.models.user import UserModel

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    # 1. Total files count
    total_files = db.query(Document).filter(Document.user_id == current_user.id).count()
    
    # 2. Storage used in bytes
    storage_used_res = db.query(func.sum(Document.filesize)).filter(Document.user_id == current_user.id).scalar()
    storage_used = storage_used_res if storage_used_res is not None else 0
    
    # 3. Document Type Distribution
    all_files = db.query(Document.filetype).filter(Document.user_id == current_user.id).all()
    type_counts = Counter()
    for (ftype,) in all_files:
        if not ftype:
            label = "Unknown"
        elif "pdf" in ftype:
            label = "PDF"
        elif "word" in ftype or "docx" in ftype or ftype.endswith("document"):
            label = "Word"
        elif "text" in ftype or ftype == "text/plain":
            label = "Text"
        elif "image" in ftype:
            label = "Image"
        else:
            label = ftype.split("/")[-1].upper()
        type_counts[label] += 1
        
    doc_type_distribution = [{"name": name, "value": val} for name, val in type_counts.items()]
    
    # 4. Recent uploads (limit to 5)
    recent_docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).limit(5).all()
    recent_uploads = []
    for doc in recent_docs:
        recent_uploads.append({
            "id": doc.id,
            "filename": doc.filename,
            "filepath": doc.filepath,
            "filetype": doc.filetype,
            "filesize": doc.filesize,
            "uploaded_at": doc.uploaded_at,
            "category": doc.category or "General"
        })

    # Check if any documents are currently processing
    processing_count = db.query(Document).filter(Document.user_id == current_user.id).filter(
        Document.status.in_(["Queued", "Extracting Text", "Generating Metadata", "Creating Embeddings", "Indexing"])
    ).count()
    is_processing = processing_count > 0

    # 5. Extract metadata aggregates (Tags, People, Locations)
    all_metadata = db.query(DocumentMetadata).filter(DocumentMetadata.user_id == current_user.id).all()
    
    tags_counter = Counter()
    people_counter = Counter()
    locations_counter = Counter()
    
    for meta in all_metadata:
        if meta.tags:
            for t in meta.tags.split(","):
                if t.strip():
                    tags_counter[t.strip()] += 1
        if meta.people:
            for p in meta.people.split(","):
                if p.strip():
                    people_counter[p.strip()] += 1
        if meta.locations:
            for l in meta.locations.split(","):
                if l.strip():
                    locations_counter[l.strip()] += 1

    top_tags = [{"name": name, "count": count} for name, count in tags_counter.most_common(10)]
    top_people = [{"name": name, "count": count} for name, count in people_counter.most_common(10)]
    top_locations = [{"name": name, "count": count} for name, count in locations_counter.most_common(10)]

    # 6. AI Insights Card Computations
    top_tag_name = top_tags[0]["name"] if top_tags else None
    top_tag_cnt = top_tags[0]["count"] if top_tags else 0
    top_person_name = top_people[0]["name"] if top_people else None
    top_person_cnt = top_people[0]["count"] if top_people else 0
    top_loc_name = top_locations[0]["name"] if top_locations else None
    top_loc_cnt = top_locations[0]["count"] if top_locations else 0

    # Largest Document Cluster
    largest_cat_name = "General"
    largest_cat_cnt = 0
    largest_cat_pct = 0
    category_counts = db.query(Document.category, func.count(Document.id)).filter(Document.user_id == current_user.id).group_by(Document.category).all()
    if category_counts:
        cat_counts = {cat or "General": cnt for cat, cnt in category_counts}
        largest_cat_name = max(cat_counts, key=cat_counts.get)
        largest_cat_cnt = cat_counts[largest_cat_name]
        largest_cat_pct = round((largest_cat_cnt / total_files) * 100) if total_files > 0 else 0

    # Newest Knowledge Area
    newest_area_name = "General"
    newest_area_desc = "Ready for new memory additions."
    newest_doc = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).first()
    if newest_doc:
        newest_area_name = newest_doc.category or "General"
        newest_area_desc = f"Expanded from upload: '{newest_doc.filename}'."

    # Base structured insights dict
    ai_insights = {
        "mostDiscussedTopic": {
            "name": top_tag_name or "None",
            "count": top_tag_cnt,
            "description": f"Highly focused on topic '{top_tag_name}' across {top_tag_cnt} documents." if top_tag_name else "No topics parsed yet."
        },
        "mostConnectedPerson": {
            "name": top_person_name or "None",
            "count": top_person_cnt,
            "description": f"Frequently links to '{top_person_name}' (found in {top_person_cnt} documents)." if top_person_name else "No people identified yet."
        },
        "recentlyActiveLocations": {
            "name": top_loc_name or "None",
            "count": top_loc_cnt,
            "description": f"Geographic cluster around '{top_loc_name}' in {top_loc_cnt} logs." if top_loc_name else "No locations mapped yet."
        },
        "largestDocumentCluster": {
            "name": largest_cat_name,
            "count": largest_cat_cnt,
            "percentage": largest_cat_pct,
            "description": f"'{largest_cat_name}' forms {largest_cat_pct}% of your brain library." if largest_cat_cnt > 0 else "No clusters generated."
        },
        "newestKnowledgeArea": {
            "name": newest_area_name,
            "description": newest_area_desc
        },
        "naturalLanguageInsights": []
    }

    # Generate custom natural-language insights using Groq
    nlp_insights = []
    if total_files > 0:
        recent_doc_summaries = []
        for doc in recent_docs:
            meta = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == doc.id, DocumentMetadata.user_id == current_user.id).first()
            if meta and meta.summary:
                recent_doc_summaries.append(f"- {doc.filename} ({doc.category or 'General'}): {meta.summary}")
            else:
                recent_doc_summaries.append(f"- {doc.filename} ({doc.category or 'General'})")
        
        recent_docs_str = "\n".join(recent_doc_summaries)
        
        prompt = f"""
        You are an AI data analyst for "MemoryVerse AI" (a digital second brain).
        Analyze the following stats and recent document details:
        
        Stats:
        - Total documents: {total_files}
        - Top tags: {', '.join([f"{t['name']} ({t['count']})" for t in top_tags[:3]])}
        - Top people: {', '.join([f"{p['name']} ({p['count']})" for p in top_people[:3]])}
        - Top locations: {', '.join([f"{l['name']} ({l['count']})" for l in top_locations[:3]])}
        
        Recent Documents:
        {recent_docs_str}
        
        Generate exactly 3 short, insightful, natural-language observation sentences. Summarize key patterns or connections across these files. Keep each sentence under 18 words. Avoid generic phrases.
        
        Output a strict JSON array of strings only:
        [
          "Observation 1",
          "Observation 2",
          "Observation 3"
        ]
        """
        try:
            from app.utils.key_manager import GroqKeyManager
            km = GroqKeyManager()
            def _call(client):
                resp = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": "You are a precise data analysis assistant. Output a valid JSON list of strings only."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7
                )
                import json
                data = json.loads(resp.choices[0].message.content)
                for key, val in data.items():
                    if isinstance(val, list):
                        return val
                return list(data.values())[0] if isinstance(data, dict) else []
            nlp_insights = km.execute_with_fallback(_call)
        except Exception as e:
            # Fallback observations
            if top_tag_name:
                nlp_insights.append(f"Your workspace is predominantly organized around the topic of {top_tag_name}.")
            if top_person_name:
                nlp_insights.append(f"AI interactions indicate {top_person_name} as a focal connection point in your notes.")
            nlp_insights.append(f"MemoryVerse contains {total_files} memories across {len(type_counts)} document types.")

    ai_insights["naturalLanguageInsights"] = nlp_insights

    return {
        "totalFiles": total_files,
        "storageUsed": storage_used,
        "recentUploads": recent_uploads,
        "documentTypeDistribution": doc_type_distribution,
        "topTags": top_tags,
        "topPeople": top_people,
        "topLocations": top_locations,
        "isProcessing": is_processing,
        "aiInsights": ai_insights
    }
