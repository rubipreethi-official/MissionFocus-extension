const GEMINI_API_KEY = 'AIzaSyCyns8VZjW2W1j7Bt-CA8JETY9b_m1m964';

let isProcessing = false;
let lastProcessedUrl = '';
let checkAttempts = 0;
const MAX_CHECK_ATTEMPTS = 20;
let checkInterval = null;

console.log('🎬 Mission Focus: Content script loaded');



function startChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  checkAttempts = 0;
  
  checkInterval = setInterval(() => {
    if (checkAttempts >= MAX_CHECK_ATTEMPTS) {
      clearInterval(checkInterval);
      console.log('⏹️ Max check attempts reached');
      return;
    }
    
    if (!isProcessing && window.location.href !== lastProcessedUrl) {
      checkAttempts++;
      getVideoInfo();
    }
  }, 500); 
}

function getVideoInfo() {
  
  if (!window.location.href.includes('youtube.com/watch')) {
    return;
  }
  
  if (isProcessing || window.location.href === lastProcessedUrl) {
    return;
  }
  
  
  const titleEl = document.querySelector(
    'h1.ytd-watch-metadata yt-formatted-string, ' +
    'h1.title.ytd-video-primary-info-renderer yt-formatted-string, ' +
    'yt-formatted-string.style-scope.ytd-watch-metadata, ' +
    '#title h1 yt-formatted-string'
  );
  
  
  const descEl = document.querySelector(
    'ytd-text-inline-expander yt-formatted-string, ' +
    '#description-inline-expander yt-formatted-string, ' +
    'yt-formatted-string#content.ytd-text-inline-expander, ' +
    '#description yt-formatted-string'
  );
  
  if (titleEl) {
    isProcessing = true;
    lastProcessedUrl = window.location.href;
    
    
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    
    const title = titleEl.textContent.trim();
    const description = descEl ? descEl.textContent.trim() : '';
    
    console.log('✅ Video detected:', title.substring(0, 50) + '...');
    
    
    chrome.storage.sync.get(['focusAreas'], async (data) => {
      if (!data.focusAreas) {
        console.log('⚠️ No focus areas set - marking as unproductive');
        sendCategorization('unproductive');
        isProcessing = false;
        return;
      }
      
      await categorizeWithGemini(title, description, data.focusAreas);
      isProcessing = false;
    });
  }
}



async function categorizeWithGemini(title, description, focusAreas) {
  const prompt = `You are a productivity assistant helping users stay focused.

USER'S FOCUS AREAS: ${focusAreas}

Analyze this YouTube video and determine if it's PRODUCTIVE for learning these topics.

VIDEO TITLE: ${title}
VIDEO DESCRIPTION: ${description.substring(0, 1000)}

CATEGORIZATION RULES:
1. PRODUCTIVE: Educational content, tutorials, courses, documentaries, skill-building that relates to ANY focus area
   - "Next.js Tutorial" = PRODUCTIVE if focus includes "programming" (Next.js is a web framework)
   - "React Hooks Guide" = PRODUCTIVE if focus includes "web development"
   - "Gym Workout Routine" = PRODUCTIVE if focus includes "fitness"
   - "Python for Beginners" = PRODUCTIVE if focus includes "programming, coding"

2. UNPRODUCTIVE: Entertainment, music videos, comedy, vlogs, gaming, random content unrelated to focus areas

Think broadly: if the video teaches something related to the focus areas, it's PRODUCTIVE.

Respond with ONLY ONE WORD: "productive" or "unproductive"`;

  try {
    console.log('🤖 Asking Gemini AI...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
            topP: 0.8,
            topK: 10
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }
    
    let responseText = data.candidates[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || '';
    
    
    const category = responseText.includes('productive') && !responseText.includes('unproductive')
      ? 'productive'
      : 'unproductive';
    
    console.log(`✅ Gemini says: ${category.toUpperCase()}`);
    sendCategorization(category);
    
  } catch (error) {
    console.error('❌ Gemini failed:', error.message);
    console.log('🔍 Using keyword matching instead...');
    enhancedKeywordMatch(title, description, focusAreas);
  }
}



function enhancedKeywordMatch(title, description, focusAreas) {
  const areas = focusAreas.toLowerCase().split(',').map(a => a.trim());
  const videoText = (title + ' ' + description).toLowerCase();
  
 
  const relatedTerms = {
    'programming': [
      'code', 'coding', 'developer', 'software', 'javascript', 'python', 'java', 
      'react', 'vue', 'angular', 'node', 'nodejs', 'api', 'algorithm', 'nextjs', 
      'next.js', 'typescript', 'html', 'css', 'web dev', 'frontend', 'backend',
      'database', 'sql', 'mongodb', 'git', 'github', 'programming'
    ],
    'web development': [
      'html', 'css', 'javascript', 'react', 'vue', 'angular', 'nextjs', 'next.js',
      'website', 'web app', 'frontend', 'backend', 'fullstack', 'responsive'
    ],
    'fitness': [
      'workout', 'exercise', 'gym', 'health', 'training', 'muscle', 'cardio',
      'yoga', 'strength', 'bodybuilding', 'weightlifting', 'running', 'diet'
    ],
    'cooking': [
      'recipe', 'food', 'kitchen', 'chef', 'bake', 'baking', 'meal', 'cook',
      'cuisine', 'dish', 'ingredient'
    ],
    'education': [
      'learn', 'tutorial', 'lesson', 'course', 'teach', 'study', 'guide',
      'how to', 'explained', 'lecture', 'class'
    ],
    'business': [
      'startup', 'entrepreneur', 'marketing', 'sales', 'finance', 'money',
      'investment', 'business', 'strategy', 'management'
    ],
    'coding': [
      'code', 'coding', 'programming', 'developer', 'software', 'algorithm',
      'debug', 'javascript', 'python', 'java'
    ]
  };
  
  let isProductive = false;
  
 
  for (const area of areas) {
    if (videoText.includes(area)) {
      console.log(`📌 Direct match: "${area}"`);
      isProductive = true;
      break;
    }
    
    
    if (relatedTerms[area]) {
      for (const term of relatedTerms[area]) {
        if (videoText.includes(term)) {
          console.log(`📌 Related match: "${term}" for "${area}"`);
          isProductive = true;
          break;
        }
      }
    }
    
    if (isProductive) break;
  }
  
  const category = isProductive ? 'productive' : 'unproductive';
  console.log(`🔍 Keyword result: ${category.toUpperCase()}`);
  sendCategorization(category);
}



function sendCategorization(category) {
  chrome.runtime.sendMessage(
    { action: 'categorize', category: category },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Send error:', chrome.runtime.lastError.message);
      } else {
        console.log(`📤 Sent: ${category}`);
      }
    }
  );
}



let lastUrl = location.href;

new MutationObserver(() => {
  const currentUrl = location.href;
  
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    if (currentUrl.includes('youtube.com/watch')) {
      lastProcessedUrl = '';
      isProcessing = false;
      console.log('🔄 New video URL detected');
      startChecking();
    }
  }
}).observe(document, { subtree: true, childList: true });

// ============================================
// START CHECKING ON LOAD
// ============================================

startChecking();