/**
 * GEMINI_INTERCEPTOR.JS (PERSISTENT TIMESTAMPS)
 * Stores timestamps in localStorage, keyed by response ID
 */

(function() {
    console.log('🚀 Gemini Persistent Timestamp Tracker Loading...');

    const STORAGE_KEY = 'gemini_timestamps';
    const responseCreationTimes = new WeakMap();

    // =======================
    // 1. STORAGE HELPERS
    // =======================
    function getStoredTimestamps() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('❌ Error reading timestamps:', e);
            return {};
        }
    }

    function saveTimestamp(responseId, timestamp) {
        try {
            const timestamps = getStoredTimestamps();
            timestamps[responseId] = timestamp.toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
            console.log('💾 Saved timestamp:', responseId, '→', timestamp.toLocaleString());
        } catch (e) {
            console.error('❌ Error saving timestamp:', e);
        }
    }

    function getTimestamp(responseId) {
        const timestamps = getStoredTimestamps();
        if (timestamps[responseId]) {
            return new Date(timestamps[responseId]);
        }
        return null;
    }

    // =======================
    // 2. EXTRACT UNIQUE RESPONSE ID
    // =======================
    function getResponseId(modelResponse) {
        // Try multiple methods to get a unique ID
        
        // Method 1: Check jslog for response ID
        const container = modelResponse.querySelector('[jslog]');
        if (container) {
            const jslog = container.getAttribute('jslog');
            // Look for r_XXXXX pattern (response ID)
            const match = jslog.match(/r_([a-f0-9]+)/);
            if (match) {
                return 'r_' + match[1];
            }
            
            // Also try c_XXXXX pattern (conversation turn ID)
            const cmatch = jslog.match(/c_([a-f0-9]+)/);
            if (cmatch) {
                return 'c_' + cmatch[1];
            }
        }

        // Method 2: Check data-ved attribute
        if (container && container.hasAttribute('data-ved')) {
            const ved = container.getAttribute('data-ved');
            if (ved) {
                return 'ved_' + ved;
            }
        }

        // Method 3: Check for any unique ID attributes
        if (modelResponse.id) {
            return 'id_' + modelResponse.id;
        }

        // Method 4: Use a hash of the content (last resort)
        const text = modelResponse.textContent.trim();
        if (text.length > 0) {
            const hash = simpleHash(text.substring(0, 200));
            return 'hash_' + hash;
        }

        console.warn('⚠️ Could not determine response ID');
        return null;
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // =======================
    // 3. INTERCEPT ELEMENT CREATION
    // =======================
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.apply(this, arguments);
        
        if (tagName.toLowerCase() === 'model-response') {
            const creationTime = new Date();
            responseCreationTimes.set(element, creationTime);
            console.log('🆕 model-response created at:', creationTime.toLocaleString());
        }
        
        return element;
    };

    // =======================
    // 4. HANDLE RESPONSES
    // =======================
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'MODEL-RESPONSE') {
                        // Small delay to let jslog attributes load
                        setTimeout(() => handleResponse(node), 100);
                    }
                    
                    const responses = node.querySelectorAll && node.querySelectorAll('model-response');
                    if (responses && responses.length > 0) {
                        responses.forEach(r => setTimeout(() => handleResponse(r), 100));
                    }
                }
            }
        }
    });

    function handleResponse(modelResponse) {
        // Skip if already processed
        if (modelResponse.querySelector('.gemini-ts-badge')) {
            return;
        }

        console.log('════════════════════════════════════════');
        console.log('📍 Processing Response');
        
        // Get unique ID
        const responseId = getResponseId(modelResponse);
        if (!responseId) {
            console.log('⚠️ Could not get response ID, using current time');
            injectTimestamp(modelResponse, new Date());
            console.log('════════════════════════════════════════\n');
            return;
        }

        console.log('🔑 Response ID:', responseId);

        // Check if we have a stored timestamp
        let timestamp = getTimestamp(responseId);
        
        if (timestamp) {
            console.log('📅 Found stored timestamp:', timestamp.toLocaleString());
        } else {
            // Check if we captured creation time
            timestamp = responseCreationTimes.get(modelResponse);
            
            if (timestamp) {
                console.log('📅 Using creation time:', timestamp.toLocaleString());
            } else {
                // New response we haven't seen before
                timestamp = new Date();
                console.log('📅 Using current time (new response):', timestamp.toLocaleString());
            }
            
            // Save for future
            saveTimestamp(responseId, timestamp);
        }

        // Inject timestamp
        injectTimestamp(modelResponse, timestamp);
        
        console.log('════════════════════════════════════════\n');
    }

    // =======================
    // 5. INJECT TIMESTAMP
    // =======================
    function injectTimestamp(modelResponse, timestamp) {
        const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const fullString = `${dateStr} • ${timeStr}`;

        const badge = document.createElement('div');
        badge.className = 'gemini-ts-badge';
        badge.style.cssText = `
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
            font-family: 'Google Sans', sans-serif;
            opacity: 0.8;
        `;
        badge.textContent = `🕐 ${fullString}`;
        badge.title = `Timestamp: ${timestamp.toISOString()}`;

        const container = modelResponse.querySelector('response-container');
        if (container) {
            container.prepend(badge);
        } else {
            modelResponse.prepend(badge);
        }

        console.log('✅ Timestamp injected:', fullString);
    }

    // =======================
    // 6. INITIALIZE
    // =======================
    function init() {
        console.log('🎬 Persistent Timestamp Tracker Initialized');
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('👁️ Watching for model-response elements...');
        
        // Handle existing responses
        setTimeout(() => {
            const existing = document.querySelectorAll('model-response');
            if (existing.length > 0) {
                console.log(`🔍 Found ${existing.length} existing response(s)`);
                existing.forEach(r => handleResponse(r));
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ Persistent Timestamp Tracker Active');
    console.log('📌 Timestamps stored in localStorage by response ID');
    console.log('💡 Click extension icon to manage timestamps');
})();