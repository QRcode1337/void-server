import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Bot, 
  Check, 
  X, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Play, 
  Save, 
  RefreshCw, 
  Server, 
  Shield, 
  Terminal,
  Cpu,
  Sliders,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  
  const [providers, setProviders] = useState({});
  const [activeProvider, setActiveProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [editedConfigs, setEditedConfigs] = useState({});
  const [showApiKeys, setShowApiKeys] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [saving, setSaving] = useState({});
  
  // Navigation state initialized from URL param
  const [activeTab, setActiveTab] = useState(tab === 'providers' ? 'providers' : 'general');
  const [editingProviderKey, setEditingProviderKey] = useState(null);

  // Sync state with URL if it changes
  useEffect(() => {
    setActiveTab(tab === 'providers' ? 'providers' : 'general');
  }, [tab]);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, []);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    navigate(newTab === 'general' ? '/settings' : `/settings/${newTab}`);
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/ai-providers');
      const data = await res.json();
      setProviders(data.providers || {});
      setActiveProvider(data.activeProvider || '');
      setEditedConfigs(data.providers || {});
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      toast.error('Failed to load settings');
      setLoading(false);
    }
  };

  const handleConfigChange = (providerKey, field, value) => {
    setEditedConfigs(prev => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [field]: value
      }
    }));
  };

  const handleModelChange = (providerKey, modelType, value) => {
    setEditedConfigs(prev => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        models: {
          ...prev[providerKey]?.models,
          [modelType]: value
        }
      }
    }));
  };

  const handleSettingChange = (providerKey, setting, value) => {
    setEditedConfigs(prev => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        settings: {
          ...prev[providerKey]?.settings,
          [setting]: value
        }
      }
    }));
  };

  const saveProviderConfig = async (providerKey, configData = null) => {
    setSaving(prev => ({ ...prev, [providerKey]: true }));

    try {
      const config = configData || editedConfigs[providerKey];
      const res = await fetch(`/api/ai-providers/${providerKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await res.json();
      setSaving(prev => ({ ...prev, [providerKey]: false }));

      if (data.success) {
        toast.success(`${config.name} configuration saved`);
        fetchProviders(); // Refresh to get updated config
        // Optional: Close modal on save if desired, but keeping it open allows for more edits
      } else {
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      setSaving(prev => ({ ...prev, [providerKey]: false }));
      toast.error('Network error while saving');
    }
  };

  const handleToggleProvider = (providerKey, currentConfig, newValue) => {
    // Update local state first for UI responsiveness
    handleConfigChange(providerKey, 'enabled', newValue);
    
    // Auto-save the change (including any other pending edits)
    saveProviderConfig(providerKey, { ...currentConfig, enabled: newValue });
  };

  const testProvider = async (providerKey) => {
    setTesting(prev => ({ ...prev, [providerKey]: true }));
    setTestResults(prev => ({ ...prev, [providerKey]: null }));

    try {
      const res = await fetch(`/api/ai-providers/${providerKey}/test`, {
        method: 'POST'
      });

      const data = await res.json();
      setTesting(prev => ({ ...prev, [providerKey]: false }));
      setTestResults(prev => ({ ...prev, [providerKey]: data }));

      if (data.success) {
        toast.success(data.message || 'Connection successful');
      } else {
        toast.error(data.error || 'Connection failed');
      }
    } catch (error) {
      setTesting(prev => ({ ...prev, [providerKey]: false }));
      toast.error('Network error during test');
    }
  };

  const switchProvider = async (providerKey) => {
    try {
      const res = await fetch('/api/ai-providers/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerKey })
      });

      const data = await res.json();

      if (data.success) {
        setActiveProvider(providerKey);
        toast.success(data.message || `Switched to ${providerKey}`);
      } else {
        toast.error(data.error || 'Failed to switch provider');
      }
    } catch (error) {
      toast.error('Network error while switching provider');
    }
  };

  const toggleApiKeyVisibility = (providerKey) => {
    setShowApiKeys(prev => ({
      ...prev,
      [providerKey]: !prev[providerKey]
    }));
  };

  // Get list of providers
  const providerList = Object.entries(editedConfigs).map(([key, config]) => ({
    key,
    ...config
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--color-text-secondary)]">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-[var(--color-primary)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Configure system preferences and AI providers
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--color-border)] mb-4">
        <button
          onClick={() => handleTabChange('general')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'general'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          General
        </button>
        <button
          onClick={() => handleTabChange('providers')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'providers'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Cpu className="w-4 h-4" />
          AI Providers ({providerList.length})
        </button>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Active AI Provider
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Select the default AI provider to use for all generation tasks. 
              Only enabled providers are listed here.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providerList.filter(p => p.enabled).map(provider => (
                <button
                  key={provider.key}
                  onClick={() => switchProvider(provider.key)}
                  className={`relative flex items-center p-4 rounded-lg border transition-all ${
                    activeProvider === provider.key
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      activeProvider === provider.key ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                    }`}>
                      {provider.type === 'cli' ? <Terminal className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                      <div className={`font-medium ${
                        activeProvider === provider.key ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                      }`}>
                        {provider.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] capitalize">
                        {provider.type} Provider
                      </div>
                    </div>
                  </div>
                  {activeProvider === provider.key && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                  )}
                </button>
              ))}
              
              {providerList.filter(p => p.enabled).length === 0 && (
                <div className="col-span-full flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm">No providers are currently enabled. Please enable a provider in the "AI Providers" tab.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="card opacity-60 pointer-events-none">
             <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">System Preferences</h3>
             <p className="text-sm text-[var(--color-text-secondary)]">Additional system-wide settings will appear here.</p>
          </div>
        </div>
      )}

      {/* AI Providers Tab */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {providerList.map((provider) => (
            <div 
              key={provider.key} 
              className={`card hover:border-[var(--color-primary)] transition-all duration-200 flex flex-col ${
                activeProvider === provider.key ? 'border-[var(--color-primary)]/50 shadow-[0_0_15px_rgba(0,219,56,0.1)]' : ''
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${provider.enabled ? 'bg-green-500/10 text-green-500' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}>
                     {provider.type === 'cli' ? <Terminal className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      {provider.name}
                      {activeProvider === provider.key && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                          Active
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                      {provider.type} Provider
                    </p>
                  </div>
                </div>
                
                {/* Enable/Disable Toggle */}
                <label className="relative inline-flex items-center cursor-pointer" title={provider.enabled ? "Disable Provider" : "Enable Provider"}>
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={provider.enabled}
                    onChange={(e) => handleToggleProvider(provider.key, provider, e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-[var(--color-background)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
              
              {/* Main Content Area */}
              <div className="space-y-4 flex-1">
                {(provider.description || provider.link) && (
                  <div className="bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border)] space-y-2">
                    {provider.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] leading-snug">
                        {provider.description}
                      </p>
                    )}
                    {provider.link && (
                      <a
                        href={provider.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Provider link / download
                      </a>
                    )}
                  </div>
                )}
                
                {/* Status / Quick Action */}
                {provider.enabled && activeProvider !== provider.key && (
                  <button
                    onClick={() => switchProvider(provider.key)}
                    className="w-full py-1.5 rounded text-xs font-medium border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-3 h-3" />
                    Set as Active Provider
                  </button>
                )}
                
                {/* Model Inputs */}
                <div className="bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border)] space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Models</span>
                     <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">ID or Name</span>
                   </div>
                   {['light', 'medium', 'deep'].map(modelType => (
                      <div key={modelType} className="flex items-center gap-2">
                        <label className="w-12 text-[10px] text-[var(--color-text-secondary)] uppercase text-right shrink-0">
                          {modelType}
                        </label>
                        <input
                          type="text"
                          value={provider.models?.[modelType] || ''}
                          onChange={(e) => handleModelChange(provider.key, modelType, e.target.value)}
                          placeholder="model-id"
                          className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded focus:outline-none focus:border-[var(--color-primary)] font-mono"
                        />
                      </div>
                   ))}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
                  <button
                    onClick={() => saveProviderConfig(provider.key)}
                    disabled={saving[provider.key]}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2 text-xs py-1.5"
                  >
                    {saving[provider.key] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                  
                  <button
                    onClick={() => setEditingProviderKey(provider.key)}
                    className="btn btn-secondary flex items-center justify-center gap-2 text-xs py-1.5 px-3"
                    title="Connection Settings"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {editingProviderKey && editedConfigs[editingProviderKey] && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setEditingProviderKey(null)}>
          <div 
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
               <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-lg ${editedConfigs[editingProviderKey].enabled ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-background)] text-[var(--color-text-secondary)]'}`}>
                   {editedConfigs[editingProviderKey].type === 'cli' ? <Terminal className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                 </div>
                 <div>
                   <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                     Connection Settings
                   </h2>
                   <p className="text-xs text-[var(--color-text-secondary)]">
                     {editedConfigs[editingProviderKey].name}
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => setEditingProviderKey(null)}
                 className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 bg-[var(--color-background)]/50">
               <ProviderConfigContent 
                 providerKey={editingProviderKey}
                 config={editedConfigs[editingProviderKey]}
                 showApiKey={showApiKeys[editingProviderKey]}
                 testResult={testResults[editingProviderKey]}
                 isTesting={testing[editingProviderKey]}
                 onConfigChange={(field, value) => handleConfigChange(editingProviderKey, field, value)}
                 onToggleEnabled={(newValue) => handleToggleProvider(editingProviderKey, editedConfigs[editingProviderKey], newValue)}
                 onModelChange={(modelType, value) => handleModelChange(editingProviderKey, modelType, value)}
                 onSettingChange={(setting, value) => handleSettingChange(editingProviderKey, setting, value)}
                 onToggleApiKey={() => toggleApiKeyVisibility(editingProviderKey)}
               />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <button
                    onClick={() => testProvider(editingProviderKey)}
                    disabled={!editedConfigs[editingProviderKey].enabled || testing[editingProviderKey]}
                    className="btn btn-secondary flex items-center gap-2 text-xs"
                  >
                    {testing[editingProviderKey] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Test Connection
                  </button>
                  {testResults[editingProviderKey] && (
                    <span className={`text-xs flex items-center gap-1 ${testResults[editingProviderKey].success ? 'text-green-500' : 'text-red-500'}`}>
                      {testResults[editingProviderKey].success ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {testResults[editingProviderKey].success ? 'Success' : 'Failed'}
                    </span>
                  )}
               </div>
               
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setEditingProviderKey(null)}
                   className="btn btn-secondary text-xs"
                 >
                   Close
                 </button>
                 <button
                    onClick={() => saveProviderConfig(editingProviderKey)}
                    disabled={saving[editingProviderKey]}
                    className="btn btn-primary flex items-center gap-2 text-xs shadow-lg shadow-[var(--color-primary)]/10"
                  >
                    {saving[editingProviderKey] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable config content component (extracted from previous ProviderConfig)
const ProviderConfigContent = ({
  providerKey,
  config,
  showApiKey,
  testResult,
  isTesting,
  onConfigChange,
  onToggleEnabled,
  onModelChange,
  onSettingChange,
  onToggleApiKey
}) => {
  const isApiProvider = config.type === 'api';
  const isCliProvider = config.type === 'cli';

  return (
    <div className="space-y-6">
      {/* Enable/Disable Switch (also on card, but good to have here too) */}
      <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Enable Provider</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={config.enabled}
            onChange={(e) => {
              if (onToggleEnabled) {
                onToggleEnabled(e.target.checked);
              } else {
                onConfigChange('enabled', e.target.checked);
              }
            }}
          />
          <div className="w-9 h-5 bg-[var(--color-background)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
        </label>
      </div>

      {(config.description || config.link) && (
        <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] space-y-2">
          {config.description && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-snug">
              {config.description}
            </p>
          )}
          {config.link && (
            <a
              href={config.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80"
            >
              <ExternalLink className="w-4 h-4" />
              Provider link / download
            </a>
          )}
        </div>
      )}

      {/* Connection Settings */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--color-primary)]" />
          Endpoint & Keys
        </h3>
        <div className="grid gap-4 p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
          {isCliProvider && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Command
              </label>
              <div className="flex gap-2">
                 <span className="flex items-center justify-center w-8 bg-[var(--color-background)] border border-[var(--color-border)] rounded-l text-[var(--color-text-secondary)] font-mono text-xs">$</span>
                 <input
                    type="text"
                    value={config.command || ''}
                    onChange={(e) => onConfigChange('command', e.target.value)}
                    placeholder="claude"
                    className="flex-1 px-3 py-2 rounded-r bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
                  />
              </div>
            </div>
          )}

          {isApiProvider && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={config.endpoint || ''}
                  onChange={(e) => onConfigChange('endpoint', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.apiKey || ''}
                    onChange={(e) => onConfigChange('apiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={onToggleApiKey}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Advanced Settings */}
      {isApiProvider && config.settings && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--color-primary)]" />
            Parameters
          </h3>
          <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                  Temperature ({config.settings.temperature ?? 0.7})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.settings.temperature ?? 0.7}
                  onChange={(e) => onSettingChange('temperature', parseFloat(e.target.value))}
                  className="w-full accent-[var(--color-primary)] h-1 bg-[var(--color-background)] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.settings.max_tokens ?? 4096}
                  onChange={(e) => onSettingChange('max_tokens', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
