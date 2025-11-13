/**
 * CONTENT_LOADER.JS
 * Bridges the gap between Extension and Page Context.
 */
const s = document.createElement('script');
s.src = chrome.runtime.getURL('gemini_interceptor.js');
s.onload = function() {
    this.remove(); // Clean up the DOM
};
(document.head || document.documentElement).appendChild(s);

console.log('🔌 Gemini Timestamp Loader: Injection Complete');