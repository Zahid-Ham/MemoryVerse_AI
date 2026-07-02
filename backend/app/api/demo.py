from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os
from datetime import datetime
from app.database.connection import get_db
from app.models.document import Document, DocumentContent, DocumentChunk, DocumentMetadata, DocumentEmbeddingStatus, DocumentModel
from app.services.vector_store_service import VectorStoreService
from app.services.embedding_service import SentenceTransformersEmbeddingProvider

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_DOCUMENTS = [
    {
        "id": "demo_doc_1",
        "filename": "llama_research_paper.pdf",
        "filetype": "application/pdf",
        "filesize": 1420500,
        "category": "Academics",
        "summary": "Introduction of LLaMA, a collection of foundation language models ranging from 7B to 65B parameters designed by Meta AI. Highlights training on open datasets and performance matching commercial models.",
        "tags": "artificial intelligence, language models, transformers",
        "people": "Hugo Touvron, Thibaut Lavril",
        "locations": "Paris, Meta AI Research Lab",
        "emotions": "EXCITED",
        "text": "LLaMA: Open and Efficient Foundation Language Models. We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters. LLaMA-13B outperforms GPT-3 on most benchmarks despite being 10x smaller. We train our models on trillions of tokens using publicly available datasets without proprietary data."
    },
    {
        "id": "demo_doc_2",
        "filename": "attention_transformer_paper.pdf",
        "filetype": "application/pdf",
        "filesize": 2105000,
        "category": "Academics",
        "summary": "The seminal paper introducing the Transformer architecture. Replaces recurrent and convolutional layers entirely with self-attention mechanisms, increasing training speed and translation quality.",
        "tags": "transformers, neural networks, deep learning",
        "people": "Ashish Vaswani, Noam Shazeer",
        "locations": "Google Brain, Toronto",
        "emotions": "INSPIRED",
        "text": "Attention Is All You Need. The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. This allows for significantly more parallelization."
    },
    {
        "id": "demo_doc_3",
        "filename": "project_orion_kickoff_notes.docx",
        "filetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "filesize": 45000,
        "category": "Projects",
        "summary": "Initial kickoff meeting notes for Project Orion. Outlines Q4 milestones, team engineering roles, Sarah's UI designs, and database setup tasks.",
        "tags": "meeting, product launch, startup",
        "people": "John Doe, Sarah Jenkins, David Lee",
        "locations": "San Francisco HQ",
        "emotions": "FOCUSED",
        "text": "Meeting Notes: Project Orion Kickoff. Date: July 2, 2026. Attendees: John Doe, Sarah Jenkins, David Lee. Goal: Align on Q4 engineering timeline. Action items: Sarah to finish UI mockup dashboard components, David to start SQLite and ChromaDB vector database setup. Next meeting next Monday."
    },
    {
        "id": "demo_doc_4",
        "filename": "engineering_weekly_sync.docx",
        "filetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "filesize": 35000,
        "category": "Projects",
        "summary": "Weekly engineering sync notes. Highlights database migration completion, UI card styling progress, and planning for timeline and search upgrades.",
        "tags": "engineering, scrum, sprint",
        "people": "Sarah Jenkins, Alex Chen",
        "locations": "Zoom Office",
        "emotions": "SATISFIED",
        "text": "Engineering Weekly Sync. Blockers: SQLite migration is completed. Sarah completed Memories card styling. Next sprint priorities: Implement Ctrl+K global command palette and timeline view upgrades. Alex to review security audit logs."
    },
    {
        "id": "demo_doc_5",
        "filename": "tokyo_vacation_itinerary.pdf",
        "filetype": "application/pdf",
        "filesize": 320000,
        "category": "General",
        "summary": "A 7-day travel itinerary for a winter trip to Tokyo and Kyoto. Details hotels, visits to Shibuya Crossing, bullet trains, and Fushimi Inari Shrine.",
        "tags": "travel, vacation, itinerary",
        "people": "John Doe, Tanaka-san",
        "locations": "Tokyo, Kyoto, Shibuya, Mount Fuji",
        "emotions": "HAPPY",
        "text": "Tokyo Winter Vacation. Day 1: Arrive at Narita Airport, check-in to Shibuya Excel Hotel. Day 2: Visit Meiji Shrine and Shibuya Crossing dinner with Tanaka-san. Day 3: Shinkansen bullet train to Kyoto. Day 4: Fushimi Inari and Kinkaku-ji temples. Day 5: Visit Mount Fuji."
    },
    {
        "id": "demo_doc_6",
        "filename": "europe_travel_guide.txt",
        "filetype": "text/plain",
        "filesize": 12000,
        "category": "General",
        "summary": "Summarized travel bookings, reservations, and sightseeing plans for London, Paris, and Rome vacation.",
        "tags": "travel, adventure, Europe",
        "people": "Sarah Jenkins",
        "locations": "Paris, London, Rome, Colosseum",
        "emotions": "EXCITED",
        "text": "Europe Exploration Guide. London: British Museum tour, London Eye. Paris: Eiffel Tower, Louvre Museum art tour. Rome: Guided walk in Colosseum, Vatican City tour. Flight details: Paris to Rome on easyJet."
    },
    {
        "id": "demo_doc_7",
        "filename": "team_dinner_offsite.jpg",
        "filetype": "image/jpeg",
        "filesize": 2500000,
        "category": "General",
        "summary": "Team offsite dinner photograph celebrating the successful release of the MemoryVerse AI beta platform.",
        "tags": "team building, photo, social",
        "people": "John Doe, Sarah Jenkins, David Lee, Alex Chen",
        "locations": "San Francisco, Italian Bistro Restaurant",
        "emotions": "HAPPY",
        "text": "[IMAGE CONTENT] Metadata: Offsite Team Dinner photo in San Francisco Italian Bistro with John, Sarah, David, Alex. Celebrating release."
    },
    {
        "id": "demo_doc_8",
        "filename": "minimalist_desk_setup.png",
        "filetype": "image/png",
        "filesize": 4200000,
        "category": "General",
        "summary": "Minimalist desk setup photograph featuring dual monitors, mechanical keyboard, and clean productivity setup.",
        "tags": "desk setup, productivity, photo",
        "people": "John Doe",
        "locations": "Home Office",
        "emotions": "CALM",
        "text": "[IMAGE CONTENT] Workspace Desk setup image at Home Office with dual monitors, mechanical keyboard, and custom studio lighting."
    },
    {
        "id": "demo_doc_9",
        "filename": "aws_hosting_bill_june.pdf",
        "filetype": "application/pdf",
        "filesize": 95000,
        "category": "Projects",
        "summary": "Monthly cloud hosting invoice from AWS for EC2 instances, database hosting, and S3 file storage.",
        "tags": "invoice, finance, hosting",
        "people": "Sarah Jenkins",
        "locations": "Seattle AWS HQ",
        "emotions": "CALM",
        "text": "Amazon Web Services Invoice. Bill Period: June 2026. Account: MemoryVerse AI. Charges: EC2 Instances: $142.30, RDS Database: $85.00, S3 Storage: $12.45. Total: $239.75. Due Date: July 15, 2026."
    },
    {
        "id": "demo_doc_10",
        "filename": "openai_usage_invoice.pdf",
        "filetype": "application/pdf",
        "filesize": 88000,
        "category": "Projects",
        "summary": "Monthly usage invoice from OpenAI for API tokens consumed during LLM processing and embeddings generation tests.",
        "tags": "billing, OpenAI, invoice",
        "people": "David Lee",
        "locations": "San Francisco OpenAI Office",
        "emotions": "FOCUSED",
        "text": "OpenAI API Usage Invoice. Date: July 1, 2026. Amount: $45.12. Usage: GPT-4 API tokens: 2.1M tokens. Embedding models tokens: 10M tokens. Project identifier: MemoryVerse_AI."
    },
    {
        "id": "demo_doc_11",
        "filename": "algorithms_lecture_10.txt",
        "filetype": "text/plain",
        "filesize": 8500,
        "category": "Academics",
        "summary": "Lecture notes on graph algorithms, detailing Dijkstra's shortest path algorithm and min-priority queue complexities.",
        "tags": "computer science, algorithms, study",
        "people": "Professor Williams",
        "locations": "Stanford University",
        "emotions": "FOCUSED",
        "text": "Algorithms Lecture 10: Dijkstra's Algorithm. Professor Williams. Stanford University. Dijkstra's computes the single-source shortest path for non-negative weights. Time complexity: O((V + E) log V) using min-priority queue. BFS is used for unweighted graphs."
    },
    {
        "id": "demo_doc_12",
        "filename": "organic_chemistry_functional_groups.txt",
        "filetype": "text/plain",
        "filesize": 9200,
        "category": "Academics",
        "summary": "Study guide summarizing organic chemistry structures, sp3 hybridization, and carboxylic acid reactions.",
        "tags": "chemistry, science, notes",
        "people": "Professor Davis",
        "locations": "Chemistry Hall Room 101",
        "emotions": "CALM",
        "text": "Organic Chemistry notes. Carbon bonding, sp3 hybridization. Covalent bonds. Functional groups: Alcohols, Ketones, Carboxylic acids. Davis lecture notes."
    },
    {
        "id": "demo_doc_13",
        "filename": "q2_marketing_growth_report.pdf",
        "filetype": "application/pdf",
        "filesize": 1100000,
        "category": "Projects",
        "summary": "Growth analytics report for Q2, showcasing a 140% user signup increase and optimized conversion rates.",
        "tags": "report, marketing, analytics",
        "people": "Sarah Jenkins",
        "locations": "London Branch Office",
        "emotions": "EXCITED",
        "text": "Q2 Analytics Report. User Growth: Signups grew from 10k to 24k (140% increase). Conversion Rate optimized by 2.4% using landing page A/B tests."
    },
    {
        "id": "demo_doc_14",
        "filename": "database_security_audit.pdf",
        "filetype": "application/pdf",
        "filesize": 1250000,
        "category": "Projects",
        "summary": "Security audit report verifying TLS 1.3 enforcement and encrypted database configurations.",
        "tags": "security, audit, system admin",
        "people": "Security Lead Alex",
        "locations": "Remote Audit Server",
        "emotions": "SATISFIED",
        "text": "Security Audit Report. Audited by Alex. TLS 1.3 enforced. SQLite database encryption enabled. No high-level vulnerabilities detected in vector endpoints."
    },
    {
        "id": "demo_doc_15",
        "filename": "google_internship_offer_letter.pdf",
        "filetype": "application/pdf",
        "filesize": 780000,
        "category": "Internships",
        "summary": "Software Engineering Internship offer letter at Google for Summer 2026. Details Mountain View office location and start date.",
        "tags": "career, offer, internships",
        "people": "Sundar Pichai, HR Team",
        "locations": "Mountain View Googleplex",
        "emotions": "EXCITED",
        "text": "Google Internship Offer Letter. Dear Candidate, we are pleased to offer you an internship position as a Software Engineering Intern at Google Mountain View. Compensation: $42 per hour. Start date: May 18, 2026."
    }
]

@router.post("/load")
def load_demo_data(db: Session = Depends(get_db)):
    """Inserts mock demo files directly into database and ChromaDB collections."""
    embed_provider = SentenceTransformersEmbeddingProvider()

    # Clear existing demo documents to prevent duplication
    clear_demo_data(db)

    try:
        for doc_data in DEMO_DOCUMENTS:
            doc_id = doc_data["id"]
            filename = doc_data["filename"]
            
            # Create a mock file on disk to avoid 'file not found' previews
            storage_dir = os.path.join("storage", "uploads")
            os.makedirs(storage_dir, exist_ok=True)
            mock_path = os.path.join(storage_dir, filename)
            with open(mock_path, "w", encoding="utf-8") as f:
                f.write(doc_data["text"])

            # 1. Insert into Document (web app listing)
            db_doc = Document(
                id=doc_id,
                filename=filename,
                filepath=mock_path,
                filetype=doc_data["filetype"],
                filesize=doc_data["filesize"],
                uploaded_at=datetime.utcnow(),
                category=doc_data["category"],
                status="Completed"
            )
            db.add(db_doc)

            # 2. Insert into DocumentModel (RAG ingestion matching)
            db_doc_model = DocumentModel(
                id=doc_id,
                filename=filename,
                file_path=mock_path,
                content_type=doc_data["filetype"],
                size=doc_data["filesize"],
                status="completed",
                created_at=datetime.utcnow(),
                title=filename,
                summary=doc_data["summary"],
                tags=doc_data["tags"].split(", "),
                people=doc_data["people"].split(", "),
                locations=doc_data["locations"].split(", "),
                emotions=[doc_data["emotions"]],
                category=doc_data["category"]
            )
            db.add(db_doc_model)

            # 3. Insert Content
            db_content = DocumentContent(
                id=f"{doc_id}_content",
                document_id=doc_id,
                raw_text=doc_data["text"],
                text_length=len(doc_data["text"]),
                extracted_at=datetime.utcnow()
            )
            db.add(db_content)

            # 4. Insert Chunk
            db_chunk = DocumentChunk(
                id=f"{doc_id}_chunk_0",
                document_id=doc_id,
                chunk_index=0,
                chunk_text=doc_data["text"],
                chunk_length=len(doc_data["text"]),
                created_at=datetime.utcnow()
            )
            db.add(db_chunk)

            # 5. Insert Metadata
            db_meta = DocumentMetadata(
                id=f"{doc_id}_metadata",
                document_id=doc_id,
                title=filename,
                summary=doc_data["summary"],
                tags=doc_data["tags"],
                people=doc_data["people"],
                organizations="Meta, Google, OpenAI",
                locations=doc_data["locations"],
                emotions=doc_data["emotions"],
                category=doc_data["category"],
                generated_at=datetime.utcnow()
            )
            db.add(db_meta)

            # 6. Insert Embedding Status
            db_embed_status = DocumentEmbeddingStatus(
                id=f"{doc_id}_embed_status",
                document_id=doc_id,
                status="completed",
                model_name="all-MiniLM-L6-v2",
                chunks_embedded=1,
                embedded_at=datetime.utcnow()
            )
            db.add(db_embed_status)

            # Flush SQL session to ensure records are visible to query methods in insert_chunks
            db.flush()

            # 7. Embed & Add to ChromaDB vector store
            embeddings = embed_provider.embed_documents([doc_data["text"]])
            VectorStoreService.insert_chunks(
                db=db,
                document_id=doc_id,
                chunks=[db_chunk],
                embeddings=embeddings
            )

        db.commit()
        return {"message": "Demo MemoryVerse loaded successfully with 15 mock documents"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to load demo data: {str(e)}")

@router.post("/clear")
def clear_demo_data(db: Session = Depends(get_db)):
    """Removes all demo dataset records from SQLite and ChromaDB."""
    try:
        # Fetch demo docs
        demo_docs = db.query(Document).filter(Document.id.like("demo_doc_%")).all()
        for doc in demo_docs:
            # Delete file on disk
            if doc.filepath and os.path.exists(doc.filepath):
                try:
                    os.remove(doc.filepath)
                except Exception:
                    pass
            # Delete vectors
            VectorStoreService.delete_document(doc.id)

        # SQLite tables removals
        db.query(DocumentMetadata).filter(DocumentMetadata.document_id.like("demo_doc_%")).delete(synchronize_session=False)
        db.query(DocumentContent).filter(DocumentContent.document_id.like("demo_doc_%")).delete(synchronize_session=False)
        db.query(DocumentChunk).filter(DocumentChunk.document_id.like("demo_doc_%")).delete(synchronize_session=False)
        db.query(DocumentEmbeddingStatus).filter(DocumentEmbeddingStatus.document_id.like("demo_doc_%")).delete(synchronize_session=False)
        db.query(DocumentModel).filter(DocumentModel.id.like("demo_doc_%")).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.like("demo_doc_%")).delete(synchronize_session=False)
        
        db.commit()
        return {"message": "Demo MemoryVerse dataset removed successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear demo data: {str(e)}")
