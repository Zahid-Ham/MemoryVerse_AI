import React, {
  useState, useEffect, useCallback, useRef
} from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  ReactFlowProvider, useReactFlow,
  useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronRight, RefreshCw,
  ZoomIn, Maximize2, Info, Network,
  Eye, EyeOff, Layers
} from 'lucide-react';
import { nodeTypes } from '../components/graph/GraphNodes';
import GraphSidePanel from '../components/graph/GraphSidePanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Layout helpers ──────────────────────────────────────────────────────────
const RADIAL_ANGLES = {
  cat_documents:     -90,
  cat_people:        -30,
  cat_locations:      30,
  cat_organizations:  90,
  cat_topics:        150,
  cat_emotions:      210,
};

function radialPos(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 500 + radius * Math.cos(rad), y: 400 + radius * Math.sin(rad) };
}

function childPositionsOutward(centerX, centerY, parentAngleDeg, count, radius = 160) {
  if (count === 0) return [];
  
  // Allocate nodes into concentric tiers to prevent cramming
  const capacities = [5, 8, 12, 16, 20];
  const rowAllocations = [];
  let currentRow = [];
  let currentTierIndex = 0;
  
  for (let i = 0; i < count; i++) {
    currentRow.push(i);
    const limit = capacities[currentTierIndex] || 25;
    if (currentRow.length === limit || i === count - 1) {
      rowAllocations.push(currentRow);
      currentRow = [];
      currentTierIndex++;
    }
  }

  const positions = new Array(count);
  const parentAngleRad = (parentAngleDeg * Math.PI) / 180;

  rowAllocations.forEach((rowIndices, tier) => {
    const rowNodesCount = rowIndices.length;
    const tierRadius = radius + tier * 95; // 95px spacing between concentric layers
    
    // Spread nodes in an outward facing arc
    const arcSpan = Math.min(110, 45 + rowNodesCount * 10);
    const startAngle = parentAngleRad - ((arcSpan / 2) * Math.PI) / 180;
    
    rowIndices.forEach((nodeIndex, indexInRow) => {
      let angle;
      if (rowNodesCount === 1) {
        angle = parentAngleRad;
      } else {
        const step = (arcSpan * Math.PI) / 180 / (rowNodesCount - 1);
        angle = startAngle + indexInRow * step;
      }
      
      positions[nodeIndex] = {
        x: centerX + tierRadius * Math.cos(angle),
        y: centerY + tierRadius * Math.sin(angle)
      };
    });
  });

  return positions;
}

function childPositionsCone(centerX, centerY, parentAngleRad, count, radius = 130) {
  if (count === 0) return [];

  // Cone capacities per concentric tier
  const capacities = [3, 5, 8, 10];
  const rowAllocations = [];
  let currentRow = [];
  let currentTierIndex = 0;
  
  for (let i = 0; i < count; i++) {
    currentRow.push(i);
    const limit = capacities[currentTierIndex] || 12;
    if (currentRow.length === limit || i === count - 1) {
      rowAllocations.push(currentRow);
      currentRow = [];
      currentTierIndex++;
    }
  }

  const positions = new Array(count);

  rowAllocations.forEach((rowIndices, tier) => {
    const rowNodesCount = rowIndices.length;
    const tierRadius = radius + tier * 85; // 85px spacing between sub-tiers
    
    const arcSpan = Math.min(85, 30 + rowNodesCount * 12);
    const startAngle = parentAngleRad - ((arcSpan / 2) * Math.PI) / 180;
    
    rowIndices.forEach((nodeIndex, indexInRow) => {
      let angle;
      if (rowNodesCount === 1) {
        angle = parentAngleRad;
      } else {
        const step = (arcSpan * Math.PI) / 180 / (rowNodesCount - 1);
        angle = startAngle + indexInRow * step;
      }
      
      positions[nodeIndex] = {
        x: centerX + tierRadius * Math.cos(angle),
        y: centerY + tierRadius * Math.sin(angle)
      };
    });
  });

  return positions;
}

// Edge style per relationship type
function edgeStyle(edgeType, weight = 1) {
  const thickness = Math.min(1 + weight * 0.4, 4);
  if (edgeType === 'mentioned_in') {
    return { strokeWidth: thickness, stroke: '#10b981', strokeDasharray: undefined };
  }
  if (edgeType === 'about') {
    return { strokeWidth: thickness, stroke: '#38bdf8', strokeDasharray: '6 3' };
  }
  if (edgeType === 'located_at') {
    return { strokeWidth: thickness, stroke: '#f97316', strokeDasharray: '2 3' };
  }
  if (edgeType === 'associated_with') {
    return { strokeWidth: thickness, stroke: '#a78bfa', strokeDasharray: undefined };
  }
  return { strokeWidth: thickness, stroke: '#94a3b8' };
}

// ─── Main canvas (inner – has access to useReactFlow) ─────────────────────
function RelationshipsCanvas() {
  const { fitView, setCenter, getNode } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedEntities,   setExpandedEntities]   = useState(new Set());
  const [selectedNode,       setSelectedNode]        = useState(null);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [focusMode,     setFocusMode]     = useState(false);
  const [breadcrumbs,   setBreadcrumbs]   = useState([]);

  // State of root + category data
  const rootDataRef       = useRef(null);
  const categoryDataRef   = useRef({});   // categoryId → {nodes:[]}
  const entityDataRef     = useRef({});   // entityId   → {nodes:[], edges:[]}
  const customPositionsRef = useRef({});   // stores dragged position offsets: { nodeId: { x, y } }

  const onNodesChangeCustom = useCallback((changes) => {
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        customPositionsRef.current[change.id] = change.position;
      }
    });
    onNodesChange(changes);
  }, [onNodesChange]);

  // ── Build nodes/edges from current expansion state ──────────────────────
  const rebuildGraph = useCallback(() => {
    const rd = rootDataRef.current;
    if (!rd) return;

    const newNodes = [];
    const newEdges = [];
    // Track node IDs added so we can guard edges later
    const nodeIdSet = new Set();

    const addNode = (n) => { newNodes.push(n); nodeIdSet.add(n.id); };
    const addEdge = (e) => { newEdges.push(e); };

    // Retrieve manual drag position if cached, otherwise use calculated position
    const getPosition = (nodeId, defaultPos) => {
      return customPositionsRef.current[nodeId] || defaultPos;
    };

    // Root node
    addNode({
      id:   'root_memoryverse',
      type: 'root',
      position: getPosition('root_memoryverse', { x: 462, y: 362 }),
      data: {
        label: 'MemoryVerse',
        onClick: () => handleRootClick(),
        focused: selectedNode?.id === 'root_memoryverse',
      },
      draggable: true,
    });

    // Category nodes
    rd.categories.forEach(cat => {
      const angle = RADIAL_ANGLES[cat.id] ?? 0;
      const pos   = radialPos(angle, 350);
      const isExpanded = expandedCategories.has(cat.id);

      addNode({
        id:   cat.id,
        type: 'category',
        position: getPosition(cat.id, pos),
        data: {
          label:    cat.label,
          count:    cat.count,
          expanded: isExpanded,
          onClick:  () => handleCategoryClick(cat),
          faded: focusMode && selectedNode?.id !== cat.id,
        },
        draggable: true,
      });

      addEdge({
        id:     `root-${cat.id}`,
        source: 'root_memoryverse',
        target: cat.id,
        style:  { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.5 },
        animated: false,
      });

      // If this category is expanded, add its entity children
      if (isExpanded && categoryDataRef.current[cat.id]) {
        const catNodes = categoryDataRef.current[cat.id].nodes;
        const catPos   = pos;
        const positions = childPositionsOutward(catPos.x, catPos.y, angle, catNodes.length, 160);

        catNodes.forEach((en, i) => {
          const ePos = positions[i];
          const isEntityExpanded = expandedEntities.has(en.id);
          const isSelected = selectedNode?.id === en.id;

          addNode({
            id:   en.id,
            type: en.type,
            position: getPosition(en.id, ePos),
            data: {
              label:    en.label,
              selected: isSelected,
              faded: focusMode && !isSelected && selectedNode?.id !== cat.id,
              onClick:  () => handleEntityClick(en, ePos),
            },
            draggable: true,
          });

          addEdge({
            id:     `${cat.id}-${en.id}`,
            source: cat.id,
            target: en.id,
            style:  { stroke: '#475569', strokeWidth: 1, opacity: 0.6 },
            animated: isEntityExpanded,
          });

          // If this entity is expanded, show its L2 connections
          if (isEntityExpanded && entityDataRef.current[en.id]) {
            const { nodes: l2nodes, edges: l2edges } = entityDataRef.current[en.id];
            const l2nodesFiltered = l2nodes.filter(n => n.id !== en.id);
            const parentAngleRad = Math.atan2(ePos.y - catPos.y, ePos.x - catPos.x);
            const l2Positions = childPositionsCone(ePos.x, ePos.y, parentAngleRad, l2nodesFiltered.length, 130);
            let pi = 0;

            l2nodes.forEach(ln => {
              if (ln.id === en.id) return; // skip self
              if (newNodes.find(x => x.id === ln.id)) return; // already added
              const lp = l2Positions[pi++] || { x: ePos.x + 120, y: ePos.y };

              addNode({
                id:   ln.id,
                type: ln.type,
                position: getPosition(ln.id, lp),
                data: {
                  label:    ln.label,
                  selected: selectedNode?.id === ln.id,
                  faded: focusMode && selectedNode?.id !== ln.id && selectedNode?.id !== en.id,
                  onClick:  () => handleEntityClick(ln, lp),
                },
                draggable: true,
              });
            });

            l2edges.forEach(le => {
              if (newEdges.find(x => x.id === le.id)) return;
              // Only add edge if both nodes are present
              if (!nodeIdSet.has(le.source) || !nodeIdSet.has(le.target)) return;
              const s = edgeStyle(le.type, le.weight);
              addEdge({
                id:         le.id,
                source:     le.source,
                target:     le.target,
                style:      s,
                animated:   false,
                markerEnd:  { type: MarkerType.ArrowClosed, width: 10, height: 10, color: s.stroke },
                label:      le.type?.replace(/_/g, ' '),
                labelStyle: { fontSize: 8, fill: '#94a3b8' },
                labelBgStyle: { fill: 'transparent' },
              });
            });
          }
        });
      }
    });

    // Final safety guard: strip any edge whose source or target node is missing
    const safeEdges = newEdges.filter(
      e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
    );

    setNodes(newNodes);
    setEdges(safeEdges);
  }, [expandedCategories, expandedEntities, selectedNode, focusMode]);

  // Rebuild whenever expansion state changes
  useEffect(() => { rebuildGraph(); }, [rebuildGraph]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadRoot = () => {
      axios.get(`${API_URL}/api/graph/root`).then(res => {
        rootDataRef.current = res.data;
        rebuildGraph();
        setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 100);
      }).catch(err => console.error('Root load failed', err));
    };

    loadRoot();

    const handleRefresh = () => {
      rootDataRef.current = null;
      categoryDataRef.current = {};
      entityDataRef.current = {};
      customPositionsRef.current = {};
      setExpandedCategories(new Set());
      setExpandedEntities(new Set());
      setSelectedNode(null);
      setBreadcrumbs([]);
      setNodes([]);
      setEdges([]);
      loadRoot();
    };

    window.addEventListener('refresh-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
    };
  }, [fitView, rebuildGraph, setEdges, setNodes]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRootClick = useCallback(() => {
    setSelectedNode({ id: 'root_memoryverse', label: 'MemoryVerse', type: 'Root' });
    setBreadcrumbs([{ id: 'root_memoryverse', label: 'MemoryVerse' }]);
    setCenter(500, 400, { zoom: 0.9, duration: 500 });
  }, [setCenter]);

  const handleCategoryClick = useCallback(async (cat) => {
    setSelectedNode({ id: cat.id, label: cat.label, type: 'Category', count: cat.count });
    setBreadcrumbs([{ id: 'root_memoryverse', label: 'MemoryVerse' }, { id: cat.id, label: cat.label }]);

    const isExpanded = expandedCategories.has(cat.id);
    if (isExpanded) {
      // Collapse
      setExpandedCategories(prev => { const s = new Set(prev); s.delete(cat.id); return s; });
    } else {
      // Fetch if not cached
      if (!categoryDataRef.current[cat.id]) {
        try {
          const res = await axios.get(`${API_URL}/api/graph/expand/${cat.id}`);
          categoryDataRef.current[cat.id] = res.data;
        } catch (e) { console.error(e); return; }
      }
      setExpandedCategories(prev => new Set([...prev, cat.id]));
    }
  }, [expandedCategories]);

  const handleEntityClick = useCallback(async (entity, pos) => {
    setSelectedNode({ id: entity.id, label: entity.label, type: entity.type });

    // Find parent category for breadcrumb
    const catLabel = Object.entries(categoryDataRef.current).find(([, v]) =>
      v?.nodes?.find(n => n.id === entity.id)
    )?.[0];
    const catData = rootDataRef.current?.categories?.find(c => c.id === catLabel);
    setBreadcrumbs([
      { id: 'root_memoryverse', label: 'MemoryVerse' },
      ...(catData ? [{ id: catData.id, label: catData.label }] : []),
      { id: entity.id, label: entity.label },
    ]);

    // Fetch L2 if not already cached
    if (!entityDataRef.current[entity.id]) {
      try {
        const res = await axios.get(`${API_URL}/api/graph/node/${entity.id}`);
        entityDataRef.current[entity.id] = res.data;
      } catch (e) { console.error(e); }
    }

    const isExpanded = expandedEntities.has(entity.id);
    if (isExpanded) {
      setExpandedEntities(prev => { const s = new Set(prev); s.delete(entity.id); return s; });
    } else {
      setExpandedEntities(prev => new Set([...prev, entity.id]));
    }

    // Pan to node
    if (pos) setCenter(pos.x, pos.y, { zoom: 1.2, duration: 600 });
  }, [expandedEntities, setCenter]);

  // ── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${API_URL}/api/graph/search`, { params: { q: searchQuery } });
        setSearchResults(res.data);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const focusSearchNode = useCallback((result) => {
    // Try to find node in current graph; if not visible, inform user
    const existingNode = nodes.find(n => n.id === result.id);
    if (existingNode) {
      setCenter(existingNode.position.x, existingNode.position.y, { zoom: 1.4, duration: 700 });
      setSelectedNode({ id: result.id, label: result.label, type: result.type });
    }
    setSearchQuery('');
    setSearchResults([]);
  }, [nodes, setCenter]);

  // ── Navigate from side panel ──────────────────────────────────────────────
  const navigateToNode = useCallback((nodeId) => {
    const existing = nodes.find(n => n.id === nodeId);
    if (existing) {
      setCenter(existing.position.x, existing.position.y, { zoom: 1.3, duration: 600 });
      setSelectedNode({ id: existing.id, label: existing.data.label, type: existing.type });
    }
  }, [nodes, setCenter]);

  const resetView = useCallback(() => {
    fitView({ padding: 0.2, duration: 600 });
    setSelectedNode(null);
    setBreadcrumbs([]);
    setFocusMode(false);
  }, [fitView]);

  return (
    <div className="relative w-full h-full bg-background">

      {/* ── Top Toolbar ─────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 pointer-events-none">

        {/* Search box */}
        <div className="pointer-events-auto relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-full pl-8 pr-8 py-2 text-xs rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Search results dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
              >
                {searching && <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" /> Searching…</div>}
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => focusSearchNode(r)}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-secondary/40 transition-colors border-b border-border/50 last:border-0">
                    <span className="text-xs font-semibold text-foreground">{r.label}</span>
                    <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">{r.type}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-1 bg-card/90 backdrop-blur-md border border-border px-3 py-1.5 rounded-xl shadow-md text-xs">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={bc.id}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                <span className={i === breadcrumbs.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                  {bc.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setFocusMode(f => !f)}
            title="Focus Mode"
            className={`p-2 rounded-xl border text-xs transition-all shadow-md ${focusMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/90 text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60'}`}
          >
            {focusMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={resetView}
            title="Fit & Reset"
            className="p-2 rounded-xl bg-card/90 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all shadow-md"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { rootDataRef.current = null; categoryDataRef.current = {}; entityDataRef.current = {}; setExpandedCategories(new Set()); setExpandedEntities(new Set()); setSelectedNode(null); setBreadcrumbs([]); axios.get(`${API_URL}/api/graph/root`).then(r => { rootDataRef.current = r.data; rebuildGraph(); fitView({ padding: 0.2, duration: 600 }); }); }}
            title="Refresh Graph"
            className="p-2 rounded-xl bg-card/90 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-16 left-3 z-10 bg-card/90 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
          <Layers className="w-3 h-3" /> Legend
        </p>
        {[
          { color: 'bg-emerald-500', label: 'Person',       line: 'solid' },
          { color: 'bg-orange-500',  label: 'Location',     line: 'dotted' },
          { color: 'bg-violet-500',  label: 'Organization', line: 'solid' },
          { color: 'bg-sky-500',     label: 'Topic',        line: 'dashed' },
          { color: 'bg-rose-500',    label: 'Emotion',      line: 'solid' },
          { color: 'bg-slate-500',   label: 'Document',     line: 'solid' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color} shrink-0`} />
            <span className="text-[10px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── React Flow Canvas ────────────────────────────────────────────── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeCustom}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={3}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        onPaneClick={() => { setSelectedNode(null); setBreadcrumbs([]); }}
      >
        <Background
          variant="dots"
          gap={24}
          size={1}
          color="var(--color-border)"
          style={{ opacity: 0.5 }}
        />
        <Controls
          showInteractive={false}
          style={{ bottom: 56, left: 12 }}
          className="!bg-card/90 !border-border !rounded-xl !shadow-lg"
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={n => {
            if (n.type === 'root')         return '#6366f1';
            if (n.type === 'category')     return '#818cf8';
            if (n.type === 'Person')       return '#10b981';
            if (n.type === 'Location')     return '#f97316';
            if (n.type === 'Organization') return '#a78bfa';
            if (n.type === 'Tag')          return '#38bdf8';
            if (n.type === 'Emotion')      return '#f43f5e';
            return '#64748b';
          }}
          style={{
            bottom: 12, right: selectedNode ? 332 : 12,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
          }}
        />
      </ReactFlow>

      {/* ── Side Panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedNode && (
          <GraphSidePanel
            selectedNode={selectedNode}
            onClose={() => { setSelectedNode(null); setBreadcrumbs([]); }}
            onNavigateToNode={navigateToNode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page wrapper with provider ──────────────────────────────────────────────
export default function Relationships() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
      {/* Page Header */}
      <div className="px-6 pt-6 pb-3 border-b border-border bg-card/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Network className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Knowledge Graph</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Progressive multi-level exploration · Click category nodes to expand · Click entities to see connections
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/40 border border-border px-2.5 py-1 rounded-lg">
              <Info className="w-3 h-3" />
              <span>Ctrl+K to search globally</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas area — explicit pixel height required by React Flow */}
      <div className="relative overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
        <ReactFlowProvider>
          <RelationshipsCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
