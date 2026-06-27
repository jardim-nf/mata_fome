import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import BackButton from '../../components/BackButton';
import { parseProjectText, chatWithAgent, AGENT_SYSTEM_PROMPTS } from '../../services/aiService';
import { useLocalSync } from '../../context/LocalSyncContext';
import { useTTS } from '../../hooks/useTTS';
import { 
  IoPlayOutline, 
  IoColorPaletteOutline, 
  IoVolumeHighOutline, 
  IoVolumeMuteOutline 
} from 'react-icons/io5';
import {
  FaBookOpen, 
  FaTools, 
  FaCode, 
  FaDatabase, 
  FaCheckCircle, 
  FaBullhorn, 
  FaQuestionCircle, 
  FaCopy,
  FaShoppingCart,
  FaComment,
  FaFileAlt,
  FaChartLine
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import './SquadMeeting3D.css';
import SquadChatPanel from './squad/components/SquadChatPanel';
import SquadBottomBar from './squad/components/SquadBottomBar';
import { initSquadScene } from './squad/initSquadScene';

// Helper for asynchronous pauses
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Roster of agents in the squad
const AGENTS = {
  oscar: { id: 'oscar', nome: 'Oscar Niemeyer', cargo: 'Arquiteto/Analista', emoji: '🔍', color: 0xe2e8f0, phase: 'architecture' }, 
  leo: { id: 'leo', nome: 'Sheldon', cargo: 'Front-end Sênior (Bazinga!)', emoji: '🎨', color: 0x38bdf8, phase: 'ui' }, 
  afrodite: { id: 'afrodite', nome: 'Nairobi', cargo: 'Líder de Banco & Dev Backend', emoji: '🌸', color: 0xf43f5e, phase: 'backend' }, 
  thor: { id: 'thor', nome: 'Ragnar', cargo: 'QA & Validador de Elite', emoji: '⚡', color: 0xeab308, phase: 'qa' }, 
  sabotagem: { id: 'sabotagem', nome: 'Sabotagem', cargo: 'Marketing & Copy', emoji: '🎤', color: 0x22c55e, phase: 'marketing' }
};

// Helper to draw custom holographic UI on agent's HUD canvas texture
const updateHudCanvas = (agentId, canvas, ctx, texture, phase, isSpeaking, tick) => {
  const agent = AGENTS[agentId];
  if (!agent) return;
  
  const agentColorCss = '#' + agent.color.toString(16).padStart(6, '0');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Cyberpunk panel background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Neon borders
  ctx.strokeStyle = agentColorCss;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  // Accent corners
  ctx.fillStyle = agentColorCss;
  ctx.fillRect(0, 0, 16, 4);
  ctx.fillRect(0, 0, 4, 16);
  ctx.fillRect(canvas.width - 16, 0, 16, 4);
  ctx.fillRect(canvas.width - 4, 0, 4, 16);
  ctx.fillRect(0, canvas.height - 4, 16, 4);
  ctx.fillRect(0, canvas.height - 16, 4, 16);
  ctx.fillRect(canvas.width - 16, canvas.height - 4, 16, 4);
  ctx.fillRect(canvas.width - 4, canvas.height - 16, 4, 16);
  
  // Text styling
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(agent.nome.split(' ')[0].toUpperCase(), 12, 24);
  
  // Status label
  let statusText = 'IDLE';
  if (isSpeaking) {
    statusText = 'FALANDO...';
  } else if (phase === 'architecture' && agentId === 'oscar') {
    statusText = 'ANALISANDO...';
  } else if (phase === 'ui' && agentId === 'leo') {
    statusText = 'CODANDO UI...';
  } else if (phase === 'backend' && agentId === 'afrodite') {
    statusText = 'LOGICA...';
  } else if (phase === 'qa' && agentId === 'thor') {
    statusText = 'TESTANDO...';
  } else if (phase === 'marketing' && agentId === 'sabotagem') {
    statusText = 'LAUNCH...';
  } else if (phase && phase !== 'idle' && phase !== 'done' && phase !== 'failed') {
    statusText = 'AGUARDANDO';
  }
  
  ctx.fillStyle = agentColorCss;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(statusText, 12, 42);
  
  // Draw animated sine wave/radar lines if speaking or busy
  if (isSpeaking) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 12; x < canvas.width - 12; x++) {
      const y = 72 + Math.sin(x * 0.12 + tick * 0.3) * 12;
      if (x === 12) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // Draw idle dotted line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(12, 72);
    ctx.lineTo(canvas.width - 12, 72);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  texture.needsUpdate = true;
};

export default function SquadMeeting3D() {
  const { socket, isConnected, localServerIp } = useLocalSync();
  // Will be initialized after state declarations below
  const [realExecution, setRealExecution] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState('cautious'); // 'cautious' or 'autonomous'
  const [validationCommand, setValidationCommand] = useState('npm run build');
  const hologramModelRef = useRef(null);
  const resolvePromiseRef = useRef(null);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeQuestion, setActiveQuestion] = useState('');

  const [prompt, setPrompt] = useState('');
  const [theme, setTheme] = useState('architecture'); // Clean theme (forced)
  const [running, setRunning] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const [speechText, setSpeechText] = useState('');
  const [muted, setMuted] = useState(false);
  const [isCoffeeBreak, setIsCoffeeBreak] = useState(false);

  // TTS (Text-to-Speech) state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsVolume, setTtsVolume] = useState(0.8);

  // Premium state additions
  const [loading3D, setLoading3D] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [timeClock, setTimeClock] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [customFont, setCustomFont] = useState('Outfit, sans-serif');
  const [customColor, setCustomColor] = useState('');

  const isPausedRef = useRef(false);
  
  // Real-time parsed results from AI
  const [aiData, setAiData] = useState(null);
  const [domainDetected, setDomainDetected] = useState('food'); // food, glass, marble

  // Stepper / Phase state: 'idle', 'architecture', 'ui', 'backend', 'qa', 'marketing', 'done'
  const [currentPhase, setCurrentPhase] = useState('idle');

  // Interactive Deliverables tab select
  const [selectedTab, setSelectedTab] = useState('conversa'); // Default to show active chat debate!

  // Dialogue Chat Thread
  const [chatThread, setChatThread] = useState([]);

  // Inventory Stock state
  const [inventoryApproved, setInventoryApproved] = useState(false);
  const [inventoryData, setInventoryData] = useState({
    materialName: '',
    required: 0,
    stock: 0,
    status: 'safe', // safe, insufficient
    supplier: '',
    cost: 0,
    unit: 'unidades'
  });

  // Project deliverables generated dynamically
  const [artifacts, setArtifacts] = useState({
    oscar: null,
    leo: null,
    afrodite: null,
    thor: null,
    sabotagem: null,
    suprimentos: null // Stores the stock debate logs
  });

  const [bmadDocs, setBmadDocs] = useState({
    'planning-artifacts/prd.md': null,
    'planning-artifacts/system_architecture.md': null,
    'implementation-artifacts/implementation_plan.md': null,
    'implementation-artifacts/verification_log.md': null,
    'planning-artifacts/marketing_campaign.md': null
  });
  const [activeBmadFile, setActiveBmadFile] = useState('planning-artifacts/prd.md');

  // Terminals / log outputs
  const [logs, setLogs] = useState([]);
  const [hologramContent, setHologramContent] = useState('Aguardando prompt de desenvolvimento...');

  // Telemetry real values from Event Listener
  const [totalTokens, setTotalTokens] = useState(0);
  const [apiCalls, setApiCalls] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [totalResponseTime, setTotalResponseTime] = useState(0);

  // DOM Refs for Speech Bubbles to update without triggering React render lag (60FPS)
  const viewportRef = useRef(null);
  const bubblesRefs = {
    oscar: useRef(null),
    leo: useRef(null),
    afrodite: useRef(null),
    thor: useRef(null),
    sabotagem: useRef(null)
  };

  // State refs to share variables between React and the Three.js loop
  const stateRef = useRef({ 
    activeAgent: null, 
    cameraTargetAngle: 0, 
    zoomTarget: 4.5, 
    rotationY: -0.6, 
    rotationX: 0.25, 
    isCoffeeBreak: false,
    hologramColor: 0, // 0 means not set, use theme default
    currentPhase: 'idle'
  });
  const themeRef = useRef('architecture');
  const speechTextRef = useRef('');

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    stateRef.current.currentPhase = currentPhase;
  }, [currentPhase]);

  useEffect(() => {
    stateRef.current.running = running;
  }, [running]);

  // Initialize TTS hook
  const tts = useTTS({ muted: muted || !ttsEnabled, globalRate: ttsRate, globalVolume: ttsVolume });

  // Cleanup speech synthesis on unmount to stop audio when leaving the page
  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, [tts]);

  useEffect(() => {
    speechTextRef.current = speechText;
  }, [speechText]);

  // Auto-speak when an agent has a new speech text
  // Only depend on speechText to avoid double-firing when activeAgent changes first
  useEffect(() => {
    if (speechText && activeAgent && ttsEnabled && !muted) {
      tts.speak(activeAgent, speechText, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechText]);

  // Proactive Repository Status Check on socket connection
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Pedir status do repo
    socket.emit('REQUEST_REPO_STATUS');

    const handleRepoStatus = (status) => {
      if (status.error) {
        console.error("Erro no status do repo:", status.error);
        return;
      }
      
      const { branch, isDirty, lastCommit } = status;
      const dirtyText = isDirty 
        ? "temos alterações pendentes no git status" 
        : "o repositório está limpo e pronto";
        
      const oscarMsg = `Olá Chefe Matheus! Conectei ao OpenClaw Auto-Pilot. Identifiquei que estamos na branch [${branch}]. No momento, ${dirtyText}. Nosso último commit foi: "${lastCommit}". Qual tarefa vamos executar hoje?`;
      
      // Animate Oscar Niemeyer speaking
      setActiveAgent('oscar');
      setSpeechText(oscarMsg);
      setHologramContent(`Branch Ativa: ${branch}\nGit Status: ${isDirty ? 'Modificado' : 'Limpo'}\nCommit: ${lastCommit}`);
      
      addLog(`🔍 [Proativo] Oscar Niemeyer: branch [${branch}], dirty: ${isDirty}`);
      
      if (ttsEnabled && !muted) {
        tts.speak('oscar', oscarMsg, true);
      }
      
      setTimeout(() => {
        setActiveAgent(null);
        setSpeechText('');
      }, 8000);
    };

    socket.on('REPO_STATUS_RESPONSE', handleRepoStatus);

    return () => {
      socket.off('REPO_STATUS_RESPONSE', handleRepoStatus);
    };
  }, [socket, isConnected, ttsEnabled, muted]);

  // Real-time Clock effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeClock(now.toLocaleTimeString());
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to AI Telemetry events dispatched from aiService.js
  useEffect(() => {
    const handleAiTelemetry = (e) => {
      const { tokens, ms } = e.detail || {};
      if (tokens) {
        setTotalTokens(prev => prev + tokens);
      }
      if (ms) {
        setApiCalls(prevCalls => {
          const nextCalls = prevCalls + 1;
          setTotalResponseTime(prevTotal => {
            const nextTotal = prevTotal + ms;
            setAvgResponseTime(Math.round(nextTotal / nextCalls));
            return nextTotal;
          });
          return nextCalls;
        });
      }
    };
    window.addEventListener('ai_telemetry', handleAiTelemetry);
    return () => {
      window.removeEventListener('ai_telemetry', handleAiTelemetry);
    };
  }, []);

  // NASA Loading Screen simulation effect
  useEffect(() => {
    const logs = [
      "ESTABLISHING SECURE CONNECTION TO NASA SQUAD CENTRAL...",
      "SYNCHRONIZING ZUSTAND STATE MANAGEMENT STORES...",
      "POWERING UP 3D PROJECTOR HOLOGRAM SYSTEM...",
      "FETCHING FIRESTORE METRICS AND DATABASE SCHEMAS...",
      "CONNECTING AI AGENT ROSTER TO TELEMETRY STREAM...",
      "INITIALIZING MISSION CONTROL ENGINE... ALL SYSTEMS ONLINE!"
    ];
    let logIndex = 0;
    let progress = 0;

    const logInterval = setInterval(() => {
      if (logIndex < logs.length) {
        setLoadingLogs(prev => [...prev, `[OK] ${logs[logIndex]}`]);
        logIndex++;
      }
    }, 400);

    const progressInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        clearInterval(logInterval);
        // Fade out loading screen
        setTimeout(() => {
          setLoading3D(false);
        }, 400);
      }
      setLoadingProgress(progress);
    }, 100);

    return () => {
      clearInterval(logInterval);
      clearInterval(progressInterval);
    };
  }, []);

  // Keyboard Shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        isPausedRef.current = !isPausedRef.current;
        setIsPaused(isPausedRef.current);
        addLog(isPausedRef.current ? "⏸ Reunião pausada pelo atalho de teclado." : "▶ Reunião retomada pelo atalho de teclado.");
        toast.info(isPausedRef.current ? "Reunião pausada." : "Reunião retomada.");
      } else if (key === 'm') {
        setMuted(prev => !prev);
        addLog("🔊 Mudo alternado via teclado.");
      } else if (key === '1') {
        setActiveAgent('oscar');
        addLog("🔍 Câmera focada em: Oscar Niemeyer");
      } else if (key === '2') {
        setActiveAgent('leo');
        addLog("🎨 Câmera focada em: Shaldon");
      } else if (key === '3') {
        setActiveAgent('afrodite');
        addLog("🌸 Câmera focada em: Nairobi");
      } else if (key === '4') {
        setActiveAgent('thor');
        addLog("⚡ Câmera focada em: Ragnar");
      } else if (key === '5') {
        setActiveAgent('sabotagem');
        addLog("🎤 Câmera focada em: Sabotagem");
      } else if (key === '0' || key === 'escape') {
        setActiveAgent(null);
        addLog("🎥 Foco de câmera redefinido para visão geral.");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running]);

  // Rebuild the 3D hologram model dynamically when aiData or domainDetected changes (deactivated to keep central conference table clean)
  useEffect(() => {
    if (!hologramModelRef.current) return;
    const group = hologramModelRef.current;

    // Clear previous elements
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }, [aiData, domainDetected]);

  // Web Audio Synthesis sound engine (no files needed)
  const audioCtxRef = useRef(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Bate-papo procedural divertido com memória e encadeamento no Coffee Break
  useEffect(() => {
    if (!isCoffeeBreak) return;

    const COFFEE_TOPICS = [
      {
        name: "gravidade_zero",
        steps: [
          { agent: 'leo', text: "Gente, a máquina de café italiana do buffet está tendo problemas de vazamento na gravidade zero da NASA!" },
          { agent: 'afrodite', text: "Calma Shaldon, a bomba de pressão da máquina compensa isso. Nenhuma gota vai flutuar no nosso console." },
          { agent: 'thor', text: "Por Odin! Meu machado viking também flutuaria no espaço? Quero testar a gravidade zero agora mesmo!" },
          { agent: 'oscar', text: "Sem arremessar armas no Centro de Controle, Ragnar. A beleza do espaço está no silêncio e na leveza de suas curvas." },
          { agent: 'sabotagem', text: "Se o café flutuar, meu flow vai pras estrelas! A gravidade é zero mas o compromisso é cem por cento!" }
        ]
      },
      {
        name: "comida_astronauta",
        steps: [
          { agent: 'sabotagem', text: "Aí equipe, esse sachê liofilizado sabor hambúrguer do espaço que peguei no refeitório é meio esquisito..." },
          { agent: 'leo', text: "Lógico! A sublimação remove a água sob vácuo para preservação ideal de nutrientes. É pura física aplicada!" },
          { agent: 'thor', text: "Prefiro um javali assado em Valhalla, mas essa pasta em tubo dá força para decapitar bugs no console!" },
          { agent: 'afrodite', text: "O importante é que a telemetria com a Terra e com o banco de dados do Matheusjardim está em órbita nominal." },
          { agent: 'oscar', text: "O alimento espacial tem funcionalidade, mas carece da harmonia e da poesia de um bom almoço na Terra." }
        ]
      },
      {
        name: "bug_sexta",
        steps: [
          { agent: 'thor', text: "Gente, encontrei um bug crítico de faturamento no Firestore!" },
          { agent: 'afrodite', text: "Não é possível, Ragnar. Eu testei essa collection ontem na transação e estava tudo ok..." },
          { agent: 'leo', text: "Ah, deve ser no front. Acho que esqueci de converter o valor para centavos no input do PDV." },
          { agent: 'oscar', text: "Calma, equipe. A elegância exige paciência. Vamos analisar o diagrama de classes antes de alterar o código." },
          { agent: 'sabotagem', text: "Vocês que lutem com o código, eu já vou subir uma campanha de desconto para compensar o downtime!" }
        ]
      },
      {
        name: "caneca_sumida",
        steps: [
          { agent: 'sabotagem', text: "Pessoal, papo sério... Quem pegou minha caneca de café com estampa de microfone?" },
          { agent: 'leo', text: "Ih, pior que eu vi o Oscar levando uma caneca parecida lá para a prateleira de livros..." },
          { agent: 'oscar', text: "Ora, eu apenas apreciei o design geométrico daquela peça. Mas já a devolvi ao buffet." },
          { agent: 'afrodite', text: "Ah, então foi por isso que achei ela limpa na pia. Deixei ela secando do lado da máquina de expresso." },
          { agent: 'thor', text: "Validado! Caneca localizada e devolvida com sucesso para o marketing. Caso encerrado!" }
        ]
      }
    ];

    const topicRef = { current: Math.floor(Math.random() * COFFEE_TOPICS.length) };
    const stepRef = { current: 0 };
    let timerId = null;

    const runDialogueStep = () => {
      const topic = COFFEE_TOPICS[topicRef.current];
      const step = topic.steps[stepRef.current];

      setActiveAgent(step.agent);
      setSpeechText(step.text);
      playSynthSound('click');

      // Limpa a fala após 4.5 segundos
      const speechClearTimeout = setTimeout(() => {
        setActiveAgent(current => current === step.agent ? null : current);
      }, 4500);

      stepRef.current += 1;

      let nextDelay = 7000; // Tempo normal entre falas na mesma discussão

      if (stepRef.current >= topic.steps.length) {
        // Tópico acabou! Escolhe outro diferente
        let nextTopic = Math.floor(Math.random() * COFFEE_TOPICS.length);
        if (COFFEE_TOPICS.length > 1 && nextTopic === topicRef.current) {
          nextTopic = (nextTopic + 1) % COFFEE_TOPICS.length;
        }
        topicRef.current = nextTopic;
        stepRef.current = 0;
        nextDelay = 14000; // Pausa maior de silêncio (14 segundos) entre discussões
      }

      // Agenda a próxima fala
      timerId = setTimeout(runDialogueStep, nextDelay);
    };

    // Inicia o primeiro diálogo após 2 segundos
    timerId = setTimeout(runDialogueStep, 2000);

    return () => {
      clearTimeout(timerId);
      setActiveAgent(null);
      setSpeechText('');
    };
  }, [isCoffeeBreak]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  };

  const playSynthSound = (type) => {
    if (mutedRef.current) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'hum') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      } else if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'success') {
        const playTone = (freq, delay, duration, vol) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.setValueAtTime(vol, ctx.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
          o.start(ctx.currentTime + delay);
          o.stop(ctx.currentTime + delay + duration);
        };
        playTone(523.25, 0, 0.5, 0.03); // C5
        playTone(659.25, 0.08, 0.5, 0.03); // E5
        playTone(783.99, 0.16, 0.6, 0.03); // G5
        playTone(1046.50, 0.24, 0.8, 0.04); // C6
      }
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  };

  const addLog = (text) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const approvePurchaseOrder = () => {
    setInventoryApproved(true);
    playSynthSound('success');
    addLog('🛒 [Suprimentos] Ordem de compra aprovada pelo Administrador!');
    
    // Add purchase confirmation to chat
    setChatThread(prev => [...prev, {
      id: 'system',
      nome: 'LOGÍSTICA',
      emoji: '📦',
      text: '⚠️ Ordem de compra aprovada e enviada ao fornecedor pelo Master Admin.',
      time: new Date().toLocaleTimeString()
    }]);
    
    toast.success('Ordem de Compra enviada para o Fornecedor!');
  };

  useEffect(() => {
    stateRef.current.activeAgent = activeAgent;
    if (activeAgent) {
      playSynthSound('click');
    }
  }, [activeAgent]);

  // Three.js Render Logic — extracted to squad/initSquadScene.js (2300+ lines)
  useEffect(() => {
    const cleanup = initSquadScene({
      viewportRef,
      stateRef,
      speechTextRef,
      hologramModelRef,
      bubblesRefs,
      updateHudCanvas
    });
    return cleanup;
  }, []);


  const handleSendFeedback = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!feedbackText.trim()) return;

    const userMsg = feedbackText;
    setFeedbackText('');

    // Adicionar mensagem do usuário na conversa
    setChatThread(prev => [...prev, {
      id: 'user',
      nome: 'Matheusjardim',
      emoji: '👑',
      text: userMsg,
      time: new Date().toLocaleTimeString()
    }]);

    addLog(`💬 [Matheusjardim] Enviou feedback: "${userMsg}"`);

    const lowerMsg = userMsg.toLowerCase().trim();
    const currentAgent = activeAgent || 'oscar';

    // Tratamento de Aprovação Humana em Tempo Real via Socket
    if (realExecution && socket && isConnected) {
      if (waitingForUser) {
        const isApproval = /^(pode continuar|aprovo|aprovado|t[aá] certo|ok|continuar|passar|prosseguir|confirmar|confirmado|sim)$/i.test(lowerMsg) || 
                          /(aprovo|aprovado|continuar|prosseguir|pode continuar|t[aá] certo|ok)/i.test(lowerMsg);
        if (isApproval) {
          socket.emit('USER_APPROVAL_RESPONSE', { approved: true });
          setWaitingForUser(false);
          addLog(`✓ [Aprovação Real] Plano de arquitetura aprovado.`);
          toast.success('Plano aprovado! Desenvolvimento iniciado.');
        } else {
          socket.emit('USER_APPROVAL_RESPONSE', { approved: false, feedback: userMsg });
          setWaitingForUser(false);
          addLog(`💬 [Revisão Real] Enviando revisão para o Oscar Niemeyer: "${userMsg}"`);
          toast.info('Solicitação de revisão enviada para o analista.');
        }
        return;
      }
    }

    // 1. Approval keywords (fluxo de simulação)
    const isApproval = /^(pode continuar|aprovo|aprovado|t[aá] certo|ok|continuar|passar|prosseguir|confirmar|confirmado|sim)$/i.test(lowerMsg) || 
                      (waitingForUser && /(aprovo|aprovado|continuar|prosseguir|pode continuar|t[aá] certo|ok)/i.test(lowerMsg));
    if (isApproval) {
      const agentReply = `Excelente, Chefe! Fase aprovada pelo chefe Matheusjardim. Prosseguindo com o processo...`;
      setTimeout(() => {
        setChatThread(prev => [...prev, {
          id: currentAgent,
          nome: AGENTS[currentAgent]?.nome || currentAgent,
          emoji: AGENTS[currentAgent]?.emoji || '🤖',
          text: agentReply,
          time: new Date().toLocaleTimeString()
        }]);
        setSpeechText(agentReply);
        playSynthSound('success');
        handleApproveAndProceed();
      }, 500);
      return;
    }

    // 2. Font / Tipografia changes
    if (/(font|fonte|letra)/i.test(lowerMsg)) {
      let fontName = 'Outfit, sans-serif';
      let label = 'Outfit';
      if (/monospace|mono|computador|c[oó]digo|code/i.test(lowerMsg)) {
        fontName = 'monospace';
        label = 'Monospace';
      } else if (/serif|classica|cl[aá]ssica/i.test(lowerMsg)) {
        fontName = 'Georgia, serif';
        label = 'Serif (Georgia)';
      } else if (/comic|divertido|divertida|sans/i.test(lowerMsg)) {
        fontName = "'Comic Sans MS', cursive";
        label = 'Comic Sans';
      } else if (/outfit|premium|moderno|moderna/i.test(lowerMsg)) {
        fontName = "'Outfit', sans-serif";
        label = 'Outfit (Premium)';
      } else if (/courier|escrever/i.test(lowerMsg)) {
        fontName = "'Courier New', Courier, monospace";
        label = 'Courier';
      }
      
      setCustomFont(fontName);
      const agentReply = `Com certeza, Chefe! Ajustando a tipografia geral para a fonte ${label} conforme solicitado!`;
      setTimeout(() => {
        setChatThread(prev => [...prev, {
          id: currentAgent,
          nome: AGENTS[currentAgent]?.nome || currentAgent,
          emoji: AGENTS[currentAgent]?.emoji || '🤖',
          text: agentReply,
          time: new Date().toLocaleTimeString()
        }]);
        setSpeechText(agentReply);
        playSynthSound('success');
        addLog(`🎨 Tipografia alterada para: ${label}`);
      }, 500);
      return;
    }



    // 4. Color changes
    if (/(cor|color|luz|holograma)/i.test(lowerMsg)) {
      let hexColor = 0x14b8a6;
      let colorName = 'Teal';
      if (/vermelh[oa]|red/i.test(lowerMsg)) { hexColor = 0xef4444; colorName = 'Vermelho'; }
      else if (/[aá]zul|blue/i.test(lowerMsg)) { hexColor = 0x3b82f6; colorName = 'Azul'; }
      else if (/verd[e]|green/i.test(lowerMsg)) { hexColor = 0x10b981; colorName = 'Verde'; }
      else if (/ros[aa]|pink/i.test(lowerMsg)) { hexColor = 0xec4899; colorName = 'Rosa'; }
      else if (/amarel[oa]|yellow/i.test(lowerMsg)) { hexColor = 0xeab308; colorName = 'Amarelo'; }
      else if (/rox[oa]|purple/i.test(lowerMsg)) { hexColor = 0x8b5cf6; colorName = 'Roxo'; }
      else if (/cyan|ciano/i.test(lowerMsg)) { hexColor = 0x06b6d4; colorName = 'Ciano'; }
      
      stateRef.current.hologramColor = hexColor;
      setCustomColor(colorName);
      
      const agentReply = `Processando alteração cromática. Mudando a tonalidade do holograma central para ${colorName}!`;
      setTimeout(() => {
        setChatThread(prev => [...prev, {
          id: currentAgent,
          nome: AGENTS[currentAgent]?.nome || currentAgent,
          emoji: AGENTS[currentAgent]?.emoji || '🤖',
          text: agentReply,
          time: new Date().toLocaleTimeString()
        }]);
        setSpeechText(agentReply);
        playSynthSound('success');
        addLog(`💡 Cor do holograma alterada para: ${colorName}`);
      }, 500);
      return;
    }

    // 5. Phase Jumps
    if (/(fase|etapa|passar|pular|ir para|agente)/i.test(lowerMsg)) {
      let targetPhase = '';
      let targetAgent = '';
      if (/oscar|arquitetura|architecture/i.test(lowerMsg)) { targetPhase = 'architecture'; targetAgent = 'oscar'; }
      else if (/shaldon|leo|ui|front|visual/i.test(lowerMsg)) { targetPhase = 'ui'; targetAgent = 'leo'; }
      else if (/nairobi|afrodite|backend|banco|db/i.test(lowerMsg)) { targetPhase = 'backend'; targetAgent = 'afrodite'; }
      else if (/ragnar|thor|qa|teste/i.test(lowerMsg)) { targetPhase = 'qa'; targetAgent = 'thor'; }
      else if (/sabotagem|marketing|slogan|propaganda/i.test(lowerMsg)) { targetPhase = 'marketing'; targetAgent = 'sabotagem'; }
      else if (/fim|done|entregue|concluido/i.test(lowerMsg)) { targetPhase = 'done'; targetAgent = null; }
      
      if (targetPhase) {
        setCurrentPhase(targetPhase);
        setActiveAgent(targetAgent);
        
        const agentReply = `Certamente, Chefe. Redirecionando a mesa de discussões para a fase ${targetPhase.toUpperCase()}${targetAgent ? ' e passando a palavra para ' + AGENTS[targetAgent].nome : ''}!`;
        setTimeout(() => {
          setChatThread(prev => [...prev, {
            id: targetAgent || 'system',
            nome: targetAgent ? AGENTS[targetAgent].nome : 'SISTEMA',
            emoji: targetAgent ? AGENTS[targetAgent].emoji : '⚙️',
            text: agentReply,
            time: new Date().toLocaleTimeString()
          }]);
          setSpeechText(agentReply);
          playSynthSound('success');
          addLog(`🔄 Fase alterada para: ${targetPhase}`);
        }, 500);
        return;
      }
    }

    // 6. Dimensions modification
    if (/(largura|altura|profundidade|tamanho|medida)/i.test(lowerMsg)) {
      const nums = lowerMsg.match(/\b\d{3,4}\b/g);
      if (nums && nums.length > 0) {
        const val = parseInt(nums[0], 10);
        let prop = '';
        if (/largura/i.test(lowerMsg)) prop = 'largura';
        else if (/altura/i.test(lowerMsg)) prop = 'altura';
        else if (/profundidade/i.test(lowerMsg)) prop = 'profundidade';
        
        if (prop && aiData) {
          setAiData(prev => ({
            ...prev,
            [prop]: val
          }));
          
          const agentReply = `Ajustando as dimensões físicas no ERP. Nova dimensão configurada: ${prop} para ${val}mm. Recalculando folgas e renderizando modelo 3D atualizado...`;
          setTimeout(() => {
            setChatThread(prev => [...prev, {
              id: currentAgent,
              nome: AGENTS[currentAgent]?.nome || currentAgent,
              emoji: AGENTS[currentAgent]?.emoji || '🤖',
              text: agentReply,
              time: new Date().toLocaleTimeString()
            }]);
            setSpeechText(agentReply);
            playSynthSound('success');
            addLog(`📐 Dimensão alterada: ${prop} = ${val}mm`);
          }, 500);
          return;
        }
      }
    }

    // 7. Meeting Pause / Resume controls
    if (/^(pausar|pause|parar|stop)$/i.test(lowerMsg)) {
      isPausedRef.current = true;
      setIsPaused(true);
      addLog("⏸ Reunião pausada via chat.");
      toast.info("Reunião pausada.");
      return;
    }
    if (/^(continuar|retomar|play|iniciar|come[cç]ar)$/i.test(lowerMsg)) {
      if (isPausedRef.current) {
        isPausedRef.current = false;
        setIsPaused(false);
        addLog("▶ Reunião retomada via chat.");
        toast.info("Reunião retomada.");
      } else if (!running) {
        runSquadMeetingSimulation({ preventDefault: () => {} });
      }
      return;
    }

    // 8. Mute controls
    if (/^(mutar|silenciar|desmutar|som|audio|volume)$/i.test(lowerMsg)) {
      setMuted(prev => !prev);
      addLog(`🔊 Estado de áudio alternado.`);
      return;
    }

    // Fallback: All agents respond sequentially via AI
    const agentOrder = ['oscar', 'leo', 'afrodite', 'thor', 'sabotagem'];
    const phaseOrder = ['architecture', 'ui', 'backend', 'qa', 'marketing'];

    const isGreetingMsg = /\b(bom dia|boa tarde|boa noite|ola|olá|oi|como vcs estao|como voces estao|tudo bem|tudo bom|e ai|e aí|salve|fala time|hello|hey|hi)\b/i.test(userMsg.trim());
    const hasCodingKeywordsMsg = /(cria|crie|altere|mude|fix|bug|ajuste|desenvolva|faca|faça|implemente|codigo|código|tela|função|funcao|teste|build|git|npm|yarn|instala|instale|remover|excluir|deletar)/i.test(userMsg.toLowerCase());
    const hasProductKeywordsMsg = /(vidro|glass|box|janela|porta|temperado|laminado|marmore|mármore|granito|pedra|corte|balcao|balcão|pia|soleira|peitoril|ilha)/i.test(userMsg.toLowerCase());
    const isConversationalMsg = isGreetingMsg || (!hasCodingKeywordsMsg && !hasProductKeywordsMsg && userMsg.trim().split(' ').length < 5);

    // Build conversation history from chatThread
    const history = chatThread.slice(-10).map(msg => ({
      role: msg.id === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    // Show thinking indicator
    addLog(`🤔 Squad está pensando...`);

    // Typing indicator helpers
    const showTypingChat = (agentId) => {
      const agentInfo = AGENTS[agentId];
      setChatThread(prev => [...prev, {
        id: '__typing__',
        typingAgent: agentId,
        nome: agentInfo.nome,
        emoji: agentInfo.emoji,
        text: '',
        time: new Date().toLocaleTimeString()
      }]);
    };

    const removeTypingChat = () => {
      setChatThread(prev => prev.filter(m => m.id !== '__typing__'));
    };

    // Call all agents sequentially with typing indicator
    (async () => {
      const convHistory = [...history];

      for (let i = 0; i < agentOrder.length; i++) {
        const agentId = agentOrder[i];
        const agentInfo = AGENTS[agentId];
        const phase = phaseOrder[i];

        setCurrentPhase(phase);
        setActiveAgent(agentId);
        setHologramContent(`${agentInfo.nome} está pensando...`);
        playSynthSound('hum');

        // Show typing indicator
        showTypingChat(agentId);
        await new Promise(r => setTimeout(r, 1500));

        try {
          const contextMsg = i === 0
            ? userMsg
            : `O Chefe Matheusjardim disse: "${userMsg}". Os agentes anteriores já falaram. Contribua com sua perspectiva única no personagem. Seja breve.`;

          const customPrompt = isConversationalMsg
            ? `${AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar}
Escreva uma resposta de saudação informal ao Chefe Matheusjardim. Inicie a resposta obrigatoriamente dizendo "Oi", "Olá" ou outra saudação similar no seu estilo/personagem. Responda de forma extremamente curta e natural (máximo 1 ou 2 frases). Não invente tarefas técnicas fictícias ou progresso de desenvolvimento que não existe. Apenas saúde o chefe e diga que está pronto para receber tarefas.`
            : null;

          const agentReply = await chatWithAgent(agentId, contextMsg, convHistory, customPrompt);

          // Remove typing, show real message
          removeTypingChat();

          convHistory.push({ role: 'user', content: contextMsg });
          convHistory.push({ role: 'assistant', content: agentReply });

          setChatThread(prev => [...prev, {
            id: agentId,
            nome: agentInfo.nome,
            emoji: agentInfo.emoji,
            text: agentReply,
            time: new Date().toLocaleTimeString()
          }]);
          setSpeechText(agentReply);
          setHologramContent(agentReply);
          addLog(`💬 [${agentInfo.nome}] Respondeu via IA.`);
        } catch (err) {
          removeTypingChat();
          addLog(`⚠️ [${agentInfo.nome}] Erro: ${err.message}`);
        }

        // Dynamic delay: longer text = more reading time
        const lastMsg = chatThread[chatThread.length - 1];
        const textLen = lastMsg?.text?.length || 50;
        const readDelay = Math.max(4000, textLen * 50);
        await new Promise(r => setTimeout(r, readDelay));
      }

      // Done
      setCurrentPhase('done');
      setActiveAgent(null);
      setSpeechText('');
      playSynthSound('success');
      addLog('🎉 Todos os agentes responderam. Continue a conversa!');
    })();
  };

  const handleApproveAndProceed = () => {
    if (realExecution && socket && isConnected) {
      socket.emit('USER_APPROVAL_RESPONSE', { approved: true });
      setWaitingForUser(false);
      setActiveQuestion('');
      playSynthSound('success');
      addLog('✓ [Aprovação Real] Plano de arquitetura aprovado.');
      toast.success('Plano aprovado! Desenvolvimento iniciado.');
      return;
    }

    if (resolvePromiseRef.current) {
      setWaitingForUser(false);
      setActiveQuestion('');
      playSynthSound('success');
      addLog('✓ [Aprovação] Matheusjardim aprovou a entrega desta fase!');
      resolvePromiseRef.current('approved');
      resolvePromiseRef.current = null;
    }
  };

  // --- SQUAD SIMULATION COORDINATOR LOOP ---
  const runSquadMeetingSimulation = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return toast.warn('Digite a tarefa do squad!');

    // NOTE: realExecution toggle enables tool usage (read_file, write_file, etc.) via socket bridge.
    // The AI pipeline below handles both simulation AND real execution seamlessly.

    setRunning(true);
    stateRef.current.isCoffeeBreak = false;
    setIsCoffeeBreak(false);
    setLogs([]);
    setAiData(null);
    setInventoryApproved(false);
    setSelectedTab('conversa'); // Show live chat thread
    setCurrentPhase('architecture');
    setHologramContent('Oscar Niemeyer está analisando o plano arquitetônico...');
    setChatThread([]);

    // Reset Telemetry counters
    setTotalTokens(0);
    setApiCalls(0);
    setAvgResponseTime(0);
    setTotalResponseTime(0);

    setArtifacts({
      oscar: null,
      leo: null,
      afrodite: null,
      thor: null,
      sabotagem: null,
      suprimentos: null
    });
    setBmadDocs({
      'planning-artifacts/prd.md': null,
      'planning-artifacts/system_architecture.md': null,
      'implementation-artifacts/implementation_plan.md': null,
      'implementation-artifacts/verification_log.md': null,
      'planning-artifacts/marketing_campaign.md': null
    });

    addLog('🚀 [Squad] Reunião de engenharia iniciada...');
    addLog(`📝 [Requisito] "${prompt}"`);
    playSynthSound('hum');

    const isGreeting = /\b(bom dia|boa tarde|boa noite|ola|olá|oi|como vcs estao|como voces estao|tudo bem|tudo bom|e ai|e aí|salve|fala time|hello|hey|hi)\b/i.test(prompt.trim());
    const hasCodingKeywords = /(cria|crie|altere|mude|fix|bug|ajuste|desenvolva|faca|faça|implemente|codigo|código|tela|função|funcao|teste|build|git|npm|yarn|instala|instale|remover|excluir|deletar)/i.test(prompt.toLowerCase());
    const hasProductKeywords = /(vidro|glass|box|janela|porta|temperado|laminado|marmore|mármore|granito|pedra|corte|balcao|balcão|pia|soleira|peitoril|ilha)/i.test(prompt.toLowerCase());
    const isConversational = isGreeting || (!hasCodingKeywords && !hasProductKeywords && prompt.trim().split(' ').length < 5);

    if (isConversational) {
      addLog('💬 [Conversa] O time está respondendo com IA...');
      
      // Conversation history for context
      const convHistory = [];

      // Helper to show typing indicator before agent speaks
      const showTyping = (agentId) => {
        const agentInfo = AGENTS[agentId];
        setChatThread(prev => [...prev, {
          id: '__typing__',
          typingAgent: agentId,
          nome: agentInfo.nome,
          emoji: agentInfo.emoji,
          text: '',
          time: new Date().toLocaleTimeString()
        }]);
      };

      const removeTyping = () => {
        setChatThread(prev => prev.filter(m => m.id !== '__typing__'));
      };

      // Helper to make an agent speak with real AI
      const agentSay = async (agentId, phase, hologramMsg) => {
        setCurrentPhase(phase);
        setActiveAgent(agentId);
        setHologramContent(hologramMsg);
        playSynthSound('hum');

        // Show "typing..." bubble
        showTyping(agentId);
        await sleep(1500); // Let user see the typing indicator

        const agentInfo = AGENTS[agentId];
        const agentPrompt = `O Chefe Matheusjardim disse: "${prompt}". Responda de forma natural e no personagem.`;
        
        const customPrompt = `${AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar}
Escreva uma resposta de saudação informal ao Chefe Matheusjardim. Inicie a resposta obrigatoriamente dizendo "Oi", "Olá" ou outra saudação similar no seu estilo/personagem. Responda de forma extremamente curta e natural (máximo 1 ou 2 frases). Não invente tarefas técnicas fictícias ou progresso de desenvolvimento que não existe. Apenas saúde o chefe e diga que está pronto para receber tarefas.`;

        const reply = await chatWithAgent(agentId, agentPrompt, convHistory, customPrompt);

        // Remove typing indicator, add real message
        removeTyping();

        // Add to conversation history
        convHistory.push({ role: 'user', content: agentPrompt });
        convHistory.push({ role: 'assistant', content: reply });

        setSpeechText(reply);
        setChatThread(prev => [...prev, {
          id: agentId,
          nome: agentInfo.nome,
          emoji: agentInfo.emoji,
          text: reply,
          time: new Date().toLocaleTimeString()
        }]);
        addLog(`💬 [${agentInfo.nome}] Respondeu via IA.`);

        // Dynamic delay: longer text = more reading time
        const readDelay = Math.max(4000, reply.length * 50);
        await sleep(readDelay);
      };

      // Each agent responds sequentially with typing indicator
      await agentSay('oscar', 'architecture', 'Oscar Niemeyer está pensando...');
      await agentSay('leo', 'ui', 'Sheldon está processando...');
      await agentSay('afrodite', 'backend', 'Nairobi está no comando...');
      await agentSay('thor', 'qa', 'Ragnar prepara o machado...');
      await agentSay('sabotagem', 'marketing', 'Sabotagem solta a rima...');

      await sleep(1000);
      setActiveAgent(null);
      setSpeechText('');
      setRunning(false);
      setCurrentPhase('done');
      addLog('🎉 [Conversa] Bate-papo finalizado. Continue conversando ou envie uma tarefa!');
      return;
    }

    const lowerPrompt = prompt.toLowerCase();
    let domain = 'food';
    if (lowerPrompt.includes('vidro') || lowerPrompt.includes('glass') || lowerPrompt.includes('vidr') || lowerPrompt.includes('box') || lowerPrompt.includes('janela') || lowerPrompt.includes('porta') || lowerPrompt.includes('temperado') || lowerPrompt.includes('laminado') || lowerPrompt.includes('7199')) {
      domain = 'glass';
    } else if (lowerPrompt.includes('marmore') || lowerPrompt.includes('granito') || lowerPrompt.includes('chapa') || lowerPrompt.includes('pedra') || lowerPrompt.includes('corte') || lowerPrompt.includes('borda') || lowerPrompt.includes('marmor') || lowerPrompt.includes('pia') || lowerPrompt.includes('balcao') || lowerPrompt.includes('soleira') || lowerPrompt.includes('peitoril') || lowerPrompt.includes('ilha')) {
      domain = 'marble';
    } else if (lowerPrompt.includes('dashboard') || lowerPrompt.includes('painel') || lowerPrompt.includes('master') || lowerPrompt.includes('layout') || lowerPrompt.includes('confuso') || lowerPrompt.includes('bonito') || lowerPrompt.includes('visual') || lowerPrompt.includes('aba')) {
      domain = 'dashboard';
    }

    setDomainDetected(domain);
    addLog(`🎯 [Domínio Detectado] ${domain === 'glass' ? 'IdeaGlass (Vidros)' : domain === 'marble' ? 'IdeaMarmore (Mármore/Granito)' : domain === 'dashboard' ? 'Painel Master (UI/UX)' : 'IdeaFood (Alimentação)'}`);

    // Parse project requirement
    let parsedJSON = null;
    try {
      const parsed = await parseProjectText(prompt, domain === 'marble');
      parsedJSON = parsed;
      setAiData(parsed);
    } catch (err) {
      console.error(err);
      parsedJSON = {
        modelo: domain === 'marble' ? 'cozinha' : domain === 'glass' ? 'box' : domain === 'dashboard' ? 'dashboard' : 'outros',
        modeloNome: domain === 'marble' ? 'Pia de Cozinha' : domain === 'glass' ? 'Box Elegance' : domain === 'dashboard' ? 'Dashboard Master' : 'Painel de Faturamento',
        largura: domain === 'marble' ? 1800 : domain === 'dashboard' ? 1200 : 1400,
        altura: 1900,
        profundidade: 600,
        corVidro: 'Incolor',
        corAluminio: 'fosco',
        pedra: 'Granito Verde Ubatuba',
        acabamento: 'Meia Esquadria (Ingletado)',
        saiaAtiva: true,
        rodopiaAtivo: true,
        alturaSaia: 40,
        alturaRodopia: 100,
        puxador: 'padrao',
        clienteNome: 'Matheus Jardim',
        clienteTelefone: '11988887777',
        clienteEndereco: 'Rua das Palmeiras, 120',
        observacoes: 'Instalação sob medida',
        explicacao: 'Projeto adaptado com fallback do ERP.'
      };
      setAiData(parsedJSON);
    }

    // Prepare Stock & supplies data dynamically
    let matName = 'Insumos Gerais';
    let reqQty = 1.0;
    let stQty = 2.0;
    let supplierName = 'Distribuidora Global';
    let purchaseCost = 150;
    let measureUnit = 'unidades';

    if (domain === 'glass') {
      matName = `Vidro Temperado 8mm ${parsedJSON.corVidro || 'Incolor'}`;
      const glassArea = (parsedJSON.largura * parsedJSON.altura) / 1000000;
      reqQty = parseFloat((glassArea / 2.0).toFixed(2));
      stQty = 1.0;
      supplierName = 'Vidros Blindex Sul';
      purchaseCost = 450;
      measureUnit = 'Chapas';
    } else if (domain === 'marble') {
      matName = parsedJSON.pedra || 'Granito Verde Ubatuba';
      const stoneArea = (parsedJSON.largura * (parsedJSON.profundidade || 600)) / 1000000;
      reqQty = parseFloat((stoneArea / 1.5).toFixed(2));
      stQty = 0.5;
      supplierName = 'Pedreira Central Mármores';
      purchaseCost = 890;
      measureUnit = 'Chapas';
    } else if (domain === 'dashboard') {
      matName = 'Componentes UI Premium';
      reqQty = 1.0;
      stQty = 1.0;
      supplierName = 'Antigravity UI library';
      purchaseCost = 0;
      measureUnit = 'pacotes';
    } else {
      matName = 'Ingredientes de Base';
      reqQty = 25;
      stQty = 30;
      supplierName = 'Mercado Atacadão Food';
      purchaseCost = 180;
      measureUnit = 'Kg';
    }

    const hasLowStock = reqQty > stQty;
    const invData = {
      materialName: matName,
      required: reqQty,
      stock: stQty,
      status: hasLowStock ? 'insufficient' : 'safe',
      supplier: supplierName,
      cost: purchaseCost,
      unit: measureUnit
    };
    setInventoryData(invData);

    // Typing indicator helpers for the pipeline
    const showTypingPipeline = (agentId) => {
      const agentInfo = AGENTS[agentId];
      setChatThread(prev => [...prev, {
        id: '__typing__',
        typingAgent: agentId,
        nome: agentInfo.nome,
        emoji: agentInfo.emoji,
        text: '',
        time: new Date().toLocaleTimeString()
      }]);
    };
    const removeTypingPipeline = () => {
      setChatThread(prev => prev.filter(m => m.id !== '__typing__'));
    };

    // -------------------------------------------------------------
    // FASE 1: Oscar Niemeyer (Análise via IA com Blueprint JSON)
    // -------------------------------------------------------------
    setActiveAgent('oscar');
    showTypingPipeline('oscar');
    
    const convHistory = [];
    const oscarPrompt = `Analise como Arquiteto-Chefe o seguinte requisito do projeto IdeaERP (domínio: ${domain}): "${prompt}". 
Aqui está a lista de alguns arquivos chaves do projeto para seu contexto:
[
  "src/components/pdv-modals/ModalResumoTurno.jsx",
  "src/hooks/usePdvCaixa.js",
  "src/pages/ControleSalao.jsx",
  "src/pages/admin/SquadMeeting3D.jsx",
  "src/services/aiService.js",
  "src/utils/formatCurrency.js"
]

Você deve obrigatoriamente responder em duas partes, separadas por "--- PLAN ---":
1. Sua fala poética no personagem analisando o requisito e estimulando o time (1-2 frases).
2. Um objeto JSON válido descrevendo o plano de ação arquitetônico com o seguinte formato exato:
{
  "pensamento": "Sua análise arquitetônica sobre a curva e o espaço do código...",
  "arquivosParaLer": ["src/components/pdv-modals/ModalResumoTurno.jsx"],
  "arquivosParaAlterar": [{"caminho": "src/components/pdv-modals/ModalResumoTurno.jsx", "responsavel": "Leo"}],
  "arquivosParaCriar": [],
  "explicacaoDoPlano": "Redesenho completo da interface do resumo de turno."
}
`;
    
    addLog('🔍 [Oscar Niemeyer] Analisando arquitetura com IA...');
    let oscarSpeech = '';
    let oscarPlanJson = '';
    try {
      const reply = await chatWithAgent('oscar', oscarPrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- PLAN ---');
      oscarSpeech = parts[0].trim();
      oscarPlanJson = parts[1] ? parts[1].trim() : JSON.stringify({
        pensamento: "A arquitetura precisa ser fluida como as curvas dos morros de nossa pátria.",
        arquivosParaLer: ["src/components/pdv-modals/ModalResumoTurno.jsx"],
        arquivosParaAlterar: [{"caminho": "src/components/pdv-modals/ModalResumoTurno.jsx", "responsavel": "Leo"}],
        arquivosParaCriar: [],
        explicacaoDoPlano: "Redesenho completo da interface do resumo de turno."
      });
    } catch (e) {
      removeTypingPipeline();
      oscarSpeech = `Saudações, equipe. Analisei o requisito "${prompt}" com elegância. Proponho uma arquitetura modular com componentes React, serviços Firebase e validação de layout.`;
      oscarPlanJson = JSON.stringify({
        pensamento: "A arquitetura precisa ser fluida como as curvas dos morros de nossa pátria.",
        arquivosParaLer: ["src/components/pdv-modals/ModalResumoTurno.jsx"],
        arquivosParaAlterar: [{"caminho": "src/components/pdv-modals/ModalResumoTurno.jsx", "responsavel": "Leo"}],
        arquivosParaCriar: [],
        explicacaoDoPlano: "Redesenho completo da interface do resumo de turno."
      });
    }

    convHistory.push({ role: 'user', content: `Requisito do projeto: "${prompt}" (Domínio: ${domain})` });
    convHistory.push({ role: 'assistant', content: `[Oscar Niemeyer]: ${oscarSpeech}` });

    setSpeechText(oscarSpeech);
    setChatThread(prev => [...prev, {
      id: 'oscar',
      nome: 'Oscar Niemeyer',
      emoji: '🔍',
      text: oscarSpeech,
      time: new Date().toLocaleTimeString()
    }]);
    setHologramContent(oscarSpeech);
    setArtifacts(prev => ({
      ...prev,
      oscar: oscarPlanJson
    }));
    setBmadDocs(prev => ({
      ...prev,
      'planning-artifacts/prd.md': `# PRD — ${prompt}\n\n**Requisito:** "${prompt}"\n**Data:** ${new Date().toLocaleDateString()}\n**Arquiteto:** Oscar Niemeyer\n\n## Plano\n${oscarSpeech}`,
      'planning-artifacts/system_architecture.md': `# Arquitetura — ${prompt}\n\n**Arquiteto:** Oscar Niemeyer 🔍\n\n## Análise\n${oscarSpeech}`
    }));
    addLog('📋 [Oscar Niemeyer] Plano entregue via IA.');

    await sleep(3000);

    // -------------------------------------------------------------
    // FASE 2: Leo (Front-end UI & SVG Preview)
    // -------------------------------------------------------------
    setCurrentPhase('ui');
    setActiveAgent('leo');
    showTypingPipeline('leo');
    addLog('🎨 [Shaldon] Desenvolvendo design system e protótipo visual com IA...');

    const leoPrompt = `Como Shaldon (Sheldon Cooper), engenheiro front-end (muito nerd, bazinga, focado em React e CSS premium):
Baseado no plano de arquitetura de Oscar Niemeyer e no requisito "${prompt}" (domínio: ${domain}), desenvolva a interface de front-end.
Analise o histórico da reunião e a proposta arquitetônica do Oscar. Critique ou comente de forma lógica e no seu estilo Sheldon a decisão dele antes de responder.
Você deve obrigatoriamente responder em duas partes, separadas por "--- CODE ---":
1. Sua fala no personagem respondendo ao Oscar e ao chefe Matheusjardim (1-2 frases no máximo, use bazinga/nerdices).
2. Um componente de código React JavaScript ou JSX (fictício ou real) correspondente à interface do projeto.

Exemplo de formato de resposta:
Bazinga! Analisei o plano do Oscar. Embora ele ame curvas, o front-end exige lógica reta...
--- CODE ---
// src/components/...
import React from 'react';
...
`;

    let leoSpeech = '';
    let leoHolo = '';
    try {
      const reply = await chatWithAgent('leo', leoPrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- CODE ---');
      leoSpeech = parts[0].trim();
      leoHolo = parts[1] ? parts[1].trim() : `// src/components/Prototype.jsx\nimport React from 'react';\nexport default function Prototype() {\n  return <div className="p-4">Interface para ${prompt}</div>;\n}`;
    } catch (e) {
      removeTypingPipeline();
      leoSpeech = 'Bazinga! Tive um problema ao rodar o compilador do cérebro, mas vou desenhar a interface agora mesmo.';
      leoHolo = `// src/components/FallbackWidget.jsx\nimport React from 'react';\nexport default function FallbackWidget() {\n  return <div className="p-4">Fallback Widget para ${domain}</div>;\n}`;
    }

    convHistory.push({ role: 'user', content: 'Desenvolva a interface front-end baseada no plano.' });
    convHistory.push({ role: 'assistant', content: `[Shaldon]: ${leoSpeech}\nCódigo:\n${leoHolo}` });

    setSpeechText(leoSpeech);
    setChatThread(prev => [...prev, {
      id: 'leo',
      nome: 'Shaldon',
      emoji: '🎨',
      text: leoSpeech,
      time: new Date().toLocaleTimeString()
    }]);

    await sleep(6000);
    setHologramContent(leoHolo);
    setArtifacts(prev => ({
      ...prev,
      leo: parsedJSON
    }));
    addLog('💻 [Shaldon] Interface gerada. Enviando para Nairobi.');
    setActiveQuestion('Matheusjardim, o design system e a renderização do protótipo estão adequados para os padrões do projeto ou devo refazer alguma margem?');
    setWaitingForUser(true);
    await new Promise((resolve) => { resolvePromiseRef.current = resolve; });

    // -------------------------------------------------------------
    // FASE 3: Afrodite (Backend & Database)
    // -------------------------------------------------------------
    setCurrentPhase('backend');
    setActiveAgent('afrodite');
    showTypingPipeline('afrodite');
    addLog('🌸 [Nairobi] Conectando base de dados Firestore e definindo endpoints com IA...');

    const afroditePrompt = `Como Nairobi (Afrodite), líder de backend (firme, determinada, pragmática, líder nata, "Que comece o matriarcado da produção!"):
Baseado na interface gerada por Shaldon e no plano de Oscar para a tarefa "${prompt}" (domínio: ${domain}), estruture as coleções Firestore e serviços.
Analise as últimas mensagens do chat e o código front-end do Shaldon. Comente na sua fala sobre a interface dele e como você vai mapear os endpoints correspondentes.
Você deve responder em duas partes, separadas por "--- CODE ---":
1. Sua fala no personagem respondendo ao Shaldon e ao chefe Matheusjardim (1-2 frases no máximo).
2. Um trecho de código JavaScript ou regras de segurança do Firebase correspondente ao banco de dados e endpoints.
`;

    let afroditeSpeech = '';
    let afroditeHolo = '';
    try {
      const reply = await chatWithAgent('afrodite', afroditePrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- CODE ---');
      afroditeSpeech = parts[0].trim();
      afroditeHolo = parts[1] ? parts[1].trim() : `// src/services/backend.js\nexport const service = {};`;
    } catch (e) {
      removeTypingPipeline();
      afroditeSpeech = 'Perfeito, Shaldon! Que comece o matriarcado da produção! Vou estruturar as APIs e a conexão Firestore imediatamente.';
      afroditeHolo = `// src/services/invoiceService.js\nimport { db } from '../firebase';\nexport const invoiceService = {};`;
    }

    convHistory.push({ role: 'user', content: 'Implemente o backend e banco de dados.' });
    convHistory.push({ role: 'assistant', content: `[Nairobi]: ${afroditeSpeech}\nCódigo:\n${afroditeHolo}` });

    setSpeechText(afroditeSpeech);
    setChatThread(prev => [...prev, {
      id: 'afrodite',
      nome: 'Nairobi',
      emoji: '🌸',
      text: afroditeSpeech,
      time: new Date().toLocaleTimeString()
    }]);

    await sleep(6000);
    setHologramContent(afroditeHolo);
    setArtifacts(prev => ({
      ...prev,
      afrodite: afroditeHolo
    }));
    addLog('📦 [Nairobi] Banco de dados estruturado.');
    setActiveQuestion('Matheus, as regras de segurança e a estruturação de banco de dados no Firestore atendem à carga esperada? Posso mandar o código para o Ragnar testar?');
    setWaitingForUser(true);
    await new Promise((resolve) => { resolvePromiseRef.current = resolve; });

    // -------------------------------------------------------------
    // INTEGRATED STOCK DEBATE CHAT IN CONVERSA & SUPRIMENTOS (DINÂMICO)
    // -------------------------------------------------------------
    addLog('📦 [Suprimentos] Ragnar iniciou a verificação de inventário de insumos...');
    
    let debateTxt = `💬 [MESA DE DEBATE DE SUPRIMENTOS]\n-----------------------------------------------\n`;

    const ragnarStockPrompt = `Como Ragnar (Thor), QA Viking (forte, impetuoso, usa referências a Odin, machados, runas):
O projeto consome ${reqQty} ${measureUnit} do insumo "${matName}". Em estoque físico temos apenas ${stQty} ${measureUnit}.
O status do estoque é: ${hasLowStock ? 'INSUFICIENTE (precisamos comprar mais!)' : 'SEGURO (temos o bastante!)'}.
Diga ao squad o resultado da verificação física de estoque no seu estilo viking em 1 ou 2 frases curtas.`;

    const nairobiStockPrompt = `Como Nairobi (Afrodite), Líder de Backend/Matriarca:
Reaja ao aviso de Ragnar sobre o estoque de "${matName}" (${hasLowStock ? 'está INSUFICIENTE' : 'é suficiente'}).
${hasLowStock ? `Confirme que pesquisou nos fornecedores e que a '${supplierName}' tem o material disponível para entrega por R$ ${purchaseCost},00.` : 'Confirme que os custos e níveis de reabastecimento automático estão dentro do esperado.'}
Fale em 1 ou 2 frases curtas e práticas de líder.`;

    const oscarStockPrompt = `Como Oscar Niemeyer, Arquiteto-Chefe elegante:
Reaja à discussão de Ragnar e Nairobi sobre o estoque.
${hasLowStock ? 'Autorize a compra emergencial, confirme que gerou a Ordem de Compra e peça ao administrador Matheusjardim para aprovar o pagamento na aba "Suprimentos".' : 'Aprove o plano de suprimentos como validado sem custos extras.'}
Responda de forma elegante e concisa em 1 ou 2 frases.`;

    const sabotagemStockPrompt = `Como Sabotagem, Rapper e Marketing:
Reaja à aprovação/compra de suprimentos.
${hasLowStock ? 'Comente que com a autorização do chefe Matheusjardim o material chega rápido e o corre não para.' : 'Comente que está tudo sob controle, margem excelente e o lucro está garantido.'}
Fale em 1 ou 2 frases curtas com rimas e gírias de rap nacional brasileiro.`;

    let chatMsgRagnar = '';
    let chatMsgNairobi = '';
    let chatMsgOscar = '';
    let chatMsgSabo = '';

    try {
      chatMsgRagnar = await chatWithAgent('thor', ragnarStockPrompt, convHistory);
      convHistory.push({ role: 'user', content: 'Ragnar, verifique o estoque.' });
      convHistory.push({ role: 'assistant', content: `[Ragnar]: ${chatMsgRagnar}` });
    } catch (e) {
      chatMsgRagnar = hasLowStock 
        ? `Galera, atenção! O projeto consome ${reqQty} ${measureUnit} de '${matName}', mas no estoque físico só temos ${stQty} ${measureUnit}. O estoque está INSUFICIENTE!`
        : `Chequei o estoque de '${matName}'. Temos ${stQty} ${measureUnit} e consumiremos ${reqQty} ${measureUnit}. Estoque seguro!`;
    }

    try {
      chatMsgNairobi = await chatWithAgent('afrodite', nairobiStockPrompt, convHistory);
      convHistory.push({ role: 'user', content: 'Nairobi, confirme os custos/fornecedores.' });
      convHistory.push({ role: 'assistant', content: `[Nairobi]: ${chatMsgNairobi}` });
    } catch (e) {
      chatMsgNairobi = hasLowStock
        ? `Confirmo a falta, Ragnar. Consultei os fornecedores integrados. A '${supplierName}' possui o material em estoque por R$ ${purchaseCost},00.`
        : `Perfeito. Nossos custos e níveis de reabastecimento automático do módulo principal estão dentro do esperado.`;
    }

    try {
      chatMsgOscar = await chatWithAgent('oscar', oscarStockPrompt, convHistory);
      convHistory.push({ role: 'user', content: 'Oscar, qual a decisão arquitetônica de compras?' });
      convHistory.push({ role: 'assistant', content: `[Oscar Niemeyer]: ${chatMsgOscar}` });
    } catch (e) {
      chatMsgOscar = hasLowStock
        ? `Autorizo a compra emergencial. Criei a Ordem de Compra. Shaldon, atualize o status de suprimentos. Administrador, por favor aprove o pagamento na aba 'Suprimentos'.`
        : `Excelente. Plano validado, sem ordens de compra extras necessárias.`;
    }

    try {
      chatMsgSabo = await chatWithAgent('sabotagem', sabotagemStockPrompt, convHistory);
      convHistory.push({ role: 'user', content: 'Sabotagem, finalize o debate de suprimentos.' });
      convHistory.push({ role: 'assistant', content: `[Sabotagem]: ${chatMsgSabo}` });
    } catch (e) {
      chatMsgSabo = hasLowStock
        ? `É isso, família! Se o chefe clicar em 'Aprovar' na aba de Suprimentos, o material chega em 24h. Tá na mão!`
        : `Tudo sob controle, chefe! Margem de lucro nas nuvens!`;
    }

    // Append inventory chat to Discussão thread
    setChatThread(prev => [
      ...prev,
      { id: 'thor', nome: 'Ragnar', emoji: '⚡', text: chatMsgRagnar, time: new Date().toLocaleTimeString() },
      { id: 'afrodite', nome: 'Nairobi', emoji: '🌸', text: chatMsgNairobi, time: new Date().toLocaleTimeString() },
      { id: 'oscar', nome: 'Oscar Niemeyer', emoji: '🔍', text: chatMsgOscar, time: new Date().toLocaleTimeString() },
      { id: 'sabotagem', nome: 'Sabotagem', emoji: '🎤', text: chatMsgSabo, time: new Date().toLocaleTimeString() }
    ]);

    debateTxt += `⚡ Ragnar: "${chatMsgRagnar}"\n\n🌸 Nairobi: "${chatMsgNairobi}"\n\n🔍 Oscar: "${chatMsgOscar}"\n\n🎤 Sabotagem: "${chatMsgSabo}"`;
    setArtifacts(prev => ({
      ...prev,
      suprimentos: debateTxt
    }));

    // -------------------------------------------------------------
    // FASE 4: Ragnar (Validação & Testes NBR)
    // -------------------------------------------------------------
    setCurrentPhase('qa');
    setActiveAgent('thor');
    showTypingPipeline('thor');
    addLog('⚡ [Ragnar] Iniciando rotinas de teste automatizadas com IA...');
 
    const ragnarWarningPrompt = `Como Ragnar (Thor), QA Viking:
Você está testando a interface desenvolvida por Shaldon e as APIs de Nairobi para a tarefa "${prompt}" (domínio: ${domain}).
Detecte de forma viking um aviso de compilação ou erro técnico (como lint ou variáveis não utilizadas) e dê o alerta.
Responda obrigatoriamente em duas partes, separadas por "--- WARNING ---":
1. Sua fala no personagem viking alertando sobre o problema (1-2 frases viking, usando referências a Odin, machados, raios).
2. O aviso detalhado de erro de compilação do compilador fictício com caminho de arquivo realista (ex: "⚠️ [ESLint] 'useAuth' is defined but never used in src/components/pdv-modals/ModalResumoTurno.jsx (102:18)").
`;
 
    let thorSpeech = '';
    let thorWarning = '';
 
    try {
      const reply = await chatWithAgent('thor', ragnarWarningPrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- WARNING ---');
      thorSpeech = parts[0].trim();
      thorWarning = parts[1] ? parts[1].trim() : '⚠️ [ESLint] \'useAuth\' is defined but never used in src/components/pdv-modals/ModalResumoTurno.jsx (102:18)';
    } catch (e) {
      removeTypingPipeline();
      thorSpeech = 'Machado Viking pronto! Rodando testes unitários do integrador. Identifiquei um aviso de compilação no Widget.';
      thorWarning = '⚠️ [ESLint] \'useAuth\' is defined but never used in src/components/pdv-modals/ModalResumoTurno.jsx (102:18)';
    }
 
    setSpeechText(thorSpeech);
    setChatThread(prev => [...prev, {
      id: 'thor',
      nome: 'Ragnar',
      emoji: '⚡',
      text: thorSpeech,
      time: new Date().toLocaleTimeString()
    }]);
 
    await sleep(3000);
    
    // Send compiler warnings to thread and hologram
    setSpeechText(thorSpeech.split('. ')[1] || thorSpeech);
    setHologramContent(thorWarning);
    setChatThread(prev => [...prev, {
      id: 'system',
      nome: 'COMPILADOR',
      emoji: '⚙️',
      text: thorWarning,
      time: new Date().toLocaleTimeString()
    }]);
    addLog(thorWarning);
    playSynthSound('warning');
 
    await sleep(3000);
 
    // Sheldon fixes it
    setActiveAgent('leo');
    showTypingPipeline('leo');
    const sheldonFixPrompt = `Como Shaldon (Sheldon Cooper), engenheiro front-end:
Ragnar alertou sobre o erro: "${thorWarning}".
Diga de forma curta e nerd (1 frase com Bazinga!) que corrigiu o erro e explique de forma técnica e lógica o ajuste (ex: limpou definições não usadas).`;
    
    let sheldonFixSpeech = '';
    try {
      sheldonFixSpeech = await chatWithAgent('leo', sheldonFixPrompt, convHistory);
      removeTypingPipeline();
    } catch (e) {
      removeTypingPipeline();
      sheldonFixSpeech = 'Bazinga! Corrigido! Já removi a importação ociosa no escopo local do componente.';
    }
 
    setSpeechText(sheldonFixSpeech);
    setChatThread(prev => [...prev, {
      id: 'leo',
      nome: 'Shaldon',
      emoji: '🎨',
      text: sheldonFixSpeech,
      time: new Date().toLocaleTimeString()
    }]);
 
    await sleep(3000);
 
    // Ragnar runs build again and succeeds
    setActiveAgent('thor');
    showTypingPipeline('thor');
    const ragnarSuccessPrompt = `Como Ragnar (Thor), QA Viking:
Shaldon corrigiu o problema. Agora você rodou a compilação final e os testes passaram com 100% de sucesso.
Responda em duas partes, separadas por "--- TESTS ---":
1. Sua fala no personagem comemorando a vitória das runas e o build verde (1-2 frases).
2. A saída do terminal fictícia ou real mostrando o sucesso do build (3-4 linhas).
`;
 
    let thorFinalSpeech = '';
    let thorHolo = '';

    try {
      const reply = await chatWithAgent('thor', ragnarSuccessPrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- TESTS ---');
      thorFinalSpeech = parts[0].trim();
      thorHolo = parts[1] ? parts[1].trim() : '✓ all tests passed successfully!\n🚀 Build finalizado com SUCESSO!';
    } catch (e) {
      removeTypingPipeline();
      thorFinalSpeech = 'Excelente! Rodando build final... Testes passaram de primeira! 100% aprovado, a aplicação está sólida como rocha.';
      thorHolo = `VITE v5.2.0 building for production...\n✓ 142 modules transformed.\n🚀 Build finalizado com SUCESSO!`;
    }

    convHistory.push({ role: 'user', content: 'Ragnar, finalize a verificação de QA e rode o build final.' });
    convHistory.push({ role: 'assistant', content: `[Ragnar]: ${thorFinalSpeech}\nLogs:\n${thorHolo}` });

    setSpeechText(thorFinalSpeech);
    setHologramContent(thorHolo);
    setChatThread(prev => [...prev, {
      id: 'thor',
      nome: 'Ragnar',
      emoji: '⚡',
      text: thorFinalSpeech,
      time: new Date().toLocaleTimeString()
    }]);
    setArtifacts(prev => ({
      ...prev,
      thor: thorHolo
    }));

    setBmadDocs(prev => ({
      ...prev,
      'implementation-artifacts/implementation_plan.md': `# Implementation Plan & Dev Summary - BMAD Compliant\n\n**Task:** "${prompt}"\n**Developers:** Shaldon 🎨 (UI/Front-end) & Nairobi 🌸 (DB/Back-end)\n**Date:** ${new Date().toLocaleDateString()}\n\n## 1. Scope of Implementation\nThe developers have implemented code changes based on the architect's layout.\n\n## 2. Implemented Code Files\n- \`src/components/Prototype.jsx\` (Shaldon)\n- \`src/services/backend.js\` (Nairobi)\n\n## 3. Structural Details\n- UI Components styled using premium CSS/Tailwind rules.\n- DB/Backend rules mapped to Firestore collections/logic.`,
      'implementation-artifacts/verification_log.md': `# Verification & QA Log - BMAD Compliant\n\n**Validator:** Ragnar ⚡\n**Validation Command:** \`npm run build\`\n**Success Status:** ✅ SUCCESS\n**Date:** ${new Date().toLocaleDateString()}\n**Round:** #0\n\n## 1. QA Analysis\n${thorHolo}\n\n## 2. Test Execution Output\n\`\`\`bash\n✓ tests passed successfully!\n🚀 Build finalizado com SUCESSO!\n\`\`\``
    }));

    addLog(`✅ [Ragnar] Compilação e testes validados com sucesso.`);
    playSynthSound('success');
    setActiveQuestion('Guerreiro Matheusjardim, a compilação passou com 100% de sucesso! Deseja que a gente prepare a campanha de lançamento ou deseja que eu rode mais testes de estresse?');
    setWaitingForUser(true);
    await new Promise((resolve) => { resolvePromiseRef.current = resolve; });

    try {
      import('canvas-confetti').then((confetti) => {
        confetti.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      });
    } catch (e) {
      // ignore confetti failure
    }

    // -------------------------------------------------------------
    // FASE 5: Sabotagem (Marketing & Lançamento)
    // -------------------------------------------------------------
    setCurrentPhase('marketing');
    await sleep(5000);
    setActiveAgent('sabotagem');
    showTypingPipeline('sabotagem');
    addLog('🎤 [Sabotagem] Criando campanha publicitária e slogans de lançamento com IA...');

    const sabotagemPrompt = `Como Sabotagem (Marketing & Rapper de rua nacional):
Crie a campanha de lançamento e os slogans para a tarefa finalizada: "${prompt}" (domínio: ${domain}).
Você deve responder em duas partes, separadas por "--- SLOGAN ---":
1. Sua fala no personagem cheia de gírias e ritmo de rap nacional (1-2 frases curtas).
2. O slogan e a copy do Instagram formatados de forma limpa.

Exemplo de formato de resposta:
É isso aí, família! Código no ar...
--- SLOGAN ---
--- SLOGAN DE MARKETING ---
"..."
--- COPY INSTAGRAM ---
"..."
`;

    let sabotagemSpeech = '';
    let sabotagemHolo = '';

    try {
      const reply = await chatWithAgent('sabotagem', sabotagemPrompt, convHistory);
      removeTypingPipeline();
      const parts = reply.split('--- SLOGAN ---');
      sabotagemSpeech = parts[0].trim();
      sabotagemHolo = parts[1] ? parts[1].trim() : '--- SLOGAN DE MARKETING ---\n"Otimização inteligente na pista."\n\n--- COPY INSTAGRAM ---\nCódigo pronto no ar! #SaaS';
    } catch (e) {
      removeTypingPipeline();
      sabotagemSpeech = 'É isso aí, família! Código no ar, agora é o marketing na pista! Slogans pesados pro corre decolar. Confere aí!';
      sabotagemHolo = `--- SLOGAN DE MARKETING ---\n"IdeaERP: A inteligência que otimiza seu corre do início ao fim."\n\n--- COPY INSTAGRAM ---\nChega de quebrar cabeça! Gerencie tudo na palma da sua mão. 🚀 #SaaS #Gestao`;
    }

    convHistory.push({ role: 'user', content: 'Sabotagem, crie a campanha de marketing.' });
    convHistory.push({ role: 'assistant', content: `[Sabotagem]: ${sabotagemSpeech}\nCampanha:\n${sabotagemHolo}` });

    setSpeechText(sabotagemSpeech);
    setChatThread(prev => [...prev, {
      id: 'sabotagem',
      nome: 'Sabotagem',
      emoji: '🎤',
      text: sabotagemSpeech,
      time: new Date().toLocaleTimeString()
    }]);

    await sleep(5500);
    setHologramContent(sabotagemHolo);
    setArtifacts(prev => ({
      ...prev,
      sabotagem: sabotagemHolo
    }));
    setBmadDocs(prev => ({
      ...prev,
      'planning-artifacts/marketing_campaign.md': `# Marketing Launch Campaign - BMAD Compliant\n\n**Launch Agent:** Sabotagem 🎤\n**Date:** ${new Date().toLocaleDateString()}\n\n## 1. Product Slogan & Copy\n${sabotagemHolo}\n\n## 2. Instagram Slogans\n- "Código pronto na pista, otimizando de ponta a ponta!"`
    }));
    addLog('📢 [Sabotagem] Campanha gerada com sucesso.');
    setActiveQuestion('Aí Chefe Matheusjardim, a campanha está nas ruas e as rimas estão gravadas! Aprova o lançamento final no mercado?');
    setWaitingForUser(true);
    await new Promise((resolve) => { resolvePromiseRef.current = resolve; });

    // End simulation
    await sleep(3000);
    setActiveAgent(null);
    setSpeechText('');
    setRunning(false);
    setCurrentPhase('done');
    addLog('🎉 [Squad] Reunião finalizada. Entrega consolidada no painel à direita.');
    toast.success('Tarefa concluída pelo Squad!');
  };

  // --- Dynamic SVG Render for Glass Box ---
  const renderGlassSVG = (data) => {
    const w = data.largura || 1400;
    const h = data.altura || 1900;
    const cor = data.corVidro || 'Incolor';
    const metal = data.corAluminio || 'fosco';
    const pux = data.puxador || 'padrao';

    let glassFill = 'rgba(186, 230, 253, 0.25)';
    let glassStroke = '#38bdf8';
    if (cor === 'Fumê') {
      glassFill = 'rgba(55, 65, 81, 0.6)';
      glassStroke = '#4b5563';
    } else if (cor === 'Bronze') {
      glassFill = 'rgba(180, 83, 9, 0.4)';
      glassStroke = '#b45309';
    } else if (cor === 'Verde') {
      glassFill = 'rgba(16, 185, 129, 0.3)';
      glassStroke = '#10b981';
    }

    let metalFill = '#94a3b8'; // fosco
    if (metal === 'preto') metalFill = '#1e293b';
    else if (metal === 'branco') metalFill = '#f8fafc';
    else if (metal === 'bronze') metalFill = '#78350f';
    else if (metal === 'brilhante') metalFill = '#cbd5e1';

    return (
      <svg className="w-full h-72 squad-prototype-blueprint-bg border border-slate-800 rounded-xl" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={metalFill} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor={metalFill} />
          </linearGradient>
        </defs>

        <line x1="20" y1="20" x2="380" y2="20" stroke="rgba(255,255,255,0.05)" />
        <line x1="20" y1="90" x2="380" y2="90" stroke="rgba(255,255,255,0.05)" />
        <line x1="20" y1="160" x2="380" y2="160" stroke="rgba(255,255,255,0.05)" />
        <line x1="20" y1="230" x2="380" y2="230" stroke="rgba(255,255,255,0.05)" />

        <path d="M 60 20 L 60 260 L 340 260" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 4" />

        {/* FIXED PANEL (Left) */}
        <rect x="80" y="45" width="115" height="205" fill={glassFill} stroke={glassStroke} strokeWidth="1.5" rx="3">
          <animate attributeName="opacity" values="0.7;0.9;0.7" dur="4s" repeatCount="indefinite" />
        </rect>
        <text x="137" y="150" fill={glassStroke} fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.6">FIXO</text>

        {/* SLIDING PANEL (Right) */}
        <rect x="185" y="45" width="125" height="205" fill={glassFill} stroke={glassStroke} strokeWidth="1.5" rx="3">
          <animate attributeName="x" values="185;170;185" dur="8s" repeatCount="indefinite" />
        </rect>
        <text x="245" y="150" fill={glassStroke} fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.6">CORRER</text>

        {/* Hardware: Top Rail */}
        <rect x="75" y="38" width="245" height="10" fill="url(#metalGrad)" stroke="rgba(255,255,255,0.1)" rx="2" />
        <circle cx="200" cy="43" r="4" fill="#64748b" />
        <circle cx="290" cy="43" r="4" fill="#64748b" />

        {/* Handle */}
        {pux === 'padrao' && (
          <rect x="200" y="120" width="4" height="40" fill="url(#metalGrad)" rx="1" stroke="#475569" strokeWidth="0.5" />
        )}
        {pux === 'knob' && (
          <circle cx="200" cy="140" r="5" fill="url(#metalGrad)" stroke="#475569" strokeWidth="0.5" />
        )}
        {pux === 'furo' && (
          <circle cx="200" cy="140" r="6" fill="none" stroke={glassStroke} strokeWidth="2" />
        )}

        {/* Dimension Line Width */}
        <line x1="80" y1="265" x2="310" y2="265" stroke="#818cf8" strokeWidth="1" />
        <path d="M 80 262 L 80 268 M 310 262 L 310 268" stroke="#818cf8" strokeWidth="1" />
        <text x="195" y="278" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle">{w} mm</text>

        {/* Dimension Line Height */}
        <line x1="70" y1="45" x2="70" y2="250" stroke="#818cf8" strokeWidth="1" />
        <path d="M 67 45 L 73 45 M 67 250 L 73 250" stroke="#818cf8" strokeWidth="1" />
        <text x="50" y="150" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform="rotate(-90 50 150)">{h} mm</text>

        {/* NBR Stamp */}
        <rect x="230" y="220" width="70" height="24" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="0.5" rx="4" />
        <text x="265" y="231" fill="#10b981" fontSize="6" fontWeight="black" textAnchor="middle">CONFORME</text>
        <text x="265" y="239" fill="#10b981" fontSize="6" fontWeight="black" textAnchor="middle">NBR 7199 (8mm)</text>
      </svg>
    );
  };

  // --- Dynamic SVG Render for Marble Slab ---
  const renderMarbleSVG = (data) => {
    const w = data.largura || 1800;
    const d = data.profundidade || 600;
    const pedra = data.pedra || 'Granito Verde Ubatuba';
    const saia = data.saiaAtiva ?? true;
    const altSaia = data.alturaSaia || 40;
    const rodo = data.rodopiaAtivo ?? true;
    const altRodo = data.alturaRodopia || 100;
    const acab = data.acabamento || 'Meia Esquadria';

    let stoneColor = '#065f46';
    if (pedra.toLowerCase().includes('preto')) stoneColor = '#1e293b';
    else if (pedra.toLowerCase().includes('cinza')) stoneColor = '#475569';
    else if (pedra.toLowerCase().includes('carrara') || pedra.toLowerCase().includes('branco')) stoneColor = '#f1f5f9';
    else if (pedra.toLowerCase().includes('travertino') || pedra.toLowerCase().includes('amarelo')) stoneColor = '#fef08a';

    return (
      <svg className="w-full h-72 squad-prototype-blueprint-bg border border-slate-800 rounded-xl" viewBox="0 0 400 300">
        <defs>
          <pattern id="veins" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 10 0 C 30 20, 20 60, 40 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            <path d="M 60 0 C 80 40, 70 80, 90 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x="70" y="70" width="260" height="130" fill={stoneColor} stroke="#ffffff" strokeOpacity="0.2" rx="4" />
        <rect x="70" y="70" width="260" height="130" fill="url(#veins)" rx="4" />

        {rodo && (
          <>
            <rect x="70" y="55" width="260" height="15" fill={stoneColor} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" opacity="0.8" />
            <text x="200" y="65" fill="#f8fafc" fontSize="7" textAnchor="middle" fontWeight="bold">RODOPIA (+{altRodo}mm)</text>
          </>
        )}

        {saia && (
          <>
            <line x1="70" y1="200" x2="330" y2="200" stroke="#f43f5e" strokeWidth="2.5" />
            <text x="200" y="213" fill="#f43f5e" fontSize="7" textAnchor="middle" fontWeight="bold">SAIA (+{altSaia}mm) - {acab}</text>
          </>
        )}

        {/* Dimension Line Width */}
        <line x1="70" y1="235" x2="330" y2="235" stroke="#818cf8" strokeWidth="1" />
        <path d="M 70 232 L 70 238 M 330 232 L 330 238" stroke="#818cf8" strokeWidth="1" />
        <text x="200" y="248" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle">{w} mm</text>

        {/* Dimension Line Depth */}
        <line x1="50" y1="70" x2="50" y2="200" stroke="#818cf8" strokeWidth="1" />
        <path d="M 47 70 L 53 70 M 47 200 L 53 200" stroke="#818cf8" strokeWidth="1" />
        <text x="30" y="135" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform="rotate(-90 30 135)">{d} mm</text>

        <rect x="75" y="110" width="250" height="40" fill="rgba(0,0,0,0.6)" rx="6" />
        <text x="200" y="125" fill="#f1f5f9" fontSize="8" fontWeight="black" textAnchor="middle">{pedra}</text>
        <text x="200" y="137" fill="#94a3b8" fontSize="7" textAnchor="middle">Otimização: Plano 2D com folga de corte de 5mm</text>
      </svg>
    );
  };

  // --- Dynamic SVG Render for Food ---
  const renderFoodSVG = (data) => {
    return (
      <div className="w-full p-4 squad-prototype-blueprint-bg border border-slate-800 rounded-xl space-y-3 bg-slate-950 text-left font-sans">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div>
            <h4 className="text-white text-xs font-black">IdeaFood Faturamento SaaS</h4>
            <p className="text-[9px] text-slate-500">Fluxo de pedidos sincronizado com a cozinha</p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[8px] font-black border border-emerald-500/20">LIVE</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
            <span className="text-[8px] text-slate-500 block uppercase font-black">Pedidos</span>
            <span className="text-sm font-black text-white">42</span>
          </div>
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
            <span className="text-[8px] text-slate-500 block uppercase font-black">Ticket Médio</span>
            <span className="text-sm font-black text-white">R$ 54,80</span>
          </div>
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
            <span className="text-[8px] text-slate-500 block uppercase font-black">Faturamento</span>
            <span className="text-sm font-black text-emerald-400">R$ 2.301</span>
          </div>
        </div>

        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 space-y-1.5 text-[10px]">
          <div className="flex justify-between text-slate-400">
            <span>Servidor API Firebase:</span>
            <span className="text-white font-bold">Online</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Notificação Cozinha (Zustand):</span>
            <span className="text-indigo-400 font-bold">Conectado (WebSockets)</span>
          </div>
        </div>
      </div>
    );
  };

  // --- formatters for visual improvements ---
  const renderOscarBlueprint = () => {
    if (!artifacts.oscar) return null;
    
    let plan = null;
    try {
      plan = JSON.parse(artifacts.oscar);
    } catch (e) {
      return <pre className="squad-code-pre whitespace-pre-wrap text-[11px] leading-relaxed font-mono">{artifacts.oscar}</pre>;
    }

    return (
      <div className="space-y-3.5 text-left font-sans">
        <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider block mb-1">Pensamento do Arquiteto</span>
          <p className="text-[11.5px] text-slate-300 leading-relaxed italic font-bold">"{plan.pensamento}"</p>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block border-b border-slate-800 pb-1.5">Arquivos Afetados no Projeto</span>
          
          <div className="space-y-3 text-xs">
            {plan.arquivosParaLer && plan.arquivosParaLer.length > 0 && (
              <div>
                <span className="text-[8px] text-slate-500 uppercase font-black tracking-wide block mb-1">Arquivos para Leitura (Contexto)</span>
                <div className="space-y-1">
                  {plan.arquivosParaLer.map((arq, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1 px-2.5 bg-slate-950 rounded-lg text-slate-300 font-mono text-[10.5px] border border-slate-850">
                      <span className="text-cyan-400">📖</span>
                      <span className="truncate">{arq}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.arquivosParaAlterar && plan.arquivosParaAlterar.length > 0 && (
              <div>
                <span className="text-[8px] text-slate-500 uppercase font-black tracking-wide block mb-1">Arquivos para Alteração</span>
                <div className="space-y-1">
                  {plan.arquivosParaAlterar.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 px-2.5 bg-slate-950 rounded-lg text-slate-300 font-mono text-[10.5px] border border-slate-850">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-amber-500">🔧</span>
                        <span className="truncate">{a.caminho || a}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-950/60 text-amber-400 border border-amber-800 shrink-0">
                        {a.responsavel || 'Dev'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.arquivosParaCriar && plan.arquivosParaCriar.length > 0 && (
              <div>
                <span className="text-[8px] text-slate-500 uppercase font-black tracking-wide block mb-1">Arquivos para Criar (Novos)</span>
                <div className="space-y-1">
                  {plan.arquivosParaCriar.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 px-2.5 bg-slate-950 rounded-lg text-slate-300 font-mono text-[10.5px] border border-slate-850">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-emerald-500">➕</span>
                        <span className="truncate">{a.caminho || a}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800 shrink-0">
                        {a.responsavel || 'Dev'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-900/30">
          <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider block mb-1">Explicação da Solução</span>
          <p className="text-[11.5px] text-slate-300 leading-relaxed font-bold">{plan.explicacaoDoPlano}</p>
        </div>
      </div>
    );
  };

  const renderHologramContent = () => {
    if (!hologramContent) return null;
    
    // 1. Check if it is a compiler error or log containing technical test failure
    const isError = hologramContent.includes('⚠️') || 
                    hologramContent.includes('❌') || 
                    hologramContent.toLowerCase().includes('failed') || 
                    hologramContent.toLowerCase().includes('error');

    // 2. Check if it's code
    const isCode = hologramContent.startsWith('//') || 
                   hologramContent.includes('import ') || 
                   hologramContent.includes('const ') || 
                   hologramContent.includes('function ') || 
                   hologramContent.includes('export ');

    // 3. Check if it's a marketing campaign (Sabotagem)
    const isMarketing = hologramContent.includes('--- SLOGAN DE MARKETING ---') || 
                        hologramContent.includes('--- COPY INSTAGRAM ---');

    if (isError) {
      return (
        <div className="font-mono text-left text-[11px] leading-relaxed text-red-400 bg-red-950/45 p-3 rounded-xl border border-red-900/40 squad-scrollbar overflow-y-auto max-h-[220px]">
          <span className="text-[8px] font-black uppercase tracking-widest text-red-300 block mb-1.5">⚙️ COMPILATION FAILURE SYSTEM REPORT</span>
          <pre className="whitespace-pre-wrap">{hologramContent}</pre>
        </div>
      );
    }

    if (isCode) {
      const lines = hologramContent.split('\n');
      return (
        <div className="font-mono text-left text-[10.5px] leading-relaxed text-cyan-300 select-text bg-slate-950/75 p-3 rounded-2xl border border-cyan-900/25 max-h-[250px] overflow-y-auto squad-scrollbar">
          {lines.map((line, idx) => {
            if (line.trim().startsWith('//')) {
              return (
                <div key={idx} className="flex items-start">
                  <span className="w-5 text-slate-600 select-none text-right pr-2 shrink-0">{idx + 1}</span>
                  <span className="text-slate-500 italic whitespace-pre-wrap">{line}</span>
                </div>
              );
            }
            
            const keywords = ['import', 'from', 'export', 'default', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'true', 'false'];
            const tokens = line.split(/(\s+|=|\(|\)|\{|\}|\[|\]|;|,)/);
            return (
               <div key={idx} className="flex items-start">
                 <span className="w-5 text-cyan-900 select-none text-right pr-2 shrink-0">{idx + 1}</span>
                 <span className="whitespace-pre-wrap">
                   {tokens.map((token, tIdx) => {
                     if (keywords.includes(token.trim())) {
                       return <span key={tIdx} className="text-fuchsia-400 font-extrabold">{token}</span>;
                     }
                     if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
                       return <span key={tIdx} className="text-yellow-200 font-bold">{token}</span>;
                     }
                     if (token.trim() === 'React' || token.trim() === 'useState' || token.trim() === 'useEffect') {
                       return <span key={tIdx} className="text-teal-300 font-bold">{token}</span>;
                     }
                     return token;
                   })}
                 </span>
               </div>
            );
          })}
        </div>
      );
    }

    if (isMarketing) {
      const parts = hologramContent.split('\n\n');
      let slogan = '';
      let copy = '';
      
      parts.forEach(p => {
        if (p.includes('SLOGAN')) slogan = p.replace(/---.*---/g, '').trim();
        else if (p.includes('COPY') || p.includes('INSTAGRAM')) copy = p.replace(/---.*---/g, '').trim();
      });

      return (
        <div className="space-y-3 text-left font-sans max-w-sm mx-auto">
          {slogan && (
            <div className="bg-gradient-to-r from-pink-650 via-purple-650 to-indigo-650 text-white p-3 rounded-xl shadow border border-pink-500/20 text-center animate-pulse">
              <span className="text-[8px] font-black uppercase tracking-wider block opacity-75">🔥 Slogan de Lançamento</span>
              <h4 className="text-xs font-black mt-1 italic">"{slogan.replace(/"/g, '')}"</h4>
            </div>
          )}
          
          {copy && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-md">
              <div className="flex items-center gap-2 p-2 border-b border-slate-850">
                <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center text-[8px] font-black text-white shrink-0">S</span>
                <div>
                  <span className="text-[9px] font-bold text-white block">sabotagem_copilot</span>
                  <span className="text-[7.5px] text-slate-500 block">Capão Redondo, SP</span>
                </div>
              </div>
              <div className="p-2.5 text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                {copy.replace(/"/g, '')}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div className="squad-3d-log-line whitespace-pre-wrap">{hologramContent}</div>;
  };

  const isLight = theme === 'architecture';
  
  // Base containers
  const panelHeaderBg = isLight ? 'bg-slate-100/90 border-slate-250' : 'bg-slate-950/90 border-slate-800';
  const panelTabsBg = isLight ? 'bg-slate-200/40 border-slate-250' : 'bg-slate-950/40 border-slate-800';
  const textTitle = isLight ? 'text-slate-800' : 'text-white';
  const textPrimary = isLight ? 'text-slate-700' : 'text-slate-200';
  const textSecondary = isLight ? 'text-slate-500' : 'text-slate-400';
  const textMuted = isLight ? 'text-slate-400' : 'text-slate-550';
  
  // Cards & Boxes
  const cardBg = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/60 border-slate-800';
  const boxBg = isLight ? 'bg-indigo-50 border-indigo-200/50' : 'bg-indigo-950/20 border-indigo-900/35';
  const badgeBg = isLight ? 'bg-slate-200 border-slate-350 text-slate-600' : 'bg-slate-850 border-slate-700 text-slate-400';
  const dividerBorder = isLight ? 'border-slate-200' : 'border-slate-850';
  const bgInput = isLight ? 'bg-white border border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500';

  return (
    <div 
      className={`squad-3d-container theme-${theme}`}
      style={{
        fontFamily: customFont,
        ...(customColor ? { '--indigo-500': customColor, '--indigo-600': customColor, '--indigo-650': customColor } : {})
      }}
    >
      {/* 🎬 NASA Loading Screen */}
      {loading3D && (
        <div className="squad-nasa-loading">
          <div className="squad-loading-box">
            <div className="flex items-center gap-3 mb-4 justify-center">
              <span className="text-2xl">🏨</span>
              <h1 style={{fontFamily: "'Press Start 2P', monospace"}} className="text-[11px] tracking-wide text-[#f5a623]">
                SQUAD HOTEL
              </h1>
            </div>
            
            <div className="squad-loading-bar-container">
              <div 
                className="squad-loading-bar-fill"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-[#3ec98c] font-mono mt-1.5 px-1 font-bold">
              <span>CARREGANDO HOTEL...</span>
              <span>{loadingProgress}%</span>
            </div>

            <div className="squad-loading-terminal mt-6 text-left font-mono">
              {loadingLogs.map((log, i) => (
                <div key={i} className="text-[#3ec98c] leading-relaxed text-[11px] font-bold">
                  {log}
                </div>
              ))}
              <div className="text-[#4e5579] animate-pulse text-[11px] mt-1 font-bold">
                &gt; PREPARANDO QUARTOS DOS AGENTES_
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause HUD Indicator */}
      {isPaused && (
        <div className="absolute top-5 right-5 z-40 bg-amber-500/90 text-slate-950 font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-amber-400 animate-pulse">
          <span className="w-2 h-2 rounded bg-slate-950" />
          REUNIÃO PAUSADA
        </div>
      )}
      
      {/* ========================================================= */}
      {/* 3D VIEWPORT (BACKGROUND)                                   */}
      {/* ========================================================= */}
      <div className="squad-3d-viewport">
        <div ref={viewportRef} className="w-full h-full" />
        
        {/* Speech Bubbles */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {Object.keys(AGENTS).map(agentId => (
            <div
              key={agentId}
              ref={bubblesRefs[agentId]}
              className="squad-3d-speech-bubble pointer-events-auto"
              style={{ display: 'none' }}
            >
              <span className="font-extrabold text-[8px] uppercase tracking-widest block mb-1" style={{color: 'var(--sq-accent)'}}>
                {AGENTS[agentId].nome}
              </span>
              {speechText}
            </div>
          ))}
        </div>
      </div>
      
      {/* ========================================================= */}
      {/* TOP BAR                                                    */}
      {/* ========================================================= */}
      <div className="squad-topbar">
        <div className="squad-topbar-left">
          <BackButton to="/master-dashboard" />
          <span className="squad-topbar-title">
            🏨 SQUAD HOTEL <span className="w-2 h-2 rounded-full bg-[#3ec98c] animate-pulse inline-block" />
          </span>
          <span className="text-[10px] font-mono font-bold text-[var(--sq-accent)] opacity-70">
            {timeClock || '00:00:00'}
          </span>
          <span className={`squad-topbar-badge ${
            realExecution 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-[var(--sq-accent)]/10 text-[var(--sq-accent)] border-[var(--sq-accent)]/20'
          }`}>
            {realExecution ? '🤖 OPENCLAW AUTO-PILOT' : 'SIMULAÇÃO'}
          </span>
        </div>
        <div className="squad-topbar-right">
          {/* TTS Toggle */}
          <button
            type="button"
            onClick={() => { setTtsEnabled(prev => !prev); if (ttsEnabled) tts.stop(); }}
            className={`squad-topbar-btn ${ttsEnabled ? 'active' : ''}`}
          >
            {ttsEnabled ? '🔊 TTS' : '🔇 TTS'}
          </button>

          {/* Mute */}
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="squad-topbar-btn"
            title={muted ? "Ativar som" : "Desativar som"}
          >
            {muted ? <IoVolumeMuteOutline size={14} /> : <IoVolumeHighOutline size={14} />}
          </button>

          {/* Coffee Break manual control */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !isCoffeeBreak;
              stateRef.current.isCoffeeBreak = nextVal;
              setIsCoffeeBreak(nextVal);
              playSynthSound(nextVal ? 'click' : 'success');
              addLog(nextVal ? '☕ [Coffee Break] Matheusjardim liberou o time para um café!' : '🔔 [Reunião] Matheusjardim convocou o Squad para a mesa de discussão!');
              toast.info(nextVal ? 'Squad liberado para o Coffee Break!' : 'Squad convocado para a mesa de discussão!');
            }}
            className={`squad-topbar-btn ${isCoffeeBreak ? 'active' : ''}`}
            title={isCoffeeBreak ? "Chamar squad para a reunião" : "Liberar squad para o café"}
          >
            ☕ {isCoffeeBreak ? 'Em Intervalo' : 'Trabalhando'}
          </button>

          {/* Camera Focus Selector */}
          <div className="flex items-center ml-1 mr-1">
            <select
              value={activeAgent || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                setActiveAgent(val);
                addLog(val ? `🎥 Câmera focada em: ${AGENTS[val].nome}` : "🎥 Foco de câmera redefinido para visão geral.");
              }}
              style={{
                background: '#2a3160',
                border: '2px solid #3a4280',
                color: '#b0b7d6',
                fontSize: '10px',
                fontWeight: '700',
                padding: '5px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                outline: 'none'
              }}
              className="hover:text-white hover:border-[var(--sq-accent)] transition-all font-sans"
            >
              <option value="">🎥 Câmera: Geral</option>
              {Object.values(AGENTS).map(ag => (
                <option key={ag.id} value={ag.id} style={{ background: '#1e2347', color: '#fff' }}>
                  {ag.emoji} {ag.nome.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* Theme selector removed */}
        </div>
      </div>

      {/* ========================================================= */}
      {/* COMPACT SIDEBAR                                            */}
      {/* ========================================================= */}
      <div className="squad-3d-sidebar">
        {/* Prompt + Submit */}
        <div className="p-4 flex-grow overflow-y-auto squad-scrollbar space-y-4">
          <form onSubmit={runSquadMeetingSimulation} className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider" style={{color: 'var(--sq-text-dim)'}}>
                Requisito do Projeto
              </span>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={running}
                className="w-full h-24 p-3 bg-[var(--sq-bg)] border border-[var(--sq-border)] text-[var(--sq-text)] rounded-xl focus:ring-1 focus:ring-[var(--sq-accent)] focus:border-[var(--sq-accent)] text-xs font-bold leading-normal resize-none placeholder-[var(--sq-text-muted)]"
                placeholder="Ex: Box Elegance 1500x1900 incolor..."
              />
            </div>

            {/* Real execution toggle */}
            {localServerIp && (
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{borderColor: 'var(--sq-border)', background: 'rgba(124,92,252,0.03)'}}>
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider block" style={{color: 'var(--sq-text-dim)'}}>Execução Real</span>
                  <span className={`text-[8px] font-bold block ${isConnected ? 'text-emerald-400' : realExecution ? 'text-amber-400' : ''}`} style={{color: !isConnected && !realExecution ? 'var(--sq-text-muted)' : undefined}}>
                    {isConnected 
                      ? `✓ Conectado (${localServerIp})` 
                      : realExecution 
                        ? '⏳ Conectando...' 
                        : 'Usar servidor local'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={realExecution} onChange={(e) => setRealExecution(e.target.checked)} />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            )}

            {/* Autopilot config toggle, visible when realExecution is checked */}
            {realExecution && (
              <div className="flex items-center justify-between p-3 rounded-lg border transition-all" style={{borderColor: 'var(--sq-border)', background: 'rgba(59,130,246,0.03)'}}>
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider block" style={{color: 'var(--sq-text-dim)'}}>Modo Autopilot</span>
                  <span className="text-[8px] font-bold block text-blue-400">
                    {autopilotMode === 'autonomous' ? '🤖 Autônomo Completo' : '🛡️ Cauteloso (Aprovações)'}
                  </span>
                </div>
                <div className="flex gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAutopilotMode('cautious')}
                    className={`px-2 py-1 text-[8px] font-black rounded uppercase transition-all ${
                      autopilotMode === 'cautious' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Cauteloso
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutopilotMode('autonomous')}
                    className={`px-2 py-1 text-[8px] font-black rounded uppercase transition-all ${
                      autopilotMode === 'autonomous' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Autônomo
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={running || (!prompt.trim())}
              className="neon-btn w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {running ? '⚡ Processando...' : '🚀 Reunir Squad'}
            </button>
          </form>

          {/* Agent roster mini */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {Object.values(AGENTS).map(ag => {
              const isActive = activeAgent === ag.id;
              return (
                <span key={ag.id} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  isActive 
                    ? 'border-[var(--sq-accent)] text-[var(--sq-accent)]' 
                    : 'border-transparent text-[var(--sq-text-muted)]'
                }`}>
                  {ag.emoji} {ag.nome.split(' ')[0]}
                </span>
              );
            })}
          </div>


        </div>

        {/* Compact Logs */}
        <div className="h-[100px] border-t px-3 py-2 flex flex-col font-mono text-[9px] leading-tight overflow-hidden shrink-0" style={{borderColor: 'var(--sq-border)', color: 'var(--sq-text-muted)', background: 'rgba(0,0,0,0.15)'}}>
          <span className="font-black uppercase tracking-widest block mb-1.5 text-[8px]" style={{color: 'var(--sq-text-muted)'}}>Logs</span>
          <div className="flex-grow overflow-y-auto squad-scrollbar space-y-0.5">
            {logs.slice(-8).map((log, index) => (
              <div key={index} className="whitespace-pre-wrap leading-normal">{log}</div>
            ))}
            {logs.length === 0 && <div style={{color: 'var(--sq-text-muted)'}}>Aguardando...</div>}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL — Chat + Deliveries                            */}
      {/* ========================================================= */}
      <div className="squad-project-board">
        {(aiData || running) ? (
          <>
            {/* Header / Pipeline Stepper */}
            <div className={`p-4.5 border-b space-y-3.5 ${panelHeaderBg}`}>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-indigo-400 font-black tracking-widest uppercase flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                  Mural de Entregas do Projeto
                </span>
                <span className={`px-2.5 py-0.5 text-[9px] rounded-full font-bold uppercase border ${badgeBg}`}>
                  {running ? 'Gerando...' : 'Pronto'}
                </span>
              </div>

              {/* Step Pipeline Tracker */}
              <div className="squad-pipeline py-1">
                <div className="squad-step-line" />
                <div 
                  className="squad-step-line-active" 
                  style={{
                    width: currentPhase === 'architecture' ? '10%' 
                           : currentPhase === 'ui' ? '30%' 
                           : currentPhase === 'backend' ? '55%' 
                           : currentPhase === 'qa' ? '80%' 
                           : currentPhase === 'marketing' || currentPhase === 'done' ? '100%' 
                           : '0%'
                  }}
                />
                
                {Object.values(AGENTS).map((ag, idx) => {
                  const stepIndex = ['architecture', 'ui', 'backend', 'qa', 'marketing'];
                  const phaseIndex = stepIndex.indexOf(currentPhase);
                  const isCurrent = currentPhase === ag.phase;
                  const isPast = currentPhase === 'done' || stepIndex.indexOf(currentPhase) > idx;
                  
                  return (
                    <div key={ag.id} className="squad-step-dot flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-350 ${
                        isPast ? 'bg-indigo-650 border-indigo-400 text-white' 
                        : isCurrent ? 'bg-pink-600 border-pink-400 text-white shadow-[0_0_10px_rgba(219,39,119,0.5)] animate-pulse'
                        : (isLight ? 'bg-slate-200 border-slate-300 text-slate-400' : 'bg-slate-950 border-slate-850 text-slate-500')
                      }`}>
                        {isPast ? '✓' : ag.emoji}
                      </div>
                      <span className={`text-[8.5px] font-black uppercase mt-1 ${isCurrent ? 'text-indigo-400' : 'text-slate-500'}`}>{ag.nome.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className={`p-3 border-b ${panelTabsBg}`}>
              <div className="squad-tabs">
                <button 
                  onClick={() => setSelectedTab('conversa')} 
                  className={`squad-tab-btn ${selectedTab === 'conversa' ? 'active' : ''}`}
                >
                  <FaComment size={12} />
                  Discussão
                </button>
                <button 
                  onClick={() => setSelectedTab('geral')} 
                  className={`squad-tab-btn ${selectedTab === 'geral' ? 'active' : ''}`}
                >
                  <FaBookOpen size={12} />
                  Geral
                </button>
                <button 
                  onClick={() => setSelectedTab('prototipo')} 
                  className={`squad-tab-btn ${selectedTab === 'prototipo' ? 'active' : ''}`}
                >
                  <FaTools size={12} />
                  Protótipo
                </button>
                <button 
                  onClick={() => setSelectedTab('suprimentos')} 
                  className={`squad-tab-btn ${selectedTab === 'suprimentos' ? 'active' : ''}`}
                >
                  <FaShoppingCart size={12} />
                  Suprimentos
                </button>
                <button 
                  onClick={() => setSelectedTab('oscar')} 
                  className={`squad-tab-btn ${selectedTab === 'oscar' ? 'active' : ''}`}
                >
                  <FaCode size={12} />
                  Oscar
                </button>
                <button 
                  onClick={() => setSelectedTab('leo')} 
                  className={`squad-tab-btn ${selectedTab === 'leo' ? 'active' : ''}`}
                >
                  <FaCode size={12} />
                  Sheldon
                </button>
                <button 
                  onClick={() => setSelectedTab('afrodite')} 
                  className={`squad-tab-btn ${selectedTab === 'afrodite' ? 'active' : ''}`}
                >
                  <FaDatabase size={12} />
                  Nairobi
                </button>
                <button 
                  onClick={() => setSelectedTab('thor')} 
                  className={`squad-tab-btn ${selectedTab === 'thor' ? 'active' : ''}`}
                >
                  <FaCheckCircle size={12} />
                  Ragnar
                </button>
                <button 
                  onClick={() => setSelectedTab('sabotagem')} 
                  className={`squad-tab-btn ${selectedTab === 'sabotagem' ? 'active' : ''}`}
                >
                  <FaBullhorn size={12} />
                  Marketing
                </button>
                <button 
                  onClick={() => setSelectedTab('bmad')} 
                  className={`squad-tab-btn ${selectedTab === 'bmad' ? 'active' : ''}`}
                >
                  <FaFileAlt size={12} />
                  Documentos
                </button>
                <button 
                  onClick={() => setSelectedTab('telemetria')} 
                  className={`squad-tab-btn ${selectedTab === 'telemetria' ? 'active' : ''}`}
                >
                  <FaChartLine size={12} />
                  Telemetria
                </button>
              </div>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 overflow-y-auto p-4.5 pdv-scroll space-y-4">
              {selectedTab === 'conversa' && (
                <SquadChatPanel
                  chatThread={chatThread}
                  activeAgent={activeAgent}
                  running={running}
                  isLight={isLight}
                  feedbackText={feedbackText}
                  setFeedbackText={setFeedbackText}
                  handleSendFeedback={handleSendFeedback}
                  waitingForUser={waitingForUser}
                  handleApproveAndProceed={handleApproveAndProceed}
                />
              )}

              {/* TAB 1: GERAL (OVERVIEW) */}
              {selectedTab === 'geral' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Resumo do Requisito</h3>
                  
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex justify-between text-[12px] border-b border-slate-850 pb-1.5">
                      <span className="text-slate-500">Projeto Detectado:</span>
                      <span className="text-white font-bold uppercase">{domainDetected === 'glass' ? 'IdeaGlass (Vidros)' : domainDetected === 'marble' ? 'IdeaMarmore (Mármore)' : 'IdeaFood (Alimentação)'}</span>
                    </div>
                    {aiData?.clienteNome && (
                      <div className="flex justify-between text-[12px] border-b border-slate-850 pb-1.5">
                        <span className="text-slate-500">Cliente:</span>
                        <span className="text-indigo-300 font-bold">{aiData.clienteNome}</span>
                      </div>
                    )}
                    {aiData?.clienteTelefone && (
                      <div className="flex justify-between text-[12px] border-b border-slate-850 pb-1.5">
                        <span className="text-slate-500">Contato:</span>
                        <span className="text-slate-300">{aiData.clienteTelefone}</span>
                      </div>
                    )}
                    {aiData?.clienteEndereco && (
                      <div className="flex justify-between text-[12px] border-b border-slate-850 pb-1.5">
                        <span className="text-slate-500">Endereço:</span>
                        <span className="text-slate-350 line-clamp-1">{aiData.clienteEndereco}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[12px] border-b border-slate-850 pb-1.5">
                      <span className="text-slate-500">Modelo:</span>
                      <span className="text-white font-bold">{aiData?.modeloNome || aiData?.modelo || 'Painel modular'}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500">Dimensões:</span>
                      <span className="text-indigo-400 font-extrabold text-[12.5px]">
                        {aiData?.largura ? `${aiData.largura}mm` : 'Lógico'} 
                        {aiData?.altura ? ` x ${aiData.altura}mm` : ''}
                        {aiData?.profundidade ? ` x ${aiData.profundidade}mm` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-900/35">
                    <span className="text-[10px] text-indigo-400 block font-black uppercase tracking-wider mb-1">Entendimento da IA</span>
                    <p className="text-[11.5px] text-slate-300 leading-relaxed font-bold">
                      {aiData?.explicacao || 'Processando as regras comerciais estruturadas do projeto...'}
                    </p>
                  </div>

                  {aiData?.observacoes && (
                    <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                      <span className="text-[10px] text-slate-500 block uppercase font-black mb-1">Observações Técnicas</span>
                      <p className="text-[11.5px] text-slate-400 leading-normal">
                        {aiData.observacoes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PROTÓTIPO VISUAL (LEO) */}
              {selectedTab === 'prototipo' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Protótipo HTML/SVG Gerado</h3>
                    <span className="text-[10px] text-slate-400 font-bold">Gerado por Leo 🎨</span>
                  </div>

                  {(!aiData || currentPhase === 'architecture') ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-[11px]">
                      Aguardando Leo desenhar a interface UI...
                    </div>
                  ) : (
                    <div className="squad-prototype-container p-3 w-full">
                      {domainDetected === 'glass' && renderGlassSVG(aiData)}
                      {domainDetected === 'marble' && renderMarbleSVG(aiData)}
                      {domainDetected === 'food' && renderFoodSVG(aiData)}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SUPRIMENTOS (ESTOQUE & COMPRAS DEBATE) */}
              {selectedTab === 'suprimentos' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Estoque & Logística de Insumos</h3>
                    <span className="text-[10px] text-slate-400 font-bold">Papo de Estoque 📦</span>
                  </div>

                  {!artifacts.suprimentos ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-[11px]">
                      Aguardando debate de suprimentos no fluxo de banco de dados...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      
                      <div className="bg-slate-950/65 p-4.5 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                          <span>Material: <span className="text-indigo-400">{inventoryData.materialName}</span></span>
                          <span className={inventoryData.status === 'insufficient' ? 'text-red-400' : 'text-emerald-400'}>
                            {inventoryData.status === 'insufficient' ? 'Estoque Insuficiente' : 'Estoque Seguro'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                          <span>Consumo do Projeto: {inventoryData.required} {inventoryData.unit}</span>
                          <span>Estoque Físico: {inventoryData.stock} {inventoryData.unit}</span>
                        </div>

                        <div className="squad-inventory-bar">
                          <div 
                            className={`squad-inventory-fill ${inventoryData.status === 'insufficient' ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (inventoryData.stock / Math.max(1, inventoryData.required)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4.5 font-mono text-[11.5px] leading-relaxed text-indigo-200 whitespace-pre-wrap max-h-64 overflow-y-auto squad-scrollbar">
                        {artifacts.suprimentos}
                      </div>

                      {inventoryData.status === 'insufficient' && (
                        <div className={`squad-purchase-card ${inventoryApproved ? 'success' : ''} space-y-3`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Ordem de Compra Automatizada</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">Sugerido para suprimento de falta de estoque</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-900 border border-slate-700 font-bold">
                              {inventoryApproved ? 'PEDIDO ENVIADO' : 'PENDENTE'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Fornecedor</span>
                              <span className="text-white font-bold">{inventoryData.supplier}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Custo Estimado</span>
                              <span className="text-emerald-400 font-black">R$ {inventoryData.cost},00</span>
                            </div>
                          </div>

                          {!inventoryApproved ? (
                            <button
                              onClick={approvePurchaseOrder}
                              className="w-full py-2.5 bg-red-650 hover:bg-red-600 active:scale-95 text-white font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all duration-300"
                            >
                              <FaShoppingCart size={13} /> Aprovar e Comprar Material
                            </button>
                          ) : (
                            <div className="text-center py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-400 font-black">
                              ✓ Compra efetuada e confirmada via API do Fornecedor!
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Oscar */}
              {selectedTab === 'oscar' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Blueprint Arquitetônico</h3>
                    <button 
                      onClick={() => copyToClipboard(artifacts.oscar, 'Blueprint')}
                      className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-white"
                      disabled={!artifacts.oscar}
                    >
                      <FaCopy size={12} /> Copiar
                    </button>
                  </div>

                  {!artifacts.oscar ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">🔍</div>
                      <div className="text-slate-500 font-bold text-[11px]">Oscar Niemeyer está analisando a arquitetura...</div>
                      <div className="text-slate-600 text-[10px]">O plano arquitetônico aparecerá aqui quando ele concluir a análise.</div>
                    </div>
                  ) : (
                    renderOscarBlueprint()
                  )}
                </div>
              )}

              {/* TAB: Sheldon (Front-end) */}
              {selectedTab === 'leo' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Código de Interface</h3>
                    <button 
                      onClick={() => copyToClipboard(typeof artifacts.leo === 'string' ? artifacts.leo : JSON.stringify(artifacts.leo, null, 2), 'Código de Front-end')}
                      className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-white"
                      disabled={!artifacts.leo}
                    >
                      <FaCopy size={12} /> Copiar
                    </button>
                  </div>

                  {!artifacts.leo ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">🎨</div>
                      <div className="text-slate-500 font-bold text-[11px]">Bazinga! Sheldon está programando a interface...</div>
                      <div className="text-slate-600 text-[10px]">O código de front-end aparecerá aqui com precisão de pixel.</div>
                    </div>
                  ) : (
                    <pre className="squad-code-pre">{typeof artifacts.leo === 'string' ? artifacts.leo : JSON.stringify(artifacts.leo, null, 2)}</pre>
                  )}
                </div>
              )}

              {/* TAB: Nairobi (Backend) */}
              {selectedTab === 'afrodite' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Lógica & Conector Firebase</h3>
                    <button 
                      onClick={() => copyToClipboard(artifacts.afrodite, 'Serviço Firestore')}
                      className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-white"
                      disabled={!artifacts.afrodite}
                    >
                      <FaCopy size={12} /> Copiar
                    </button>
                  </div>

                  {!artifacts.afrodite ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">🌸</div>
                      <div className="text-slate-500 font-bold text-[11px]">Que comece o matriarcado! Nairobi está conectando o banco...</div>
                      <div className="text-slate-600 text-[10px]">A lógica de backend e Firestore aparecerá aqui.</div>
                    </div>
                  ) : (
                    <pre className="squad-code-pre">{artifacts.afrodite}</pre>
                  )}
                </div>
              )}

              {/* TAB: Ragnar (QA) */}
              {selectedTab === 'thor' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Terminal de Build & Testes</h3>
                    <span className="text-[10px] text-slate-400 font-bold">Validador Ragnar ⚡</span>
                  </div>

                  {!artifacts.thor ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">⚡</div>
                      <div className="text-slate-500 font-bold text-[11px]">Ragnar está preparando o machado viking para os testes...</div>
                      <div className="text-slate-600 text-[10px]">Os resultados do build e validação aparecerão aqui.</div>
                    </div>
                  ) : (
                    <pre className="squad-code-pre text-emerald-400 border-emerald-950 bg-slate-950 font-mono whitespace-pre-wrap leading-relaxed">
                      {artifacts.thor}
                    </pre>
                  )}
                </div>
              )}

              {/* TAB 7: Sabotagem */}
              {selectedTab === 'sabotagem' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Copy & Marketing de Lançamento</h3>
                    <button 
                      onClick={() => copyToClipboard(artifacts.sabotagem, 'Campanha de Marketing')}
                      className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-white"
                      disabled={!artifacts.sabotagem}
                    >
                      <FaCopy size={12} /> Copiar
                    </button>
                  </div>

                  {!artifacts.sabotagem ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">🎤</div>
                      <div className="text-slate-500 font-bold text-[11px]">Sabotagem está rimando a campanha de marketing...</div>
                      <div className="text-slate-600 text-[10px]">O slogan e a copy do Instagram aparecerão aqui.</div>
                    </div>
                  ) : (
                    <pre className="squad-code-pre text-pink-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {artifacts.sabotagem}
                    </pre>
                  )}
                </div>
              )}

              {/* TAB: Documentos (antigo BMAD) */}
              {selectedTab === 'bmad' && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Documentos do Projeto</h3>
                    <button 
                      onClick={() => copyToClipboard(bmadDocs[activeBmadFile], 'Artefato BMAD')}
                      className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-white"
                      disabled={!bmadDocs[activeBmadFile]}
                    >
                      <FaCopy size={12} /> Copiar
                    </button>
                  </div>

                  {/* Sub-selector for BMAD Files */}
                  <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    {[
                      { path: 'planning-artifacts/prd.md', label: 'PRD' },
                      { path: 'planning-artifacts/system_architecture.md', label: 'Arquitetura' },
                      { path: 'implementation-artifacts/implementation_plan.md', label: 'Plano de Impl.' },
                      { path: 'implementation-artifacts/verification_log.md', label: 'Log de Verif.' },
                      { path: 'planning-artifacts/marketing_campaign.md', label: 'Mkt / Campanha' }
                    ].map((doc) => {
                      const isActive = activeBmadFile === doc.path;
                      const hasContent = !!bmadDocs[doc.path];
                      return (
                        <button
                          key={doc.path}
                          onClick={() => hasContent && setActiveBmadFile(doc.path)}
                          className={`bmad-sub-tab-btn px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-200 flex-grow ${
                            isActive 
                              ? 'bg-indigo-650/30 border-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white'
                          } ${!hasContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {doc.label} {!hasContent && '⏳'}
                        </button>
                      );
                    })}
                  </div>

                  {!bmadDocs[activeBmadFile] ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="text-3xl">📄</div>
                      <div className="text-slate-500 font-bold text-[11px]">Documento "{activeBmadFile.split('/').pop()}" ainda não foi gerado.</div>
                      <div className="text-slate-600 text-[10px]">Inicie uma reunião e os documentos serão criados automaticamente em cada fase.</div>
                    </div>
                  ) : (
                    <pre className="squad-code-pre text-indigo-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[350px] overflow-y-auto squad-scrollbar">
                      {bmadDocs[activeBmadFile]}
                    </pre>
                  )}
                </div>
              )}

              {/* TAB: TELEMETRIA (NASA MISSION CONTROL) */}
              {selectedTab === 'telemetria' && (
                <div className="space-y-4 font-sans text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      NASA Mission Control Telemetry
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 text-[8px] font-black border border-cyan-800">
                      TELEMETRY LEVEL 4
                    </span>
                  </div>

                  {/* Operational Metrics Cards */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Consumo de Tokens</span>
                      <span className="text-xs font-black text-cyan-400 font-mono">
                        {totalTokens.toLocaleString('pt-BR')} <span className="text-[9px] text-slate-400 font-sans font-normal">tokens</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Chamadas de IA / Latência</span>
                      <span className="text-xs font-black text-white font-mono">
                        {apiCalls} reqs <span className="text-[9px] text-emerald-450 font-normal">● {avgResponseTime > 0 ? `${avgResponseTime}ms méd` : 'nominal'}</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Latência do Firebase</span>
                      <span className="text-xs font-black text-white/90 font-mono">14 ms <span className="text-[9px] text-emerald-450">● Nominal</span></span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Custo Est. (LLM)</span>
                      <span className="text-xs font-black text-cyan-400 font-mono">
                        ${(totalTokens * 0.00000015).toFixed(6)} <span className="text-[8px] text-slate-500 font-sans font-normal">USD</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">CPU / Memória</span>
                      <span className="text-xs font-black text-white/90 font-mono">4.2% / 128MB</span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Canal WebSocket</span>
                      <span className="text-xs font-black text-white font-mono">Habilitado <span className="text-[9px] text-emerald-450">● Online</span></span>
                    </div>
                  </div>

                  {/* System log terminal */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Cofre de Memórias BMAD (Active Vault)</span>
                    <div className="bg-slate-950/95 border border-slate-850 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-cyan-300 space-y-3.5 max-h-64 overflow-y-auto squad-scrollbar">
                      <div className="border-b border-slate-900 pb-2 space-y-1">
                        <span className="text-[9px] text-slate-500 block">TASK SUMMARY</span>
                        <p className="text-[11.5px] font-bold text-white leading-normal">
                          Requisito: "{prompt}"
                        </p>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-500 block">SQUAD MEMORY POOL</span>
                        <div className="space-y-1.5 text-[10.5px]">
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span>Oscar Niemeyer indexou a arquitetura do projeto na sub-coleção Firestore.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span>Shaldon estilizou componentes com design premium e layout responsivo.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span>Nairobi validou a integridade de leitura/escrita de dados.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span>Ragnar decapitou os bugs e realizou o build final.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span>Sabotagem engajou a rima comercial para captação de clientes.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Central Hologram Terminal (embedded in board bottom) */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-1.5">
              <span className="text-[9px] text-slate-500 font-black uppercase block">Holograma HUD central</span>
              <div className="squad-3d-hologram-screen squad-scrollbar">
                {renderHologramContent()}
              </div>
            </div>

          </>
        ) : (
          /* Empty state — no simulation running */
          <div className="flex-grow flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <span className="text-4xl">🚀</span>
              <p className="text-sm font-bold" style={{color: 'var(--sq-text-dim)'}}>
                Envie um requisito na sidebar para iniciar a reunião do Squad
              </p>
              <p className="text-[10px]" style={{color: 'var(--sq-text-muted)'}}>
                Os agentes vão debater e gerar artefatos em tempo real
              </p>
            </div>
          </div>
        )}
      </div>

      <SquadBottomBar currentPhase={currentPhase} />
    </div>
  );
}