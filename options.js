

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save');
  const status = document.getElementById('status');

  
  
  chrome.storage.sync.get(['focusAreas', 'prodLimit', 'unprodLimit'], (data) => {
   
    document.getElementById('focusAreas').value = data.focusAreas || '';

    
    const toTime = (minutes) => {
      const totalSeconds = Math.round((minutes || 0) * 60);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      return { hrs, mins, secs };
    };

    
    const prod = toTime(data.prodLimit || 120);
    const unprod = toTime(data.unprodLimit || 30);

    
    document.getElementById('prodHours').value = prod.hrs;
    document.getElementById('prodMinutes').value = prod.mins;
    document.getElementById('prodSeconds').value = prod.secs;

    
    document.getElementById('unprodHours').value = unprod.hrs;
    document.getElementById('unprodMinutes').value = unprod.mins;
    document.getElementById('unprodSeconds').value = unprod.secs;
  });

  
  
  saveBtn.addEventListener('click', () => {
    const focusAreas = document.getElementById('focusAreas').value.trim();

    
    const prodHours = parseInt(document.getElementById('prodHours').value) || 0;
    const prodMinutes = parseInt(document.getElementById('prodMinutes').value) || 0;
    const prodSeconds = parseInt(document.getElementById('prodSeconds').value) || 0;

    const unprodHours = parseInt(document.getElementById('unprodHours').value) || 0;
    const unprodMinutes = parseInt(document.getElementById('unprodMinutes').value) || 0;
    const unprodSeconds = parseInt(document.getElementById('unprodSeconds').value) || 0;

    
    
    if (!focusAreas) {
      return showStatus('⚠️ Please enter at least one focus area.', 'error');
    }

   
    const prodLimit = prodHours * 60 + prodMinutes + prodSeconds / 60;
    const unprodLimit = unprodHours * 60 + unprodMinutes + unprodSeconds / 60;

    if (prodLimit <= 0) {
      return showStatus('⚠️ Productive goal must be greater than 0.', 'error');
    }
    
    if (unprodLimit <= 0) {
      return showStatus('⚠️ Unproductive limit must be greater than 0.', 'error');
    }

   
    
    chrome.storage.sync.set({
      focusAreas: focusAreas,
      prodLimit: prodLimit,
      unprodLimit: unprodLimit,
      setupComplete: true
    }, () => {
      showStatus('✅ Settings saved successfully! Reloading extension...', 'success');
      
      
      setTimeout(() => {
        chrome.runtime.reload();
      }, 1500);
    });
  });

 
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'show ' + type;
    
    
    if (type === 'error') {
      setTimeout(() => {
        status.className = '';
      }, 4000);
    }
  }
});