import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  HardDrive,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Upload,
  Link,
  Image,
  FileText,
  Music,
  Code,
  Archive,
  File,
  FolderOpen,
  CheckCircle,
  XCircle,
  Cloud,
  CloudOff,
  Settings,
  Eye,
  EyeOff,
  Globe
} from 'lucide-react';

const IPFSPage = () => {
  const [status, setStatus] = useState(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isPinning, setIsPinning] = useState(false);
  const [deletingCid, setDeletingCid] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [config, setConfig] = useState(null);
  const [pinataStatus, setPinataStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [publishingCid, setPublishingCid] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    const [statusRes, pinsRes, configRes] = await Promise.all([
      fetch('/api/ipfs/status'),
      fetch('/api/ipfs/pins'),
      fetch('/api/ipfs/config')
    ]);

    const statusData = await statusRes.json();
    const pinsData = await pinsRes.json();
    const configData = await configRes.json();

    setStatus(statusData);
    setPins(pinsData.pins || []);
    setConfig(configData.config);

    // Check Pinata status if enabled
    if (configData.config?.pinata?.enabled && configData.config?.pinata?.jwt) {
      const pinataRes = await fetch('/api/ipfs/pinata/status');
      const pinataData = await pinataRes.json();
      setPinataStatus(pinataData);
    } else {
      setPinataStatus(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    if (!status?.daemonOnline) {
      toast.error('IPFS daemon is not running');
      return;
    }

    setIsPinning(true);

    for (const file of files) {
      const toastId = toast.loading(`Pinning ${file.name}...`);

      const res = await fetch(`/api/ipfs/pin/file?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Pinned ${file.name}`, { id: toastId });
      } else {
        toast.error(data.error || `Failed to pin ${file.name}`, { id: toastId });
      }
    }

    setIsPinning(false);
    loadData();
  };

  const handleUrlPin = async () => {
    if (!urlInput.trim()) {
      toast.error('Enter a URL');
      return;
    }
    if (!status?.daemonOnline) {
      toast.error('IPFS daemon is not running');
      return;
    }

    setIsPinning(true);
    const toastId = toast.loading('Pinning URL...');

    const res = await fetch('/api/ipfs/pin/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput })
    });
    const data = await res.json();

    if (data.success) {
      toast.success(`Pinned: ${data.pin.name}`, { id: toastId });
      setUrlInput('');
      loadData();
    } else {
      toast.error(data.error || 'Failed to pin URL', { id: toastId });
    }

    setIsPinning(false);
  };

  const handleUnpin = async (cid, name) => {
    setDeletingCid(cid);

    const res = await fetch(`/api/ipfs/pin/${cid}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      toast.success(`Unpinned ${name}`);
      loadData();
    } else {
      toast.error(data.error || 'Failed to unpin');
    }

    setDeletingCid(null);
  };

  const handlePublishToPinata = async (cid, name) => {
    if (!config?.pinata?.enabled || !config?.pinata?.jwt) {
      toast.error('Pinata not configured');
      return;
    }

    setPublishingCid(cid);
    const toastId = toast.loading(`Publishing ${name} to Pinata...`);

    const res = await fetch(`/api/ipfs/pinata/pin/${cid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();

    if (data.success) {
      toast.success(`Published to Pinata!`, { id: toastId });
      loadData();
    } else {
      toast.error(data.error || 'Failed to publish', { id: toastId });
    }

    setPublishingCid(null);
  };

  const handleSaveConfig = async (newConfig) => {
    setSavingConfig(true);

    const res = await fetch('/api/ipfs/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    const data = await res.json();

    if (data.success) {
      toast.success('Configuration saved');
      setConfig(data.config);
      loadData();
    } else {
      toast.error(data.error || 'Failed to save config');
    }

    setSavingConfig(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return <Image size={16} className="text-purple-400" />;
      case 'document': return <FileText size={16} className="text-blue-400" />;
      case 'media': return <Music size={16} className="text-green-400" />;
      case 'code': return <Code size={16} className="text-yellow-400" />;
      case 'archive': return <Archive size={16} className="text-orange-400" />;
      case 'directory': return <FolderOpen size={16} className="text-cyan-400" />;
      default: return <File size={16} className="text-secondary" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'image': return 'text-purple-400';
      case 'document': return 'text-blue-400';
      case 'media': return 'text-green-400';
      case 'code': return 'text-yellow-400';
      case 'archive': return 'text-orange-400';
      case 'directory': return 'text-cyan-400';
      default: return 'text-secondary';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const filteredPins = typeFilter === 'all'
    ? pins
    : pins.filter(p => p.type === typeFilter);

  // Get unique types for filter
  const availableTypes = ['all', ...new Set(pins.map(p => p.type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">IPFS Management</h1>
            <p className="text-secondary text-sm">Pin and manage decentralized content</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daemon Status */}
        <div className={`card ${status?.daemonOnline ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status?.daemonOnline ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <h3 className="font-semibold text-text-primary">
                  Local IPFS {status?.daemonOnline ? 'Online' : 'Offline'}
                </h3>
                <p className="text-sm text-secondary">
                  {status?.daemonOnline
                    ? 'Local node running'
                    : 'Start daemon to pin'}
                </p>
              </div>
            </div>
            {status?.peerId && (
              <div className="text-xs text-secondary font-mono">
                {status.peerId.substring(0, 8)}...
              </div>
            )}
          </div>
        </div>

        {/* Pinata Status */}
        <div className={`card ${
          config?.pinata?.enabled && pinataStatus?.authenticated
            ? 'border-blue-500/50 bg-blue-500/5'
            : config?.pinata?.enabled
              ? 'border-yellow-500/50 bg-yellow-500/5'
              : 'border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config?.pinata?.enabled && pinataStatus?.authenticated ? (
                <Cloud className="w-6 h-6 text-blue-400" />
              ) : config?.pinata?.enabled ? (
                <CloudOff className="w-6 h-6 text-yellow-400" />
              ) : (
                <CloudOff className="w-6 h-6 text-secondary" />
              )}
              <div>
                <h3 className="font-semibold text-text-primary">
                  Pinata {config?.pinata?.enabled ? (pinataStatus?.authenticated ? 'Connected' : 'Not Authenticated') : 'Disabled'}
                </h3>
                <p className="text-sm text-secondary">
                  {config?.pinata?.enabled
                    ? pinataStatus?.authenticated
                      ? 'Public pinning ready'
                      : 'Check JWT token'
                    : 'Enable for public access'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-surface"
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="card border-primary/30">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Settings size={18} />
            IPFS Configuration
          </h3>
          <div className="space-y-4">
            {/* Pinata Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-text-primary font-medium">Enable Pinata</label>
                <p className="text-xs text-secondary">Use Pinata for public content availability</p>
              </div>
              <button
                onClick={() => handleSaveConfig({
                  ...config,
                  pinata: { ...config?.pinata, enabled: !config?.pinata?.enabled }
                })}
                disabled={savingConfig}
                className={`w-12 h-6 rounded-full transition-colors ${
                  config?.pinata?.enabled ? 'bg-primary' : 'bg-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config?.pinata?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Pinata JWT */}
            {config?.pinata?.enabled && (
              <div>
                <label className="text-text-primary font-medium block mb-2">Pinata JWT Token</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showJwt ? 'text' : 'password'}
                      value={config?.pinata?.jwt || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        pinata: { ...config?.pinata, jwt: e.target.value }
                      })}
                      placeholder="Enter your Pinata JWT"
                      className="form-input w-full pr-10"
                    />
                    <button
                      onClick={() => setShowJwt(!showJwt)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                    >
                      {showJwt ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSaveConfig(config)}
                    disabled={savingConfig}
                    className="btn btn-primary"
                  >
                    {savingConfig ? <RefreshCw size={16} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-secondary mt-1">
                  Get your JWT from{' '}
                  <a href="https://app.pinata.cloud/developers/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Pinata Dashboard
                  </a>
                </p>
              </div>
            )}

            {/* Gateway URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <label className="text-secondary text-sm">Local Gateway</label>
                <p className="text-text-primary font-mono text-sm">{config?.gateway || 'Not set'}</p>
              </div>
              <div>
                <label className="text-secondary text-sm">Public Gateway</label>
                <p className="text-text-primary font-mono text-sm">{config?.publicGateway || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-text-primary">{status?.metrics?.totalPins || 0}</div>
          <div className="text-xs text-secondary">Total Pins</div>
        </div>
        {Object.entries(status?.metrics?.byType || {}).map(([type, count]) => (
          <div key={type} className="card text-center">
            <div className={`text-2xl font-bold ${getTypeColor(type)}`}>{count}</div>
            <div className="text-xs text-secondary capitalize">{type}</div>
          </div>
        ))}
      </div>

      {/* Pin Content */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Pin Content</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'upload'
                ? 'bg-primary text-white'
                : 'bg-surface hover:bg-border text-text-primary'
            }`}
          >
            <Upload size={16} />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'url'
                ? 'bg-primary text-white'
                : 'bg-surface hover:bg-border text-text-primary'
            }`}
          >
            <Link size={16} />
            Pin URL
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-secondary" />
            <p className="text-text-primary mb-2">
              Drag and drop files here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
                disabled={!status?.daemonOnline || isPinning}
              >
                browse
              </button>
            </p>
            <p className="text-sm text-secondary">
              Files will be pinned to IPFS and accessible via gateway
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={!status?.daemonOnline || isPinning}
            />
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <div className="flex gap-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/file.png"
              className="form-input flex-1"
              disabled={!status?.daemonOnline || isPinning}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlPin()}
            />
            <button
              onClick={handleUrlPin}
              disabled={!status?.daemonOnline || isPinning || !urlInput.trim()}
              className="btn btn-primary px-6"
            >
              {isPinning ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                'Pin'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Pinned Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Pinned Content</h2>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="form-input w-auto text-sm"
          >
            {availableTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {filteredPins.length === 0 ? (
          <div className="text-center py-8 text-secondary">
            No content pinned yet. Upload a file or pin a URL to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-secondary font-medium">CID</th>
                  <th className="px-4 py-3 text-left text-secondary font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-secondary font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-secondary font-medium">Size</th>
                  <th className="px-4 py-3 text-left text-secondary font-medium">Pinned</th>
                  <th className="px-4 py-3 text-right text-secondary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPins.map((pin) => (
                  <tr key={pin.cid} className="hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-primary font-mono">
                          {pin.cid.substring(0, 12)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(pin.cid)}
                          className="text-secondary hover:text-primary"
                          title="Copy CID"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {pin.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(pin.type)}
                        <span className={`text-xs font-medium capitalize ${getTypeColor(pin.type)}`}>
                          {pin.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs">
                      {formatBytes(pin.size)}
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs">
                      {formatDate(pin.pinnedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Local gateway link */}
                        <a
                          href={pin.gatewayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-surface"
                          title="Open locally"
                        >
                          <ExternalLink size={16} />
                        </a>
                        {/* Public gateway link (if pinned to Pinata) */}
                        {pin.pinata && config?.publicGateway && (
                          <a
                            href={`${config.publicGateway}/${pin.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-surface"
                            title="Open on Pinata"
                          >
                            <Globe size={16} />
                          </a>
                        )}
                        {/* Publish to Pinata button */}
                        {config?.pinata?.enabled && pinataStatus?.authenticated && !pin.pinata && (
                          <button
                            onClick={() => handlePublishToPinata(pin.cid, pin.name)}
                            disabled={publishingCid === pin.cid}
                            className="p-2 text-secondary hover:text-blue-400 rounded-lg hover:bg-surface disabled:opacity-50"
                            title="Publish to Pinata"
                          >
                            {publishingCid === pin.cid ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Cloud size={16} />
                            )}
                          </button>
                        )}
                        {/* Already on Pinata indicator */}
                        {pin.pinata && (
                          <span className="p-2 text-blue-400" title="Published to Pinata">
                            <Cloud size={16} />
                          </span>
                        )}
                        {/* Unpin button */}
                        <button
                          onClick={() => handleUnpin(pin.cid, pin.name)}
                          disabled={deletingCid === pin.cid || !status?.daemonOnline}
                          className="p-2 text-secondary hover:text-red-400 rounded-lg hover:bg-surface disabled:opacity-50"
                          title="Unpin"
                        >
                          {deletingCid === pin.cid ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default IPFSPage;
