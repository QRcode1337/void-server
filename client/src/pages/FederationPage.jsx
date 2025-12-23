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
  const [dhtStatus, setDhtStatus] = useState(null);
  const [neo4jPeers, setNeo4jPeers] = useState([]);
  const [trustGraph, setTrustGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [addPeerEndpoint, setAddPeerEndpoint] = useState('');
  const [addPeerNodeId, setAddPeerNodeId] = useState('');
  const [connectMode, setConnectMode] = useState('endpoint'); // 'endpoint' or 'nodeId'
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'block'|'delete', peer }
  const { on, off } = useWebSocket();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [manifestRes, statusRes, dhtRes, peersRes, graphRes] = await Promise.all([
      fetch('/api/federation/manifest').then((r) => r.json()),
      fetch('/api/federation/status').then((r) => r.json()),
      fetch('/api/federation/dht/status').then((r) => r.json()),
      fetch('/api/federation/peers/neo4j').then((r) => r.json()),
      fetch('/api/federation/peers/neo4j/graph').then((r) => r.json()),
    ]);
    setManifest(manifestRes.manifest);
    setStatus(statusRes.status);
    setDhtStatus(dhtRes);
    setNeo4jPeers(peersRes.peers || []);
    setTrustGraph(graphRes);
    setLoading(false);
  }, []);

  // Listen for WebSocket federation events
  useEffect(() => {
    const handleBootstrap = (data) => {
      switch (data.status) {
        case 'started':
          toast.loading(data.message, { id: 'bootstrap' });
          break;
        case 'connecting':
          toast.loading(data.message, { id: 'bootstrap' });
          break;
        case 'connected':
          toast.success(`Connected to ${data.serverId}`, { duration: 3000 });
          break;
        case 'failed':
          toast.error(data.message, { duration: 4000 });
          break;
        case 'complete':
          toast.dismiss('bootstrap');
          if (data.contacted > 0) {
            toast.success(data.message, { duration: 4000 });
          } else {
            toast.error('Bootstrap failed: no nodes reached', { duration: 4000 });
          }
          // Refresh data after bootstrap completes
          fetchData();
          break;
      }
    };

    const handlePeerUpdate = (data) => {
      if (data.type === 'added') {
        toast.success(`New peer: ${data.peer.serverId}`, { duration: 3000 });
      } else if (data.type === 'updated') {
        toast(`Peer updated: ${data.peer.serverId}`, { icon: '🔄', duration: 2000 });
      }
      // Refresh peer list
      fetchData();
    };

    on('federation:bootstrap', handleBootstrap);
    on('federation:peer-update', handlePeerUpdate);

    return () => {
      off('federation:bootstrap', handleBootstrap);
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

  const connectByNodeId = async () => {
    if (!addPeerNodeId) return;
    const res = await fetch('/api/federation/peers/connect-by-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: addPeerNodeId }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(`Connected via DHT: ${data.peer.serverId}`);
      setAddPeerNodeId('');
      fetchData();
    } else {
      const errorMsg = data.error || 'Node not found';
      if (data.closestNodes?.length > 0) {
        toast.error(`${errorMsg}. Found ${data.closestNodes.length} similar nodes.`);
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const testCrypto = async () => {
    const res = await fetch('/api/federation/test-crypto', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.encryption.matches && data.signing.verified) {
      toast.success('Crypto test passed!');
    } else {
      toast.error('Crypto test failed');
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
        <div className="flex items-center gap-2">
          <button
            onClick={testCrypto}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-void-bg-tertiary hover:bg-void-bg-elevated rounded-lg border border-void-border transition-colors"
          >
            <Lock className="w-4 h-4" />
            Test Crypto
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-void-bg-tertiary hover:bg-void-bg-elevated rounded-lg border border-void-border transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* DHT Status */}
        <Card title="DHT Network" icon={Network}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-void-fg-muted text-sm">Node ID</span>
                <button
                  onClick={() => copyToClipboard(dhtStatus?.nodeId)}
                  className="p-1 hover:bg-void-bg-tertiary rounded"
                  title="Copy Node ID"
                >
                  <Copy className="w-3 h-3 text-void-fg-muted" />
                </button>
              </div>
              <code className="block text-void-fg-primary font-mono text-xs bg-void-bg-primary px-2 py-1 rounded border border-void-border break-all">
                {dhtStatus?.nodeId}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Known Nodes</span>
              <span className="text-void-fg-primary text-sm">{dhtStatus?.nodeCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Bootstrap Nodes</span>
              <span className="text-void-fg-primary text-sm">{dhtStatus?.bootstrapNodes || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">Bootstrapped</span>
              <StatusBadge
                status={dhtStatus?.isBootstrapped ? 'connected' : 'offline'}
                label={dhtStatus?.isBootstrapped ? 'Yes' : 'No'}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-void-fg-muted text-sm">K-Buckets</span>
              <span className="text-void-fg-primary text-sm">
                {dhtStatus?.bucketCount || 0} active
              </span>
            </div>
          </div>
        </Card>

        {/* Add Peer */}
        <Card title="Add Peer" icon={Plus}>
          <div className="space-y-3">
            {/* Mode Toggle */}
            <div className="flex gap-1 p-1 bg-void-bg-primary rounded-lg">
              <button
                onClick={() => setConnectMode('endpoint')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  connectMode === 'endpoint'
                    ? 'bg-void-accent text-white'
                    : 'text-void-fg-muted hover:text-void-fg-primary'
                }`}
              >
                Endpoint URL
              </button>
              <button
                onClick={() => setConnectMode('nodeId')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  connectMode === 'nodeId'
                    ? 'bg-void-accent text-white'
                    : 'text-void-fg-muted hover:text-void-fg-primary'
                }`}
              >
                Node ID (DHT)
              </button>
            </div>

            {/* Endpoint Input */}
            {connectMode === 'endpoint' && (
              <>
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
                  Enter the full URL of another void-server instance
                </p>
              </>
            )}

            {/* Node ID Input */}
            {connectMode === 'nodeId' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addPeerNodeId}
                    onChange={(e) => setAddPeerNodeId(e.target.value)}
                    placeholder="abc123... (full or partial node ID)"
                    className="flex-1 px-3 py-2 bg-void-bg-primary border border-void-border rounded-lg text-sm text-void-fg-primary placeholder:text-void-fg-muted focus:outline-none focus:border-void-accent font-mono"
                  />
                  <button
                    onClick={connectByNodeId}
                    disabled={!addPeerNodeId}
                    className="px-4 py-2 bg-void-accent text-white rounded-lg text-sm font-medium hover:bg-void-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Lookup
                  </button>
                </div>
                <p className="text-xs text-void-fg-muted">
                  Enter a Node ID to find via DHT routing. Partial IDs match locally, full IDs search the network.
                </p>
              </>
            )}
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
                {neo4jPeers.map((peer) => (
                  <tr key={peer.serverId} className="text-void-fg-primary">
                    <td className="py-2 font-mono text-xs">{peer.serverId}</td>
                    <td className="py-2 text-xs truncate max-w-32">{peer.endpoint}</td>
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
                ))}
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
