
function formatTime(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}


function updateDisplay() {
 
  chrome.runtime.sendMessage({ action: 'getTime' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      
      chrome.storage.sync.get(
        ['productiveTime', 'unproductiveTime', 'today', 'prodLimit', 'unprodLimit'], 
        (data) => {
          displayTimes(data);
        }
      );
    } else {
      
      chrome.storage.sync.get(['prodLimit', 'unprodLimit'], (limits) => {
        displayTimes({
          productiveTime: response.productiveTime,
          unproductiveTime: response.unproductiveTime,
          today: response.today,
          prodLimit: limits.prodLimit,
          unprodLimit: limits.unprodLimit
        });
      });
    }
  });
}


function displayTimes(data) {
  const today = new Date().toDateString();
  
  let prodTime = 0;
  let unprodTime = 0;
  
  
  if (data.today === today) {
    prodTime = data.productiveTime || 0;
    unprodTime = data.unproductiveTime || 0;
  }
  
  const prodLimit = data.prodLimit || 120;
  const unprodLimit = data.unprodLimit || 30;
  
 
  document.getElementById('prodTime').textContent = formatTime(prodTime);
  document.getElementById('unprodTime').textContent = formatTime(unprodTime);
  
  
  document.getElementById('prodLimit').textContent = `Goal: ${formatTime(prodLimit)}`;
  document.getElementById('unprodLimit').textContent = `Limit: ${formatTime(unprodLimit)}`;
  
  
  const prodProgress = Math.min((prodTime / prodLimit) * 100, 100);
  const unprodProgress = Math.min((unprodTime / unprodLimit) * 100, 100);
  
  document.getElementById('prodProgress').style.width = prodProgress + '%';
  document.getElementById('unprodProgress').style.width = unprodProgress + '%';
}



document.addEventListener('DOMContentLoaded', () => {
  
  updateDisplay();
  
  
  setInterval(updateDisplay, 500);
  
  
  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
 
  document.getElementById('resetTime').addEventListener('click', () => {
    if (confirm('⚠️ Are you sure you want to reset today\'s statistics?\n\nThis will set both timers back to 00:00:00.')) {
      
      chrome.runtime.sendMessage({ action: 'resetTime' }, (response) => {
        if (response && response.success) {
          updateDisplay();
          alert('✅ Statistics reset successfully!');
        } else {
          
          chrome.storage.sync.set({
            productiveTime: 0,
            unproductiveTime: 0,
            today: new Date().toDateString()
          }, () => {
            updateDisplay();
            alert('✅ Statistics reset successfully!');
          });
        }
      });
    }
  });
});