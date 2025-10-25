const state = {
  activeTabId: null,
  startTime: null,
  today: new Date().toDateString(),
  productiveTime: 0,
  unproductiveTime: 0,
  currentCategory: null,
  isYouTubeVideo: false,
  updateInterval: null,
  lastNotificationTime: 0,
  notificationCooldown: 300000,
  timerPaused: false,
  alertsShown: { unproductive: false, halfway: false, fullGoal: false },
  userEmail: null,
  apiUrl: 'http://localhost:3000/api',
  lastSyncTime: 0,
  syncInterval: 30000,
  hasShownTopUserNotification: false
};

// Storage helpers
function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (data) => {
        if (chrome.runtime.lastError) resolve({});
        else resolve(data || {});
      });
    } catch (e) {
      resolve({});
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(obj, () => resolve());
    } catch (e) {
      resolve();
    }
  });
}

// Backend sync
async function syncWithBackend() {
  try {
    if (!state.userEmail) return;
    
    const response = await fetch(`${state.apiUrl}/update-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.userEmail,
        productiveTime: Math.round(state.productiveTime * 100) / 100,
        unproductiveTime: Math.round(state.unproductiveTime * 100) / 100
      })
    });
    
    if (response.ok) {
      console.log('✅ Synced with backend');
      state.lastSyncTime = Date.now();
      await checkUserRanking();
    }
  } catch (error) {
    console.error('❌ Backend sync failed:', error);
  }
}

async function checkUserRanking() {
  if (!state.userEmail) return;
  
  try {
    const response = await fetch(`${state.apiUrl}/ranking/${encodeURIComponent(state.userEmail)}`);
    if (!response.ok) return;
    
    const data = await response.json();
    if (data.shouldNotify && !state.hasShownTopUserNotification) {
      state.hasShownTopUserNotification = true;
      showTopUserNotification();
    }
  } catch (error) {
    console.error('❌ Ranking check failed:', error);
  }
}

function showTopUserNotification() {
  const options = {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '🏆 YOU ARE #1 TODAY!',
    message: 'Congratulations! You are the most productive user today! Keep up the amazing work! 🎉',
    priority: 2
  };
  
  chrome.notifications.create('top-user-notification', options, (id) => {
    if (!chrome.runtime.lastError) {
      setTimeout(() => chrome.notifications.clear(id), 15000);
    }
  });
}

// Timer management
function startTimeUpdate() {
  if (state.updateInterval) clearInterval(state.updateInterval);
  state.startTime = Date.now();
  state.timerPaused = false;
  
  state.updateInterval = setInterval(async () => {
    if (!state.startTime || !state.currentCategory || state.timerPaused) return;
    
    const elapsedMinutes = (Date.now() - state.startTime) / 60000;
    if (state.currentCategory === 'productive') state.productiveTime += elapsedMinutes;
    else if (state.currentCategory === 'unproductive') state.unproductiveTime += elapsedMinutes;
    
    state.startTime = Date.now();
    await saveState();
    await checkTimeAlertsRealtime();
  }, 1000);
}

function stopTimeUpdate() {
  if (state.updateInterval) {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  }
  if (state.startTime && state.currentCategory && !state.timerPaused) {
    const elapsedMinutes = (Date.now() - state.startTime) / 60000;
    if (state.currentCategory === 'productive') state.productiveTime += elapsedMinutes;
    else if (state.currentCategory === 'unproductive') state.unproductiveTime += elapsedMinutes;
    saveState();
  }
  state.currentCategory = null;
  state.startTime = null;
}

// Notifications
function showNotification(title, message) {
  const options = {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2
  };
  
  chrome.notifications.create('mission-focus-' + Date.now(), options, (id) => {
    if (!chrome.runtime.lastError) setTimeout(() => chrome.notifications.clear(id), 10000);
  });
}

// Time alerts
async function checkTimeAlertsRealtime() {
  try {
    const data = await storageGet(['prodLimit', 'unprodLimit']);
    const limits = {
      productive: data.prodLimit || 120,
      unproductive: data.unprodLimit || 30
    };
    
    if (state.currentCategory === 'unproductive' && 
        state.unproductiveTime >= limits.unproductive && 
        !state.alertsShown.unproductive) {
      state.alertsShown.unproductive = true;
      showNotification(
        '⚠️ Unproductive Alert', 
        `You've reached your limit of ${Math.round(limits.unproductive)} minutes. Time to focus!`
      );
    }
    
    if (state.currentCategory === 'productive') {
      const halfGoal = limits.productive * 0.5;
      
      if (state.productiveTime >= halfGoal && !state.alertsShown.halfway) {
        state.alertsShown.halfway = true;
        showNotification(
          '🎉 Halfway There!', 
          `Great job! You're halfway there. Keep going!`
        );
      }
      
      if (state.productiveTime >= limits.productive && !state.alertsShown.fullGoal) {
        state.alertsShown.fullGoal = true;
        showNotification(
          '🏆 Goal Achieved!', 
          `Awesome! You've reached your productivity goal!`
        );
      }
    }
  } catch (err) {
    console.error('Alert check error:', err);
  }
}

// Tab management
function checkTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) {
      state.isYouTubeVideo = false;
      return;
    }

    const isYouTube = tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts');
    state.isYouTubeVideo = isYouTube;
    
    if (isYouTube) {
      state.activeTabId = tabId;
      chrome.tabs.sendMessage(tabId, { action: 'checkVideo' }, (resp) => {
        if (chrome.runtime.lastError) return;
        
        const category = resp?.category;
        if (category === 'productive' || category === 'unproductive') {
          stopTimeUpdate();
          state.currentCategory = category;
          startTimeUpdate();
        } else {
          stopTimeUpdate();
        }
      });
    } else {
      stopTimeUpdate();
    }
  });
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'categorize':
          stopTimeUpdate();
          state.currentCategory = message.category;
          startTimeUpdate();
          sendResponse({ success: true });
          break;

        case 'setUserEmail':
          try {
            const response = await fetch(`${state.apiUrl}/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: message.email })
            });
            
            if (response.ok) {
              state.userEmail = message.email;
              await storageSet({ userEmail: message.email });
              sendResponse({ success: true, data: await response.json() });
            } else {
              const error = await response.json();
              sendResponse({ success: false, error: error.error });
            }
          } catch (error) {
            sendResponse({ success: false, error: 'Connection failed' });
          }
          break;

        case 'getTime':
          sendResponse({
            productiveTime: state.productiveTime,
            unproductiveTime: state.unproductiveTime,
            today: state.today
          });
          break;

        case 'resetTime':
          await handleReset();
          sendResponse({ success: true });
          break;

        default:
          sendResponse(null);
          break;
      }
    } catch (err) {
      console.error('Message handler error:', err);
      sendResponse({ success: false, error: err?.message || 'Unknown error' });
    }
  })();
  return true;
});

// Initialize
async function initializeStorage() {
  try {
    const data = await storageGet(['productiveTime', 'unproductiveTime', 'today', 'userEmail']);
    const currentDate = new Date().toDateString();
    
    state.userEmail = data.userEmail || null;
    
    if (!data?.today || data.today !== currentDate) {
      await handleReset();
    } else {
      state.productiveTime = data.productiveTime || 0;
      state.unproductiveTime = data.unproductiveTime || 0;
      state.today = data.today;
    }

    if (!state.userEmail) {
      chrome.runtime.openOptionsPage();
    }

    setupPeriodicSync();
  } catch (err) {
    console.error('Init error:', err);
  }
}

function setupPeriodicSync() {
  setInterval(async () => {
    if (Date.now() - state.lastSyncTime >= state.syncInterval) {
      await syncWithBackend();
    }
  }, state.syncInterval);
}

// Event listeners
chrome.tabs.onActivated.addListener(info => checkTab(info.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === state.activeTabId && changeInfo.url) checkTab(tabId);
});

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.storage.sync.get(['setupComplete'], data => {
      if (!data.setupComplete) {
        chrome.runtime.openOptionsPage();
        showNotification(
          '🚀 Welcome to Mission Focus!',
          'Please set up your email and productivity goals.'
        );
      }
    });
  }
});

// Start
initializeStorage();