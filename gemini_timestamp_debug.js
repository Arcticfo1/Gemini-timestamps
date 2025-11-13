/**
 * GEMINI TIMESTAMP DEBUGGER
 * 
 * Run this in the browser console while on gemini.google.com
 * It will intercept the next API call and show you EXACTLY where
 * the timestamp is in the response structure.
 * 
 * Usage:
 * 1. Open gemini.google.com
 * 2. Open browser console (F12)
 * 3. Paste this entire script and press Enter
 * 4. Send a message in Gemini
 * 5. Check the console output for timestamp locations
 */

console.log('🔍 Gemini Timestamp Debugger loaded');
console.log('📝 Send a message in Gemini to capture the response...');

// Store original fetch
const originalFetch = window.fetch;

// Flag to only debug once
let debugCaptured = false;

// Hook fetch
window.fetch = async function(...args) {
    const [url] = args;
    
    if (!debugCaptured && url && typeof url === 'string' && url.includes('StreamGenerate')) {
        console.log('🎯 Captured StreamGenerate request!');
        debugCaptured = true;
        
        try {
            const response = await originalFetch.apply(this, args);
            const clonedResponse = response.clone();
            
            // Process in background
            analyzeResponse(clonedResponse);
            
            return response;
        } catch (error) {
            console.error('❌ Error:', error);
            return originalFetch.apply(this, args);
        }
    }
    
    return originalFetch.apply(this, args);
};

async function analyzeResponse(response) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🔬 ANALYZING GEMINI API RESPONSE');
    console.log('═══════════════════════════════════════════════════\n');
    
    const responseText = await response.text();
    const lines = responseText.split('\n');
    
    console.log(`📊 Total lines in response: ${lines.length}`);
    
    let lineNumber = 0;
    const timestampLocations = [];
    
    for (const line of lines) {
        lineNumber++;
        
        if (!line.startsWith('[["wrb.fr"')) continue;
        
        try {
            const json = JSON.parse(line);
            const innerDataString = json[0][2];
            
            if (!innerDataString) continue;
            
            const innerData = JSON.parse(innerDataString);
            
            console.log(`\n🔍 LINE ${lineNumber} - Parsed Structure:`);
            console.log('─────────────────────────────────────────────────');
            
            // Show top-level array structure
            console.log('📦 Top-level keys:', Object.keys(innerData));
            console.log('📏 Array length:', Array.isArray(innerData) ? innerData.length : 'N/A');
            
            // Scan for timestamps
            scanForTimestamps(innerData, [], timestampLocations, lineNumber);
            
            // Show interesting sections
            if (innerData[1]) {
                console.log('\n🆔 innerData[1] (Chat ID area):', 
                    JSON.stringify(innerData[1], null, 2).substring(0, 300));
            }
            
            if (innerData[0]) {
                console.log('\n📋 innerData[0] (Metadata area):', 
                    JSON.stringify(innerData[0], null, 2).substring(0, 300));
            }
            
            if (innerData[4]) {
                console.log('\n💬 innerData[4] (Response content area):', 
                    JSON.stringify(innerData[4], null, 2).substring(0, 300));
            }
            
        } catch (e) {
            console.log(`⚠️ Line ${lineNumber}: Parse error (${e.message})`);
        }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📍 TIMESTAMP LOCATIONS FOUND');
    console.log('═══════════════════════════════════════════════════\n');
    
    if (timestampLocations.length === 0) {
        console.log('❌ No timestamps detected in response');
        console.log('\n💡 Suggestions:');
        console.log('   1. The timestamp might be in a different format');
        console.log('   2. Try looking at the raw response above');
        console.log('   3. Check if timestamps appear in a different API call');
    } else {
        timestampLocations.forEach((loc, i) => {
            console.log(`✅ Location ${i + 1}:`);
            console.log(`   Path: innerData${loc.path}`);
            console.log(`   Value: ${loc.value}`);
            console.log(`   Formatted: ${formatDate(loc.value)}`);
            console.log(`   Type: ${loc.type}`);
            console.log(`   Line: ${loc.line}`);
            console.log('');
        });
        
        console.log('📋 Copy-paste these paths into your timestamp extractor:');
        timestampLocations.forEach((loc, i) => {
            console.log(`   // Path ${i + 1}: innerData${loc.path}`);
        });
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Restore original fetch
    window.fetch = originalFetch;
    console.log('🔄 Debugger uninstalled. Refresh page if you want to run again.');
}

function scanForTimestamps(obj, path, results, lineNumber, depth = 0) {
    if (depth > 10) return; // Prevent infinite recursion
    
    // Check if current value is a timestamp
    const timestampInfo = checkTimestamp(obj);
    if (timestampInfo) {
        results.push({
            path: path.join(''),
            value: obj,
            type: timestampInfo.type,
            formatted: timestampInfo.formatted,
            line: lineNumber
        });
    }
    
    // Recurse into arrays
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            scanForTimestamps(item, [...path, `[${index}]`], results, lineNumber, depth + 1);
        });
    }
    // Recurse into objects
    else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
            scanForTimestamps(value, [...path, `["${key}"]`], results, lineNumber, depth + 1);
        });
    }
}

function checkTimestamp(value) {
    // Check for Unix timestamp (seconds)
    if (typeof value === 'number' && value > 1000000000 && value < 10000000000) {
        const date = new Date(value * 1000);
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
            return {
                type: 'Unix timestamp (seconds)',
                formatted: date.toISOString()
            };
        }
    }
    
    // Check for Unix timestamp (milliseconds)
    if (typeof value === 'number' && value > 1000000000000 && value < 10000000000000) {
        const date = new Date(value);
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
            return {
                type: 'Unix timestamp (milliseconds)',
                formatted: date.toISOString()
            };
        }
    }
    
    // Check for ISO 8601 string
    if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
            return {
                type: 'ISO 8601 string',
                formatted: date.toISOString()
            };
        }
    }
    
    return null;
}

function formatDate(value) {
    let date;
    
    if (typeof value === 'number') {
        date = new Date(value > 10000000000 ? value : value * 1000);
    } else if (typeof value === 'string') {
        date = new Date(value);
    } else {
        return 'Invalid';
    }
    
    if (isNaN(date.getTime())) return 'Invalid';
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = n => n.toString().padStart(2, '0');
    
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Countdown to remind user
let countdown = 30;
const reminder = setInterval(() => {
    if (debugCaptured) {
        clearInterval(reminder);
        return;
    }
    
    countdown--;
    if (countdown === 0) {
        console.log('⏰ Reminder: Send a message in Gemini to capture timestamp data!');
        countdown = 30;
    }
}, 1000);

console.log('\n💡 TIP: After capturing, check the browser DevTools Network tab');
console.log('   Filter by "StreamGenerate" to see the raw response\n');