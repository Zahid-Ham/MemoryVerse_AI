import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Clock,
  Filter,
  FileText,
  Activity,
  List,
  Grid,
  HardDrive,
  FileImage,
  RefreshCw,
  FolderOpen,
  Search,
  Tag,
  User,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Timeline() {
  const [activeMode, setActiveMode] = useState('chrono'); // 'chrono' | 'topic' | 'person' | 'location'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedEmotion, setSelectedEmotion] = useState('all');
  
  // Data states
  const [timelineData, setTimelineData] = useState({ activity_feed: [], grouped: {} });
  const [availableFilters, setAvailableFilters] = useState({
    tags: [],
    people: [],
    locations: [],
    emotions: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Group expand/collapse state
  const [expandedGroups, setExpandedGroups] = useState({});

  // Fetch timeline data from FastAPI
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (selectedTag !== 'all') params.tag = selectedTag;
      if (selectedPerson !== 'all') params.person = selectedPerson;
      if (selectedLocation !== 'all') params.location = selectedLocation;
      if (selectedEmotion !== 'all') params.emotion = selectedEmotion;

      const res = await axios.get(`${API_URL}/api/timeline`, { params });
      setTimelineData(res.data);
      if (res.data.available_filters) {
        setAvailableFilters(res.data.available_filters);
      }
    } catch (err) {
      console.error('Error fetching timeline data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
    };
  }, [selectedTag, selectedPerson, selectedLocation, selectedEmotion]);

  const getFileIcon = (filetype) => {
    if (!filetype) return <FileText className="w-4 h-4 text-purple-500 font-semibold" />;
    if (filetype.startsWith('image/')) {
      return <FileImage className="w-4 h-4 text-emerald-500 font-semibold" />;
    }
    if (filetype === 'application/pdf') {
      return <FileText className="w-4 h-4 text-rose-500 font-semibold" />;
    }
    if (filetype === 'text/plain') {
      return <FileText className="w-4 h-4 text-blue-500 font-semibold" />;
    }
    return <FileText className="w-4 h-4 text-purple-500 font-semibold" />;
  };

  // Milestone check logic
  const isMilestone = (item) => {
    const milestoneKeywords = [
      'milestone', 'graduation', 'graduated', 'degree', 'award', 'certificate', 
      'certification', 'hired', 'joined', 'offer', 'started', 'completed', 
      'launch', 'launched', 'promotion', 'promoted', 'first day', 'achievement',
      'internship', 'interview'
    ];
    const text = `${item.title} ${item.summary || ''}`.toLowerCase();
    return milestoneKeywords.some(keyword => text.includes(keyword));
  };

  // Client-side Search Filter
  const filteredFeed = React.useMemo(() => {
    let feed = timelineData.activity_feed || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      feed = feed.filter(item => 
        item.title.toLowerCase().includes(q) || 
        (item.summary && item.summary.toLowerCase().includes(q))
      );
    }
    return feed;
  }, [timelineData.activity_feed, searchQuery]);

  // Client-side grouping based on activeMode
  const groups = React.useMemo(() => {
    const grps = {};
    filteredFeed.forEach((item) => {
      if (activeMode === 'chrono') {
        const date = new Date(item.created_at || item.uploaded_at);
        const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        if (!grps[label]) grps[label] = [];
        grps[label].push(item);
      } else if (activeMode === 'topic') {
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach((tag) => {
            const label = `#${tag}`;
            if (!grps[label]) grps[label] = [];
            grps[label].push(item);
          });
        } else {
          if (!grps['Untagged']) grps['Untagged'] = [];
          grps['Untagged'].push(item);
        }
      } else if (activeMode === 'person') {
        if (item.people && item.people.length > 0) {
          item.people.forEach((p) => {
            const label = p;
            if (!grps[label]) grps[label] = [];
            grps[label].push(item);
          });
        } else {
          if (!grps['Unspecified People']) grps['Unspecified People'] = [];
          grps['Unspecified People'].push(item);
        }
      } else if (activeMode === 'location') {
        if (item.locations && item.locations.length > 0) {
          item.locations.forEach((l) => {
            const label = l;
            if (!grps[label]) grps[label] = [];
            grps[label].push(item);
          });
        } else {
          if (!grps['Unspecified Locations']) grps['Unspecified Locations'] = [];
          grps['Unspecified Locations'].push(item);
        }
      }
    });
    return grps;
  }, [filteredFeed, activeMode]);

  // Expand all groups by default on mode/group changes
  useEffect(() => {
    const initialExpanded = {};
    Object.keys(groups).forEach(key => {
      initialExpanded[key] = true;
    });
    setExpandedGroups(initialExpanded);
  }, [activeMode, groups]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getModeIcon = () => {
    switch (activeMode) {
      case 'chrono': return <Clock className="w-4 h-4" />;
      case 'topic': return <Tag className="w-4 h-4" />;
      case 'person': return <User className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">Memory Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and reconstruct the chronological map of your digital assets.
          </p>
        </div>

        {/* Mode Toggles */}
        <div className="flex bg-secondary/80 p-1 rounded-lg border border-border self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setActiveMode('chrono')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'chrono'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Chronological
          </button>
          <button
            onClick={() => setActiveMode('topic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'topic'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            By Topic
          </button>
          <button
            onClick={() => setActiveMode('person')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'person'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            By Person
          </button>
          <button
            onClick={() => setActiveMode('location')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeMode === 'location'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            By Location
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents or activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-secondary border border-border focus:border-primary focus:outline-none transition-all font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              Filters:
            </span>

            {/* People Filter */}
            <div className="relative">
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary appearance-none cursor-pointer font-medium"
              >
                <option value="all">All People</option>
                {availableFilters.people.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Tags Filter */}
            <div className="relative">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary appearance-none cursor-pointer font-medium"
              >
                <option value="all">All Tags</option>
                {availableFilters.tags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Locations Filter */}
            <div className="relative">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary appearance-none cursor-pointer font-medium"
              >
                <option value="all">All Locations</option>
                {availableFilters.locations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Emotions Filter */}
            <div className="relative">
              <select
                value={selectedEmotion}
                onChange={(e) => setSelectedEmotion(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary appearance-none cursor-pointer font-medium"
              >
                <option value="all">All Emotions</option>
                {availableFilters.emotions.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {(selectedTag !== 'all' || selectedPerson !== 'all' || selectedLocation !== 'all' || selectedEmotion !== 'all' || searchQuery.trim() !== '') && (
              <button
                onClick={() => {
                  setSelectedTag('all');
                  setSelectedPerson('all');
                  setSelectedLocation('all');
                  setSelectedEmotion('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-primary hover:underline ml-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground font-semibold flex items-center justify-between">
          <span>Showing {filteredFeed.length} activities</span>
          <span>Active Mode: <span className="text-primary capitalize">{activeMode}</span></span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 space-y-4 animate-pulse">
              <div className="w-24 h-4 bg-muted rounded" />
              <div className="flex gap-4">
                <div className="w-2 h-16 bg-muted rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="w-48 h-5 bg-muted rounded" />
                  <div className="w-full h-8 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="text-center py-20 bg-card border border-dashed border-border rounded-2xl max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mx-auto">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">No activity recorded</h3>
            <p className="text-xs text-muted-foreground mt-1">
              There are no uploads matching your current filter choices or search.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-96 space-y-6">
          {Object.entries(groups).map(([groupTitle, items]) => {
            const isExpanded = expandedGroups[groupTitle] !== false;
            
            return (
              <div key={groupTitle} className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
                {/* Collapsible Group Header */}
                <button
                  onClick={() => toggleGroup(groupTitle)}
                  className="w-full flex items-center justify-between p-4.5 bg-secondary/20 hover:bg-secondary/40 border-b border-border/50 transition-all text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="text-primary">
                      {getModeIcon()}
                    </div>
                    <span className="font-bold text-sm text-foreground">{groupTitle}</span>
                    <span className="text-[10px] bg-secondary/80 border border-border text-muted-foreground px-2 py-0.5 rounded-full font-bold">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                    )}
                  </div>
                </button>

                {/* Collapsible Content Section */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 pl-8 space-y-6 border-l-2 border-border/60 ml-6 my-4">
                        {items.map((item) => {
                          const milestone = isMilestone(item);
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`relative p-5 rounded-xl transition-all duration-300 border ${
                                milestone 
                                  ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 shadow-sm' 
                                  : 'bg-card border-border/80 hover:border-primary/20 shadow-xs'
                              }`}
                            >
                              {/* Left Timeline Connection dot */}
                              <div className={`absolute -left-[39px] top-6 w-3 h-3 rounded-full border-4 border-card transition-all ${
                                milestone ? 'bg-amber-500 scale-110 shadow-xs shadow-amber-500/50' : 'bg-border'
                              }`} />

                              {/* Card Body */}
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                <div className="space-y-2.5 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : ''}
                                    </span>
                                    {milestone && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        Milestone
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                                    {getFileIcon(item.type)}
                                    {item.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                                  
                                  {/* Badges details */}
                                  <div className="flex flex-wrap gap-1.5 pt-2">
                                    {item.tags?.map((tag) => (
                                      <span key={tag} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold border border-primary/10">
                                        #{tag}
                                      </span>
                                    ))}
                                    {item.people?.map((p) => (
                                      <span key={p} className="text-[9px] bg-secondary text-foreground px-2 py-0.5 rounded font-bold border border-border">
                                        @{p}
                                      </span>
                                    ))}
                                    {item.locations?.map((l) => (
                                      <span key={l} className="text-[9px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded font-bold border border-indigo-500/15">
                                        📍 {l}
                                      </span>
                                    ))}
                                    {item.emotions?.map((e) => (
                                      <span key={e} className="text-[9px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold border border-rose-500/15 uppercase tracking-wider">
                                        {e}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <span className="text-[9px] bg-secondary/60 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-muted-foreground self-start shrink-0 border border-border/80">
                                  {item.type ? item.type.split('/')[1]?.toUpperCase() : 'FILE'}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
