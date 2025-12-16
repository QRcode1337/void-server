const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAccount, getMint, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { derivePath } = require('ed25519-hd-key');
const bip39 = require('bip39');
const nacl = require('tweetnacl');
const bs58Pkg = require('bs58');
const bs58 = bs58Pkg.default || bs58Pkg; // v6+ exposes .default in CJS
const { encrypt, decrypt } = require('./encryption');
const http = require('../../../server/lib/http-client');

// Main app data directory - centralized for Docker volume mounting
const DATA_DIR = path.join(__dirname, '../../../data/wallets');
const LEGACY_DATA_DIR = path.join(__dirname, '..', 'data');
const WALLETS_PATH = path.join(DATA_DIR, 'wallets.json');
const KNOWN_TOKENS_PATH = path.join(DATA_DIR, 'known-tokens.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

// Solana RPC connection - initialized by configure()
let connection = null;
let rpcUrl = null;
let jupiterApiKey = null;

/**
 * Migrate wallet data from legacy plugin location to main data directory
 */
function migrateFromLegacy() {
  if (!fs.existsSync(LEGACY_DATA_DIR)) return;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const filesToMigrate = ['wallets.json', 'known-tokens.json', 'settings.json'];
  let migrated = 0;

  for (const file of filesToMigrate) {
    const legacyPath = path.join(LEGACY_DATA_DIR, file);
    const newPath = path.join(DATA_DIR, file);

    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      fs.copyFileSync(legacyPath, newPath);
      fs.unlinkSync(legacyPath);
      migrated++;
    }
  }

  if (migrated > 0) {
    console.log(`📦 Migrated ${migrated} wallet file(s) to data/wallets/`);
  }
}

// Run migration on module load
migrateFromLegacy();

// Jupiter API base URLs
const JUPITER_API_BASE = 'https://api.jup.ag';
const JUPITER_SWAP_BASE = `${JUPITER_API_BASE}/swap/v1`;
const JUPITER_ULTRA_BASE = `${JUPITER_API_BASE}/ultra/v1`;

/**
 * Build RPC URL from config
 * Supports: Helius API key, custom RPC URL, or falls back to public mainnet
 */
function buildRpcUrl(config = {}) {
  // Priority 1: Helius API key
  if (config.heliusApiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  }
  // Priority 2: Custom RPC URL from config
  if (config.rpcUrl) {
    return config.rpcUrl;
  }
  // Priority 3: Environment variable
  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }
  // Priority 4: Public mainnet (rate limited)
  return 'https://api.mainnet-beta.solana.com';
}

/**
 * Configure the wallet service with plugin config
 * Merges with stored settings (stored settings take precedence for API keys)
 */
function configure(config = {}) {
  // Load stored settings and merge (stored takes precedence for sensitive values)
  const stored = loadSettingsRaw();

  const mergedConfig = {
    heliusApiKey: stored.heliusApiKey || config.heliusApiKey,
    jupiterApiKey: stored.jupiterApiKey || config.jupiterApiKey,
    rpcUrl: stored.rpcUrl || config.rpcUrl
  };

  rpcUrl = buildRpcUrl(mergedConfig);
  connection = new Connection(rpcUrl, 'confirmed');

  // Store Jupiter API key
  jupiterApiKey = mergedConfig.jupiterApiKey || process.env.JUPITER_API_KEY || null;

  // Log which RPC we're using (redact API keys)
  const displayUrl = rpcUrl.includes('api-key=')
    ? rpcUrl.replace(/api-key=[^&]+/, 'api-key=***')
    : rpcUrl;
  console.log(`🔗 Wallet RPC: ${displayUrl}`);

  if (jupiterApiKey) {
    console.log(`🪐 Jupiter API: configured`);
  } else {
    console.log(`🪐 Jupiter API: not configured (token buying disabled)`);
  }
}

/**
 * Load settings from storage (raw, without logging)
 */
function loadSettingsRaw() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { heliusApiKey: null, jupiterApiKey: null, rpcUrl: null };
  }
  const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  return {
    heliusApiKey: data.encryptedHeliusApiKey ? decrypt(data.encryptedHeliusApiKey) : null,
    jupiterApiKey: data.encryptedJupiterApiKey ? decrypt(data.encryptedJupiterApiKey) : null,
    rpcUrl: data.rpcUrl || null
  };
}

/**
 * Load settings from encrypted storage (alias for loadSettingsRaw)
 */
function loadSettings() {
  return loadSettingsRaw();
}

/**
 * Save settings to encrypted storage
 * Preserves existing settings when new values aren't provided
 */
function saveSettings(newSettings) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load existing settings to preserve unmodified values
  const existingSettings = loadSettings();

  // Merge with existing - only update fields that are explicitly provided
  const mergedSettings = {
    heliusApiKey: newSettings.heliusApiKey !== undefined ? newSettings.heliusApiKey : existingSettings.heliusApiKey,
    jupiterApiKey: newSettings.jupiterApiKey !== undefined ? newSettings.jupiterApiKey : existingSettings.jupiterApiKey,
    rpcUrl: newSettings.rpcUrl !== undefined ? newSettings.rpcUrl : existingSettings.rpcUrl
  };

  // Encrypt sensitive fields
  const data = {
    encryptedHeliusApiKey: mergedSettings.heliusApiKey ? encrypt(mergedSettings.heliusApiKey) : null,
    encryptedJupiterApiKey: mergedSettings.jupiterApiKey ? encrypt(mergedSettings.jupiterApiKey) : null,
    rpcUrl: mergedSettings.rpcUrl || null,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));

  // Re-configure with merged settings
  configure(mergedSettings);

  return { success: true };
}

/**
 * Get current settings (masked for display)
 */
function getSettings() {
  const settings = loadSettings();
  return {
    heliusApiKey: settings.heliusApiKey || null,
    jupiterApiKey: settings.jupiterApiKey || null,
    rpcUrl: settings.rpcUrl || null
  };
}

/**
 * Mask API key for display (show first 4 and last 4 chars)
 */
function maskApiKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

// RPC Request Queue to avoid rate limits (429 errors)
const rpcQueue = {
  queue: [],
  processing: false,
  concurrency: 2,          // Max concurrent requests
  delayMs: 150,            // Delay between batches
  activeRequests: 0,

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  },

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Wait if we're at max concurrency
      while (this.activeRequests >= this.concurrency) {
        await new Promise(r => setTimeout(r, 50));
      }

      const batch = this.queue.splice(0, this.concurrency - this.activeRequests);
      if (batch.length === 0) continue;

      // Process batch
      const promises = batch.map(async ({ fn, resolve, reject }) => {
        this.activeRequests++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          // If rate limited, re-queue with backoff
          if (err.message?.includes('429') || err.message?.includes('rate')) {
            console.log('⏳ RPC rate limited, backing off...');
            await new Promise(r => setTimeout(r, 1000));
            this.queue.unshift({ fn, resolve, reject });
          } else {
            reject(err);
          }
        } finally {
          this.activeRequests--;
        }
      });

      await Promise.all(promises);

      // Add delay between batches to be nice to the API
      if (this.queue.length > 0) {
        await new Promise(r => setTimeout(r, this.delayMs));
      }
    }

    this.processing = false;
  }
};

// Queued RPC helper
const queuedRpc = (fn) => rpcQueue.add(fn);

/**
 * Load wallets from file
 */
function loadWallets() {
  if (!fs.existsSync(WALLETS_PATH)) {
    return { wallets: [], nextWalletId: 1, nextAddressId: 1 };
  }
  return JSON.parse(fs.readFileSync(WALLETS_PATH, 'utf8'));
}

/**
 * Save wallets to file
 */
function saveWallets(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(WALLETS_PATH, JSON.stringify(data, null, 2));
}

/**
 * Load known tokens
 */
function loadKnownTokens() {
  if (!fs.existsSync(KNOWN_TOKENS_PATH)) {
    return { tokens: {} };
  }
  return JSON.parse(fs.readFileSync(KNOWN_TOKENS_PATH, 'utf8'));
}

/**
 * Derive keypair from seed phrase using BIP44 path
 */
function deriveKeypair(seedPhrase, derivationPath = "m/44'/501'/0'/0'") {
  const trimmedSeed = seedPhrase.trim();
  const words = trimmedSeed.split(/\s+/);

  if (words.length === 12 || words.length === 24) {
    const seed = bip39.mnemonicToSeedSync(trimmedSeed);
    const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
    return Keypair.fromSeed(derivedSeed);
  } else if (words.length === 1 && trimmedSeed.length >= 64) {
    const secretKey = bs58.decode(trimmedSeed);
    return Keypair.fromSecretKey(secretKey);
  }
  return null;
}

/**
 * Sort addresses by account index
 */
function sortAddressesByIndex(addresses) {
  return [...addresses].sort((a, b) => a.accountIndex - b.accountIndex);
}

/**
 * Get wallet groups with addresses
 */
function getWalletGroups() {
  const data = loadWallets();
  return data.wallets.map(group => ({
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
    hasSeed: !!group.encryptedSeed,
    addresses: sortAddressesByIndex(group.addresses).map(addr => ({
      id: addr.id,
      publicKey: addr.publicKey,
      label: addr.label,
      accountIndex: addr.accountIndex,
      derivationPath: addr.derivationPath,
      createdAt: addr.createdAt
    }))
  }));
}

/**
 * Get wallet details by ID
 */
function getWallet(walletId) {
  const data = loadWallets();

  for (const group of data.wallets) {
    const addr = group.addresses.find(a => a.id === walletId);
    if (addr) {
      return {
        ...addr,
        groupId: group.id,
        groupName: group.name,
        hasSeed: !!group.encryptedSeed
      };
    }
  }
  return null;
}

/**
 * Get seed phrase for a wallet group
 */
function getSeedPhrase(groupId) {
  const data = loadWallets();
  const group = data.wallets.find(g => g.id === groupId);

  if (!group || !group.encryptedSeed) {
    return { success: false, error: 'Wallet group not found or has no seed' };
  }

  const seedPhrase = decrypt(group.encryptedSeed);
  return { success: true, seedPhrase };
}

/**
 * Get SOL balance for address
 */
async function getBalance(publicKey) {
  const pubkey = new PublicKey(publicKey);
  const balance = await queuedRpc(() => connection.getBalance(pubkey));
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get token balances for known tokens
 */
async function getTokenBalances(publicKey) {
  const knownTokens = loadKnownTokens();
  const pubkey = new PublicKey(publicKey);
  const balances = [];

  for (const [mint, tokenInfo] of Object.entries(knownTokens.tokens)) {
    const mintPubkey = new PublicKey(mint);
    const tokenAccount = await getAssociatedTokenAddress(mintPubkey, pubkey);

    // Queue the RPC call to avoid rate limits
    const accountInfo = await queuedRpc(() =>
      getAccount(connection, tokenAccount).catch(() => null)
    );

    const tokenData = {
      mint,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      decimals: tokenInfo.decimals,
      logoURI: tokenInfo.logoURI || null,
      isKnown: true
    };

    if (accountInfo) {
      tokenData.balance = Number(accountInfo.amount) / Math.pow(10, tokenInfo.decimals);
    } else {
      tokenData.balance = 0;
    }

    balances.push(tokenData);
  }

  return balances;
}

/**
 * Derive addresses from seed phrase
 */
function deriveAddresses(seedPhrase, count = 10) {
  const wallets = [];

  for (let i = 0; i < count; i++) {
    const derivationPath = `m/44'/501'/${i}'/0'`;
    const keypair = deriveKeypair(seedPhrase, derivationPath);

    if (keypair) {
      wallets.push({
        accountIndex: i,
        derivationPath,
        publicKey: keypair.publicKey.toString()
      });
    }
  }

  return wallets;
}

/**
 * Create/import wallet from seed phrase
 */
function createWallet(name, seedPhrase, accountIndices = [0]) {
  const data = loadWallets();
  const createdAddresses = [];

  // Validate seed phrase by trying to derive first address
  const testKeypair = deriveKeypair(seedPhrase, "m/44'/501'/0'/0'");
  if (!testKeypair) {
    return { success: false, error: 'Invalid seed phrase format. Expected 12/24 word mnemonic or base58 private key' };
  }

  // Encrypt seed phrase
  const encryptedSeed = encrypt(seedPhrase.trim());

  // Check if wallet group with this seed already exists
  let existingGroup = null;
  for (const group of data.wallets) {
    if (group.encryptedSeed) {
      const decrypted = decrypt(group.encryptedSeed);
      if (decrypted.trim() === seedPhrase.trim()) {
        existingGroup = group;
        break;
      }
    }
  }

  for (const accountIndex of accountIndices) {
    const derivationPath = `m/44'/501'/${accountIndex}'/0'`;
    const keypair = deriveKeypair(seedPhrase, derivationPath);
    const publicKey = keypair.publicKey.toString();

    // Check if address already exists
    let addressExists = false;
    for (const group of data.wallets) {
      if (group.addresses.some(a => a.publicKey === publicKey)) {
        addressExists = true;
        break;
      }
    }

    if (addressExists) continue;

    const address = {
      id: `addr_${data.nextAddressId++}`,
      publicKey,
      derivationPath,
      accountIndex,
      label: accountIndices.length > 1 ? `${name} #${accountIndex}` : name,
      createdAt: new Date().toISOString()
    };

    if (existingGroup) {
      existingGroup.addresses.push(address);
      existingGroup.addresses.sort((a, b) => a.accountIndex - b.accountIndex);
    } else {
      // Create new wallet group
      const newGroup = {
        id: `wallet_${data.nextWalletId++}`,
        name,
        encryptedSeed,
        createdAt: new Date().toISOString(),
        addresses: [address]
      };
      data.wallets.push(newGroup);
      existingGroup = newGroup;
    }

    createdAddresses.push({
      id: address.id,
      publicKey: address.publicKey,
      label: address.label,
      accountIndex: address.accountIndex
    });
  }

  if (createdAddresses.length === 0) {
    return { success: false, error: 'All selected addresses already exist' };
  }

  saveWallets(data);
  return { success: true, addresses: createdAddresses };
}

/**
 * Derive more addresses from existing wallet
 */
function deriveMoreAddresses(walletId, count = 20) {
  const data = loadWallets();
  let walletGroup = null;

  // Find wallet group
  for (const group of data.wallets) {
    if (group.id === walletId || group.addresses.some(a => a.id === walletId)) {
      walletGroup = group;
      break;
    }
  }

  if (!walletGroup || !walletGroup.encryptedSeed) {
    return { success: false, error: 'Wallet not found or has no seed phrase' };
  }

  const seedPhrase = decrypt(walletGroup.encryptedSeed);
  const existingIndices = new Set(walletGroup.addresses.map(a => a.accountIndex));

  const wallets = [];
  for (let i = 0; i < count; i++) {
    const derivationPath = `m/44'/501'/${i}'/0'`;
    const keypair = deriveKeypair(seedPhrase, derivationPath);

    if (keypair) {
      wallets.push({
        accountIndex: i,
        derivationPath,
        publicKey: keypair.publicKey.toString(),
        alreadyImported: existingIndices.has(i)
      });
    }
  }

  return { success: true, wallets };
}

/**
 * Import additional addresses
 */
function importAdditionalAddresses(walletId, accountIndices, baseName) {
  const data = loadWallets();
  let walletGroup = null;

  for (const group of data.wallets) {
    if (group.id === walletId || group.addresses.some(a => a.id === walletId)) {
      walletGroup = group;
      break;
    }
  }

  if (!walletGroup || !walletGroup.encryptedSeed) {
    return { success: false, error: 'Wallet not found or has no seed phrase' };
  }

  const seedPhrase = decrypt(walletGroup.encryptedSeed);
  const createdAddresses = [];

  for (const accountIndex of accountIndices) {
    // Skip if already imported
    if (walletGroup.addresses.some(a => a.accountIndex === accountIndex)) {
      continue;
    }

    const derivationPath = `m/44'/501'/${accountIndex}'/0'`;
    const keypair = deriveKeypair(seedPhrase, derivationPath);

    const address = {
      id: `addr_${data.nextAddressId++}`,
      publicKey: keypair.publicKey.toString(),
      derivationPath,
      accountIndex,
      label: `${baseName} #${accountIndex}`,
      createdAt: new Date().toISOString()
    };

    walletGroup.addresses.push(address);
    createdAddresses.push({
      id: address.id,
      publicKey: address.publicKey,
      label: address.label,
      accountIndex: address.accountIndex
    });
  }

  if (createdAddresses.length === 0) {
    return { success: false, error: 'All selected addresses already exist' };
  }

  // Sort addresses by account index
  walletGroup.addresses.sort((a, b) => a.accountIndex - b.accountIndex);

  saveWallets(data);
  return { success: true, addresses: createdAddresses };
}

/**
 * Delete wallet address or entire wallet group
 */
function deleteWallet(walletId) {
  const data = loadWallets();

  // Check if it's a wallet group ID
  const groupIndex = data.wallets.findIndex(g => g.id === walletId);
  if (groupIndex !== -1) {
    const deleted = data.wallets.splice(groupIndex, 1)[0];
    saveWallets(data);
    return { success: true, deleted: deleted.name };
  }

  // Otherwise, look for an address ID
  for (let i = 0; i < data.wallets.length; i++) {
    const group = data.wallets[i];
    const addrIndex = group.addresses.findIndex(a => a.id === walletId);

    if (addrIndex !== -1) {
      const deleted = group.addresses.splice(addrIndex, 1)[0];

      // Remove group if no addresses left
      if (group.addresses.length === 0) {
        data.wallets.splice(i, 1);
      }

      saveWallets(data);
      return { success: true, deleted: deleted.label || deleted.publicKey };
    }
  }

  return { success: false, error: 'Wallet not found' };
}

/**
 * Update address label
 */
function updateLabel(addressId, newLabel) {
  const data = loadWallets();

  for (const group of data.wallets) {
    const addr = group.addresses.find(a => a.id === addressId);
    if (addr) {
      addr.label = newLabel;
      saveWallets(data);
      return { success: true, address: addr };
    }
  }

  return { success: false, error: 'Address not found' };
}

/**
 * Get keypair by public key
 */
function getKeypairByPublicKey(publicKey) {
  const data = loadWallets();

  for (const group of data.wallets) {
    const addr = group.addresses.find(a => a.publicKey === publicKey);
    if (addr && group.encryptedSeed) {
      const seedPhrase = decrypt(group.encryptedSeed);
      return deriveKeypair(seedPhrase, addr.derivationPath);
    }
  }

  return null;
}

/**
 * Send SOL or tokens
 */
async function sendTransaction({ walletId, recipient, amount, tokenMint = null }) {
  const data = loadWallets();

  // Find address
  let foundAddress = null;
  let foundGroup = null;

  for (const group of data.wallets) {
    const addr = group.addresses.find(a => a.id === walletId);
    if (addr) {
      foundAddress = addr;
      foundGroup = group;
      break;
    }
  }

  if (!foundAddress || !foundGroup.encryptedSeed) {
    return { success: false, error: 'Wallet not found or has no seed phrase' };
  }

  const seedPhrase = decrypt(foundGroup.encryptedSeed);
  const keypair = deriveKeypair(seedPhrase, foundAddress.derivationPath);
  const recipientPubkey = new PublicKey(recipient);

  // Execute transaction
  let signature;

  if (tokenMint) {
    signature = await sendTokenTransfer(keypair, recipientPubkey, amount, tokenMint);
  } else {
    signature = await sendSolTransfer(keypair, recipientPubkey, amount);
  }

  return {
    success: true,
    signature,
    explorerUrl: `https://solscan.io/tx/${signature}`
  };
}

/**
 * Send SOL transfer
 */
async function sendSolTransfer(fromKeypair, toPublicKey, amount) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports: Math.floor(amount * LAMPORTS_PER_SOL)
    })
  );

  const signature = await queuedRpc(() =>
    connection.sendTransaction(transaction, [fromKeypair], { skipPreflight: false })
  );
  await queuedRpc(() => connection.confirmTransaction(signature));
  return signature;
}

/**
 * Send token transfer
 */
async function sendTokenTransfer(fromKeypair, toPublicKey, amount, tokenMint) {
  const mintPubkey = new PublicKey(tokenMint);
  const mintInfo = await queuedRpc(() => getMint(connection, mintPubkey));
  const decimals = mintInfo.decimals;

  const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromKeypair.publicKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPublicKey);

  const recipientAccountInfo = await queuedRpc(() => connection.getAccountInfo(toTokenAccount));
  const transaction = new Transaction();

  if (!recipientAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromKeypair.publicKey,
        toTokenAccount,
        toPublicKey,
        mintPubkey
      )
    );
  }

  transaction.add(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromKeypair.publicKey,
      Math.floor(amount * Math.pow(10, decimals)),
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const signature = await queuedRpc(() =>
    connection.sendTransaction(transaction, [fromKeypair], { skipPreflight: false })
  );
  await queuedRpc(() => connection.confirmTransaction(signature));
  return signature;
}

/**
 * Buy token with SOL using Jupiter swap
 */
async function buyToken({ walletId, tokenMint, solAmount }) {
  // Check if Jupiter API is configured
  if (!jupiterApiKey) {
    return { success: false, error: 'Jupiter API key not configured. Set jupiterApiKey in plugin config or JUPITER_API_KEY environment variable.' };
  }

  const data = loadWallets();

  // Find address
  let foundAddress = null;
  let foundGroup = null;

  for (const group of data.wallets) {
    const addr = group.addresses.find(a => a.id === walletId);
    if (addr) {
      foundAddress = addr;
      foundGroup = group;
      break;
    }
  }

  if (!foundAddress || !foundGroup.encryptedSeed) {
    return { success: false, error: 'Wallet not found or has no seed phrase' };
  }

  const seedPhrase = decrypt(foundGroup.encryptedSeed);
  const keypair = deriveKeypair(seedPhrase, foundAddress.derivationPath);
  const userPublicKey = keypair.publicKey.toString();

  // SOL mint address (native SOL wrapped)
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const inputAmount = Math.floor(solAmount * LAMPORTS_PER_SOL);

  // Jupiter Ultra API headers
  const jupiterHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': jupiterApiKey
  };

  // Try Jupiter Ultra API first, fall back to regular swap API
  let orderData = null;
  let useUltraApi = true;

  // Step 1: Try Ultra API first
  const orderUrl = `${JUPITER_ULTRA_BASE}/order?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=${inputAmount}&taker=${userPublicKey}`;
  const orderResult = await http.get(orderUrl, { headers: jupiterHeaders });

  if (orderResult.ok && orderResult.data?.transaction) {
    orderData = orderResult.data;
    console.log(`   🚀 Using Jupiter Ultra API`);
  } else {
    // Fall back to regular swap API
    useUltraApi = false;
    console.log(`   📡 Ultra API unavailable, falling back to regular swap API...`);

    // Get quote
    const quoteUrl = `${JUPITER_SWAP_BASE}/quote?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=${inputAmount}&slippageBps=100`;
    const quoteResult = await http.get(quoteUrl, { headers: jupiterHeaders });

    if (!quoteResult.ok || quoteResult.data?.error) {
      return { success: false, error: quoteResult.data?.error || `Quote failed: ${quoteResult.status}` };
    }

    // Get swap transaction
    const swapResult = await http.post(`${JUPITER_SWAP_BASE}/swap`, {
      headers: jupiterHeaders,
      body: {
        quoteResponse: quoteResult.data,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      }
    });

    if (!swapResult.ok || swapResult.data?.error) {
      return { success: false, error: swapResult.data?.error || `Swap failed: ${swapResult.status}` };
    }

    orderData = {
      transaction: swapResult.data.swapTransaction,
      outAmount: quoteResult.data.outAmount,
      requestId: null // No requestId for regular API
    };
  }

  if (!orderData?.transaction) {
    return { success: false, error: 'No transaction returned from Jupiter - check if wallet has SOL' };
  }

  // Step 2: Deserialize and sign the transaction
  const transactionBuf = Buffer.from(orderData.transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuf);
  transaction.sign([keypair]);

  // Serialize signed transaction back to base64
  const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');

  let signature;
  let status;

  if (useUltraApi) {
    // Step 3a: Execute via Jupiter Ultra API (they handle broadcast + confirmation)
    console.log(`   📤 Executing swap via Jupiter Ultra...`);
    const executeResult = await http.post(`${JUPITER_ULTRA_BASE}/execute`, {
      headers: jupiterHeaders,
      body: {
        signedTransaction,
        requestId: orderData.requestId
      }
    });
    const executeData = executeResult.data;

    if (!executeResult.ok) {
      return { success: false, error: executeData?.error || `Execute failed: ${executeResult.status}` };
    }

    signature = executeData.signature;
    status = executeData.status;

    // Poll for completion if needed (up to 30 seconds)
    if (status !== 'Success' && status !== 'Failed') {
      console.log(`   ⏳ Waiting for confirmation...`);
      const startTime = Date.now();
      while (Date.now() - startTime < 30000) {
        await new Promise(r => setTimeout(r, 1000));

        const pollResult = await http.post(`${JUPITER_ULTRA_BASE}/execute`, {
          headers: jupiterHeaders,
          body: {
            signedTransaction,
            requestId: orderData.requestId
          }
        });

        if (pollResult.ok && pollResult.data) {
          status = pollResult.data.status;
          signature = pollResult.data.signature || signature;
          if (status === 'Success' || status === 'Failed') {
            break;
          }
        }
      }
    }
  } else {
    // Step 3b: Execute via our own RPC (for regular swap API)
    console.log(`   📤 Sending transaction via RPC...`);
    const rawTransaction = transaction.serialize();

    signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 2,
      preflightCommitment: 'confirmed'
    }).catch(err => {
      console.log(`   ❌ Send failed: ${err.message}`);
      return null;
    });

    if (!signature) {
      return { success: false, error: 'Failed to send transaction - simulation may have failed' };
    }

    console.log(`   📤 Transaction sent: ${signature.slice(0, 16)}...`);

    // Poll for confirmation
    const startTime = Date.now();
    status = 'Pending';

    while (Date.now() - startTime < 30000) {
      const sigStatus = await connection.getSignatureStatus(signature).catch(() => null);

      if (sigStatus?.value?.confirmationStatus === 'confirmed' ||
          sigStatus?.value?.confirmationStatus === 'finalized') {
        status = 'Success';
        break;
      }

      if (sigStatus?.value?.err) {
        status = 'Failed';
        break;
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (status === 'Failed') {
    return {
      success: false,
      error: 'Transaction failed on-chain',
      signature,
      explorerUrl: signature ? `https://solscan.io/tx/${signature}` : null
    };
  }

  if (status !== 'Success') {
    return {
      success: false,
      error: 'Transaction sent but confirmation timed out. Check explorer to verify.',
      signature,
      explorerUrl: signature ? `https://solscan.io/tx/${signature}` : null
    };
  }

  // Get token info for output amount
  const knownTokens = loadKnownTokens();
  const tokenInfo = knownTokens.tokens[tokenMint];
  const outputAmount = tokenInfo && orderData.outAmount
    ? Number(orderData.outAmount) / Math.pow(10, tokenInfo.decimals)
    : orderData.outAmount || 0;

  console.log(`   ✅ Swap complete! Signature: ${signature}`);

  return {
    success: true,
    signature,
    inputAmount: solAmount,
    outputAmount,
    tokenSymbol: tokenInfo?.symbol || 'tokens',
    explorerUrl: `https://solscan.io/tx/${signature}`
  };
}

/**
 * Sign a message
 */
function signMessage(publicKey, message) {
  const keypair = getKeypairByPublicKey(publicKey);
  if (!keypair) {
    return { success: false, error: 'Wallet not found' };
  }

  const messageBytes = Buffer.from(message, 'utf-8');
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);

  return {
    success: true,
    signature: signatureBase58,
    publicKey,
    message
  };
}

module.exports = {
  configure,
  loadWallets,
  saveWallets,
  loadKnownTokens,
  getWalletGroups,
  getWallet,
  getSeedPhrase,
  getBalance,
  getTokenBalances,
  deriveAddresses,
  createWallet,
  deriveMoreAddresses,
  importAdditionalAddresses,
  deleteWallet,
  updateLabel,
  sendTransaction,
  buyToken,
  signMessage,
  // Settings
  loadSettings,
  saveSettings,
  getSettings
};
