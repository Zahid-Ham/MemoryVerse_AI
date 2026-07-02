from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.database.connection import get_db
from app.models.graph import GraphNodeModel, GraphEdgeModel
from app.models.document import Document, DocumentMetadata
from app.utils.key_manager import GroqKeyManager
import json

router = APIRouter(prefix="/api/graph", tags=["graph"])

CATEGORY_TYPES = {
    "Documents": "Document",
    "People": "Person",
    "Locations": "Location",
    "Organizations": "Organization",
    "Topics": "Tag",
    "Emotions": "Emotion",
}

# ─────────────────────────────────────────────────────────────────────────────
# Level 0 — Root: just the 6 category buckets with counts
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/root")
def get_root(db: Session = Depends(get_db)):
    """Returns the root node and 6 category nodes with entity counts."""
    categories = []
    for label, db_type in CATEGORY_TYPES.items():
        count = db.query(GraphNodeModel).filter(GraphNodeModel.type == db_type).count()
        categories.append({
            "id": f"cat_{label.lower()}",
            "label": label,
            "type": "Category",
            "entity_type": db_type,
            "count": count,
        })
    return {
        "root": {"id": "root_memoryverse", "label": "MemoryVerse", "type": "Root"},
        "categories": categories,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Level 1 — Expand a category → its entity nodes
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/expand/{category_id}")
def expand_category(category_id: str, db: Session = Depends(get_db)):
    """
    Given a category_id like 'cat_people', returns all entity nodes of that type.
    """
    # Map category_id back to DB type
    label = category_id.replace("cat_", "").capitalize()
    # Handle plurals: people -> People
    label_map = {v.lower().replace("cat_", ""): k for k, v in {l: f"cat_{l.lower()}" for l in CATEGORY_TYPES}.items()}
    
    # Direct lookup from our map
    entity_type = None
    for cat_label, db_type in CATEGORY_TYPES.items():
        if category_id == f"cat_{cat_label.lower()}":
            entity_type = db_type
            break

    if not entity_type:
        raise HTTPException(status_code=404, detail=f"Unknown category: {category_id}")

    nodes = db.query(GraphNodeModel).filter(GraphNodeModel.type == entity_type).all()

    # For each node, count its edge connections
    result = []
    for n in nodes:
        edge_count = db.query(GraphEdgeModel).filter(
            (GraphEdgeModel.source_id == n.id) | (GraphEdgeModel.target_id == n.id)
        ).count()
        result.append({
            "id": n.id,
            "label": n.name,
            "type": entity_type,
            "edge_count": edge_count,
        })

    return {"category_id": category_id, "entity_type": entity_type, "nodes": result}


# ─────────────────────────────────────────────────────────────────────────────
# Level 2 — Expand an entity node → related docs + connected entities
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/node/{node_id}")
def get_node_children(node_id: str, db: Session = Depends(get_db)):
    """
    Returns all edges connected to a node, and the nodes at both ends.
    This powers Level 2 expansion and the Side Panel.
    """
    node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail=f"Node not found: {node_id}")

    # Edges where this node is source OR target
    out_edges = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id == node_id).all()
    in_edges  = db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id == node_id).all()

    connected_ids = set()
    edges_out = []
    for e in out_edges:
        connected_ids.add(e.target_id)
        edges_out.append({"id": f"e_{e.id}", "source": e.source_id, "target": e.target_id,
                          "type": e.type, "weight": e.weight})
    for e in in_edges:
        connected_ids.add(e.source_id)
        edges_out.append({"id": f"e_{e.id}", "source": e.source_id, "target": e.target_id,
                          "type": e.type, "weight": e.weight})

    # Fetch the connected nodes
    connected_nodes = db.query(GraphNodeModel).filter(GraphNodeModel.id.in_(connected_ids)).all()

    nodes_out = [{
        "id": n.id, "label": n.name, "type": n.type,
        "edge_count": db.query(GraphEdgeModel).filter(
            (GraphEdgeModel.source_id == n.id) | (GraphEdgeModel.target_id == n.id)
        ).count()
    } for n in connected_nodes]

    # Add the node itself
    nodes_out.insert(0, {
        "id": node.id, "label": node.name, "type": node.type,
        "edge_count": len(out_edges) + len(in_edges)
    })

    # Enrich document nodes with metadata
    doc_ids = [n["id"] for n in nodes_out if n["type"] == "Document"]
    doc_meta_map = {}
    if doc_ids:
        # strip "document_" prefix to get real doc id
        real_ids = [did.replace("document_", "") for did in doc_ids]
        metas = db.query(DocumentMetadata).filter(DocumentMetadata.document_id.in_(real_ids)).all()
        for m in metas:
            doc_meta_map[f"document_{m.document_id}"] = {
                "title": m.title, "summary": m.summary
            }

    for n in nodes_out:
        if n["id"] in doc_meta_map:
            n["meta"] = doc_meta_map[n["id"]]

    return {
        "node": {"id": node.id, "label": node.name, "type": node.type},
        "nodes": nodes_out,
        "edges": edges_out,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Side Panel — Full node detail for the right drawer
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/detail/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(get_db)):
    """Returns rich detail for a node: counts, related docs, connected entities."""
    node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    out_edges = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id == node_id).all()
    in_edges  = db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id == node_id).all()
    all_edges = out_edges + in_edges

    connected_ids = list({e.target_id for e in out_edges} | {e.source_id for e in in_edges} - {node_id})
    connected_nodes = db.query(GraphNodeModel).filter(GraphNodeModel.id.in_(connected_ids)).all()

    doc_nodes    = [n for n in connected_nodes if n.type == "Document"]
    entity_nodes = [n for n in connected_nodes if n.type != "Document"]

    # Get doc titles from metadata
    doc_details = []
    for dn in doc_nodes:
        real_id = dn.id.replace("document_", "")
        meta = db.query(DocumentMetadata).filter(DocumentMetadata.document_id == real_id).first()
        doc_details.append({
            "id": dn.id,
            "filename": dn.name,
            "title": meta.title if meta else dn.name,
            "summary": meta.summary if meta else "",
        })

    return {
        "node": {"id": node.id, "name": node.name, "type": node.type},
        "stats": {
            "total_connections": len(all_edges),
            "document_count": len(doc_nodes),
            "entity_count": len(entity_nodes),
        },
        "documents": doc_details,
        "connected_entities": [{"id": n.id, "name": n.name, "type": n.type} for n in entity_nodes],
    }


# ─────────────────────────────────────────────────────────────────────────────
# AI Summary — Groq generates a natural language insight for a node
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/summary/{node_id}")
def get_node_summary(node_id: str, db: Session = Depends(get_db)):
    """Uses Groq to generate a natural language relationship summary for a node."""
    node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    out_edges = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id == node_id).all()
    in_edges  = db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id == node_id).all()
    all_connected_ids = list({e.target_id for e in out_edges} | {e.source_id for e in in_edges} - {node_id})
    connected_nodes = db.query(GraphNodeModel).filter(GraphNodeModel.id.in_(all_connected_ids)).all()

    doc_count    = sum(1 for n in connected_nodes if n.type == "Document")
    entity_names = [n.name for n in connected_nodes if n.type != "Document"]
    doc_names    = [n.name for n in connected_nodes if n.type == "Document"]

    # Build a concise prompt
    prompt = (
        f"You are a knowledge graph assistant. Generate a single, concise, insightful sentence "
        f"(max 30 words) describing the role of '{node.name}' (type: {node.type}) in a personal "
        f"knowledge base. It appears in {doc_count} document(s): {', '.join(doc_names[:5])}. "
        f"It is connected to: {', '.join(entity_names[:8])}. "
        f"Be specific and natural, not generic. No bullet points."
    )

    try:
        km = GroqKeyManager()
        def _call(client):
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=80,
                temperature=0.6,
            )
            return resp.choices[0].message.content.strip()

        summary = km.execute_with_fallback(_call)
    except Exception as e:
        summary = f"{node.name} is connected to {doc_count} documents and {len(entity_names)} entities in your knowledge graph."

    return {"node_id": node_id, "summary": summary}


# ─────────────────────────────────────────────────────────────────────────────
# Search — find nodes by name substring
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/search")
def search_nodes(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Fuzzy name search across all graph nodes."""
    nodes = db.query(GraphNodeModel).filter(
        GraphNodeModel.name.ilike(f"%{q}%")
    ).limit(20).all()

    return [{"id": n.id, "label": n.name, "type": n.type} for n in nodes]


# ─────────────────────────────────────────────────────────────────────────────
# Legacy compatibility endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.get("")
def get_graph_root(db: Session = Depends(get_db)):
    return get_graph_legacy(db)

@router.get("/visualization")
def get_graph_legacy(db: Session = Depends(get_db)):
    """Legacy endpoint kept for backward compatibility."""
    from app.services.relationship import RelationshipService
    return RelationshipService.get_visualization_data(db)
