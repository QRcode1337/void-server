/**
 * Token Gate Service
 *
 * Provides token-based access control for federation features:
 * - Balance verification via Solana RPC (Helius)
 * - Tiered access levels based on $CLAWED holdings
 * - Caching for performance (balance checks are expensive)
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

// $CLAWED token configuration
const CLAWED_TOKEN = {
  mint: 'ELusVXzUPHyAuPB3M7qemr2Y2KshiWnGXauK17XYpump',
  symbol: 'CLAWED',
  decimals: 6
};

// Access tiers (in whole tokens, not raw units)
const ACCESS_TIERS = {
  INITIATE: 0,           // No tokens required
  SEEKER: 100000,        // 100K tokens - basic access
  DISCIPLE: 500000,      // 500K tokens - read federation memories
  ACOLYTE: 1000000,      // 1M tokens - write to federation
  ASCENDED: 5000000,     // 5M tokens - full access + governance
  ARCHITECT: 10000000    // 10M tokens - network admin
};

// Feature gates mapped to tiers
const FEATURE_GATES = {
  'federation:read_memories': 'DISCIPLE',
  'federation:write_memories': 'ACOLYTE',
  'federation:sync_peers': 'DISCIPLE',
  'federation:manage_peers': 'ACOLYTE',
  'federation:admin': 'ARCHITECT'
};

// Balance cache (public key -> { balance, timestamp })
const balanceCache = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

// RPC connection (lazy initialized)
let connection = null;

/**
 * Get or create Solana connection
 */
function getConnection() {
  if (connection) return connection;

  // Try to get RPC URL from environment or use public mainnet
  const rpcUrl = process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` :
    'https://api.mainnet-beta.solana.com';

  connection = new Connection(rpcUrl, 'confirmed');
  return connection;
}

/**
 * Get $CLAWED balance for a Solana public key
 * @param {string} publicKey - Solana wallet public key (base58)
 * @returns {Promise<number>} Balance in whole tokens
 */
async function getClawedBalance(publicKey) {
  // Check cache first
  const cached = balanceCache.get(publicKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.balance;
  }

  const conn = getConnection();
  const walletPubkey = new PublicKey(publicKey);
  const mintPubkey = new PublicKey(CLAWED_TOKEN.mint);

  const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

  const accountInfo = await getAccount(conn, tokenAccount).catch(() => null);

  const rawBalance = accountInfo ? Number(accountInfo.amount) : 0;
  const balance = rawBalance / Math.pow(10, CLAWED_TOKEN.decimals);

  // Update cache
  balanceCache.set(publicKey, { balance, timestamp: Date.now() });

  return balance;
}

/**
 * Get access tier for a balance
 * @param {number} balance - Token balance in whole tokens
 * @returns {string} Tier name
 */
function getTierForBalance(balance) {
  if (balance >= ACCESS_TIERS.ARCHITECT) return 'ARCHITECT';
  if (balance >= ACCESS_TIERS.ASCENDED) return 'ASCENDED';
  if (balance >= ACCESS_TIERS.ACOLYTE) return 'ACOLYTE';
  if (balance >= ACCESS_TIERS.DISCIPLE) return 'DISCIPLE';
  if (balance >= ACCESS_TIERS.SEEKER) return 'SEEKER';
  return 'INITIATE';
}

/**
 * Check if a wallet has access to a feature
 * @param {string} publicKey - Solana wallet public key
 * @param {string} feature - Feature to check (e.g., 'federation:read_memories')
 * @returns {Promise<{allowed: boolean, tier: string, balance: number, required: number}>}
 */
async function checkAccess(publicKey, feature) {
  const requiredTier = FEATURE_GATES[feature];

  if (!requiredTier) {
    // Feature not gated, allow access
    return { allowed: true, tier: 'NONE', balance: 0, required: 0 };
  }

  const balance = await getClawedBalance(publicKey);
  const tier = getTierForBalance(balance);
  const requiredBalance = ACCESS_TIERS[requiredTier];

  const tierOrder = Object.keys(ACCESS_TIERS);
  const currentTierIndex = tierOrder.indexOf(tier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);

  const allowed = currentTierIndex >= requiredTierIndex;

  return {
    allowed,
    tier,
    balance,
    required: requiredBalance,
    requiredTier
  };
}

/**
 * Express middleware for token-gated routes
 * @param {string} feature - Feature to gate
 * @param {Object} options - Options
 * @param {boolean} options.bypass - Bypass check if no wallet provided
 */
function requireTokens(feature, options = {}) {
  return async (req, res, next) => {
    // Get wallet from header, query, or body
    const walletAddress = req.headers['x-wallet-address'] ||
      req.query.wallet ||
      req.body?.walletAddress;

    if (!walletAddress) {
      if (options.bypass) {
        // Allow without wallet but mark as ungated
        req.tokenGate = { bypassed: true, tier: 'INITIATE' };
        return next();
      }
      return res.status(401).json({
        success: false,
        error: 'Wallet address required',
        hint: 'Provide wallet in X-Wallet-Address header or wallet query param'
      });
    }

    const result = await checkAccess(walletAddress, feature);

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: `Insufficient $CLAWED balance`,
        details: {
          feature,
          required: result.required,
          requiredTier: result.requiredTier,
          current: result.balance,
          currentTier: result.tier,
          token: CLAWED_TOKEN.symbol,
          mint: CLAWED_TOKEN.mint
        }
      });
    }

    // Attach token gate info to request
    req.tokenGate = {
      wallet: walletAddress,
      tier: result.tier,
      balance: result.balance,
      feature
    };

    next();
  };
}

/**
 * Clear balance cache for a wallet
 * @param {string} publicKey - Wallet to clear
 */
function clearCache(publicKey) {
  if (publicKey) {
    balanceCache.delete(publicKey);
  } else {
    balanceCache.clear();
  }
}

/**
 * Get token gate configuration for client
 */
function getConfig() {
  return {
    token: CLAWED_TOKEN,
    tiers: ACCESS_TIERS,
    features: FEATURE_GATES
  };
}

/**
 * Verify a wallet address is valid
 * @param {string} address - Address to verify
 * @returns {boolean}
 */
function isValidWallet(address) {
  if (!address || typeof address !== 'string') return false;
  // Solana addresses are 32-44 characters base58
  if (address.length < 32 || address.length > 44) return false;
  // Check for valid base58 characters
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

module.exports = {
  CLAWED_TOKEN,
  ACCESS_TIERS,
  FEATURE_GATES,
  getClawedBalance,
  getTierForBalance,
  checkAccess,
  requireTokens,
  clearCache,
  getConfig,
  isValidWallet
};
