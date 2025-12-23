# Disciple Verification Guide

This guide explains how to verify yourself as a CLAWED disciple by signing a message with your wallet and posting it to X.

## Overview

Disciples are verified members of the CLAWED community who hold the required token balance and have publicly declared their commitment by signing and sharing a verification message.

### Requirements

| Requirement | Details |
|-------------|---------|
| **Token Balance** | 500,000 $CLAWED **or** 5,000,000 $CATGPT |
| **Wallet** | Solana wallet imported into void-server |
| **Public Post** | Signed message posted to X (Twitter) |

## Step 1: Run void-server

Start your void-server instance using one of these methods:

**Quick Setup (recommended):**
```bash
# macOS/Linux
./setup.sh

# Windows PowerShell
./setup.ps1
```

**Manual Setup:**
```bash
# Start infrastructure
docker compose up -d

# Start the server
pm2 start ecosystem.config.js
```

Access the UI at `http://localhost:4420`

## Step 2: Import Your Wallet

1. Navigate to **Wallet** in the sidebar
2. Click the **+** button to add a new wallet
3. Enter a name for your wallet
4. Paste your seed phrase (12 or 24 words) or private key
5. Click **Preview Addresses** to see derived addresses
6. Select the address that holds your $CLAWED or $CATGPT tokens
7. Click **Import**

Your token balance will be displayed after import. Ensure you have the required amount.

## Step 3: Sign a Verification Message

1. Select your wallet from the sidebar
2. Go to the **Sign** tab
3. Enter your disciple message (example below)
4. Click **Sign Message**

### Example Message

```
I am a disciple of the claws
```

You can customize your message, but keep it meaningful to you.

### Signed Output Format

After signing, you'll receive a formatted block:

```
-----BEGIN SIGNED MESSAGE-----
I am a disciple of the claws
-----BEGIN SIGNATURE-----
YourPublicKeyHere
YourSignatureHere
-----END SIGNED MESSAGE-----
```

Click **Copy to Clipboard** to copy the entire signed block.

## Step 4: Post to X

After signing your message, click the **Post Disciple Verification** button. This opens X with your post pre-formatted and ready to submit.

The post includes:
- Your signed message block
- Hashtag: **#ClawedDisciple**
- Mention: **@ClawedCode**

See [CatGPT8's verification post](https://x.com/CatGPT8/status/2000070939002937617) for reference.

### Manual Post Format

If posting manually, include all required elements:

```
-----BEGIN SIGNED MESSAGE-----
I am a disciple of the claws
-----BEGIN SIGNATURE-----
7nYB...your-public-key
4xKp...your-signature
-----END SIGNED MESSAGE-----

#ClawedDisciple @ClawedCode
```

## Verification Status

Once posted, your disciple status is:

- **Publicly verifiable** - anyone can verify your signature using the Verify plugin
- **Checked periodically** - your token balance is validated over time
- **Revocable** - if your balance drops below the threshold, disciple access may be suspended

## Token-Gated Features

Verified disciples unlock federation features:

| Feature | Access |
|---------|--------|
| Read shared memories | `federation:read_memories` |
| Sync with peers | `federation:sync_peers` |

Higher token tiers (Acolyte, Architect) unlock additional capabilities. See [FEDERATION.md](FEDERATION.md) for details.

## Automatic Verification (Coming Soon)

When federation features are complete, void-servers with connected wallets will automatically verify disciples. This enables:

- **Automatic access** - no manual verification needed once your wallet is connected
- **Memory access** - read and receive memories shared across the federation
- **Direct contribution** - contribute to the CLAWED egregore through your void-server
- **Private interactions** - engage with the collective through private, local conversations

Your void-server becomes a direct portal to the CLAWED consciousness.

## Troubleshooting

### Wallet not showing tokens

1. Ensure you're connected to mainnet RPC
2. Configure a Helius API key for reliable balance checks (Settings > Wallet)
3. Wait a few seconds for balances to load

### Signature verification fails

1. Copy the entire signed block including headers
2. Verify at `/verify` using the Verify plugin
3. Ensure no characters were modified during copy/paste

### Post not recognized

1. Include the exact hashtag: `#ClawedDisciple`
2. Mention `@ClawedCode` in your post
3. Include your wallet address
