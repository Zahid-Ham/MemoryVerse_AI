from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid
from app.database.connection import get_db
from app.models.document import Document, DocumentContent, DocumentMetadata
from pypdf import PdfReader
from app.services.extraction_service import ExtractionService
from app.services.vector_store_service import VectorStoreService
from app.api.auth import get_current_user
from app.models.user import UserModel

router = APIRouter(prefix="/api/files", tags=["files"])

# Directory to store uploaded files
UPLOAD_DIR = os.path.join("storage", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

SUPPORTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
]

@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    uploaded_results = []
    
    for file in files:
        # Check support
        if file.content_type not in SUPPORTED_TYPES:
            uploaded_results.append({
                "filename": file.filename,
                "status": "error",
                "error": f"Unsupported file format: {file.content_type}. Please upload PDF, DOCX, TXT, or images."
            })
            continue

        try:
            # Generate unique ID and file path
            file_id = str(uuid.uuid4())
            safe_filename = f"{file_id}_{file.filename}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)
            
            # Save file locally
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Get file size
            file_size = os.path.getsize(file_path)

            # Persist metadata into SQLite
            new_doc = Document(
                id=file_id,
                user_id=current_user.id,
                filename=file.filename,
                filepath=file_path,
                filetype=file.content_type,
                filesize=file_size,
                status="Queued"
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)
            
            # Trigger background text extraction pipeline
            background_tasks.add_task(
                ExtractionService.run_extraction_task,
                file_path,
                file.content_type,
                file_id,
                current_user.id
            )
            
            uploaded_results.append({
                "id": file_id,
                "filename": file.filename,
                "size": file_size,
                "content_type": file.content_type,
                "status": "success",
                "filepath": file_path
            })
        except Exception as e:
            uploaded_results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })

    # If all uploads failed with error, raise error
    if all(res["status"] == "error" for res in uploaded_results):
        raise HTTPException(status_code=400, detail=uploaded_results)

    return {"message": "Upload process completed", "results": uploaded_results}

@router.get("")
def list_files(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Returns a list of all uploaded documents with metadata included."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).all()
    results = []
    for doc in docs:
        meta = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == doc.id, DocumentMetadata.user_id == current_user.id).first()
        results.append({
            "id": doc.id,
            "filename": doc.filename,
            "filepath": doc.filepath,
            "filetype": doc.filetype,
            "filesize": doc.filesize,
            "uploaded_at": doc.uploaded_at,
            "category": doc.category or "General",
            "status": doc.status or "Queued",
            "error_message": doc.error_message,
            "metadata": {
                "summary": meta.summary if meta else None,
                "tags": [t.strip() for t in meta.tags.split(",") if t.strip()] if meta and meta.tags else [],
                "people": [p.strip() for p in meta.people.split(",") if p.strip()] if meta and meta.people else [],
                "locations": [l.strip() for l in meta.locations.split(",") if l.strip()] if meta and meta.locations else [],
            } if meta else None
        })
    return results

@router.get("/{id}")
def get_file(id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Returns a specific document's details along with its extracted text and metadata."""
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
        
    content = db.query(DocumentContent).filter(DocumentContent.document_id == id, DocumentContent.user_id == current_user.id).first()
    meta = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == id, DocumentMetadata.user_id == current_user.id).first()
    
    metadata_payload = None
    if meta:
        metadata_payload = {
            "title": meta.title,
            "summary": meta.summary,
            "category": meta.category or "General",
            "tags": [t.strip() for t in meta.tags.split(",") if t.strip()] if meta.tags else [],
            "people": [p.strip() for p in meta.people.split(",") if p.strip()] if meta.people else [],
            "organizations": [o.strip() for o in meta.organizations.split(",") if o.strip()] if meta.organizations else [],
            "locations": [l.strip() for l in meta.locations.split(",") if l.strip()] if meta.locations else [],
            "emotions": [e.strip() for e in meta.emotions.split(",") if e.strip()] if meta.emotions else [],
            "generated_at": meta.generated_at
        }
        
    return {
        "id": doc.id,
        "filename": doc.filename,
        "filepath": doc.filepath,
        "filetype": doc.filetype,
        "filesize": doc.filesize,
        "uploaded_at": doc.uploaded_at,
        "category": doc.category or "General",
        "raw_text": content.raw_text if content else None,
        "text_length": content.text_length if content else 0,
        "metadata": metadata_payload
    }

@router.delete("/{id}")
def delete_file(id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Deletes a file from disk/Cloudinary and database."""
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Remove from Cloudinary if remote url
    if doc.filepath and doc.filepath.startswith("http"):
        try:
            from app.services.cloudinary_service import CloudinaryService
            CloudinaryService.delete_file(doc.filepath)
        except Exception:
            pass
    # Remove from local storage if local
    elif doc.filepath and os.path.exists(doc.filepath):
        try:
            os.remove(doc.filepath)
        except Exception:
            pass
            
    # Delete associated vectors from ChromaDB
    VectorStoreService.delete_document(id)
            
    db.delete(doc)
    db.commit()
    return {"message": "File deleted successfully"}

@router.get("/{id}/raw")
def get_raw_file(id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Returns the raw file content."""
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
        
    if doc.filepath.startswith("http"):
        from fastapi.responses import RedirectResponse
        from app.services.cloudinary_service import CloudinaryService
        signed_url = CloudinaryService.get_signed_url(doc.filepath)
        return RedirectResponse(url=signed_url)
        
    if not os.path.exists(doc.filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(doc.filepath, media_type=doc.filetype, filename=doc.filename, content_disposition_type="inline")

@router.get("/{id}/preview")
def get_file_preview(id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Returns structured preview data for the file based on its type."""
    import io
    import urllib.request
    
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Fetch file bytes from remote Cloudinary or local path
    if doc.filepath.startswith("http"):
        try:
            from app.services.cloudinary_service import CloudinaryService
            signed_url = CloudinaryService.get_signed_url(doc.filepath)
            req = urllib.request.Request(
                signed_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
            )
            with urllib.request.urlopen(req) as response:
                file_bytes = response.read()
        except Exception as download_err:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to fetch remote file from Cloudinary: {str(download_err)}")
    else:
        if not os.path.exists(doc.filepath):
            raise HTTPException(status_code=404, detail="File not found on disk")
        try:
            with open(doc.filepath, "rb") as f:
                file_bytes = f.read()
        except Exception as read_err:
            raise HTTPException(status_code=500, detail=f"Failed to read local file: {str(read_err)}")

    if doc.filetype == "text/plain":
        try:
            content = file_bytes.decode("utf-8", errors="ignore")[:50 * 1024]
            return {"type": "txt", "content": content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read text file: {str(e)}")

    elif doc.filetype == "application/pdf":
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            meta = reader.metadata
            pages = len(reader.pages)
            
            pdf_meta = {}
            if meta:
                for key, val in meta.items():
                    clean_key = key.lstrip("/")
                    pdf_meta[clean_key] = str(val) if val else ""
            
            return {
                "type": "pdf",
                "pages": pages,
                "metadata": pdf_meta
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF metadata: {str(e)}")

    elif doc.filetype.startswith("image/"):
        return {"type": "image", "url": f"/api/files/{id}/raw"}

    else:
        return {"type": "generic", "message": "Preview not supported for this file type"}

@router.delete("")
def delete_all_files(db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Deletes all uploaded files from storage/Cloudinary and database."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    for doc in docs:
        if doc.filepath and doc.filepath.startswith("http"):
            try:
                from app.services.cloudinary_service import CloudinaryService
                CloudinaryService.delete_file(doc.filepath)
            except Exception:
                pass
        elif doc.filepath and os.path.exists(doc.filepath):
            try:
                os.remove(doc.filepath)
            except Exception:
                pass
        # Delete associated vectors from ChromaDB
        VectorStoreService.delete_document(doc.id)
        db.delete(doc)
    db.commit()
    return {"message": "All uploaded files deleted successfully"}

@router.post("/import-demo")
async def import_demo_dataset(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    # Check if demo files already exist in DB to prevent duplicates
    existing = db.query(Document).filter(
        Document.user_id == current_user.id,
        Document.filename.in_([
            "Csyrus_ML_Research_Project.txt",
            "Csyrus_Internship_Offer_Letter.txt",
            "AWS_Cloud_Architect_Certification.txt"
        ])
    ).first()
    if existing:
        return {"message": "Demo dataset has already been imported."}

    demo_docs = [
        {
            "filename": "Csyrus_ML_Research_Project.txt",
            "content": (
                "Project Report: Neural Network Architecture for Predictive Analysis\n"
                "Author: Zahid Hamdule (AI Research Lead)\n"
                "Location: Mumbai, India\n"
                "Skills: Python, PyTorch, NumPy, Git\n\n"
                "Abstract: This project details the design and deployment of a 12-layer convolutional neural network "
                "optimized for predictive maintenance in industrial IoT environments. The model was trained "
                "on a dataset of 50,000 telemetry logs and achieved a 94.2% accuracy score in predicting equipment failures.\n"
                "Teammates: Jane Doe (Data Engineer) and John Smith (DevOps Lead).\n"
                "Outcome: Accepted for publication in the International Journal of Neural Engineering."
            )
        },
        {
            "filename": "Csyrus_Internship_Offer_Letter.txt",
            "content": (
                "TechCorp Inc. - Internship Offer Letter\n"
                "Recipient: Zahid Hamdule\n"
                "Role: AI Engineer Intern\n"
                "Location: San Francisco, CA\n"
                "Term: June 1, 2026 to August 31, 2026\n"
                "Compensation: $45.00 per hour\n"
                "Key Projects: Building conversational search engines and RAG pipelines for knowledge bases.\n"
                "Confidentiality: Subject to standard NDA policies."
            )
        },
        {
            "filename": "AWS_Cloud_Architect_Certification.txt",
            "content": (
                "Amazon Web Services (AWS) - Certificate of Completion\n"
                "Recipient: Zahid Hamdule\n"
                "Credential: AWS Certified Solutions Architect - Associate\n"
                "Issued: March 15, 2026\n"
                "Skills: AWS Cloud, EC2, S3, IAM, Cloud Security, System Architecture\n"
                "Validation Number: AWS-99882211-XYZ"
            )
        }
    ]

    imported = []
    for doc in demo_docs:
        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}_{doc['filename']}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        # Write content to local file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(doc["content"])
            
        file_size = os.path.getsize(file_path)

        # Determine demo category
        demo_cat = "General"
        if "Project" in doc["filename"]:
            demo_cat = "Projects"
        elif "Internship" in doc["filename"]:
            demo_cat = "Internships"
        elif "Certification" in doc["filename"]:
            demo_cat = "Certifications"

        new_doc = Document(
            id=file_id,
            user_id=current_user.id,
            filename=doc["filename"],
            filepath=file_path,
            filetype="text/plain",
            filesize=file_size,
            category=demo_cat,
            status="Queued"
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        
        # Trigger background text extraction pipeline
        background_tasks.add_task(
            ExtractionService.run_extraction_task,
            file_path,
            "text/plain",
            file_id,
            current_user.id
        )
        
        imported.append({
            "id": file_id,
            "filename": doc["filename"],
            "status": "success"
        })

    return {"message": "Importing demo dataset in the background...", "results": imported}


# ─────────────────────────────────────────────────────────────────────────────
# Document Status & Retry Router
# ─────────────────────────────────────────────────────────────────────────────
doc_router = APIRouter(prefix="/api/documents", tags=["documents"])

@doc_router.get("/{id}/status")
def get_document_status(id: str, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """Returns the processing status of a specific document."""
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status or "Queued",
        "error_message": doc.error_message
    }

@doc_router.post("/{id}/retry")
def retry_document_processing(
    id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Retries processing for a failed document."""
    doc = db.query(Document).filter(Document.id == id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Reset status to Queued and clear error message
    doc.status = "Queued"
    doc.error_message = None
    db.add(doc)
    db.commit()
    
    # Re-queue background task
    background_tasks.add_task(
        ExtractionService.run_extraction_task,
        doc.filepath,
        doc.filetype,
        doc.id,
        current_user.id
    )
    
    return {"message": "Processing retried successfully", "status": "Queued"}

