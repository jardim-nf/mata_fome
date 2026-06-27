import { useState, useRef, useCallback } from 'react';

/**
 * useVoiceInput — Web Speech API hook for voice-to-text input
 * Supports pt-BR and provides interim + final transcript
 * @param {Object} options
 * @param {string} options.lang - BCP-47 language tag (default: 'pt-BR')
 * @returns {{ isListening, interimText, startListening, stopListening, isSupported }}
 */
export const useVoiceInput = ({ lang = 'pt-BR' } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  /**
   * Start listening for speech input
   * @param {(transcript: string) => void} onResult - Called with the final recognized text
   */
  const startListening = useCallback((onResult) => {
    if (!isSupported) return;

    // Stop any existing recognition first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const onResultRef = { current: onResult };

    recognition.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimText(interim);

      if (finalTranscript) {
        onResultRef.current?.(finalTranscript.trim());
        setInterimText('');
      }
    };

    recognition.onerror = (e) => {
      console.warn('[VoiceInput] Error:', e.error);
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, lang]);

  const toggleListening = useCallback((onResult) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(onResult);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    interimText,
    startListening,
    stopListening,
    toggleListening,
    isSupported
  };
};
