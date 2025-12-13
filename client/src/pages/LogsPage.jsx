import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Trash2, Pause, Play, RefreshCw, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const INITIAL_LINES_OPTIONS = [
  { value: 50, label: '50 lines' },
  { value: 100, label: '100 lines' },
  { value: 250, label: '250 lines' },
  { value: 500, label: '500 lines' },
  { value: 1000, label: '1000 lines' },
];

const MAX_DOM_LINES_OPTIONS = [
  { value: 500, label: '500 lines' },
  { value: 1000, label: '1000 lines' },
  { value: 2000, label: '2000 lines' },
  { value: 5000, label: '5000 lines' },
];

function LogsPage() {
  const [processes, setProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState('void-server');
  const [logs, setLogs] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [totalLines, setTotalLines] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [initialLines, setInitialLines] = useState(100);
  const [maxDomLines, setMaxDomLines] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState('');

  const logsContainerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const pausedLogsRef = useRef([]);

  // Fetch PM2 processes
  const fetchProcesses = useCallback(async () => {
    const response = await fetch('/api/pm2/processes');
    const data = await response.json();

    if (data.success) {
      setProcesses(data.processes);
    }
  }, []);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Connect to log stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/pm2/logs?process=${selectedProcess}&lines=${initialLines}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      toast.success(`Connected to ${selectedProcess} logs`);
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        if (isPaused) {
          pausedLogsRef.current.push(data);
          return;
        }

        setLogs(prev => {
          const newLogs = [...prev, data];
          // Trim to max DOM lines
          if (newLogs.length > maxDomLines) {
            return newLogs.slice(-maxDomLines);
          }
          return newLogs;
        });

        setTotalLines(prev => prev + 1);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  }, [selectedProcess, initialLines, isPaused, maxDomLines]);

  // Connect on mount and when process changes
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll to detect user scrolling up
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  // Handle process change
  const handleProcessChange = (e) => {
    setSelectedProcess(e.target.value);
    setLogs([]);
    setTotalLines(0);
    pausedLogsRef.current = [];
  };

  // Handle pause/resume
  const handlePauseToggle = () => {
    if (isPaused) {
      // Resume - add paused logs
      setLogs(prev => {
        const combined = [...prev, ...pausedLogsRef.current];
        pausedLogsRef.current = [];
        if (combined.length > maxDomLines) {
          return combined.slice(-maxDomLines);
        }
        return combined;
      });
    }
    setIsPaused(!isPaused);
  };

  // Handle clear
  const handleClear = () => {
    setLogs([]);
    setTotalLines(0);
    pausedLogsRef.current = [];
  };

  // Handle reconnect
  const handleReconnect = () => {
    setLogs([]);
    setTotalLines(0);
    pausedLogsRef.current = [];
    connect();
  };

  // Get log line color
  const getLogColor = (log) => {
    if (log.stream === 'err') return 'var(--color-error, #ff4444)';
    if (log.message.includes('ERROR') || log.message.includes('error')) return 'var(--color-error, #ff4444)';
    if (log.message.includes('WARN') || log.message.includes('warn')) return 'var(--color-warning, #ffaa00)';
    return 'var(--color-primary, #00ff00)';
  };

  // Filter logs
  const filteredLogs = filter
    ? logs.filter(log => log.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={28} className="text-primary" />
          <h1 className="text-2xl font-bold text-text-primary">
            PM2 Logs
          </h1>
        </div>
        <p className="text-sm text-text-secondary">
          Stream and monitor PM2 process logs in real-time
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Process selector */}
        <select
          value={selectedProcess}
          onChange={handleProcessChange}
          className="px-3 py-2 rounded-lg border bg-surface border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Processes</option>
          {processes.map(p => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.status})
            </option>
          ))}
        </select>

        {/* Filter input */}
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-surface border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[200px]"
        />

        {/* Action buttons */}
        <button
          onClick={handlePauseToggle}
          className={`btn flex items-center gap-2 ${isPaused ? 'btn-success' : 'btn-warning'}`}
        >
          {isPaused ? <Play size={18} /> : <Pause size={18} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={handleClear}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Trash2 size={18} />
          Clear
        </button>

        <button
          onClick={handleReconnect}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={18} />
          Reconnect
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-lg border bg-surface border-border">
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm mb-2 text-text-secondary">
                Initial Lines to Fetch
              </label>
              <select
                value={initialLines}
                onChange={(e) => setInitialLines(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border bg-background border-border text-text-primary focus:outline-none"
              >
                {INITIAL_LINES_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 text-text-secondary">
                Max Lines in View
              </label>
              <select
                value={maxDomLines}
                onChange={(e) => setMaxDomLines(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border bg-background border-border text-text-primary focus:outline-none"
              >
                {MAX_DOM_LINES_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <p className="text-xs text-text-tertiary">
                Changes take effect on reconnect
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="mb-2 flex items-center justify-between text-sm text-text-secondary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span style={{ color: isConnected ? 'var(--color-success)' : 'var(--color-error)' }}>
              {isConnected ? `Connected (${selectedProcess})` : 'Disconnected'}
            </span>
          </span>
          {isPaused && (
            <span style={{ color: 'var(--color-warning)' }}>
              Paused ({pausedLogsRef.current.length} buffered)
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>{filteredLogs.length} lines shown</span>
          <span>{totalLines} total received</span>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (logsContainerRef.current) {
                  logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
                }
              }}
              className="text-xs px-2 py-1 rounded bg-primary text-background"
            >
              Jump to bottom
            </button>
          )}
        </div>
      </div>

      {/* Log viewer */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 rounded-lg border p-4 overflow-auto font-mono text-sm border-border"
        style={{
          backgroundColor: '#0a0a0a',
          minHeight: '400px',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            {isConnected ? 'Waiting for logs...' : 'Connecting...'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex gap-2 hover:bg-white/5 px-1 -mx-1 rounded">
                <span
                  className="flex-shrink-0 text-xs font-mono"
                  style={{ color: '#666' }}
                >
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: getLogColor(log),
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LogsPage;
