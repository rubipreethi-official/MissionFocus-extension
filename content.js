/* Content script
   - Performs local keyword matching first.
   - If no keyword match, asks background to run Gemini (background holds API key / proxy).
   - Sends final category back to background ('categorize').
   - NEW: Detects YouTube Shorts
   - NEW: Pause detection with dialog
*/

const CONFIG = {
  selectors: {
    title: [
      'h1.ytd-watch-metadata yt-formatted-string',
      'h1.title.ytd-video-primary-info-renderer yt-formatted-string',
      'yt-formatted-string.style-scope.ytd-watch-metadata',
      '#title h1 yt-formatted-string',
      'h1.title',
      // NEW: Shorts selectors
      'h2.title yt-formatted-string',
      '#shorts-player h2 yt-formatted-string',
      'ytd-reel-video-renderer h2'
    ],
    description: [
      'ytd-text-inline-expander yt-formatted-string',
      '#description-inline-expander yt-formatted-string',
      'yt-formatted-string#content.ytd-text-inline-expander',
      '#description yt-formatted-string',
      '#description',
      // NEW: Shorts description
      'ytd-reel-player-overlay-renderer #description',
      '#shorts-player #description'
    ],
    // NEW: Video element selectors
    video: [
      'video',
      '#movie_player video',
      '.html5-main-video'
    ]
  },
  keywordCategories: {
    programming: ['code','coding','developer','software','javascript','python','java','react','vue','angular','node','api','algorithm','typescript','html','css','database','sql','git','programming','nextjs','next.js'],
    webDevelopment: ['html','css','javascript','react','vue','angular','website','web app','frontend','backend','fullstack','responsive','nextjs','next.js'],
    education: ['learn','tutorial','lesson','course','teach','study','guide','how to','explained','lecture','class']
  },
  checkInterval: 500,
  MAX_CHECK_ATTEMPTS: 20
};

// State
const state = {
  lastProcessedUrl: '',
  isProcessing: false,
  checkAttempts: 0,
  checkInterval: null,
  videoElement: null,
  pauseDialogShown: false
};

// Helpers: promisified chrome APIs
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

function sendMessage(msg, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let done = false;
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        done = true;
        resolve(resp);
      });
    } catch (e) {
      resolve(null);
    }
    setTimeout(() => { if (!done) resolve(null); }, timeoutMs);
  });
}

// DOM helpers
function waitForSelector(selectors, timeout = 2000) {
  return new Promise((resolve) => {
    const sel = selectors.join(', ');
    const el = document.querySelector(sel);
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const found = document.querySelector(sel);
      if (found) {
        obs.disconnect();
        resolve(found);
      }
    });
    obs.observe(document, { subtree: true, childList: true });
    setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
  });
}

// NEW: Pause detection & dialog
function setupVideoMonitoring() {
  const findVideo = setInterval(() => {
    state.videoElement = document.querySelector(CONFIG.selectors.video.join(', '));
    if (state.videoElement) {
      clearInterval(findVideo);
      console.log('📹 Video element found');
      
      // Remove old listeners
      state.videoElement.removeEventListener('pause', handleVideoPause);
      state.videoElement.removeEventListener('play', handleVideoPlay);
      
      // Add new listeners
      state.videoElement.addEventListener('pause', handleVideoPause);
      state.videoElement.addEventListener('play', handleVideoPlay);
    }
  }, 1000);
  
  // Stop searching after 10 seconds
  setTimeout(() => clearInterval(findVideo), 10000);
}

function handleVideoPause() {
  if (state.pauseDialogShown) return;
  
  console.log('⏸️ Video paused');
  state.pauseDialogShown = true;
  
  sendMessage({ action: 'videoPaused' });
  showPauseDialog();
}

function handleVideoPlay() {
  console.log('▶️ Video playing');
  state.pauseDialogShown = false;
  
  sendMessage({ action: 'videoPlaying' });
  removePauseDialog();
}

function showPauseDialog() {
  removePauseDialog();
  
  const dialog = document.createElement('div');
  dialog.id = 'mission-focus-pause-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
      z-index: 999999;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: white;
      text-align: center;
      min-width: 400px;
    ">
      <div style="font-size: 48px; margin-bottom: 15px;">⏸️</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px;">Video Paused</h2>
      <p style="margin: 0 0 25px 0; font-size: 16px; opacity: 0.9;">
        Are you taking a break or still thinking about the content?
      </p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="pause-timer-btn" style="
          padding: 14px 30px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        ">
          ⏸️ Pause Timer
        </button>
        <button id="keep-timer-btn" style="
          padding: 14px 30px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid white;
          border-radius: 10px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          backdrop-filter: blur(10px);
        ">
          💭 Still Thinking
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('pause-timer-btn').onclick = () => {
    sendMessage({ action: 'pauseTimer' });
    removePauseDialog();
  };
  
  document.getElementById('keep-timer-btn').onclick = () => {
    sendMessage({ action: 'keepTimer' });
    removePauseDialog();
  };
}

function removePauseDialog() {
  const dialog = document.getElementById('mission-focus-pause-dialog');
  if (dialog) dialog.remove();
}

// Video extraction
function getVideoInfo() {
  const titleEl = document.querySelector(CONFIG.selectors.title.join(', '));
  const descEl = document.querySelector(CONFIG.selectors.description.join(', '));
  if (!titleEl) return null;
  return {
    title: titleEl.textContent.trim(),
    description: descEl ? descEl.textContent.trim() : ''
  };
}

// Keyword matching fallback/local detection (fast)
function normalizeText(s) { return (s || '').toLowerCase(); }

function getKeywordCategory(videoInfo, focusAreas) {
  const text = normalizeText(videoInfo.title + ' ' + videoInfo.description);
  const focusArray = Array.isArray(focusAreas)
    ? focusAreas.map(s => String(s).toLowerCase())
    : String(focusAreas || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

  // check focus areas explicitly first
  for (const f of focusArray) {
    if (!f) continue;
    if (text.includes(f)) return 'productive';
  }

  // check configured keyword buckets
  for (const bucket of Object.values(CONFIG.keywordCategories)) {
    for (const kw of bucket) {
      if (text.includes(kw)) return 'productive';
    }
  }

  return 'unproductive';
}

// Main flow: local keyword -> background Gemini fallback -> send final categorize
async function processVideo() {
  if (!isValidYouTubeVideo()) return;
  if (document.visibilityState !== 'visible') return;

  const titleEl = await waitForSelector(CONFIG.selectors.title, 1500);
  if (!titleEl) return;

  const videoInfo = getVideoInfo();
  if (!videoInfo) return;

  state.isProcessing = true;
  state.lastProcessedUrl = window.location.href;
  clearInterval(state.checkInterval);
  
  // NEW: Setup pause detection
  setupVideoMonitoring();

  try {
    const data = await storageGet(['focusAreas']);
    const focusAreas = data.focusAreas || null;

    // 1. Local keyword check
    const keywordCategory = getKeywordCategory(videoInfo, focusAreas);
    if (keywordCategory === 'productive') {
      await sendMessage({ action: 'categorize', category: 'productive' });
      console.log('Content: keyword -> productive');
      return;
    }

    // 2. If keywords didn't match, ask background to use Gemini (fallback)
    const bgResp = await sendMessage({ action: 'classifyWithGemini', videoInfo, focusAreas }, 7000);
    if (bgResp && (bgResp.category === 'productive' || bgResp.category === 'unproductive')) {
      await sendMessage({ action: 'categorize', category: bgResp.category });
      console.log('Content: background Gemini ->', bgResp.category);
      return;
    }

    // 3. Final fallback: local unproductive
    await sendMessage({ action: 'categorize', category: 'unproductive' });
    console.log('Content: final fallback -> unproductive');

  } catch (err) {
    console.warn('Content processing error:', err && err.message ? err.message : err);
    await sendMessage({ action: 'categorize', category: 'unproductive' });
  } finally {
    state.isProcessing = false;
  }
}

// Quick check handler used by background's checkTab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg && msg.action === 'checkVideo') {
      const videoInfo = getVideoInfo();
      const data = await storageGet(['focusAreas']);
      const focusAreas = data.focusAreas || null;
      const category = videoInfo ? getKeywordCategory(videoInfo, focusAreas) : null;
      sendResponse({ category });
    }
  })();
  return true;
});

// URL change detection & polling
function isValidYouTubeVideo() {
  // NEW: Support both /watch and /shorts
  return (window.location.href.includes('youtube.com/watch') || window.location.href.includes('youtube.com/shorts')) &&
         !state.isProcessing &&
         window.location.href !== state.lastProcessedUrl;
}

function resetState() {
  state.lastProcessedUrl = '';
  state.isProcessing = false;
  state.checkAttempts = 0;
  state.pauseDialogShown = false;
}

function startVideoCheck() {
  if (state.checkInterval) clearInterval(state.checkInterval);
  state.checkInterval = setInterval(() => {
    if (state.checkAttempts >= CONFIG.MAX_CHECK_ATTEMPTS) {
      clearInterval(state.checkInterval);
      return;
    }
    state.checkAttempts++;
    processVideo();
  }, CONFIG.checkInterval);
}

function setupUrlChangeDetection() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // NEW: Support both /watch and /shorts
      if (currentUrl.includes('youtube.com/watch') || currentUrl.includes('youtube.com/shorts')) {
        resetState();
        startVideoCheck();
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

// init
console.log('Content: mission-focus loaded (keywords first, Gemini fallback, pause detection, shorts support).');
setupUrlChangeDetection();
startVideoCheck();