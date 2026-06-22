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

export default function SquadMeeting3D() {
  const { socket, isConnected, localServerIp } = useLocalSync();
  // Will be initialized after state declarations below
  const [realExecution, setRealExecution] = useState(false);
  const [validationCommand, setValidationCommand] = useState('npm run build');
  const hologramModelRef = useRef(null);
  const resolvePromiseRef = useRef(null);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeQuestion, setActiveQuestion] = useState('');

  const [prompt, setPrompt] = useState('Criar um box elegance de vidro temperado incolor de 1400x1900 para o cliente Matheus Jardim');
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
    hologramColor: 0 // 0 means not set, use theme default
  });
  const themeRef = useRef('architecture');
  const speechTextRef = useRef('');

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Initialize TTS hook
  const tts = useTTS({ muted: muted || !ttsEnabled, globalRate: ttsRate, globalVolume: ttsVolume });

  useEffect(() => {
    speechTextRef.current = speechText;
  }, [speechText]);

  // Auto-speak when an agent has a new speech text
  useEffect(() => {
    if (speechText && activeAgent && ttsEnabled && !muted) {
      tts.speak(activeAgent, speechText, true);
    }
  }, [speechText, activeAgent]);

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

  // Rebuild the 3D hologram model dynamically when aiData or domainDetected changes
  useEffect(() => {
    if (!hologramModelRef.current) return;
    const group = hologramModelRef.current;

    // Clear previous elements
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (!aiData || domainDetected === 'dashboard') {
      // Default / Dashboard: Empty (no globe/hologram in the middle)
      return;
    }

    // Build based on domain
    if (domainDetected === 'glass') {
      const w = aiData.largura || 1400;
      const h = aiData.altura || 1900;
      const cor = aiData.corVidro || 'Incolor';
      const metal = aiData.corAluminio || 'fosco';
      const pux = aiData.puxador || 'padrao';

      let glassColor = 0x38bdf8;
      if (cor === 'Fumê') glassColor = 0x4b5563;
      else if (cor === 'Bronze') glassColor = 0xb45309;
      else if (cor === 'Verde') glassColor = 0x10b981;

      let metalColor = 0x94a3b8;
      if (metal === 'preto') metalColor = 0x1e293b;
      else if (metal === 'branco') metalColor = 0xf8fafc;
      else if (metal === 'bronze') metalColor = 0x78350f;
      else if (metal === 'brilhante') metalColor = 0xe2e8f0;

      const glassMat = new THREE.MeshStandardMaterial({
        color: glassColor,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.9,
        emissive: glassColor,
        emissiveIntensity: 0.15,
        side: THREE.DoubleSide
      });

      const metalMat = new THREE.MeshStandardMaterial({
        color: metalColor,
        transparent: true,
        opacity: 0.7,
        roughness: 0.2,
        metalness: 0.8,
        emissive: metalColor,
        emissiveIntensity: 0.1
      });

      // Bottom rail
      const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.015, 0.03), metalMat);
      bottomRail.position.set(0, -0.22, 0);
      group.add(bottomRail);

      // Top rail
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.015, 0.03), metalMat);
      topRail.position.set(0, 0.22, 0);
      group.add(topRail);

      // Fixed glass panel
      const fixedPanel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.006), glassMat);
      fixedPanel.position.set(-0.11, 0, -0.005);
      group.add(fixedPanel);

      // Sliding glass panel
      const slidingPanel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.42, 0.006), glassMat);
      slidingPanel.position.set(0.11, 0, 0.005);
      group.add(slidingPanel);

      // Handle (puxador)
      if (pux === 'knob') {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 8), metalMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0.03, 0, 0.01);
        group.add(handle);
      } else if (pux === 'padrao') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.08, 0.008), metalMat);
        handle.position.set(0.03, 0, 0.01);
        group.add(handle);
      }

      // Add thin glowing wireframe for futuristic look
      const wireframeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
      const edges = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.BoxGeometry(0.5, 0.44, 0.04)), wireframeMat);
      group.add(edges);

    } else if (domainDetected === 'marble') {
      const w = aiData.largura || 1800;
      const d = aiData.profundidade || 600;
      const pedra = aiData.pedra || 'Granito Verde Ubatuba';
      const saia = aiData.saiaAtiva ?? true;
      const rodo = aiData.rodopiaAtivo ?? true;

      let stoneColor = 0x065f46;
      if (pedra.toLowerCase().includes('preto')) stoneColor = 0x1e293b;
      else if (pedra.toLowerCase().includes('cinza')) stoneColor = 0x475569;
      else if (pedra.toLowerCase().includes('carrara') || pedra.toLowerCase().includes('branco')) stoneColor = 0xf1f5f9;
      else if (pedra.toLowerCase().includes('travertino') || pedra.toLowerCase().includes('amarelo')) stoneColor = 0xfef08a;

      const stoneMat = new THREE.MeshStandardMaterial({
        color: stoneColor,
        transparent: true,
        opacity: 0.6,
        roughness: 0.15,
        metalness: 0.2,
        emissive: stoneColor,
        emissiveIntensity: 0.1
      });

      // Countertop
      const countertop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.018, 0.32), stoneMat);
      countertop.position.set(0, 0, 0);
      group.add(countertop);

      // Rodopia
      if (rodo) {
        const rodopia = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.01), stoneMat);
        rodopia.position.set(0, 0.038, -0.155);
        group.add(rodopia);
      }

      // Saia
      if (saia) {
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.01), stoneMat);
        skirt.position.set(0, -0.028, 0.155);
        group.add(skirt);
      }

      // Basin
      const basinMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.5,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x64748b,
        emissiveIntensity: 0.05
      });
      const basin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), basinMat);
      basin.position.set(0, -0.04, 0);
      group.add(basin);

      // Tech outline
      const wireframeMat = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.3 });
      const edges = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.BoxGeometry(0.55, 0.06, 0.32)), wireframeMat);
      group.add(edges);

    } else if (domainDetected === 'food') {
      // Burger
      const topBunMat = new THREE.MeshStandardMaterial({ color: 0xb45309, transparent: true, opacity: 0.7, emissive: 0xb45309, emissiveIntensity: 0.1 });
      const topBun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), topBunMat);
      topBun.position.set(0, 0.07, 0);
      group.add(topBun);

      const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xeab308, transparent: true, opacity: 0.8, emissive: 0xeab308, emissiveIntensity: 0.15 });
      const cheese = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.008, 0.21), cheeseMat);
      cheese.position.set(0, 0.04, 0);
      cheese.rotation.y = 0.45;
      group.add(cheese);

      const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, transparent: true, opacity: 0.7, emissive: 0x22c55e, emissiveIntensity: 0.1 });
      const lettuce = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), lettuceMat);
      lettuce.position.set(0, 0.05, 0);
      group.add(lettuce);

      const pattyMat = new THREE.MeshStandardMaterial({ color: 0x451a03, transparent: true, opacity: 0.75, emissive: 0x451a03, emissiveIntensity: 0.05 });
      const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.032, 12), pattyMat);
      patty.position.set(0, 0.012, 0);
      group.add(patty);

      const bottomBun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), topBunMat);
      bottomBun.position.set(0, -0.02, 0);
      group.add(bottomBun);

      // Tech outline
      const wireframeMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.35 });
      const edges = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12)), wireframeMat);
      group.add(edges);
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

  // Three.js Render Logic
  useEffect(() => {
    if (!viewportRef.current) return;

    viewportRef.current.innerHTML = '';
    const width = viewportRef.current.clientWidth || 500;
    const height = viewportRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    const NORMAL_POSITIONS = {
      oscar: { x: -3.0, z: -3.0 },
      leo: { x: 3.0, z: -2.6 },
      afrodite: { x: -3.0, z: 3.0 },
      thor: { x: 0.0, z: -4.0 },
      sabotagem: { x: 3.0, z: 3.0 }
    };

    const isSittingNormal = {
      oscar: false,
      leo: true,
      afrodite: true,
      thor: false,
      sabotagem: true
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewportRef.current.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf1f5f9, 1.3);
    scene.add(hemiLight);

    const spotlight = new THREE.SpotLight(0xfff7ed, 3.2); // Luz direcional quente
    spotlight.position.set(0, 5, 0);
    spotlight.angle = Math.PI / 3.5;
    spotlight.penumbra = 0.5;
    spotlight.castShadow = true;
    scene.add(spotlight);

    const accentLight = new THREE.PointLight(0x4f46e5, 2.5, 12); // Luz de destaque indigo
    accentLight.position.set(0, 1.2, 0);
    scene.add(accentLight);

    // 1. Habbo Hotel Checkered Floor Tiles
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.1 }); 
    const floorMat2 = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5, metalness: 0.1 }); 
    
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);

    // Build the checkered tile grid floor (15x15 tiles)
    for (let x = -7; x <= 7; x++) {
      for (let z = -7; z <= 7; z++) {
        const isAlternate = (x + z) % 2 === 0;
        const tileMat = isAlternate ? floorMat : floorMat2;
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.95), tileMat);
        tile.position.set(x, -0.02, z);
        tile.receiveShadow = true;
        floorGroup.add(tile);
      }
    }

    // Outer dark floor for the Habbo float-in-space look
    const outerFloorGeo = new THREE.PlaneGeometry(50, 50);
    const outerFloorMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 1.0 }); 
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.04;
    scene.add(outerFloor);

    // Grid helper (retained for theme switching reference, styled very subtly as tile grid lines)
    const gridHelper = new THREE.GridHelper(15, 15, 0xe2e8f0, 0xe2e8f0);
    gridHelper.position.y = 0.005;
    gridHelper.visible = false; // Hide grid helper by default to use tiles
    scene.add(gridHelper);

    // Neon floor rings (removed visual geometry but declared variable for compatibility)
    const floorRings = [];
    const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5, transparent: true, opacity: 0 });

    // Scene materials (retained for theme switching compatibility)
    const panelBackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.55 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.8 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.95, roughness: 0.05 });
    const windowGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.07, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide });
    const telemetryGridMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    const monitorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.5 });
    
    // L-Shaped Corner Walls (Habbo Room Scenery)
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);

    // Left Wall Parts (X = -7.5)
    // 1. Baseboard (Rodapé)
    const baseboardL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 15.0), frameMat);
    baseboardL.position.set(-7.44, 0.1, 0);
    baseboardL.receiveShadow = true;
    baseboardL.castShadow = true;
    wallGroup.add(baseboardL);

    // 2. Wall Bottom
    const wallBottomL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 15.0), panelBackMat);
    wallBottomL.position.set(-7.46, 1.0, 0);
    wallBottomL.receiveShadow = true;
    wallBottomL.castShadow = true;
    wallGroup.add(wallBottomL);

    // 3. Middle Wood Trim
    const wallTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 15.0), frameMat);
    wallTrimL.position.set(-7.44, 1.94, 0);
    wallTrimL.receiveShadow = true;
    wallTrimL.castShadow = true;
    wallGroup.add(wallTrimL);

    // 4. Wall Top
    const wallTopL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.0, 15.0), slatMat);
    wallTopL.position.set(-7.47, 3.48, 0);
    wallTopL.receiveShadow = true;
    wallTopL.castShadow = true;
    wallGroup.add(wallTopL);

    // Right Wall Parts (Z = -7.5)
    // 1. Baseboard (Rodapé)
    const baseboardR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.2, 0.12), frameMat);
    baseboardR.position.set(0, 0.1, -7.44);
    baseboardR.receiveShadow = true;
    baseboardR.castShadow = true;
    wallGroup.add(baseboardR);

    // 2. Wall Bottom
    const wallBottomR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 1.8, 0.08), panelBackMat);
    wallBottomR.position.set(0, 1.0, -7.46);
    wallBottomR.receiveShadow = true;
    wallBottomR.castShadow = true;
    wallGroup.add(wallBottomR);

    // 3. Middle Wood Trim
    const wallTrimR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.08, 0.12), frameMat);
    wallTrimR.position.set(0, 1.94, -7.44);
    wallTrimR.receiveShadow = true;
    wallTrimR.castShadow = true;
    wallGroup.add(wallTrimR);

    // 4. Wall Top
    const wallTopR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 3.0, 0.06), slatMat);
    wallTopR.position.set(0, 3.48, -7.47);
    wallTopR.receiveShadow = true;
    wallTopR.castShadow = true;
    wallGroup.add(wallTopR);

    // Habbo Windows
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const windowGlassSkyMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.1
    });

    // Left Window
    const leftWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.2), windowFrameMat);
    leftWindowFrame.position.set(-7.42, 3.2, -2.5);
    wallGroup.add(leftWindowFrame);

    const leftWindowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 1.0), windowGlassSkyMat);
    leftWindowGlass.position.set(-7.41, 3.2, -2.5);
    wallGroup.add(leftWindowGlass);

    // Right Window
    const rightWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.12), windowFrameMat);
    rightWindowFrame.position.set(2.5, 3.2, -7.42);
    wallGroup.add(rightWindowFrame);

    const rightWindowGlass = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.10), windowGlassSkyMat);
    rightWindowGlass.position.set(2.5, 3.2, -7.41);
    wallGroup.add(rightWindowGlass);

    // Habbo Duck Poster / Painting
    const duckPainting = new THREE.Group();
    duckPainting.position.set(-7.42, 3.2, 2.5);
    duckPainting.rotation.y = Math.PI / 2;
    wallGroup.add(duckPainting);

    // Frame
    const framePaint = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.04), frameMat);
    duckPainting.add(framePaint);

    // Canvas background (classic Habbo green background)
    const canvasPaint = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x0f9f59, roughness: 0.9 }));
    canvasPaint.position.z = 0.02;
    duckPainting.add(canvasPaint);

    // Yellow Duck body (pixelated)
    const duckBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }));
    duckBody.position.set(-0.06, -0.08, 0.05);
    duckPainting.add(duckBody);

    const duckHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }));
    duckHead.position.set(0.08, 0.06, 0.05);
    duckPainting.add(duckHead);

    const duckBeak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.10), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
    duckBeak.position.set(0.18, 0.05, 0.05);
    duckPainting.add(duckBeak);

    const duckEye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    duckEye.position.set(0.10, 0.09, 0.11);
    duckPainting.add(duckEye);

    // Empty servers/leds array for backwards compatibility
    const serverLeds = [];

    // Outer sky/stars bokeh group styled to look like simple window backdrop stars
    const bokehGroup = new THREE.Group();
    scene.add(bokehGroup);
    const starGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    for (let j = 0; j < 30; j++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        -15.0 - Math.random() * 5.0,
        2.0 + Math.random() * 4.0,
        -15.0 - Math.random() * 5.0
      );
      bokehGroup.add(star);
    }

    // Scene Materials (retained for theme switching compatibility)
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1b96d3,
      transparent: true,
      opacity: 0.5,
      roughness: 0.15,
      metalness: 0.8
    });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.18 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, metalness: 0.9, roughness: 0.25 });
    const tableGlowMat = new THREE.MeshBasicMaterial({ color: 0x1b96d3, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });

    // Rugs
    const rugMat1 = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.95 });
    const rug1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.005, 1.2), rugMat1);
    rug1.position.set(2.4, 0.002, -2.4);
    rug1.rotation.y = Math.PI / 4;
    scene.add(rug1);

    const rugMat2 = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.95 });
    const rug2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.002, 1.2), rugMat2);
    rug2.position.set(-3.0, 0.002, 3.0);
    rug2.rotation.y = Math.PI / 4;
    scene.add(rug2);

    // 1. Oscar's Architect Board (Easel)
    const oscarBoardGroup = new THREE.Group();
    oscarBoardGroup.position.set(-3.6, 0.45, -3.6);
    oscarBoardGroup.lookAt(0, 0.45, 0);
    scene.add(oscarBoardGroup);

    const boardStand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.6), standMat);
    boardStand.position.y = 0;
    oscarBoardGroup.add(boardStand);

    const drawingBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.9), frameMat);
    drawingBoard.position.set(0.05, 0.4, 0);
    drawingBoard.rotation.z = Math.PI / 6;
    oscarBoardGroup.add(drawingBoard);

    const blueprintPaperMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.9 });
    const blueprintPaper = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.6, 0.7), blueprintPaperMat);
    blueprintPaper.position.set(0.072, 0.4, 0);
    blueprintPaper.rotation.z = Math.PI / 6;
    oscarBoardGroup.add(blueprintPaper);

    // Oscar's Desk (Architect Office Desk)
    const oscarDeskGroup = new THREE.Group();
    oscarDeskGroup.position.set(-3.4, 0, -2.2);
    oscarDeskGroup.lookAt(-3.0, 0, -2.6);
    scene.add(oscarDeskGroup);

    const oscarTable = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), standMat);
    oscarTable.position.y = 0.5;
    oscarTable.castShadow = true;
    oscarTable.receiveShadow = true;
    oscarDeskGroup.add(oscarTable);

    // 4 legs for Oscar's desk
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), frameMat);
        leg.position.set(lx * 0.4, 0.25, lz * 0.23);
        leg.castShadow = true;
        oscarDeskGroup.add(leg);
      }
    }

    // Monitor for Oscar (Drafting display)
    const oscarMonBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), frameMat);
    oscarMonBase.position.set(0, 0.535, 0);
    oscarDeskGroup.add(oscarMonBase);

    const oscarMonStand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), frameMat);
    oscarMonStand.position.set(0, 0.58, 0);
    oscarDeskGroup.add(oscarMonStand);

    const oscarMonScreen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), frameMat);
    oscarMonScreen.position.set(0, 0.72, 0);
    oscarDeskGroup.add(oscarMonScreen);

    const oscarMonDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.01), new THREE.MeshBasicMaterial({ color: 0x3b82f6 })); // Blue blueprint style display
    oscarMonDisplay.position.set(0, 0.72, 0.022);
    oscarDeskGroup.add(oscarMonDisplay);

    // Keyboard for Oscar
    const oscarKeyboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.08), seatMat);
    oscarKeyboard.position.set(0, 0.53, 0.16);
    oscarDeskGroup.add(oscarKeyboard);

    // Oscar's CPU Tower
    const oscarCpu = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    oscarCpu.position.set(0.38, 0.63, 0.1);
    oscarDeskGroup.add(oscarCpu);

    const oscarCpuLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.16, 0.19),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 }) // blue/cyan glow
    );
    oscarCpuLed.position.set(0.052, 0, 0);
    oscarCpu.add(oscarCpuLed);

    // Nairobi's Backend/Database Server Setup
    const nairobiServerGroup = new THREE.Group();
    nairobiServerGroup.position.set(-4.0, 0, 4.0);
    nairobiServerGroup.lookAt(0, 0, 0);
    scene.add(nairobiServerGroup);

    // Server Cabinet Rack
    const rackFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 })
    );
    rackFrame.position.y = 0.7;
    nairobiServerGroup.add(rackFrame);

    // Glowing server slots (LEDs/Blades)
    for (let slot = 0; slot < 8; slot++) {
      const slotY = 0.15 + slot * 0.15;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.08, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
      );
      blade.position.set(0, slotY, 0.02);
      nairobiServerGroup.add(blade);

      const ledGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.01),
        new THREE.MeshBasicMaterial({ color: slot % 2 === 0 ? 0x22c55e : 0xef4444 }) // green and red status LEDs
      );
      ledGlow.position.set(-0.18, slotY, 0.285);
      nairobiServerGroup.add(ledGlow);

      const ledGlow2 = ledGlow.clone();
      ledGlow2.position.x = -0.06;
      ledGlow2.material = new THREE.MeshBasicMaterial({ color: 0x3b82f6 }); // blue activity LED
      nairobiServerGroup.add(ledGlow2);
    }

    // 2. Sheldon's Developer Desk
    const sheldonDeskGroup = new THREE.Group();
    sheldonDeskGroup.position.set(2.4, 0, -2.4);
    sheldonDeskGroup.lookAt(3.0, 0, -2.6);
    scene.add(sheldonDeskGroup);

    const desktop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), standMat);
    desktop.position.y = 0.5;
    sheldonDeskGroup.add(desktop);

    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const dLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), frameMat);
        dLeg.position.set(lx * 0.4, 0.25, lz * 0.23);
        sheldonDeskGroup.add(dLeg);
      }
    }

    const monitorBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), frameMat);
    monitorBase.position.set(0, 0.535, 0);
    sheldonDeskGroup.add(monitorBase);

    const monitorStand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), frameMat);
    monitorStand.position.set(0, 0.58, 0);
    sheldonDeskGroup.add(monitorStand);

    const monitorScreen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), frameMat);
    monitorScreen.position.set(0, 0.72, 0);
    sheldonDeskGroup.add(monitorScreen);

    const monitorDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.01), tableMat);
    monitorDisplay.position.set(0, 0.72, 0.022);
    sheldonDeskGroup.add(monitorDisplay);

    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.08), seatMat);
    keyboard.position.set(0, 0.53, 0.16);
    sheldonDeskGroup.add(keyboard);

    // Sheldon's CPU Tower
    const sheldonCpu = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    sheldonCpu.position.set(0.38, 0.63, 0.1);
    sheldonDeskGroup.add(sheldonCpu);

    const sheldonCpuLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.16, 0.19),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }) // cyan glow
    );
    sheldonCpuLed.position.set(0.052, 0, 0);
    sheldonCpu.add(sheldonCpuLed);

    // 3. Nairobi's Couch
    const couchGroup = new THREE.Group();
    couchGroup.position.set(-3.0, 0, 3.0);
    couchGroup.lookAt(0, 0, 0);
    scene.add(couchGroup);

    const couchBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.6), seatMat);
    couchBase.position.y = 0.09;
    couchGroup.add(couchBase);

    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.8 });
    const couchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.48), cushionMat);
    couchSeat.position.set(0, 0.21, 0.04);
    couchGroup.add(couchSeat);

    const couchBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.48, 0.12), seatMat);
    couchBack.position.set(0, 0.42, -0.24);
    couchGroup.add(couchBack);

    const couchArmL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.6), seatMat);
    couchArmL.position.set(-0.54, 0.27, 0);
    couchGroup.add(couchArmL);
    const couchArmR = couchArmL.clone();
    couchArmR.position.x = 0.54;
    couchGroup.add(couchArmR);

    // Nairobi's Coffee Table & Laptop
    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), standMat);
    coffeeTable.position.set(-2.0, 0.125, 2.0);
    coffeeTable.lookAt(0, 0.125, 0);
    scene.add(coffeeTable);

    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.12), frameMat);
    laptopBase.position.set(0, 0.13, 0);
    coffeeTable.add(laptopBase);

    const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.01), frameMat);
    laptopScreen.position.set(0, 0.18, -0.05);
    laptopScreen.rotation.x = 0.45; // open screen
    coffeeTable.add(laptopScreen);

    const laptopDisp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.002), new THREE.MeshBasicMaterial({ color: 0xf43f5e })); // magenta display glow
    laptopDisp.position.set(0, 0, 0.006);
    laptopScreen.add(laptopDisp);

    // 4. Ragnar's Kanban Board
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 0, -4.7);
    boardGroup.lookAt(0, 0, 0);
    scene.add(boardGroup);

    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.05), frameMat);
    boardFrame.position.y = 1.1;
    boardGroup.add(boardFrame);

    const boardSurfaceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
    const boardSurface = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.01), boardSurfaceMat);
    boardSurface.position.set(0, 1.1, 0.022);
    boardGroup.add(boardSurface);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), frameMat);
    legL.position.set(-0.8, 0.55, 0);
    boardGroup.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.8;
    boardGroup.add(legR);

    const postitColors = [0xef4444, 0xeab308, 0x3b82f6, 0x22c55e];
    for (let row = 0; row < 3; row++) {
      for (let col = -2; col <= 2; col++) {
        if (Math.random() > 0.3) {
          const pColor = postitColors[Math.floor(Math.random() * postitColors.length)];
          const pMat = new THREE.MeshBasicMaterial({ color: pColor });
          const postit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.002), pMat);
          postit.position.set(col * 0.28 + (Math.random() - 0.5) * 0.03, 1.4 - row * 0.24, 0.024);
          boardGroup.add(postit);
        }
      }
    }

    // Ragnar's QA Desk & Multi-Monitor Setup
    const ragnarDeskGroup = new THREE.Group();
    ragnarDeskGroup.position.set(0.8, 0, -3.8);
    ragnarDeskGroup.lookAt(0.8, 0, 0);
    scene.add(ragnarDeskGroup);

    const rTable = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.55), standMat);
    rTable.position.y = 0.5;
    ragnarDeskGroup.add(rTable);

    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), frameMat);
        leg.position.set(lx * 0.45, 0.25, lz * 0.23);
        ragnarDeskGroup.add(leg);
      }
    }


    // Left Monitor
    const rMon1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.03), monitorMat);
    rMon1.position.set(-0.16, 0.7, -0.05);
    rMon1.rotation.y = 0.35;
    ragnarDeskGroup.add(rMon1);

    const rDisp1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.005), new THREE.MeshBasicMaterial({ color: 0x10b981 })); // Green terminal display
    rDisp1.position.set(0, 0, 0.016);
    rMon1.add(rDisp1);

    // Right Monitor
    const rMon2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.03), monitorMat);
    rMon2.position.set(0.16, 0.7, -0.05);
    rMon2.rotation.y = -0.35;
    ragnarDeskGroup.add(rMon2);

    const rDisp2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.005), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); // Yellow dashboard display
    rDisp2.position.set(0, 0, 0.016);
    rMon2.add(rDisp2);

    // Keyboard
    const rKeyb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.07), seatMat);
    rKeyb.position.set(0, 0.53, 0.14);
    rKeyb.rotation.y = 0.05;
    ragnarDeskGroup.add(rKeyb);

    const rKeybLed = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.012, 0.08), new THREE.MeshBasicMaterial({ color: 0xa855f7 })); // Purple RGB glow
    rKeybLed.position.set(0, -0.002, 0);
    rKeyb.add(rKeybLed);

    // CPU Tower (RGB)
    const rCpu = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.2), monitorMat);
    rCpu.position.set(-0.38, 0.64, -0.05);
    ragnarDeskGroup.add(rCpu);

    const rCpuLed = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xa855f7 })); // Purple RGB side
    rCpuLed.position.set(0.061, 0, 0);
    rCpu.add(rCpuLed);

    // 5. Sabotagem's Armchair
    const armchairGroup = new THREE.Group();
    armchairGroup.position.set(3.0, 0, 3.0);
    armchairGroup.lookAt(0, 0, 0);
    scene.add(armchairGroup);

    const chairBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.6), seatMat);
    chairBase.position.y = 0.09;
    armchairGroup.add(chairBase);

    const seatCushionMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.48), seatCushionMat);
    chairSeat.position.set(0, 0.21, 0.04);
    armchairGroup.add(chairSeat);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.12), seatMat);
    chairBack.position.set(0, 0.42, -0.24);
    armchairGroup.add(chairBack);

    const chairArmL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.6), seatMat);
    chairArmL.position.set(-0.275, 0.27, 0);
    armchairGroup.add(chairArmL);
    const chairArmR = chairArmL.clone();
    chairArmR.position.x = 0.275;
    armchairGroup.add(chairArmR);

    // Sabotagem's Workdesk
    const sDeskGroup = new THREE.Group();
    sDeskGroup.position.set(2.0, 0, 2.0);
    sDeskGroup.lookAt(3.0, 0, 3.0);
    scene.add(sDeskGroup);

    const sTable = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), standMat);
    sTable.position.y = 0.25;
    sDeskGroup.add(sTable);

    // Laptop
    const sLaptop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.11), frameMat);
    sLaptop.position.set(0, 0.51, 0.05);
    sDeskGroup.add(sLaptop);

    const sScreen = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.01), frameMat);
    sScreen.position.set(0, 0.56, -0.02);
    sScreen.rotation.x = 0.4;
    sDeskGroup.add(sScreen);

    const sDisp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.002), new THREE.MeshBasicMaterial({ color: 0x22c55e })); // Green display glow
    sDisp.position.set(0, 0, 0.006);
    sScreen.add(sDisp);

    // Wall Neon Strips (Gamer Bedroom Lighting) - Deactivated for Daylight Studio
    const neonMatL = new THREE.MeshBasicMaterial({ color: 0x06b6d4, visible: false }); // Cyan neon
    const neonL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 15.0), neonMatL);
    neonL.position.set(-7.41, 2.0, 0);
    scene.add(neonL);

    const neonMatR = new THREE.MeshBasicMaterial({ color: 0xf43f5e, visible: false }); // Magenta neon
    const neonR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.04, 0.04), neonMatR);
    neonR.position.set(0, 2.0, -7.41);
    scene.add(neonR);

    // Corner RGB LEDs (Vertical color bars) - Deactivated for Daylight Studio
    const cornerNeonGeo = new THREE.CylinderGeometry(0.015, 0.015, 4.5, 8);
    const cornerNeonMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, visible: false }); // Purple RGB light
    const cornerNeon = new THREE.Mesh(cornerNeonGeo, cornerNeonMat);
    cornerNeon.position.set(-7.38, 2.25, -7.38); // right in the L corner
    scene.add(cornerNeon);

    // Voxel Potted Plants
    const plantGroup1 = new THREE.Group();
    plantGroup1.position.set(-5.0, 0, 0);
    scene.add(plantGroup1);

    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), standMat);
    pot.position.y = 0.2;
    plantGroup1.add(pot);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), stemMat);
    stem.position.y = 0.7;
    plantGroup1.add(stem);

    const voxelLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    for (let ly = 0; ly < 3; ly++) {
      const size = 0.35 - ly * 0.08;
      const leaves = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), voxelLeafMat);
      leaves.position.y = 0.9 + ly * 0.2;
      plantGroup1.add(leaves);
    }

    const plantGroup2 = plantGroup1.clone();
    plantGroup2.position.set(5.0, 0, 0);
    scene.add(plantGroup2);

    // ───────────────────────────────────────────────────────────
    // CANTINHO DE CAFÉ (Buffet de luxo, máquina expresso e prateleira)
    // ───────────────────────────────────────────────────────────
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(-3.5, 0, -3.5);
    coffeeTableGroup.rotation.y = Math.PI / 4; // Diagonal
    scene.add(coffeeTableGroup);

    // Buffet planejado (Gabinete com portas e puxadores dourados)
    const cabinetGeo = new THREE.BoxGeometry(1.4, 0.45, 0.55);
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x272421, roughness: 0.6 }); 
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinet.position.y = 0.225;
    cabinet.receiveShadow = true;
    cabinet.castShadow = true;
    coffeeTableGroup.add(cabinet);

    // Tampo do Buffet (Mármore claro polido)
    const buffetTopGeo = new THREE.BoxGeometry(1.42, 0.03, 0.57);
    const buffetTopMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.15, metalness: 0.2 }); 
    const buffetTop = new THREE.Mesh(buffetTopGeo, buffetTopMat);
    buffetTop.position.y = 0.465;
    buffetTop.receiveShadow = true;
    coffeeTableGroup.add(buffetTop);

    // Puxadores de latão dourado
    const handleGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.08);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
    const handleL = new THREE.Mesh(handleGeo, handleMat);
    handleL.position.set(-0.25, 0.225, 0.28);
    handleL.rotation.z = Math.PI / 2;
    coffeeTableGroup.add(handleL);

    const handleR = handleL.clone();
    handleR.position.x = 0.25;
    coffeeTableGroup.add(handleR);

    // Máquina de Café Expresso Italiana Cromada
    const espressoGroup = new THREE.Group();
    espressoGroup.position.set(-0.35, 0.48, 0.05);
    coffeeTableGroup.add(espressoGroup);

    const espressoChromeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.05 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), espressoChromeMat);
    baseMesh.position.y = 0.08;
    baseMesh.castShadow = true;
    espressoGroup.add(baseMesh);

    const tankMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, roughness: 0.1 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 10), tankMat);
    tank.position.set(0, 0.155, -0.04);
    espressoGroup.add(tank);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08), espressoChromeMat);
    lever.position.set(0, 0.08, 0.1);
    lever.rotation.x = Math.PI / 2;
    espressoGroup.add(lever);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02), cabinetMat);
    grip.position.set(0, 0.08, 0.14);
    grip.rotation.x = Math.PI / 2;
    espressoGroup.add(grip);

    // Xícaras de café em porcelana branca sobre o buffet
    const cupColors = [0xffffff, 0xffffff, 0xffffff];
    cupColors.forEach((color, idx) => {
      const cupGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.038, 8);
      const cupMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2 });
      const cup = new THREE.Mesh(cupGeo, cupMat);
      cup.position.set(0.15 + idx * 0.12, 0.499, -0.05 + Math.sin(idx) * 0.03);
      cup.castShadow = true;
      coffeeTableGroup.add(cup);
    });

    // Prateleira de parede flutuante de madeira
    const shelfGeo = new THREE.BoxGeometry(1.2, 0.03, 0.22);
    const shelf = new THREE.Mesh(shelfGeo, cabinetMat);
    shelf.position.set(0, 1.25, -0.22);
    coffeeTableGroup.add(shelf);

    // Livros decorativos
    const bookColors = [0x1d4ed8, 0xb91c1c, 0xf59e0b];
    bookColors.forEach((color, bIdx) => {
      const bookGeo = new THREE.BoxGeometry(0.03, 0.12, 0.08);
      const bookMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(-0.25 + bIdx * 0.04, 1.325, -0.2);
      book.rotation.y = 0.15;
      coffeeTableGroup.add(book);
    });

    // Vasinho de suculenta
    const smallPot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0xefede8 }));
    smallPot.position.set(0.3, 1.31, -0.2);
    coffeeTableGroup.add(smallPot);

    const smallLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
    const smallLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), smallLeafMat);
    smallLeaf.position.set(0.3, 1.35, -0.2);
    smallLeaf.scale.set(1, 0.7, 1.4);
    coffeeTableGroup.add(smallLeaf);

    // Planta Costela-de-Adão de Luxo (Vaso de Chão)
    const plantGroup = new THREE.Group();
    plantGroup.position.set(-4.6, 0, -2.4);
    scene.add(plantGroup);

    const potMeshGeo = new THREE.CylinderGeometry(0.18, 0.13, 0.35, 12);
    const potMesh = new THREE.Mesh(potMeshGeo, new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.6 })); 
    potMesh.position.y = 0.175;
    potMesh.castShadow = true;
    plantGroup.add(potMesh);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    for (let lIdx = 0; lIdx < 7; lIdx++) {
      const stemGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.4);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x166534 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      const sAngle = (lIdx / 7) * Math.PI * 2;
      stem.position.set(Math.sin(sAngle) * 0.1, 0.35, Math.cos(sAngle) * 0.1);
      stem.rotation.z = Math.sin(sAngle) * 0.4;
      stem.rotation.x = Math.cos(sAngle) * 0.4;
      plantGroup.add(stem);

      const leafGeo = new THREE.BoxGeometry(0.15, 0.005, 0.24);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(sAngle) * 0.22, 0.52 + Math.random() * 0.06, Math.cos(sAngle) * 0.22);
      leaf.rotation.y = sAngle + Math.PI / 2;
      leaf.rotation.x = 0.4 + Math.random() * 0.2;
      leaf.rotation.z = 0.1;
      plantGroup.add(leaf);
    }

    // Central Hologram Volumetric Beam & Geodesic Core
    const holoGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.9, 32, 1, true);
    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const hologram = new THREE.Mesh(holoGeo, holoMat);
    hologram.position.set(0, 0.95, 0);
    hologram.visible = false;
    scene.add(hologram);

    const hologramModelGroup = new THREE.Group();
    hologramModelGroup.position.set(0, 0.95, 0);
    scene.add(hologramModelGroup);
    hologramModelRef.current = hologramModelGroup;

    // Floating Hologram Particles (Increased to 150)
    const particleCount = 150;
    const particlesGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = [];

    for (let i = 0; i < particleCount; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pRadius = Math.random() * 1.3;
      particlePositions[i * 3] = Math.sin(pAngle) * pRadius;
      particlePositions[i * 3 + 1] = 0.5 + Math.random() * 2.0; 
      particlePositions[i * 3 + 2] = Math.cos(pAngle) * pRadius;
      particleSpeeds.push(0.002 + Math.random() * 0.0035);
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particlesMat = new THREE.PointsMaterial({
      size: 0.038,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    // Removed to keep Habbo room clear of floating hologram particles
    // scene.add(particleSystem);

    // Orbiting Hologram Rings
    const orbitRingGeo1 = new THREE.RingGeometry(0.7, 0.715, 32);
    const orbitRingGeo2 = new THREE.RingGeometry(0.8, 0.815, 32);
    const orbitRingMat1 = new THREE.MeshBasicMaterial({ color: 0x6366f1, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const orbitRingMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    
    const orbitRing1 = new THREE.Mesh(orbitRingGeo1, orbitRingMat1);
    const orbitRing2 = new THREE.Mesh(orbitRingGeo2, orbitRingMat2);
    orbitRing1.position.set(0, 0.95, 0);
    orbitRing2.position.set(0, 0.95, 0);
    // Removed to keep Habbo room clear of glowing orbiting rings
    // scene.add(orbitRing1);
    // scene.add(orbitRing2);

    // Generate 5 Avatar Groups at their scattered normal positions
    const agentsArray = Object.keys(AGENTS);
    const avatarObjects = {};

    agentsArray.forEach((agentId, idx) => {
      const agentAngle = (idx / agentsArray.length) * Math.PI * 2;
      const startPos = NORMAL_POSITIONS[agentId];
      const group = new THREE.Group();
      group.position.set(startPos.x, 0.5, startPos.z);
      group.lookAt(0, 0.5, 0);
      scene.add(group);

      // Seat pedestal indicator ring on floor (only for sitting agents)
      const agentColor = AGENTS[agentId].color;
      const sitting = isSittingNormal[agentId];

      if (sitting) {
        const seatRingGeo = new THREE.RingGeometry(0.25, 0.27, 24);
        const seatRingMat = new THREE.MeshBasicMaterial({ color: agentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
        const seatRing = new THREE.Mesh(seatRingGeo, seatRingMat);
        seatRing.rotation.x = Math.PI / 2;
        seatRing.position.set(startPos.x, 0.01, startPos.z);
        scene.add(seatRing);

        // Habbo-style blocky chair
        const chairGroup = new THREE.Group();
        chairGroup.position.set(startPos.x, 0.45, startPos.z);
        chairGroup.lookAt(0, 0.45, 0);
        scene.add(chairGroup);

        // Seat (flat box)
        const seatBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.06, 0.4),
          seatMat
        );
        seatBase.position.y = 0.0;
        seatBase.receiveShadow = true;
        chairGroup.add(seatBase);

        // Backrest (agent colored block)
        const backRestMat = new THREE.MeshStandardMaterial({
          color: agentColor,
          roughness: 0.7,
          metalness: 0.1
        });
        const backRest = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.5, 0.06),
          backRestMat
        );
        backRest.position.set(0, 0.25, -0.18);
        backRest.castShadow = true;
        chairGroup.add(backRest);

        // 4 blocky legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
        for (let lx = -1; lx <= 1; lx += 2) {
          for (let lz = -1; lz <= 1; lz += 2) {
            const leg = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.45, 0.04),
              legMat
            );
            leg.position.set(lx * 0.16, -0.25, lz * 0.16);
            chairGroup.add(leg);
          }
        }
      }

      // ───────────────────────────────────────────────────────────
      // HABBO-STYLE BLOCKY CHARACTER (Pixel Art 3D)
      // ───────────────────────────────────────────────────────────
      const robotBody = new THREE.Group();
      robotBody.position.set(0, 0, -0.05);
      robotBody.scale.set(1.4, 1.4, 1.4);
      group.add(robotBody);

      // Skin tones per agent
      let skinColor = 0xffe0bd;
      if (agentId === 'oscar') skinColor = 0xffe0bd; 
      if (agentId === 'leo') skinColor = 0xfddcb9; 
      if (agentId === 'afrodite') skinColor = 0x5c3d2e;
      if (agentId === 'thor') skinColor = 0xe0a98c;
      if (agentId === 'sabotagem') skinColor = 0xc68642;

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9, metalness: 0.0 });
      let shirtColor = AGENTS[agentId].color;
      if (agentId === 'oscar') shirtColor = 0xffffff; // White suit blazer!
      if (agentId === 'leo') shirtColor = 0xef4444; // Bazinga Red shirt!
      if (agentId === 'afrodite') shirtColor = 0xb91c1c; // La Casa de Papel Jumpsuit Red!
      if (agentId === 'thor') shirtColor = 0x78350f; // Brown leather armor!
      if (agentId === 'sabotagem') shirtColor = 0x18181b; // Streetwear black jacket!
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95, metalness: 0.0 });

      let armUpperMat = shirtMat;
      let armForeMat = skinMat;

      if (agentId === 'oscar') {
        armUpperMat = shirtMat; // white blazer sleeve
        armForeMat = shirtMat; // white blazer sleeve
      } else if (agentId === 'leo') {
        const greySleeveMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95, metalness: 0.0 });
        armUpperMat = greySleeveMat; // grey long sleeve
        armForeMat = greySleeveMat; // grey long sleeve
      } else if (agentId === 'afrodite') {
        armUpperMat = shirtMat; // red jumpsuit sleeve
        armForeMat = shirtMat; // red jumpsuit sleeve
      } else if (agentId === 'thor') {
        const bracerMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.2 });
        armUpperMat = shirtMat; // brown leather upper
        armForeMat = bracerMat; // steel arm bracers
      } else if (agentId === 'sabotagem') {
        armUpperMat = shirtMat; // black jacket sleeve
        armForeMat = shirtMat; // black jacket sleeve
      }

      let pantsColor = 0x1d4ed8;
      if (agentId === 'oscar') pantsColor = 0x334155; // Charcoal suit pants
      if (agentId === 'leo') pantsColor = 0x1d4ed8; // Blue jeans
      if (agentId === 'afrodite') pantsColor = 0xb91c1c; // Red jumpsuit pants!
      if (agentId === 'thor') pantsColor = 0x374151; // Dark pants
      if (agentId === 'sabotagem') pantsColor = 0x18181b; // Black pants
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.95, metalness: 0.0 });
      const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

      // ── TORSO (blocky box) ──
      const isFemale = agentId === 'afrodite';
      const chestW = isFemale ? 0.14 : 0.18;
      const chestD = isFemale ? 0.08 : 0.10;

      const chest = new THREE.Mesh(
        new THREE.BoxGeometry(chestW, 0.18, chestD),
        shirtMat
      );
      chest.position.y = 0.09;
      robotBody.add(chest);

      if (agentId === 'leo') {
        // Sheldon's Bazinga logo on chest
        const logoGroup = new THREE.Group();
        logoGroup.position.set(0, 0.09, 0.051); // front of chest
        logoGroup.rotation.x = Math.PI / 2;
        robotBody.add(logoGroup);

        const logoBg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.042, 0.002, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        logoGroup.add(logoBg);

        const flash1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.015, 0.05, 0.003),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        flash1.rotation.z = -0.3; // tilt lightning bolt
        logoGroup.add(flash1);

        const flash2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.03, 0.004),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        flash2.position.set(-0.015, 0.01, 0);
        flash2.rotation.z = 0.5;
        logoGroup.add(flash2);
      }

      if (agentId === 'oscar') {
        // Architect's blueprint drawing tube (porta-projetos) on Oscar's back
        const tubeGroup = new THREE.Group();
        tubeGroup.position.set(-0.06, 0.08, -0.08);
        tubeGroup.rotation.z = 0.45; // diagonal on back
        tubeGroup.rotation.y = 0.25;
        robotBody.add(tubeGroup);

        const tubeBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.26, 8),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
        );
        tubeGroup.add(tubeBody);

        const tubeCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
        );
        tubeCap.position.y = 0.13;
        tubeGroup.add(tubeCap);

        // Strap wrapping around shoulder
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.32, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
        );
        strap.position.set(0.05, 0.02, 0.06);
        strap.rotation.x = -Math.PI / 4;
        tubeGroup.add(strap);
      }

      if (agentId === 'afrodite') {
        // La Casa de Papel Jumpsuit Zipper (Cremalheira)
        const zipper = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.14, 0.005),
          new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 }) // black zipper line
        );
        zipper.position.set(0, 0.09, 0.041); // center front of chest
        robotBody.add(zipper);

        const zipperPull = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, 0.03, 0.008),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.1 }) // silver puller
        );
        zipperPull.position.set(0, 0.13, 0.043);
        robotBody.add(zipperPull);

        // Red Hood on back of the torso (hanging down)
        const hood = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.14, 0.04),
          shirtMat
        );
        hood.position.set(0, 0.08, -0.06); // back of torso
        robotBody.add(hood);

        // Black waist belt
        const belt = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.025, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        belt.position.y = -0.005; // slightly above pelvis/crotch
        robotBody.add(belt);

        // Shoulder strap harness (tactical look)
        const strapL = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.20, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        strapL.position.set(-0.045, 0.09, 0.005);
        strapL.rotation.y = 0.05;
        robotBody.add(strapL);

        const strapR = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.20, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        strapR.position.set(0.045, 0.09, 0.005);
        strapR.rotation.y = -0.05;
        robotBody.add(strapR);

        // Salvador Dalí Mask hanging on the side of her belt/hip
        const maskGroup = new THREE.Group();
        maskGroup.position.set(0.07, -0.02, 0.05); // side of pelvis/hip, slightly forward
        maskGroup.rotation.y = 0.3;
        maskGroup.rotation.z = -0.2;
        robotBody.add(maskGroup);

        const maskFace = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.09, 0.03),
          new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.8 }) // white/light grey face
        );
        maskGroup.add(maskFace);

        // Mustache (Dalí's signature long mustache pointing up)
        const mustacheMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
        const mustacheL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.005), mustacheMat);
        mustacheL.position.set(-0.015, -0.015, 0.016);
        mustacheL.rotation.z = 0.5; // curved up left
        maskGroup.add(mustacheL);

        const mustacheR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.005), mustacheMat);
        mustacheR.position.set(0.015, -0.015, 0.016);
        mustacheR.rotation.z = -0.5; // curved up right
        maskGroup.add(mustacheR);

        // Big stylized eyes and eyebrows
        const eyeBrowL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.005), mustacheMat);
        eyeBrowL.position.set(-0.016, 0.018, 0.016);
        eyeBrowL.rotation.z = -0.25;
        maskGroup.add(eyeBrowL);

        const eyeBrowR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.005), mustacheMat);
        eyeBrowR.position.set(0.016, 0.018, 0.016);
        eyeBrowR.rotation.z = 0.25;
        maskGroup.add(eyeBrowR);

        // Eyes
        const maskEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), mustacheMat);
        maskEyeL.position.set(-0.016, 0.008, 0.016);
        maskGroup.add(maskEyeL);

        const maskEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), mustacheMat);
        maskEyeR.position.set(0.016, 0.008, 0.016);
        maskGroup.add(maskEyeR);

        // Rosy cheeks (red circles/squares)
        const cheekMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.002), cheekMat);
        cheekL.position.set(-0.022, -0.01, 0.016);
        maskGroup.add(cheekL);

        const cheekR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.002), cheekMat);
        cheekR.position.set(0.022, -0.01, 0.016);
        maskGroup.add(cheekR);
      }

      // Collar stripe
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(chestW + 0.01, 0.02, chestD + 0.005),
        shirtMat
      );
      collar.position.y = 0.19;
      robotBody.add(collar);

      // ── NECK (small skin block) ──
      const neck = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.03, 0.05),
        skinMat
      );
      neck.position.y = 0.21;
      robotBody.add(neck);

      // ── ARMS (blocky rectangles) ──
      const shoulderOffsetX = isFemale ? 0.10 : 0.12;

      // Left arm (shirt/sleeve)
      const shoulderL = new THREE.Group();
      shoulderL.position.set(-shoulderOffsetX, 0.15, 0);
      robotBody.add(shoulderL);

      const armUpperL = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.10, 0.05),
        armUpperMat
      );
      armUpperL.position.set(0, -0.05, 0);
      shoulderL.add(armUpperL);

      const elbowL = new THREE.Group();
      elbowL.position.set(0, -0.10, 0);
      shoulderL.add(elbowL);

      const armForeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.10, 0.045),
        armForeMat
      );
      armForeL.position.set(0, -0.05, 0);
      elbowL.add(armForeL);

      const handL = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        skinMat
      );
      handL.position.set(0, -0.10, 0);
      elbowL.add(handL);

      // Right arm
      const shoulderR = new THREE.Group();
      shoulderR.position.set(shoulderOffsetX, 0.15, 0);
      robotBody.add(shoulderR);

      const armUpperR = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.10, 0.05),
        armUpperMat
      );
      armUpperR.position.set(0, -0.05, 0);
      shoulderR.add(armUpperR);

      const elbowR = new THREE.Group();
      elbowR.position.set(0, -0.10, 0);
      shoulderR.add(elbowR);

      const armForeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.10, 0.045),
        armForeMat
      );
      armForeR.position.set(0, -0.05, 0);
      elbowR.add(armForeR);

      const handR = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        skinMat
      );
      handR.position.set(0, -0.10, 0);
      elbowR.add(handR);

      // ── LEGS (blocky) ──
      const pelvisW = isFemale ? 0.13 : 0.16;
      const pelvisD = isFemale ? 0.07 : 0.08;
      const pelvis = new THREE.Mesh(
        new THREE.BoxGeometry(pelvisW, 0.04, pelvisD),
        pantsMat
      );
      pelvis.position.set(0, -0.02, 0);
      robotBody.add(pelvis);

      const hipOffsetX = isFemale ? 0.04 : 0.05;

      const hipL = new THREE.Group();
      hipL.position.set(-hipOffsetX, -0.02, 0);
      robotBody.add(hipL);

      const hipR = new THREE.Group();
      hipR.position.set(hipOffsetX, -0.02, 0);
      robotBody.add(hipR);

      const thighW = isFemale ? 0.045 : 0.055;
      const thighD = isFemale ? 0.045 : 0.055;

      const thighL = new THREE.Mesh(new THREE.BoxGeometry(thighW, 0.08, thighD), pantsMat);
      thighL.position.set(0, -0.04, 0);
      hipL.add(thighL);

      const thighR = new THREE.Mesh(new THREE.BoxGeometry(thighW, 0.08, thighD), pantsMat);
      thighR.position.set(0, -0.04, 0);
      hipR.add(thighR);

      const kneeL = new THREE.Group();
      kneeL.position.set(0, -0.08, 0);
      hipL.add(kneeL);

      const kneeR = new THREE.Group();
      kneeR.position.set(0, -0.08, 0);
      hipR.add(kneeR);

      const shinW = isFemale ? 0.04 : 0.05;
      const shinD = isFemale ? 0.04 : 0.05;

      const shinL = new THREE.Mesh(new THREE.BoxGeometry(shinW, 0.10, shinD), pantsMat);
      shinL.position.set(0, -0.05, 0);
      kneeL.add(shinL);

      const shinR = new THREE.Mesh(new THREE.BoxGeometry(shinW, 0.10, shinD), pantsMat);
      shinR.position.set(0, -0.05, 0);
      kneeR.add(shinR);

      const footW = isFemale ? 0.045 : 0.055;
      const footD = isFemale ? 0.06 : 0.07;

      const footL = new THREE.Mesh(new THREE.BoxGeometry(footW, 0.03, footD), shoesMat);
      footL.position.set(0, -0.10, 0.01);
      kneeL.add(footL);

      const footR = new THREE.Mesh(new THREE.BoxGeometry(footW, 0.03, footD), shoesMat);
      footR.position.set(0, -0.10, 0.01);
      kneeR.add(footR);

      // ── EXTRACTS for animation ──
      let extraRefs = {};
      extraRefs.pelvis = pelvis;
      extraRefs.hipL = hipL;
      extraRefs.hipR = hipR;
      extraRefs.thighL = thighL;
      extraRefs.thighR = thighR;
      extraRefs.kneeL = kneeL;
      extraRefs.kneeR = kneeR;
      extraRefs.shinL = shinL;
      extraRefs.shinR = shinR;
      extraRefs.footL = footL;
      extraRefs.footR = footR;
      extraRefs.shoulderL = shoulderL;
      extraRefs.shoulderR = shoulderR;
      extraRefs.elbowL = elbowL;
      extraRefs.elbowR = elbowR;
      extraRefs.armUpperL = armUpperL;
      extraRefs.armUpperR = armUpperR;
      extraRefs.armForeL = armForeL;
      extraRefs.armForeR = armForeR;
      extraRefs.handL = handL;
      extraRefs.handR = handR;

      // Coffee cup
      const coffeeCup = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.03, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.5 })
      );
      coffeeCup.position.set(0, -0.01, 0.015);
      coffeeCup.scale.set(0, 0, 0);
      handR.add(coffeeCup);
      extraRefs.coffeeCup = coffeeCup;

      // ───────────────────────────────────────────────────────────
      // HEAD — Big blocky Habbo head
      // ───────────────────────────────────────────────────────────
      const headGeo = new THREE.BoxGeometry(0.15, 0.14, 0.13);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 0.25, 0);
      robotBody.add(head);

      // Black pixel eyes (flat rectangles - Habbo style)
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.15 });
      
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), eyeMat);
      eyeL.position.set(-0.03, 0.01, 0.066);
      head.add(eyeL);

      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), eyeMat);
      eyeR.position.set(0.03, 0.01, 0.066);
      head.add(eyeR);

      // White eye highlights (pixel sparkle)
      const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), highlightMat);
      hlL.position.set(0.005, 0.004, 0.001);
      eyeL.add(hlL);

      const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), highlightMat);
      hlR.position.set(0.005, 0.004, 0.001);
      eyeR.add(hlR);

      // Small pixel mouth
      const mouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.006, 0.005),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 })
      );
      mouth.position.set(0, -0.025, 0.066);
      head.add(mouth);

      // ───────────────────────────────────────────────────────────
      // HABBO HAIR & ACCESSORIES (per agent)
      // ───────────────────────────────────────────────────────────
      if (agentId === 'oscar') {
        // Oscar: Balding white hair + glasses + black tie
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 }); // white/grey hair
        
        // No top hair block (balding!)
        
        // Side hair blocks
        const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.13), hairMat);
        hairSideL.position.set(-0.085, 0.04, -0.005);
        head.add(hairSideL);

        const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.13), hairMat);
        hairSideR.position.set(0.085, 0.04, -0.005);
        head.add(hairSideR);

        // Back hair
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

        // Pixel glasses
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
        const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), frameMat);
        lensL.position.set(-0.03, 0.01, 0.068);
        head.add(lensL);

        const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), frameMat);
        lensR.position.set(0.03, 0.01, 0.068);
        head.add(lensR);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.005), frameMat);
        bridge.position.set(0, 0.01, 0.068);
        head.add(bridge);

        // Black tie block
        const tieMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }); // solid black tie
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.02), tieMat);
        tie.position.set(0, 0.08, 0.06);
        robotBody.add(tie);

        // Blueprint ring
        const blueprintRingGeo = new THREE.RingGeometry(0.2, 0.22, 4);
        const blueprintRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const blueprintRing = new THREE.Mesh(blueprintRingGeo, blueprintRingMat);
        blueprintRing.rotation.x = Math.PI / 2;
        blueprintRing.position.set(0, -0.04, 0);
        robotBody.add(blueprintRing);
        extraRefs.blueprintRing = blueprintRing;

      } else if (agentId === 'leo') {
        // Sheldon: Combed neat brown hair
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 }); // brown

        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), hairMat);
        hairTop.position.set(0, 0.085, -0.005);
        head.add(hairTop);

        // Neat combed side blocks (no black spikes)
        const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.13), hairMat);
        hairSideL.position.set(-0.085, 0.05, -0.005);
        head.add(hairSideL);

        const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.13), hairMat);
        hairSideR.position.set(0.085, 0.05, -0.005);
        head.add(hairSideR);

        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

        extraRefs.eyeL = eyeL;
        extraRefs.eyeR = eyeR;

      } else if (agentId === 'afrodite') {
        // Nairobi: Dark braids + gold necklace (no pink glasses)
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.95 });

        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.15), hairMat);
        hairTop.position.set(0, 0.09, -0.005);
        head.add(hairTop);

        // Braids (blocky vertical strips)
        const strands = [];
        for (let i = 0; i < 4; i++) {
          const strand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), hairMat);
          const xOffset = -0.05 + i * 0.035;
          strand.position.set(xOffset, -0.03, -0.07);
          head.add(strand);
          strands.push(strand);
        }
        extraRefs.hairStrands = strands;

        // Gold necklace around collar area
        const necklaceMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
        const necklace = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.07), necklaceMat);
        necklace.position.set(0, 0.215, 0.01);
        robotBody.add(necklace);

      } else if (agentId === 'thor') {
        // Ragnar: Mohawk blond hair + back braid + cross leather straps + beard
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });

        // Mohawk top strip (no side hair blocks)
        const mohawk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.16), hairMat);
        mohawk.position.set(0, 0.09, 0);
        head.add(mohawk);

        // Back braid
        const braid = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), hairMat);
        braid.position.set(0, -0.02, -0.075);
        head.add(braid);

        // Pixel beard
        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.04), hairMat);
        beard.position.set(0, -0.055, 0.05);
        head.add(beard);

        // Cross leather straps on chest
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
        const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.105), strapMat);
        strap1.position.set(0, 0.09, 0.002);
        strap1.rotation.z = 0.55;
        robotBody.add(strap1);

        const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.105), strapMat);
        strap2.position.set(0, 0.09, 0.003);
        strap2.rotation.z = -0.55;
        robotBody.add(strap2);

        // Hammer in Thor's left hand
        const hammerGroup = new THREE.Group();
        hammerGroup.position.set(0, -0.04, 0.04);
        hammerGroup.rotation.x = Math.PI / 2;
        hammerGroup.rotation.y = 0.2;
        handL.add(hammerGroup);

        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
        );
        hammerGroup.add(block);

        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.22, 0.025),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
        );
        handle.position.y = -0.09;
        hammerGroup.add(handle);

      } else {
        // Sabotagem: Beanie cap (touca) over dreadlocks + gold chain + beard
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95 });

        // Black beanie cap (touca) covering the top
        const beanieMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
        const beanieTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.15), beanieMat);
        beanieTop.position.set(0, 0.09, -0.005);
        head.add(beanieTop);

        // Multiple pixel-art dreadlocks hanging down from under beanie
        const dreadPositions = [
          { x: -0.08, y: -0.02, z: -0.04 },
          { x: -0.08, y: -0.06, z: 0.01 },
          { x: 0.08, y: -0.02, z: -0.04 },
          { x: 0.08, y: -0.06, z: 0.01 },
          { x: -0.04, y: -0.05, z: -0.07 },
          { x: 0.04, y: -0.05, z: -0.07 },
          { x: 0.0, y: -0.08, z: -0.075 }
        ];

        dreadPositions.forEach((pos) => {
          const dread = new THREE.Mesh(
            new THREE.BoxGeometry(0.026, 0.14 + Math.random() * 0.06, 0.026),
            hairMat
          );
          dread.position.set(pos.x, pos.y, pos.z);
          head.add(dread);
        });

        // Pixel beard
        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), hairMat);
        beard.position.set(0, -0.05, 0.05);
        head.add(beard);

        // Gold chain around neck
        const chainMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
        const chain = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.08), chainMat);
        chain.position.set(0, 0.20, 0.01);
        robotBody.add(chain);
      }

      // Add a floating Holographic HUD screen monitor above every agent's head
      const hudGeo = new THREE.PlaneGeometry(0.35, 0.22);
      const hudMat = new THREE.MeshBasicMaterial({ 
        color: agentColor, 
        transparent: true, 
        opacity: 0.0, 
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const hudMesh = new THREE.Mesh(hudGeo, hudMat);
      hudMesh.position.set(0, 0.44, 0);
      group.add(hudMesh);

      // Holographic concentric rings on the HUD screen
      const hudRingGeo = new THREE.RingGeometry(0.07, 0.08, 24);
      const hudRingMat = new THREE.MeshBasicMaterial({ color: agentColor, transparent: true, opacity: 0.0 });
      const hudRing = new THREE.Mesh(hudRingGeo, hudRingMat);
      hudRing.position.set(0, 0, 0.005);
      hudMesh.add(hudRing);

      extraRefs.hudMesh = hudMesh;
      extraRefs.hudMat = hudMat;
      extraRefs.hudRingMat = hudRingMat;

      avatarObjects[agentId] = {
        group: group,
        head: head,
        baseY: 0.5,
        angle: agentAngle,
        extraRefs: extraRefs,
        wanderTargetX: startPos.x,
        wanderTargetZ: startPos.z,
        wanderTimer: Date.now() + Math.random() * 5000,
        isWandering: true
      };
    });

    let zoomVal = 4.5;
    let targetAngle = -0.6;
    let cameraAngleY = -0.6;
    let cameraAngleX = 0.25;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let previousTouchDistance = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraAngleY += deltaX * 0.007;
      cameraAngleX += deltaY * 0.007;
      cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));

      stateRef.current.rotationY = cameraAngleY;
      stateRef.current.rotationX = cameraAngleX;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e) => {
      e.preventDefault();
      zoomVal += e.deltaY * 0.005;
      zoomVal = Math.max(2.0, Math.min(8.0, zoomVal));
      stateRef.current.zoomTarget = zoomVal;
    };

    // Touch Event Handlers for Mobile (Drag Rotation & Pinch Zoom)
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = false;
        previousTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        cameraAngleY += deltaX * 0.007;
        cameraAngleX += deltaY * 0.007;
        cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));

        stateRef.current.rotationY = cameraAngleY;
        stateRef.current.rotationX = cameraAngleX;

        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = dist - previousTouchDistance;
        zoomVal -= delta * 0.01;
        zoomVal = Math.max(2.0, Math.min(8.0, zoomVal));
        stateRef.current.zoomTarget = zoomVal;
        previousTouchDistance = dist;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVector, camera);

      // Check intersections with each agent's group first
      let clickedAgent = null;
      for (const agentId of agentsArray) {
        const av = avatarObjects[agentId];
        if (av && av.group) {
          const intersectsAgent = raycaster.intersectObject(av.group, true);
          if (intersectsAgent.length > 0) {
            clickedAgent = agentId;
            break;
          }
        }
      }

      if (clickedAgent) {
        setActiveAgent(clickedAgent);
        playSynthSound('click');
        addLog(`🎥 Foco alterado para ${AGENTS[clickedAgent].nome} (clique 3D)`);
        toast.info(`Câmera focada em: ${AGENTS[clickedAgent].nome}`);
        return;
      }

      const intersectsTable = raycaster.intersectObjects([hologram]);
      const intersectsCoffee = raycaster.intersectObject(coffeeTableGroup, true);

      if (intersectsTable.length > 0) {
        // Clicou na Mesa Principal -> Vai para a Reunião (isCoffeeBreak = false)
        if (stateRef.current.isCoffeeBreak) {
          stateRef.current.isCoffeeBreak = false;
          setIsCoffeeBreak(false);
          playSynthSound('success');
          addLog('🔔 [Reunião] Matheusjardim convocou o Squad para a mesa de discussão!');
          toast.info('Squad convocado para a mesa de discussão!');
        }
      } else if (intersectsCoffee.length > 0) {
        // Clicou no Cantinho de Café -> Vai para o Coffee Break (isCoffeeBreak = true)
        if (!stateRef.current.isCoffeeBreak) {
          stateRef.current.isCoffeeBreak = true;
          setIsCoffeeBreak(true);
          playSynthSound('click');
          addLog('☕ [Coffee Break] Matheusjardim liberou o time para um café!');
          toast.info('Squad liberado para o Coffee Break!');
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    domEl.addEventListener('click', onMouseClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('touchstart', onTouchStart, { passive: true });
    domEl.addEventListener('touchmove', onTouchMove, { passive: true });
    domEl.addEventListener('touchend', onTouchEnd, { passive: true });

    const tempV = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3(0, 0.8, 0);
    let reqId;

    const BREAK_POSITIONS = {
      oscar: { x: -2.6, z: -4.0 },
      leo: { x: -4.0, z: -2.6 },
      afrodite: { x: -2.5, z: -3.3 },
      thor: { x: -3.3, z: -2.5 },
      sabotagem: { x: -2.8, z: -2.8 }
    };

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      hologram.rotation.y += 0.006;
      if (hologramModelGroup) {
        hologramModelGroup.rotation.y += 0.012;
        const s1 = hologramModelGroup.getObjectByName("satGroup1");
        if (s1) s1.rotation.y += 0.025;
        const s2 = hologramModelGroup.getObjectByName("satGroup2");
        if (s2) s2.rotation.y -= 0.018;
      }
      
      const pulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.04;
      hologram.scale.set(pulse, 1, pulse);

      // Animate server LEDs randomly
      if (serverLeds.length > 0 && Math.random() < 0.4) {
        const randomLed = serverLeds[Math.floor(Math.random() * serverLeds.length)];
        if (randomLed) {
          randomLed.material.opacity = Math.random() > 0.5 ? 0.95 : 0.2;
          const colors = [0x10b981, 0xef4444, 0xf59e0b];
          randomLed.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        }
      }

      let targetHoloColor = 0x4f46e5;
      let targetSpotColor = 0xffffff;
      let targetBgColor = 0xf1f5f9; // Bright light gray
      let targetAmbient = 1.4; // Bright daylight!
      let targetHemi = 1.3;
      accentLight.color.setHex(0x4f46e5);
      accentLight.intensity = 0.8;

      floorMat.color.setHex(0xf8fafc); // Clean white/light floor
      panelBackMat.color.setHex(0xf1f5f9); // Off-white wall panels
      slatMat.color.setHex(0xd9a066); // Warm pine wood slats for a cozy Habbo vibe!
      tableMat.color.setHex(0xffffff); // Frosted white glass table
      tableMat.opacity = 0.65;
      brassMat.color.setHex(0x94a3b8); // Chrome table border
      standMat.color.setHex(0xe2e8f0); // Chrome stand
      cabinetMat.color.setHex(0xf8fafc); // Clean white buffet cabinet
      frameMat.color.setHex(0x475569); // Sleek dark slate frames for clean boundaries
      seatMat.color.setHex(0xe2e8f0); // Light gray chairs
      hemiLight.groundColor.setHex(0xf1f5f9); // Bright ground reflection light
      if (gridHelper) gridHelper.visible = false; // Hide dark floor grids
      telemetryGridMat.opacity = 0.0;
      outerFloorMat.color.setHex(0xf1f5f9); // Match outer floor with background fog/sky to remove black void boundary!
      scene.fog.density = 0.012; // Decrease fog thickness so wall/windows/accessories are sharp

      // Update floorMat2 checker color
      floorMat2.color.setHex(0xe2e8f0);

      ambientLight.intensity = targetAmbient;
      hemiLight.intensity = targetHemi;
      scene.fog.color.setHex(targetBgColor);
      scene.background = new THREE.Color(targetBgColor);
      
      const activeHoloColor = stateRef.current.hologramColor || targetHoloColor;
      holoMat.color.setHex(activeHoloColor);
      accentLight.color.setHex(activeHoloColor);
      
      spotlight.color.setHex(targetSpotColor);
      renderer.setClearColor(targetBgColor);
      if (bokehGroup) {
        bokehGroup.visible = false;
      }

      tableGlowMat.color.setHex(activeHoloColor);
      orbitRingMat1.color.setHex(activeHoloColor);
      orbitRingMat2.color.setHex(activeHoloColor);
      particlesMat.color.setHex(activeHoloColor);
      floorRingMat.color.setHex(activeHoloColor);

      orbitRing1.rotation.x += 0.01;
      orbitRing1.rotation.y += 0.015;
      orbitRing2.rotation.y -= 0.012;
      orbitRing2.rotation.z += 0.008;

      const posArr = particlesGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += particleSpeeds[i];
        if (posArr[i * 3 + 1] > 2.5) {
          posArr[i * 3 + 1] = 0.5;
        }
      }
      particlesGeo.attributes.position.needsUpdate = true;

      // Animate floor neon rings
      if (floorRings) {
        floorRings.forEach((ring, idx) => {
          ring.rotation.z += 0.003 * (idx % 2 === 0 ? 1 : -1);
          ring.material.opacity = 0.04 + Math.sin(Date.now() * 0.0015 + idx) * 0.02;
        });
      }

      // Animate wall telemetry grids (loft windows)
      if (wallGroup) {
        wallGroup.children.forEach((wall, wIdx) => {
          wall.children.forEach(child => {
            if (child.material === telemetryGridMat) {
              child.scale.x = 1 + Math.sin(Date.now() * 0.002 + wIdx) * 0.015;
              child.scale.y = 1 + Math.cos(Date.now() * 0.0025 + wIdx) * 0.015;
            }
          });
        });
      }


      const active = stateRef.current.activeAgent;

      if (active && AGENTS[active]) {
        const av = avatarObjects[active];
        av.group.position.y = av.baseY + Math.sin(Date.now() * 0.012) * 0.05;
        av.group.scale.set(1.1, 1.1, 1.1);

        const speakerAngle = av.angle;
        targetAngle = -speakerAngle + Math.PI;
      } else {
        if (!isDragging) {
          stateRef.current.rotationY += 0.0012;
        }
        targetAngle = stateRef.current.rotationY;
      }

      if (active) {
        cameraAngleY += (targetAngle - cameraAngleY) * 0.05;
        cameraAngleX += (0.35 - cameraAngleX) * 0.05;
        zoomVal += (3.0 - zoomVal) * 0.05;
      } else {
        zoomVal += (stateRef.current.zoomTarget - zoomVal) * 0.05;
        cameraAngleY = stateRef.current.rotationY;
        cameraAngleX = stateRef.current.rotationX;
      }

      agentsArray.forEach(id => {
        if (id !== active) {
          const av = avatarObjects[id];
          av.group.position.y += (av.baseY - av.group.position.y) * 0.1;
          av.group.scale.set(1, 1, 1);
        }
      });
      
      // Animate agent individual pieces and walk behavior
      agentsArray.forEach(id => {
        const av = avatarObjects[id];
        av.group.rotation.x = 0;
        av.group.rotation.z = 0;
        const isCoffee = stateRef.current.isCoffeeBreak;
        
        // 1. Calculate Target Positions (Meeting vs Coffee Break vs Wander)
        const isActive = (active === id);
        let targetX = NORMAL_POSITIONS[id].x;
        let targetZ = NORMAL_POSITIONS[id].z;

        if (isCoffee) {
          targetX = BREAK_POSITIONS[id].x;
          targetZ = BREAK_POSITIONS[id].z;
          av.isWandering = false;
        } else if (isActive) {
          targetX = NORMAL_POSITIONS[id].x;
          targetZ = NORMAL_POSITIONS[id].z;
          av.isWandering = false;
        } else {
          // Wander behavior for idle agents
          if (!av.wanderTargetX || !av.wanderTimer) {
            av.wanderTargetX = NORMAL_POSITIONS[id].x;
            av.wanderTargetZ = NORMAL_POSITIONS[id].z;
            av.wanderTimer = Date.now() + 2000 + Math.random() * 3000;
          }

          const distToWanderTarget = Math.sqrt(
            Math.pow(av.wanderTargetX - av.group.position.x, 2) +
            Math.pow(av.wanderTargetZ - av.group.position.z, 2)
          );

          if (distToWanderTarget < 0.15 || Date.now() > av.wanderTimer) {
            // Decide new target: 30% chance to go back to desk, 70% to wander randomly
            if (Math.random() < 0.3) {
              av.wanderTargetX = NORMAL_POSITIONS[id].x;
              av.wanderTargetZ = NORMAL_POSITIONS[id].z;
            } else {
              const wAngle = Math.random() * Math.PI * 2;
              const wDist = 1.0 + Math.random() * 3.5;
              av.wanderTargetX = Math.sin(wAngle) * wDist;
              av.wanderTargetZ = Math.cos(wAngle) * wDist;
            }
            av.wanderTimer = Date.now() + 4000 + Math.random() * 5000;
          }

          targetX = av.wanderTargetX;
          targetZ = av.wanderTargetZ;
        }

        const dx = targetX - av.group.position.x;
        const dz = targetZ - av.group.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // 2. Smoothly move group coordinates (reduced speed for natural look)
        if (distance > 0.02) {
          av.group.position.x += dx * 0.012;
          av.group.position.z += dz * 0.012;
        } else {
          av.group.position.x = targetX;
          av.group.position.z = targetZ;
        }
        
        // 3. Handle rotation/orienting of the character
        if (distance > 0.05) {
          const walkAngle = Math.atan2(dx, dz);
          let diff = walkAngle - av.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          av.group.rotation.y += diff * 0.10; // slightly smoother turning
        } else {
          let faceAngle = 0;
          if (isCoffee) {
            const coffeeDx = -3.5 - av.group.position.x;
            const coffeeDz = -3.5 - av.group.position.z;
            faceAngle = Math.atan2(coffeeDx, coffeeDz);
          } else {
            const originDx = -av.group.position.x;
            const originDz = -av.group.position.z;
            faceAngle = Math.atan2(originDx, originDz);
          }
          let diff = faceAngle - av.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          av.group.rotation.y += diff * 0.08;
        }
        
        // 4. Transition Factor (Sitting vs Standing)
        av.transitionFactor = av.transitionFactor ?? 0;
        const distToNormal = Math.sqrt(
          Math.pow(NORMAL_POSITIONS[id].x - av.group.position.x, 2) +
          Math.pow(NORMAL_POSITIONS[id].z - av.group.position.z, 2)
        );
        const isAtNormalPos = distToNormal < 0.2;

        if (isCoffee) {
          av.transitionFactor += (1 - av.transitionFactor) * 0.08;
        } else {
          // Sit only if at normal desk/chair position and not wandering away
          const sits = isSittingNormal[id] && isAtNormalPos && (targetX === NORMAL_POSITIONS[id].x);
          const targetT = sits ? 0 : 1;
          av.transitionFactor += (targetT - av.transitionFactor) * 0.08;
        }
        const t = av.transitionFactor;
        
        // 5. Walking leg/arm swing cycle (slowed down swing speed to match natural walking pace)
        av.walkFactor = av.walkFactor ?? 0;
        if (distance > 0.05) {
          av.walkFactor += (1 - av.walkFactor) * 0.15;
        } else {
          av.walkFactor += (0 - av.walkFactor) * 0.15;
        }
        const wSwing = Math.sin(Date.now() * 0.0045 + id.charCodeAt(0)) * 0.45 * av.walkFactor;
        
        // 6. Shift body position based on sitting vs standing
        const robotBody = av.extraRefs.robotBody;
        if (robotBody) {
          robotBody.position.z = -0.05 * (1 - t) + 0.10 * t;
          robotBody.position.y = 0.15 * t;
        }
        
        // 7. Interpolate & Swing legs
        const hipL = av.extraRefs.hipL;
        const hipR = av.extraRefs.hipR;
        const kneeL = av.extraRefs.kneeL;
        const kneeR = av.extraRefs.kneeR;
        
        if (hipL && hipR && kneeL && kneeR) {
          // Quando sentado (t = 0), hip gira para a frente (-Math.PI/2) e knee dobra para trás (+Math.PI/2)
          hipL.rotation.x = (-Math.PI / 2) * (1 - t) + wSwing * t;
          kneeL.rotation.x = (Math.PI / 2) * (1 - t) + (Math.max(0, -wSwing) * 0.5) * t;
          
          hipR.rotation.x = (-Math.PI / 2) * (1 - t) - wSwing * t;
          kneeR.rotation.x = (Math.PI / 2) * (1 - t) + (Math.max(0, wSwing) * 0.5) * t;
        }
        
        // 8. Interpolate & Swing Arms/Elbows
        const shoulderL = av.extraRefs.shoulderL;
        const shoulderR = av.extraRefs.shoulderR;
        const elbowL = av.extraRefs.elbowL;
        const elbowR = av.extraRefs.elbowR;
        
        if (shoulderL && shoulderR && elbowL && elbowR) {
          // Left Arm (Mão apoia sobre a mesa em pose de trabalho, braço caido na caminhada)
          shoulderL.rotation.x = -0.4 * (1 - t) + (0.1 - wSwing * 0.3) * t;
          shoulderL.rotation.z = 0.05 * (1 - t) + 0.08 * t;
          elbowL.rotation.x = 1.0 * (1 - t) + 0.25 * t;
          
          // Right Arm (holds coffee cup in coffee break, resting on table in meeting)
          shoulderR.rotation.x = -0.4 * (1 - t) - 0.5 * t;
          shoulderR.rotation.y = 0 * (1 - t) - 0.3 * t;
          shoulderR.rotation.z = -0.05 * (1 - t) - 0.1 * t;
          elbowR.rotation.x = 1.0 * (1 - t) + 1.2 * t;
        }
        
        // 9. Show/Scale Coffee Cup
        if (av.extraRefs.coffeeCup) {
          av.extraRefs.coffeeCup.scale.set(t, t, t);
        }
        
        // 10. HUD Screen visibility
        if (av.extraRefs.hudMat && av.extraRefs.hudRingMat) {
          if (active === id) {
            av.extraRefs.hudMat.opacity += (0.6 - av.extraRefs.hudMat.opacity) * 0.1;
            av.extraRefs.hudRingMat.opacity += (0.8 - av.extraRefs.hudRingMat.opacity) * 0.1;
            av.extraRefs.hudMesh.rotation.y = Math.sin(Date.now() * 0.003) * 0.15;
            av.extraRefs.hudMesh.position.y = 0.44 + Math.sin(Date.now() * 0.006) * 0.02;
          } else {
            av.extraRefs.hudMat.opacity += (0.0 - av.extraRefs.hudMat.opacity) * 0.1;
            av.extraRefs.hudRingMat.opacity += (0.0 - av.extraRefs.hudRingMat.opacity) * 0.1;
          }
        }

        // 11. Human breathing animation (subtle)
        const breathe = Math.sin(Date.now() * 0.0025 + id.charCodeAt(0)) * 0.006;
        av.group.position.y = av.baseY + breathe;

        // 12. Individual accessory animations
        if (id === 'oscar') {
          if (av.extraRefs.blueprintRing) {
            av.extraRefs.blueprintRing.rotation.z += 0.006;
          }
        }
        if (id === 'leo') {
          // Olhos piscando (humano)
          const isBlinking = (Math.floor(Date.now() / 3500) % 3 === 0) && (Date.now() % 3500 < 120);
          if (av.extraRefs.eyeL && av.extraRefs.eyeR) {
            const targetEyeY = isBlinking ? 0.08 : 1.0;
            av.extraRefs.eyeL.scale.y += (targetEyeY - av.extraRefs.eyeL.scale.y) * 0.35;
            av.extraRefs.eyeR.scale.y += (targetEyeY - av.extraRefs.eyeR.scale.y) * 0.35;
          }
        }
        if (id === 'afrodite' && av.extraRefs.hairStrands) {
          // Tranças oscilando suavemente
          av.extraRefs.hairStrands.forEach((strand, idx) => {
            strand.rotation.z = Math.sin(Date.now() * 0.004 + idx) * 0.04;
          });
        }
        
        // 13. Active speaker talking expressions
        if (active === id) {
          av.head.rotation.y = Math.sin(Date.now() * 0.007) * 0.15; // Vira cabeça falando
          av.head.position.y = 0.23 + Math.sin(Date.now() * 0.014) * 0.004; // Cabeça balança
        } else {
          av.head.rotation.y += (0.0 - av.head.rotation.y) * 0.1;
          av.head.position.y += (0.23 - av.head.position.y) * 0.1;
        }
      });

      camera.position.x = zoomVal * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.z = zoomVal * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.y = zoomVal * Math.sin(cameraAngleX);
      
      const isCoffee = stateRef.current.isCoffeeBreak;
      const targetLookAtX = isCoffee ? -3.3 : 0;
      const targetLookAtY = isCoffee ? 0.65 : 0.8;
      const targetLookAtZ = isCoffee ? -3.3 : 0;
      
      currentLookAt.x += (targetLookAtX - currentLookAt.x) * 0.05;
      currentLookAt.y += (targetLookAtY - currentLookAt.y) * 0.05;
      currentLookAt.z += (targetLookAtZ - currentLookAt.z) * 0.05;
      
      camera.lookAt(currentLookAt);

      agentsArray.forEach(id => {
        const bubbleEl = bubblesRefs[id].current;
        if (bubbleEl) {
          const av = avatarObjects[id];
          av.group.getWorldPosition(tempV);
          tempV.y += 0.42;
          
          tempV.project(camera);

          if (tempV.z > 1.0) {
            bubbleEl.style.display = 'none';
          } else {
            const x2d = (tempV.x * 0.5 + 0.5) * width;
            const y2d = (tempV.y * -0.5 + 0.5) * height;

            bubbleEl.style.display = (active === id && speechTextRef.current) ? 'block' : 'none';
            bubbleEl.style.left = `${x2d}px`;
            bubbleEl.style.top = `${y2d}px`;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!viewportRef.current) return;
      const wRes = viewportRef.current.clientWidth;
      const hRes = viewportRef.current.clientHeight;
      camera.aspect = wRes / hRes;
      camera.updateProjectionMatrix();
      renderer.setSize(wRes, hRes);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(viewportRef.current);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      if (domEl) {
        domEl.removeEventListener('mousedown', onMouseDown);
        domEl.removeEventListener('click', onMouseClick);
        domEl.removeEventListener('wheel', onWheel);
        domEl.removeEventListener('touchstart', onTouchStart);
        domEl.removeEventListener('touchmove', onTouchMove);
        domEl.removeEventListener('touchend', onTouchEnd);
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
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

    // Call all agents sequentially
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

        try {
          const contextMsg = i === 0
            ? userMsg
            : `O Chefe Matheusjardim disse: "${userMsg}". Os agentes anteriores já falaram. Contribua com sua perspectiva única no personagem. Seja breve.`;

          const customPrompt = isConversationalMsg
            ? `${AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar}
Escreva uma resposta de saudação informal ao Chefe Matheusjardim. Inicie a resposta obrigatoriamente dizendo "Oi", "Olá" ou outra saudação similar no seu estilo/personagem. Responda de forma extremamente curta e natural (máximo 1 ou 2 frases). Não invente tarefas técnicas fictícias ou progresso de desenvolvimento que não existe. Apenas saúde o chefe e diga que está pronto para receber tarefas.`
            : null;

          const agentReply = await chatWithAgent(agentId, contextMsg, convHistory, customPrompt);

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
          addLog(`⚠️ [${agentInfo.nome}] Erro: ${err.message}`);
        }

        // Wait between agents
        if (i < agentOrder.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
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

    if (realExecution) {
      if (!socket || !isConnected) {
        toast.error('Servidor local desconectado! Ligue o servidor para a execução real.');
        setRunning(false);
        return;
      }
      setRunning(true);
      stateRef.current.isCoffeeBreak = false;
      setIsCoffeeBreak(false);
      setLogs([]);
      setAiData(null);
      setInventoryApproved(false);
      setSelectedTab('conversa');
      setCurrentPhase('architecture');
      setHologramContent('Enviando requisição para execução real...');
      setChatThread([]);
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

      addLog('🚀 [Squad Real] Solicitando execução real no servidor local...');
      addLog(`📝 [Requisito] "${prompt}"`);
      playSynthSound('hum');

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

      // Pre-parse using AI logic to enable 3D preview and stock immediately
      try {
        const parsed = await parseProjectText(prompt, domain === 'marble');
        setAiData(parsed);
        
        let matName = 'Insumos Gerais';
        let reqQty = 1.0;
        let stQty = 2.0;
        let supplierName = 'Distribuidora Global';
        let purchaseCost = 150;
        let measureUnit = 'unidades';

        if (domain === 'glass') {
          matName = `Vidro Temperado 8mm ${parsed.corVidro || 'Incolor'}`;
          const glassArea = (parsed.largura * parsed.altura) / 1000000;
          reqQty = parseFloat((glassArea / 2.0).toFixed(2));
          stQty = 1.0;
          supplierName = 'Vidros Blindex Sul';
          purchaseCost = 450;
          measureUnit = 'Chapas';
        } else if (domain === 'marble') {
          matName = parsed.pedra || 'Granito Verde Ubatuba';
          const stoneArea = (parsed.largura * (parsed.profundidade || 600)) / 1000000;
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

        const invData = {
          materialName: matName,
          required: reqQty,
          stock: stQty,
          status: reqQty > stQty ? 'insufficient' : 'safe',
          supplier: supplierName,
          cost: purchaseCost,
          unit: measureUnit
        };
        setInventoryData(invData);
        
        // Also simulate stock debate logs
        let debateTxt = `💬 [MESA DE DEBATE DE SUPRIMENTOS]\n-----------------------------------------------\n`;
        let chatMsgThor = `Chequei o estoque de '${matName}'. Temos ${stQty} ${measureUnit} e consumiremos ${reqQty} ${measureUnit}. Estoque seguro!`;
        let chatMsgAfrodite = `Perfeito. Nossos custos e níveis de reabastecimento do modulo principal estão dentro do esperado.`;
        let chatMsgOscar = `Excelente. Plano de suprimentos validado.`;
        let chatMsgSabo = `Margem de lucro nas nuvens!`;

        if (reqQty > stQty) {
          chatMsgThor = `Galera, atenção! O projeto consome ${reqQty} ${measureUnit} de '${matName}', mas no estoque físico só temos ${stQty} ${measureUnit}. O estoque está INSUFICIENTE!`;
          chatMsgAfrodite = `Confirmo a falta, Ragnar. A '${supplierName}' possui o material em estoque por R$ ${purchaseCost},00.`;
          chatMsgOscar = `Autorizo a compra emergencial. Criei a Ordem de Compra. Shaldon, atualize o status de suprimentos. Administrador, por favor aprove o pagamento na aba 'Suprimentos'.`;
          chatMsgSabo = `É isso! Se o chefe clicar em 'Aprovar' na aba de Suprimentos, o material chega em 24h!`;
        }

        debateTxt += `⚡ Ragnar: "${chatMsgThor}"\n\n🌸 Nairobi: "${chatMsgAfrodite}"\n\n🔍 Oscar: "${chatMsgOscar}"\n\n🎤 Sabotagem: "${chatMsgSabo}"`;
        setArtifacts(prev => ({
          ...prev,
          suprimentos: debateTxt
        }));
      } catch (err) {
        console.warn("Real squad pre-parse error:", err);
      }

      socket.emit('RUN_SQUAD_REAL', { requirement: prompt, validationCommand });

      socket.off('SQUAD_REAL_EVENT');
      socket.on('SQUAD_REAL_EVENT', (event) => {
        const { name, data } = event;
        if (name === 'log') {
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data}`]);
        } else if (name === 'domain_detected') {
          setDomainDetected(data);
          addLog(`🎯 Domínio do projeto alterado para: ${data.toUpperCase()}`);
        } else if (name === 'wait_user_approval') {
          setWaitingForUser(true);
          setHologramContent('Oscar Niemeyer gerou o plano. Aprove-o abaixo ou envie feedback de alteração.');
          toast.info('Oscar Niemeyer aguarda sua aprovação para o plano de ação.');
          setArtifacts(prev => ({
            ...prev,
            oscar: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          }));
        } else if (name === 'phase') {
          setCurrentPhase(data);
          if (data === 'architecture') {
            setHologramContent('Oscar Niemeyer está analisando o plano arquitetônico...');
          } else if (data === 'ui') {
            setHologramContent('Shaldon está construindo a interface visual...');
          } else if (data === 'backend') {
            setHologramContent('Nairobi está mapeando endpoints e banco de dados...');
          } else if (data === 'qa') {
            setHologramContent('Ragnar está validando e rodando testes...');
          } else if (data === 'marketing') {
            setHologramContent('Sabotagem está desenvolvendo a campanha de marketing...');
          } else if (data === 'done') {
            setHologramContent('Projeto entregue com sucesso!');
            setRunning(false);
            setActiveAgent(null);
            setSpeechText('');
            toast.success('Tarefa concluída pelo Squad Real!');
            try {
              import('canvas-confetti').then((confetti) => {
                confetti.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
              });
            } catch (e) {
              // ignore confetti failure
            }
          } else if (data === 'failed') {
            setHologramContent('Ocorreu um erro no build e os arquivos foram revertidos.');
            setRunning(false);
            setActiveAgent(null);
            setSpeechText('');
            toast.error('O Squad Real falhou em entregar a tarefa.');
          }
        } else if (name === 'speech') {
          const { agent, text } = data;
          setActiveAgent(agent);
          setSpeechText(text);
          setChatThread(prev => {
            if (prev.length > 0 && prev[prev.length - 1].text === text) return prev;
            return [...prev, {
              id: agent,
              nome: AGENTS[agent]?.nome || agent,
              emoji: AGENTS[agent]?.emoji || '🤖',
              text: text,
              time: new Date().toLocaleTimeString()
            }];
          });
        } else if (name === 'artifact') {
          const { agent, content } = data;
          setArtifacts(prev => ({
            ...prev,
            [agent]: content
          }));
          if (agent === 'sabotagem') {
            try {
              const camp = JSON.parse(content);
              setHologramContent(`Slogan: "${camp.slogan}"\n\nCopy: "${camp.copyLegenda}"`);
            } catch (e) {
              setHologramContent(content);
            }
          } else {
            setHologramContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
          }
        } else if (name === 'bmad_artifact') {
          const { path: filePath, content } = data;
          setBmadDocs(prev => ({
            ...prev,
            [filePath]: content
          }));
        } else if (name === 'error') {
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro: ${data}`]);
          setHologramContent(`Erro de Execução: ${data}`);
          setRunning(false);
          setActiveAgent(null);
          setSpeechText('');
          toast.error(`Erro no Squad: ${data}`);
        }
      });
      return;
    }

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

      // Helper to make an agent speak with real AI
      const agentSay = async (agentId, phase, hologramMsg) => {
        setCurrentPhase(phase);
        setActiveAgent(agentId);
        setHologramContent(hologramMsg);
        playSynthSound('hum');

        const agentInfo = AGENTS[agentId];
        const agentPrompt = `O Chefe Matheusjardim disse: "${prompt}". Responda de forma natural e no personagem.`;
        
        const customPrompt = `${AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar}
Escreva uma resposta de saudação informal ao Chefe Matheusjardim. Inicie a resposta obrigatoriamente dizendo "Oi", "Olá" ou outra saudação similar no seu estilo/personagem. Responda de forma extremamente curta e natural (máximo 1 ou 2 frases). Não invente tarefas técnicas fictícias ou progresso de desenvolvimento que não existe. Apenas saúde o chefe e diga que está pronto para receber tarefas.`;

        const reply = await chatWithAgent(agentId, agentPrompt, convHistory, customPrompt);

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
      };

      // Each agent responds sequentially
      await agentSay('oscar', 'architecture', 'Oscar Niemeyer está pensando...');
      await sleep(2000);
      await agentSay('leo', 'ui', 'Sheldon está processando...');
      await sleep(2000);
      await agentSay('afrodite', 'backend', 'Nairobi está no comando...');
      await sleep(2000);
      await agentSay('thor', 'qa', 'Ragnar prepara o machado...');
      await sleep(2000);
      await agentSay('sabotagem', 'marketing', 'Sabotagem solta a rima...');

      await sleep(2000);
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

    // -------------------------------------------------------------
    // FASE 1: Oscar Niemeyer (Análise via IA com Blueprint JSON)
    // -------------------------------------------------------------
    setActiveAgent('oscar');
    
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
      const parts = reply.split('--- CODE ---');
      leoSpeech = parts[0].trim();
      leoHolo = parts[1] ? parts[1].trim() : `// src/components/Prototype.jsx\nimport React from 'react';\nexport default function Prototype() {\n  return <div className="p-4">Interface para ${prompt}</div>;\n}`;
    } catch (e) {
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
      const parts = reply.split('--- CODE ---');
      afroditeSpeech = parts[0].trim();
      afroditeHolo = parts[1] ? parts[1].trim() : `// src/services/backend.js\nexport const service = {};`;
    } catch (e) {
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
      const parts = reply.split('--- WARNING ---');
      thorSpeech = parts[0].trim();
      thorWarning = parts[1] ? parts[1].trim() : '⚠️ [ESLint] \'useAuth\' is defined but never used in src/components/pdv-modals/ModalResumoTurno.jsx (102:18)';
    } catch (e) {
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
    const sheldonFixPrompt = `Como Shaldon (Sheldon Cooper), engenheiro front-end:
Ragnar alertou sobre o erro: "${thorWarning}".
Diga de forma curta e nerd (1 frase com Bazinga!) que corrigiu o erro e explique de forma técnica e lógica o ajuste (ex: limpou definições não usadas).`;
    
    let sheldonFixSpeech = '';
    try {
      sheldonFixSpeech = await chatWithAgent('leo', sheldonFixPrompt, convHistory);
    } catch (e) {
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
      const parts = reply.split('--- TESTS ---');
      thorFinalSpeech = parts[0].trim();
      thorHolo = parts[1] ? parts[1].trim() : '✓ all tests passed successfully!\n🚀 Build finalizado com SUCESSO!';
    } catch (e) {
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
      const parts = reply.split('--- SLOGAN ---');
      sabotagemSpeech = parts[0].trim();
      sabotagemHolo = parts[1] ? parts[1].trim() : '--- SLOGAN DE MARKETING ---\n"Otimização inteligente na pista."\n\n--- COPY INSTAGRAM ---\nCódigo pronto no ar! #SaaS';
    } catch (e) {
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
            {realExecution ? 'EXECUÇÃO REAL' : 'SIMULAÇÃO'}
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

          {/* Retro Synthesizer Soundboard */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-[var(--sq-border)] space-y-2 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--sq-text-dim)]">
                🎛️ Synth 8-Bit
              </span>
              <span className="text-[8px] font-mono text-[var(--sq-accent)] font-bold">AUDIO</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => playSynthSound('click')}
                className="py-1 px-1.5 bg-slate-900/60 border border-slate-800 text-[9px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded uppercase transition-all"
              >
                🖱️ Click
              </button>
              <button
                type="button"
                onClick={() => playSynthSound('hum')}
                className="py-1 px-1.5 bg-slate-900/60 border border-slate-800 text-[9px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded uppercase transition-all"
              >
                🌀 Hum
              </button>
              <button
                type="button"
                onClick={() => playSynthSound('warning')}
                className="py-1 px-1.5 bg-slate-900/60 border border-slate-800 text-[9px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded uppercase transition-all"
              >
                ⚠️ Alert
              </button>
              <button
                type="button"
                onClick={() => playSynthSound('success')}
                className="py-1 px-1.5 bg-slate-900/60 border border-slate-800 text-[9px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded uppercase transition-all"
              >
                ✨ Win
              </button>
            </div>
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
      {/* 3D VIEWPORT                                                */}
      {/* ========================================================= */}
      <div className="squad-3d-viewport relative">
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
                <div className="flex flex-col h-full space-y-4 justify-between">
                  {/* Discussion Chat Thread */}
                  
                  <div className="space-y-3">
                    {chatThread.map((msg, index) => {
                      const isSystem = msg.id === 'system';
                      
                      let borderClass = isLight ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-800 bg-slate-950/45';
                      let labelColor = isLight ? 'text-slate-650' : 'text-slate-400';
                      
                      if (msg.id === 'oscar') {
                        borderClass = isLight ? 'border-slate-300 bg-slate-100/70 shadow-sm' : 'border-slate-300/40 bg-slate-900/30';
                        labelColor = isLight ? 'text-slate-700' : 'text-slate-300';
                      } else if (msg.id === 'leo') {
                        borderClass = isLight ? 'border-sky-200 bg-sky-50/70 shadow-sm' : 'border-sky-500/30 bg-sky-950/10';
                        labelColor = isLight ? 'text-sky-700' : 'text-sky-450';
                      } else if (msg.id === 'afrodite') {
                        borderClass = isLight ? 'border-pink-200 bg-pink-50/70 shadow-sm' : 'border-pink-500/30 bg-pink-950/10';
                        labelColor = isLight ? 'text-pink-700' : 'text-pink-400';
                      } else if (msg.id === 'thor') {
                        borderClass = isLight ? 'border-amber-300 bg-amber-50/70 shadow-sm' : 'border-yellow-500/30 bg-yellow-950/10';
                        labelColor = isLight ? 'text-amber-700' : 'text-yellow-400';
                      } else if (msg.id === 'sabotagem') {
                        borderClass = isLight ? 'border-emerald-200 bg-emerald-50/70 shadow-sm' : 'border-emerald-500/30 bg-emerald-950/10';
                        labelColor = isLight ? 'text-emerald-700' : 'text-emerald-400';
                      } else if (isSystem) {
                        borderClass = isLight ? 'border-red-200 bg-red-50/70 shadow-sm' : 'border-red-500/25 bg-red-950/10';
                        labelColor = isLight ? 'text-red-700' : 'text-red-400';
                      }

                      return (
                        <div key={index} className={`p-3.5 rounded-2xl border ${borderClass} space-y-1 transition-all duration-300 hover:shadow-md`}>
                          <div className="flex justify-between items-center text-[10.5px]">
                            <span className={`font-black flex items-center gap-1.5 ${labelColor}`}>
                              <span>{msg.emoji}</span>
                              <span>{msg.nome}</span>
                            </span>
                            <span className="text-slate-500 font-normal">{msg.time}</span>
                          </div>
                          <p className={`text-[12.5px] leading-relaxed font-bold whitespace-pre-wrap text-[var(--sq-text)] opacity-95`}>
                            {msg.text}
                          </p>
                        </div>
                      );
                    })}

                    {chatThread.length === 0 && (
                      <div className="py-16 text-center text-slate-500 font-bold text-sm">
                        💬 Aguardando início da discussão do Squad...
                      </div>
                    )}
                  </div>

                  {/* Persistent Chat Input — always visible when meeting is running */}
                  {(running || chatThread.length > 0) && (
                    <div className={`sticky bottom-0 pt-3 pb-1 ${isLight ? 'bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent' : 'bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent'}`}>
                      <form onSubmit={handleSendFeedback} className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className={`flex-grow p-2.5 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-xs font-bold transition-all focus:outline-none ${bgInput}`}
                          placeholder="Fale com o squad... (ex: 'mude a cor', 'ok', 'parar')" 
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all duration-200 shadow-lg shadow-indigo-500/20"
                        >
                          Enviar
                        </button>
                      </form>
                      {waitingForUser && (
                        <button
                          type="button"
                          onClick={handleApproveAndProceed}
                          className="w-full mt-2 py-2 bg-amber-650/90 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          ✅ Aprovar e Prosseguir para Próxima Fase
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Latência do Firebase</span>
                      <span className="text-xs font-black text-cyan-400 font-mono">14 ms <span className="text-[9px] text-emerald-450">● Nominal</span></span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Conexões FireStore</span>
                      <span className="text-xs font-black text-white font-mono">24 ativas <span className="text-[9px] text-emerald-450">● Conectado</span></span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">Canal WebSocket</span>
                      <span className="text-xs font-black text-white font-mono">Habilitado <span className="text-[9px] text-emerald-450">● Online</span></span>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-black">CPU / Memória</span>
                      <span className="text-xs font-black text-cyan-400 font-mono">4.2% / 128MB</span>
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

      {/* ========================================================= */}
      {/* BOTTOM BAR — Agent Pipeline                                */}
      {/* ========================================================= */}
      <div className="squad-bottombar">
        <div className="squad-pipeline">
          <div className="squad-step-line" />
          <div 
            className="squad-step-line-active" 
            style={{ 
              width: `${
                currentPhase === 'architecture' ? '10%' 
                : currentPhase === 'ui' ? '30%' 
                : currentPhase === 'backend' ? '50%' 
                : currentPhase === 'qa' ? '70%' 
                : currentPhase === 'marketing' ? '90%' 
                : currentPhase === 'done' ? '100%' 
                : '0%'
              }` 
            }} 
          />
          {[
            { id: 'oscar', phase: 'architecture', label: 'Oscar' },
            { id: 'leo', phase: 'ui', label: 'Sheldon' },
            { id: 'afrodite', phase: 'backend', label: 'Nairobi' },
            { id: 'thor', phase: 'qa', label: 'Ragnar' },
            { id: 'sabotagem', phase: 'marketing', label: 'Sabotagem' }
          ].map((step) => {
            const phases = ['architecture', 'ui', 'backend', 'qa', 'marketing', 'done'];
            const currentIdx = phases.indexOf(currentPhase);
            const stepIdx = phases.indexOf(step.phase);
            const isDone = currentIdx > stepIdx;
            const isActive = currentPhase === step.phase;
            const agent = AGENTS[step.id];

            return (
              <div key={step.id} className="squad-step-dot">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                  isActive
                    ? 'bg-[var(--sq-accent)] shadow-[0_0_14px_var(--sq-accent-glow)] scale-110'
                    : isDone
                      ? 'bg-[var(--sq-accent2)] opacity-80'
                      : 'bg-slate-800 opacity-40'
                }`}>
                  {agent?.emoji}
                </div>
                <span className={`text-[8px] font-bold mt-1 ${
                  isActive ? 'text-[var(--sq-accent)]' : isDone ? 'text-[var(--sq-accent2)]' : 'text-[var(--sq-text-muted)]'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}