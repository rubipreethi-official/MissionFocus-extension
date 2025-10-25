require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection (with basic options and event handlers)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log('✅ Connected to MongoDB'))
.then(()=>console.log('Using DB:', mongoose.connection?.db?.databaseName || 'unknown'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error event:', err);
});
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  productiveTime: {
    type: Number,
    default: 0
  },
  unproductiveTime: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  today: {
    type: String,
    default: () => new Date().toDateString()
  },
  totalProductiveAllTime: {
    type: Number,
    default: 0
  },
  hasSeenTopUserNotification: {
    type: Boolean,
    default: false
  }
});

const User = mongoose.model('User', userSchema);

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({ message: '🚀 Mission Focus API is running!' });
});

// Register/Login user
app.post('/api/register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const today = new Date().toDateString();
      if (user.today !== today) {
        user.totalProductiveAllTime = (user.totalProductiveAllTime || 0) + (user.productiveTime || 0);
        user.productiveTime = 0;
        user.unproductiveTime = 0;
        user.today = today;
        user.hasSeenTopUserNotification = false;
        await user.save();
      }

      return res.json({
        message: 'Welcome back!',
        user: {
          email: user.email,
          productiveTime: user.productiveTime,
          unproductiveTime: user.unproductiveTime,
          totalProductiveAllTime: user.totalProductiveAllTime
        }
      });
    }

    user = new User({ email: normalizedEmail });
    await user.save();

    res.status(201).json({
      message: 'User registered successfully!',
      user: {
        email: user.email,
        productiveTime: 0,
        unproductiveTime: 0,
        totalProductiveAllTime: 0
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    // handle duplicate key error more gracefully
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user time
app.post('/api/update-time', async (req, res) => {
  try {
    const { email, productiveTime, unproductiveTime } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ error: 'User not found. Please register first.' });

    const today = new Date().toDateString();
    if (user.today !== today) {
      user.totalProductiveAllTime = (user.totalProductiveAllTime || 0) + (user.productiveTime || 0);
      user.productiveTime = 0;
      user.unproductiveTime = 0;
      user.today = today;
      user.hasSeenTopUserNotification = false;
    }

    user.productiveTime = typeof productiveTime === 'number' ? productiveTime : user.productiveTime;
    user.unproductiveTime = typeof unproductiveTime === 'number' ? unproductiveTime : user.unproductiveTime;
    user.lastUpdated = new Date();

    await user.save();

    res.json({
      message: 'Time updated successfully',
      user: {
        email: user.email,
        productiveTime: user.productiveTime,
        unproductiveTime: user.unproductiveTime,
        totalProductiveAllTime: user.totalProductiveAllTime
      }
    });
  } catch (error) {
    console.error('Update time error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user ranking (check if #1)
app.get('/api/ranking/:email', async (req, res) => {
  try {
    const email = String(req.params.email || '').toLowerCase().trim();
    const today = new Date().toDateString();

    const users = await User.find({ today })
      .sort({ productiveTime: -1 })
      .select('email productiveTime hasSeenTopUserNotification')
      .lean();

    if (!users || users.length === 0) {
      return res.json({ rank: 0, total: 0, isTopUser: false });
    }

    const userIndex = users.findIndex(u => String(u.email).toLowerCase() === email);
    if (userIndex === -1) return res.json({ rank: 0, total: users.length, isTopUser: false });

    const rank = userIndex + 1;
    const currentUser = users[userIndex];
    const isTopUser = rank === 1 && (currentUser.productiveTime || 0) > 0;
    const shouldNotify = isTopUser && !currentUser.hasSeenTopUserNotification;

    if (shouldNotify) {
      await User.updateOne({ email }, { $set: { hasSeenTopUserNotification: true } });
    }

    res.json({
      rank,
      total: users.length,
      isTopUser,
      shouldNotify,
      productiveTime: Math.round(currentUser.productiveTime || 0),
      topUser: users[0] ? { productiveTime: Math.round(users[0].productiveTime || 0) } : null
    });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const today = new Date().toDateString();
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const leaderboard = await User.find({ today })
      .sort({ productiveTime: -1 })
      .limit(limit)
      .select('email productiveTime totalProductiveAllTime')
      .lean();

    const maskedLeaderboard = leaderboard.map((user, index) => {
      const emailParts = (user.email || '').split('@');
      const domain = emailParts[1] || '';
      const prefix = (emailParts[0] || '').substring(0, 3);
      return {
        rank: index + 1,
        email: `${prefix || '***'}***@${domain}`,
        productiveTime: Math.round(user.productiveTime || 0),
        totalProductiveAllTime: Math.round(user.totalProductiveAllTime || 0)
      };
    });

    res.json({
      leaderboard: maskedLeaderboard,
      date: today
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset daily stats (called by cron job at midnight) - uses bulkWrite to preserve totals
app.post('/api/reset-daily', async (req, res) => {
  try {
    const today = new Date().toDateString();
    const usersToReset = await User.find({ today: { $ne: today } }).select('productiveTime');

    if (!usersToReset || usersToReset.length === 0) {
      return res.json({ message: 'No users to reset', updated: 0 });
    }

    const bulkOps = usersToReset.map(u => ({
      updateOne: {
        filter: { _id: u._id },
        update: {
          $inc: { totalProductiveAllTime: u.productiveTime || 0 },
          $set: {
            today,
            hasSeenTopUserNotification: false,
            productiveTime: 0,
            unproductiveTime: 0
          }
        }
      }
    }));

    const result = await User.bulkWrite(bulkOps);
    res.json({ message: 'Daily reset complete', updated: result.modifiedCount || 0 });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin endpoint: list users (optionally masked)
// Example: GET /api/users?mask=true
app.get('/api/users', async (req, res) => {
  try {
    const mask = req.query.mask === 'true';
    const users = await User.find({}).select('email productiveTime unproductiveTime totalProductiveAllTime today').lean();

    const out = users.map(u => {
      if (!mask) return u;
      const emailParts = (u.email || '').split('@');
      const domain = emailParts[1] || '';
      const prefix = (emailParts[0] || '').substring(0, 3);
      return {
        ...u,
        email: `${prefix || '***'}***@${domain}`
      };
    });

    res.json({ users: out });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  try {
    await mongoose.connection.close(false);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});