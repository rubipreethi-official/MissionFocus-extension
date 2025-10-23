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
  notificationCooldown: 300000 // 5 minutes
};

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

async function initializeStorage() {
  try {
    const data = await storageGet(['productiveTime', 'unproductiveTime', 'today']);
    const currentDate = new Date().toDateString();
    if (!data || data.today !== currentDate) {
      await storageSet({ productiveTime: 0, unproductiveTime: 0, today: currentDate });
      state.productiveTime = 0;
      state.unproductiveTime = 0;
      state.today = currentDate;
    } else {
      state.productiveTime = data.productiveTime || 0;
      state.unproductiveTime = data.unproductiveTime || 0;
      state.today = data.today || currentDate;
    }
    setupAlarm();
  } catch (err) {
    console.error('Storage init error:', err);
  }
}

async function saveState() {
  try {
    await storageSet({
      productiveTime: state.productiveTime,
      unproductiveTime: state.unproductiveTime,
      today: state.today
    });
  } catch (err) {
    console.error('Save state error:', err);
  }
}

function startTimeUpdate() {
  if (state.updateInterval) clearInterval(state.updateInterval);
  state.startTime = Date.now();
  state.updateInterval = setInterval(async () => {
    if (!state.startTime || !state.currentCategory) return;
    const elapsedMinutes = (Date.now() - state.startTime) / 60000;
    if (state.currentCategory === 'productive') state.productiveTime += elapsedMinutes;
    else if (state.currentCategory === 'unproductive') state.unproductiveTime += elapsedMinutes;
    state.startTime = Date.now();
    await saveState();
    await checkTimeAlerts(state.currentCategory);
  }, 1000);
}

function stopTimeUpdate() {
  if (state.updateInterval) {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  }
  if (state.startTime && state.currentCategory) {
    const elapsedMinutes = (Date.now() - state.startTime) / 60000;
    if (state.currentCategory === 'productive') state.productiveTime += elapsedMinutes;
    else if (state.currentCategory === 'unproductive') state.unproductiveTime += elapsedMinutes;
    saveState();
  }
  state.currentCategory = null;
  state.startTime = null;
}

function showNotification(title, message) {
  try {
    const options = {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 2
    };
    chrome.notifications.create('mission-focus-' + Date.now(), options, (id) => {
      if (!chrome.runtime.lastError) setTimeout(() => chrome.notifications.clear(id), 8000);
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

async function checkTimeAlerts(category) {
  const now = Date.now();
  if (now - state.lastNotificationTime < state.notificationCooldown) return;
  try {
    const data = await storageGet(['prodLimit', 'unprodLimit']);
    const limits = {
      productive: data.prodLimit || 120,
      unproductive: data.unprodLimit || 30
    };
    let notification = null;
    if (category === 'unproductive' && state.unproductiveTime >= limits.unproductive) {
      notification = { title: '⚠️ Time Alert', message: `You've spent ${Math.round(state.unproductiveTime)} minutes on distractions.` };
    } else if (category === 'productive') {
      const progress = (state.productiveTime / limits.productive) * 100;
      if (progress >= 100) notification = { title: '🏆 Goal Complete!', message: `You've reached your ${limits.productive}-minute productivity goal!` };
      else if (progress >= 50 && progress < 51) notification = { title: '🎯 Halfway!', message: `You're halfway to your ${limits.productive}-minute goal.` };
    }
    if (notification) {
      state.lastNotificationTime = now;
      showNotification(notification.title, notification.message);
    }
  } catch (err) {
    console.error('checkTimeAlerts error:', err);
  }
}

function checkTab(tabId) {
  try {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab || !tab.url) {
        state.isYouTubeVideo = false;
        return;
      }
      const url = tab.url;
      if (url.includes('youtube.com/watch')) {
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    console.warn('classifyWithGeminiProxy error:', err && err.name ? err.name : err);
    return null;
  }
}

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
          {
            const result = await classifyWithGeminiProxy(message.videoInfo, message.focusAreas);
            sendResponse(result || null);
          }
          break;
        case 'getTime':
          sendResponse({ productiveTime: state.productiveTime, unproductiveTime: state.unproductiveTime, today: state.today });
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
      console.error('Message handling error:', err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
  })();
  return true;
});

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
  await saveState();
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  state.activeTabId = activeInfo.tabId;
  checkTab(activeInfo.tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === state.activeTabId && changeInfo.url) checkTab(tabId);
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.get(['setupComplete'], (data) => {
      if (!data.setupComplete) {
        chrome.runtime.openOptionsPage();
        showNotification('🚀 Welcome to Mission Focus!', 'Click to set up your productivity goals and preferences.');
      }
    });
  }
});

initializeStorage();