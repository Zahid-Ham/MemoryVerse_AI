import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  UploadCloud,
  File,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Database
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const fileInputRef = useRef(null);
  const activeIntervals = useRef({});

  useEffect(() => {
    return () => {
      Object.values(activeIntervals.current).forEach(clearInterval);
    };
  }, []);

  const [isImportingDemo, setIsImportingDemo] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [hasDemoData, setHasDemoData] = useState(false);

  const checkDemoData = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/files`);
      const hasDemo = res.data.some(doc => doc.id && doc.id.startsWith('demo_doc_'));
      setHasDemoData(hasDemo);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkDemoData();
  }, []);

  const handleImportDemo = async () => {
    setIsImportingDemo(true);
    try {
      await axios.post(`${API_URL}/api/demo/load`);
      setShowSuccessAnim(true);
      window.dispatchEvent(new Event('refresh-data'));
      await checkDemoData();
      setTimeout(() => setShowSuccessAnim(false), 3500);
    } catch (err) {
      console.error("Demo dataset import failed", err);
    } finally {
      setIsImportingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    setIsImportingDemo(true);
    try {
      await axios.post(`${API_URL}/api/demo/clear`);
      window.dispatchEvent(new Event('refresh-data'));
      await checkDemoData();
    } catch (err) {
      console.error("Demo dataset clear failed", err);
    } finally {
      setIsImportingDemo(false);
    }
  };

  // Get matching icon based on file type
  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return FileText;
    if (fileType.includes('image')) return ImageIcon;
    return File;
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  // Handle input change
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      addFilesToQueue(Array.from(e.target.files));
    }
  };

  // Add files to current upload queue
  const addFilesToQueue = (files) => {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp'
    ];

    const newItems = files.map((file) => {
      const isSupported = supportedTypes.includes(file.type);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        progress: 0,
        status: isSupported ? 'pending' : 'error',
        error: isSupported ? null : 'Unsupported format. Upload PDF, DOCX, TXT, or images.'
      };
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
  };

  // Trigger individual file upload
  const uploadFile = async (item) => {
    if (item.status === 'success') return;

    setUploadQueue((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 10, error: null } : i))
    );

    const formData = new FormData();
    formData.append('files', item.file);

    try {
      const response = await axios.post(`${API_URL}/api/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadQueue((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: Math.max(progress, 15) } : i))
          );
        },
      });

      // Backend returns results mapping
      const result = response.data.results[0];
      if (result.status === 'success') {
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', docId: result.id, progress: 100, processingStage: 'Queued' } : i))
        );
        pollDocumentStatus(item.id, result.id);
      } else {
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: result.error } : i))
        );
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail?.[0]?.error || err.message || 'Connection failed';
      setUploadQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: errMsg } : i))
      );
    }
  };

  const pollDocumentStatus = (queueItemId, backendDocId) => {
    if (activeIntervals.current[queueItemId]) {
      clearInterval(activeIntervals.current[queueItemId]);
    }

    const intervalId = setInterval(async () => {
      try {
        const statusRes = await axios.get(`${API_URL}/api/documents/${backendDocId}/status`);
        const { status, error_message } = statusRes.data;

        if (status === 'Completed') {
          clearInterval(intervalId);
          delete activeIntervals.current[queueItemId];
          setUploadQueue((prev) =>
            prev.map((i) => (i.id === queueItemId ? { ...i, status: 'success', progress: 100 } : i))
          );
          window.dispatchEvent(new Event('refresh-data'));
        } else if (status === 'Failed') {
          clearInterval(intervalId);
          delete activeIntervals.current[queueItemId];
          setUploadQueue((prev) =>
            prev.map((i) => (i.id === queueItemId ? { ...i, status: 'error', error: error_message || 'Processing failed' } : i))
          );
        } else {
          setUploadQueue((prev) =>
            prev.map((i) => (i.id === queueItemId ? { ...i, processingStage: status } : i))
          );
        }
      } catch (err) {
        console.error("Error polling document status", err);
      }
    }, 1500);

    activeIntervals.current[queueItemId] = intervalId;
  };

  const retryProcessing = async (item) => {
    setUploadQueue((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', error: null, processingStage: 'Queued' } : i))
    );

    try {
      await axios.post(`${API_URL}/api/documents/${item.docId}/retry`);
      pollDocumentStatus(item.id, item.docId);
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Retry failed';
      setUploadQueue((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: errMsg } : i))
      );
    }
  };

  // Upload all pending items in the queue
  const uploadAll = () => {
    uploadQueue.forEach((item) => {
      if (item.status === 'pending') {
        uploadFile(item);
      } else if (item.status === 'error') {
        if (item.docId) {
          retryProcessing(item);
        } else {
          uploadFile(item);
        }
      }
    });
  };

  // Clear specific item from queue
  const clearItem = (id) => {
    if (activeIntervals.current[id]) {
      clearInterval(activeIntervals.current[id]);
      delete activeIntervals.current[id];
    }
    setUploadQueue((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Memories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ingest new documents, notes, or media. Your AI assistant will organize and connect them to your space.
          </p>
        </div>
        {hasDemoData ? (
          <button
            onClick={handleClearDemo}
            disabled={isImportingDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImportingDemo ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Clear Demo Data
          </button>
        ) : (
          <button
            onClick={handleImportDemo}
            disabled={isImportingDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImportingDemo ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            Import Demo Dataset
          </button>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-primary bg-primary/5 scale-[0.99]'
            : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleChange}
          onClick={(e) => { e.target.value = ''; }}
          className="hidden"
          accept=".pdf,.docx,.txt,image/*"
        />
        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all">
          <UploadCloud className="w-6 h-6 text-primary" />
        </div>
        <h3 className="font-semibold mt-4 text-sm">Drag and drop files here, or click to select</h3>
        <p className="text-xs text-muted-foreground mt-1.5">
          Supports PDF, DOCX, TXT, or images (up to 20MB)
        </p>
      </div>

      {/* Upload Queue Panel */}
      {uploadQueue.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Upload Queue ({uploadQueue.length} files)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setUploadQueue([])}
                className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium rounded hover:bg-secondary"
              >
                Clear all
              </button>
              <button
                onClick={uploadAll}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover shadow-sm"
              >
                Upload Pending
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {uploadQueue.map((item) => {
                const Icon = getFileIcon(item.file.type);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 border border-border/80 rounded-xl bg-secondary/15 flex items-center justify-between gap-4 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-secondary rounded-lg text-primary shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-semibold truncate text-foreground">{item.name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{item.size}</span>
                        </div>

                        {/* Progress Bar */}
                        {item.status === 'uploading' && (
                          <div className="w-full bg-secondary/80 h-1 rounded-full overflow-hidden">
                            <motion.div
                              className="bg-primary h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              transition={{ duration: 0.1 }}
                            />
                          </div>
                        )}

                        {/* Error Indicator */}
                        {item.status === 'error' && (
                          <p className="text-[10px] text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions and Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => uploadFile(item)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-all"
                        >
                          Upload
                        </button>
                      )}

                      {item.status === 'processing' && (
                        <span className="text-[10px] text-primary font-semibold flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {item.processingStage || 'Processing'}
                        </span>
                      )}

                      {item.status === 'success' && (
                        <span className="text-emerald-500 flex items-center gap-1 text-[10px] font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          ✓ Ready for Search
                        </span>
                      )}

                      {item.status === 'error' && (
                        <button
                          onClick={() => {
                            if (item.docId) {
                              retryProcessing(item);
                            } else {
                              uploadFile(item);
                            }
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                          title="Retry"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => clearItem(item.id)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-secondary"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </motion.div>
              </div>
              <h3 className="text-lg font-bold text-foreground">Import Successful</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The AI is currently index-categorizing three sample documents in the background. Check your dashboard or chat assistant to see them map!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
