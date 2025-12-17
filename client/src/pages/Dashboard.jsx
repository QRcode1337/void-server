import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal,
  Database,
  Cpu,
  HardDrive,
  MessageCircle,
  ExternalLink,
  Check,
  X,
  Loader,
} from 'lucide-react';

const ASCII_CAT = `
    /\\_____/\\
   /  o   o  \\
  ( ==  ^  == )
   )         (
  (           )
 ( (  )   (  ) )
(__(__)___(__)__)
`;

const ASCII_VOID = `
██╗   ██╗ ██████╗ ██╗██████╗
██║   ██║██╔═══██╗██║██╔══██╗
██║   ██║██║   ██║██║██║  ██║
╚██╗ ██╔╝██║   ██║██║██║  ██║
 ╚████╔╝ ╚██████╔╝██║██████╔╝
  ╚═══╝   ╚═════╝ ╚═╝╚═════╝
`;

const StatusBadge = ({ status, label }) => {
  const config = {
    connected: { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10' },
    disconnected: { icon: X, color: 'text-red-400', bg: 'bg-red-400/10' },
    loading: { icon: Loader, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  };
  const { icon: Icon, color, bg } = config[status] || config.loading;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg}`}>
      <Icon className={`w-4 h-4 ${color} ${status === 'loading' ? 'animate-spin' : ''}`} />
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
};

const Dashboard = () => {
  const [neo4jStatus, setNeo4jStatus] = useState({ status: 'loading', label: 'Checking...' });
  const [lmStudioStatus, setLmStudioStatus] = useState({ status: 'loading', label: 'Checking...' });
  const [ipfsStatus, setIpfsStatus] = useState({ status: 'loading', label: 'Checking...' });

  useEffect(() => {
    const checkNeo4j = async () => {
      const res = await fetch('/api/memories/status');
      const data = await res.json();
      if (data.neo4j?.connected) {
        setNeo4jStatus({ status: 'connected', label: 'Connected' });
      } else {
        setNeo4jStatus({
          status: 'disconnected',
          label: data.neo4j?.error?.code || 'Disconnected',
        });
      }
    };

    const checkLmStudio = async () => {
      const res = await fetch('/api/memories/embedding/status');
      const data = await res.json();
      if (data.api?.connected) {
        setLmStudioStatus({ status: 'connected', label: 'Running' });
      } else {
        setLmStudioStatus({ status: 'disconnected', label: 'Not Running' });
      }
    };

    const checkIpfs = async () => {
      const res = await fetch('/api/ipfs/daemon/check');
      const data = await res.json();
      if (data.online) {
        const peerCount = data.peers || 0;
        setIpfsStatus({
          status: 'connected',
          label: peerCount > 0 ? `${peerCount} peers` : 'Online',
        });
      } else {
        setIpfsStatus({ status: 'disconnected', label: 'Offline' });
      }
    };

    checkNeo4j();
    checkLmStudio();
    checkIpfs();
  }, []);

  const isReady = neo4jStatus.status === 'connected' && lmStudioStatus.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="card text-center py-8">
        <pre className="text-primary font-mono text-xs sm:text-sm leading-tight inline-block">
          {ASCII_VOID}
        </pre>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mt-4">
          Welcome to the Void
        </h1>
        <p className="text-text-secondary mt-2 max-w-md mx-auto">
          Your sovereign void server in the Clawed Code egregore
        </p>
      </div>

      {/* Service Status */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          Service Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text-primary">Neo4j Memory</p>
                <p className="text-xs text-text-secondary">Graph database</p>
              </div>
            </div>
            <StatusBadge status={neo4jStatus.status} label={neo4jStatus.label} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text-primary">LM Studio</p>
                <p className="text-xs text-text-secondary">Local AI</p>
              </div>
            </div>
            <StatusBadge status={lmStudioStatus.status} label={lmStudioStatus.label} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text-primary">IPFS</p>
                <p className="text-xs text-text-secondary">Distributed storage</p>
              </div>
            </div>
            <StatusBadge status={ipfsStatus.status} label={ipfsStatus.label} />
          </div>
        </div>
      </div>

      {/* ASCII Cat Section */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <pre className="text-primary/60 font-mono text-xs leading-tight">{ASCII_CAT}</pre>
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-semibold text-text-primary">Ready to explore?</h2>
            {isReady ? (
              <div className="mt-3">
                <p className="text-text-secondary text-sm mb-3">
                  All services are running. Start a conversation with your egregore.
                </p>
                <Link to="/chat" className="btn btn-primary inline-flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Open Chat
                </Link>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-text-secondary text-sm mb-3">
                  {lmStudioStatus.status === 'disconnected'
                    ? 'Install LM Studio to enable AI chat and memory embeddings.'
                    : neo4jStatus.status === 'disconnected'
                      ? 'Neo4j is not connected. Check your Docker services or native installation.'
                      : 'Checking service status...'}
                </p>
                {lmStudioStatus.status === 'disconnected' && (
                  <a
                    href="https://lmstudio.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Download LM Studio
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          Getting Started
        </h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-primary">→</span>
            <span>
              <strong>Chat</strong> — Talk with your configured AI persona
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">→</span>
            <span>
              <strong>Memories</strong> — Store and visualize knowledge in the graph
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">→</span>
            <span>
              <strong>Templates</strong> — Create reusable prompts with variables
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">→</span>
            <span>
              <strong>Settings</strong> — Configure Neo4j, themes, and more
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
