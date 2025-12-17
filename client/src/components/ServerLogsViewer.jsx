import React, { useState, useEffect, useRef } from 'react';
import { Server, ChevronDown, ChevronUp, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

const ServerLogsViewer = ({ sidebarOpen }) => {
  const { connectionStatus, logs, clearLogs, logsExpanded, setLogsExpanded } = useWebSocket();
  const [isFullHeight, setIsFullHeight] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const logContainerRef = useRef(null);

  // Use shared logsExpanded state from context
  const isExpanded = logsExpanded;
  const setIsExpanded = setLogsExpanded;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current && isExpanded) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const getLogColor = level => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      case 'debug':
        return 'text-blue-400';
      case 'event':
        return 'text-purple-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLeftMargin = () => {
    if (isMobile) return '0';
    return sidebarOpen ? '250px' : '60px';
  };

  const getContainerHeight = () => {
    if (!isExpanded) return 'auto';
    if (isFullHeight) {
      return isMobile ? 'calc(100vh - 56px - 48px)' : 'calc(100vh - 48px)';
    }
    return '300px';
  };

  return (
    <div
      className="fixed bottom-0 z-50 transition-all duration-300"
      style={{
        left: getLeftMargin(),
        right: '0',
        paddingTop: isExpanded && isFullHeight ? (isMobile ? '56px' : '0') : '0',
      }}
    >
      <div className="bg-[var(--color-surface-solid)] border-t border-[var(--color-border)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">Server Logs</span>
            {logs.length > 0 && (
              <span className="px-2 py-0.5 bg-[var(--color-background)] text-gray-400 text-xs rounded-full">
                {logs.length}
              </span>
            )}

            {/* Connection Status Badge */}
            <div
              className={`badge ${connectionStatus === 'connected' ? 'badge-success' : 'badge-danger'}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'animate-pulse bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm">
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="p-2 text-gray-400 hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {isExpanded && (
              <button
                onClick={() => setIsFullHeight(!isFullHeight)}
                className="p-2 text-gray-400 hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={isFullHeight ? 'Minimize height' : 'Maximize height'}
              >
                {isFullHeight ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                if (isExpanded) {
                  setIsFullHeight(false);
                }
              }}
              className="p-2 text-gray-400 hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title={isExpanded ? 'Collapse logs' : 'Expand logs'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Logs Container */}
        {isExpanded && (
          <div
            ref={logContainerRef}
            className="overflow-y-auto p-4 font-mono text-xs transition-all duration-300 bg-[var(--color-background)]"
            style={{
              height: getContainerHeight(),
            }}
          >
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No server logs yet...</div>
            ) : (
              <div className="space-y-1">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <span className="text-gray-600 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`flex-1 ${getLogColor(log.level || log.type)}`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerLogsViewer;
