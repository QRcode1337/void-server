import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Server,
  Users,
  Shield,
  ShieldCheck,
  ShieldOff,
  Network,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Lock,
  Unlock,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWebSocket } from '../contexts/WebSocketContext';

const StatusBadge = ({ status, label }) => {
  const config = {
    connected: { color: 'text-green-400', bg: 'bg-green-400/10' },
    healthy: { color: 'text-green-400', bg: 'bg-green-400/10' },
    verified: { color: 'text-blue-400', bg: 'bg-blue-400/10' },
    trusted: { color: 'text-purple-400', bg: 'bg-purple-400/10' },
    unknown: { color: 'text-gray-400', bg: 'bg-gray-400/10' },
    blocked: { color: 'text-red-400', bg: 'bg-red-400/10' },
    offline: { color: 'text-red-400', bg: 'bg-red-400/10' },
  };
  const { color, bg } = config[status] || config.unknown;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color} ${bg}`}>
      {label || status}
    </span>
  );
};

const Card = ({ title, icon, children, actions }) => {
  const IconComp = icon;
  return (
  <div className="bg-void-bg-secondary rounded-lg border border-void-border">
    <div className="flex items-center justify-between px-4 py-3 border-b border-void-border">
      <div className="flex items-center gap-2">
        <IconComp className="w-4 h-4 text-void-fg-muted" />
        <h3 className="text-sm font-medium text-void-fg-primary">{title}</h3>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
  );
};

const TrustGraph = ({ nodes, edges }) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="text-center text-void-fg-muted py-8">
        No peers in trust graph yet
      </div>
    );
  }

  // Simple circular layout
  const width = 400;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;

  const nodePositions = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const getNodeColor = (trustLevel) => {
    const colors = {
      trusted: '#a855f7',
      verified: '#3b82f6',
      unknown: '#6b7280',
      blocked: '#ef4444',
    };
    return colors[trustLevel] || colors.unknown;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
      {/* Edges */}
      {edges.map((edge, i) => {
        const from = nodePositions.find((n) => n.id === edge.from);
        const to = nodePositions.find((n) => n.id === edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#4b5563"
            strokeWidth="1"
            markerEnd="url(#arrowhead)"
          />
        );
      })}

      {/* Arrow marker */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
        </marker>
      </defs>

      {/* Nodes */}
      {nodePositions.map((node) => (
        <g key={node.id}>
          <circle
            cx={node.x}
            cy={node.y}
            r="20"
            fill={getNodeColor(node.trustLevel)}
            opacity="0.8"
          />
          <text
            x={node.x}
            y={node.y + 35}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            {node.label?.replace('void-', '')}
          </text>
        </g>
      ))}
    </svg>
  );
};

const FederationPage = () => {
  const [manifest, setManifest] = useState(null);
  const [status, setStatus] = useState(null);
  const [relayStatus, setRelayStatus] = useState(null);
  const [neo4jPeers, setNeo4jPeers] = useState([]);
  const [trustGraph, setTrustGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [addPeerEndpoint, setAddPeerEndpoint] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'block'|'delete', peer }
  const [cryptoTest, setCryptoTest] = useState(null); // { loading, results }
  const { on, off } = useWebSocket();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [manifestRes, statusRes, relayRes, peersRes, graphRes] = await Promise.all([
      fetch('/api/federation/manifest').then((r) => r.json()),
      fetch('/api/federation/status').then((r) => r.json()),
      fetch('/api/federation/relay/status').then((r) => r.json()),
      fetch('/api/federation/peers/neo4j').then((r) => r.json()),
      fetch('/api/federation/peers/neo4j/graph').then((r) => r.json()),
    ]);
    setManifest(manifestRes.manifest);
    setStatus(statusRes.status);
    setRelayStatus(relayRes);
    setNeo4jPeers(peersRes.peers || []);
    setTrustGraph(graphRes);
    setLoading(false);
  }, []);

  // Listen for WebSocket federation events
  useEffect(() => {
    const handleRelayStatus = (data) => {
      if (data.connected) {
        toast.success('Connected to relay hub', { duration: 3000, id: 'relay-status' });
      } else if (data.error) {
        toast.error(`Relay: ${data.error}`, { duration: 4000, id: 'relay-status' });
      }
      fetchData();
    };

    const handlePeerUpdate = (data) => {
      if (data.type === 'joined') {
        toast.success(`Peer joined: ${data.peer.serverId}`, { duration: 3000 });
      } else if (data.type === 'left') {
        toast(`Peer left: ${data.peer.serverId}`, { icon: '👋', duration: 2000 });
      } else if (data.type === 'added') {
        toast.success(`New peer: ${data.peer.serverId}`, { duration: 3000 });
      }
      // Refresh peer list
      fetchData();
    };

    on('federation:relay-status', handleRelayStatus);
    on('federation:peer-update', handlePeerUpdate);

    return () => {
      off('federation:relay-status', handleRelayStatus);
      off('federation:peer-update', handlePeerUpdate);
    };
  }, [on, off, fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const addPeer = async () => {
    if (!addPeerEndpoint) return;
    const res = await fetch('/api/federation/peers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: addPeerEndpoint }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`Added peer: ${data.peer.serverId}`);
      setAddPeerEndpoint('');
      fetchData();
    } else {
      toast.error(data.error || 'Failed to add peer');
    }
  };

  const testCrypto = async () => {
    setCryptoTest({ loading: true, results: null });
    const res = await fetch('/api/federation/test-crypto', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      setCryptoTest({
        loading: false,
        results: {
          encryption: data.encryption.matches,
          signing: data.signing.verified,
          allPassed: data.encryption.matches && data.signing.verified
        }
      });
    } else {
      setCryptoTest({
        loading: false,
        results: { error: data.error || 'Test failed', allPassed: false }
      });
    }
  };

  const confirmBlockPeer = async () => {
    if (!confirmAction || confirmAction.type !== 'block') return;
    const { serverId } = confirmAction.peer;

    const res = await fetch(`/api/federation/peers/neo4j/${serverId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Blocked via UI' }),
    });
    if (res.ok) {
      toast.success(`Blocked ${serverId}`);
      fetchData();
    }
    setConfirmAction(null);
  };

  const unblockPeer = async (serverId) => {
    const res = await fetch(`/api/federation/peers/neo4j/${serverId}/unblock`, {
      method: 'POST',
    });
    if (res.ok) {
      toast.success(`Unblocked ${serverId}`);
      fetchData();
    }
  };

  const confirmDeletePeer = async () => {
    if (!confirmAction || confirmAction.type !== 'delete') return;
    const { serverId } = confirmAction.peer;

    const res = await fetch(`/api/federation/peers/neo4j/${serverId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success(`Deleted ${serverId}`);
      fetchData();
    }
    setConfirmAction(null);
  };

  if (loading && !manifest) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-void-fg-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-void-accent" />
          <h1 className="text-xl font-semibold text-void-fg-primary">Federation</h1>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-void-bg-tertiary hover:bg-void-bg-elevated rounded-lg border border-void-border transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Server Identity */}
        <Card title="Server Identity" icon={Server}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-void-fg-muted text-sm">Server ID</span>
                <button
                  onClick={() => copyToClipboard(manifest?.serverId)}
                  className="p-1 hover:bg-void-bg-tertiary rounded"
                  title="Copy Server ID"
                >
                  <Copy className="w-3 h-3 text-void-fg-muted" />
                </button>
              </div>
              <code className="block text-void-fg-primary font-mono text-sm bg-void-bg-primary px-2 py-1 rounded border border-void-border">
                {manifest?.serverId}
              </code>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-void-fg-muted text-sm">Public Key</span>
                <button
                  onClick={() => copyToClipboard(manifest?.publicKey)}
                  className="p-1 hover:bg-void-bg-tertiary rounded"
                  title="Copy Public Key"
                >
                  <Copy className="w-3 h-3 text-void-fg-muted" />
                </button>
              </div>
              <code className="block text-void-fg-primary font-mono text-xs bg-void-bg-primary px-2 py-1 rounded border border-void-border break-all">
                {manifest?.publicKey}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Version</span>
              <span className="text-void-fg-primary text-sm">{manifest?.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Capabilities</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {manifest?.capabilities?.map((cap) => (
                  <StatusBadge key={cap} status="connected" label={cap} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Uptime</span>
              <span className="text-void-fg-primary text-sm">
                {Math.floor(status?.uptime / 60)} min
              </span>
            </div>
            {/* Crypto Test Section */}
            <div className="pt-3 border-t border-void-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-void-fg-muted text-sm">Cryptography</span>
                <button
                  onClick={testCrypto}
                  disabled={cryptoTest?.loading}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-void-bg-tertiary hover:bg-void-bg-elevated rounded border border-void-border transition-colors disabled:opacity-50"
                >
                  {cryptoTest?.loading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Shield className="w-3 h-3" />
                  )}
                  Run Test
                </button>
              </div>
              {cryptoTest?.results && (
                <div className="bg-void-bg-primary rounded border border-void-border p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-void-fg-muted">TweetNaCl Box (encrypt/decrypt)</span>
                    <span className={cryptoTest.results.encryption ? 'text-green-400' : 'text-red-400'}>
                      {cryptoTest.results.encryption ? '✓ Pass' : '✗ Fail'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-void-fg-muted">Ed25519 Sign/Verify</span>
                    <span className={cryptoTest.results.signing ? 'text-green-400' : 'text-red-400'}>
                      {cryptoTest.results.signing ? '✓ Pass' : '✗ Fail'}
                    </span>
                  </div>
                  {cryptoTest.results.error && (
                    <div className="text-xs text-red-400">{cryptoTest.results.error}</div>
                  )}
                  <div className="text-xs text-void-fg-muted pt-1 border-t border-void-border">
                    {cryptoTest.results.allPassed
                      ? 'Secure peer communication ready'
                      : 'Crypto functions not working correctly'}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-void-border">
              <button
                onClick={() => {
                  const connectionInfo = JSON.stringify({
                    serverId: manifest?.serverId,
                    publicKey: manifest?.publicKey,
                    endpoint: window.location.origin
                  }, null, 2);
                  copyToClipboard(connectionInfo);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-void-accent/10 hover:bg-void-accent/20 text-void-accent rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Connection Info
              </button>
            </div>
          </div>
        </Card>

        {/* Relay Status */}
        <Card title="Relay Network" icon={Radio}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Status</span>
              <div className="flex items-center gap-2">
                {relayStatus?.connected ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <StatusBadge
                  status={relayStatus?.connected ? 'connected' : 'offline'}
                  label={relayStatus?.connected ? 'Connected' : 'Disconnected'}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-void-fg-muted text-sm">Relay Hub</span>
              </div>
              <code className="block text-void-fg-primary font-mono text-xs bg-void-bg-primary px-2 py-1 rounded border border-void-border break-all">
                {relayStatus?.relayUrl || 'Not configured'}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Mode</span>
              <StatusBadge
                status={relayStatus?.mode === 'relay' ? 'verified' : 'unknown'}
                label={relayStatus?.mode || 'unknown'}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Relay Peers</span>
              <span className="text-void-fg-primary text-sm">{relayStatus?.connectedPeers || 0} online</span>
            </div>
            {relayStatus?.peers?.length > 0 && (
              <div className="pt-2 border-t border-void-border">
                <span className="text-void-fg-muted text-xs block mb-2">Online via Relay:</span>
                <div className="flex flex-wrap gap-1">
                  {relayStatus.peers.map((peer) => (
                    <span
                      key={peer.serverId}
                      className="px-2 py-0.5 text-xs bg-green-400/10 text-green-400 rounded font-mono"
                    >
                      {peer.serverId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Add Peer */}
        <Card title="Add Peer" icon={Plus}>
          <div className="space-y-3">
            {relayStatus?.connected && (
              <div className="bg-green-400/10 border border-green-400/20 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-400">
                  <Wifi className="w-3 h-3 inline mr-1" />
                  Peers are auto-discovered via relay. Anyone connected to the same relay hub will appear automatically.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={addPeerEndpoint}
                onChange={(e) => setAddPeerEndpoint(e.target.value)}
                placeholder="https://peer.example.com:4420"
                className="flex-1 px-3 py-2 bg-void-bg-primary border border-void-border rounded-lg text-sm text-void-fg-primary placeholder:text-void-fg-muted focus:outline-none focus:border-void-accent"
              />
              <button
                onClick={addPeer}
                disabled={!addPeerEndpoint}
                className="px-4 py-2 bg-void-accent text-white rounded-lg text-sm font-medium hover:bg-void-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Connect
              </button>
            </div>
            <p className="text-xs text-void-fg-muted">
              For direct connections, enter the full URL of another void-server instance
            </p>
          </div>
        </Card>

        {/* Trust Graph */}
        <Card title="Trust Graph" icon={Shield}>
          <TrustGraph nodes={trustGraph.nodes} edges={trustGraph.edges} />
        </Card>
      </div>

      {/* Peers Table */}
      <Card
        title={`Peers (${neo4jPeers.length})`}
        icon={Users}
        actions={
          <span className="text-xs text-void-fg-muted">
            Memory: {status?.peers?.memory?.total || 0} | Neo4j: {neo4jPeers.length}
          </span>
        }
      >
        {neo4jPeers.length === 0 ? (
          <div className="text-center text-void-fg-muted py-8">
            No peers connected yet. Add a peer above to start federating.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-void-fg-muted border-b border-void-border">
                  <th className="pb-2 font-medium">Server ID</th>
                  <th className="pb-2 font-medium">Endpoint</th>
                  <th className="pb-2 font-medium">Trust</th>
                  <th className="pb-2 font-medium">Health</th>
                  <th className="pb-2 font-medium">Capabilities</th>
                  <th className="pb-2 font-medium">Last Seen</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-void-border">
                {neo4jPeers.map((peer) => {
                  const isViaRelay = peer.endpoint?.startsWith('relay://');
                  const isOnlineNow = relayStatus?.peers?.some(p => p.serverId === peer.serverId);
                  return (
                  <tr key={peer.serverId} className="text-void-fg-primary">
                    <td className="py-2 font-mono text-xs">
                      {peer.serverId}
                      {isOnlineNow && (
                        <span className="ml-1 inline-block w-2 h-2 bg-green-400 rounded-full" title="Online now" />
                      )}
                    </td>
                    <td className="py-2 text-xs truncate max-w-32">
                      {isViaRelay ? (
                        <span className="flex items-center gap-1">
                          <Radio className="w-3 h-3 text-purple-400" />
                          <span className="text-purple-400">via relay</span>
                        </span>
                      ) : (
                        peer.endpoint
                      )}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={peer.trustLevel} />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-void-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(peer.healthScore || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-void-fg-muted">
                          {Math.round((peer.healthScore || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        {peer.capabilities?.slice(0, 3).map((cap) => (
                          <span
                            key={cap}
                            className="px-1.5 py-0.5 text-xs bg-void-bg-tertiary rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-xs text-void-fg-muted">
                      {peer.lastSeen ? new Date(peer.lastSeen).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-2">
                      {peer.isProtected ? (
                        <div className="flex items-center gap-1 text-void-fg-muted" title="Protected bootstrap peer">
                          <ShieldCheck className="w-4 h-4 text-green-400" />
                          <span className="text-xs">Protected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {peer.trustLevel === 'blocked' ? (
                            <button
                              onClick={() => unblockPeer(peer.serverId)}
                              className="p-1 hover:bg-void-bg-tertiary rounded text-green-400"
                              title="Unblock peer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmAction({ type: 'block', peer })}
                              className="flex items-center gap-1 px-2 py-1 hover:bg-void-bg-tertiary rounded text-yellow-400 text-xs"
                              title="Block peer"
                            >
                              <ShieldOff className="w-4 h-4" />
                              <span>Block</span>
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', peer })}
                            className="p-1 hover:bg-void-bg-tertiary rounded text-red-400"
                            title="Delete peer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-void-bg-secondary border border-void-border rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-void-fg-primary mb-2">
              {confirmAction.type === 'block' ? 'Block Peer' : 'Delete Peer'}
            </h3>
            <p className="text-void-fg-muted mb-4">
              {confirmAction.type === 'block' ? (
                <>Are you sure you want to block <strong>{confirmAction.peer.serverId}</strong>? This will prevent communication with this peer.</>
              ) : (
                <>Are you sure you want to delete <strong>{confirmAction.peer.serverId}</strong>? This will remove this peer from your federation network.</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm bg-void-bg-tertiary hover:bg-void-bg-elevated rounded-lg border border-void-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.type === 'block' ? confirmBlockPeer : confirmDeletePeer}
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors flex items-center gap-2 ${
                  confirmAction.type === 'block'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'block' ? (
                  <>
                    <ShieldOff className="w-4 h-4" />
                    Block
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FederationPage;
