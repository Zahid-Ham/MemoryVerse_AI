import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Trash2,
  HardDrive,
  Calendar,
  Search,
  RefreshCw,
  FolderOpen,
  Grid,
  List,
  Eye,
  Download,
  Filter,
  ArrowUpDown,
  X,
  FileImage,
  Info,
  Layers,
  MessageSquare,
  Share2,
  User,
  MapPin,
  ExternalLink
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Memories() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  
  // Custom explorer states
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'pdf' | 'doc' | 'text' | 'image'
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'Projects' | 'Skills' | 'Certifications' | 'Internships' | 'Achievements' | 'Academics' | 'General'
  
  // Preview modal states
  const [previewFile, setPreviewFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/files`);
      setFiles(response.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch uploaded files');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/files/${id}`);
      setFiles((prev) => prev.filter((file) => file.id !== id));
      if (previewFile?.id === id) {
        closePreview();
      }
      window.dispatchEvent(new Event('refresh-data'));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete file');
    }
  };

  const handlePreview = async (file) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const response = await axios.get(`${API_URL}/api/files/${file.id}/preview`);
      setPreviewData(response.data);
    } catch (err) {
      setPreviewError('Could not load file preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewData(null);
    setPreviewError(null);
  };

  useEffect(() => {
    fetchFiles();

    const handleRefresh = () => {
      fetchFiles();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
    };
  }, []);

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

  // Filter based on search query, type and category
  const filteredFiles = files
    .filter((file) =>
      file.filename.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((file) => {
      if (filterType === 'all') return true;
      if (filterType === 'pdf') return file.filetype === 'application/pdf';
      if (filterType === 'doc') return file.filetype.includes('word') || file.filetype.includes('docx') || file.filetype.includes('document');
      if (filterType === 'text') return file.filetype === 'text/plain';
      if (filterType === 'image') return file.filetype.startsWith('image/');
      return true;
    })
    .filter((file) => {
      if (filterCategory === 'all') return true;
      return (file.category || 'General').toLowerCase() === filterCategory.toLowerCase();
    });

  // Sort files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.uploaded_at) - new Date(a.uploaded_at);
    if (sortBy === 'date-asc') return new Date(a.uploaded_at) - new Date(b.uploaded_at);
    if (sortBy === 'name-asc') return a.filename.localeCompare(b.filename);
    if (sortBy === 'name-desc') return b.filename.localeCompare(a.filename);
    if (sortBy === 'size-desc') return b.filesize - a.filesize;
    if (sortBy === 'size-asc') return a.filesize - b.filesize;
    return 0;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">Memories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search, preview, and manage your uploaded digital assets.
          </p>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Control bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card/50 border border-border p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-xs bg-background/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 bg-background/50 border border-border rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2 mr-1" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none pr-2 py-1 cursor-pointer font-medium"
            >
              <option value="all" className="bg-card">All Types</option>
              <option value="pdf" className="bg-card">PDFs</option>
              <option value="doc" className="bg-card">Documents</option>
              <option value="text" className="bg-card">Text Files</option>
              <option value="image" className="bg-card">Images</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-background/50 border border-border rounded-lg p-1">
            <Layers className="w-3.5 h-3.5 text-muted-foreground ml-2 mr-1" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none pr-2 py-1 cursor-pointer font-medium"
            >
              <option value="all" className="bg-card">All Categories</option>
              <option value="projects" className="bg-card">Projects</option>
              <option value="skills" className="bg-card">Skills</option>
              <option value="certifications" className="bg-card">Certifications</option>
              <option value="internships" className="bg-card">Internships</option>
              <option value="achievements" className="bg-card">Achievements</option>
              <option value="academics" className="bg-card">Academics</option>
              <option value="general" className="bg-card">General</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2 bg-background/50 border border-border rounded-lg p-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-2 mr-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none pr-2 py-1 cursor-pointer font-medium"
            >
              <option value="date-desc" className="bg-card">Newest First</option>
              <option value="date-asc" className="bg-card">Oldest First</option>
              <option value="name-asc" className="bg-card">Name (A-Z)</option>
              <option value="name-desc" className="bg-card">Name (Z-A)</option>
              <option value="size-desc" className="bg-card">Size (Largest)</option>
              <option value="size-asc" className="bg-card">Size (Smallest)</option>
            </select>
          </div>
        </div>

        {/* View toggle and stats */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="text-xs text-muted-foreground">
            Showing {sortedFiles.length} of {files.length} memories
          </div>

          <div className="flex items-center gap-1 bg-background/50 border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Main content display */}
      {loading && files.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 bg-muted rounded-lg" />
                <div className="w-16 h-4 bg-muted rounded" />
              </div>
              <div className="w-3/4 h-5 bg-muted rounded" />
              <div className="flex justify-between items-center pt-2">
                <div className="w-24 h-4 bg-muted rounded" />
                <div className="w-8 h-8 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        /* Empty state: No memories uploaded yet */
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-2xl max-w-md mx-auto space-y-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-foreground">No memories uploaded yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Store and organize your text, image, and PDF files. Add your first memory to begin.
            </p>
          </div>
          <a
            href="/upload"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
          >
            Upload your first memory
          </a>
        </div>
      ) : sortedFiles.length === 0 ? (
        /* No results match search/filter */
        <div className="text-center py-16 bg-card border border-border rounded-2xl space-y-4">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground mx-auto">
            <FolderOpen className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">No matches found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search query, filters, or sorting configuration.
            </p>
          </div>
        </div>
      ) : (
        /* Document listing rendering */
        <AnimatePresence mode="popLayout">
          {viewMode === 'grid' ? (
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {sortedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card border border-border hover:border-primary/30 rounded-xl p-5 flex flex-col justify-between hover:shadow-lg transition-all duration-300 relative group overflow-hidden min-h-[290px]"
                >
                  {/* Hover Action Overlay */}
                  <div className="absolute inset-0 bg-background/95 backdrop-blur-xs opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex flex-col items-center justify-center gap-2.5 p-5 z-10 pointer-events-none group-hover:pointer-events-auto">
                    <h4 className="font-bold text-xs text-foreground truncate max-w-[90%] mb-1" title={file.filename}>{file.filename}</h4>
                    
                    <button
                      onClick={() => handlePreview(file)}
                      className="w-4/5 py-2 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview File</span>
                    </button>

                    <Link
                      to={`/memories/${file.id}`}
                      className="w-4/5 py-2 px-3 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Detail</span>
                    </Link>

                    <Link
                      to="/chat"
                      className="w-4/5 py-2 px-3 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat About Document</span>
                    </Link>

                    <Link
                      to="/relationships"
                      className="w-4/5 py-2 px-3 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Show Relationships</span>
                    </Link>
                  </div>

                  {/* Normal Card Content */}
                  <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Card Header: Icons & Badges */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-secondary/80 rounded-lg">
                            {getFileIcon(file.filetype)}
                          </div>
                          {file.category && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                              {file.category}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] bg-secondary/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-muted-foreground">
                          {file.filetype.split('/')[1] || 'FILE'}
                        </span>
                      </div>

                      {/* Card Title */}
                      <Link to={`/memories/${file.id}`} className="hover:text-primary transition-colors block">
                        <h3 className="font-bold text-sm tracking-tight text-foreground line-clamp-1 mt-1" title={file.filename}>
                          {file.filename}
                        </h3>
                      </Link>

                      {/* Summary */}
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[32px]">
                        {file.metadata?.summary || <span className="italic text-muted-foreground/70">No summary extracted yet.</span>}
                      </p>
                    </div>

                    {/* Entities (Tags, People, Locations) */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      {/* Tags */}
                      {file.metadata?.tags && file.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {file.metadata.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[9px] bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* People & Locations */}
                      <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                        {file.metadata?.people && file.metadata.people.length > 0 && (
                          <div className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                            <span className="truncate">{file.metadata.people.slice(0, 2).join(', ')}</span>
                          </div>
                        )}
                        {file.metadata?.locations && file.metadata.locations.length > 0 && (
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                            <span className="truncate">{file.metadata.locations.slice(0, 2).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="border-t border-border/60 mt-4 pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-muted-foreground/75" />
                        {formatSize(file.filesize)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/75" />
                        {formatDate(file.uploaded_at)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(file.id, file.filename)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all z-20 relative hover:scale-105"
                      title="Delete Memory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              layout
              className="space-y-3"
            >
              {sortedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/20 hover:shadow-xs transition-all duration-300 relative group overflow-hidden"
                >
                  {/* Normal Row Content */}
                  <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                    {/* File Icon */}
                    <div className="p-2.5 bg-secondary/80 rounded-xl shrink-0">
                      {getFileIcon(file.filetype)}
                    </div>
                    
                    {/* Main Details (Title & Summary) */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/memories/${file.id}`} className="hover:text-primary transition-colors font-bold text-sm text-foreground truncate max-w-sm md:max-w-md">
                          {file.filename}
                        </Link>
                        {file.category && (
                          <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                            {file.category}
                          </span>
                        )}
                        <span className="text-[9px] bg-secondary/60 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-muted-foreground">
                          {file.filetype.split('/')[1] || 'FILE'}
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">
                        {file.metadata?.summary || <span className="italic text-muted-foreground/60">No summary extracted.</span>}
                      </p>

                      {/* Mini pills: Tags, People, Locations */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-0.5">
                        {file.metadata?.tags && file.metadata.tags.length > 0 && (
                          <span className="truncate max-w-[200px] text-muted-foreground/85">
                            Tags: {file.metadata.tags.slice(0, 3).map(t => `#${t}`).join(', ')}
                          </span>
                        )}
                        {file.metadata?.people && file.metadata.people.length > 0 && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <User className="w-3 h-3 text-muted-foreground/75 shrink-0" />
                            {file.metadata.people.slice(0, 2).join(', ')}
                          </span>
                        )}
                        {file.metadata?.locations && file.metadata.locations.length > 0 && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <MapPin className="w-3 h-3 text-muted-foreground/75 shrink-0" />
                            {file.metadata.locations.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* List View Details (Date & Size) */}
                  <div className="flex items-center gap-6 text-[10px] text-muted-foreground shrink-0 pl-14 md:pl-0">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-muted-foreground/75" />
                      {formatSize(file.filesize)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/75" />
                      {formatDate(file.uploaded_at)}
                    </span>
                  </div>

                  {/* Hover Panel Slide-in / Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 md:opacity-0 group-hover:opacity-100 transition-all duration-300 pl-14 md:pl-0 z-10">
                    <button
                      onClick={() => handlePreview(file)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <Link
                      to={`/memories/${file.id}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Open Details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>

                    <Link
                      to="/chat"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Chat about this document"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>

                    <Link
                      to="/relationships"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Show relationships"
                    >
                      <Share2 className="w-4 h-4" />
                    </Link>

                    <button
                      onClick={() => handleDelete(file.id, file.filename)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      title="Delete Memory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-secondary rounded-lg shrink-0">
                    {getFileIcon(previewFile.filetype)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm text-foreground truncate" title={previewFile.filename}>
                      {previewFile.filename}
                    </h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                      {previewFile.filetype} • {formatSize(previewFile.filesize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${API_URL}/api/files/${previewFile.id}/raw`}
                    download={previewFile.filename}
                    className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-all"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={closePreview}
                    className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Preview Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-background/30" data-lenis-prevent>
                {previewLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Generating preview...</span>
                  </div>
                ) : previewError ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                      <X className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-xs text-foreground">Preview Failed</h4>
                    <p className="text-xs text-muted-foreground max-w-xs">{previewError}</p>
                  </div>
                ) : previewData ? (
                  <div className="w-full h-full">
                    {/* Render Image Preview */}
                    {previewData.type === 'image' && (
                      <div className="flex items-center justify-center bg-secondary/10 border border-border p-2 rounded-xl overflow-hidden max-h-[50vh]">
                        <img
                          src={`${API_URL}${previewData.url}`}
                          alt={previewFile.filename}
                          className="max-h-[48vh] w-auto object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {/* Render Text Preview */}
                    {previewData.type === 'txt' && (
                      <div className="bg-secondary/20 border border-border rounded-xl p-4 font-mono text-[11px] text-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[50vh]">
                        {previewData.content || (
                          <span className="text-muted-foreground italic">File is empty</span>
                        )}
                      </div>
                    )}

                    {/* Render PDF Metadata Preview */}
                    {previewData.type === 'pdf' && (
                      <div className="space-y-5">
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl text-primary text-xs">
                          <Info className="w-4 h-4 shrink-0" />
                          <span>PDF details and structural metadata parsed successfully.</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-secondary/20 border border-border rounded-xl p-4 space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Pages</span>
                            <p className="text-lg font-bold text-foreground">{previewData.pages}</p>
                          </div>
                          
                          {Object.entries(previewData.metadata || {}).map(([key, val]) => (
                            val && (
                              <div key={key} className="bg-secondary/15 border border-border/80 rounded-xl p-4 space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">{key}</span>
                                <p className="text-xs font-semibold text-foreground break-all">{val}</p>
                              </div>
                            )
                          ))}

                          {(!previewData.metadata || Object.keys(previewData.metadata).length === 0) && (
                            <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic">
                              No embedded document properties found in PDF.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Generic Preview (e.g. Docx) */}
                    {previewData.type === 'generic' && (
                      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                        <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground mx-auto">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-xs text-foreground">Preview Not Available</h4>
                          <p className="text-xs text-muted-foreground">
                            Deep content preview is not supported for this format. You can download the file to view it.
                          </p>
                        </div>
                        <a
                          href={`${API_URL}/api/files/${previewFile.id}/raw`}
                          download={previewFile.filename}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download File</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-secondary/10 flex justify-end">
                <button
                  onClick={closePreview}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
