import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentMetadata

logger = logging.getLogger(__name__)

class VectorStoreService:
    _collection = None
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            import chromadb
            persist_dir = os.path.abspath("./chroma_db")
            cls._client = chromadb.PersistentClient(path=persist_dir)
        return cls._client

    @classmethod
    def get_collection(cls):
        if cls._collection is None:
            client = cls.get_client()
            cls._collection = client.get_or_create_collection(name="memoryverse_documents")
        return cls._collection

    @classmethod
    def create_collection(cls):
        """Ensures the memoryverse_documents collection is created."""
        return cls.get_collection()

    @classmethod
    def insert_chunks(cls, db: Session, document_id: str, chunks: List[Any], embeddings: List[List[float]]):
        """
        Inserts document chunks and embeddings with full metadata.
        Prevents duplicates by deleting existing document chunks from ChromaDB first.
        """
        collection = cls.get_collection()

        # 1. Prevent duplicate indexing by deleting existing vectors for this document
        cls.delete_document(document_id)

        if not chunks or not embeddings:
            logger.warning(f"No chunks or embeddings to index for document {document_id}")
            return

        # 2. Fetch document metadata from SQLite
        doc = db.query(Document).filter(Document.id == document_id).first()
        meta = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == document_id).first()

        filename = doc.filename if doc else "unknown"
        document_type = doc.filetype if doc else "unknown"
        title = meta.title if (meta and meta.title) else filename
        tags = meta.tags if (meta and meta.tags) else ""
        people = meta.people if (meta and meta.people) else ""
        locations = meta.locations if (meta and meta.locations) else ""
        organizations = meta.organizations if (meta and meta.organizations) else ""
        emotions = meta.emotions if (meta and meta.emotions) else ""
        uploaded_at = doc.uploaded_at.isoformat() if (doc and doc.uploaded_at) else datetime.utcnow().isoformat()

        documents_list = []
        embeddings_list = []
        metadatas_list = []
        ids_list = []

        for idx, chunk in enumerate(chunks):
            chunk_id = f"{document_id}_chunk_{chunk.chunk_index}"
            
            documents_list.append(chunk.chunk_text)
            embeddings_list.append(embeddings[idx])
            ids_list.append(chunk_id)
            
            metadatas_list.append({
                "document_id": document_id,
                "chunk_id": chunk_id,
                "chunk_index": chunk.chunk_index,
                "filename": filename,
                "document_type": document_type,
                "title": title,
                "tags": tags,
                "people": people,
                "locations": locations,
                "organizations": organizations,
                "emotions": emotions,
                "uploaded_at": uploaded_at
            })

        # 3. Add to ChromaDB collection
        collection.add(
            documents=documents_list,
            embeddings=embeddings_list,
            metadatas=metadatas_list,
            ids=ids_list
        )
        logger.info(f"Indexed {len(documents_list)} chunks for document {document_id} in ChromaDB.")

    @classmethod
    def delete_document(cls, document_id: str):
        """Removes all vectors / chunks associated with a document_id."""
        collection = cls.get_collection()
        try:
            collection.delete(where={"document_id": document_id})
            logger.info(f"Deleted vectors for document {document_id} from ChromaDB.")
        except Exception as e:
            logger.error(f"Error deleting vectors for document {document_id}: {str(e)}", exc_info=True)

    @classmethod
    def reset_store(cls):
        """Deletes the entire collection from ChromaDB to clear all stored vectors."""
        try:
            client = cls.get_client()
            client.delete_collection("memoryverse_documents")
            cls._collection = None
            logger.info("ChromaDB collection 'memoryverse_documents' deleted successfully.")
        except Exception as e:
            logger.error(f"Error resetting ChromaDB collection: {str(e)}", exc_info=True)

    @classmethod
    def update_document(cls, db: Session, document_id: str, chunks: List[Any], embeddings: List[List[float]]):
        """Updates a document's vector store index by replacing existing vectors."""
        cls.insert_chunks(db, document_id, chunks, embeddings)

    @classmethod
    def query_similar_chunks(cls, query_embedding: List[float], n_results: int = 5, filter_dict: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Queries the vector store for similar chunks using a query embedding."""
        collection = cls.get_collection()
        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=filter_dict
            )
            return results
        except Exception as e:
            logger.error(f"Vector search query failed: {str(e)}", exc_info=True)
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Compiles stats for the memoryverse_documents index."""
        collection = cls.get_collection()
        try:
            count = collection.count()
            return {
                "collection_name": "memoryverse_documents",
                "total_chunks": count,
                "status": "healthy"
            }
        except Exception as e:
            logger.error(f"Failed to fetch index stats: {str(e)}", exc_info=True)
            return {
                "collection_name": "memoryverse_documents",
                "total_chunks": 0,
                "status": f"unhealthy: {str(e)}"
            }
