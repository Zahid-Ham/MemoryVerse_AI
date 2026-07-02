import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import OnboardingTour from '../OnboardingTour';
import CommandPalette from '../CommandPalette';
import {
  LayoutDashboard,
  UploadCloud,
  Brain,
  Calendar,
  Network,
  MessageSquare,
  Settings as SettingsIcon,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  ChevronRight,
  User,
  LogOut,
  Bell,
  RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/upload', label: 'Upload Files', icon: UploadCloud },
  { path: '/memories', label: 'Memories', icon: Brain },
  { path: '/search', label: 'Search Console', icon: Search },
  { path: '/timeline', label: 'Timeline', icon: Calendar },
  { path: '/relationships', label: 'Relationships', icon: Network },
  { path: '/chat', label: 'Chat Assistant', icon: MessageSquare },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Command palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowSearchDropdown(true);
    try {
      const res = await axios.get(`${API_URL}/api/search`, { params: { q: val } });
      setSearchResults(res.data);
    } catch (err) {
      console.error('Global search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'U';

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
  };

  // Generate breadcrumbs based on the active path
  const pathnames = location.pathname.split('/').filter((x) => x);
  const activeItem = navItems.find((item) => item.path === location.pathname);

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm shadow-primary/20">
            M
          </div>
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
            MemoryVerse AI
          </span>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm font-semibold">
              {userInitials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-50 flex flex-col md:hidden"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                    M
                  </div>
                  <span className="font-semibold text-lg tracking-tight">MemoryVerse AI</span>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 py-6 px-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-secondary text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm font-semibold">
                    {userInitials}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-semibold truncate">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center text-sm text-muted-foreground gap-1.5">
              <span>Workspace</span>
              <ChevronRight className="w-3.5 h-3.5" />
              {pathnames.map((value, index) => {
                const isLast = index === pathnames.length - 1;
                const label = navItems.find((item) => item.path.includes(value))?.label || value;
                return (
                  <div key={value} className="flex items-center gap-1.5">
                    <span className={isLast ? 'text-foreground font-medium' : ''}>
                      {label}
                    </span>
                    {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search, Notifications, Theme and User Menu */}
          <div className="flex items-center gap-3">
            
            {/* Search Bar */}
            <div className="relative hidden md:block w-72 z-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
                className="w-full pl-9 pr-14 py-1.5 rounded-lg text-sm bg-secondary/60 border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all cursor-pointer"
                onClick={() => setIsCommandPaletteOpen(true)}
                readOnly
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-card text-[9px] font-mono text-muted-foreground shadow-xs pointer-events-none select-none">
                Ctrl K
              </kbd>
              
              <AnimatePresence>
                {showSearchDropdown && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowSearchDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-96 bg-popover border border-border rounded-xl shadow-xl py-2 z-50 max-h-[350px] overflow-y-auto divide-y divide-border/60" data-lenis-prevent
                    >
                      {isSearching ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Searching database...
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((result) => (
                          <div key={result.id} className="p-3.5 hover:bg-secondary/40 transition-colors flex items-start justify-between gap-3 text-left">
                            <div className="space-y-1 flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-foreground truncate" title={result.title}>
                                {result.title}
                              </h4>
                              <p className="text-[10px] text-muted-foreground font-medium italic truncate" title={result.matched_reason}>
                                {result.matched_reason}
                              </p>
                              <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 uppercase tracking-wider">
                                {result.document_type ? (result.document_type.split('/')[-1] || 'FILE').toUpperCase() : 'FILE'}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setShowSearchDropdown(false);
                                setSearchQuery('');
                                navigate(`/memories/${result.id}`);
                              }}
                              className="px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded hover:bg-primary-hover shadow-xs shrink-0 self-center"
                            >
                              Open
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground italic text-center">
                          No ranked matches found.
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Button */}
            <button className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground relative transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-muted-foreground text-sm font-semibold hover:ring-2 hover:ring-primary/20 transition-all"
              >
                {userInitials}
              </button>
              <AnimatePresence>
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1.5 z-50 origin-top-right"
                    >
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-xs font-semibold">{user?.name || 'User'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-secondary flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <User className="w-3.5 h-3.5" />
                        My Profile
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-secondary flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <SettingsIcon className="w-3.5 h-3.5" />
                        Account Settings
                      </button>
                      <hr className="border-border my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-secondary flex items-center gap-2 text-destructive hover:bg-destructive/5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content with framer-motion transitions */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Polish Overlays */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <OnboardingTour />
    </div>
  );
}
