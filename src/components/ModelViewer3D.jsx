import React, { useState, useRef, useEffect, useMemo } from 'react';
import { IoCubeOutline, IoExpandOutline, IoPhonePortraitOutline, IoClose } from 'react-icons/io5';

// Carrega model-viewer via CDN sob demanda (evita crash de dependência circular do three.js no bundle
// e não bloqueia o app quando offline)
let modelViewerLoaded = false;
function loadModelViewer() {
  if (modelViewerLoaded || typeof window === 'undefined') return;
  if (document.querySelector('script[data-model-viewer]')) { modelViewerLoaded = true; return; }
  if (!navigator.onLine) return; // Não tenta carregar offline
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  script.dataset.modelViewer = 'true';
  script.onerror = () => console.warn('model-viewer CDN indisponível (offline?)');
  document.head.appendChild(script);
  modelViewerLoaded = true;
}

/**
 * Componente de visualização 3D usando Google <model-viewer>.
 * 
 * Em dev, roteia downloads de .glb pelo proxy do Vite para evitar CORS.
 * Em prod, usa a URL direta (CORS precisa estar configurado no bucket).
 * 
 * Props:
 *  - src: URL do arquivo .glb (modelo 3D)
 *  - poster: URL da imagem 2D (fallback enquanto carrega)
 *  - alt: Texto alternativo
 *  - compact: boolean — modo compacto (dentro do card) vs fullscreen
 *  - coresEstabelecimento: { primaria, destaque }
 */

/**
 * Reescreve URL do Firebase Storage para passar pelo proxy do Vite (dev only).
 * Ex: https://firebasestorage.googleapis.com/v0/b/xxx/o/file?alt=media
 *  → /firebase-storage/v0/b/xxx/o/file?alt=media
 */
function proxyStorageUrl(url) {
  if (!url) return url;
  const isDev = import.meta.env.DEV;
  if (isDev && url.includes('firebasestorage.googleapis.com')) {
    return url.replace('https://firebasestorage.googleapis.com', '/firebase-storage');
  }
  return url;
}

function ModelViewer3D({ src, poster, alt = 'Modelo 3D', compact = true, coresEstabelecimento }) {
  const cores = coresEstabelecimento || { primaria: '#EA1D2C', destaque: '#059669' };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const viewerRef = useRef(null);

  // Carrega o script do model-viewer via CDN quando o componente monta (só se online)
  useEffect(() => { loadModelViewer(); }, []);

  // URL do modelo (passa pelo proxy em dev)
  const modelSrc = useMemo(() => proxyStorageUrl(src), [src]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleProgress = (e) => {
      setLoadProgress(Math.round(80 + e.detail.totalProgress * 20));
    };
    const handleLoad = () => {
      setIsLoading(false);
      setLoadProgress(100);
    };
    const handleError = () => {
      setIsLoading(false);
    };

    viewer.addEventListener('progress', handleProgress);
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);

    // Fallback: se após 5s o modelo não carregar, remove loading overlay
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      viewer.removeEventListener('progress', handleProgress);
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
      clearTimeout(fallbackTimer);
    };
  }, [modelSrc]);

  // Fecha fullscreen com Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  if (!src) return null;

  const badge3D = (
    <div 
      className="absolute top-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-white text-[10px] font-bold backdrop-blur-sm"
      style={{ backgroundColor: `${cores.primaria}CC` }}
    >
      <IoCubeOutline size={12} />
      3D
    </div>
  );

  // ─── MODO COMPACTO (dentro do card) ─────────────────
  if (compact && !isFullscreen) {
    return (
      <div className="relative w-full h-full">
        {badge3D}
        {modelSrc ? (
          <model-viewer
            ref={viewerRef}
            src={modelSrc}
            poster={poster}
            alt={alt}
            auto-rotate
            camera-controls
            touch-action="pan-y"
            interaction-prompt="none"
            shadow-intensity="0.5"
            loading="eager"
            reveal="auto"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              backgroundColor: '#f3f4f6',
              '--poster-color': 'transparent',
            }}
          />
        ) : null}

        {/* Loading overlay - semi-transparent para o modelo aparecer por baixo */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/70 rounded-lg pointer-events-none">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin mb-1" />
            <span className="text-[10px] text-gray-500">{loadProgress}%</span>
          </div>
        )}

        {/* Botão expandir */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
          className="absolute top-1 right-1 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors"
          title="Ver em tela cheia"
        >
          <IoExpandOutline size={14} className="text-gray-700" />
        </button>
      </div>
    );
  }

  // ─── MODO FULLSCREEN (overlay) ──────────────────────
  return (
    <>
      {/* Trigger quando compact=true */}
      {compact && (
        <div className="relative w-full h-full cursor-pointer" onClick={() => setIsFullscreen(true)}>
          {badge3D}
          <model-viewer
            src={modelSrc}
            poster={poster}
            alt={alt}
            auto-rotate
            interaction-prompt="none"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              backgroundColor: '#f3f4f6',
              '--poster-color': 'transparent',
            }}
          />
        </div>
      )}

      {/* Overlay Fullscreen */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10">
            <div className="flex items-center gap-2">
              <IoCubeOutline size={20} className="text-white" />
              <span className="text-white font-bold text-sm">{alt}</span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors"
            >
              <IoClose size={20} className="text-white" />
            </button>
          </div>

          {/* Viewer principal */}
          {modelSrc ? (
            <model-viewer
              ref={viewerRef}
              src={modelSrc}
              poster={poster}
              alt={alt}
              auto-rotate
              camera-controls
              ar
              ar-modes="webxr scene-viewer quick-look"
              touch-action="none"
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1.1"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '600px',
                maxHeight: '70vh',
                backgroundColor: 'transparent',
              }}
            >
              {/* Botão AR nativo do model-viewer */}
              <button 
                slot="ar-button"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
                style={{ backgroundColor: cores.primaria }}
              >
                <IoPhonePortraitOutline size={18} />
                Ver na sua mesa (AR)
              </button>
            </model-viewer>
          ) : null}

          {/* Loading */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2" />
              <span className="text-white/70 text-sm">Carregando modelo... {loadProgress}%</span>
            </div>
          )}

          {/* Dica de interação */}
          <p className="absolute bottom-4 text-white/50 text-xs text-center">
            Arraste para girar • Pinça para zoom
          </p>
        </div>
      )}
    </>
  );
}

export default ModelViewer3D;
