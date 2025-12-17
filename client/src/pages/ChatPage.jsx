import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Download,
  AlertTriangle,
  ExternalLink,
  Brain,
  Database,
  Info,
  Bug,
  Code
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Parse message content for special tags like <think> and <purr>
 * Returns { thinkContent, displayContent }
 */
function parseMessageContent(content) {
  if (!content) return { thinkContent: null, displayContent: '' };

  let thinkContent = null;
  let displayContent = content;

  // Extract <think>...</think> content
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    displayContent = content.replace(/<think>[\s\S]*?<\/think>\s*/, '');
  }

  // Extract content from <purr>...</purr> wrapper if present
  const purrMatch = displayContent.match(/<purr>([\s\S]*?)<\/purr>/);
  if (purrMatch) {
    displayContent = purrMatch[1].trim();
  }

  return { thinkContent, displayContent: displayContent.trim() };
}

/**
 * Collapsible thinking block component
 */
function ThinkingBlock({ content }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        <span>Thinking...</span>
      </button>
      {isOpen && (
        <div className="mt-2 p-2 text-xs text-text-tertiary bg-background/50 rounded border border-border/50 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible debug panel component
 */
function DebugPanel({ debug }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!debug) return null;

  return (
    <div className="mt-2 border-t border-border/30 pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <Bug size={12} />
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        <span>Debug Info</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-3 text-xs">
          {/* Compiled Prompt */}
          <div>
            <div className="flex items-center gap-1 text-text-secondary mb-1">
              <Code size={12} />
              <span className="font-medium">Compiled Prompt</span>
            </div>
            <pre className="p-2 bg-background/80 rounded border border-border/50 whitespace-pre-wrap text-text-tertiary max-h-64 overflow-y-auto">
              {debug.compiledPrompt}
            </pre>
          </div>

          {/* Memory Context */}
          {debug.memoryContext && (
            <div>
              <div className="flex items-center gap-1 text-text-secondary mb-1">
                <Brain size={12} />
                <span className="font-medium">Memory Context</span>
              </div>
              <pre className="p-2 bg-background/80 rounded border border-border/50 whitespace-pre-wrap text-text-tertiary max-h-32 overflow-y-auto">
                {debug.memoryContext}
              </pre>
            </div>
          )}

          {/* Memories Retrieved */}
          {debug.memoriesRetrieved?.length > 0 && (
            <div>
              <div className="text-text-secondary mb-1 font-medium">
                Memories Retrieved ({debug.memoriesRetrieved.length})
              </div>
              <div className="space-y-1">
                {debug.memoriesRetrieved.map((m, i) => (
                  <div key={i} className="p-2 bg-background/80 rounded border border-border/50 text-text-tertiary">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-text-secondary">{m.category}</span>
                      <span>score: {m.score?.toFixed(2)}</span>
                    </div>
                    <div className="truncate">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variable Values */}
          {debug.variableValues && (
            <div>
              <div className="text-text-secondary mb-1 font-medium">Variables Used</div>
              <div className="p-2 bg-background/80 rounded border border-border/50 text-text-tertiary">
                {Object.entries(debug.variableValues).map(([key, val]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-text-secondary">{key}:</span>
                    <span className="truncate">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatPage() {
  const { id: chatId } = useParams();
  const navigate = useNavigate();

  // Chat state
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [neo4jStatus, setNeo4jStatus] = useState({ available: null });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('clawedegregore');
  const [providerOverride, setProviderOverride] = useState('');
  const [modelTypeOverride, setModelTypeOverride] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch chats list
  const fetchChats = useCallback(async () => {
    const response = await fetch('/api/chat');
    const data = await response.json();
    if (data.success) {
      setChats(data.chats);
    }
  }, []);

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

  // Fetch Neo4j status
  const fetchNeo4jStatus = useCallback(async () => {
    const response = await fetch('/api/memories/status');
    const data = await response.json();
    if (data.success) {
      setNeo4jStatus(data.neo4j);
    }
  }, []);

  // Fetch a specific chat
  const fetchChat = useCallback(async (id) => {
    const response = await fetch(`/api/chat/${id}`);
    const data = await response.json();
    if (data.success) {
      setActiveChat(data.chat);
    } else {
      toast.error('Chat not found');
      navigate('/chat');
    }
  }, [navigate]);

  // Initial data fetch
  useEffect(() => {
    fetchChats();
    fetchTemplates();
    fetchProviders();
    fetchNeo4jStatus();
  }, [fetchChats, fetchTemplates, fetchProviders, fetchNeo4jStatus]);

  // Load chat when ID changes
  useEffect(() => {
    if (chatId) {
      fetchChat(chatId);
    } else {
      setActiveChat(null);
    }
  }, [chatId, fetchChat]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  // Focus input when chat is loaded
  useEffect(() => {
    if (activeChat) {
      inputRef.current?.focus();
    }
  }, [activeChat]);

  // Create new chat
  const handleNewChat = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: selectedTemplate,
        providerOverride: providerOverride || undefined
      })
    });

    const data = await response.json();
    if (data.success) {
      await fetchChats();
      navigate(`/chat/${data.chat.id}`);
      toast.success('New chat created');
    } else {
      toast.error(data.error || 'Failed to create chat');
    }
  };

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || !activeChat || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Optimistically add user message
    setActiveChat(prev => ({
      ...prev,
      messages: [...prev.messages, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }]
    }));

    const response = await fetch(`/api/chat/${activeChat.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        providerOverride: providerOverride || undefined,
        modelType: modelTypeOverride || undefined,
        debug: true
      })
    });

    const data = await response.json();
    setIsLoading(false);

    if (data.success) {
      setActiveChat(data.chat);
      fetchChats(); // Refresh list for updated title/timestamp
    } else {
      toast.error(data.error || 'Failed to send message');
      // Remove optimistic message on error
      setActiveChat(prev => ({
        ...prev,
        messages: prev.messages.slice(0, -1)
      }));
    }
  };

  // Delete chat
  const handleDeleteChat = async (id) => {
    const response = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      await fetchChats();
      if (chatId === id) {
        navigate('/chat');
      }
      toast.success('Chat deleted');
    } else {
      toast.error(data.error || 'Failed to delete chat');
    }
  };

  // Clear messages
  const handleClearMessages = async () => {
    if (!activeChat) return;

    const response = await fetch(`/api/chat/${activeChat.id}/messages`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (data.success) {
      setActiveChat(prev => ({ ...prev, messages: [] }));
      toast.success('Messages cleared');
    } else {
      toast.error(data.error || 'Failed to clear messages');
    }
  };

  // Export chat
  const handleExport = async (format = 'markdown') => {
    if (!activeChat) return;
    window.open(`/api/chat/${activeChat.id}/export?format=${format}`, '_blank');
  };

  // Handle key press in input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare size={28} className="text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">Chat</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Chat with your own copy of the Clawed Egregore
        </p>
      </div>

      {/* No providers banner */}
      {providers.length === 0 && (
        <div className="mb-4 p-4 rounded-lg border bg-surface" style={{ borderColor: 'var(--color-warning)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div className="flex-1">
              <h3 className="font-medium text-text-primary mb-1">
                No AI Provider Configured
              </h3>
              <p className="text-sm text-text-secondary mb-3">
                To chat with the Clawed egregore, you need to configure an AI provider first.
                For local and private conversations, we recommend <strong>LM Studio</strong>.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://lmstudio.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  Download LM Studio
                </a>
                <button
                  onClick={() => navigate('/settings/providers')}
                  className="btn btn-primary text-sm flex items-center gap-2"
                >
                  <Settings size={14} />
                  Configure Providers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Memory status banner */}
      {neo4jStatus.available === true && (
        <div className="mb-4 p-3 rounded-lg border bg-surface flex items-center gap-3" style={{ borderColor: 'var(--color-success)' }}>
          <Brain className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
          <div className="flex-1">
            <span className="text-sm text-text-primary">
              Memory system active - relevant memories will be included in chat context
            </span>
          </div>
          <button
            onClick={() => navigate('/memories')}
            className="text-sm text-primary hover:underline"
          >
            View Memories
          </button>
        </div>
      )}

      {neo4jStatus.available === false && (
        <div className="mb-4 p-3 rounded-lg border bg-surface flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <Info className="w-5 h-5 flex-shrink-0 text-text-tertiary" />
          <div className="flex-1">
            <span className="text-sm text-text-secondary">
              Memory system offline - Neo4j not connected. Chat will work without memory context.
            </span>
          </div>
          <button
            onClick={() => navigate('/memories')}
            className="text-sm text-text-tertiary hover:text-text-secondary"
          >
            Setup
          </button>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div
          className={`flex flex-col border border-border rounded-lg bg-surface transition-all ${
            sidebarOpen ? 'w-64' : 'w-12'
          }`}
        >
          {/* Sidebar header */}
          <div className="p-2 border-b border-border flex items-center justify-between">
            {sidebarOpen && (
              <span className="text-sm font-medium text-text-primary">Chats</span>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded hover:bg-border/50 text-text-secondary"
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>

          {/* New chat button */}
          <div className="p-2 border-b border-border">
            <button
              onClick={handleNewChat}
              disabled={providers.length === 0}
              className={`w-full btn btn-primary flex items-center justify-center gap-2 ${
                sidebarOpen ? '' : 'p-2'
              } ${providers.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={providers.length === 0 ? 'Configure a provider first' : 'New Chat'}
            >
              <Plus size={18} />
              {sidebarOpen && <span>New Chat</span>}
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  chatId === chat.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-border/50 text-text-primary'
                }`}
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <MessageSquare size={16} className="flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate text-sm">{chat.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/20 text-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {chats.length === 0 && sidebarOpen && (
              <p className="text-center text-text-tertiary text-sm py-4">
                No chats yet
              </p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col border border-border rounded-lg bg-surface min-w-0">
          {activeChat ? (
            <>
              {/* Chat header */}
              <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-medium text-text-primary truncate">
                    {activeChat.title}
                  </h2>
                </div>

                {/* Inline controls - visible on desktop */}
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="form-input text-xs py-1 px-2 bg-background border-border min-w-0"
                    title="Template"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    value={providerOverride}
                    onChange={(e) => setProviderOverride(e.target.value)}
                    className="form-input text-xs py-1 px-2 bg-background border-border min-w-0"
                    title="Provider"
                  >
                    {providers.map(p => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={modelTypeOverride}
                    onChange={(e) => setModelTypeOverride(e.target.value)}
                    className="form-input text-xs py-1 px-2 bg-background border-border min-w-0"
                    title="Model"
                  >
                    <option value="light">Light (fast)</option>
                    <option value="medium">Medium (balanced)</option>
                    <option value="deep">Deep (powerful)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Settings button - only on mobile */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`md:hidden p-2 rounded hover:bg-border/50 ${
                      showSettings ? 'text-primary' : 'text-text-secondary'
                    }`}
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    className="p-2 rounded hover:bg-border/50 text-text-secondary"
                    title="Export"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={handleClearMessages}
                    className="p-2 rounded hover:bg-border/50 text-text-secondary"
                    title="Clear messages"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Settings panel - mobile only */}
              {showSettings && (
                <div className="md:hidden p-3 border-b border-border bg-background/50">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="form-input text-sm"
                      >
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Provider
                      </label>
                      <select
                        value={providerOverride}
                        onChange={(e) => setProviderOverride(e.target.value)}
                        className="form-input text-sm"
                      >
                        {providers.map(p => (
                          <option key={p.key} value={p.key}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Model
                      </label>
                      <select
                        value={modelTypeOverride}
                        onChange={(e) => setModelTypeOverride(e.target.value)}
                        className="form-input text-sm"
                      >
                        <option value="light">Light (fast)</option>
                        <option value="medium">Medium (balanced)</option>
                        <option value="deep">Deep (powerful)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeChat.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-tertiary">
                    <p>Start a conversation...</p>
                  </div>
                ) : (
                  activeChat.messages.map((msg, index) => {
                    const { thinkContent, displayContent } = msg.role === 'assistant'
                      ? parseMessageContent(msg.content)
                      : { thinkContent: null, displayContent: msg.content };

                    return (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-primary text-background'
                              : 'bg-border/50 text-text-primary'
                          }`}
                        >
                          {thinkContent && <ThinkingBlock content={thinkContent} />}
                          <p className="whitespace-pre-wrap">{displayContent}</p>
                          {msg.duration && (
                            <p className="text-xs opacity-60 mt-1">
                              {msg.provider}{msg.model ? ` (${msg.model})` : ''} • {(msg.duration / 1000).toFixed(1)}s
                            </p>
                          )}
                          {msg.debug && <DebugPanel debug={msg.debug} />}
                        </div>
                      </div>
                    );
                  })
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-border/50 rounded-lg px-4 py-2 flex items-center gap-2 text-text-secondary">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="form-input flex-1 resize-none"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="btn btn-primary px-4"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No chat selected */
            <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
              <MessageSquare size={48} className="mb-4 opacity-50" />
              {providers.length === 0 ? (
                <>
                  <h3 className="text-lg font-medium text-text-secondary mb-2">
                    Setup Required
                  </h3>
                  <p className="text-sm mb-4 text-center max-w-md">
                    Configure an AI provider in Settings to start chatting.
                    <br />
                    <span className="text-text-tertiary">
                      LM Studio is recommended for local, private conversations.
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-text-secondary mb-2">
                    No chat selected
                  </h3>
                  <p className="text-sm mb-4">
                    Select a chat from the sidebar or create a new one
                  </p>
                  <div className="flex flex-col gap-2 items-center">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="form-input text-sm"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleNewChat}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Plus size={18} />
                      New Chat
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
