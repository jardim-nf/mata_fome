import { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';

// ───────────────────────────────────────────────────────────────
// useSquadReducer: Consolidates the 45+ useState hooks from
// SquadMeeting3D into a single managed state object with useReducer.
//
// Usage:
//   const [state, dispatch] = useSquadReducer();
//   dispatch({ type: 'SET_RUNNING', payload: true });
//   dispatch({ type: 'MERGE', payload: { running: true, activeAgent: 'oscar' } });
// ───────────────────────────────────────────────────────────────

const initialState = {
  // Execution & autopilot
  realExecution: false,
  autopilotMode: 'cautious',      // 'cautious' | 'autonomous'
  validationCommand: 'npm run build',

  // User interaction
  waitingForUser: false,
  feedbackText: '',
  activeQuestion: '',
  prompt: '',

  // Core meeting state
  theme: 'architecture',
  running: false,
  activeAgent: null,
  speechText: '',
  muted: false,
  isCoffeeBreak: false,

  // TTS (Text-to-Speech)
  ttsEnabled: true,
  ttsRate: 1.0,
  ttsVolume: 0.8,

  // Loading / UI premium
  loading3D: true,
  loadingLogs: [],
  loadingProgress: 0,
  timeClock: '',
  isPaused: false,
  customFont: 'Outfit, sans-serif',
  customColor: '',
  vfxEnabled: false,

  // Telemetry
  telemetry: { tokens: 0, responseTime: 0, apiCalls: 0 },

  // Meeting history UI
  showHistoryPanel: false,
  showAgentCreator: false,
  editingAgent: null,
  replayingMeeting: null,
  newAgent: { nome: '', cargo: '', emoji: '🧠', color: 0x8b5cf6, systemPrompt: '', phase: 'custom' },

  // AI & domain
  aiData: null,
  domainDetected: 'food',         // 'food' | 'glass' | 'marble' | 'dashboard'

  // Pipeline stepper
  currentPhase: 'idle',           // 'idle' | 'architecture' | 'ui' | 'backend' | 'qa' | 'marketing' | 'done'

  // Tabs & chat
  selectedTab: 'conversa',
  chatThread: [],
  isThinking: null,               // null | agent id string

  // Voice
  voiceTarget: null,              // 'prompt' | 'chat' | null

  // Inventory
  inventoryApproved: false,
  inventoryData: {
    materialName: '',
    required: 0,
    stock: 0,
    status: 'safe',
    supplier: '',
    cost: 0,
    unit: 'unidades'
  },

  // Artifacts & documents
  artifacts: {
    oscar: null,
    leo: null,
    afrodite: null,
    thor: null,
    sabotagem: null,
    suprimentos: null
  },
  bmadDocs: {
    'planning-artifacts/prd.md': null,
    'planning-artifacts/system_architecture.md': null,
    'implementation-artifacts/implementation_plan.md': null,
    'implementation-artifacts/verification_log.md': null,
    'planning-artifacts/marketing_campaign.md': null
  },
  activeBmadFile: 'planning-artifacts/prd.md',

  // Logs
  logs: [],

  // Hologram
  hologramContent: 'Aguardando prompt de desenvolvimento...',
};

function squadReducer(state, action) {
  switch (action.type) {
    // Generic merge (for batch updates): dispatch({ type: 'MERGE', payload: { key: value } })
    case 'MERGE':
      return { ...state, ...action.payload };

    // Individual setters (type: 'SET_<FIELD_NAME>')
    case 'SET_REAL_EXECUTION':     return { ...state, realExecution: action.payload };
    case 'SET_AUTOPILOT_MODE':     return { ...state, autopilotMode: action.payload };
    case 'SET_VALIDATION_COMMAND': return { ...state, validationCommand: action.payload };
    case 'SET_WAITING_FOR_USER':   return { ...state, waitingForUser: action.payload };
    case 'SET_FEEDBACK_TEXT':      return { ...state, feedbackText: action.payload };
    case 'SET_ACTIVE_QUESTION':    return { ...state, activeQuestion: action.payload };
    case 'SET_PROMPT':             return { ...state, prompt: action.payload };
    case 'SET_THEME':              return { ...state, theme: action.payload };
    case 'SET_RUNNING':            return { ...state, running: action.payload };
    case 'SET_ACTIVE_AGENT':       return { ...state, activeAgent: action.payload };
    case 'SET_SPEECH_TEXT':        return { ...state, speechText: action.payload };
    case 'SET_MUTED':              return { ...state, muted: action.payload };
    case 'SET_IS_COFFEE_BREAK':    return { ...state, isCoffeeBreak: action.payload };
    case 'SET_TTS_ENABLED':        return { ...state, ttsEnabled: action.payload };
    case 'SET_TTS_RATE':           return { ...state, ttsRate: action.payload };
    case 'SET_TTS_VOLUME':         return { ...state, ttsVolume: action.payload };
    case 'SET_LOADING_3D':         return { ...state, loading3D: action.payload };
    case 'SET_LOADING_LOGS':       return { ...state, loadingLogs: action.payload };
    case 'SET_LOADING_PROGRESS':   return { ...state, loadingProgress: action.payload };
    case 'SET_TIME_CLOCK':         return { ...state, timeClock: action.payload };
    case 'SET_IS_PAUSED':          return { ...state, isPaused: action.payload };
    case 'SET_CUSTOM_FONT':        return { ...state, customFont: action.payload };
    case 'SET_CUSTOM_COLOR':       return { ...state, customColor: action.payload };
    case 'SET_TELEMETRY':          return { ...state, telemetry: action.payload };
    case 'SET_VFX_ENABLED':        return { ...state, vfxEnabled: action.payload };
    case 'SET_SHOW_HISTORY_PANEL': return { ...state, showHistoryPanel: action.payload };
    case 'SET_SHOW_AGENT_CREATOR': return { ...state, showAgentCreator: action.payload };
    case 'SET_EDITING_AGENT':      return { ...state, editingAgent: action.payload };
    case 'SET_REPLAYING_MEETING':  return { ...state, replayingMeeting: action.payload };
    case 'SET_NEW_AGENT':          return { ...state, newAgent: action.payload };
    case 'SET_AI_DATA':            return { ...state, aiData: action.payload };
    case 'SET_DOMAIN_DETECTED':    return { ...state, domainDetected: action.payload };
    case 'SET_CURRENT_PHASE':      return { ...state, currentPhase: action.payload };
    case 'SET_SELECTED_TAB':       return { ...state, selectedTab: action.payload };
    case 'SET_CHAT_THREAD':        return { ...state, chatThread: action.payload };
    case 'SET_IS_THINKING':        return { ...state, isThinking: action.payload };
    case 'SET_VOICE_TARGET':       return { ...state, voiceTarget: action.payload };
    case 'SET_INVENTORY_APPROVED': return { ...state, inventoryApproved: action.payload };
    case 'SET_INVENTORY_DATA':     return { ...state, inventoryData: action.payload };
    case 'SET_ARTIFACTS':          return { ...state, artifacts: action.payload };
    case 'SET_BMAD_DOCS':          return { ...state, bmadDocs: action.payload };
    case 'SET_ACTIVE_BMAD_FILE':   return { ...state, activeBmadFile: action.payload };
    case 'SET_LOGS':               return { ...state, logs: action.payload };
    case 'SET_HOLOGRAM_CONTENT':   return { ...state, hologramContent: action.payload };

    // Functional updaters (type: 'UPDATE_<FIELD>', payload: fn(prev) => next)
    case 'UPDATE_TELEMETRY':       return { ...state, telemetry: action.payload(state.telemetry) };
    case 'UPDATE_CHAT_THREAD':     return { ...state, chatThread: action.payload(state.chatThread) };
    case 'UPDATE_LOGS':            return { ...state, logs: action.payload(state.logs) };
    case 'UPDATE_LOADING_LOGS':    return { ...state, loadingLogs: action.payload(state.loadingLogs) };
    case 'UPDATE_ARTIFACTS':       return { ...state, artifacts: action.payload(state.artifacts) };
    case 'UPDATE_BMAD_DOCS':       return { ...state, bmadDocs: action.payload(state.bmadDocs) };
    case 'UPDATE_NEW_AGENT':       return { ...state, newAgent: action.payload(state.newAgent) };
    case 'UPDATE_ACTIVE_AGENT':    return { ...state, activeAgent: action.payload(state.activeAgent) };

    // Composite actions
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs.slice(-99), `[${new Date().toLocaleTimeString()}] ${action.payload}`] };

    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatThread: [...state.chatThread, action.payload] };

    case 'RESET_MEETING':
      return {
        ...state,
        running: false,
        activeAgent: null,
        speechText: '',
        currentPhase: 'idle',
        chatThread: [],
        isThinking: null,
        inventoryApproved: false,
        artifacts: initialState.artifacts,
        bmadDocs: initialState.bmadDocs,
        aiData: null,
        hologramContent: 'Aguardando prompt de desenvolvimento...',
      };

    default:
      console.warn(`[squadReducer] Unknown action: ${action.type}`);
      return state;
  }
}

/**
 * useSquadReducer — consolidated state management for SquadMeeting3D.
 * 
 * Returns [state, dispatch] where state contains all 45+ fields and
 * dispatch accepts { type, payload } actions.
 * 
 * Also returns a `helpers` object with convenience setter functions
 * that mirror the old useState API for gradual migration.
 */
export function useSquadReducer() {
  const [state, dispatch] = useReducer(squadReducer, initialState);

  // Convenience helpers that mirror useState setters for gradual migration
  const helpers = useMemo(() => ({
    setRealExecution: (v) => dispatch({ type: 'SET_REAL_EXECUTION', payload: v }),
    setAutopilotMode: (v) => dispatch({ type: 'SET_AUTOPILOT_MODE', payload: v }),
    setValidationCommand: (v) => dispatch({ type: 'SET_VALIDATION_COMMAND', payload: v }),
    setWaitingForUser: (v) => dispatch({ type: 'SET_WAITING_FOR_USER', payload: v }),
    setFeedbackText: (v) => dispatch({ type: 'SET_FEEDBACK_TEXT', payload: v }),
    setActiveQuestion: (v) => dispatch({ type: 'SET_ACTIVE_QUESTION', payload: v }),
    setPrompt: (v) => dispatch({ type: 'SET_PROMPT', payload: v }),
    setTheme: (v) => dispatch({ type: 'SET_THEME', payload: v }),
    setRunning: (v) => dispatch({ type: 'SET_RUNNING', payload: v }),
    setActiveAgent: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_ACTIVE_AGENT', payload: v } : { type: 'SET_ACTIVE_AGENT', payload: v }),
    setSpeechText: (v) => dispatch({ type: 'SET_SPEECH_TEXT', payload: v }),
    setMuted: (v) => dispatch({ type: 'SET_MUTED', payload: v }),
    setIsCoffeeBreak: (v) => dispatch({ type: 'SET_IS_COFFEE_BREAK', payload: v }),
    setTtsEnabled: (v) => dispatch({ type: 'SET_TTS_ENABLED', payload: v }),
    setTtsRate: (v) => dispatch({ type: 'SET_TTS_RATE', payload: v }),
    setTtsVolume: (v) => dispatch({ type: 'SET_TTS_VOLUME', payload: v }),
    setLoading3D: (v) => dispatch({ type: 'SET_LOADING_3D', payload: v }),
    setLoadingLogs: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_LOADING_LOGS', payload: v } : { type: 'SET_LOADING_LOGS', payload: v }),
    setLoadingProgress: (v) => dispatch({ type: 'SET_LOADING_PROGRESS', payload: v }),
    setTimeClock: (v) => dispatch({ type: 'SET_TIME_CLOCK', payload: v }),
    setIsPaused: (v) => dispatch({ type: 'SET_IS_PAUSED', payload: v }),
    setCustomFont: (v) => dispatch({ type: 'SET_CUSTOM_FONT', payload: v }),
    setCustomColor: (v) => dispatch({ type: 'SET_CUSTOM_COLOR', payload: v }),
    setTelemetry: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_TELEMETRY', payload: v } : { type: 'SET_TELEMETRY', payload: v }),
    setVfxEnabled: (v) => dispatch({ type: 'SET_VFX_ENABLED', payload: v }),
    setShowHistoryPanel: (v) => dispatch({ type: 'SET_SHOW_HISTORY_PANEL', payload: v }),
    setShowAgentCreator: (v) => dispatch({ type: 'SET_SHOW_AGENT_CREATOR', payload: v }),
    setEditingAgent: (v) => dispatch({ type: 'SET_EDITING_AGENT', payload: v }),
    setReplayingMeeting: (v) => dispatch({ type: 'SET_REPLAYING_MEETING', payload: v }),
    setNewAgent: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_NEW_AGENT', payload: v } : { type: 'SET_NEW_AGENT', payload: v }),
    setAiData: (v) => dispatch({ type: 'SET_AI_DATA', payload: v }),
    setDomainDetected: (v) => dispatch({ type: 'SET_DOMAIN_DETECTED', payload: v }),
    setCurrentPhase: (v) => dispatch({ type: 'SET_CURRENT_PHASE', payload: v }),
    setSelectedTab: (v) => dispatch({ type: 'SET_SELECTED_TAB', payload: v }),
    setChatThread: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_CHAT_THREAD', payload: v } : { type: 'SET_CHAT_THREAD', payload: v }),
    setIsThinking: (v) => dispatch({ type: 'SET_IS_THINKING', payload: v }),
    setVoiceTarget: (v) => dispatch({ type: 'SET_VOICE_TARGET', payload: v }),
    setInventoryApproved: (v) => dispatch({ type: 'SET_INVENTORY_APPROVED', payload: v }),
    setInventoryData: (v) => dispatch({ type: 'SET_INVENTORY_DATA', payload: v }),
    setArtifacts: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_ARTIFACTS', payload: v } : { type: 'SET_ARTIFACTS', payload: v }),
    setBmadDocs: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_BMAD_DOCS', payload: v } : { type: 'SET_BMAD_DOCS', payload: v }),
    setActiveBmadFile: (v) => dispatch({ type: 'SET_ACTIVE_BMAD_FILE', payload: v }),
    setLogs: (v) => dispatch(typeof v === 'function' ? { type: 'UPDATE_LOGS', payload: v } : { type: 'SET_LOGS', payload: v }),
    setHologramContent: (v) => dispatch({ type: 'SET_HOLOGRAM_CONTENT', payload: v }),
    addLog: (text) => dispatch({ type: 'ADD_LOG', payload: text }),
  }), [dispatch]);

  return [state, dispatch, helpers];
}

export { initialState };
