import React, { useState, useEffect, useCallback } from 'react';
import {
  Braces,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  RotateCcw,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'persona', label: 'Persona', description: 'Character definitions and personalities' },
  { value: 'system', label: 'System', description: 'System prompts and contexts' },
  { value: 'narrative', label: 'Narrative', description: 'Story elements and lore' },
  { value: 'visual', label: 'Visual', description: 'Visual styling and formatting' },
  { value: 'general', label: 'General', description: 'General purpose variables' },
];

function VariablesPage() {
  const [variables, setVariables] = useState([]);
  const [usage, setUsage] = useState({});
  const [editingVariable, setEditingVariable] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedVariable, setExpandedVariable] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    category: 'general',
    description: '',
    content: '',
  });

  // Fetch variables
  const fetchVariables = useCallback(async () => {
    const response = await fetch('/api/prompts/variables');
    const data = await response.json();
    if (data.success) {
      setVariables(data.variables);
    }
  }, []);

  // Fetch usage
  const fetchUsage = useCallback(async () => {
    const response = await fetch('/api/prompts/variables/usage');
    const data = await response.json();
    if (data.success) {
      setUsage(data.usage);
    }
  }, []);

  useEffect(() => {
    fetchVariables();
    fetchUsage();
  }, [fetchVariables, fetchUsage]);

  // Filter variables
  const filteredVariables = variables.filter(v => {
    if (categoryFilter && v.category !== categoryFilter) return false;
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      return (
        v.id.toLowerCase().includes(search) ||
        v.name.toLowerCase().includes(search) ||
        v.content.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Group by category
  const groupedVariables = filteredVariables.reduce((acc, v) => {
    const cat = v.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  // Open modal for new variable
  const handleNew = () => {
    setEditingVariable(null);
    setFormData({
      id: '',
      name: '',
      category: 'general',
      description: '',
      content: '',
    });
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = variable => {
    setEditingVariable(variable);
    setFormData({
      id: variable.id,
      name: variable.name,
      category: variable.category || 'general',
      description: variable.description || '',
      content: variable.content,
    });
    setShowModal(true);
  };

  // Save variable
  const handleSave = async () => {
    const isNew = !editingVariable;
    const url = isNew ? '/api/prompts/variables' : `/api/prompts/variables/${editingVariable.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (data.success) {
      await fetchVariables();
      await fetchUsage();
      setShowModal(false);
      toast.success(isNew ? 'Variable created' : 'Variable updated');
    } else {
      toast.error(data.error || 'Failed to save variable');
    }
  };

  // Delete variable
  const handleDelete = async id => {
    const usedBy = usage[id]?.usedBy || [];
    if (usedBy.length > 0) {
      toast.error(`Cannot delete: used by ${usedBy.length} template(s)`);
      return;
    }

    const response = await fetch(`/api/prompts/variables/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (data.success) {
      await fetchVariables();
      await fetchUsage();
      toast.success('Variable deleted');
    } else {
      toast.error(data.error || 'Failed to delete variable');
    }
  };

  // Reset core variable to default
  const handleReset = async id => {
    const response = await fetch(`/api/prompts/variables/${id}/reset`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      await fetchVariables();
      toast.success('Variable reset to default');
    } else {
      toast.error(data.error || 'Failed to reset variable');
    }
  };

  // Get category info
  const getCategoryInfo = cat => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[4];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Braces size={28} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Variables</h1>
            <p className="text-sm text-text-secondary">
              Reusable content blocks for prompt templates
            </p>
          </div>
        </div>
        <button onClick={handleNew} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Variable
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search variables..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="form-input flex-1 min-w-[200px]"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="form-input"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Variables list by category */}
      <div className="space-y-6">
        {Object.keys(groupedVariables).length === 0 ? (
          <div className="card text-center py-8">
            <Braces size={48} className="mx-auto mb-4 text-text-tertiary opacity-50" />
            <p className="text-text-secondary">
              {searchFilter || categoryFilter ? 'No matching variables' : 'No variables yet'}
            </p>
            {!searchFilter && !categoryFilter && (
              <button onClick={handleNew} className="btn btn-primary mt-4">
                Create your first variable
              </button>
            )}
          </div>
        ) : (
          Object.entries(groupedVariables).map(([category, vars]) => {
            const catInfo = getCategoryInfo(category);
            return (
              <div key={category}>
                <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                  {catInfo.label}
                  <span className="text-sm font-normal text-text-tertiary">({vars.length})</span>
                </h2>
                <div className="space-y-2">
                  {vars.map(variable => {
                    const varUsage = usage[variable.id]?.usedBy || [];
                    return (
                      <div key={variable.id} className="card">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() =>
                            setExpandedVariable(
                              expandedVariable === variable.id ? null : variable.id
                            )
                          }
                        >
                          <div className="flex items-center gap-3">
                            {expandedVariable === variable.id ? (
                              <ChevronDown size={18} className="text-text-secondary" />
                            ) : (
                              <ChevronRight size={18} className="text-text-secondary" />
                            )}
                            <div>
                              <h3 className="font-medium text-text-primary">{variable.name}</h3>
                              <p className="text-sm text-text-secondary">{variable.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-mono">
                              {`{{${variable.id}}}`}
                            </span>
                            {variable.isCore && (
                              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-500 flex items-center gap-1">
                                <Shield size={12} />
                                Core
                              </span>
                            )}
                            {varUsage.length > 0 && (
                              <span className="text-xs px-2 py-1 rounded bg-border text-text-secondary flex items-center gap-1">
                                <FileText size={12} />
                                {varUsage.length}
                              </span>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleEdit(variable);
                              }}
                              className="p-2 rounded hover:bg-border/50 text-text-secondary"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            {variable.isCore ? (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleReset(variable.id);
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
                                  handleDelete(variable.id);
                                }}
                                className={`p-2 rounded ${
                                  varUsage.length > 0
                                    ? 'text-text-tertiary cursor-not-allowed'
                                    : 'hover:bg-error/20 text-error'
                                }`}
                                title={varUsage.length > 0 ? 'In use by templates' : 'Delete'}
                                disabled={varUsage.length > 0}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded content */}
                        {expandedVariable === variable.id && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-2">
                                  Content
                                </h4>
                                <pre className="text-xs bg-background p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap text-text-primary">
                                  {variable.content}
                                </pre>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-text-secondary mb-2">
                                  Used By Templates
                                </h4>
                                {varUsage.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {varUsage.map(t => (
                                      <span
                                        key={t.id}
                                        className="text-xs px-2 py-1 rounded bg-border text-text-secondary"
                                      >
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-text-tertiary">
                                    Not used by any templates
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
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
                {editingVariable ? 'Edit Variable' : 'New Variable'}
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
                    className="form-input w-full font-mono"
                    placeholder="variableId"
                    disabled={!!editingVariable}
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Use in templates as {`{{${formData.id || 'variableId'}}}`}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="form-input w-full"
                    placeholder="Variable Name"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="form-input w-full"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
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
                  placeholder="What this variable contains..."
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  className="form-input w-full font-mono text-sm"
                  rows={12}
                  placeholder="The variable content that will be substituted into templates..."
                />
                <p className="text-xs text-text-tertiary mt-1">
                  {formData.content.length} characters
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-border flex justify-end gap-2">
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

export default VariablesPage;
