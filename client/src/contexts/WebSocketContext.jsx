import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [logs, setLogs] = useState([]);
  const [appInfo, setAppInfo] = useState({ version: null, name: null });
  const [logsExpanded, setLogsExpanded] = useState(false);

  useEffect(() => {
    const socketInstance = io();

    socketInstance.on('connect', () => {
      setConnectionStatus('connected');
    });

    socketInstance.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socketInstance.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socketInstance.on('app-info', info => {
      setAppInfo(info);
    });

    socketInstance.on('server-log', log => {
      setLogs(prev => [
        ...prev.slice(-199),
        {
          id: Date.now() + Math.random(),
          timestamp: log.timestamp || new Date().toISOString(),
          type: log.type || 'log',
          message: log.message,
          level:
            log.level || (log.type === 'error' ? 'error' : log.type === 'warn' ? 'warn' : 'info'),
        },
      ]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const on = useCallback(
    (event, callback) => {
      if (socket) {
        socket.on(event, callback);
      }
    },
    [socket]
  );

  const off = useCallback(
    (event, callback) => {
      if (socket) {
        socket.off(event, callback);
      }
    },
    [socket]
  );

  const emit = useCallback(
    (event, data) => {
      if (socket) {
        socket.emit(event, data);
      }
    },
    [socket]
  );

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        connectionStatus,
        logs,
        clearLogs,
        appInfo,
        logsExpanded,
        setLogsExpanded,
        on,
        off,
        emit,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
