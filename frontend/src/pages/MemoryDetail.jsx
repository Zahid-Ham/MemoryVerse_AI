import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  HardDrive,
  FileText,
  FileImage,
  Copy,
  Check,
  Search,
  Download,
  Info,
  Layers,
  Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function MemoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'text' | 'metadata'

  // Text search & copy states
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/memories');
    }
  };

  const fetchDocumentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch main document metadata and text content
      const res = await axios.get(`${API_URL}/api/files/${id}`);
      setDoc(res.data);

      // 2. Fetch specific preview structured data (for PDF metadata, images, etc.)
      try {
        const previewRes = await axios.get(`${API_URL}/api/files/${id}/preview`);
        setPreviewData(previewRes.data);
      } catch (err) {
        console.warn('Preview details not available', err);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to retrieve document details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentDetails();

    const params = new URLSearchParams(window.location.search);
    const highlight = params.get('highlight') || params.get('q');
    if (highlight) {
      setSearchTerm(decodeURIComponent(highlight));
      setActiveTab('text');
    }
  }, [id]);

  useEffect(() => {
    if (searchTerm && activeTab === 'text') {
      const scrollTimer = setTimeout(() => {
        const markEl = document.querySelector('mark');
        if (markEl) {
          markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 600);
      return () => clearTimeout(scrollTimer);
    }
  }, [searchTerm, activeTab, loading]);

  const handleCopyText = () => {
    if (!doc?.raw_text) return;
    navigator.clipboard.writeText(doc.raw_text);
    setCopied(true);
    toast.success('Text copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (filetype) => {
    if (!filetype) return <FileText className="w-5 h-5 text-purple-500" />;
    if (filetype.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-emerald-500" />;
    }
    if (filetype === 'application/pdf') {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (filetype === 'text/plain') {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    return <FileText className="w-5 h-5 text-purple-500" />;
  };

  // Inline highlighter helper for text tab search
  const highlightText = (text, search) => {
    if (!search.trim()) return text;
    // Escape special regex characters to prevent syntax errors
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-black px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-7 h-7 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-semibold">Loading document...</span>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
          {error || 'Document not found'}
        </div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Memories</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back button and Download */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <a
          href={`${API_URL}/api/files/${doc.id}/raw`}
          download={doc.filename}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </a>
      </div>

      {/* Header Info Panel */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-3 bg-secondary rounded-xl shrink-0">
            {getFileIcon(doc.filetype)}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-foreground truncate max-w-md md:max-w-xl" title={doc.filename}>
              {doc.filename}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
              {doc.filetype || 'Unknown Format'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground sm:text-right sm:justify-end shrink-0">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            {formatSize(doc.filesize)}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(doc.uploaded_at)}
          </span>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-border text-xs font-semibold gap-6 pb-px">
        {[
          { id: 'preview', label: 'Live Preview' },
          { id: 'text', label: 'Extracted Text' },
          { id: 'metadata', label: 'AI Metadata' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 relative transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-card border border-border rounded-xl p-6 min-h-[350px] shadow-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full"
          >
            {/* 1. PREVIEW TAB */}
            {activeTab === 'preview' && (
              <div className="w-full">
                {previewData?.type === 'image' && (
                  <div className="flex items-center justify-center bg-secondary/10 border border-border p-3 rounded-xl max-h-[60vh] overflow-hidden">
                    <img
                      src={`${API_URL}${previewData.url}`}
                      alt={doc.filename}
                      className="max-h-[55vh] w-auto object-contain rounded-lg shadow-sm"
                    />
                  </div>
                )}

                {previewData?.type === 'txt' && (
                  <div className="bg-secondary/20 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[55vh]">
                    {previewData.content || <span className="text-muted-foreground italic">File is empty</span>}
                  </div>
                )}

                {previewData?.type === 'pdf' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Metadata */}
                    <div className="space-y-4 lg:col-span-1">
                      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl text-primary text-xs">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>PDF metadata parsed:</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-secondary/20 border border-border rounded-xl p-4 space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Pages</span>
                          <p className="text-lg font-bold text-foreground">{previewData.pages}</p>
                        </div>
                        
                        {Object.entries(previewData.metadata || {}).map(([key, val]) => (
                          val && (
                            <div key={key} className="bg-secondary/15 border border-border/80 rounded-xl p-3.5 space-y-1">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">{key}</span>
                              <p className="text-xs font-semibold text-foreground break-all">{val}</p>
                            </div>
                          )
                        ))}
                      </div>
                    </div>

                    {/* Right Column: PDF Viewer */}
                    <div className="lg:col-span-2 h-[600px] border border-border rounded-xl overflow-hidden bg-background shadow-inner">
                      <iframe
                        src={`${API_URL}/api/files/${doc.id}/raw`}
                        title={doc.filename}
                        className="w-full h-full border-none"
                      />
                    </div>
                  </div>
                )}

                {(!previewData || previewData.type === 'generic') && (
                  <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-xs text-foreground">Interactive Preview Not Supported</h4>
                      <p className="text-xs text-muted-foreground">
                        Live previews are not available for this format. You can download the file to inspect.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. EXTRACTED TEXT TAB */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                {/* Text Control Bar */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-border">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search within extracted text..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-secondary/40 border border-border focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <button
                    onClick={handleCopyText}
                    disabled={!doc.raw_text}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all disabled:opacity-50"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Text</span>
                  </button>
                </div>

                {/* Text View Body */}
                <div className="bg-secondary/10 border border-border rounded-xl p-5 font-mono text-[11px] text-foreground leading-relaxed overflow-y-auto max-h-[50vh] whitespace-pre-wrap" data-lenis-prevent>
                  {doc.raw_text ? (
                    highlightText(doc.raw_text, searchTerm)
                  ) : (
                    <span className="text-muted-foreground italic">No text has been extracted from this document yet.</span>
                  )}
                </div>
              </div>
            )}

            {/* 3. AI METADATA TAB */}
            {activeTab === 'metadata' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Extracted Semantic Fields</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Entity extractions and summarizations generated by Groq LLM.</p>
                </div>

                {doc.metadata ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                    {/* Summary Card */}
                    <div className="col-span-full bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground/75" />
                        Document Summary
                      </span>
                      <p className="text-xs text-foreground leading-relaxed">{doc.metadata.summary || "No summary available."}</p>
                    </div>

                    {/* Tags Card */}
                    <div className="bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-muted-foreground/75" />
                        Tags & Topics
                      </span>
                      {doc.metadata.tags && doc.metadata.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.metadata.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded font-semibold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No tags identified.</p>
                      )}
                    </div>

                    {/* People Card */}
                    <div className="bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground/75" />
                        Mentioned People
                      </span>
                      {doc.metadata.people && doc.metadata.people.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.metadata.people.map((person, i) => (
                            <span key={i} className="text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded font-semibold border border-border">
                              {person}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No people mentioned.</p>
                      )}
                    </div>

                    {/* Locations Card */}
                    <div className="bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-muted-foreground/75" />
                        Locations & Events
                      </span>
                      {doc.metadata.locations && doc.metadata.locations.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.metadata.locations.map((loc, i) => (
                            <span key={i} className="text-[10px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 px-2 py-0.5 rounded font-semibold">
                              {loc}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No locations mentioned.</p>
                      )}
                    </div>

                    {/* Emotions Card */}
                    <div className="bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-muted-foreground/75" />
                        Sentiment & Emotions
                      </span>
                      {doc.metadata.emotions && doc.metadata.emotions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {doc.metadata.emotions.map((emotion, i) => (
                            <span key={i} className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/25 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                              {emotion}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No tone identified.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                    {/* Fallback layout if processing is still pending */}
                    {['Document Summary', 'Tags & Topics', 'Mentioned People', 'Locations & Events', 'Sentiment & Emotions'].map((label, idx) => (
                      <div key={idx} className={`bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-2 ${idx === 0 ? 'col-span-full' : ''}`}>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground/75" />
                          {label}
                        </span>
                        <p className="text-xs text-muted-foreground italic">Processing not started yet.</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Small missing helper import for spinner
function RefreshCw(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
