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
  hasShownTopUserNotification: false,
  lastRankCheckTime: 0,
  rankCheckInterval: 60000 // Check ranking every 1 minute
};

// ---------------- STORAGE HELPERS ----------------

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

// ---------------- BACKEND SYNC ----------------

async function syncWithBackend() {
  try {
    if (!state.userEmail) return;
    
    const response = await fetch(`${state.apiUrl}/update-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.userEmail,
        productiveTime: state.productiveTime,
        unproductiveTime: state.unproductiveTime
      })
    });
    
    if (response.ok) {
      console.log('✅ Synced with backend');
      state.lastSyncTime = Date.now();
      
      // Check ranking after sync
      if (Date.now() - state.lastRankCheckTime >= state.rankCheckInterval) {
        await checkUserRanking();
        state.lastRankCheckTime = Date.now();
      }
    }
  } catch (error) {
    console.error('❌ Backend sync failed:', error);
  }
}

async function checkUserRanking() {
  try {
    if (!state.userEmail) return;
    
    const response = await fetch(`${state.apiUrl}/ranking/${encodeURIComponent(state.userEmail)}`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`📊 Ranking: #${data.rank}/${data.total}, Should notify: ${data.shouldNotify}`);
      
      if (data.shouldNotify && !state.hasShownTopUserNotification) {
        state.hasShownTopUserNotification = true;
        showTopUserNotification(data);
      }
    }
  } catch (error) {
    console.error('❌ Ranking check failed:', error);
  }
}

function showTopUserNotification(rankData) {
  try {
    const options = {
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '🏆 YOU ARE #1 TODAY!',
      message: `Congratulations! You are the most productive user today with ${rankData.productiveTimeFormatted}! Keep up the amazing work! 🎉`,
      priority: 2,
      requireInteraction: false
    };
    
    chrome.notifications.create('top-user-notification', options, (id) => {
      if (!chrome.runtime.lastError) {
        console.log('🏆 Top user notification shown!');
        setTimeout(() => chrome.notifications.clear(id), 15000);
      }
    });
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// ---------------- INITIALIZATION ----------------

async function initializeStorage() {
  try {
    const data = await storageGet(['productiveTime', 'unproductiveTime', 'today', 'userEmail']);
    const currentDate = new Date().toDateString();
    
    state.userEmail = data.userEmail || null;
    
    if (!data || data.today !== currentDate) {
      await storageSet({ productiveTime: 0, unproductiveTime: 0, today: currentDate });
      state.productiveTime = 0;
      state.unproductiveTime = 0;
      state.today = currentDate;
      state.alertsShown = { unproductive: false, halfway: false, fullGoal: false };
      state.hasShownTopUserNotification = false;
      
      if (state.userEmail) {
        await syncWithBackend();
      }
    } else {
      state.productiveTime = data.productiveTime || 0;
      state.unproductiveTime = data.unproductiveTime || 0;
      state.today = data.today || currentDate;
    }
    
    if (!state.userEmail) {
      chrome.runtime.openOptionsPage();
    }
    
    setupAlarm();
    setupPeriodicSync();
  } catch (err) {
    console.error('Storage init error:', err);
  }
}

function setupPeriodicSync() {
  setInterval(async () => {
    if (Date.now() - state.lastSyncTime >= state.syncInterval) {
      await syncWithBackend();
    }
  }, 30000);
}

async function saveState() {
  try {
    await storageSet({
      productiveTime: state.productiveTime,
      unproductiveTime: state.unproductiveTime,
      today: state.today
    });
    
    if (Date.now() - state.lastSyncTime >= state.syncInterval) {
      await syncWithBackend();
    }
  } catch (err) {
    console.error('Save state error:', err);
  }
}

// ---------------- TIME TRACKING ----------------

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

// ---------------- NOTIFICATIONS ----------------

function showNotification(title, message) {
  try {
    const options = {
      type: 'basic',
      iconUrl: 'icon128.png',
      title,
      message,
      priority: 2,
      requireInteraction: false
    };
    chrome.notifications.create('mission-focus-' + Date.now(), options, (id) => {
      if (!chrome.runtime.lastError) {
        console.log('🔔 Notification shown:', title);
        setTimeout(() => chrome.notifications.clear(id), 10000);
      }
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

async function checkTimeAlertsRealtime() {
  try {
    const data = await storageGet(['prodLimit', 'unprodLimit']);
    const limits = {
      productive: data.prodLimit || 120,
      unproductive: data.unprodLimit || 30
    };
    
    // Unproductive alert
    if (state.currentCategory === 'unproductive' && 
        state.unproductiveTime >= limits.unproductive && 
        !state.alertsShown.unproductive) {
      state.alertsShown.unproductive = true;
      showNotification(
        '⚠️ Unproductive Alert', 
        `You've reached your limit of ${Math.round(limits.unproductive)} minutes. Time to focus!`
      );
    }
    
    // Productive milestones
    if (state.currentCategory === 'productive') {
      const halfGoal = limits.productive * 0.5;
      
      if (state.productiveTime >= halfGoal && !state.alertsShown.halfway) {
        state.alertsShown.halfway = true;
        showNotification(
          '🎉 Halfway There!', 
          `Great job! You're at ${Math.round(state.productiveTime)} minutes. Keep going!`
        );
      }
      
      if (state.productiveTime >= limits.productive && !state.alertsShown.fullGoal) {
        state.alertsShown.fullGoal = true;
        showNotification(
          '🏆 Goal Achieved!', 
          `Awesome! You've reached your ${Math.round(limits.productive)}-minute goal!`
        );
      }
    }
  } catch (err) {
    console.error('checkTimeAlertsRealtime error:', err);
  }
}

// ---------------- TAB & GEMINI CLASSIFICATION ----------------

function checkTab(tabId) {
  try {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab || !tab.url) {
        state.isYouTubeVideo = false;
        return;
      }
      const url = tab.url;
      if (url.includes('youtube.com/watch') || url.includes('youtube.com/shorts')) {
        state.isYouTubeVideo = true;
        state.activeTabId = tabId;
        chrome.tabs.sendMessage(tabId, { action: 'checkVideo' }, (resp) => {
          if (chrome.runtime.lastError) return;
          const category = resp?.category;
          if (category === 'productive' || category === 'unproductive') {
            stopTimeUpdate();
            state.currentCategory = category;
            startTimeUpdate();
          } else stopTimeUpdate();
        });
      } else {
        state.isYouTubeVideo = false;
        stopTimeUpdate();
      }
    });
  } catch (err) {
    console.error('checkTab error:', err);
  }
}

async function classifyWithGeminiProxy(videoInfo, focusAreas) {
  try {
    const cfg = await storageGet(['geminiApiKey']);
    const apiKey = cfg?.geminiApiKey || '';
    if (!apiKey) return null;
    const prompt = `
Analyze whether this YouTube video matches the user's focus areas: ${Array.isArray(focusAreas) ? focusAreas.join(', ') : focusAreas}
VIDEO TITLE: ${videoInfo.title}
VIDEO DESCRIPTION: ${videoInfo.description.substring(0, 500)}
Rules:
- Reply ONLY with the single word "productive" if content matches ANY focus area.
- Reply ONLY with the single word "unproductive" otherwise.
Return only that one word.
`.trim();

    const controller = new AbortController();
    const TIMEOUT_MS = 8000;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 40 }
        })
      }
    ).catch(() => { clearTimeout(timer); return null; });
    clearTimeout(timer);
    if (!resp || !resp.ok) return null;
    const data = await resp.json().catch(() => null);
    const respText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.output?.[0]?.content?.text ||
      data?.response ||
      '';
    const normalized = String(respText || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'productive') return { category: 'productive' };
    if (normalized === 'unproductive') return { category: 'unproductive' };
    if (normalized.includes('productive') && !normalized.includes('unproductive')) return { category: 'productive' };
    if (normalized.includes('unproductive') && !normalized.includes('productive')) return { category: 'unproductive' };
    return null;
  } catch (err) {
    console.warn('classifyWithGeminiProxy error:', err);
    return null;
  }
}

// ---------------- MESSAGE HANDLER ----------------

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

        case 'classifyWithGemini':
          const result = await classifyWithGeminiProxy(message.videoInfo, message.focusAreas);
          sendResponse(result || null);
          break;

        case 'getTime':
          sendResponse({ productiveTime: state.productiveTime, unproductiveTime: state.unproductiveTime, today: state.today });
          break;

        case 'resetTime':
          await handleReset();
          sendResponse({ success: true });
          break;

        case 'videoPaused':
          state.timerPaused = true;
          sendResponse({ success: true });
          break;

        case 'videoPlaying':
          state.timerPaused = false;
          state.startTime = Date.now();
          sendResponse({ success: true });
          break;

        case 'pauseTimer':
          state.timerPaused = true;
          if (state.startTime && state.currentCategory) {
            const elapsed = (Date.now() - state.startTime) / 60000;
            if (state.currentCategory === 'productive') state.productiveTime += elapsed;
            else if (state.currentCategory === 'unproductive') state.unproductiveTime += elapsed;
            await saveState();
          }
          sendResponse({ success: true });
          break;

        case 'keepTimer':
          state.timerPaused = false;
          state.startTime = Date.now();
          sendResponse({ success: true });
          break;

        case 'setUserEmail':
          const { email } = message;
          try {
            const response = await fetch(`${state.apiUrl}/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            if (response.ok) {
              const data = await response.json();
              state.userEmail = email;
              await storageSet({ userEmail: email });
              sendResponse({ success: true, data });
            } else {
              const error = await response.json();
              sendResponse({ success: false, error: error.error });
            }
          } catch {
            sendResponse({ success: false, error: 'Backend connection failed' });
          }
          break;

        case 'getLeaderboard':
          try {
            const response = await fetch(`${state.apiUrl}/leaderboard?limit=10`);
            if (response.ok) {
              const data = await response.json();
              sendResponse({ success: true, data });
            } else {
              sendResponse({ success: false, error: 'Failed to fetch leaderboard' });
            }
          } catch {
            sendResponse({ success: false, error: 'Network error' });
          }
          break;

        default:
          sendResponse(null);
          break;
      }
    } catch (err) {
      console.error('Message handling error:', err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
  })();
  return true;
});

// ---------------- DAILY RESET ----------------

function setupAlarm() {
  chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    const currentDate = new Date().toDateString();
    if (currentDate !== state.today) handleReset();
  }
});

async function handleReset() {
  stopTimeUpdate();
  state.productiveTime = 0;
  state.unproductiveTime = 0;
  state.today = new Date().toDateString();
  state.lastNotificationTime = 0;
  state.timerPaused = false;
  state.alertsShown = { unproductive: false, halfway: false, fullGoal: false };
  state.hasShownTopUserNotification = false;
  await saveState();
  
  if (state.userEmail) {
    await syncWithBackend();
  }
}

// ---------------- TAB LISTENERS ----------------

chrome.tabs.onActivated.addListener((activeInfo) => {
  state.activeTabId = activeInfo.tabId;
  checkTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === state.activeTabId && changeInfo.url) checkTab(tabId);
});

// ---------------- ON INSTALL ----------------

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.get(['setupComplete'], (data) => {
      if (!data.setupComplete) {
        chrome.runtime.openOptionsPage();
        showNotification('🚀 Welcome to Mission Focus!', 'Please set up your email and productivity goals.');
      }
    });
  }
});

initializeStorage();
