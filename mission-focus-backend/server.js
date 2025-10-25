// server.js - Mission Focus Backend API
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Helper: Format minutes to hh:mm:ss
function formatTime(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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

// Virtual fields for formatted time (for display)
userSchema.virtual('productiveTimeFormatted').get(function() {
  return formatTime(this.productiveTime);
});

userSchema.virtual('unproductiveTimeFormatted').get(function() {
  return formatTime(this.unproductiveTime);
});

// Include virtuals in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

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
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Reset daily stats if new day
      const today = new Date().toDateString();
      if (user.today !== today) {
        user.totalProductiveAllTime += user.productiveTime;
        user.productiveTime = 0;
        user.unproductiveTime = 0;
        user.today = today;
        user.hasSeenTopUserNotification = false;
        await user.save();
      }
      
      console.log('✅ User logged in:', email);
      return res.json({ 
        message: 'Welcome back!', 
        user: {
          email: user.email,
          productiveTime: user.productiveTime,
          productiveTimeFormatted: user.productiveTimeFormatted,
          unproductiveTime: user.unproductiveTime,
          unproductiveTimeFormatted: user.unproductiveTimeFormatted,
          totalProductiveAllTime: user.totalProductiveAllTime
        }
      });
    }
    
    // Create new user
    user = new User({ email });
    await user.save();
    
    console.log('✅ New user registered:', email);
    res.status(201).json({ 
      message: 'User registered successfully!', 
      user: {
        email: user.email,
        productiveTime: 0,
        productiveTimeFormatted: '00:00:00',
        unproductiveTime: 0,
        unproductiveTimeFormatted: '00:00:00',
        totalProductiveAllTime: 0
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user time
app.post('/api/update-time', async (req, res) => {
  try {
    const { email, productiveTime, unproductiveTime } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }
    
    const today = new Date().toDateString();
    
    // Reset if new day
    if (user.today !== today) {
      user.totalProductiveAllTime += user.productiveTime;
      user.productiveTime = 0;
      user.unproductiveTime = 0;
      user.today = today;
      user.hasSeenTopUserNotification = false;
    }
    
    // Update times
    user.productiveTime = productiveTime || 0;
    user.unproductiveTime = unproductiveTime || 0;
    user.lastUpdated = new Date();
    
    await user.save();
    
    console.log(`📊 Updated ${email}: Prod=${formatTime(user.productiveTime)}, Unprod=${formatTime(user.unproductiveTime)}`);
    
    res.json({ 
      message: 'Time updated successfully',
      user: {
        email: user.email,
        productiveTime: user.productiveTime,
        productiveTimeFormatted: user.productiveTimeFormatted,
        unproductiveTime: user.unproductiveTime,
        unproductiveTimeFormatted: user.unproductiveTimeFormatted,
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
    const { email } = req.params;
    const today = new Date().toDateString();
    
    // Get all users for today sorted by productive time (descending)
    const users = await User.find({ 
      today,
      productiveTime: { $gt: 0 } // Only users with productive time > 0
    })
    .sort({ productiveTime: -1 })
    .select('email productiveTime hasSeenTopUserNotification');
    
    console.log(`📊 Total users with productive time today: ${users.length}`);
    
    if (users.length === 0) {
      return res.json({ 
        rank: 0, 
        total: 0, 
        isTopUser: false, 
        shouldNotify: false 
      });
    }
    
    // Find user's rank
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) {
      return res.json({ 
        rank: 0, 
        total: users.length, 
        isTopUser: false, 
        shouldNotify: false 
      });
    }
    
    const currentUser = users[userIndex];
    const rank = userIndex + 1;
    const isTopUser = rank === 1;
    
    // Should notify if:
    // 1. User is #1
    // 2. Has NOT seen notification today
    // 3. Has more than 1 minute of productive time
    const shouldNotify = isTopUser && 
                         !currentUser.hasSeenTopUserNotification && 
                         currentUser.productiveTime >= 1;
    
    console.log(`🏆 ${email}: Rank #${rank}/${users.length}, Prod Time: ${formatTime(currentUser.productiveTime)}, Should Notify: ${shouldNotify}`);
    
    // Mark notification as seen if showing
    if (shouldNotify) {
      await User.updateOne(
        { email },
        { hasSeenTopUserNotification: true }
      );
      console.log(`🔔 Sending #1 notification to ${email}`);
    }
    
    res.json({
      rank,
      total: users.length,
      isTopUser,
      shouldNotify,
      productiveTime: currentUser.productiveTime,
      productiveTimeFormatted: formatTime(currentUser.productiveTime),
      topUser: users[0] ? {
        productiveTime: users[0].productiveTime,
        productiveTimeFormatted: formatTime(users[0].productiveTime)
      } : null
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
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await User.find({ 
      today,
      productiveTime: { $gt: 0 }
    })
    .sort({ productiveTime: -1 })
    .limit(limit)
    .select('email productiveTime totalProductiveAllTime');
    
    // Mask email for privacy
    const maskedLeaderboard = leaderboard.map((user, index) => ({
      rank: index + 1,
      email: user.email.substring(0, 3) + '***@' + user.email.split('@')[1],
      productiveTime: user.productiveTime,
      productiveTimeFormatted: formatTime(user.productiveTime),
      totalProductiveAllTime: user.totalProductiveAllTime,
      totalProductiveAllTimeFormatted: formatTime(user.totalProductiveAllTime)
    }));
    
    res.json({ 
      leaderboard: maskedLeaderboard,
      date: today,
      total: leaderboard.length
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset daily stats (called by cron job at midnight)
app.post('/api/reset-daily', async (req, res) => {
  try {
    const today = new Date().toDateString();
    
    const usersToReset = await User.find({ today: { $ne: today } });
    
    for (const user of usersToReset) {
      user.totalProductiveAllTime += user.productiveTime;
      user.productiveTime = 0;
      user.unproductiveTime = 0;
      user.today = today;
      user.hasSeenTopUserNotification = false;
      await user.save();
    }
    
    console.log(`🔄 Daily reset complete: ${usersToReset.length} users reset`);
    
    res.json({ 
      message: 'Daily reset complete',
      updated: usersToReset.length
    });
    
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 View leaderboard: http://localhost:${PORT}/api/leaderboard`);
});