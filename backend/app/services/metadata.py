import os
import json
import time
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.document import DocumentModel
from app.utils.key_manager import GroqKeyManager

class MetadataExtractorService:
    def __init__(self):
        self.key_manager = GroqKeyManager()

    def check_cache(self, db: Session, filename: str, file_size: int) -> Optional[Dict[str, Any]]:
        """
        Check if metadata for this file (same filename and size) is already cached in the database.
        Optimization Rule 2: Never regenerate metadata if cached.
        """
        cached_doc = db.query(DocumentModel).filter(
            DocumentModel.filename == filename,
            DocumentModel.size == file_size,
            DocumentModel.status == "completed"
        ).first()

        if cached_doc and cached_doc.title:
            return {
                "title": cached_doc.title,
                "summary": cached_doc.summary,
                "category": cached_doc.category or "General",
                "tags": cached_doc.tags or [],
                "topics": cached_doc.topics or [],
                "people": cached_doc.people or [],
                "organizations": cached_doc.organizations or [],
                "locations": cached_doc.locations or [],
                "emotions": cached_doc.emotions or []
            }
        return None

    def extract_metadata(self, text: str, filename: str) -> Dict[str, Any]:
        """
        Extracts title, summary, category, tags, topics, people, organizations, locations, and emotions from document text.
        Limits text to a maximum of 2,000 characters to respect Groq rate limits.
        Attempts key rotation through all keys in the fallback pool if rate limits or errors are hit.
        """
        truncated_text = text[:2000]

        prompt = f"""
        Analyze the following document content and extract structured metadata in JSON format.
        You MUST extract:
        - title (string): A short, descriptive title.
        - summary (string): A brief, 2-sentence summary.
        - category (string): Document classification. You MUST classify this document into EXACTLY one of these categories based on these guidelines:
          * "Academics": School/college/university lecture slides, class notes, study material, syllabus, textbooks, homework, quizzes, research papers, tutorials, presentations on academic/scientific concepts (e.g., probability, math, physics, biology, history).
          * "Projects": Project proposals, software repositories, README files, system design specifications, portfolios, source code documentation, building guides, or case studies of custom built systems.
          * "Internships": Internship offer letters, reports, daily logs, or reviews related to work done during internships.
          * "Certifications": Course completion certificates, exam results, professional credentials, licenses, or verification letters.
          * "Skills": Skill lists, programming language cheatsheets, resume skill matrices, or dedicated learning guides for specific tools/languages.
          * "Achievements": Awards, contest rankings, scholarships, recommendation letters, honors, or certificates of merit.
          * "General": Anything else that doesn't fit the above (e.g., meeting minutes, personal journals, emails, templates, random notes).
        - tags (list of strings): Up to 5 relevant tags.
        - topics (list of strings): Primary subject matters.
        - people (list of strings): People mentioned.
        - organizations (list of strings): Companies or institutions.
        - locations (list of strings): Places, cities, or countries.
        - emotions (list of strings): Tone or emotional sentiment.

        Document Content:
        {truncated_text}

        Response must be strict JSON matching this structure:
        {{
          "title": "Title",
          "summary": "Summary",
          "category": "Academics",
          "tags": ["tag1", "tag2"],
          "topics": ["topic1"],
          "people": ["Person"],
          "organizations": ["Org"],
          "locations": ["Loc"],
          "emotions": ["Tone"]
        }}
        """

        # Try all keys in the key manager pool
        total_keys = len(self.key_manager.KEYS)
        
        for attempt in range(total_keys):
            client = self.key_manager.get_client()
            try:
                response = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": "You are a precise metadata extraction assistant. Output valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                
                result_json = response.choices[0].message.content
                result_data = json.loads(result_json)
                
                # Normalize category
                allowed_cats = {"Projects", "Skills", "Certifications", "Internships", "Achievements", "Academics", "General"}
                extracted_cat = result_data.get("category", "General")
                matched_cat = "General"
                for ac in allowed_cats:
                    if ac.lower() == str(extracted_cat).lower().strip():
                        matched_cat = ac
                        break
                result_data["category"] = matched_cat
                return result_data
            except Exception as e:
                # Rotate key and try the next one in the pool immediately on failure
                self.key_manager.rotate_key()
                # If we've exhausted all keys, fallback
                if attempt == total_keys - 1:
                    return self._get_fallback_metadata(filename)
                time.sleep(1)

        return self._get_fallback_metadata(filename)

    def save_to_cache(
        self, 
        db: Session, 
        document_id: str, 
        filename: str, 
        file_path: str, 
        content_type: str, 
        size: int, 
        metadata: Dict[str, Any]
    ) -> DocumentModel:
        """
        Store metadata in SQLite database.
        Optimization Rule 1: Cache metadata after first upload.
        Optimization Rule 6: Store metadata in database.
        """
        doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
        if not doc:
            doc = DocumentModel(
                id=document_id,
                filename=filename,
                file_path=file_path,
                content_type=content_type,
                size=size
            )
            db.add(doc)

        doc.title = metadata.get("title", "")
        doc.summary = metadata.get("summary", "")
        doc.category = metadata.get("category", "General")
        doc.tags = metadata.get("tags", [])
        doc.topics = metadata.get("topics", [])
        doc.people = metadata.get("people", [])
        doc.organizations = metadata.get("organizations", [])
        doc.locations = metadata.get("locations", [])
        doc.emotions = metadata.get("emotions", [])
        doc.status = "completed"

        db.commit()
        db.refresh(doc)
        return doc

    def _get_fallback_metadata(self, filename: str) -> Dict[str, Any]:
        """
        Provides fallback metadata structures when API calls fail or credentials are omitted.
        """
        base_name, _ = os.path.splitext(filename)
        clean_title = base_name.replace("_", " ").replace("-", " ").title()
        
        fn_lower = filename.lower()
        if "cert" in fn_lower:
            fallback_cat = "Certifications"
        elif "intern" in fn_lower or "offer" in fn_lower:
            fallback_cat = "Internships"
        elif "project" in fn_lower or "report" in fn_lower:
            fallback_cat = "Projects"
        elif "skill" in fn_lower or "resume" in fn_lower:
            fallback_cat = "Skills"
        elif "achievement" in fn_lower or "award" in fn_lower:
            fallback_cat = "Achievements"
        elif "academic" in fn_lower or "course" in fn_lower or "grade" in fn_lower:
            fallback_cat = "Academics"
        else:
            fallback_cat = "General"

        return {
            "title": clean_title,
            "summary": f"Imported file {filename} containing document contents.",
            "category": fallback_cat,
            "tags": ["Imported", "Uncategorized"],
            "topics": ["General"],
            "people": [],
            "organizations": [],
            "locations": [],
            "emotions": ["Neutral"]
        }
