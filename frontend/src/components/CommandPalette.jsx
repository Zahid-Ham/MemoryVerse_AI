import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Search,
  Command,
  Settings,
  LayoutDashboard,
  Brain,
  MessageSquare,
  Moon,
  Sun,
  Database,
  RefreshCw,
  FolderOpen,
  User,
  MapPin,
  Tag,
  FileText,
  FileImage,
  Calendar,
  Network,
  UploadCloud,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const navigateItems = [
  { label: 'Navigate to Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Upload Files', path: '/upload', icon: UploadCloud },
  { label: 'View Memories List', path: '/memories', icon: Brain },
  { label: 'Search Console', path: '/search', icon: Search },
  { label: 'Timeline View', path: '/timeline', icon: Calendar },
  { label: 'Relationships Graph', path: '/relationships', icon: Network },
  { label: 'Chat Assistant', path: '/chat', icon: MessageSquare },
  { label: 'Open Settings', path: '/settings', icon: Settings },
];

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  const [query, setQuery] = useState('');
  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Focus input and load documents on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);

      const loadData = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API_URL}/api/files`);
          setAllDocs(res.data);
        } catch (e) {
          console.error("Failed to load documents for command palette", e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Construct flat list of searchable items
  const searchIndex = React.useMemo(() => {
    const items = [];

    // 1. Add Navigation / Command Items
    navigateItems.forEach((nav) => {
      items.push({
        type: 'command',
        category: 'Navigation',
        label: nav.label,
        icon: nav.icon,
        action: () => navigate(nav.path)
      });
    });

    // Add Theme Toggle Command
    items.push({
      type: 'command',
      category: 'System',
      label: 'Toggle Color Theme',
      icon: theme === 'dark' ? Sun : Moon,
      action: toggleTheme
    });

    // 2. Add Documents
    allDocs.forEach((doc) => {
      items.push({
        type: 'document',
        category: 'Memories',
        label: doc.filename,
        sublabel: doc.metadata?.summary || doc.filetype,
        filetype: doc.filetype,
        action: () => navigate(`/memories/${doc.id}`)
      });
    });

    // 3. Extract Unique People
    const peopleSet = new Set();
    allDocs.forEach((doc) => {
      if (doc.metadata?.people) {
        doc.metadata.people.forEach((p) => {
          if (p.trim()) peopleSet.add(p.trim());
        });
      }
    });
    peopleSet.forEach((person) => {
      items.push({
        type: 'people',
        category: 'People',
        label: person,
        icon: User,
        action: () => navigate(`/search?q=${encodeURIComponent(person)}`)
      });
    });

    // 4. Extract Unique Locations
    const locationsSet = new Set();
    allDocs.forEach((doc) => {
      if (doc.metadata?.locations) {
        doc.metadata.locations.forEach((l) => {
          if (l.trim()) locationsSet.add(l.trim());
        });
      }
    });
    locationsSet.forEach((loc) => {
      items.push({
        type: 'location',
        category: 'Locations',
        label: loc,
        icon: MapPin,
        action: () => navigate(`/search?q=${encodeURIComponent(loc)}`)
      });
    });

    // 5. Extract Unique Tags
    const tagsSet = new Set();
    allDocs.forEach((doc) => {
      if (doc.metadata?.tags) {
        doc.metadata.tags.forEach((t) => {
          if (t.trim()) tagsSet.add(t.trim());
        });
      }
    });
    tagsSet.forEach((tag) => {
      items.push({
        type: 'tag',
        category: 'Tags',
        label: `#${tag}`,
        icon: Tag,
        action: () => navigate(`/memories?searchQuery=${encodeURIComponent(tag)}`)
      });
    });

    return items;
  }, [allDocs, theme, toggleTheme, navigate]);

  // Local fuzzy tokens check
  const filteredItems = React.useMemo(() => {
    if (!query.trim()) {
      return searchIndex.filter(item => item.type === 'command');
    }

    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return searchIndex.filter((item) => {
      const matchText = `${item.label} ${item.sublabel || ''} ${item.category || ''}`.toLowerCase();
      return tokens.every((token) => matchText.includes(token));
    });
  }, [searchIndex, query]);

  // Reset activeIndex when query / results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, filteredItems.length]);

  // Handle keyboard arrows and selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[activeIndex]) {
          executeAction(filteredItems[activeIndex].action);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, activeIndex]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    const activeEl = resultsContainerRef.current?.querySelector('.active-item');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const executeAction = (action) => {
    onClose();
    action();
  };

  const getFileIcon = (filetype) => {
    if (!filetype) return <FileText className="w-4 h-4 text-purple-500" />;
    if (filetype.startsWith('image/')) {
      return <FileImage className="w-4 h-4 text-emerald-500" />;
    }
    if (filetype === 'application/pdf') {
      return <FileText className="w-4 h-4 text-rose-500" />;
    }
    if (filetype === 'text/plain') {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    return <FileText className="w-4 h-4 text-purple-500" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/55 backdrop-blur-xs">
        {/* Backdrop closer click zone */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-xl overflow-hidden z-10"
        >
          {/* Search Header Bar */}
          <div className="relative flex items-center border-b border-border px-4 py-3.5 bg-secondary/30">
            <Search className="w-5 h-5 text-muted-foreground mr-3" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search concepts, documents, entities, or navigate..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none text-foreground placeholder-muted-foreground outline-none text-sm"
            />
            <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-card text-[9px] font-mono text-muted-foreground shadow-xs">
              ESC
            </kbd>
          </div>

          {/* Results Area */}
          <div ref={resultsContainerRef} className="max-h-[350px] overflow-y-auto p-2 space-y-1" data-lenis-prevent>
            {loading && allDocs.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                Querying second brain...
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item, idx) => {
                const isHighlighted = idx === activeIndex;
                const Icon = item.icon;
                
                return (
                  <button
                    key={idx}
                    onClick={() => executeAction(item.action)}
                    className={`w-full text-left p-2.5 rounded-lg border border-transparent transition-all flex items-center justify-between gap-3 ${
                      isHighlighted 
                        ? 'bg-primary/10 border-primary/20 text-primary active-item' 
                        : 'hover:bg-secondary/40 text-foreground/80 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg shrink-0 ${isHighlighted ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                        {item.type === 'document' ? getFileIcon(item.filetype) : <Icon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{item.label}</span>
                          <span className="text-[8px] bg-secondary/80 text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shrink-0">
                            {item.category}
                          </span>
                        </div>
                        {item.sublabel && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.sublabel}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {isHighlighted && (
                        <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">
                          Enter
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-xs text-muted-foreground italic text-center">
                No matching results found.
              </div>
            )}
          </div>

          {/* Footer controls bar */}
          <div className="px-4 py-2 border-t border-border bg-secondary/15 flex justify-between items-center text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Command className="w-3 h-3" />
              MemoryVerse AI Palette
            </span>
            <span>Use ↑↓ to navigate, Enter to select</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
