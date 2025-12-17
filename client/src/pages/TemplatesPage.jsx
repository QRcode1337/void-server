import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Play,
  Copy,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [variables, setVariables] = useState([]);
  void variables; // Set by API for template variable management
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expandedTemplate, setExpandedTemplate] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    template: '',
    variables: [],
    provider: { key: '', modelType: 'medium' },
    settings: { temperature: 0.7, max_tokens: 2048 },
  });

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    const response = await fetch('/api/prompts/templates');
    const data = await response.json();
    if (data.success) {
      setTemplates(data.templates);
    }
  }, []);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    const response = await fetch('/api/prompts/providers');
    const data = await response.json();
    if (data.success) {
      setProviders(data.providers);
    }
  }, []);

  // Fetch variables
  const fetchVariables = useCallback(async () => {
    const response = await fetch('/api/prompts/variables');
    const data = await response.json();
    if (data.success) {
      setVariables(data.variables);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchProviders();
    fetchVariables();
  }, [fetchTemplates, fetchProviders, fetchVariables]);

  // Open modal for new template
  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      template: '',
      variables: [],
      provider: { key: 'lmstudio', modelType: 'medium' },
      settings: { temperature: 0.7, max_tokens: 2048 },
    });
    setTestResult(null);
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = template => {
    setEditingTemplate(template);
    setFormData({
      id: template.id,
      name: template.name,
      description: template.description || '',
      template: template.template,
      variables: template.variables || [],
      provider: template.provider || { key: '', modelType: 'medium' },
      settings: template.settings || { temperature: 0.7, max_tokens: 2048 },
    });
    setTestResult(null);
    setShowModal(true);
  };

  // Save template
  const handleSave = async () => {
    const isNew = !editingTemplate;
    const url = isNew ? '/api/prompts/templates' : `/api/prompts/templates/${editingTemplate.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      await fetchTemplates();
      setShowModal(false);
      toast.success(isNew ? 'Template created' : 'Template updated');
    } else {
      toast.error(data.error || 'Failed to save template');
    }
  };

  // Delete template
  const handleDelete = async id => {
    const response = await fetch(`/api/prompts/templates/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (data.success) {
      await fetchTemplates();
      toast.success('Template deleted');
    } else {
      toast.error(data.error || 'Failed to delete template');
    }
  };

  // Reset core template to default
  const handleReset = async id => {
    const response = await fetch(`/api/prompts/templates/${id}/reset`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      await fetchTemplates();
      toast.success('Template reset to default');
    } else {
      toast.error(data.error || 'Failed to reset template');
    }
  };

  // Test template
  const handleTest = async () => {
    const response = await fetch(`/api/prompts/templates/${formData.id || 'test'}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: { userMessage: 'Hello, this is a test message.' },
      }),
    });

    const data = await response.json();
    setTestResult(data);

    if (data.success) {
      toast.success('Template tested successfully');
    } else {
      toast.error(data.error || 'Test failed');
    }
  };

  // Duplicate template
  const handleDuplicate = template => {
    setEditingTemplate(null);
    setFormData({
      ...template,
      id: `${template.id}-copy`,
      name: `${template.name} (Copy)`,
    });
    setTestResult(null);
    setShowModal(true);
  };

  // Extract variables from template string
  const extractVariables = templateStr => {
    const matches = templateStr.match(/\{\{#?(\w+)\}\}/g) || [];
    const vars = matches.map(m => m.replace(/\{\{#?|\}\}/g, ''));
    return [...new Set(vars)];
  };

  // Auto-extract variables when template changes
  const handleTemplateChange = value => {
    const extracted = extractVariables(value);
    setFormData(prev => ({
      ...prev,
      template: value,
      variables: extracted,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode size={28} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Templates</h1>
            <p className="text-sm text-text-secondary">
              Manage prompt templates for provider executions
            </p>
          </div>
        </div>
        <button onClick={handleNew} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Template
        </button>
      </div>

      {/* Templates list */}
      <div data-testid="templates" className="space-y-3">
        {templates.length === 0 ? (
          <div className="card text-center py-8">
            <FileCode size={48} className="mx-auto mb-4 text-text-tertiary opacity-50" />
            <p className="text-text-secondary">No templates yet</p>
            <button onClick={handleNew} className="btn btn-primary mt-4">
              Create your first template
            </button>
          </div>
        ) : (
          templates.map(template => (
            <div key={template.id} data-testid={`template-${template.id}`} className="card template-item">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedTemplate(expandedTemplate === template.id ? null : template.id)
                }
              >
                <div className="flex items-center gap-3">
                  {expandedTemplate === template.id ? (
                    <ChevronDown size={18} className="text-text-secondary" />
                  ) : (
                    <ChevronRight size={18} className="text-text-secondary" />
                  )}
                  <div>
                    <h3 className="font-medium text-text-primary">{template.name}</h3>
                    <p className="text-sm text-text-secondary">{template.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                    {template.id}
                  </span>
                  {template.isCore && (
                    <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-500 flex items-center gap-1">
                      <Shield size={12} />
                      Core
                    </span>
                  )}
                  {template.provider?.key && (
                    <span className="text-xs px-2 py-1 rounded bg-border text-text-secondary">
                      {template.provider.key}
                    </span>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDuplicate(template);
                    }}
                    className="p-2 rounded hover:bg-border/50 text-text-secondary"
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleEdit(template);
                    }}
                    className="p-2 rounded hover:bg-border/50 text-text-secondary"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  {template.isCore ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleReset(template.id);
                      }}
                      className="p-2 rounded hover:bg-amber-500/20 text-amber-500"
                      title="Reset to default"
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(template.id);
                      }}
                      className="p-2 rounded hover:bg-error/20 text-error"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedTemplate === template.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary mb-2">
                        Template Content
                      </h4>
                      <pre className="text-xs bg-background p-3 rounded-lg overflow-auto max-h-48 text-text-primary">
                        {template.template}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-secondary mb-2">Variables</h4>
                      <div className="flex flex-wrap gap-2">
                        {(template.variables || []).map(v => (
                          <span
                            key={v}
                            className="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                      {template.settings && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-text-secondary mb-2">Settings</h4>
                          <p className="text-xs text-text-tertiary">
                            Temperature: {template.settings.temperature} | Max tokens:{' '}
                            {template.settings.max_tokens}
                          </p>
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
            className="bg-surface border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded hover:bg-border/50 text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* ID and Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">ID</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                    className="form-input w-full"
                    placeholder="template-id"
                    disabled={!!editingTemplate}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    data-testid="template-name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="form-input w-full"
                    placeholder="Template Name"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="form-input w-full"
                  placeholder="What this template is for..."
                />
              </div>

              {/* Template content */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Template Content
                </label>
                <textarea
                  name="content"
                  data-testid="template-content"
                  value={formData.template}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="form-input w-full font-mono text-sm"
                  rows={8}
                  placeholder="Use {{variableName}} for variable substitution..."
                />
                <p className="text-xs text-text-tertiary mt-1">
                  Detected variables: {formData.variables.join(', ') || 'none'}
                </p>
              </div>

              {/* Provider settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Provider
                  </label>
                  <select
                    value={formData.provider.key}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        provider: { ...formData.provider, key: e.target.value },
                      })
                    }
                    className="form-input w-full"
                  >
                    <option value="">Use active provider</option>
                    {providers.map(p => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Model Type
                  </label>
                  <select
                    value={formData.provider.modelType}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        provider: { ...formData.provider, modelType: e.target.value },
                      })
                    }
                    className="form-input w-full"
                  >
                    <option value="light">Light (fast)</option>
                    <option value="medium">Medium (balanced)</option>
                    <option value="deep">Deep (powerful)</option>
                  </select>
                </div>
              </div>

              {/* Generation settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.settings.temperature}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, temperature: parseFloat(e.target.value) },
                      })
                    }
                    className="form-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="32000"
                    step="100"
                    value={formData.settings.max_tokens}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        settings: { ...formData.settings, max_tokens: parseInt(e.target.value) },
                      })
                    }
                    className="form-input w-full"
                  />
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className="p-3 rounded-lg bg-background">
                  <h4 className="text-sm font-medium text-text-secondary mb-2">Test Result</h4>
                  <pre className="text-xs overflow-auto max-h-32 text-text-primary">
                    {testResult.prompt || testResult.error}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <button
                onClick={handleTest}
                className="btn btn-secondary flex items-center gap-2"
                disabled={!formData.id && !editingTemplate}
              >
                <Play size={16} />
                Test
              </button>
              <div className="flex gap-2">
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
        </div>
      )}
    </div>
  );
}

export default TemplatesPage;
