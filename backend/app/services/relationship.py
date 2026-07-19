from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.graph import GraphNodeModel, GraphEdgeModel
from app.models.document import Document
from datetime import datetime

class RelationshipService:
    @staticmethod
    def process_document_relationships(db: Session, document_id: str, title: str, metadata: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """
        Processes extracted metadata from a document and generates relationships:
        - Person -> Document (mentioned_in)
        - Location -> Document (located_at)
        - Tag -> Document (about)
        - Organization -> Document (associated_with)
        """
        # 1. Create document node
        doc_node_id = f"document_{document_id}"
        doc_node = RelationshipService._get_or_create_node(db, doc_node_id, title, "Document", user_id)

        # Extract entities from metadata
        people = metadata.get("people", [])
        organizations = metadata.get("organizations", [])
        locations = metadata.get("locations", [])
        tags = metadata.get("tags", [])

        # Normalize and ensure clean lists
        people = [p.strip() for p in people if p]
        organizations = [o.strip() for o in organizations if o]
        locations = [l.strip() for l in locations if l]
        tags = [t.strip() for t in tags if t]

        nodes = []
        # Create entity nodes
        for p in people:
            nodes.append(RelationshipService._get_or_create_node(db, f"{user_id}_person_{p.lower().replace(' ', '_')}", p, "Person", user_id))
        for o in organizations:
            nodes.append(RelationshipService._get_or_create_node(db, f"{user_id}_organization_{o.lower().replace(' ', '_')}", o, "Organization", user_id))
        for l in locations:
            nodes.append(RelationshipService._get_or_create_node(db, f"{user_id}_location_{l.lower().replace(' ', '_')}", l, "Location", user_id))
        for t in tags:
            nodes.append(RelationshipService._get_or_create_node(db, f"{user_id}_tag_{t.lower().replace(' ', '_')}", t, "Tag", user_id))

        # Create relationship edges
        # Person -> Document (mentioned_in)
        for p in people:
            p_node_id = f"{user_id}_person_{p.lower().replace(' ', '_')}"
            RelationshipService._create_or_update_edge(db, p_node_id, doc_node_id, "mentioned_in", user_id)

        # Location -> Document (located_at)
        for l in locations:
            l_node_id = f"{user_id}_location_{l.lower().replace(' ', '_')}"
            RelationshipService._create_or_update_edge(db, l_node_id, doc_node_id, "located_at", user_id)

        # Tag -> Document (about)
        for t in tags:
            t_node_id = f"{user_id}_tag_{t.lower().replace(' ', '_')}"
            RelationshipService._create_or_update_edge(db, t_node_id, doc_node_id, "about", user_id)

        # Organization -> Document (associated_with)
        for o in organizations:
            o_node_id = f"{user_id}_organization_{o.lower().replace(' ', '_')}"
            RelationshipService._create_or_update_edge(db, o_node_id, doc_node_id, "associated_with", user_id)

        db.commit()

        return {"status": "success", "nodes_count": len(nodes) + 1}

    @staticmethod
    def get_visualization_data(db: Session, user_id: str = None) -> Dict[str, Any]:
        """
        Generates dynamic nodes and edges based on real DB entities and relationships.
        """
        db_nodes = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user_id).all()
        db_edges = db.query(GraphEdgeModel).filter(GraphEdgeModel.user_id == user_id).all()
        
        nodes = []
        for n in db_nodes:
            nodes.append({
                "id": n.id,
                "name": n.name,
                "type": n.type,
                "created_at": n.created_at.isoformat() if n.created_at else None
            })
            
        edges = []
        for e in db_edges:
            edges.append({
                "id": f"edge_{e.id}",
                "source": e.source_id,
                "target": e.target_id,
                "type": e.type,
                "weight": e.weight
            })
            
        return {
            "nodes": nodes,
            "edges": edges
        }

    @staticmethod
    def _get_or_create_node(db: Session, node_id: str, name: str, node_type: str, user_id: str = None) -> GraphNodeModel:
        node = db.query(GraphNodeModel).filter(
            GraphNodeModel.id == node_id,
            GraphNodeModel.user_id == user_id
        ).first()
        if not node:
            node = GraphNodeModel(id=node_id, name=name, type=node_type, user_id=user_id)
            db.add(node)
            db.flush()
        return node

    @staticmethod
    def _create_or_update_edge(db: Session, source_id: str, target_id: str, edge_type: str, user_id: str = None):
        # Prevent self loops
        if source_id == target_id:
            return

        edge = db.query(GraphEdgeModel).filter(
            GraphEdgeModel.source_id == source_id,
            GraphEdgeModel.target_id == target_id,
            GraphEdgeModel.type == edge_type,
            GraphEdgeModel.user_id == user_id
        ).first()

        if edge:
            # Increment weight for frequent connection reinforcement
            edge.weight += 0.5
        else:
            edge = GraphEdgeModel(
                user_id=user_id,
                source_id=source_id,
                target_id=target_id,
                type=edge_type,
                weight=1.0
            )
            db.add(edge)
        db.flush()
