import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Brain,
  FileText,
  Link2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Plus,
  Clock,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  FolderOpen,
  Network
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState({
    totalFiles: 0,
    storageUsed: 0,
    recentUploads: [],
    documentTypeDistribution: [],
    topTags: [],
    topPeople: [],
    topLocations: [],
    isProcessing: false,
    aiInsights: {
      mostDiscussedTopic: { name: 'None', count: 0, description: '' },
      mostConnectedPerson: { name: 'None', count: 0, description: '' },
      recentlyActiveLocations: { name: 'None', count: 0, description: '' },
      largestDocumentCluster: { name: 'General', count: 0, percentage: 0, description: '' },
      newestKnowledgeArea: { name: 'General', description: '' },
      naturalLanguageInsights: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const hasDemoData = statsData.recentUploads.some(doc => doc.id && doc.id.startsWith('demo_doc_'));

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`);
      setStatsData(response.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    try {
      await axios.post(`${API_URL}/api/demo/load`);
      window.dispatchEvent(new CustomEvent('refresh-data'));
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to load demo data', err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setIsDemoLoading(true);
    try {
      await axios.post(`${API_URL}/api/demo/clear`);
      window.dispatchEvent(new CustomEvent('refresh-data'));
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to clear demo data', err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const triggerReload = () => {
    fetchDashboardData();
  };

  // Poll for stats updates if documents are actively processing
  useEffect(() => {
    if (!statsData.isProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/api/dashboard/stats`);
        setStatsData(response.data);
      } catch (err) {
        console.error('Failed to poll dashboard data', err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [statsData.isProcessing]);

  useEffect(() => {
    fetchDashboardData();

    // Listen to custom refresh-data event
    const handleRefresh = () => {
      fetchDashboardData();
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Dynamic statistics
  const stats = [
    { label: 'Total Files', value: statsData.totalFiles, icon: Brain, color: 'text-violet-500 bg-violet-500/10' },
    { label: 'Storage Used', value: formatSize(statsData.storageUsed), icon: Link2, color: 'text-sky-500 bg-sky-500/10' },
    { label: 'Unique Tags', value: statsData.topTags.length, icon: Sparkles, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'People Identified', value: statsData.topPeople.length, icon: FolderOpen, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  // Dynamic recent uploads
  const recentUploads = statsData.recentUploads.map((f) => ({
    id: f.id,
    name: f.filename,
    size: formatSize(f.filesize),
    date: formatDate(f.uploaded_at),
    status: 'Ingested',
    tags: f.category ? [f.category] : ['General']
  }));

  // Document type colors
  const getTypeColor = (name) => {
    switch (name) {
      case 'PDF': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
      case 'Image': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'Text': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'Word': return 'bg-violet-500/10 text-violet-600 dark:text-violet-400';
      default: return 'bg-secondary/80 text-foreground';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Second Brain Active
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Welcome back, John</h1>
          <p className="text-sm text-muted-foreground mt-1">
            MemoryVerse AI has parsed your digital footprint. Here is your memory mapping overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerReload}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Brain
          </button>
          <button 
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Memory
          </button>
        </div>
      </div>

      {isLoading ? (
        // Skeleton Loader Mode
        <div className="space-y-8">
          {/* Stats Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="w-24 h-4 bg-muted rounded" />
                  <div className="w-8 h-8 bg-muted rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="w-16 h-8 bg-muted rounded" />
                  <div className="w-28 h-3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Grid Layout Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-pulse">
                <div className="w-32 h-5 bg-muted rounded" />
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center justify-between py-2 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded" />
                        <div className="space-y-2">
                          <div className="w-32 h-4 bg-muted rounded" />
                          <div className="w-16 h-3 bg-muted rounded" />
                        </div>
                      </div>
                      <div className="w-12 h-4 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-card border border-border rounded-xl p-6 space-y-4 animate-pulse">
                <div className="w-28 h-5 bg-muted rounded" />
                <div className="h-32 bg-muted/30 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Premium Dashboard Content
        <div className="space-y-8">
          
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border hover:border-muted-foreground/30 hover:shadow-premium rounded-xl p-5 transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-muted-foreground">{stat.label}</span>
                    <div className={`p-2 rounded-lg ${stat.color} transition-all`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-medium">
                      <span>Index refreshed live</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* AI Insights Grid Cards */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4.5 h-4.5 animate-pulse" />
              <h2 className="font-bold text-sm text-foreground uppercase tracking-wider">AI Memory Insights</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Most Discussed Topic */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 shadow-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Most Discussed Topic</span>
                  <h4 className="text-xs font-bold text-foreground mt-1.5 truncate" title={statsData.aiInsights?.mostDiscussedTopic?.name}>
                    {statsData.aiInsights?.mostDiscussedTopic?.name || "None"}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  {statsData.aiInsights?.mostDiscussedTopic?.description}
                </p>
              </div>

              {/* Card 2: Most Connected Person */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 shadow-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Most Connected Person</span>
                  <h4 className="text-xs font-bold text-foreground mt-1.5 truncate" title={statsData.aiInsights?.mostConnectedPerson?.name}>
                    {statsData.aiInsights?.mostConnectedPerson?.name || "None"}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  {statsData.aiInsights?.mostConnectedPerson?.description}
                </p>
              </div>

              {/* Card 3: Recently Active Locations */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 shadow-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Active Locations</span>
                  <h4 className="text-xs font-bold text-foreground mt-1.5 truncate" title={statsData.aiInsights?.recentlyActiveLocations?.name}>
                    {statsData.aiInsights?.recentlyActiveLocations?.name || "None"}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  {statsData.aiInsights?.recentlyActiveLocations?.description}
                </p>
              </div>

              {/* Card 4: Largest Document Cluster */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 shadow-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Largest Cluster</span>
                  <h4 className="text-xs font-bold text-foreground mt-1.5 truncate" title={statsData.aiInsights?.largestDocumentCluster?.name}>
                    {statsData.aiInsights?.largestDocumentCluster?.name || "General"}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  {statsData.aiInsights?.largestDocumentCluster?.description}
                </p>
              </div>

              {/* Card 5: Newest Knowledge Area */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 transition-all duration-300 shadow-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Newest Knowledge Area</span>
                  <h4 className="text-xs font-bold text-foreground mt-1.5 truncate" title={statsData.aiInsights?.newestKnowledgeArea?.name}>
                    {statsData.aiInsights?.newestKnowledgeArea?.name || "General"}
                  </h4>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  {statsData.aiInsights?.newestKnowledgeArea?.description}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Content Area (Columns 1 & 2) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Recent Uploads */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4.5 h-4.5 text-primary" />
                    <h2 className="font-semibold text-base">Recent Documents</h2>
                  </div>
                  <button 
                    onClick={() => navigate('/memories')}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    View all files
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {recentUploads.length > 0 ? (
                  <div className="space-y-4">
                    {recentUploads.map((file, i) => (
                      <div
                        key={file.id || i}
                        onClick={() => navigate(`/memories/${file.id}`)}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-lg border border-border/60 hover:bg-secondary/30 transition-all gap-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-secondary rounded-lg text-primary">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground hover:text-primary transition-colors">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{file.size} • Uploaded {file.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          {file.tags.map((tag) => (
                            <span key={tag} className="text-[9px] font-semibold bg-secondary/80 px-2 py-0.5 rounded-full text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {file.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-muted-foreground italic">
                    No documents uploaded yet.
                  </div>
                )}
              </div>

              {/* Dynamic Entity Lists (Top Tags, People, Locations) */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div>
                  <h2 className="font-semibold text-base">Entity Extraction Mapping</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Top parsed values from your second brain content.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Tags */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Tags</h3>
                    {statsData.topTags.length > 0 ? (
                      <div className="space-y-2">
                        {statsData.topTags.map((tag, i) => (
                          <div key={i} className="flex justify-between items-center bg-secondary/20 border border-border/80 px-3 py-1.5 rounded-lg text-xs">
                            <span className="font-semibold text-foreground truncate max-w-[110px]">{tag.name}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{tag.count} docs</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No tags processed yet.</p>
                    )}
                  </div>

                  {/* Top People */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Most Mentioned People</h3>
                    {statsData.topPeople.length > 0 ? (
                      <div className="space-y-2">
                        {statsData.topPeople.map((person, i) => (
                          <div key={i} className="flex justify-between items-center bg-secondary/20 border border-border/80 px-3 py-1.5 rounded-lg text-xs">
                            <span className="font-semibold text-foreground truncate max-w-[110px]">{person.name}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{person.count} mentions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No people identified yet.</p>
                    )}
                  </div>

                  {/* Top Locations */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Locations</h3>
                    {statsData.topLocations.length > 0 ? (
                      <div className="space-y-2">
                        {statsData.topLocations.map((loc, i) => (
                          <div key={i} className="flex justify-between items-center bg-secondary/20 border border-border/80 px-3 py-1.5 rounded-lg text-xs">
                            <span className="font-semibold text-foreground truncate max-w-[110px]">{loc.name}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{loc.count} docs</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No locations processed yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar Columns (Column 3) */}
            <div className="space-y-8">
              
              {/* AI Insights Panel */}
              <div className="bg-gradient-to-br from-primary/10 via-primary/0 to-background border border-primary/20 rounded-xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="w-4.5 h-4.5" />
                    <h2 className="font-semibold text-base">Brain Observations</h2>
                  </div>
                  {statsData.isProcessing && (
                    <span className="flex items-center gap-1 text-[9px] text-primary font-bold animate-pulse">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Analyzing...
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {statsData.aiInsights?.naturalLanguageInsights?.length > 0 ? (
                    statsData.aiInsights.naturalLanguageInsights.map((insight, i) => (
                      <div key={i} className="p-3.5 bg-card border border-border rounded-xl shadow-xs leading-relaxed hover:border-primary/10 transition-all">
                        <p className="text-[11px] font-medium text-foreground">{insight}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground italic">
                      Upload memories to generate AI second brain observations.
                    </div>
                  )}
                </div>
              </div>

              {/* Document Type Distribution (Categories replacement) */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="font-semibold text-base mb-4">Document Type Distribution</h2>
                {statsData.documentTypeDistribution.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3.5">
                    {statsData.documentTypeDistribution.map((cat) => (
                      <div key={cat.name} className="p-3 border border-border/60 rounded-lg bg-secondary/10 hover:bg-secondary/40 transition-all cursor-pointer">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getTypeColor(cat.name)}`}>
                          {cat.name}
                        </span>
                        <p className="text-base font-bold mt-2">{cat.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Files</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground italic">
                    No files found to categorize.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
