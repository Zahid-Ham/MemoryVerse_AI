import os
import uuid
import logging
from datetime import datetime
from app.database.connection import SessionLocal
from app.models.document import DocumentContent
from app.services.extractor import ExtractorService
from app.services.chunk_service import ChunkService
from app.services.groq_metadata_service import GroqMetadataService
from app.services.relationship import RelationshipService

logger = logging.getLogger(__name__)

class ExtractionService:
    @staticmethod
    def run_extraction_task(file_path: str, content_type: str, document_id: str, user_id: str = None):
        """
        Background task to extract text from an uploaded file and persist it.
        """
        db = SessionLocal()
        from app.models.document import Document
        try:
            # Set initial status to Extracting Text
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "Extracting Text"
                db.commit()

            # Extract raw text using ExtractorService
            raw_text = ExtractorService.extract_text(file_path, content_type)
            text_length = len(raw_text) if raw_text else 0
            
            # Persist to database
            content_record = DocumentContent(
                id=str(uuid.uuid4()),
                user_id=user_id,
                document_id=document_id,
                raw_text=raw_text,
                text_length=text_length,
                extracted_at=datetime.utcnow()
            )
            
            db.add(content_record)
            db.commit()

            # Trigger text segment chunking and persistence
            if raw_text:
                ChunkService.chunk_and_persist(db, document_id, raw_text, user_id=user_id)
                try:
                    from app.services.embedding_service import EmbeddingService
                    EmbeddingService.generate_and_index_document(db, document_id, user_id=user_id)
                except Exception as embedding_error:
                    logger.error(f"Embedding generation failed for document {document_id}: {str(embedding_error)}", exc_info=True)
                    raise embedding_error
            
            # Trigger metadata generation using Groq LLM
            filename = os.path.basename(file_path).split('_', 1)[-1]  # Strip unique prefix
            try:
                # Update status to Generating Metadata
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc:
                    doc.status = "Generating Metadata"
                    db.commit()

                meta_res = GroqMetadataService.extract_and_persist(db, document_id, raw_text, filename, user_id=user_id)
                
                # Trigger Relationship Engine V1 processing
                RelationshipService.process_document_relationships(
                    db=db,
                    document_id=document_id,
                    title=meta_res.get("title", filename),
                    metadata=meta_res,
                    user_id=user_id
                )
            except Exception as metadata_error:
                # Store metadata errors in logs (failures should not break upload/ingestion)
                logger.error(f"Metadata and relationship generation failed for document {document_id}: {str(metadata_error)}", exc_info=True)
                raise metadata_error
            
            # Upload to Cloudinary and clean up local temporary storage
            try:
                from app.services.cloudinary_service import CloudinaryService
                cloudinary_url = CloudinaryService.upload_file(file_path, filename)
                if cloudinary_url:
                    doc = db.query(Document).filter(Document.id == document_id).first()
                    if doc:
                        doc.filepath = cloudinary_url
                    
                    from app.models.document import DocumentModel
                    doc_model = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
                    if doc_model:
                        doc_model.file_path = cloudinary_url
                    
                    db.commit()
                    
                    # Remove the local temporary file
                    if os.path.exists(file_path):
                        os.remove(file_path)
            except Exception as upload_err:
                logger.error(f"Cloudinary upload/cleanup failed for {document_id}: {str(upload_err)}", exc_info=True)

            # Update status to Completed
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "Completed"
                db.commit()

            return {
                "document_id": document_id,
                "text_length": text_length,
                "extraction_status": "success"
            }
        except Exception as e:
            # Store extraction errors in logs (Rule: Failures should not break upload)
            logger.error(f"Text extraction failed for document {document_id}: {str(e)}", exc_info=True)
            db.rollback()
            try:
                doc = db.query(Document).filter(Document.id == document_id).first()
                if doc:
                    doc.status = "Failed"
                    doc.error_message = str(e)
                    db.commit()
            except Exception as status_err:
                logger.error(f"Failed to set status to Failed for document {document_id}: {status_err}")
            return {
                "document_id": document_id,
                "text_length": 0,
                "extraction_status": "failed"
            }
        finally:
            db.close()
