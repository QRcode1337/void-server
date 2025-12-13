import React, { useState } from 'react';
import { Menu, X, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';

function MobileHeader({ sidebarOpen, toggleSidebar }) {
    const [restarting, setRestarting] = useState(false);
    const [confirmRestart, setConfirmRestart] = useState(false);

    const handleRestart = async () => {
        setRestarting(true);
        setConfirmRestart(false);
        toast.loading('Restarting application...');

        // Mock restart for now
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    };

    return (
        <div
            className="fixed top-0 left-0 right-0 z-30 md:hidden flex items-center justify-between px-4 h-14 bg-[var(--color-surface-solid)] border-b border-[var(--color-border)]"
        >
            {/* Menu toggle button */}
            <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg transition-colors hover:bg-opacity-10 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-primary)]"
            >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Title - always show to center the layout */}
            <div className="flex-1 text-center">
                {!sidebarOpen && (
                    <span className="font-bold text-[var(--color-primary)]">
                        <span style={{ textShadow: 'none' }}>🐈‍⬛</span> @void:~
                    </span>
                )}
            </div>

            {/* Restart button */}
            <button
                onClick={() => setConfirmRestart(true)}
                disabled={restarting}
                className="p-2 rounded-lg transition-colors hover:bg-opacity-10 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-primary)]"
                style={{
                    opacity: restarting ? 0.5 : 1,
                }}
                title="Restart application"
            >
                <RotateCw size={20} className={restarting ? 'animate-spin' : ''} />
            </button>

            {/* Restart Confirmation Modal */}
            {confirmRestart && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]" onClick={() => setConfirmRestart(false)}>
                    <div
                        className="card rounded-lg max-w-sm w-full p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <div className="text-2xl">⚠️</div>
                            <div className="flex-1">
                                <h3 className="font-semibold mb-2 text-[var(--color-text-primary)]">
                                    Restart Application?
                                </h3>
                                <p className="text-sm text-secondary">
                                    This will restart the server and reload the page. It will take approximately 10 seconds.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmRestart(false)}
                                className="btn-secondary flex-1 px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRestart}
                                className="btn-primary flex-1 px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px]"
                            >
                                Restart
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileHeader;
