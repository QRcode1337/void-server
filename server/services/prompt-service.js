/**
 * Prompt Service
 * Manages templates and variables for prompt generation
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../../data/prompts');
const LEGACY_CONFIG_DIR = path.resolve(__dirname, '../../config/prompts');
const TEMPLATE_DIR = path.resolve(__dirname, '../../data_template/prompts');
const TEMPLATES_PATH = path.join(CONFIG_DIR, 'templates.json');
const VARIABLES_PATH = path.join(CONFIG_DIR, 'variables.json');
const LEGACY_TEMPLATES_PATH = path.join(LEGACY_CONFIG_DIR, 'templates.json');
const LEGACY_VARIABLES_PATH = path.join(LEGACY_CONFIG_DIR, 'variables.json');
const TEMPLATE_TEMPLATES_PATH = path.join(TEMPLATE_DIR, 'templates.json');
const TEMPLATE_VARIABLES_PATH = path.join(TEMPLATE_DIR, 'variables.json');

let templatesData = null;
let variablesData = null;
let defaultTemplates = null;
let defaultVariables = null;

/**
 * Load default templates from data_template (cached)
 */
function getDefaultTemplates() {
  if (!defaultTemplates) {
    if (fs.existsSync(TEMPLATE_TEMPLATES_PATH)) {
      defaultTemplates = JSON.parse(fs.readFileSync(TEMPLATE_TEMPLATES_PATH, 'utf8'));
    } else {
      defaultTemplates = { templates: {} };
    }
  }
  return defaultTemplates;
}

/**
 * Load default variables from data_template (cached)
 */
function getDefaultVariables() {
  if (!defaultVariables) {
    if (fs.existsSync(TEMPLATE_VARIABLES_PATH)) {
      defaultVariables = JSON.parse(fs.readFileSync(TEMPLATE_VARIABLES_PATH, 'utf8'));
    } else {
      defaultVariables = { variables: {} };
    }
  }
  return defaultVariables;
}

/**
 * Check if a template is a core template (defined in data_template)
 */
function isCoreTemplate(id) {
  const defaults = getDefaultTemplates();
  return !!defaults.templates[id];
}

/**
 * Check if a variable is a core variable (defined in data_template)
 */
function isCoreVariable(id) {
  const defaults = getDefaultVariables();
  return !!defaults.variables[id];
}

/**
 * Get list of core template IDs
 */
function getCoreTemplateIds() {
  const defaults = getDefaultTemplates();
  return Object.keys(defaults.templates);
}

/**
 * Get list of core variable IDs
 */
function getCoreVariableIds() {
  const defaults = getDefaultVariables();
  return Object.keys(defaults.variables);
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Migrate prompts from legacy location (config/prompts) to new location (data/prompts)
 */
function migrateFromLegacy() {
  ensureConfigDir();
  let migrated = 0;

  // Migrate templates.json
  if (fs.existsSync(LEGACY_TEMPLATES_PATH) && !fs.existsSync(TEMPLATES_PATH)) {
    fs.copyFileSync(LEGACY_TEMPLATES_PATH, TEMPLATES_PATH);
    fs.unlinkSync(LEGACY_TEMPLATES_PATH);
    migrated++;
  }

  // Migrate variables.json
  if (fs.existsSync(LEGACY_VARIABLES_PATH) && !fs.existsSync(VARIABLES_PATH)) {
    fs.copyFileSync(LEGACY_VARIABLES_PATH, VARIABLES_PATH);
    fs.unlinkSync(LEGACY_VARIABLES_PATH);
    migrated++;
  }

  if (migrated > 0) {
    console.log(`📦 Migrated ${migrated} prompt file(s) from config/prompts to data/prompts`);
  }

  return migrated;
}

/**
 * Check if a config file is empty or has no meaningful content
 */
function isEmptyConfig(filePath, key) {
  if (!fs.existsSync(filePath)) return true;
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return !content[key] || Object.keys(content[key]).length === 0;
}

/**
 * Load templates from disk and merge missing core templates
 */
function loadTemplates() {
  ensureConfigDir();
  migrateFromLegacy();

  // Copy from data_template if file doesn't exist OR is empty
  if (isEmptyConfig(TEMPLATES_PATH, 'templates')) {
    if (fs.existsSync(TEMPLATE_TEMPLATES_PATH)) {
      fs.copyFileSync(TEMPLATE_TEMPLATES_PATH, TEMPLATES_PATH);
      console.log('📋 Initialized templates from data_template');
    } else if (!fs.existsSync(TEMPLATES_PATH)) {
      fs.writeFileSync(TEMPLATES_PATH, JSON.stringify({ templates: {} }, null, 2));
    }
  }
  templatesData = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));

  // Merge any missing core templates
  const defaults = getDefaultTemplates();
  let merged = 0;
  for (const [id, template] of Object.entries(defaults.templates)) {
    if (!templatesData.templates[id]) {
      templatesData.templates[id] = template;
      merged++;
    }
  }
  if (merged > 0) {
    saveTemplates();
    console.log(`📋 Added ${merged} missing core template(s)`);
  }

  return templatesData;
}

/**
 * Save templates to disk
 */
function saveTemplates() {
  if (!templatesData) return;
  fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(templatesData, null, 2));
}

/**
 * Load variables from disk and merge missing core variables
 */
function loadVariables() {
  ensureConfigDir();

  // Copy from data_template if file doesn't exist OR is empty
  if (isEmptyConfig(VARIABLES_PATH, 'variables')) {
    if (fs.existsSync(TEMPLATE_VARIABLES_PATH)) {
      fs.copyFileSync(TEMPLATE_VARIABLES_PATH, VARIABLES_PATH);
      console.log('📋 Initialized variables from data_template');
    } else if (!fs.existsSync(VARIABLES_PATH)) {
      fs.writeFileSync(VARIABLES_PATH, JSON.stringify({ variables: {} }, null, 2));
    }
  }
  variablesData = JSON.parse(fs.readFileSync(VARIABLES_PATH, 'utf8'));

  // Merge any missing core variables
  const defaults = getDefaultVariables();
  let merged = 0;
  for (const [id, variable] of Object.entries(defaults.variables)) {
    if (!variablesData.variables[id]) {
      variablesData.variables[id] = variable;
      merged++;
    }
  }
  if (merged > 0) {
    saveVariables();
    console.log(`📋 Added ${merged} missing core variable(s)`);
  }

  return variablesData;
}

/**
 * Save variables to disk
 */
function saveVariables() {
  if (!variablesData) return;
  fs.writeFileSync(VARIABLES_PATH, JSON.stringify(variablesData, null, 2));
}

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * Get all templates
 */
function getTemplates() {
  if (!templatesData) loadTemplates();
  return Object.values(templatesData.templates);
}

/**
 * Get template by ID
 */
function getTemplate(id) {
  if (!templatesData) loadTemplates();
  return templatesData.templates[id] || null;
}

/**
 * Create a new template
 */
function createTemplate(data) {
  if (!templatesData) loadTemplates();

  const id = data.id || `template-${Date.now()}`;

  if (templatesData.templates[id]) {
    return { success: false, error: `Template with ID "${id}" already exists` };
  }

  const now = new Date().toISOString();
  const template = {
    id,
    name: data.name || 'Untitled Template',
    description: data.description || '',
    template: data.template || '',
    variables: data.variables || [],
    provider: data.provider || null,
    settings: data.settings || {},
    createdAt: now,
    updatedAt: now
  };

  templatesData.templates[id] = template;
  saveTemplates();

  console.log(`📝 Created template: ${template.name}`);
  return { success: true, template };
}

/**
 * Update an existing template
 */
function updateTemplate(id, updates) {
  if (!templatesData) loadTemplates();

  if (!templatesData.templates[id]) {
    return { success: false, error: `Template "${id}" not found` };
  }

  const template = templatesData.templates[id];

  templatesData.templates[id] = {
    ...template,
    ...updates,
    id, // Prevent ID change
    updatedAt: new Date().toISOString()
  };

  saveTemplates();

  console.log(`✏️ Updated template: ${templatesData.templates[id].name}`);
  return { success: true, template: templatesData.templates[id] };
}

/**
 * Delete a template (core templates cannot be deleted)
 */
function deleteTemplate(id) {
  if (!templatesData) loadTemplates();

  if (!templatesData.templates[id]) {
    return { success: false, error: `Template "${id}" not found` };
  }

  if (isCoreTemplate(id)) {
    return { success: false, error: `Cannot delete core template "${id}". You can reset it to defaults instead.` };
  }

  const name = templatesData.templates[id].name;
  delete templatesData.templates[id];
  saveTemplates();

  console.log(`🗑️ Deleted template: ${name}`);
  return { success: true, message: `Deleted template "${name}"` };
}

/**
 * Reset a core template to its default value
 */
function resetTemplate(id) {
  if (!templatesData) loadTemplates();
  const defaults = getDefaultTemplates();

  if (!defaults.templates[id]) {
    return { success: false, error: `Template "${id}" is not a core template and cannot be reset` };
  }

  templatesData.templates[id] = { ...defaults.templates[id] };
  saveTemplates();

  console.log(`🔄 Reset template to default: ${templatesData.templates[id].name}`);
  return { success: true, template: templatesData.templates[id] };
}

// ============================================================================
// Variable CRUD
// ============================================================================

/**
 * Get all variables
 */
function getVariables() {
  if (!variablesData) loadVariables();
  return Object.values(variablesData.variables);
}

/**
 * Get variable by ID
 */
function getVariable(id) {
  if (!variablesData) loadVariables();
  return variablesData.variables[id] || null;
}

/**
 * Create a new variable
 */
function createVariable(data) {
  if (!variablesData) loadVariables();

  const id = data.id || `var-${Date.now()}`;

  if (variablesData.variables[id]) {
    return { success: false, error: `Variable with ID "${id}" already exists` };
  }

  const variable = {
    id,
    name: data.name || 'Untitled Variable',
    category: data.category || 'general',
    description: data.description || '',
    content: data.content || ''
  };

  variablesData.variables[id] = variable;
  saveVariables();

  console.log(`📝 Created variable: ${variable.name}`);
  return { success: true, variable };
}

/**
 * Update an existing variable
 */
function updateVariable(id, updates) {
  if (!variablesData) loadVariables();

  if (!variablesData.variables[id]) {
    return { success: false, error: `Variable "${id}" not found` };
  }

  const variable = variablesData.variables[id];

  variablesData.variables[id] = {
    ...variable,
    ...updates,
    id // Prevent ID change
  };

  saveVariables();

  console.log(`✏️ Updated variable: ${variablesData.variables[id].name}`);
  return { success: true, variable: variablesData.variables[id] };
}

/**
 * Delete a variable (core variables cannot be deleted)
 */
function deleteVariable(id) {
  if (!variablesData) loadVariables();

  if (!variablesData.variables[id]) {
    return { success: false, error: `Variable "${id}" not found` };
  }

  if (isCoreVariable(id)) {
    return { success: false, error: `Cannot delete core variable "${id}". You can reset it to defaults instead.` };
  }

  const name = variablesData.variables[id].name;
  delete variablesData.variables[id];
  saveVariables();

  console.log(`🗑️ Deleted variable: ${name}`);
  return { success: true, message: `Deleted variable "${name}"` };
}

/**
 * Reset a core variable to its default value
 */
function resetVariable(id) {
  if (!variablesData) loadVariables();
  const defaults = getDefaultVariables();

  if (!defaults.variables[id]) {
    return { success: false, error: `Variable "${id}" is not a core variable and cannot be reset` };
  }

  variablesData.variables[id] = { ...defaults.variables[id] };
  saveVariables();

  console.log(`🔄 Reset variable to default: ${variablesData.variables[id].name}`);
  return { success: true, variable: variablesData.variables[id] };
}

// ============================================================================
// Template Building
// ============================================================================

/**
 * Build a prompt from a template with variable substitution
 * Supports Mustache-like syntax: {{variableName}}
 * Also supports sections: {{#varName}}content{{/varName}} (renders if var exists)
 */
function buildPrompt(templateId, providedValues = {}) {
  if (!templatesData) loadTemplates();
  if (!variablesData) loadVariables();

  const template = templatesData.templates[templateId];
  if (!template) {
    return { success: false, error: `Template "${templateId}" not found` };
  }

  let result = template.template;

  // Resolve variable values - merge stored variables with provided values
  const resolvedValues = {};

  for (const varName of template.variables) {
    // Check provided values first, then fall back to stored variable content
    if (providedValues[varName] !== undefined) {
      resolvedValues[varName] = providedValues[varName];
    } else if (variablesData.variables[varName]) {
      resolvedValues[varName] = variablesData.variables[varName].content;
    } else {
      resolvedValues[varName] = '';
    }
  }

  // Also include any extra provided values not in template.variables
  for (const [key, value] of Object.entries(providedValues)) {
    if (resolvedValues[key] === undefined) {
      resolvedValues[key] = value;
    }
  }

  // Process sections first: {{#varName}}content{{/varName}}
  const sectionRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(sectionRegex, (match, varName, content) => {
    const value = resolvedValues[varName];
    // If value is truthy (exists and not empty), render the content
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      // If it's an array, join with newlines (for chat history)
      if (Array.isArray(value)) {
        return value.join('\n');
      }
      // Otherwise substitute the variable in the content
      return content.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
    }
    return '';
  });

  // Then substitute simple variables: {{variableName}}
  const varRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(varRegex, (match, varName) => {
    const value = resolvedValues[varName];
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return value !== undefined ? value : match;
  });

  return {
    success: true,
    prompt: result.trim(),
    template,
    resolvedValues
  };
}

/**
 * Validate a template's syntax
 */
function validateTemplate(templateStr) {
  const errors = [];

  // Check for unmatched section tags
  const openSections = [];
  const sectionOpenRegex = /\{\{#(\w+)\}\}/g;
  const sectionCloseRegex = /\{\{\/(\w+)\}\}/g;

  let match;
  while ((match = sectionOpenRegex.exec(templateStr)) !== null) {
    openSections.push(match[1]);
  }

  while ((match = sectionCloseRegex.exec(templateStr)) !== null) {
    const idx = openSections.indexOf(match[1]);
    if (idx === -1) {
      errors.push(`Unmatched closing tag: {{/${match[1]}}}`);
    } else {
      openSections.splice(idx, 1);
    }
  }

  for (const unclosed of openSections) {
    errors.push(`Unclosed section tag: {{#${unclosed}}}`);
  }

  // Extract all variable references
  const varRegex = /\{\{#?(\w+)\}\}/g;
  const variables = new Set();
  while ((match = varRegex.exec(templateStr)) !== null) {
    variables.add(match[1]);
  }

  return {
    valid: errors.length === 0,
    errors,
    variables: [...variables]
  };
}

/**
 * Get variables used by templates
 */
function getVariableUsage() {
  if (!templatesData) loadTemplates();
  if (!variablesData) loadVariables();

  const usage = {};

  for (const variable of Object.values(variablesData.variables)) {
    usage[variable.id] = {
      variable,
      usedBy: []
    };
  }

  for (const template of Object.values(templatesData.templates)) {
    for (const varId of template.variables || []) {
      if (usage[varId]) {
        usage[varId].usedBy.push({
          id: template.id,
          name: template.name
        });
      }
    }
  }

  return usage;
}

/**
 * Initialize prompt service
 */
function initialize() {
  loadTemplates();
  loadVariables();
  console.log(`📋 Prompt service initialized (${Object.keys(templatesData.templates).length} templates, ${Object.keys(variablesData.variables).length} variables)`);
}

module.exports = {
  initialize,
  loadTemplates,
  loadVariables,
  saveTemplates,
  saveVariables,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resetTemplate,
  isCoreTemplate,
  getCoreTemplateIds,
  getVariables,
  getVariable,
  createVariable,
  updateVariable,
  deleteVariable,
  resetVariable,
  isCoreVariable,
  getCoreVariableIds,
  buildPrompt,
  validateTemplate,
  getVariableUsage
};
