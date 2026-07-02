import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Database,
  Trash2,
  LogOut,
  HardDrive,
  Check,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Settings() {
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  // Settings Tab navigation
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'appearance' | 'storage' | 'system'

  // Profile Form States
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Storage Stats States
  const [filesCount, setFilesCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const fetchStorageStats = async () => {
    setIsStatsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/files`);
      const files = response.data || [];
      setFilesCount(files.length);
      const totalSize = files.reduce((acc, file) => acc + (file.filesize || 0), 0);
      setStorageUsed(totalSize);
    } catch (err) {
      console.error('Failed to load storage stats', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'storage') {
      fetchStorageStats();
    }
  }, [activeTab]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateProfile(displayName);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile name');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleClearUploads = async () => {
    const doubleCheck = window.confirm(
      'WARNING: This will permanently delete all uploaded files from disk and remove their metadata from the database. Are you sure you want to proceed?'
    );
    if (!doubleCheck) return;

    try {
      const response = await axios.delete(`${API_URL}/api/files`);
      toast.success(response.data?.message || 'Uploads cleared successfully');
      setFilesCount(0);
      setStorageUsed(0);
      window.dispatchEvent(new Event('refresh-data'));
    } catch (err) {
      toast.error('Failed to clear uploads');
    }
  };

  const handleResetDatabase = async () => {
    const doubleCheck = window.confirm(
      'CRITICAL WARNING: This will completely reset the database. It will delete all document logs, clear all relationship graph nodes/edges, and wipe disk file storage. Are you sure?'
    );
    if (!doubleCheck) return;

    try {
      const response = await axios.post(`${API_URL}/api/system/reset-db`);
      // Clear chatbot history
      const { useChatStore } = await import('../store/chatStore');
      useChatStore.getState().clearConversation();

      toast.success(response.data?.message || 'Database reset successfully');
      setFilesCount(0);
      setStorageUsed(0);
      window.dispatchEvent(new Event('refresh-data'));
    } catch (err) {
      toast.error('Failed to reset database');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'appearance', name: 'Appearance', icon: Sun },
    { id: 'storage', name: 'Storage', icon: HardDrive },
    { id: 'system', name: 'System', icon: Database }
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent flex items-center gap-2.5">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal profile, application aesthetics, storage, and system data.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 bg-card border border-border rounded-xl p-3 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible shrink-0">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all shrink-0 md:shrink-1 ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display Area */}
        <div className="flex-1 w-full bg-card border border-border rounded-xl p-6 md:p-8 shadow-xs min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Profile Settings</h2>
                    <p className="text-xs text-muted-foreground mt-1">Update your display information and personal details.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5 max-w-md">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground/80">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-secondary/30 border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground/80">Email Address</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3.5 py-2.5 text-xs bg-secondary/15 border border-border/80 text-muted-foreground rounded-lg cursor-not-allowed"
                      />
                      <p className="text-[10px] text-muted-foreground">Your account email is locked and managed via security credentials.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        'Save Profile'
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* APPEARANCE TAB */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Appearance</h2>
                    <p className="text-xs text-muted-foreground mt-1">Customize the user interface theme to your preference.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
                    {/* Light Mode Card */}
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
                        theme === 'light'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-secondary/10 hover:border-border/80 hover:bg-secondary/20 text-muted-foreground'
                      }`}
                    >
                      <Sun className="w-6 h-6" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Light Mode</span>
                        {theme === 'light' && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {/* Dark Mode Card */}
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-secondary/10 hover:border-border/80 hover:bg-secondary/20 text-muted-foreground'
                      }`}
                    >
                      <Moon className="w-6 h-6" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Dark Mode</span>
                        {theme === 'dark' && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {/* System Default Card */}
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center ${
                        theme === 'system'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-secondary/10 hover:border-border/80 hover:bg-secondary/20 text-muted-foreground'
                      }`}
                    >
                      <Monitor className="w-6 h-6" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">System Default</span>
                        {theme === 'system' && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STORAGE TAB */}
              {activeTab === 'storage' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Storage Management</h2>
                    <p className="text-xs text-muted-foreground mt-1">Monitor the disk footprints of uploaded files and clean assets.</p>
                  </div>

                  {isStatsLoading ? (
                    <div className="flex flex-col items-center py-10 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Calculating storage usage...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl">
                        <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Uploaded Files</span>
                          <p className="text-xl font-bold text-foreground">{filesCount}</p>
                        </div>
                        <div className="bg-secondary/20 border border-border p-4 rounded-xl space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Disk Space Occupied</span>
                          <p className="text-xl font-bold text-foreground">{formatSize(storageUsed)}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl max-w-xl space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-destructive">Wipe Local Upload Directory</h4>
                          <p className="text-[11px] text-muted-foreground">
                            This action deletes the raw contents of all uploaded documents and image data. Database indices will be cleared.
                          </p>
                        </div>
                        <button
                          onClick={handleClearUploads}
                          disabled={filesCount === 0}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear Uploads</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SYSTEM TAB */}
              {activeTab === 'system' && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-base font-bold text-foreground">System Preferences & Actions</h2>
                    <p className="text-xs text-muted-foreground mt-1">Perform global database resetting or exit active session tokens.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Database Reset Action */}
                    <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-destructive">Factory Reset Database</h4>
                        <p className="text-[11px] text-muted-foreground">
                          Clears all documents, graph node networks, edges, timeline activities, and system records. The local SQLite database tables will be cleared.
                        </p>
                      </div>
                      <button
                        onClick={handleResetDatabase}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-sm"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>Reset Database</span>
                      </button>
                    </div>

                    {/* Session Logout Action */}
                    <div className="p-4 bg-secondary/20 border border-border rounded-xl space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-foreground">Sign Out of Session</h4>
                        <p className="text-[11px] text-muted-foreground">
                          Safely clear all cached browser authorization tokens and sign out of your profile session.
                        </p>
                      </div>
                      <button
                        onClick={logout}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-all"
                      >
                        <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
