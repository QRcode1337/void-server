import { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Play,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Edit2,
  Save,
  Copy,
  Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrowsersPage() {
  const [browsers, setBrowsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBrowser, setNewBrowser] = useState({ id: '', name: '', description: '', port: '', startUrl: '' });
  const [portRange, setPortRange] = useState({ start: 9111, end: 9199 });
  const [editingBrowser, setEditingBrowser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', port: '', startUrl: '' });
  const [isDocker, setIsDocker] = useState(false);
  const [authModal, setAuthModal] = useState(null); // { id, commands }
  const [selectedPlatform, setSelectedPlatform] = useState('darwin');

  const loadBrowsers = async () => {
    setLoading(true);
    const response = await fetch('/api/browsers');
    const data = await response.json();

    if (data.success) {
      setBrowsers(data.browsers);
      setIsDocker(data.isDocker || false);
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
      autoAssignPort: !newBrowser.port,
      startUrl: newBrowser.startUrl || undefined,
    };

    const response = await fetch('/api/browsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    setCreating(false);

    if (data.success) {
      toast.success(`Browser profile created (port ${data.browser.port})`);
      setShowCreateForm(false);
      setNewBrowser({ id: '', name: '', description: '', port: '', startUrl: '' });
      loadBrowsers();
    } else {
      toast.error(data.error || 'Failed to create browser profile');
    }
  };

  const startEditing = browser => {
    setEditingBrowser(browser.id);
    setEditForm({
      name: browser.name || '',
      description: browser.description || '',
      port: browser.port || '',
      startUrl: browser.startUrl || '',
    });
  };

  const cancelEditing = () => {
    setEditingBrowser(null);
    setEditForm({ name: '', description: '', port: '', startUrl: '' });
  };

  const handleUpdate = async id => {
    const updates = {
      name: editForm.name || undefined,
      description: editForm.description,
      port: editForm.port ? parseInt(editForm.port, 10) : null,
      startUrl: editForm.startUrl,
    };

    const response = await fetch(`/api/browsers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
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
    toast.loading('Opening browser...', { id: `launch-${id}` });

    const response = await fetch(`/api/browsers/${id}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Browser opened. Close when done to save session.', {
        id: `launch-${id}`,
        duration: 5000,
      });
      // Poll for status to detect when browser closes
      pollBrowserStatus(id);
    } else {
      toast.error(data.error || 'Failed to open browser', { id: `launch-${id}` });
    }

    loadBrowsers();
  };

  const pollBrowserStatus = id => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/browsers/${id}/status`);
      const data = await response.json();

      if (!data.running) {
        clearInterval(interval);
        loadBrowsers();
        if (data.authenticated) {
          toast.success(`Browser "${data.name}" session saved`);
        }
      }
    }, 2000);

    setTimeout(() => clearInterval(interval), 300000);
  };

  const fetchAuthCommand = async (id, url) => {
    const queryParams = url ? `?url=${encodeURIComponent(url)}` : '';
    const response = await fetch(`/api/browsers/${id}/auth-command${queryParams}`);
    const data = await response.json();

    if (data.success) {
      setAuthModal({ id, commands: data.commands, url });
    } else {
      toast.error(data.error || 'Failed to get auth command');
    }
  };

  const copyCommand = () => {
    const command = authModal?.commands?.[selectedPlatform];
    if (command) {
      navigator.clipboard.writeText(command);
      toast.success('Command copied to clipboard');
    }
  };

  const handleClose = async id => {
    const response = await fetch(`/api/browsers/${id}/close`, { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      toast.success('Browser closed');
    } else {
      toast.error(data.error || 'Failed to close browser');
    }

    loadBrowsers();
  };

  const handleDelete = async id => {
    const response = await fetch(`/api/browsers/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      toast.success('Browser profile deleted');
    } else {
      toast.error(data.error || 'Failed to delete browser profile');
    }

    loadBrowsers();
  };

  const renderStatusBadge = browser => {
    if (browser.running) {
      return (
        <span className="flex items-center gap-1 text-sm text-success">
          <CheckCircle size={14} />
          Listening on :{browser.port}
        </span>
      );
    }

    if (browser.authenticated) {
      return (
        <span className="flex items-center gap-1 text-sm text-success">
          <CheckCircle size={14} />
          Has Session Data
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-sm text-tertiary">
        <XCircle size={14} />
        No Session Data
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
            <p className="text-secondary text-sm">
              Manage authenticated browser sessions for plugins
            </p>
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
                onChange={e =>
                  setNewBrowser({
                    ...newBrowser,
                    id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                placeholder="x-auth"
                className="form-input w-full"
              />
              <p className="text-xs text-tertiary mt-1">Lowercase letters, numbers, hyphens only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Display Name</label>
              <input
                type="text"
                value={newBrowser.name}
                onChange={e => setNewBrowser({ ...newBrowser, name: e.target.value })}
                placeholder="X.com Authentication"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Description</label>
              <input
                type="text"
                value={newBrowser.description}
                onChange={e => setNewBrowser({ ...newBrowser, description: e.target.value })}
                placeholder="Browser profile for authenticated sessions"
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Start URL</label>
              <input
                type="text"
                value={newBrowser.startUrl}
                onChange={e => setNewBrowser({ ...newBrowser, startUrl: e.target.value })}
                placeholder="https://example.com/login"
                className="form-input w-full"
              />
              <p className="text-xs text-tertiary mt-1">URL to open on launch (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">CDP Port</label>
              <input
                type="number"
                value={newBrowser.port}
                onChange={e => setNewBrowser({ ...newBrowser, port: e.target.value })}
                placeholder={`Auto (${portRange.start}-${portRange.end})`}
                className="form-input w-full"
                min={1024}
                max={65535}
              />
              <p className="text-xs text-tertiary mt-1">Leave empty for auto-assignment</p>
            </div>
            <div></div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewBrowser({ id: '', name: '', description: '', port: '', startUrl: '' });
              }}
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
          <p className="text-secondary mt-2">
            Create a browser profile to store authenticated sessions for plugins.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {browsers.map(browser => (
            <div key={browser.id} className="card">
              {editingBrowser === browser.id ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Edit Browser Profile
                    </h3>
                    <span className="text-xs text-tertiary">ID: {browser.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Browser name"
                        className="form-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="form-input w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">
                        Start URL
                      </label>
                      <input
                        type="text"
                        value={editForm.startUrl}
                        onChange={e => setEditForm({ ...editForm, startUrl: e.target.value })}
                        placeholder="https://example.com/login"
                        className="form-input w-full"
                      />
                      <p className="text-xs text-tertiary mt-1">URL to open on launch (optional)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-1">
                        CDP Port
                      </label>
                      <input
                        type="number"
                        value={editForm.port}
                        onChange={e => setEditForm({ ...editForm, port: e.target.value })}
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
                    <button
                      onClick={() => handleUpdate(browser.id)}
                      className="btn btn-primary btn-sm flex items-center gap-1"
                    >
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
                      <h3 className="text-lg font-semibold text-text-primary">
                        {browser.name || browser.id}
                      </h3>
                      {browser.description && (
                        <p className="text-secondary text-sm">{browser.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-tertiary">ID: {browser.id}</span>
                        {browser.startUrl && (
                          <span className="text-xs text-tertiary">URL: {browser.startUrl}</span>
                        )}
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
                      ) : isDocker ? (
                        <button
                          onClick={() => fetchAuthCommand(browser.id)}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                          title="Get launch command"
                        >
                          <Terminal size={16} />
                          Get Command
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLaunch(browser.id)}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                          title={browser.startUrl ? `Launch to ${browser.startUrl}` : 'Launch browser'}
                        >
                          <Play size={16} />
                          Launch
                        </button>
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

      {/* Auth Command Modal */}
      {authModal && (
        <div className="card border-2 border-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Terminal size={20} />
              Run this command to authenticate
            </h3>
            <button
              onClick={() => setAuthModal(null)}
              className="btn btn-ghost btn-sm"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            {[
              { key: 'darwin', label: 'macOS' },
              { key: 'win32', label: 'Windows' },
              { key: 'linux', label: 'Linux' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedPlatform(key)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedPlatform === key
                    ? 'bg-primary text-white'
                    : 'bg-surface text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <pre className="bg-surface p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap break-all">
            {authModal.commands?.[selectedPlatform]}
          </pre>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={copyCommand}
              className="btn btn-primary flex items-center gap-2"
            >
              <Copy size={16} />
              Copy Command
            </button>
            <div className="text-sm text-secondary">
              <ol className="list-decimal list-inside space-y-1">
                <li>Paste and run in Terminal{selectedPlatform === 'win32' ? '/PowerShell' : ''}</li>
                <li>Log into the website</li>
                <li>Close the browser window</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Usage Info */}
      <div className="card bg-surface-alt">
        <h3 className="text-lg font-semibold text-text-primary mb-3">How Browser Profiles Work</h3>
        <div className="space-y-2 text-sm text-secondary">
          <p>
            Browser profiles store authentication cookies/sessions for plugins that need web access.
          </p>
          {isDocker ? (
            <>
              <p>
                <strong>Setup:</strong> Click &quot;Authenticate&quot;, copy the command, and run it in your
                terminal. Log into the website, then close the browser.
              </p>
              <p>
                <strong>Why:</strong> Docker cannot open browser windows on your desktop, so you run
                Chrome locally with a command that saves the session to the shared data folder.
              </p>
            </>
          ) : (
            <p>
              <strong>Setup:</strong> Click Launch to open a browser window. Log into your account,
              then close the browser when done.
            </p>
          )}
          <p>
            <strong>Usage:</strong> Plugins can use authenticated profiles for headless operations
            (e.g., video downloads).
          </p>
          <p>
            <strong>Storage:</strong> Profiles are saved in{' '}
            <code className="bg-surface px-1 rounded">data/browsers/</code>
          </p>
        </div>
      </div>
    </div>
  );
}
