import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  Brain,
  FileText,
  Tag,
  MapPin,
  Smile,
  Compass,
  ArrowRight,
  User,
  Activity,
  Layers
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => sessionStorage.getItem('mv_search_query') || '');
  const [searchType, setSearchType] = useState(() => sessionStorage.getItem('mv_search_type') || 'semantic'); // 'semantic' | 'keyword'
  
  // Search states: 'idle' | 'searching' | 'results' | 'empty'
  const [searchState, setSearchState] = useState(() => sessionStorage.getItem('mv_search_state') || 'idle');
  const [results, setResults] = useState(() => {
    try {
      const stored = sessionStorage.getItem('mv_search_results');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    sessionStorage.setItem('mv_search_query', query);
  }, [query]);

  useEffect(() => {
    sessionStorage.setItem('mv_search_type', searchType);
  }, [searchType]);

  useEffect(() => {
    sessionStorage.setItem('mv_search_state', searchState);
  }, [searchState]);

  useEffect(() => {
    sessionStorage.setItem('mv_search_results', JSON.stringify(results));
  }, [results]);

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/search/suggestions`);
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error('Failed to load search suggestions', err);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const executeSearchDirectly = async (searchVal) => {
    if (!searchVal.trim()) return;
    setSearchState('searching');
    try {
      if (searchType === 'semantic') {
        const response = await axios.post(`${API_URL}/api/search/semantic`, { query: searchVal });
        setResults(response.data);
        setSearchState(response.data.length > 0 ? 'results' : 'empty');
      } else {
        const response = await axios.get(`${API_URL}/api/search`, { params: { q: searchVal } });
        setResults(response.data);
        setSearchState(response.data.length > 0 ? 'results' : 'empty');
      }
    } catch (err) {
      console.error('Search request failed', err);
      setSearchState('empty');
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    executeSearchDirectly(query);
  };

  const getFileIcon = (filetype) => {
    if (!filetype) return <FileText className="w-4 h-4 text-purple-500" />;
    if (filetype.startsWith('image/')) {
      return <FileText className="w-4 h-4 text-emerald-500" />;
    }
    if (filetype === 'application/pdf') {
      return <FileText className="w-4 h-4 text-rose-500" />;
    }
    return <FileText className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 min-h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent flex items-center gap-2">
          <SearchIcon className="w-8 h-8 text-primary" />
          Second Brain Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Perform concept-based semantic search or exact keyword matching across your digital memories.
        </p>
      </div>

      {/* Mode Selector & Input Bar */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm shrink-0">
        <div className="flex bg-secondary/80 p-1 rounded-lg border border-border w-fit text-xs font-semibold">
          <button
            onClick={() => {
              setSearchType('semantic');
              if (searchState !== 'idle') setResults([]);
              setSearchState('idle');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              searchType === 'semantic'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Semantic AI Search
          </button>
          <button
            onClick={() => {
              setSearchType('keyword');
              if (searchState !== 'idle') setResults([]);
              setSearchState('idle');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              searchType === 'keyword'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Keyword Metadata Match
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2.5">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={
                searchType === 'semantic'
                  ? "Describe a concept or query, e.g. 'Jane's feedback on slide decks'..."
                  : "Enter filenames, tags, people, or location keywords..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-secondary/40 border border-border focus:border-primary focus:outline-none transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Dynamic Contextual Suggestions Chips */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Suggested:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  executeSearchDirectly(suggestion);
                }}
                className="text-xs bg-secondary/80 hover:bg-primary hover:text-primary-foreground border border-border px-3 py-1 rounded-full transition-all text-muted-foreground font-semibold"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Results Console */}
      <div className="flex-1 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          
          {/* Idle State */}
          {searchState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4"
            >
              <div className="p-4 bg-secondary rounded-full text-muted-foreground">
                <Compass className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="font-semibold text-sm text-foreground">Awaiting Inquiries</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {searchType === 'semantic'
                    ? "Concept search maps meanings and context using LLM embeddings, matching ideas even if direct keyword syntax differs."
                    : "Keyword search compiles fast, prioritized keyword scans matching filenames, categories, locations, and tags."}
                </p>
              </div>
            </motion.div>
          )}

          {/* Searching State (Loading Skeletons) */}
          {searchState === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="w-20 h-4 bg-muted rounded" />
                    <div className="w-12 h-4 bg-muted rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-4 bg-muted rounded" />
                    <div className="w-4/5 h-4 bg-muted rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-16 h-3 bg-muted rounded-full" />
                    <div className="w-16 h-3 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Empty State */}
          {searchState === 'empty' && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4"
            >
              <div className="p-4 bg-secondary rounded-full text-muted-foreground">
                <SearchIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <h3 className="font-semibold text-sm text-foreground">No matches found</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We couldn't locate chunks or metadata matching your prompt. Try refining your wording or check spelling.
                </p>
              </div>
            </motion.div>
          )}

          {/* Results State */}
          {searchState === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-xs text-muted-foreground font-semibold px-1">
                Found {results.length} ranked vector matches
              </div>

              <div className="space-y-5">
                {results.map((result, i) => {
                  const hasMeta = result.metadata && Object.keys(result.metadata).length > 0;
                  
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border hover:border-primary/20 hover:shadow-premium rounded-2xl p-5 space-y-4.5 transition-all group"
                    >
                      {/* Result Card Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {getFileIcon(result.document_type || result.metadata?.document_type)}
                            {result.title || result.metadata?.title}
                          </h3>
                          {result.matched_reason && (
                            <p className="text-[10px] text-muted-foreground font-medium italic">
                              {result.matched_reason}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {result.score !== undefined && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {Math.round(result.score * 100)}% Match
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const highlightText = searchType === 'semantic' ? result.chunk_text : query;
                              navigate(`/memories/${result.document_id || result.id}?highlight=${encodeURIComponent(highlightText || '')}`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground text-[10px] font-bold rounded-lg border border-border hover:border-transparent transition-all"
                          >
                            Open
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Chunk Text (for Semantic Search) */}
                      {result.chunk_text && (
                        <div className="p-3 bg-secondary/35 border border-border/50 rounded-xl leading-relaxed">
                          <p className="text-xs text-foreground/90 font-medium">
                            {result.chunk_text}
                          </p>
                        </div>
                      )}

                      {/* Metadata Badges */}
                      {hasMeta && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
                          {(result.metadata.tags || []).slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              {t}
                            </span>
                          ))}
                          {(result.metadata.people || []).slice(0, 3).map((p) => (
                            <span key={p} className="text-[9px] font-bold bg-secondary/80 text-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-border">
                              <User className="w-2.5 h-2.5 text-muted-foreground" />
                              {p}
                            </span>
                          ))}
                          {(result.metadata.locations || []).slice(0, 3).map((l) => (
                            <span key={l} className="text-[9px] font-bold bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-500/20">
                              <MapPin className="w-2.5 h-2.5" />
                              {l}
                            </span>
                          ))}
                          {(result.metadata.emotions || []).slice(0, 2).map((e) => (
                            <span key={e} className="text-[9px] font-bold bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-rose-500/20 uppercase">
                              <Smile className="w-2.5 h-2.5" />
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
