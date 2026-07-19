from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from collections import defaultdict
from app.database.connection import get_db
from app.models.document import Document, DocumentMetadata
from app.api.auth import get_current_user
from app.models.user import UserModel

router = APIRouter(prefix="/api/timeline", tags=["timeline"])

@router.get("")
def get_timeline(
    person: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    emotion: Optional[str] = Query(None),
    group_by: str = Query("date", enum=["date", "month", "year", "title", "people", "locations", "emotions"]),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Fetches documents/memories from the database, applies filters,
    and groups them by Date, Month, Year, Title, People, Locations, or Emotions.
    """
    # Query Document joined with DocumentMetadata
    results = db.query(Document, DocumentMetadata).outerjoin(
        DocumentMetadata, Document.id == DocumentMetadata.document_id
    ).filter(Document.user_id == current_user.id).all()

    activity_feed = []
    
    # 1. Compile flat chronological lists of activities merging DB metadata
    for doc, meta in results:
        # Extract metadata lists
        tags_list = [t.strip() for t in meta.tags.split(",") if t.strip()] if (meta and meta.tags) else []
        people_list = [p.strip() for p in meta.people.split(",") if p.strip()] if (meta and meta.people) else []
        locations_list = [l.strip() for l in meta.locations.split(",") if l.strip()] if (meta and meta.locations) else []
        emotions_list = [e.strip() for e in meta.emotions.split(",") if e.strip()] if (meta and meta.emotions) else []
        
        # Apply filters
        if tag and tag not in tags_list:
            continue
        if person and person not in people_list:
            continue
        if location and location not in locations_list:
            continue
        if emotion and emotion not in emotions_list:
            continue

        activity_feed.append({
            "id": doc.id,
            "title": meta.title if (meta and meta.title) else doc.filename,
            "filename": doc.filename,
            "summary": meta.summary if (meta and meta.summary) else f"Uploaded local file of size {doc.filesize} bytes",
            "created_at": doc.uploaded_at,
            "tags": tags_list,
            "people": people_list,
            "locations": locations_list,
            "emotions": emotions_list,
            "type": doc.filetype
        })

    # Sort documents by creation date descending
    activity_feed.sort(key=lambda x: x["created_at"] or datetime.utcnow(), reverse=True)

    # 2. Dynamic Grouped structure
    grouped = defaultdict(list)
    for item in activity_feed:
        dt = item["created_at"] or datetime.utcnow()
        
        if group_by == "year":
            key = dt.strftime("%Y")
            grouped[key].append(item)
        elif group_by == "month":
            key = dt.strftime("%B %Y")
            grouped[key].append(item)
        elif group_by == "title":
            key = item["title"]
            grouped[key].append(item)
        elif group_by == "people":
            if item["people"]:
                for p in item["people"]:
                    grouped[p].append(item)
            else:
                grouped["No People Mentioned"].append(item)
        elif group_by == "locations":
            if item["locations"]:
                for l in item["locations"]:
                    grouped[l].append(item)
            else:
                grouped["No Locations Mentioned"].append(item)
        elif group_by == "emotions":
            if item["emotions"]:
                for e in item["emotions"]:
                    grouped[e].append(item)
            else:
                grouped["No Sentiment Identified"].append(item)
        else:  # group_by == "date"
            key = dt.strftime("%Y-%m-%d")
            grouped[key].append(item)

    # 3. Gather all unique filters dynamically from database
    all_metadata = db.query(DocumentMetadata).filter(DocumentMetadata.user_id == current_user.id).all()
    available_tags = set()
    available_people = set()
    available_locations = set()
    available_emotions = set()

    for meta in all_metadata:
        if meta.tags:
            for t in meta.tags.split(","):
                if t.strip(): available_tags.add(t.strip())
        if meta.people:
            for p in meta.people.split(","):
                if p.strip(): available_people.add(p.strip())
        if meta.locations:
            for l in meta.locations.split(","):
                if l.strip(): available_locations.add(l.strip())
        if meta.emotions:
            for e in meta.emotions.split(","):
                if e.strip(): available_emotions.add(e.strip())

    return {
        "grouped": dict(grouped),
        "activity_feed": activity_feed,
        "filters_applied": {
            "person": person,
            "tag": tag,
            "location": location,
            "emotion": emotion,
            "group_by": group_by
        },
        "available_filters": {
            "tags": sorted(list(available_tags)),
            "people": sorted(list(available_people)),
            "locations": sorted(list(available_locations)),
            "emotions": sorted(list(available_emotions))
        }
    }

