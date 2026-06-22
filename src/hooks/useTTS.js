// src/hooks/useTTS.js
// Text-to-Speech hook using the native Web Speech API
// Each agent has a unique voice configuration (pitch, rate, voice preference)

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice profiles per agent — tuned for personality distinction
 * pitch: 0.1–2.0 (1 = default)
 * rate: 0.1–10.0 (1 = default)
 * gender: 'male' | 'female' — used to select appropriate voice
 * voiceKeywords: preferred voice name substrings to match (pt-BR)
 */

// Known male pt-BR voice names across browsers/OS
const MALE_VOICE_NAMES = [
  'felipe', 'ricardo', 'jorge', 'rafael', 'male', 'masculin',
  'diego', 'antonio', 'carlos', 'paulo', 'marcos', 'daniel', 'rodrigo'
];
// Known female pt-BR voice names across browsers/OS
const FEMALE_VOICE_NAMES = [
  'luciana', 'fernanda', 'francisca', 'female', 'femin',
  'vitoria', 'maria', 'ana', 'helena', 'camila', 'joana', 'soraia', 'raquel'
];

const AGENT_VOICE_PROFILES = {
  oscar: {
    pitch: 0.75,
    rate: 0.85,
    volume: 0.9,
    gender: 'male',
    voiceKeywords: ['Daniel', 'Ricardo', 'Jorge', 'Felipe', 'Google português do Brasil'],
    description: 'Grave, pausado, elegante — Oscar Niemeyer (homem)'
  },
  leo: {
    pitch: 1.15,
    rate: 1.2,
    volume: 0.85,
    gender: 'male',
    voiceKeywords: ['Felipe', 'Daniel', 'Ricardo', 'Google português do Brasil'],
    description: 'Rápido, agudo, lógico — Sheldon Cooper (homem)'
  },
  afrodite: {
    pitch: 1.1,
    rate: 1.05,
    volume: 0.95,
    gender: 'female',
    voiceKeywords: ['Joana', 'Luciana', 'Fernanda', 'Francisca', 'Google português do Brasil'],
    description: 'Enérgica, determinada — Nairobi (mulher)'
  },
  thor: {
    pitch: 0.6,
    rate: 0.9,
    volume: 1.0,
    gender: 'male',
    voiceKeywords: ['Ricardo', 'Jorge', 'Daniel', 'Felipe', 'Google português do Brasil'],
    description: 'Grave, forte, épico — Ragnar (homem)'
  },
  sabotagem: {
    pitch: 0.95,
    rate: 1.1,
    volume: 0.9,
    gender: 'male',
    voiceKeywords: ['Jorge', 'Felipe', 'Daniel', 'Ricardo', 'Google português do Brasil'],
    description: 'Ritmado, médio, flow — Sabotagem (homem)'
  }
};

/**
 * Check if a voice name matches a gender
 */
function voiceMatchesGender(voiceName, gender) {
  const lower = voiceName.toLowerCase();
  if (gender === 'male') {
    // Check if it's a known male voice
    if (MALE_VOICE_NAMES.some(n => lower.includes(n))) return true;
    // Exclude known female voices
    if (FEMALE_VOICE_NAMES.some(n => lower.includes(n))) return false;
  }
  if (gender === 'female') {
    // Check if it's a known female voice
    if (FEMALE_VOICE_NAMES.some(n => lower.includes(n))) return true;
    // Exclude known male voices
    if (MALE_VOICE_NAMES.some(n => lower.includes(n))) return false;
  }
  return null; // Unknown gender
}

/**
 * Find the best matching voice for a given agent profile (gender-aware)
 */
function findBestVoice(voices, profile) {
  if (!voices || voices.length === 0) return null;

  // 1. Get all Portuguese voices
  const ptVoices = voices.filter(v =>
    v.lang === 'pt-BR' || v.lang.startsWith('pt')
  );

  if (ptVoices.length > 0) {
    // 2. Filter by gender first
    const genderMatched = ptVoices.filter(v => 
      voiceMatchesGender(v.name, profile.gender) === true
    );

    const candidates = genderMatched.length > 0 ? genderMatched : ptVoices;

    // 3. Try keyword match within gender-matched voices
    for (const keyword of profile.voiceKeywords) {
      const match = candidates.find(v =>
        v.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (match) return match;
    }

    // 4. Return first gender-matched voice, or first pt voice as last resort
    return candidates[0];
  }

  // 5. Fallback to any voice
  return voices.find(v => v.default) || voices[0];
}


/**
 * useTTS Hook
 * 
 * @param {Object} options
 * @param {boolean} options.muted - Global mute state
 * @param {number} options.globalRate - Global speech rate multiplier (0.5–2.0)
 * @param {number} options.globalVolume - Global volume (0.0–1.0)
 * @returns {Object} TTS controls
 */
export function useTTS({ muted = false, globalRate = 1.0, globalVolume = 0.8 } = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  
  const speechQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const currentUtteranceRef = useRef(null);
  const mutedRef = useRef(muted);
  const globalRateRef = useRef(globalRate);
  const globalVolumeRef = useRef(globalVolume);

  // Keep refs in sync
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { globalRateRef.current = globalRate; }, [globalRate]);
  useEffect(() => { globalVolumeRef.current = globalVolume; }, [globalVolume]);

  // Initialize Speech Synthesis and load voices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn('🔇 [TTS] Web Speech API não suportada neste navegador.');
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
        console.log(`🔊 [TTS] ${voices.length} vozes carregadas (${ptVoices.length} em português).`);
        // Log pt-BR voices for debugging
        ptVoices.forEach(v => {
          console.log(`  🎵 [TTS] Voz: "${v.name}" lang=${v.lang} local=${v.localService}`);
        });
      }
    };

    // Voices may load asynchronously
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
    };
  }, []);

  /**
   * Process the speech queue sequentially
   */
  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;
    if (speechQueueRef.current.length === 0) {
      setIsSpeaking(false);
      setCurrentAgent(null);
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) return;

    isProcessingRef.current = true;
    const { text, agentId } = speechQueueRef.current.shift();

    // Skip if muted
    if (mutedRef.current) {
      isProcessingRef.current = false;
      processQueue();
      return;
    }

    const profile = AGENT_VOICE_PROFILES[agentId] || AGENT_VOICE_PROFILES.oscar;
    const utterance = new SpeechSynthesisUtterance(text);

    // Set voice
    const voice = findBestVoice(availableVoices, profile);
    if (voice) utterance.voice = voice;

    // Set speech parameters
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate * globalRateRef.current;
    utterance.volume = Math.min(1.0, profile.volume * globalVolumeRef.current);
    utterance.lang = 'pt-BR';

    currentUtteranceRef.current = utterance;
    setIsSpeaking(true);
    setCurrentAgent(agentId);

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      isProcessingRef.current = false;
      processQueue();
    };

    utterance.onerror = (e) => {
      // 'interrupted' and 'canceled' are expected when we call cancel()
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn(`🔇 [TTS] Erro na fala de ${agentId}:`, e.error);
      }
      currentUtteranceRef.current = null;
      isProcessingRef.current = false;
      processQueue();
    };

    // Chrome has a bug where synthesis stops after ~15 seconds of continuous speech
    // Workaround: resume synthesis periodically
    const resumeInterval = setInterval(() => {
      if (synth.speaking) {
        synth.resume();
      } else {
        clearInterval(resumeInterval);
      }
    }, 5000);

    utterance.onend = () => {
      clearInterval(resumeInterval);
      currentUtteranceRef.current = null;
      isProcessingRef.current = false;
      processQueue();
    };

    synth.speak(utterance);
  }, [availableVoices]);

  /**
   * Enqueue a speech for an agent
   * @param {string} agentId - Agent identifier (oscar, leo, afrodite, thor, sabotagem)
   * @param {string} text - Text to speak
   * @param {boolean} interrupt - If true, cancel current speech and speak immediately
   */
  const speak = useCallback((agentId, text, interrupt = true) => {
    if (!isSupported || !text || !text.trim()) return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    if (interrupt) {
      // Cancel any current speech and clear queue
      synth.cancel();
      speechQueueRef.current = [];
      isProcessingRef.current = false;
      currentUtteranceRef.current = null;
    }

    // Clean text: remove emojis and special characters that sound awkward in TTS
    const cleanText = text
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[🔍🎨🌸⚡🎤👑📦⚙️✓✅❌⚠️💬🚀📋💻📢🎉📐💡🔔🛒☕🎯🔄💾📖📊↩️🤖🟢]/g, '')
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n+/g, '. ') // Newlines to pauses
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    // Limit text length to prevent extremely long speeches
    const maxLength = 300;
    const truncatedText = cleanText.length > maxLength 
      ? cleanText.substring(0, maxLength) + '...'
      : cleanText;

    speechQueueRef.current.push({ text: truncatedText, agentId });
    processQueue();
  }, [isSupported, processQueue]);

  /**
   * Stop all speech immediately
   */
  const stop = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
    speechQueueRef.current = [];
    isProcessingRef.current = false;
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
    setCurrentAgent(null);
  }, [isSupported]);

  /**
   * Pause current speech
   */
  const pause = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth && synth.speaking) {
      synth.pause();
    }
  }, [isSupported]);

  /**
   * Resume paused speech
   */
  const resume = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth && synth.paused) {
      synth.resume();
    }
  }, [isSupported]);

  // Auto-stop when muted
  useEffect(() => {
    if (muted && isSpeaking) {
      stop();
    }
  }, [muted, isSpeaking, stop]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isSupported,
    currentAgent,
    availableVoices,
    voiceProfiles: AGENT_VOICE_PROFILES
  };
}

export default useTTS;
