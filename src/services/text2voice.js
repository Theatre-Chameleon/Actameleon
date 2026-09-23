import { ref } from "vue";

const available = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let wakeLock = null;

let speaking = ref(false);
let autoScrollEnabled = ref(true);

let linesToSpeak = [];
let language = 'ru';
let fallbackLanguages = [];
let resolvedVoice = null;
let voiceResolved = false;
let pauseTimeout = null;
let currentLine = null;

/**
 * Pick the best installed voice for a language, walking the fallback chain.
 *
 * Voice availability differs per device: there is no Belarusian voice on
 * macOS, for example. Without a fallback the browser would silently drop
 * back to its own default, which is often the UI language and reads
 * Cyrillic as nonsense. Trying an exact tag first, then the bare language
 * subtag, then each declared fallback keeps the closest available voice.
 *
 * Returns null when nothing matches, in which case the caller should just
 * set utterance.lang and let the browser decide.
 */
const pickVoice = (lang, fallbacks = []) => {
    const voices = speechSynthesis.getVoices();
    // getVoices() is empty until the list loads; signal "try again later".
    if (!voices.length) return undefined;

    for (const candidate of [lang, ...fallbacks]) {
        if (!candidate) continue;
        const wanted = candidate.toLowerCase();
        const exact = voices.find(v => v.lang && v.lang.toLowerCase() === wanted);
        if (exact) return exact;

        const subtag = wanted.split('-')[0];
        const loose = voices.find(v => v.lang && v.lang.toLowerCase().split('-')[0] === subtag);
        if (loose) return loose;
    }
    return null;
};

/** Resolve once per playback, lazily, since the voice list loads async. */
const currentVoice = () => {
    if (voiceResolved) return resolvedVoice;
    const voice = pickVoice(language, fallbackLanguages);
    if (voice === undefined) return null; // list not ready yet, retry next line
    resolvedVoice = voice;
    voiceResolved = true;
    return resolvedVoice;
};

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

const toggleReading = (script, config, fromScene = null) => {
    if(!available) return;
    if(speaking.value) {
        cancel();
    } else {
        read(script, config, fromScene);
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
        currentLine = null;
        releaseWakeLock();
        speaking.value = false;
        cleanupAutoScroll();
    } else if (entry._skip) {
        // My line: ding, highlight, pause for estimated speaking time, then continue
        currentLine = entry.line;
        playDing();
        selectAndScroll(entry.line);
        const pauseDuration = (entry.line.text || '').length * MS_PER_CHAR * entry._speed;
        pauseTimeout = setTimeout(() => {
            entry.line.selected = false;
            currentLine = null;
            speakNext();
        }, pauseDuration);
    } else {
        const line = entry.line;
        currentLine = line;
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = language;
        const voice = currentVoice();
        if (voice) {
            // Assigning a voice the engine rejects throws, which would abort
            // playback mid-scene. Falling back to lang alone is harmless.
            try {
                utterance.voice = voice;
                utterance.lang = voice.lang;
            } catch {
                resolvedVoice = null;
            }
        }
        utterance.onstart = () => {
            selectAndScroll(line);
        }
        utterance.onend = () => {
            line.selected = false;
            currentLine = null;
            speakNext();
        }
        utterance.onerror = () => {
            line.selected = false;
            currentLine = null;
        }
        speechSynthesis.speak(utterance);
        if(!speaking.value) speaking.value = true;
    }
}

const skipToNext = () => {
    if(!speaking.value) return;
    // Stop current TTS or pause timer
    speechSynthesis.cancel();
    clearTimeout(pauseTimeout);
    if(currentLine) {
        currentLine.selected = false;
        currentLine = null;
    }
    speakNext();
}

const read = (script, config = {}, fromScene = null) => {
    if(available) {
        const skipActors = config.skipMyLines ? config.selectedActors || [] : [];
        const skipSpeed = config.skipSpeed ?? 1;
        let scenes = script.acts
        .filter(act => act.active)
        .flatMap(act => act.scenes)
        .filter(scene => scene.active);
        if (fromScene) {
            const idx = scenes.findIndex(s => s.sceneNumber === fromScene);
            if (idx >= 0) scenes = scenes.slice(idx);
        }
        linesToSpeak = scenes
        .flatMap(scene => scene.lines)
        .filter(line => line.state === 'show' || line.state === 'clue' || line.state === 'highlight')
        .map(line => ({
            line,
            _skip: skipActors.length > 0 && skipActors.includes(line.actor),
            _speed: skipSpeed
        }));
        language = script.language ? script.language : 'ru';
        fallbackLanguages = Array.isArray(script.ttsFallback) ? script.ttsFallback : [];
        resolvedVoice = null;
        voiceResolved = false;

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
        if(currentLine) {
            currentLine.selected = false;
            currentLine = null;
        }
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
    skipToNext,
    read,
    cancel
}
