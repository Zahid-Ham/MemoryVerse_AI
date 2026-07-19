from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer
from datetime import datetime
from app.database.connection import Base

class GraphNodeModel(Base):
    __tablename__ = "graph_nodes"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, index=True)
    type = Column(String, index=True)  # Person, Organization, Location, Event, Document, Topic
    created_at = Column(DateTime, default=datetime.utcnow)

class GraphEdgeModel(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_id = Column(String, ForeignKey("graph_nodes.id", ondelete="CASCADE"), index=True)
    target_id = Column(String, ForeignKey("graph_nodes.id", ondelete="CASCADE"), index=True)
    type = Column(String)  # e.g., "associated_with", "mentioned_in", "located_at"
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
