document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save');
  const status = document.getElementById('status');
  const emailInput = document.getElementById('userEmail');

  // Load saved settings
  chrome.storage.sync.get(['focusAreas', 'prodLimit', 'unprodLimit', 'userEmail'], (data) => {
    // Load email
    emailInput.value = data.userEmail || '';
    
    // Load focus areas
    document.getElementById('focusAreas').value = data.focusAreas || '';

    // Time conversion helper
    const toTime = (minutes) => {
      const totalSeconds = Math.round((minutes || 0) * 60);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      return { hrs, mins, secs };
    };

    // Load time limits
    const prod = toTime(data.prodLimit || 120);
    const unprod = toTime(data.unprodLimit || 30);

    // Set productive time fields
    document.getElementById('prodHours').value = prod.hrs;
    document.getElementById('prodMinutes').value = prod.mins;
    document.getElementById('prodSeconds').value = prod.secs;

    // Set unproductive time fields
    document.getElementById('unprodHours').value = unprod.hrs;
    document.getElementById('unprodMinutes').value = unprod.mins;
    document.getElementById('unprodSeconds').value = unprod.secs;
  });

  // Save button handler
  saveBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const focusAreas = document.getElementById('focusAreas').value.trim();

    // Get time values
    const prodHours = parseInt(document.getElementById('prodHours').value) || 0;
    const prodMinutes = parseInt(document.getElementById('prodMinutes').value) || 0;
    const prodSeconds = parseInt(document.getElementById('prodSeconds').value) || 0;

    const unprodHours = parseInt(document.getElementById('unprodHours').value) || 0;
    const unprodMinutes = parseInt(document.getElementById('unprodMinutes').value) || 0;
    const unprodSeconds = parseInt(document.getElementById('unprodSeconds').value) || 0;

    // Validate email
    if (!email) {
      return showStatus('⚠️ Please enter your email address.', 'error');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return showStatus('⚠️ Please enter a valid email address.', 'error');
    }

    // Validate focus areas
    if (!focusAreas) {
      return showStatus('⚠️ Please enter at least one focus area.', 'error');
    }

    // Calculate time limits in minutes
    const prodLimit = prodHours * 60 + prodMinutes + prodSeconds / 60;
    const unprodLimit = unprodHours * 60 + unprodMinutes + unprodSeconds / 60;

    if (prodLimit <= 0) {
      return showStatus('⚠️ Productive goal must be greater than 0.', 'error');
    }
    if (unprodLimit <= 0) {
      return showStatus('⚠️ Unproductive limit must be greater than 0.', 'error');
    }

    try {
      // First register/update user with backend
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        return showStatus(`⚠️ ${error.error || 'Failed to register email'}`, 'error');
      }

      // If backend registration successful, save to storage
      chrome.storage.sync.set({
        userEmail: email,
        focusAreas: focusAreas,
        prodLimit: prodLimit,
        unprodLimit: unprodLimit,
        setupComplete: true
      }, () => {
        // Notify background script about email update
        chrome.runtime.sendMessage({ 
          action: 'setUserEmail', 
          email: email 
        }, (response) => {
          if (response && response.success) {
            showStatus('✅ Settings saved successfully! Reloading extension...', 'success');
            setTimeout(() => {
              chrome.runtime.reload();
            }, 1500);
          } else {
            showStatus('⚠️ Saved locally but sync failed. Please try again.', 'error');
          }
        });
      });
    } catch (error) {
      console.error('Save error:', error);
      showStatus('⚠️ Network error. Please check your connection.', 'error');
    }
  });

  // Status message helper
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