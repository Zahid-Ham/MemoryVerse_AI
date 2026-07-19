import uuid
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.document import DocumentMetadata
from app.utils.key_manager import GroqKeyManager

logger = logging.getLogger(__name__)

class GroqMetadataService:
    @staticmethod
    def extract_and_persist(db: Session, document_id: str, text: str, filename: str, user_id: str = None) -> dict:
        """
        Extracts document metadata using Groq (fallback routing supported) and saves to SQLite.
        Includes a caching layer: does not call Groq if metadata is already cached.
        Retries up to 2 times on general failures.
        """
        # 1. Caching Rule: If metadata exists, DO NOT call Groq again
        existing = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == document_id).first()
        if existing:
            logger.info(f"Metadata already cached in SQLite for document {document_id}")
            return {
                "id": existing.id,
                "document_id": existing.document_id,
                "title": existing.title,
                "summary": existing.summary,
                "tags": [t.strip() for t in existing.tags.split(",") if t.strip()] if existing.tags else [],
                "people": [p.strip() for p in existing.people.split(",") if p.strip()] if existing.people else [],
                "organizations": [o.strip() for o in existing.organizations.split(",") if o.strip()] if existing.organizations else [],
                "locations": [l.strip() for l in existing.locations.split(",") if l.strip()] if existing.locations else [],
                "emotions": [e.strip() for e in existing.emotions.split(",") if e.strip()] if existing.emotions else [],
                "cached": True
            }

        # 2. Input limit: First 2,000 characters of extracted text only
        truncated_text = text[:2000] if text else ""
        if not truncated_text:
            truncated_text = f"Empty file named {filename}"

        # 3. Setup Groq prompt requesting structured JSON output
        prompt = f"""
        Analyze the following document content and extract structured metadata.
        You MUST extract:
        - title (string): A short, descriptive title.
        - summary (string): A brief, 1-2 sentence summary.
        - category (string): Document classification. You MUST classify this document into EXACTLY one of these categories based on these guidelines:
          * "Academics": School/college/university lecture slides, class notes, study material, syllabus, textbooks, homework, quizzes, research papers, tutorials, presentations on academic/scientific concepts (e.g., probability, math, physics, biology, history).
          * "Projects": Project proposals, software repositories, README files, system design specifications, portfolios, source code documentation, building guides, or case studies of custom built systems.
          * "Internships": Internship offer letters, reports, daily logs, or reviews related to work done during internships.
          * "Certifications": Course completion certificates, exam results, professional credentials, licenses, or verification letters.
          * "Skills": Skill lists, programming language cheatsheets, resume skill matrices, or dedicated learning guides for specific tools/languages.
          * "Achievements": Awards, contest rankings, scholarships, recommendation letters, honors, or certificates of merit.
          * "General": Anything else that doesn't fit the above (e.g., meeting minutes, personal journals, emails, templates, random notes).
        - tags (list of strings): Up to 5 relevant tags/topics.
        - people (list of strings): People mentioned.
        - organizations (list of strings): Companies or institutions.
        - locations (list of strings): Places, cities, or countries.
        - emotions (list of strings): Tone or emotional sentiment.

        Document Content:
        {truncated_text}

        Response must be strict JSON matching this structure:
        {{
          "title": "Title",
          "summary": "Summary text",
          "category": "Academics",
          "tags": ["tag1", "tag2"],
          "people": ["Person Name"],
          "organizations": ["Org Name"],
          "locations": ["Location Name"],
          "emotions": ["Emotional Tone"]
        }}
        """

        # 4. Helper executing Groq client call
        def call_groq(client):
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a precise metadata extraction assistant. Output valid JSON matching the schema only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            return json.loads(response.choices[0].message.content)

        # 5. Execute with fallback + maximum 2 retries (up to 3 total attempts)
        key_manager = GroqKeyManager()
        metadata_json = None
        max_attempts = 3
        
        for attempt in range(max_attempts):
            try:
                # KeyManager handles key rotation and exponential backoff on retry internally
                metadata_json = key_manager.execute_with_fallback(call_groq)
                break
            except Exception as e:
                logger.warning(f"Groq metadata generation attempt {attempt + 1} failed: {str(e)}")
                if attempt == max_attempts - 1:
                    logger.error(f"All Groq metadata generation attempts failed for document {document_id}. Using fallback values.")

        # 6. Parse JSON and Fallback logic
        if not metadata_json:
            # Fallback metadata if Groq completely fails
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

            metadata_json = {
                "title": filename,
                "summary": "Document uploaded successfully. Content analysis is pending.",
                "category": fallback_cat,
                "tags": ["uploaded"],
                "people": [],
                "organizations": [],
                "locations": [],
                "emotions": ["neutral"]
            }

        # Normalize category
        allowed_cats = {"Projects", "Skills", "Certifications", "Internships", "Achievements", "Academics", "General"}
        extracted_cat = metadata_json.get("category", "General")
        matched_cat = "General"
        for ac in allowed_cats:
            if ac.lower() == str(extracted_cat).lower().strip():
                matched_cat = ac
                break
        metadata_json["category"] = matched_cat

        # 7. Persist to database (join lists into comma-separated strings)
        db_meta = DocumentMetadata(
            id=str(uuid.uuid4()),
            user_id=user_id,
            document_id=document_id,
            title=metadata_json.get("title", filename),
            summary=metadata_json.get("summary", ""),
            category=metadata_json.get("category", "General"),
            tags=",".join(metadata_json.get("tags", [])),
            people=",".join(metadata_json.get("people", [])),
            organizations=",".join(metadata_json.get("organizations", [])),
            locations=",".join(metadata_json.get("locations", [])),
            emotions=",".join(metadata_json.get("emotions", [])),
            generated_at=datetime.utcnow()
        )
        
        try:
            db.add(db_meta)
            db.commit()
            
            # Update category on parent Document record too
            from app.models.document import Document
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.category = metadata_json.get("category", "General")
                db.add(doc)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist document metadata for {document_id}: {str(e)}")

        return {
            "id": db_meta.id,
            "document_id": document_id,
            "title": db_meta.title,
            "summary": db_meta.summary,
            "category": db_meta.category,
            "tags": metadata_json.get("tags", []),
            "people": metadata_json.get("people", []),
            "organizations": metadata_json.get("organizations", []),
            "locations": metadata_json.get("locations", []),
            "emotions": metadata_json.get("emotions", []),
            "cached": False
        }
