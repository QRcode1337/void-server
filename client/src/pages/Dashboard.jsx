import React from 'react';
import { Terminal, Zap, Box, Activity } from 'lucide-react';

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

const Dashboard = () => {
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
                    Your extensible plugin-powered command center
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Terminal className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-text-secondary">Status</p>
                        <p className="text-sm font-semibold text-green-400">Online</p>
                    </div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Box className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-text-secondary">Plugins</p>
                        <p className="text-sm font-semibold text-text-primary">Active</p>
                    </div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-text-secondary">WebSocket</p>
                        <p className="text-sm font-semibold text-green-400">Connected</p>
                    </div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-text-secondary">Uptime</p>
                        <p className="text-sm font-semibold text-text-primary">Running</p>
                    </div>
                </div>
            </div>

            {/* ASCII Cat Section */}
            <div className="card">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <pre className="text-primary/60 font-mono text-xs leading-tight">
                        {ASCII_CAT}
                    </pre>
                    <div className="text-center sm:text-left">
                        <h2 className="text-lg font-semibold text-text-primary">
                            Ready to explore?
                        </h2>
                        <p className="text-text-secondary text-sm mt-1">
                            Check out the installed plugins in the sidebar or visit the Plugins page to manage them.
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="card">
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Quick Tips
                </h3>
                <ul className="space-y-2 text-sm text-text-secondary">
                    <li className="flex items-start gap-2">
                        <span className="text-primary">→</span>
                        <span>Plugins appear automatically in the navigation when installed</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary">→</span>
                        <span>Click the theme button to cycle through color schemes</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary">→</span>
                        <span>Server logs are available in the footer bar</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Dashboard;
