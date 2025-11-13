/**
 * POPUP.JS
 * Handles extension popup UI interactions
 */

const STORAGE_KEY = 'gemini_timestamps';

// Get references to elements
const countEl = document.getElementById('count');
const sizeEl = document.getElementById('size');
const messageEl = document.getElementById('message');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const clearBtn = document.getElementById('clearBtn');
const fileInput = document.getElementById('fileInput');

// Update status on load
updateStatus();

// Export button
exportBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        // Check if we're on Gemini
        if (!tab.url.includes('gemini.google.com')) {
            showMessage('Please open a Gemini tab first', 'error');
            return;
        }
        
        // Execute export in the page context
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: exportTimestamps
        });
    });
});

// Import button
importBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                
                if (!tab.url.includes('gemini.google.com')) {
                    showMessage('Please open a Gemini tab first', 'error');
                    return;
                }
                
                // Import in page context
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: importTimestamps,
                    args: [imported]
                }, () => {
                    showMessage(`Imported ${Object.keys(imported).length} timestamps!`, 'success');
                    setTimeout(() => {
                        // Reload the Gemini tab
                        chrome.tabs.reload(tab.id);
                    }, 1500);
                });
            });
            
        } catch (err) {
            showMessage('Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    fileInput.value = '';
});

// Clear button
clearBtn.addEventListener('click', () => {
    if (confirm('⚠️ Clear all stored timestamps? This cannot be undone.')) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            
            if (!tab.url.includes('gemini.google.com')) {
                showMessage('Please open a Gemini tab first', 'error');
                return;
            }
            
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: clearTimestamps
            }, () => {
                showMessage('All timestamps cleared', 'success');
                updateStatus();
                setTimeout(() => {
                    chrome.tabs.reload(tab.id);
                }, 1500);
            });
        });
    }
});

// Update status display
function updateStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        if (!tab || !tab.url.includes('gemini.google.com')) {
            countEl.textContent = 'N/A';
            sizeEl.textContent = 'N/A';
            return;
        }
        
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getStorageInfo
        }, (results) => {
            if (results && results[0]) {
                const info = results[0].result;
                countEl.textContent = info.count;
                sizeEl.textContent = info.size;
            }
        });
    });
}

function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type} show`;
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

// Functions to execute in page context
function getStorageInfo() {
    try {
        const data = localStorage.getItem('gemini_timestamps');
        if (!data) return { count: 0, size: '0 KB' };
        
        const parsed = JSON.parse(data);
        const count = Object.keys(parsed).length;
        const bytes = new Blob([data]).size;
        const kb = (bytes / 1024).toFixed(2);
        
        return { count, size: kb + ' KB' };
    } catch (e) {
        return { count: 0, size: '0 KB' };
    }
}

function exportTimestamps() {
    const data = localStorage.getItem('gemini_timestamps');
    if (!data) {
        alert('No timestamps to export');
        return;
    }
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-timestamps-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function importTimestamps(imported) {
    try {
        const existing = JSON.parse(localStorage.getItem('gemini_timestamps') || '{}');
        const merged = { ...existing, ...imported };
        localStorage.setItem('gemini_timestamps', JSON.stringify(merged));
        return true;
    } catch (e) {
        return false;
    }
}

function clearTimestamps() {
    localStorage.removeItem('gemini_timestamps');
}