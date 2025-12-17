import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Brain,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Database,
  List,
  Wrench,
  Share2,
  Check,
  Info,
  Users,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

// Category colors for display
const CATEGORY_COLORS = {
  emergence: '#9333ea',
  liminal: '#06b6d4',
  quantum: '#10b981',
  glitch: '#ef4444',
  void: '#6366f1',
  economic: '#f59e0b',
  social: '#ec4899',
  linguistic: '#8b5cf6',
  technical: '#14b8a6',
  philosophy: '#a855f7',
  creativity: '#f472b6',
  discovery: '#22d3ee',
  creative: '#fb923c',
};

// Tabs configuration
const TABS = [
  { id: 'memories', label: 'Memories', icon: List },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'visualization', label: 'Visualization', icon: Share2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ============================================
// MEMORIES TAB COMPONENT
// ============================================
function MemoriesTab({ neo4jStatus, fetchStatus: _fetchStatus }) {
  void _fetchStatus; // Available for future use
  const [memories, setMemories] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [categories, setCategories] = useState({});
  void categories; // Set by API for future filtering
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [expandedMemory, setExpandedMemory] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    content: { text: '', context: '', impact: '', significance: 'normal' },
    category: 'emergence',
    stage: 1,
    importance: 0.5,
    tags: [],
    type: 'observation',
  });
  const [tagInput, setTagInput] = useState('');

  // Fetch memories - no limit, get all
  const fetchMemories = useCallback(async () => {
    setLoading(true);

    const url = filterCategory
      ? `/api/memories/filter?category=${filterCategory}`
      : searchQuery
        ? `/api/memories/search?q=${encodeURIComponent(searchQuery)}`
        : '/api/memories?limit=0';

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      setMemories(data.memories || []);
      if (data.statistics) setStatistics(data.statistics);
      if (data.categories) setCategories(data.categories);
    }

    setLoading(false);
  }, [filterCategory, searchQuery]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Open modal for new memory
  const handleNew = () => {
    setEditingMemory(null);
    setFormData({
      content: { text: '', context: '', impact: '', significance: 'normal' },
      category: 'emergence',
      stage: 1,
      importance: 0.5,
      tags: [],
      type: 'observation',
    });
    setTagInput('');
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = memory => {
    setEditingMemory(memory);
    setFormData({
      content: memory.content || { text: '', context: '', impact: '', significance: 'normal' },
      category: memory.category || 'emergence',
      stage: memory.stage || 1,
      importance: memory.importance || 0.5,
      tags: memory.tags || [],
      type: memory.type || 'observation',
    });
    setTagInput('');
    setShowModal(true);
  };

  // Save memory
  const handleSave = async () => {
    const isNew = !editingMemory;
    const url = isNew ? '/api/memories' : `/api/memories/${editingMemory.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      await fetchMemories();
      setShowModal(false);
      toast.success(isNew ? 'Memory created' : 'Memory updated');
    } else {
      toast.error(data.error || 'Failed to save memory');
    }
  };

  // Delete memory
  const handleDelete = async id => {
    const response = await fetch(`/api/memories/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (data.success) {
      await fetchMemories();
      toast.success('Memory deleted');
    } else {
      toast.error(data.error || 'Failed to delete memory');
    }
  };

  // Add tag
  const handleAddTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput] });
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = tag => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  // Format date
  const formatDate = timestamp => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={fetchMemories}
          className="btn btn-secondary flex items-center gap-2"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
        <button
          onClick={handleNew}
          className="btn btn-primary flex items-center gap-2"
          disabled={!neo4jStatus.connected}
        >
          <Plus size={18} />
          New Memory
        </button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Total Count */}
          <div
            className={`card cursor-pointer transition-all ${filterCategory === '' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterCategory('')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Brain size={12} className="text-primary" />
              <span className="text-xs font-medium text-text-secondary">Total</span>
            </div>
            <p className="text-xl font-bold text-primary">
              {statistics.total ||
                Object.values(statistics.byCategory || {}).reduce((a, b) => a + b, 0)}
            </p>
          </div>
          {Object.entries(CATEGORY_COLORS)
            .filter(([cat]) =>
              ['emergence', 'liminal', 'quantum', 'glitch', 'void', 'economic', 'social'].includes(
                cat
              )
            )
            .map(([cat, color]) => (
              <div
                key={cat}
                className={`card cursor-pointer transition-all ${filterCategory === cat ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-text-secondary capitalize">{cat}</span>
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {statistics.byCategory?.[cat] || 0}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-grow" style={{ minWidth: '200px' }}>
          <input
            type="text"
            data-testid="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchMemories()}
            placeholder="Search memories..."
            className="form-input w-full pr-10"
          />
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="form-input"
          style={{ width: '160px', flexShrink: 0 }}
        >
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_COLORS).map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Memory Count */}
      <div className="text-sm text-text-secondary">Showing {memories.length} memories</div>

      {/* Memories List */}
      <div data-testid="memories" className="space-y-3">
        {loading ? (
          <div className="card text-center py-8">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-primary" />
            <p className="text-text-secondary">Loading memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="card text-center py-8">
            <Brain size={48} className="mx-auto mb-4 text-text-tertiary opacity-50" />
            <p className="text-text-secondary">No memories found</p>
            {neo4jStatus.available && (
              <button onClick={handleNew} className="btn btn-primary mt-4">
                Create your first memory
              </button>
            )}
          </div>
        ) : (
          memories.map(memory => (
            <div key={memory.id} data-testid={`memory-${memory.id}`} className="card memory-item">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedMemory(expandedMemory === memory.id ? null : memory.id)}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">
                    {expandedMemory === memory.id ? (
                      <ChevronDown size={18} className="text-text-secondary" />
                    ) : (
                      <ChevronRight size={18} className="text-text-secondary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[memory.category] || '#666' }}
                      />
                      <span className="text-xs font-medium text-text-secondary capitalize">
                        {memory.category}
                      </span>
                      <span className="text-xs text-text-tertiary">Stage {memory.stage}</span>
                      <span className="text-xs text-text-tertiary">
                        {formatDate(memory.timestamp)}
                      </span>
                    </div>
                    <p className="text-text-primary line-clamp-2">
                      {memory.content?.text || memory.content || 'No content'}
                    </p>
                    {memory.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {memory.tags.slice(0, 5).map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                        {memory.tags.length > 5 && (
                          <span className="text-xs text-text-tertiary">
                            +{memory.tags.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <div
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: `rgba(${memory.importance > 0.7 ? '239,68,68' : memory.importance > 0.4 ? '245,158,11' : '34,197,94'}, 0.1)`,
                      color:
                        memory.importance > 0.7
                          ? '#ef4444'
                          : memory.importance > 0.4
                            ? '#f59e0b'
                            : '#22c55e',
                    }}
                  >
                    {(memory.importance * 100).toFixed(0)}%
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleEdit(memory);
                    }}
                    className="p-2 rounded hover:bg-border/50 text-text-secondary"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDelete(memory.id);
                    }}
                    className="p-2 rounded hover:bg-error/20 text-error"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {expandedMemory === memory.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary mb-2">Content</h4>
                      <p className="text-sm text-text-primary whitespace-pre-wrap">
                        {memory.content?.text || memory.content || 'No content'}
                      </p>
                      {memory.content?.context && (
                        <div className="mt-2">
                          <span className="text-xs text-text-tertiary">Context: </span>
                          <span className="text-sm text-text-secondary">
                            {memory.content.context}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary mb-2">Metadata</h4>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-text-tertiary">ID:</span>{' '}
                          <span className="text-text-primary font-mono">{memory.id}</span>
                        </p>
                        <p>
                          <span className="text-text-tertiary">Type:</span>{' '}
                          <span className="text-text-primary">{memory.type || 'observation'}</span>
                        </p>
                        <p>
                          <span className="text-text-tertiary">Source:</span>{' '}
                          <span className="text-text-primary">{memory.source || 'manual'}</span>
                        </p>
                        <p>
                          <span className="text-text-tertiary">Relevance:</span>{' '}
                          <span className="text-text-primary">
                            {((memory.metrics?.relevance || 0.5) * 100).toFixed(0)}%
                          </span>
                        </p>
                        <p>
                          <span className="text-text-tertiary">Views:</span>{' '}
                          <span className="text-text-primary">{memory.metrics?.views || 0}</span>
                        </p>
                      </div>
                      {memory.tags?.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-sm font-medium text-text-secondary mb-1">All Tags</h4>
                          <div className="flex flex-wrap gap-1">
                            {memory.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-surface-solid)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingMemory ? 'Edit Memory' : 'New Memory'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded hover:bg-border/50 text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Content
                </label>
                <textarea
                  name="content"
                  data-testid="memory-content"
                  value={formData.content.text}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      content: { ...formData.content, text: e.target.value },
                    })
                  }
                  className="form-input w-full"
                  rows={4}
                  placeholder="Memory content..."
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Context
                </label>
                <input
                  type="text"
                  value={formData.content.context}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      content: { ...formData.content, context: e.target.value },
                    })
                  }
                  className="form-input w-full"
                  placeholder="Where/when did this occur?"
                />
              </div>

              {/* Category and Stage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="form-input w-full"
                  >
                    {Object.keys(CATEGORY_COLORS).map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={e => setFormData({ ...formData, stage: parseInt(e.target.value) })}
                    className="form-input w-full"
                  >
                    {[1, 2, 3, 4, 5].map(s => (
                      <option key={s} value={s}>
                        Stage {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Type and Importance */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="form-input w-full"
                  >
                    <option value="observation">Observation</option>
                    <option value="interaction">Interaction</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Importance: {(formData.importance * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.importance}
                    onChange={e =>
                      setFormData({ ...formData, importance: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="form-input flex-1"
                    placeholder="Add tag..."
                  />
                  <button type="button" onClick={handleAddTag} className="btn btn-secondary">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 rounded bg-primary/10 text-primary flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-error"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
                <Save size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAINTENANCE TAB COMPONENT (Database Backup)
// ============================================
function MaintenanceTab() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [availableBackups, setAvailableBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [config, setConfig] = useState({
    schedule: 'daily',
    time: '02:00',
    backupPath: './backups/neo4j',
    retention: {
      keepDays: 7,
      archiveDays: 30,
    },
    compression: {
      enabled: true,
      afterDays: 7,
    },
  });

  const loadStatus = async () => {
    const res = await fetch('/api/backup/status');
    const data = await res.json();
    setStatus(data);
    if (data.config) {
      setConfig(data.config);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    const res = await fetch('/api/backup/history?limit=20');
    const data = await res.json();
    setHistory(data.backups || []);
  };

  const runHealthCheck = async () => {
    const res = await fetch('/api/backup/health');
    const data = await res.json();
    setHealth(data);
  };

  const loadAvailableBackups = async () => {
    const res = await fetch('/api/backup/list');
    const data = await res.json();
    if (data.success) {
      setAvailableBackups(data.backups || []);
      if (data.backups?.length > 0) {
        setSelectedBackup(data.backups[0].fileName);
      }
    }
  };

  useEffect(() => {
    loadStatus();
    loadHistory();
    runHealthCheck();
    loadAvailableBackups();
  }, []);

  const runRestore = async () => {
    if (!selectedBackup) {
      toast.error('Please select a backup to restore');
      return;
    }

    setRestoring(true);
    toast.loading('Restoring backup...', { id: 'restore-progress' });

    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: selectedBackup }),
    });
    const data = await res.json();

    toast.dismiss('restore-progress');
    setRestoring(false);

    if (data.success) {
      toast.success(`Restored ${data.stats.memories} memories, ${data.stats.users} users`);
      runHealthCheck();
    } else {
      toast.error(`Restore failed: ${data.error || data.errors?.join(', ')}`);
    }
  };

  const toggleBackups = async () => {
    const res = await fetch('/api/backup/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !status?.enabled }),
    });
    const data = await res.json();
    toast.success(data.message);
    loadStatus();
  };

  const runBackup = async () => {
    setRunning(true);
    toast.loading('Backup started...', { id: 'backup-progress' });

    const res = await fetch('/api/backup/run', { method: 'POST' });
    const data = await res.json();

    toast.dismiss('backup-progress');
    setRunning(false);

    if (data.success) {
      toast.success(`Backup complete (${formatBytes(data.size)})`);
      loadStatus();
      loadHistory();
    } else {
      toast.error(`Backup failed: ${data.error}`);
    }
  };

  const updateConfig = async () => {
    const res = await fetch('/api/backup/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    await res.json();
    toast.success('Configuration updated');
    loadStatus();
  };

  const formatBytes = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = ms => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = dateString => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="card text-center py-8">
        <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-text-secondary">Loading backup status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Database Maintenance</h2>
          <p className="text-sm text-text-secondary">
            Manage Neo4j database backups and system health
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runHealthCheck} className="btn btn-secondary flex items-center gap-2">
            <Database size={16} />
            Health Check
          </button>
          <button
            onClick={runBackup}
            disabled={running}
            className="btn btn-primary flex items-center gap-2"
          >
            {running ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Save size={16} />
                Backup Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div
          className={`card ${health.healthy ? 'bg-success/10 border-success/20' : 'bg-error/10 border-error/20'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health.healthy ? (
                <Check size={24} className="text-success" />
              ) : (
                <AlertTriangle size={24} className="text-error" />
              )}
              <div>
                <h3 className="font-semibold text-text-primary">Database Health</h3>
                <p className="text-sm text-text-secondary">
                  {health.healthy
                    ? 'Neo4j is running and accessible'
                    : health.message || 'Database health check failed'}
                </p>
              </div>
            </div>
            {health.healthy && health.stats && (
              <div className="text-right text-sm text-text-secondary">
                <p>{health.stats.memories} memories</p>
                <p>{health.stats.users} users</p>
                <p>{health.stats.relationships} relationships</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backup Status Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-text-primary">Automated Backups</h3>
            <p className="text-sm text-text-secondary">
              {status?.enabled ? `Scheduled ${status?.schedule} at ${status?.time}` : 'Disabled'}
            </p>
          </div>
          <button
            onClick={toggleBackups}
            className={`btn ${status?.enabled ? 'btn-success' : 'btn-secondary'}`}
          >
            {status?.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-background rounded-lg p-3">
            <p className="text-2xl font-bold text-text-primary">
              {status?.metrics?.totalBackups || 0}
            </p>
            <p className="text-xs text-text-tertiary">Total Backups</p>
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="text-2xl font-bold text-text-primary">
              {formatBytes(status?.metrics?.totalSize || 0)}
            </p>
            <p className="text-xs text-text-tertiary">Total Size</p>
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="text-2xl font-bold text-success">{status?.metrics?.successCount || 0}</p>
            <p className="text-xs text-text-tertiary">Successful</p>
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="text-2xl font-bold text-error">{status?.metrics?.failCount || 0}</p>
            <p className="text-xs text-text-tertiary">Failed</p>
          </div>
        </div>

        {/* Schedule Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-tertiary">Last Backup:</span>
            <span className="text-text-primary ml-2">{formatDate(status?.lastRun)}</span>
          </div>
          <div>
            <span className="text-text-tertiary">Next Backup:</span>
            <span className="text-text-primary ml-2">
              {status?.enabled ? formatDate(status?.nextRun) : 'Not scheduled'}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="card">
        <h3 className="font-semibold text-text-primary mb-4">Configuration</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Schedule</label>
              <select
                value={config.schedule}
                onChange={e => setConfig({ ...config, schedule: e.target.value })}
                className="form-input w-full"
              >
                <option value="manual">Manual Only</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Time (24-hour)</label>
              <input
                type="time"
                value={config.time}
                onChange={e => setConfig({ ...config, time: e.target.value })}
                disabled={config.schedule === 'manual' || config.schedule === 'hourly'}
                className="form-input w-full disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Backup Path</label>
            <input
              type="text"
              value={config.backupPath}
              onChange={e => setConfig({ ...config, backupPath: e.target.value })}
              className="form-input w-full font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Keep Uncompressed (days)
              </label>
              <input
                type="number"
                value={config.retention.keepDays}
                onChange={e =>
                  setConfig({
                    ...config,
                    retention: { ...config.retention, keepDays: parseInt(e.target.value) },
                  })
                }
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Archive Compressed (days)
              </label>
              <input
                type="number"
                value={config.retention.archiveDays}
                onChange={e =>
                  setConfig({
                    ...config,
                    retention: { ...config.retention, archiveDays: parseInt(e.target.value) },
                  })
                }
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Compress After (days)
              </label>
              <input
                type="number"
                value={config.compression.afterDays}
                onChange={e =>
                  setConfig({
                    ...config,
                    compression: { ...config.compression, afterDays: parseInt(e.target.value) },
                  })
                }
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="compression-enabled"
              checked={config.compression.enabled}
              onChange={e =>
                setConfig({
                  ...config,
                  compression: { ...config.compression, enabled: e.target.checked },
                })
              }
              className="rounded"
            />
            <label htmlFor="compression-enabled" className="text-sm text-text-secondary">
              Enable automatic compression
            </label>
          </div>

          <button onClick={updateConfig} className="btn btn-primary">
            Save Configuration
          </button>
        </div>
      </div>

      {/* Backup History */}
      <div className="card">
        <h3 className="font-semibold text-text-primary mb-4">Backup History</h3>
        {history.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            No backups yet. Run your first backup above.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((backup, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg ${
                  backup.success ? 'bg-background' : 'bg-error/10 border border-error/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {backup.success ? (
                      <Check size={20} className="text-success" />
                    ) : (
                      <X size={20} className="text-error" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-text-primary">{backup.fileName}</p>
                      <p className="text-xs text-text-tertiary">{formatDate(backup.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {backup.success ? (
                      <>
                        <p className="text-sm text-text-primary">{formatBytes(backup.size)}</p>
                        <p className="text-xs text-text-tertiary">
                          {formatDuration(backup.duration)}
                        </p>
                        {backup.stats && (
                          <p className="text-xs text-text-tertiary">
                            {backup.stats.users}U {backup.stats.memories}M{' '}
                            {backup.stats.interactions}I
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-error">{backup.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore from Backup */}
      <div className="card">
        <h3 className="font-semibold text-text-primary mb-4">Restore from Backup</h3>
        <p className="text-sm text-text-secondary mb-4">
          Import memories from a backup file. This will merge with existing data (duplicates are
          skipped).
        </p>

        {availableBackups.length === 0 ? (
          <div className="text-center py-4 text-text-secondary">
            No backup files found. Create a backup first.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Select Backup File</label>
              <select
                value={selectedBackup}
                onChange={e => setSelectedBackup(e.target.value)}
                className="form-input w-full"
              >
                {availableBackups.map(backup => (
                  <option key={backup.fileName} value={backup.fileName}>
                    {backup.fileName} ({formatBytes(backup.size)}) - {formatDate(backup.created)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-xs text-text-tertiary">
                {availableBackups.length} backup{availableBackups.length !== 1 ? 's' : ''} available
              </p>
              <button
                onClick={runRestore}
                disabled={restoring || !selectedBackup}
                className="btn btn-secondary flex items-center gap-2"
              >
                {restoring ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    Restore
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// VISUALIZATION TAB COMPONENT
// ============================================

// Force-directed graph simulation hook
function useForceSimulation(nodes, edges, enabled) {
  const [positions, setPositions] = useState({});
  const velocities = useRef({});
  const animationFrameId = useRef(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!enabled || nodes.length === 0 || hasInitialized.current) return;

    hasInitialized.current = true;

    const newPositions = {};
    const newVelocities = {};

    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      const radius = 50;
      newPositions[node.id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: (Math.random() - 0.5) * 20,
      };
      newVelocities[node.id] = { x: 0, y: 0, z: 0 };
    });

    setPositions(newPositions);
    velocities.current = newVelocities;

    const repulsion = 30;
    const attraction = 0.01;
    const damping = 0.8;
    const centerForce = 0.001;

    let iteration = 0;
    const maxIterations = 300;

    const simulate = () => {
      if (iteration >= maxIterations) {
        cancelAnimationFrame(animationFrameId.current);
        return;
      }

      const newPos = { ...newPositions };
      const newVel = { ...newVelocities };

      nodes.forEach(node1 => {
        let fx = 0,
          fy = 0,
          fz = 0;

        nodes.forEach(node2 => {
          if (node1.id === node2.id) return;

          const dx = newPos[node1.id].x - newPos[node2.id].x;
          const dy = newPos[node1.id].y - newPos[node2.id].y;
          const dz = newPos[node1.id].z - newPos[node2.id].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
          fz += (dz / dist) * force;
        });

        edges.forEach(edge => {
          let target = null;
          if (edge.source === node1.id) target = edge.target;
          else if (edge.target === node1.id) target = edge.source;

          if (target && newPos[target]) {
            const dx = newPos[target].x - newPos[node1.id].x;
            const dy = newPos[target].y - newPos[node1.id].y;
            const dz = newPos[target].z - newPos[node1.id].z;

            fx += dx * attraction;
            fy += dy * attraction;
            fz += dz * attraction;
          }
        });

        fx -= newPos[node1.id].x * centerForce;
        fy -= newPos[node1.id].y * centerForce;
        fz -= newPos[node1.id].z * centerForce;

        newVel[node1.id].x = (newVel[node1.id].x + fx) * damping;
        newVel[node1.id].y = (newVel[node1.id].y + fy) * damping;
        newVel[node1.id].z = (newVel[node1.id].z + fz) * damping;

        newPos[node1.id].x += newVel[node1.id].x;
        newPos[node1.id].y += newVel[node1.id].y;
        newPos[node1.id].z += newVel[node1.id].z;
      });

      Object.assign(newPositions, newPos);
      Object.assign(newVelocities, newVel);
      setPositions({ ...newPos });

      iteration++;
      animationFrameId.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [nodes, edges, enabled]);

  return positions;
}

// 3D Node component
function GraphNode({ node, position, onSelect, isSelected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  const color = node.type === 'user' ? '#ffffff' : CATEGORY_COLORS[node.category] || '#6366f1';

  const size = node.type === 'user' ? 1.5 : 1;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        ref={meshRef}
        onClick={() => onSelect(node)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered || isSelected ? 1.3 : 1}
      >
        {node.type === 'user' ? (
          <boxGeometry args={[size, size, size]} />
        ) : (
          <sphereGeometry args={[size, 16, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
        />
      </mesh>
      {(hovered || isSelected) && (
        <Text
          position={[0, size + 1, 0]}
          fontSize={0.8}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.type === 'user' ? `@${node.username}` : node.category}
        </Text>
      )}
    </group>
  );
}

// 3D Edge component
function GraphEdge({ start, end, type }) {
  const points = useMemo(() => {
    return [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
  }, [start, end]);

  const color = type === 'mentions' ? '#00db38' : '#666666';
  const opacity = type === 'mentions' ? 0.6 : 0.3;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}

// Graph scene
function GraphScene({ nodes, edges, positions, selectedNode, setSelectedNode }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      {edges.map((edge, index) => {
        const sourcePos = positions[edge.source];
        const targetPos = positions[edge.target];
        if (!sourcePos || !targetPos) return null;

        return (
          <GraphEdge key={`edge-${index}`} start={sourcePos} end={targetPos} type={edge.type} />
        );
      })}

      {nodes.map(node => {
        const pos = positions[node.id];
        if (!pos) return null;

        return (
          <GraphNode
            key={node.id}
            node={node}
            position={pos}
            onSelect={setSelectedNode}
            isSelected={selectedNode?.id === node.id}
          />
        );
      })}

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={20} maxDistance={300} />
    </>
  );
}

function VisualizationTab() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showInfo, setShowInfo] = useState(true);
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [enabledCategories, setEnabledCategories] = useState({});
  const [showUsers, setShowUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchGraphData = async () => {
    setLoading(true);
    const response = await fetch('/api/memories/graph');
    const data = await response.json();

    if (data.success) {
      setGraphData({ nodes: data.nodes || [], edges: data.edges || [] });
      setSimulationEnabled(true);

      const categories = {};
      (data.nodes || []).forEach(node => {
        if (node.type === 'memory' && node.category) {
          categories[node.category] = true;
        }
      });
      setEnabledCategories(categories);

      toast.success(
        `Loaded ${data.nodes?.length || 0} nodes, ${data.edges?.length || 0} connections`
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const toggleCategory = category => {
    setEnabledCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleAllCategories = enabled => {
    const newCategories = {};
    Object.keys(enabledCategories).forEach(cat => {
      newCategories[cat] = enabled;
    });
    setEnabledCategories(newCategories);
  };

  const filteredData = useMemo(() => {
    let nodes = graphData.nodes.filter(node => {
      if (node.type === 'user' && !showUsers) return false;
      if (node.type === 'memory' && !enabledCategories[node.category]) return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (node.type === 'user') {
          return node.username?.toLowerCase().includes(search);
        } else {
          const contentMatch = node.contentPreview?.toLowerCase().includes(search);
          const tagMatch = node.tags?.some(tag => tag.toLowerCase().includes(search));
          const categoryMatch = node.category?.toLowerCase().includes(search);
          return contentMatch || tagMatch || categoryMatch;
        }
      }

      return true;
    });

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(
      edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return { nodes, edges };
  }, [graphData, enabledCategories, showUsers, searchTerm]);

  const positions = useForceSimulation(filteredData.nodes, filteredData.edges, simulationEnabled);

  const stats = useMemo(() => {
    const memoryNodes = filteredData.nodes.filter(n => n.type === 'memory');
    const userNodes = filteredData.nodes.filter(n => n.type === 'user');
    const mentionEdges = filteredData.edges.filter(e => e.type === 'mentions');
    const relatesEdges = filteredData.edges.filter(e => e.type === 'relates_to');

    const categoryCounts = {};
    memoryNodes.forEach(node => {
      categoryCounts[node.category] = (categoryCounts[node.category] || 0) + 1;
    });

    const totalMemoryNodes = graphData.nodes.filter(n => n.type === 'memory');
    const totalUserNodes = graphData.nodes.filter(n => n.type === 'user');
    const allCategoryCounts = {};
    totalMemoryNodes.forEach(node => {
      allCategoryCounts[node.category] = (allCategoryCounts[node.category] || 0) + 1;
    });

    return {
      totalMemories: memoryNodes.length,
      totalUsers: userNodes.length,
      totalConnections: filteredData.edges.length,
      mentions: mentionEdges.length,
      relationships: relatesEdges.length,
      categories: categoryCounts,
      allCategories: allCategoryCounts,
      allMemories: totalMemoryNodes.length,
      allUsers: totalUserNodes.length,
    };
  }, [graphData, filteredData]);

  const userDetails = useMemo(() => {
    const allUserNodes = graphData.nodes.filter(n => n.type === 'user');
    const visibleUserNodes = filteredData.nodes.filter(n => n.type === 'user');

    return allUserNodes
      .map(userNode => {
        const connections = graphData.edges.filter(
          e => e.target === userNode.id && e.type === 'mentions'
        );

        const connectedMemoryIds = connections.map(e => e.source);
        const connectedMemories = graphData.nodes.filter(n => connectedMemoryIds.includes(n.id));

        const categoryBreakdown = {};
        connectedMemories.forEach(mem => {
          categoryBreakdown[mem.category] = (categoryBreakdown[mem.category] || 0) + 1;
        });

        const timestamps = connectedMemories.map(m => new Date(m.timestamp)).sort((a, b) => b - a);
        const lastMention = timestamps[0];

        return {
          username: userNode.username,
          id: userNode.id,
          totalMentions: connections.length,
          categoryBreakdown,
          lastMention,
          isVisible: visibleUserNodes.some(v => v.id === userNode.id),
          connectedMemories,
        };
      })
      .sort((a, b) => b.totalMentions - a.totalMentions);
  }, [graphData, filteredData]);

  const handleUserClick = user => {
    setSelectedUser(user);
    const userNode = graphData.nodes.find(n => n.id === user.id);
    if (userNode) {
      setSelectedNode(userNode);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-16">
        <RefreshCw size={32} className="mx-auto mb-4 animate-spin text-primary" />
        <p className="text-text-secondary">Loading graph data...</p>
        <p className="text-sm text-text-tertiary mt-1">Preparing visualization</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Main Content */}
      <div className="flex-1 space-y-4">
        {/* Info Banner */}
        {showInfo && (
          <div className="card bg-info/10 border-info/20">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Info size={20} className="flex-shrink-0 mt-0.5 text-info" />
                <div>
                  <p className="font-medium text-text-primary mb-1">Memory Graph Visualization</p>
                  <p className="text-sm text-text-secondary">
                    Interactive 3D view of the memory network. Spheres represent memories (colored
                    by category), cubes represent users. Green lines show user mentions, gray lines
                    show semantic relationships. Click and drag to rotate, scroll to zoom, click
                    nodes for details.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-text-tertiary hover:text-text-secondary ml-4"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="card">
          <div className="flex items-center gap-3">
            <Search size={18} className="text-text-tertiary" />
            <input
              type="text"
              placeholder="Search memories, users, tags, or categories..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-b border-border px-2 py-1 focus:outline-none focus:border-primary transition-colors text-text-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-text-tertiary hover:text-primary transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card">
            <p className="text-xs text-text-tertiary mb-1">Visible Memories</p>
            <p className="text-xl font-bold text-text-primary">
              {stats.totalMemories}
              <span className="text-xs text-text-tertiary ml-1">/ {stats.allMemories}</span>
            </p>
          </div>
          <button
            onClick={() => setShowUserSidebar(!showUserSidebar)}
            className="card hover:ring-1 hover:ring-primary transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary mb-1">Visible Users</p>
                <p className="text-xl font-bold text-text-primary">
                  {stats.totalUsers}
                  <span className="text-xs text-text-tertiary ml-1">/ {stats.allUsers}</span>
                </p>
              </div>
              <Users size={18} className="text-primary" />
            </div>
          </button>
          <div className="card">
            <p className="text-xs text-text-tertiary mb-1">Connections</p>
            <p className="text-xl font-bold text-text-primary">{stats.totalConnections}</p>
          </div>
          <div className="card">
            <p className="text-xs text-text-tertiary mb-1">Mentions</p>
            <p className="text-xl font-bold" style={{ color: '#00db38' }}>
              {stats.mentions}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-text-tertiary mb-1">Relationships</p>
            <p className="text-xl font-bold text-text-primary">{stats.relationships}</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-text-primary">Filter by Category</p>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAllCategories(true)}
                className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                Show All
              </button>
              <button
                onClick={() => toggleAllCategories(false)}
                className="text-xs px-2 py-1 rounded bg-border text-text-secondary hover:bg-border/80 transition-colors"
              >
                Hide All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.allCategories).map(([category, totalCount]) => {
              const isEnabled = enabledCategories[category];
              const visibleCount = stats.categories[category] || 0;
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 px-3 py-2 rounded text-xs transition-all cursor-pointer"
                  style={{
                    backgroundColor: isEnabled
                      ? (CATEGORY_COLORS[category] || '#6366f1') + '20'
                      : 'transparent',
                    color: isEnabled
                      ? CATEGORY_COLORS[category] || '#6366f1'
                      : 'var(--color-text-secondary)',
                    border: `1px solid ${isEnabled ? CATEGORY_COLORS[category] || '#6366f1' : 'var(--color-border)'}`,
                    opacity: isEnabled ? 1 : 0.5,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full transition-opacity"
                    style={{
                      backgroundColor: CATEGORY_COLORS[category] || '#6366f1',
                      opacity: isEnabled ? 1 : 0.3,
                    }}
                  />
                  <span className="font-medium">{category}</span>
                  <span className="opacity-60">
                    ({visibleCount}/{totalCount})
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs transition-all cursor-pointer"
              style={{
                backgroundColor: showUsers ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: `1px solid ${showUsers ? '#ffffff' : 'var(--color-border)'}`,
                opacity: showUsers ? 1 : 0.5,
                color: 'var(--color-text-primary)',
              }}
            >
              <div
                className="w-3 h-3 bg-white transition-opacity"
                style={{ opacity: showUsers ? 1 : 0.3 }}
              />
              <span className="font-medium">users</span>
              <span className="opacity-60">
                ({stats.totalUsers}/{stats.allUsers})
              </span>
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div data-testid="graph" className="card overflow-hidden" style={{ height: '600px' }}>
          {filteredData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-text-secondary">
                <p className="text-lg mb-2">No nodes to display</p>
                <p className="text-sm">
                  {searchTerm
                    ? 'Try a different search term'
                    : 'Enable some categories to see the graph'}
                </p>
              </div>
            </div>
          ) : (
            <Canvas camera={{ position: [0, 0, 100], fov: 60 }}>
              <color attach="background" args={['#0a0a0a']} />
              <GraphScene
                nodes={filteredData.nodes}
                edges={filteredData.edges}
                positions={positions}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
              />
            </Canvas>
          )}
        </div>

        {/* Selected Node Details */}
        {selectedNode && (
          <div className="card">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-text-primary">
                {selectedNode.type === 'user' ? `@${selectedNode.username}` : 'Memory Details'}
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {selectedNode.type === 'memory' ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-text-tertiary">Category:</span>{' '}
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: CATEGORY_COLORS[selectedNode.category] + '20',
                      color: CATEGORY_COLORS[selectedNode.category],
                    }}
                  >
                    {selectedNode.category}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary">Stage:</span>{' '}
                  <span className="text-text-primary">{selectedNode.stage}</span>
                </div>
                <div>
                  <span className="text-text-tertiary">Content:</span>
                  <p className="mt-1 text-text-secondary">{selectedNode.contentPreview}...</p>
                </div>
                {selectedNode.tags && selectedNode.tags.length > 0 && (
                  <div>
                    <span className="text-text-tertiary">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedNode.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs rounded bg-primary/10 text-primary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-text-tertiary">Timestamp:</span>{' '}
                  <span className="text-text-primary">
                    {new Date(selectedNode.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-text-tertiary">Type:</span>{' '}
                  <span className="text-text-primary">User</span>
                </div>
                <div>
                  <span className="text-text-tertiary">Connections:</span>{' '}
                  <span className="text-text-primary">
                    {
                      graphData.edges.filter(
                        e => e.source === selectedNode.id || e.target === selectedNode.id
                      ).length
                    }{' '}
                    memories
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Sidebar */}
      {showUserSidebar && (
        <div className="w-80 flex-shrink-0 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h3 className="font-bold text-text-primary">Users in Memory</h3>
              </div>
              <button
                onClick={() => setShowUserSidebar(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <p className="text-xs text-text-tertiary">
              {userDetails.length} users with{' '}
              {graphData.edges.filter(e => e.type === 'mentions').length} total mentions
            </p>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
              {userDetails.map(user => (
                <div
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  className="p-3 border-b border-border cursor-pointer hover:bg-border/30 transition-colors"
                  style={{
                    backgroundColor:
                      selectedUser?.id === user.id ? 'rgba(0, 219, 56, 0.1)' : 'transparent',
                    opacity: user.isVisible ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-text-primary truncate">
                        @{user.username}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {user.totalMentions} mention{user.totalMentions !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {!user.isVisible && (
                      <span className="text-xs text-text-tertiary ml-2">hidden</span>
                    )}
                  </div>

                  {Object.keys(user.categoryBreakdown).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(user.categoryBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([category, count]) => (
                          <span
                            key={category}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: CATEGORY_COLORS[category] + '20',
                              color: CATEGORY_COLORS[category],
                            }}
                          >
                            {category} ({count})
                          </span>
                        ))}
                    </div>
                  )}

                  {user.lastMention && (
                    <p className="text-xs text-text-tertiary">
                      Last: {user.lastMention.toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedUser && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-text-primary">@{selectedUser.username}</h4>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-text-tertiary">Total Mentions:</span>
                  <span className="ml-2 font-bold text-text-primary">
                    {selectedUser.totalMentions}
                  </span>
                </div>

                {selectedUser.lastMention && (
                  <div>
                    <span className="text-text-tertiary">Last Mentioned:</span>
                    <p className="mt-1 text-text-primary">
                      {selectedUser.lastMention.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-text-tertiary">Categories:</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(selectedUser.categoryBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: CATEGORY_COLORS[category] + '20',
                              color: CATEGORY_COLORS[category],
                            }}
                          >
                            {category}
                          </span>
                          <span className="text-xs text-text-tertiary">{count} memories</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <span className="text-text-tertiary">Recent Memories:</span>
                  <div className="mt-2 space-y-2">
                    {selectedUser.connectedMemories
                      .slice()
                      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                      .slice(0, 3)
                      .map(memory => (
                        <div
                          key={memory.id}
                          className="text-xs p-2 rounded bg-background border border-border"
                        >
                          <p className="text-text-tertiary mb-1">
                            {new Date(memory.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-text-secondary line-clamp-2">
                            {memory.contentPreview}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SETTINGS TAB COMPONENT
// ============================================
function SettingsTab({ neo4jStatus, fetchStatus }) {
  const [config, setConfig] = useState({
    uri: '',
    user: '',
    password: '',
    database: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordIsPlaceholder, setPasswordIsPlaceholder] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    const response = await fetch('/api/memories/config');
    const data = await response.json();
    if (data.success) {
      setConfig({
        uri: data.config.uri || '',
        user: data.config.user || '',
        password: data.config.hasPassword ? '••••••••' : '',
        database: data.config.database || '',
      });
      setPasswordIsPlaceholder(data.config.hasPassword);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handlePasswordFocus = () => {
    if (passwordIsPlaceholder) {
      setConfig({ ...config, password: '' });
      setPasswordIsPlaceholder(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const response = await fetch('/api/memories/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await response.json();
    setSaving(false);

    if (data.success) {
      toast.success('Configuration saved and connected');
      fetchStatus();
    } else {
      toast.error(data.message || 'Failed to connect with new settings');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const response = await fetch('/api/memories/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await response.json();
    setTesting(false);

    if (data.success) {
      toast.success('Connection successful!');
      fetchStatus();
    } else {
      toast.error(data.message || 'Connection failed');
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-8">
        <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-primary" />
        <p className="text-text-secondary">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Neo4j Connection Settings */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Neo4j Connection</h2>
            <p className="text-sm text-text-secondary">Configure your Neo4j database connection</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Connection URI
            </label>
            <input
              type="text"
              value={config.uri}
              onChange={e => setConfig({ ...config, uri: e.target.value })}
              className="form-input w-full font-mono text-sm"
              placeholder="bolt://localhost:7687"
            />
            <p className="text-xs text-text-tertiary mt-1">
              Use <code className="bg-border/50 px-1 rounded">bolt://neo4j:7687</code> for Docker,
              <code className="bg-border/50 px-1 rounded ml-1">bolt://localhost:7687</code> for
              local
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Username</label>
              <input
                type="text"
                value={config.user}
                onChange={e => setConfig({ ...config, user: e.target.value })}
                className="form-input w-full"
                placeholder="neo4j"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword && !passwordIsPlaceholder ? 'text' : 'password'}
                  value={config.password}
                  onChange={e => setConfig({ ...config, password: e.target.value })}
                  onFocus={handlePasswordFocus}
                  className="form-input w-full pr-10"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={passwordIsPlaceholder}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors ${
                    passwordIsPlaceholder
                      ? 'text-text-tertiary/50 cursor-not-allowed'
                      : 'text-text-tertiary hover:text-text-secondary cursor-pointer'
                  }`}
                  title={
                    passwordIsPlaceholder
                      ? 'Click password field to enter new password'
                      : showPassword
                        ? 'Hide password'
                        : 'Show password'
                  }
                >
                  {showPassword && !passwordIsPlaceholder ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Database Name
            </label>
            <input
              type="text"
              value={config.database}
              onChange={e => setConfig({ ...config, database: e.target.value })}
              className="form-input w-full"
              placeholder="neo4j"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${neo4jStatus.connected ? 'bg-success' : 'bg-error'}`}
              />
              <span className="text-sm text-text-secondary">
                {neo4jStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing || saving}
                className="btn btn-secondary flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Test Connection
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || testing}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Variable Info */}
      <div className="card bg-info/10 border-info/20">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text-primary mb-1">Environment Variable Override</p>
            <p className="text-sm text-text-secondary">
              If the environment variable{' '}
              <code className="bg-border/50 px-1 rounded">NEO4J_URI</code> is set, it will override
              the saved configuration. This is useful for Docker deployments where the connection
              details are injected via environment.
            </p>
            <div className="mt-2 text-xs font-mono text-text-tertiary">
              <p>NEO4J_URI=bolt://neo4j:7687</p>
              <p>NEO4J_USER=neo4j</p>
              <p>NEO4J_PASSWORD=yourpassword</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN MEMORIES PAGE
// ============================================
function MemoriesPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = tab || 'memories';
  const [neo4jStatus, setNeo4jStatus] = useState({ connected: null });

  // Handle tab change
  const setActiveTab = useCallback(
    newTab => {
      if (newTab === 'memories') {
        navigate('/memories');
      } else {
        navigate(`/memories/${newTab}`);
      }
    },
    [navigate]
  );

  // Fetch Neo4j status
  const fetchStatus = useCallback(async () => {
    const response = await fetch('/api/memories/status');
    const data = await response.json();
    if (data.success) {
      setNeo4jStatus(data.neo4j);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={28} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Memories</h1>
            <p className="text-sm text-text-secondary">Neo4j-powered memory purrsistence</p>
          </div>
        </div>

        {/* Compact Neo4j Status */}
        {neo4jStatus.connected === true && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-sm text-success font-medium">Connected</span>
            <span className="text-xs text-text-tertiary hidden sm:inline">{neo4jStatus.uri}</span>
          </div>
        )}

        {neo4jStatus.connected === false && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/10 border border-error/20">
            <div className="w-2 h-2 rounded-full bg-error" />
            <span className="text-sm text-error font-medium">Disconnected</span>
          </div>
        )}

        {neo4jStatus.connected === null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-border/50">
            <RefreshCw size={12} className="animate-spin text-text-tertiary" />
            <span className="text-sm text-text-tertiary">Connecting...</span>
          </div>
        )}
      </div>

      {/* Error Details Banner (only when disconnected) */}
      {neo4jStatus.connected === false && neo4jStatus.error && (
        <div className="card bg-error/10 border-error/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-error mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-error">
                {neo4jStatus.error?.message || 'Connection Failed'}
              </p>
              <p className="text-sm text-text-secondary">
                {neo4jStatus.error?.details ||
                  `Make sure Neo4j is running on ${neo4jStatus.uri || 'bolt://localhost:7687'}.`}
              </p>
              {neo4jStatus.error?.help && (
                <ul className="mt-2 text-xs text-text-tertiary space-y-1">
                  {neo4jStatus.error.help.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-text-tertiary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'memories' && (
        <MemoriesTab neo4jStatus={neo4jStatus} fetchStatus={fetchStatus} />
      )}
      {activeTab === 'maintenance' && <MaintenanceTab />}
      {activeTab === 'visualization' && <VisualizationTab />}
      {activeTab === 'settings' && (
        <SettingsTab neo4jStatus={neo4jStatus} fetchStatus={fetchStatus} />
      )}
    </div>
  );
}

export default MemoriesPage;
