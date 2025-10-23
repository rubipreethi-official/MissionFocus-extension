let activeTabId = null;
let startTime = null;
let today = new Date().toDateString();
let productiveTime = 0;
let unproductiveTime = 0;
let currentCategory = null;
let isYouTubeVideo = false;
let updateInterval = null;
let lastNotificationTime = 0;
let notificationCooldown = 300000; // 5 minutes in milliseconds



function initializeStorage() {
  chrome.storage.sync.get(['productiveTime', 'unproductiveTime', 'today'], (data) => {
    const currentDate = new Date().toDateString();
    
    if (!data || data.today !== currentDate) {
     
      productiveTime = 0;
      unproductiveTime = 0;
      today = currentDate;
      chrome.storage.sync.set({ 
        productiveTime: 0, 
        unproductiveTime: 0, 
        today: currentDate 
      });
      console.log('📅 New day - Reset times');
    } else {
      productiveTime = data.productiveTime || 0;
      unproductiveTime = data.unproductiveTime || 0;
      today = data.today;
      console.log('📊 Loaded - Productive:', productiveTime.toFixed(2), 'min | Unproductive:', unproductiveTime.toFixed(2), 'min');
    }
    
    setupAlarm();
  });
}

initializeStorage();


function startTimeUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  console.log('⏱️ Timer started for:', currentCategory?.toUpperCase());
  
  updateInterval = setInterval(() => {
    if (startTime && currentCategory) {
      const elapsed = (Date.now() - startTime) / 60000; 
      
      if (currentCategory === 'productive') {
        productiveTime += elapsed;
      } else if (currentCategory === 'unproductive') {
        unproductiveTime += elapsed;
      }
      
      startTime = Date.now(); 
      saveTime();
    }
  }, 1000); 
}

function stopTimeUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  
  
  if (startTime && currentCategory) {
    const elapsed = (Date.now() - startTime) / 60000;
    if (currentCategory === 'productive') {
      productiveTime += elapsed;
    } else if (currentCategory === 'unproductive') {
      unproductiveTime += elapsed;
    }
    saveTime();
  }
  
  currentCategory = null;
  startTime = null;
  console.log('⏹️ Timer stopped');
}

function saveTime() {
  chrome.storage.sync.set({ 
    productiveTime, 
    unproductiveTime, 
    today 
  });
}



chrome.tabs.onActivated.addListener((activeInfo) => {
  stopTimeUpdate();
  activeTabId = activeInfo.tabId;
  checkTab(activeTabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    stopTimeUpdate();
    isYouTubeVideo = changeInfo.url.includes('youtube.com/watch');
    
    if (isYouTubeVideo) {
      console.log('🎬 YouTube video page detected');
    } else {
      console.log('📍 Not on YouTube video');
    }
  }
});

function checkTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }
    
    isYouTubeVideo = tab.url?.includes('youtube.com/watch');
    
    if (!isYouTubeVideo) {
      stopTimeUpdate();
    }
  });
}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'categorize') {
      handleCategorization(message);
      sendResponse({ success: true });
    } 
    else if (message.action === 'getTime') {
      sendResponse({
        productiveTime: productiveTime,
        unproductiveTime: unproductiveTime,
        today: today
      });
    } 
    else if (message.action === 'resetTime') {
      handleReset();
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('❌ Message error:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; 
});

function handleCategorization(message) {
  stopTimeUpdate(); 
  
  currentCategory = message.category;
  startTime = Date.now();
  
  console.log('✅ Categorized as:', currentCategory.toUpperCase());
  
  startTimeUpdate(); 
  checkAlerts(message.category);
}

function handleReset() {
  stopTimeUpdate();
  productiveTime = 0;
  unproductiveTime = 0;
  today = new Date().toDateString();
  saveTime();
  lastNotificationTime = 0;
  console.log('🔄 Times reset to 00:00:00');
}



async function checkAlerts(category) {
  const now = Date.now();
  
 
  if (now - lastNotificationTime < notificationCooldown) {
    console.log('🔕 Notification on cooldown');
    return;
  }
  
  chrome.storage.sync.get(['prodLimit', 'unprodLimit'], async (data) => {
    const prodLimit = data.prodLimit || 120;
    const unprodLimit = data.unprodLimit || 30;
    
    let shouldNotify = false;
    let title = '';
    let message = '';

    
    if (category === 'unproductive' && unproductiveTime >= unprodLimit) {
      shouldNotify = true;
      title = '⚠️ Unproductive Alert';
      message = `You've spent ${Math.round(unproductiveTime)} minutes on unproductive content. Time to focus!`;
    } 
    
    else if (category === 'productive') {
      const halfGoal = prodLimit * 0.5;
      const fullGoal = prodLimit;
      
      
      if (productiveTime >= halfGoal && productiveTime < (halfGoal + 0.05)) {
        shouldNotify = true;
        title = '🎉 Halfway There!';
        message = `Great job! You're at ${Math.round(productiveTime)} minutes. Keep it up!`;
      } 
      
      else if (productiveTime >= fullGoal && productiveTime < (fullGoal + 0.05)) {
        shouldNotify = true;
        title = '🏆 Goal Achieved!';
        message = `Awesome! You've reached your ${Math.round(prodLimit)}-minute goal!`;
      }
    }
    
    if (shouldNotify) {
      lastNotificationTime = now;
      await showNotification(title, message);
    }
  });
}

async function showNotification(title, message) {
  try {
    const notificationOptions = {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      title: title,
      message: message,
      priority: 2,
      requireInteraction: false
    };
    
    await chrome.notifications.create('mission-focus-alert', notificationOptions);
    
    console.log('🔔 Notification shown:', title);
    
   
    setTimeout(() => {
      chrome.notifications.clear('mission-focus-alert');
    }, 10000);
    
  } catch (error) {
    console.error('❌ Notification error:', error);
  }
}



chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.get(['setupComplete'], (data) => {
      if (!data.setupComplete) {
        chrome.runtime.openOptionsPage();
      }
    });
  }
});



function setupAlarm() {
  chrome.alarms.create('dailyCheck', { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyCheck') {
    
    const currentDate = new Date().toDateString();
    if (currentDate !== today) {
      console.log('📅 New day detected - resetting');
      handleReset();
    }
    

    if (startTime && currentCategory) {
      saveTime();
    }
  }
});