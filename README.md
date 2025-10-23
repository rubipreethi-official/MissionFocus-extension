Hello! This is Rubi Preethi... We all at sometime experienced the situation when we really wanted to watch something productive on Youtube but ended up scrolling mindlessly or watching other videos of no relevance.... That's why I thought of building this chrome extension... This will be much useful for those who wish to spend their time productively! Start using your time productively with this extension!! Hope it will be helpful:) 


# 📊 Mission Focus - YouTube Productivity Tracker

A Chrome extension that intelligently tracks your YouTube viewing time and categorizes videos as productive or unproductive using AI.

---

## 🎯 Features

✅ **Real-Time Timer** - Updates every second while watching videos  
✅ **AI-Powered Categorization** - Uses Google Gemini API to intelligently classify videos  
✅ **Smart Keyword Fallback** - Enhanced keyword matching with related terms  
✅ **Custom Focus Areas** - Define what's productive for YOU  
✅ **Smart Notifications** - Alerts with 5-minute cooldown to prevent spam  
✅ **Daily Reset** - Automatically resets at midnight  
✅ **Progress Tracking** - Visual progress bars for goals  
✅ **Next.js Recognition** - Recognizes related technologies (Next.js → Programming)

---

## 📁 File Structure

```
mission-focus/
├── manifest.json       # Extension configuration
├── background.js       # Time tracking & notifications
├── content.js          # Video detection & categorization
├── popup.html          # Extension popup UI
├── popup.js            # Popup functionality
├── options.html        # Settings page UI
├── options.js          # Settings page logic
└── README.md           # This file
```

---

## 🚀 Installation

### Step 1: Download All Files

Create a folder named `mission-focus` and save these files:
- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- `popup.js`
- `options.html`
- `options.js`

### Step 2: Get Gemini API Key (Optional but Recommended)

1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)
4. Open `content.js` and replace line 6:
   ```javascript
   const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
   ```

**Note:** Extension works without API key using enhanced keyword matching!

### Step 3: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select your `mission-focus` folder
5. Extension icon should appear in toolbar

### Step 4: Configure Settings

1. Settings page opens automatically
2. Enter focus areas (e.g., "programming, web development, coding")
3. Set productive goal (e.g., 02:00:00 for 2 hours)
4. Set unproductive limit (e.g., 00:30:00 for 30 minutes)
5. Click **"Save & Start Tracking"**

---

## 🧪 Testing the Extension

### Test 1: Unproductive Video (2 minutes)

```
1. Search YouTube: "funny cats compilation"
2. Open any video
3. Press F12 to open console
4. Look for: "✅ Video detected"
5. Should see: "🔍 Keyword classified as: UNPRODUCTIVE"
6. Click extension icon
7. Watch "Unproductive Time" increment every second
8. Should show: 00:00:01, 00:00:02, 00:00:03...
```

### Test 2: Productive Video (2 minutes)

```
1. Search YouTube: "next.js tutorial" or "react course"
2. Open any video
3. Check console for: "PRODUCTIVE"
4. Click extension icon
5. "Productive Time" should increment
6. "Unproductive Time" should STOP
```

### Test 3: Notifications (1 minute)

```
1. Set unproductive limit to 00:00:30 (30 seconds)
2. Watch unproductive video for 30+ seconds
3. Should see notification: "⚠️ Unproductive Alert"
4. Notification auto-dismisses in 10 seconds
5. Won't show again for 5 minutes (cooldown)
```

### Test 4: Reset Button (30 seconds)

```
1. Let some time accumulate
2. Click extension icon
3. Click "🔄 Reset Today's Stats"
4. Click OK
5. Both timers reset to 00:00:00
```

---

## 📊 What You Should See

### In YouTube Console (F12):
```
🎬 Mission Focus: Content script loaded
✅ Video detected: Next.js Full Tutorial...
🤖 Asking Gemini AI...
✅ Gemini says: PRODUCTIVE
📤 Sent: productive
```

### In Background Console (Service Worker):
```
📊 Loaded - Productive: 0.00 min | Unproductive: 0.00 min
✅ Categorized as: PRODUCTIVE
⏱️ Timer started for: PRODUCTIVE
```

### In Extension Popup:
```
✅ Productive Time: 00:02:15
⏰ Unproductive Time: 00:00:45
[Progress bars filling]
```

---

## 🎯 Smart Detection Examples

The extension recognizes related terms automatically:

### Focus Area: "programming"

**PRODUCTIVE:**
- "Next.js 14 Tutorial" ✅ (Next.js is a framework)
- "React Hooks Explained" ✅ (React is programming)
- "JavaScript for Beginners" ✅ (Direct match)
- "Building REST APIs with Node" ✅ (Node.js is programming)
- "Git Tutorial for Beginners" ✅ (Git is development tool)

**UNPRODUCTIVE:**
- "Funny Cat Compilation" ❌
- "Music Video - Top Hits" ❌
- "Daily Vlog" ❌

### Focus Area: "fitness"

**PRODUCTIVE:**
- "Full Body Workout Routine" ✅
- "Gym Training Tips" ✅
- "Yoga for Beginners" ✅

---

## 🔧 Troubleshooting

### Timer Not Incrementing

**Problem:** Timer stuck at 00:00:00

**Solutions:**
1. Check if video was detected (F12 console)
2. Reload extension: `chrome://extensions/` → Click refresh
3. Close and reopen YouTube tab
4. Check Service Worker console for errors

### Wrong Categorization

**Problem:** Videos categorized incorrectly

**Solutions:**
1. Update focus areas to be more specific
2. Add related keywords: "programming, coding, javascript, react, nextjs"
3. Get Gemini API key for better AI classification

### Notifications Spamming

**Fixed!** Now has 5-minute cooldown between notifications

**If still having issues:**
1. Check Chrome notification settings
2. Notifications auto-dismiss after 10 seconds

### Gemini API Errors

**Don't worry!** Extension has enhanced keyword matching fallback

**To fix:**
1. Get new API key from https://aistudio.google.com/app/apikey
2. Update `content.js` line 6
3. Reload extension

---

## 🔑 Related Terms Dictionary

The extension automatically recognizes these related terms:

**Programming:**
- code, coding, javascript, python, java, react, vue, angular
- nextjs, next.js, typescript, node, nodejs, api, algorithm
- html, css, web dev, frontend, backend, database, git

**Fitness:**
- workout, exercise, gym, training, cardio, yoga, strength
- bodybuilding, weightlifting, running, diet

**Cooking:**
- recipe, food, kitchen, chef, bake, meal, cuisine

**Education:**
- learn, tutorial, lesson, course, teach, study, guide

**Business:**
- startup, entrepreneur, marketing, sales, finance, investment

---

## ⚙️ Configuration Tips

### Focus Areas Examples

**For Developers:**
```
programming, coding, javascript, python, react, nextjs, web development, software engineering
```

**For Students:**
```
education, study, tutorial, mathematics, science, learning, course
```

**For Fitness Enthusiasts:**
```
fitness, workout, exercise, gym, health, training, nutrition
```

### Time Settings

**Productive Goal:**
- Light user: 01:00:00 (1 hour)
- Moderate: 02:00:00 (2 hours)
- Heavy: 04:00:00 (4 hours)

**Unproductive Limit:**
- Strict: 00:15:00 (15 minutes)
- Moderate: 00:30:00 (30 minutes)
- Relaxed: 01:00:00 (1 hour)

---

## 🐛 Debug Commands

Open Chrome console and paste:

```javascript
// Check current storage
chrome.storage.sync.get(null, console.log)

// Get current time from background
chrome.runtime.sendMessage({action: 'getTime'}, console.log)

// Force reset
chrome.runtime.sendMessage({action: 'resetTime'}, console.log)

// Manual storage reset
chrome.storage.sync.set({productiveTime: 0, unproductiveTime: 0})
```

---

## ✅ Success Checklist

After installation, verify:

- [ ] Extension loads without errors
- [ ] Settings page opens and saves successfully
- [ ] YouTube video detection works (check console)
- [ ] Timer increments every second in popup
- [ ] Categorization shows in console (PRODUCTIVE/UNPRODUCTIVE)
- [ ] Notifications appear at limits
- [ ] Notifications auto-dismiss
- [ ] Reset button clears stats
- [ ] Next.js videos detected as PRODUCTIVE (if focus: programming)
- [ ] Progress bars fill correctly

---

## 📝 Known Behaviors

✅ **Timer only runs on YouTube video pages** (`youtube.com/watch`)  
✅ **Timer stops when switching tabs** (preserves time)  
✅ **Auto-resets daily** at midnight  
✅ **Notifications have 5-minute cooldown** (prevents spam)  
✅ **Works offline** with keyword matching  

---

## 🎉 What's Fixed

| Issue | Status | Solution |
|-------|--------|----------|
| Timer not updating | ✅ FIXED | Real-time 1-second intervals |
| Notification spam | ✅ FIXED | 5-minute cooldown + auto-dismiss |
| Wrong categorization | ✅ FIXED | Enhanced keywords + better AI |
| Next.js not detected | ✅ FIXED | Related terms dictionary |
| Storage errors | ✅ FIXED | Safe initialization |
| Reset not working | ✅ FIXED | Proper message handling |

---

## 📞 Support

If something isn't working:

1. Check the **Service Worker console** (`chrome://extensions/` → Service Worker)
2. Check the **YouTube console** (F12)
3. Try **reloading the extension**
4. Try **clearing storage** and reconfiguring
(copy of main branch //safer side ku)
---

## 🚀 You're All Set!

The extension is now ready to help you stay productive. Good luck with your focused work! 💪

**Remember:** The goal is awareness, not restriction. Use the data to make better choices! 🎯
