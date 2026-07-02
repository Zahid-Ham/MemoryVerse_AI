from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, Float
from datetime import datetime
from app.database.connection import Base

class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    content_type = Column(String)
    size = Column(Integer)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    # Cached Metadata (Extracted via Groq)
    title = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)          # List of strings
    topics = Column(JSON, nullable=True)        # List of strings
    people = Column(JSON, nullable=True)        # List of strings
    organizations = Column(JSON, nullable=True) # List of strings
    locations = Column(JSON, nullable=True)     # List of strings
    emotions = Column(JSON, nullable=True)      # List of strings
    category = Column(String, nullable=True)    # Projects, Skills, Certifications, Internships, Achievements, Academics, General

class Document(Base):
    __tablename__ = "document"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, index=True)
    filepath = Column(String)
    filetype = Column(String)
    filesize = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    category = Column(String, nullable=True)    # Projects, Skills, Certifications, Internships, Achievements, Academics, General
    status = Column(String, default="Queued")    # Queued, Uploading, Extracting Text, Generating Metadata, Creating Embeddings, Indexing, Completed, Failed
    error_message = Column(String, nullable=True)


class DocumentContent(Base):
    __tablename__ = "document_content"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, index=True)
    raw_text = Column(Text)
    text_length = Column(Integer)
    extracted_at = Column(DateTime, default=datetime.utcnow)


class DocumentChunk(Base):
    __tablename__ = "document_chunk"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, index=True)
    chunk_index = Column(Integer)
    chunk_text = Column(Text)
    chunk_length = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentMetadata(Base):
    __tablename__ = "document_metadata"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, index=True)
    title = Column(String)
    summary = Column(Text)
    tags = Column(String)
    people = Column(String)
    organizations = Column(String)
    locations = Column(String)
    emotions = Column(String)
    category = Column(String, nullable=True)    # Projects, Skills, Certifications, Internships, Achievements, Academics, General
    generated_at = Column(DateTime, default=datetime.utcnow)


class DocumentEmbeddingStatus(Base):
    __tablename__ = "document_embedding_status"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, index=True)
    status = Column(String, default="pending")  # pending, completed, failed
    model_name = Column(String)
    chunks_embedded = Column(Integer, default=0)
    embedded_at = Column(DateTime, default=datetime.utcnow)


class RAGCache(Base):
    __tablename__ = "rag_cache"

    id = Column(String, primary_key=True, index=True)
    query = Column(String, index=True)
    answer = Column(Text)
    sources = Column(Text)              # JSON string
    confidence_score = Column(Float)
    follow_up_questions = Column(Text)  # JSON string
    cached_at = Column(DateTime, default=datetime.utcnow)






