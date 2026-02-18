import { ref } from "vue";

const available = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let wakeLock = null;

let speaking = ref(false);
let autoScrollEnabled = ref(true);

let linesToSpeak = [];
let language = 'ru';
let pauseTimeout = null;

// Estimated speaking time: ~80ms per character for Russian
const MS_PER_CHAR = 80;

// Create a ding sound using Web Audio API
const playDing = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        // Silently fail if audio context is not available
    }
};

// Auto-scroll state
let currentLineElement = null;
let lineObserver = null;
let isScrollingProgrammatically = false;
let scrollTimeout = null;

// Scroll padding from top of viewport (in pixels)
const SCROLL_PADDING_TOP = 100;

// Find line element by checking which element has line-selected class
const findCurrentLineElement = () => {
    return document.querySelector('.line-selected');
};

// Scroll to element with padding from top
const scrollToLine = (element) => {
    if (!element || !autoScrollEnabled.value) return;

    isScrollingProgrammatically = true;

    const elementRect = element.getBoundingClientRect();
    const targetScrollY = window.scrollY + elementRect.top - SCROLL_PADDING_TOP;

    window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
    });

    // Reset programmatic scroll flag after animation completes
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isScrollingProgrammatically = false;
    }, 500); // Smooth scroll typically takes ~300-500ms
};

// Handle manual scroll - disable auto-scroll
const handleScroll = () => {
    if (isScrollingProgrammatically || !speaking.value) return;
    autoScrollEnabled.value = false;
};

// Setup IntersectionObserver for current line
const setupLineObserver = (element) => {
    // Clean up previous observer
    if (lineObserver) {
        lineObserver.disconnect();
    }

    if (!element) return;

    currentLineElement = element;

    lineObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // If line becomes visible and auto-scroll was disabled, re-enable it
            if (entry.isIntersecting && !autoScrollEnabled.value && speaking.value) {
                autoScrollEnabled.value = true;
            }
        });
    }, {
        threshold: 0.5, // Consider visible when 50% in view
        rootMargin: '0px'
    });

    lineObserver.observe(element);
};

// Start listening to scroll events
const startScrollListener = () => {
    window.addEventListener('scroll', handleScroll, { passive: true });
};

// Stop listening to scroll events
const stopScrollListener = () => {
    window.removeEventListener('scroll', handleScroll);
};

// Cleanup all auto-scroll resources
const cleanupAutoScroll = () => {
    if (lineObserver) {
        lineObserver.disconnect();
        lineObserver = null;
    }
    currentLineElement = null;
    stopScrollListener();
    clearTimeout(scrollTimeout);
    isScrollingProgrammatically = false;
};

const requestWakeLock = async () => {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
        console.log('Wake lock was released');
        });
        console.log('Wake lock is active');
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
};

const releaseWakeLock = () => {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
    }
};

const toggleReading = (script, config) => {
    if(!available) return;
    if(speaking.value) {
        cancel();
    } else {
        read(script, config);
    }
}

const selectAndScroll = (line) => {
    line.selected = true;
    requestAnimationFrame(() => {
        const lineElement = findCurrentLineElement();
        if (lineElement) {
            setupLineObserver(lineElement);
            scrollToLine(lineElement);
        }
    });
};

const speakNext = () => {
    const entry = linesToSpeak.shift();
    if(typeof entry === 'undefined' || !speaking.value) {
        releaseWakeLock();
        speaking.value = false;
        cleanupAutoScroll();
    } else if (entry._skip) {
        // My line: ding, highlight, pause for estimated speaking time, then continue
        playDing();
        selectAndScroll(entry.line);
        const pauseDuration = (entry.line.text || '').length * MS_PER_CHAR * entry._speed;
        pauseTimeout = setTimeout(() => {
            entry.line.selected = false;
            speakNext();
        }, pauseDuration);
    } else {
        const line = entry.line;
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = language;
        utterance.onstart = () => {
            selectAndScroll(line);
        }
        utterance.onend = () => {
            line.selected = false;
            speakNext();
        }
        utterance.onerror = () => {
            line.selected = false;
        }
        speechSynthesis.speak(utterance);
        if(!speaking.value) speaking.value = true;
    }
}

const read = (script, config = {}) => {
    if(available) {
        const skipActors = config.skipMyLines ? config.selectedActors || [] : [];
        const skipSpeed = config.skipSpeed ?? 1;
        linesToSpeak = script.acts
        .filter(act => act.active)
        .flatMap(act => act.scenes)
        .filter(scene => scene.active)
        .flatMap(scene => scene.lines)
        .filter(line => line.state === 'show' || line.state === 'clue' || line.state === 'highlight')
        .map(line => ({
            line,
            _skip: skipActors.length > 0 && skipActors.includes(line.actor),
            _speed: skipSpeed
        }));
        language = script.language ? script.language : 'ru';

        // Initialize auto-scroll
        autoScrollEnabled.value = true;
        startScrollListener();

        speaking.value = true;
        requestWakeLock();
        speakNext();
    }
};

const cancel = () => {
    if(available) {
        speechSynthesis.cancel();
        clearTimeout(pauseTimeout);
        speaking.value = false;
        releaseWakeLock();
        cleanupAutoScroll();
    }
};


export default {
    available,
    speaking,
    autoScrollEnabled,
    toggleReading,
    read,
    cancel
}
