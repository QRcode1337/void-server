import { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Play, X, RefreshCw, CheckCircle, XCircle, AlertTriangle, ExternalLink, Edit2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrowsersPage() {
  const [browsers, setBrowsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBrowser, setNewBrowser] = useState({ id: '', name: '', description: '', port: '' });
  const [isDockerEnv, setIsDockerEnv] = useState(false);
  const [portRange, setPortRange] = useState({ start: 9111, end: 9199 });
  const [editingBrowser, setEditingBrowser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', port: '' });

  const loadBrowsers = async () => {
    setLoading(true);
    const response = await fetch('/api/browsers');
    const data = await response.json();

    if (data.success) {
      setBrowsers(data.browsers);
      // Check if any launch attempt returned isDocker
      setIsDockerEnv(data.isDocker || false);
    }
    setLoading(false);
  };

  const loadPortConfig = async () => {
    const response = await fetch('/api/browsers/config/ports');
    const data = await response.json();
    if (data.success) {
      setPortRange(data.portRange);
    }
  };

  useEffect(() => {
    loadBrowsers();
    loadPortConfig();
  }, []);

  const handleCreate = async () => {
    if (!newBrowser.id.trim()) {
      toast.error('Browser ID is required');
      return;
    }

    setCreating(true);
    const payload = {
      ...newBrowser,
      port: newBrowser.port ? parseInt(newBrowser.port, 10) : undefined,
      autoAssignPort: !newBrowser.port
    };

    const response = await fetch('/api/browsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setCreating(false);

    if (data.success) {
      toast.success(`Browser profile created (port ${data.browser.port})`);
      setShowCreateForm(false);
      setNewBrowser({ id: '', name: '', description: '', port: '' });
      loadBrowsers();
    } else {
      toast.error(data.error || 'Failed to create browser profile');
    }
  };

  const startEditing = (browser) => {
    setEditingBrowser(browser.id);
    setEditForm({
      name: browser.name || '',
      description: browser.description || '',
      port: browser.port || ''
    });
  };

  const cancelEditing = () => {
    setEditingBrowser(null);
    setEditForm({ name: '', description: '', port: '' });
  };

  const handleUpdate = async (id) => {
    const updates = {
      name: editForm.name || undefined,
      description: editForm.description,
      port: editForm.port ? parseInt(editForm.port, 10) : null
    };

    const response = await fetch(`/api/browsers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Browser profile updated');
      cancelEditing();
      loadBrowsers();
    } else {
      toast.error(data.error || 'Failed to update browser');
    }
  };

  const handleLaunch = async (id, url) => {
    toast.loading('Launching browser...', { id: `launch-${id}` });

    const response = await fetch(`/api/browsers/${id}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Browser launched. Log in, then close the window.', { id: `launch-${id}`, duration: 10000 });
      // Poll for status
      pollBrowserStatus(id);
    } else {
      if (data.isDocker) {
        setIsDockerEnv(true);
      }
      toast.error(data.error || 'Failed to launch browser', { id: `launch-${id}` });
    }

    loadBrowsers();
  };

  const pollBrowserStatus = (id) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/browsers/${id}/status`);
      const data = await response.json();

      if (!data.running) {
        clearInterval(interval);
        loadBrowsers();
        if (data.authenticated) {
          toast.success(`Browser "${data.name}" authenticated!`);
        }
      }
    }, 2000);

    setTimeout(() => clearInterval(interval), 300000);
  };

  const handleClose = async (id) => {
    const response = await fetch(`/api/browsers/${id}/close`, { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      toast.success('Browser closed');
    } else {
      toast.error(data.error || 'Failed to close browser');
    }

    loadBrowsers();
  };

  const handleDelete = async (id) => {
    const response = await fetch(`/api/browsers/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      toast.success('Browser profile deleted');
    } else {
      toast.error(data.error || 'Failed to delete browser profile');
    }

    loadBrowsers();
  };

  const renderStatusBadge = (browser) => {
    if (browser.running) {
      return (
        <span className="flex items-center gap-1 text-sm text-warning">
          <RefreshCw size={14} className="animate-spin" />
          Running
        </span>
      );
    }

    if (browser.authenticated) {
      return (
        <span className="flex items-center gap-1 text-sm text-success">
          <CheckCircle size={14} />
          Authenticated
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-sm text-tertiary">
        <XCircle size={14} />
        Not Authenticated
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Browser Profiles</h1>
            <p className="text-secondary text-sm">Manage authenticated browser sessions for plugins</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadBrowsers} className="btn btn-ghost p-2" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            New Profile
          </button>
        </div>
      </div>

      {/* Docker Warning */}
      {isDockerEnv && (
        <div className="card border-warning bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-text-primary">Running in Docker</h3>
              <p className="text-secondary text-sm mt-1">
                Browser GUI cannot be launched inside Docker containers. To authenticate browsers:
              </p>
              <ol className="list-decimal list-inside text-sm text-secondary mt-2 space-y-1">
                <li>Run void-server natively: <code className="bg-surface px-1 rounded">./run.sh native</code></li>
                <li>Create and authenticate browser profiles</li>
                <li>Switch back to Docker - profiles persist in <code className="bg-surface px-1 rounded">config/browsers/</code></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Create Browser Profile</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Profile ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={newBrowser.id}
                onChange={(e) => setNewBrowser({ ...newBrowser, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="x-auth"
                className="form-input w-full"
              />
              <p className="text-xs text-tertiary mt-1">Lowercase letters, numbers, hyphens only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={newBrowser.name}
                onChange={(e) => setNewBrowser({ ...newBrowser, name: e.target.value })}
                placeholder="X.com Authentication"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Description
              </label>
              <input
                type="text"
                value={newBrowser.description}
                onChange={(e) => setNewBrowser({ ...newBrowser, description: e.target.value })}
                placeholder="Browser profile for downloading X.com videos"
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                CDP Port
              </label>
              <input
                type="number"
                value={newBrowser.port}
                onChange={(e) => setNewBrowser({ ...newBrowser, port: e.target.value })}
                placeholder={`Auto (${portRange.start}-${portRange.end})`}
                className="form-input w-full"
                min={1024}
                max={65535}
              />
              <p className="text-xs text-tertiary mt-1">Leave empty for auto-assignment</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowCreateForm(false); setNewBrowser({ id: '', name: '', description: '', port: '' }); }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newBrowser.id.trim()}
              className="btn btn-primary"
            >
              {creating ? 'Creating...' : 'Create Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Browser List */}
      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : browsers.length === 0 ? (
        <div className="card text-center py-12">
          <Globe className="w-12 h-12 text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary">No Browser Profiles</h3>
          <p className="text-secondary mt-2">Create a browser profile to store authenticated sessions for plugins.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {browsers.map((browser) => (
            <div key={browser.id} className="card">
              {editingBrowser === browser.id ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-text-primary">Edit Browser Profile</h3>
                    <span className="text-xs text-tertiary">ID: {browser.id}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">Display Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Browser name"
                        className="form-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">Description</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="form-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">CDP Port</label>
                      <input
                        type="number"
                        value={editForm.port}
                        onChange={(e) => setEditForm({ ...editForm, port: e.target.value })}
                        placeholder={`Auto (${portRange.start}-${portRange.end})`}
                        className="form-input w-full"
                        min={1024}
                        max={65535}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button onClick={cancelEditing} className="btn btn-secondary btn-sm">
                      Cancel
                    </button>
                    <button onClick={() => handleUpdate(browser.id)} className="btn btn-primary btn-sm flex items-center gap-1">
                      <Save size={16} />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Globe className="w-10 h-10 text-primary p-2 bg-primary/10 rounded-lg" />
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{browser.name || browser.id}</h3>
                      {browser.description && (
                        <p className="text-secondary text-sm">{browser.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-tertiary">ID: {browser.id}</span>
                        <span className="text-xs text-tertiary">Port: {browser.port || 'none'}</span>
                      </div>
                    </div>
                  </div>

                <div className="flex items-center gap-4">
                  {renderStatusBadge(browser)}

                  <div className="flex items-center gap-2">
                    {browser.running ? (
                      <button
                        onClick={() => handleClose(browser.id)}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                        title="Close browser"
                      >
                        <X size={16} />
                        Close
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleLaunch(browser.id, 'https://x.com/login')}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                          title="Launch for X.com authentication"
                          disabled={isDockerEnv}
                        >
                          <Play size={16} />
                          Launch (X.com)
                        </button>
                        <button
                          onClick={() => handleLaunch(browser.id)}
                          className="btn btn-secondary btn-sm flex items-center gap-1"
                          title="Launch with blank page"
                          disabled={isDockerEnv}
                        >
                          <ExternalLink size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => startEditing(browser)}
                      className="btn btn-ghost btn-sm"
                      title="Edit profile"
                      disabled={browser.running}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(browser.id)}
                      className="btn btn-ghost btn-sm text-error"
                      title="Delete profile"
                      disabled={browser.running}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage Info */}
      <div className="card bg-surface-alt">
        <h3 className="text-lg font-semibold text-text-primary mb-3">How Browser Profiles Work</h3>
        <div className="space-y-2 text-sm text-secondary">
          <p>Browser profiles store authentication cookies/sessions for plugins that need web access.</p>
          <p><strong>Setup:</strong> Create a profile, launch the browser, log into the website, close the browser.</p>
          <p><strong>Usage:</strong> Plugins can use authenticated profiles for headless operations (e.g., video downloads).</p>
          <p><strong>Docker:</strong> Profiles are stored in <code className="bg-surface px-1 rounded">config/browsers/</code> and persist across container restarts.</p>
        </div>
      </div>
    </div>
  );
}
