import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Wallet, Plus, Trash2, Copy, Check, RefreshCw, Send, PenTool,
  ChevronDown, ChevronRight, Eye, EyeOff, ExternalLink, ShoppingCart, Settings, Twitter
} from 'lucide-react';

const API_BASE = '/wallet/api/wallet';

// Truncate key helper - shows first N and last M characters
const truncateKey = (key, first = 4, last = 4) => {
  if (!key || key.length <= first + last + 3) return key;
  return `${key.slice(0, first)}...${key.slice(-last)}`;
};

// Copy Button Component
const CopyButton = ({ text, size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-[var(--color-primary)]/10 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className={`${iconSize} text-green-500`} /> : <Copy className={iconSize} />}
    </button>
  );
};

// Copyable Key Component - shows truncated key with copy button
const CopyableKey = ({ value, truncate = true, first = 8, last = 6, className = '' }) => (
  <div className={`inline-flex items-center gap-1 font-mono text-sm ${className}`}>
    <span className="text-[var(--color-text-secondary)]">
      {truncate ? truncateKey(value, first, last) : value}
    </span>
    <CopyButton text={value} />
  </div>
);

const WalletPage = () => {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [walletDetails, setWalletDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeriveModal, setShowDeriveModal] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [buyToken, setBuyToken] = useState(null); // { mint, symbol, name }

  // Delete confirmation state: { type: 'wallet' | 'group', id: string, name: string }
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  // Load wallet groups
  const loadGroups = useCallback(async () => {
    const res = await fetch(`${API_BASE}/groups`);
    const data = await res.json();
    if (data.success) {
      setGroups(data.groups);
      // Auto-expand all groups
      const expanded = {};
      data.groups.forEach(g => { expanded[g.id] = true; });
      setExpandedGroups(expanded);
    }
    setLoading(false);
  }, []);

  // Load wallet details
  const loadWalletDetails = useCallback(async (walletId) => {
    const res = await fetch(`${API_BASE}/${walletId}`);
    const data = await res.json();
    if (data.success) {
      setWalletDetails(data.wallet);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedWallet) {
      loadWalletDetails(selectedWallet.id);
    } else {
      setWalletDetails(null);
    }
  }, [selectedWallet, loadWalletDetails]);

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    if (selectedWallet) {
      await loadWalletDetails(selectedWallet.id);
    }
    setRefreshing(false);
    toast.success('Wallets refreshed');
  };

  const handleSelectWallet = (wallet, group) => {
    setSelectedGroup(group);
    setSelectedWallet(wallet);
    setActiveTab('overview');
  };

  const handleDeleteWallet = (walletId, walletName, e) => {
    e.stopPropagation();
    setDeleteConfirmation({ type: 'wallet', id: walletId, name: walletName });
  };

  const handleDeleteGroup = (groupId, groupName, e) => {
    e.stopPropagation();
    setDeleteConfirmation({ type: 'group', id: groupId, name: groupName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    const { type, id } = deleteConfirmation;
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      toast.success(type === 'wallet' ? 'Address removed' : 'Wallet deleted');

      if (type === 'wallet') {
        // Compute updated groups
        const updatedGroups = groups.map(group => ({
          ...group,
          addresses: group.addresses.filter(addr => addr.id !== id)
        })).filter(group => group.addresses.length > 0);

        // Update groups state
        setGroups(updatedGroups);

        // Clear selection if the group was removed (became empty) or wallet was deleted
        const groupStillExists = selectedGroup && updatedGroups.find(g => g.id === selectedGroup.id);
        if (!groupStillExists && selectedGroup) {
          setSelectedGroup(null);
          setSelectedWallet(null);
          setWalletDetails(null);
        } else if (selectedWallet?.id === id) {
          setSelectedWallet(null);
          setWalletDetails(null);
        }
      } else if (type === 'group') {
        // Update groups state
        setGroups(groups.filter(group => group.id !== id));

        // Clear selection if deleted group was selected
        if (selectedGroup?.id === id) {
          setSelectedGroup(null);
          setSelectedWallet(null);
          setWalletDetails(null);
        }
      }
    } else {
      toast.error(data.error);
    }
    setDeleteConfirmation(null);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-primary)] flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">Wallet Manager</h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Manage your Crypto wallets
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn btn-secondary flex items-center gap-2 text-sm"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hide-mobile-text">Settings</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hide-mobile-text">Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="card text-center py-12">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 text-[var(--color-text-secondary)] animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading wallets...</p>
        </div>
      ) : (
        <div className="wallet-grid">
          {/* Left Column - Wallet Groups */}
          <div>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[var(--color-primary)]" />
                  Wallets
                </h2>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {groups.length} group{groups.length !== 1 ? 's' : ''}
                </span>
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-secondary)] opacity-50" />
                  <p className="text-[var(--color-text-secondary)] mb-3">No wallets yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="text-[var(--color-primary)] hover:underline text-sm"
                  >
                    Import your first wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      className="border border-[var(--color-border)] rounded-lg overflow-hidden hover:border-[var(--color-primary)] transition-colors"
                    >
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full px-3 py-3 flex items-center justify-between transition-colors ${
                          selectedGroup?.id === group.id
                            ? 'bg-[var(--color-primary)]/10'
                            : 'hover:bg-[var(--color-surface)]'
                        }`}
                      >
                        <span className="font-medium truncate flex items-center gap-2 text-[var(--color-text-primary)]">
                          <Wallet className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
                          <span className="truncate">{group.name}</span>
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {group.addresses.length}
                          </span>
                          {expandedGroups[group.id] ? (
                            <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedGroups[group.id] && (
                        <div className="border-t border-[var(--color-border)]">
                          {/* Action Buttons - Top */}
                          <div className="flex border-b border-[var(--color-border)]">
                            {group.hasSeed && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedGroup(group);
                                    setShowDeriveModal(true);
                                  }}
                                  className="flex-1 px-2 sm:px-3 py-2 text-sm flex items-center justify-center gap-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                                  title="Add Address"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span className="hidden sm:inline">Add</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedGroup(group);
                                    setShowSeedModal(true);
                                  }}
                                  className="flex-1 px-2 sm:px-3 py-2 text-sm flex items-center justify-center gap-1.5 border-l border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                  title="View Seed"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="hidden sm:inline">Seed</span>
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => handleDeleteGroup(group.id, group.name, e)}
                              className={`${group.hasSeed ? 'border-l border-[var(--color-border)]' : ''} flex-1 px-2 sm:px-3 py-2 text-sm flex items-center justify-center gap-1.5 text-red-400 hover:bg-red-500/10 transition-colors`}
                              title="Delete Wallet"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>

                          {/* Addresses */}
                          {group.addresses.map(addr => (
                            <div
                              key={addr.id}
                              onClick={() => handleSelectWallet(addr, group)}
                              className={`px-3 py-2 cursor-pointer flex items-center gap-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                                selectedWallet?.id === addr.id
                                  ? 'bg-[var(--color-primary)]/20'
                                  : 'hover:bg-[var(--color-surface)]'
                              }`}
                            >
                              {/* Selection indicator */}
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                selectedWallet?.id === addr.id ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate font-medium text-[var(--color-text-primary)]">
                                  {addr.label}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)] font-mono">
                                  {truncateKey(addr.publicKey, 6, 4)}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-mono text-[var(--color-primary)]">
                                  {addr.balance?.toFixed(4) || '0'} SOL
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Wallet Details */}
          <div>
            {selectedWallet && walletDetails ? (
              <div className="card">
                {/* Wallet Header */}
                <div className="flex items-start justify-between gap-2 mb-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                      {walletDetails.label}
                    </h2>
                    <CopyableKey
                      value={walletDetails.publicKey}
                      first={8}
                      last={6}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => loadWalletDetails(selectedWallet.id)}
                      className="btn btn-secondary p-2"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteWallet(selectedWallet.id, walletDetails?.label || 'this address', e)}
                      className="btn btn-secondary p-2 text-red-400 hover:bg-red-500/10"
                      title="Stop tracking this address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
                  {['overview', 'send', 'sign'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm capitalize font-medium transition-colors ${
                        activeTab === tab
                          ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <OverviewTab wallet={walletDetails} onBuyToken={setBuyToken} />
                )}
                {activeTab === 'send' && (
                  <SendTab wallet={walletDetails} onSuccess={() => loadWalletDetails(selectedWallet.id)} />
                )}
                {activeTab === 'sign' && (
                  <SignTab wallet={walletDetails} />
                )}
              </div>
            ) : (
              <div className="card text-center py-16">
                <Wallet className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-secondary)] opacity-50" />
                <p className="text-lg text-[var(--color-text-primary)] mb-2">
                  Select a wallet to view details
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Or import a new wallet to get started
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Wallet Modal */}
      {showCreateModal && (
        <CreateWalletModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadGroups();
          }}
        />
      )}

      {/* Derive More Addresses Modal */}
      {showDeriveModal && selectedGroup && (
        <DeriveMoreModal
          group={selectedGroup}
          onClose={() => setShowDeriveModal(false)}
          onSuccess={() => {
            setShowDeriveModal(false);
            loadGroups();
          }}
        />
      )}

      {/* Seed Phrase Modal */}
      {showSeedModal && selectedGroup && (
        <SeedModal
          group={selectedGroup}
          onClose={() => setShowSeedModal(false)}
        />
      )}

      {/* Buy Token Modal */}
      {buyToken && selectedWallet && (
        <BuyTokenModal
          wallet={selectedWallet}
          walletDetails={walletDetails}
          token={buyToken}
          onClose={() => setBuyToken(null)}
          onSuccess={() => {
            setBuyToken(null);
            loadWalletDetails(selectedWallet.id);
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => {
            setShowSettingsModal(false);
            toast.success('Settings saved. Refresh to apply changes.');
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {deleteConfirmation.type === 'wallet' ? 'Remove Address' : 'Delete Wallet Group'}
              </h3>
            </div>
            <p className="text-[var(--color-text-secondary)] mb-6">
              {deleteConfirmation.type === 'wallet'
                ? `Are you sure you want to stop tracking "${deleteConfirmation.name}"? You can re-import it later using your seed phrase.`
                : `Are you sure you want to delete "${deleteConfirmation.name}" and all its addresses? This action cannot be undone.`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="btn btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn px-4 py-2 bg-red-500 hover:bg-red-600 text-white"
              >
                {deleteConfirmation.type === 'wallet' ? 'Remove' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Tab
const OverviewTab = ({ wallet, onBuyToken }) => (
  <div className="space-y-6">
    {/* Balance Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* SOL Balance */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">◎</span>
          <span className="text-sm text-[var(--color-text-secondary)]">SOL Balance</span>
        </div>
        <div className="text-3xl font-bold text-[var(--color-primary)]">
          {wallet.balance?.toFixed(4) || '0'}
        </div>
      </div>

      {/* Token Count */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="text-sm text-[var(--color-text-secondary)] mb-2">Tokens</div>
        <div className="text-3xl font-bold text-[var(--color-text-primary)]">
          {wallet.tokens?.length || 0}
        </div>
      </div>

      {/* Wallet Info */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="text-sm text-[var(--color-text-secondary)] mb-2">Derivation</div>
        <div className="text-sm font-mono text-[var(--color-text-primary)] truncate">
          {wallet.derivationPath}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
          Account #{wallet.accountIndex}
        </div>
      </div>
    </div>

    {/* Token Balances */}
    <div>
      <h3 className="text-lg font-semibold mb-3 text-[var(--color-text-primary)]">Token Balances</h3>
      {wallet.tokens?.length > 0 ? (
        <div className="space-y-2">
          {wallet.tokens.map(token => (
            <div
              key={token.mint}
              className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="rounded-full flex-shrink-0 overflow-hidden" style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }}>
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-full h-full object-cover rounded-full"
                      style={{ width: '40px', height: '40px' }}
                      onError={(e) => {
                        e.target.parentElement.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:rgba(var(--color-primary-rgb),0.2);display:flex;align-items:center;justify-content:center;color:var(--color-primary);font-weight:bold">${token.symbol?.slice(0, 2) || '??'}</div>`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] font-bold">
                      {token.symbol?.slice(0, 2) || '??'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
                    <span>{token.balance.toLocaleString()} {token.symbol}</span>
                    {token.isKnown && (
                      <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        community
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{token.name}</div>
                  <CopyableKey value={token.mint} first={8} last={6} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {token.isKnown && (
                  <button
                    onClick={() => onBuyToken({ mint: token.mint, symbol: token.symbol, name: token.name })}
                    className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-medium rounded-lg flex items-center gap-1.5 text-sm transition-colors"
                    title={`Buy ${token.symbol}`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Buy
                  </button>
                )}
                <a
                  href={`https://solscan.io/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-[var(--color-surface)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[var(--color-text-secondary)] text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
          No known tokens found
        </div>
      )}
    </div>
  </div>
);

// Send Tab
const SendTab = ({ wallet, onSuccess }) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenMint, setTokenMint] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipient || !amount) {
      toast.error('Recipient and amount required');
      return;
    }

    setSending(true);
    const res = await fetch(`${API_BASE}/${wallet.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        amount: parseFloat(amount),
        tokenMint: tokenMint || null
      })
    });
    const data = await res.json();
    setSending(false);

    if (data.success) {
      toast.success(`Transaction sent: ${data.signature.slice(0, 8)}...`);
      onSuccess();
    } else {
      toast.error(data.error);
    }
  };

  const tokens = [
    { mint: '', label: 'SOL', balance: wallet.balance },
    ...(wallet.tokens || []).map(t => ({
      mint: t.mint,
      label: t.symbol,
      balance: t.balance
    }))
  ];

  return (
    <div className="form-grid">
      <div className="space-y-4">
        {/* Token Selection */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Token</label>
          <select
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
          >
            {tokens.map(t => (
              <option key={t.mint} value={t.mint}>
                {t.label} ({t.balance?.toLocaleString() || 0} available)
              </option>
            ))}
          </select>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Solana address..."
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg font-mono text-sm text-[var(--color-text-primary)]"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.000001"
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !recipient || !amount}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send Transaction'}
        </button>
      </div>

      {/* Send Info Panel */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
        <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Transaction Info</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">From</span>
            <CopyableKey value={wallet.publicKey} first={6} last={4} />
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Available</span>
            <span className="text-[var(--color-text-primary)]">
              {tokens.find(t => t.mint === tokenMint)?.balance?.toLocaleString() || 0} {tokens.find(t => t.mint === tokenMint)?.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sign Tab
const SignTab = ({ wallet }) => {
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState(null);
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    if (!message) {
      toast.error('Message required');
      return;
    }

    setSigning(true);
    const res = await fetch(`${API_BASE}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: wallet.publicKey,
        message
      })
    });
    const data = await res.json();
    setSigning(false);

    if (data.success) {
      setSignature(data);
      toast.success('Message signed');
    } else {
      toast.error(data.error);
    }
  };

  const getSignedMessageBlock = () => {
    if (!signature) return '';
    return `-----BEGIN SIGNED MESSAGE-----
${signature.message}
-----BEGIN SIGNATURE-----
${signature.publicKey}
${signature.signature}
-----END SIGNED MESSAGE-----`;
  };

  return (
    <div className="form-grid">
      <div className="space-y-4">
        {/* Message Input */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Message to Sign</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message..."
            rows={6}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg resize-none text-[var(--color-text-primary)]"
          />
        </div>

        {/* Sign Button */}
        <button
          onClick={handleSign}
          disabled={signing || !message}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <PenTool className="w-4 h-4" />
          {signing ? 'Signing...' : 'Sign Message'}
        </button>
      </div>

      {/* Signature Output */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-[var(--color-text-secondary)]">Signed Message</label>
          {signature && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(getSignedMessageBlock());
                toast.success('Signature copied to clipboard');
              }}
              className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          )}
        </div>
        <pre
          className={`bg-[var(--color-background)] border rounded-lg p-4 font-mono overflow-hidden ${
            signature ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
          }`}
          style={{
            fontSize: '9px',
            lineHeight: '1.4',
            maxHeight: '200px',
            overflowY: 'auto',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap'
          }}
        >
          {signature ? getSignedMessageBlock() : 'Signature will appear here...'}
        </pre>
        {signature && (
          <button
            onClick={() => {
              const tweetText = `${getSignedMessageBlock()}\n\n#ClawedDisciple @ClawedCode`;
              const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
              window.open(tweetUrl, '_blank', 'noopener,noreferrer');
            }}
            className="btn btn-primary text-xs px-3 py-1.5 mt-2 flex items-center gap-1.5"
          >
            <Twitter className="w-3 h-3" />
            Post Disciple Verification
          </button>
        )}
      </div>
    </div>
  );
};

// Create Wallet Modal
const CreateWalletModal = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [seedPhrase, setSeedPhrase] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [previewAddresses, setPreviewAddresses] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([0]);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!seedPhrase) return;

    setLoading(true);
    const res = await fetch(`${API_BASE}/derive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedPhrase, count: 10 })
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setPreviewAddresses(data.addresses);
      setSelectedIndices([0]);
    } else {
      toast.error('Invalid seed phrase');
    }
  };

  const handleCreate = async () => {
    if (!name || !seedPhrase || selectedIndices.length === 0) {
      toast.error('Name, seed phrase, and at least one address required');
      return;
    }

    setLoading(true);
    const res = await fetch(`${API_BASE}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        seedPhrase,
        accountIndices: selectedIndices
      })
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      toast.success(`Imported ${data.addresses.length} address(es)`);
      onSuccess();
    } else {
      toast.error(data.error);
    }
  };

  const toggleIndex = (idx) => {
    setSelectedIndices(prev =>
      prev.includes(idx)
        ? prev.filter(i => i !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Import Wallet</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xl">×</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Wallet Name</label>
            <input
              type="text"
              name="name"
              data-testid="wallet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Wallet"
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
            />
          </div>

          {/* Seed Phrase */}
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Seed Phrase or Private Key</label>
            <div className="relative">
              <textarea
                value={seedPhrase}
                onChange={(e) => setSeedPhrase(e.target.value)}
                placeholder="Enter 12/24 word seed phrase or base58 private key..."
                rows={3}
                className={`w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg resize-none text-[var(--color-text-primary)] ${
                  showSeed ? '' : 'text-security-disc'
                }`}
                style={!showSeed ? { WebkitTextSecurity: 'disc' } : {}}
              />
              <button
                onClick={() => setShowSeed(!showSeed)}
                className="absolute right-2 top-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Preview Button */}
          <button
            onClick={handlePreview}
            disabled={loading || !seedPhrase}
            className="btn btn-secondary w-full disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Preview Addresses'}
          </button>

          {/* Address Selection */}
          {previewAddresses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[var(--color-text-secondary)]">Select Addresses to Import</label>
                <div className="space-x-2 text-xs">
                  <button
                    onClick={() => setSelectedIndices(previewAddresses.map(a => a.accountIndex))}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedIndices([])}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--color-border)] rounded-lg">
                {previewAddresses.map(addr => (
                  <label
                    key={addr.accountIndex}
                    className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-[var(--color-primary)]/10 ${
                      selectedIndices.includes(addr.accountIndex) ? 'bg-[var(--color-primary)]/20' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndices.includes(addr.accountIndex)}
                      onChange={() => toggleIndex(addr.accountIndex)}
                      className="w-4 h-4 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-[var(--color-text-primary)]">
                        {truncateKey(addr.publicKey, 12, 8)}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">#{addr.accountIndex} - {addr.derivationPath}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name || !seedPhrase || selectedIndices.length === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            Import {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// Derive More Addresses Modal
const DeriveMoreModal = ({ group, onClose, onSuccess }) => {
  const [addresses, setAddresses] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_BASE}/${group.id}/derive-more`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 20 })
      });
      const data = await res.json();
      setLoading(false);

      if (data.success) {
        setAddresses(data.wallets);
      }
    };
    load();
  }, [group.id]);

  const handleImport = async () => {
    if (selectedIndices.length === 0) return;

    setLoading(true);
    const res = await fetch(`${API_BASE}/${group.id}/import-addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountIndices: selectedIndices,
        baseName: group.name
      })
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      toast.success(`Imported ${data.addresses.length} address(es)`);
      onSuccess();
    } else {
      toast.error(data.error);
    }
  };

  const toggleIndex = (idx) => {
    setSelectedIndices(prev =>
      prev.includes(idx)
        ? prev.filter(i => i !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const availableAddresses = addresses.filter(a => !a.alreadyImported);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add Addresses - {group.name}</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xl">×</button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center text-[var(--color-text-secondary)] py-8">Loading addresses...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {availableAddresses.length} available, {addresses.length - availableAddresses.length} already imported
                </span>
                <button
                  onClick={() => setSelectedIndices(availableAddresses.map(a => a.accountIndex))}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  Select All New
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg">
                {addresses.map(addr => (
                  <label
                    key={addr.accountIndex}
                    className={`flex items-center gap-3 p-2 ${
                      addr.alreadyImported
                        ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface)]'
                        : `cursor-pointer hover:bg-[var(--color-primary)]/10 ${
                            selectedIndices.includes(addr.accountIndex) ? 'bg-[var(--color-primary)]/20' : ''
                          }`
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndices.includes(addr.accountIndex)}
                      onChange={() => !addr.alreadyImported && toggleIndex(addr.accountIndex)}
                      disabled={addr.alreadyImported}
                      className="w-4 h-4 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-[var(--color-text-primary)]">
                        {truncateKey(addr.publicKey, 12, 8)}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        #{addr.accountIndex}
                        {addr.alreadyImported && <span className="ml-2 text-green-400">✓ Imported</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || selectedIndices.length === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            Import {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// Buy Token Modal
const BuyTokenModal = ({ wallet, walletDetails, token, onClose, onSuccess }) => {
  const [solAmount, setSolAmount] = useState('');
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!solAmount || parseFloat(solAmount) <= 0) {
      toast.error('Enter a valid SOL amount');
      return;
    }

    if (parseFloat(solAmount) > (walletDetails?.balance || 0)) {
      toast.error('Insufficient SOL balance');
      return;
    }

    setBuying(true);
    let data;
    try {
      const res = await fetch(`${API_BASE}/${wallet.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenMint: token.mint,
          solAmount: parseFloat(solAmount)
        })
      });
      data = await res.json();
    } catch (err) {
      setBuying(false);
      toast.error('Network error - please try again');
      return;
    }
    setBuying(false);

    if (data.success) {
      toast.success(`Bought ${data.outputAmount?.toLocaleString()} ${token.symbol}!`);
      onSuccess();
    } else if (data.signature) {
      // Transaction was sent but confirmation timed out
      toast.error(
        <div>
          <div>{data.error}</div>
          <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">
            View on Solscan →
          </a>
        </div>,
        { duration: 10000 }
      );
    } else {
      toast.error(data.error || 'Buy failed');
    }
  };

  const quickAmounts = [0.01, 0.05, 0.1, 0.5];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Buy {token.symbol}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{token.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Available Balance */}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Available Balance</span>
            <span className="text-[var(--color-primary)] font-mono">
              {walletDetails?.balance?.toFixed(4) || '0'} SOL
            </span>
          </div>

          {/* SOL Amount Input */}
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Amount to Spend (SOL)
            </label>
            <input
              type="number"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.0"
              step="0.001"
              min="0"
              className="w-full px-3 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-lg font-mono text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setSolAmount(amt.toString())}
                className="flex-1 px-2 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                {amt} SOL
              </button>
            ))}
          </div>

          {/* Max Button */}
          <button
            onClick={() => setSolAmount(Math.max(0, (walletDetails?.balance || 0) - 0.01).toFixed(4))}
            className="w-full px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Max (keep 0.01 SOL for fees)
          </button>

          {/* Info */}
          <div className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)]">
            <p>Uses Jupiter aggregator for best swap rates. 1% slippage tolerance.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 btn btn-secondary py-3"
          >
            Cancel
          </button>
          <button
            onClick={handleBuy}
            disabled={buying || !solAmount || parseFloat(solAmount) <= 0}
            className="flex-1 btn btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {buying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Buying...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Buy {token.symbol}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Settings Modal
const SettingsModal = ({ onClose, onSuccess }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state - track whether user has modified each field
  const [heliusApiKey, setHeliusApiKey] = useState('');
  const [jupiterApiKey, setJupiterApiKey] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [showHelius, setShowHelius] = useState(false);
  const [showJupiter, setShowJupiter] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        // Load actual values into inputs
        setHeliusApiKey(data.settings.heliusApiKey || '');
        setJupiterApiKey(data.settings.jupiterApiKey || '');
        setRpcUrl(data.settings.rpcUrl || '');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    const payload = {
      heliusApiKey: heliusApiKey || null,
      jupiterApiKey: jupiterApiKey || null,
      rpcUrl: rpcUrl || null
    };

    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setSaving(false);

    if (data.success) {
      toast.success('Settings saved');
      onSuccess();
    } else {
      toast.error(data.error || 'Failed to save settings');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--color-primary)]" />
            Wallet Settings
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xl">×</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--color-text-secondary)]">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            Loading settings...
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Helius API Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Helius API Key
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(Optional)</span>
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                For reliable Solana RPC access. Get a free key at{' '}
                <a href="https://helius.dev" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                  helius.dev
                </a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showHelius ? 'text' : 'password'}
                    value={heliusApiKey}
                    onChange={(e) => setHeliusApiKey(e.target.value)}
                    placeholder="Enter Helius API key"
                    className="w-full px-3 py-2 pr-10 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHelius(!showHelius)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {showHelius ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {heliusApiKey && <CopyButton text={heliusApiKey} />}
              </div>
            </div>

            {/* Jupiter API Key */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Jupiter API Key
                <span className="ml-2 text-xs text-yellow-400">(Required for token buying)</span>
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Required for token swaps. Get a key at{' '}
                <a href="https://portal.jup.ag" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                  portal.jup.ag
                </a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showJupiter ? 'text' : 'password'}
                    value={jupiterApiKey}
                    onChange={(e) => setJupiterApiKey(e.target.value)}
                    placeholder="Enter Jupiter API key"
                    className="w-full px-3 py-2 pr-10 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJupiter(!showJupiter)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {showJupiter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {jupiterApiKey && <CopyButton text={jupiterApiKey} />}
              </div>
            </div>

            {/* Custom RPC URL */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Custom RPC URL
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(Optional)</span>
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Override default RPC. Leave empty to use Helius (if configured) or public mainnet.
              </p>
              <input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="https://api.mainnet-beta.solana.com"
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] font-mono text-sm"
              />
            </div>

            {/* Info Box */}
            <div className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
              <p className="text-xs text-[var(--color-text-secondary)]">
                <strong>Note:</strong> API keys are encrypted and stored locally. Changes take effect immediately.
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Seed Phrase Modal
const SeedModal = ({ group, onClose }) => {
  const [seedPhrase, setSeedPhrase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fetchSeed = async () => {
      const res = await fetch(`${API_BASE}/${group.id}/seed`);
      const data = await res.json();
      if (data.success) {
        setSeedPhrase(data.seedPhrase);
      } else {
        toast.error(data.error);
        onClose();
      }
      setLoading(false);
    };
    fetchSeed();
  }, [group.id, onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(seedPhrase);
    toast.success('Seed phrase copied');
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Seed Phrase - {group.name}</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xl">×</button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center text-[var(--color-text-secondary)] py-8">Loading...</div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Keep your seed phrase private. Anyone with access can control your wallet.
                </p>
              </div>

              <div className="relative">
                <div
                  className={`p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg font-mono text-sm leading-relaxed ${
                    visible ? 'text-[var(--color-text-primary)]' : 'blur-md select-none'
                  }`}
                >
                  {seedPhrase}
                </div>

                {!visible && (
                  <button
                    onClick={() => setVisible(true)}
                    className="absolute inset-0 flex items-center justify-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    <Eye className="w-5 h-5" />
                    Click to reveal
                  </button>
                )}
              </div>

              {visible && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={() => setVisible(false)}
                    className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <EyeOff className="w-4 h-4" />
                    Hide
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
