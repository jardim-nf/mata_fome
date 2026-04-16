import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
  Easing,
} from 'remotion';

/* ─────────────── CONFIG ─────────────── */
const ORANGE = '#FF6B00';
const DARK = '#0D0D0D';
const DARK2 = '#1A1A2E';
const WHITE = '#FFFFFF';
const GRAY = '#9CA3AF';

const FPS = 30;

/* ─────────── SCENE 1 — SPLASH / Logo Reveal (0–90 frames = 3s) ─────────── */
const SplashScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Background pulse animation
  const pulseScale = interpolate(frame, [0, 45, 90], [1, 1.15, 1.05], {
    extrapolateRight: 'clamp',
  });

  // Logo scale with spring
  const logoScale = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 80 }, delay: 10 });

  // Text fade in
  const textOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [30, 50], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Tagline
  const tagOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagY = interpolate(frame, [50, 70], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Particles
  const particles = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2;
    const radius = interpolate(frame, [5, 60], [0, 300 + i * 15], { extrapolateRight: 'clamp' });
    const opacity = interpolate(frame, [5, 30, 70, 90], [0, 0.8, 0.6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity, size: 3 + (i % 4) * 2 };
  });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${DARK2}, ${DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulsing glow background */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${ORANGE}40, transparent 70%)`,
        transform: `scale(${pulseScale})`, filter: 'blur(80px)',
      }} />

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
          background: i % 3 === 0 ? ORANGE : WHITE,
          transform: `translate(${p.x}px, ${p.y}px)`, opacity: p.opacity,
        }} />
      ))}

      {/* Logo + Title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, transform: `scale(${logoScale})` }}>
        {/* Icon */}
        <div style={{
          width: 140, height: 140, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${ORANGE}, #FF8C38)`,
          boxShadow: `0 20px 80px ${ORANGE}60`, marginBottom: 30, fontSize: 72,
        }}>
          🍔
        </div>

        {/* Brand Name */}
        <div style={{
          fontSize: 96, fontWeight: 900, letterSpacing: -3, fontFamily: 'Inter, sans-serif',
          background: `linear-gradient(135deg, ${WHITE}, ${ORANGE})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: textOpacity, transform: `translateY(${textY}px)`,
        }}>
          IdeaFood
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 28, fontWeight: 500, color: GRAY, fontFamily: 'Inter, sans-serif',
          opacity: tagOpacity, transform: `translateY(${tagY}px)`, marginTop: 12,
        }}>
          O sistema completo para o seu restaurante
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── SCENE 2 — Dashboard Hero (90–195 frames = 3.5s) ─────────── */
const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();

  const imgScale = spring({ frame, fps: FPS, config: { damping: 15, stiffness: 60 }, delay: 5 });
  const imgOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Caption
  const captionOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const captionX = interpolate(frame, [25, 45], [-60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Floating badge
  const badgeY = interpolate(frame, [40, 60, 80, 105], [-50, 0, 0, -50], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const badgeOpacity = interpolate(frame, [40, 55, 85, 105], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${DARK2} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Screen mockup */}
      <div style={{
        width: 1200, height: 700, borderRadius: 24, overflow: 'hidden',
        boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 60px ${ORANGE}20`,
        transform: `scale(${imgScale * 0.85}) perspective(1000px) rotateY(-2deg)`,
        opacity: imgOpacity, border: `2px solid ${ORANGE}30`,
      }}>
        <Img src={staticFile('assets/hero.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* Caption */}
      <div style={{
        position: 'absolute', left: 80, bottom: 120,
        opacity: captionOpacity, transform: `translateX(${captionX}px)`,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: ORANGE, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 8 }}>
          Painel Completo
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: WHITE, fontFamily: 'Inter, sans-serif', lineHeight: 1.1, maxWidth: 500 }}>
          Gerencie tudo em tempo real
        </div>
      </div>

      {/* Floating badge */}
      <div style={{
        position: 'absolute', right: 120, top: 100,
        background: `linear-gradient(135deg, ${ORANGE}, #FF8C38)`,
        padding: '16px 32px', borderRadius: 20, boxShadow: `0 20px 60px ${ORANGE}50`,
        opacity: badgeOpacity, transform: `translateY(${badgeY}px)`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: 2 }}>Vendas Hoje</div>
        <div style={{ fontSize: 42, fontWeight: 900, color: WHITE, fontFamily: 'Inter, sans-serif' }}>R$ 4.280</div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── SCENE 3 — Features Grid (195–300 frames = 3.5s) ─────────── */
const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const features = [
    { icon: '📱', title: 'Cardápio Digital', desc: 'QR Code + Delivery' },
    { icon: '🖥️', title: 'PDV Completo', desc: 'NFC-e integrado' },
    { icon: '🛵', title: 'Entregas', desc: 'Rastreio em tempo real' },
    { icon: '📊', title: 'Relatórios', desc: 'Lucro e analytics' },
    { icon: '🤖', title: 'Bot WhatsApp', desc: 'Pedidos automáticos' },
    { icon: '🖨️', title: 'Impressão', desc: 'Cozinha e Bar' },
  ];

  // Title animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 50%, ${DARK2}, ${DARK})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      {/* Title */}
      <div style={{
        fontSize: 56, fontWeight: 900, color: WHITE, fontFamily: 'Inter, sans-serif',
        marginBottom: 60, opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        textAlign: 'center',
      }}>
        Tudo que seu restaurante{' '}
        <span style={{ color: ORANGE }}>precisa</span>
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', maxWidth: 1200 }}>
        {features.map((feat, idx) => {
          const delay = 15 + idx * 8;
          const s = spring({ frame, fps: FPS, config: { damping: 14, stiffness: 100 }, delay });
          const featOpacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          return (
            <div key={idx} style={{
              width: 350, padding: 36, borderRadius: 24,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              transform: `scale(${s})`, opacity: featOpacity,
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: `linear-gradient(135deg, ${ORANGE}20, ${ORANGE}05)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0,
              }}>
                {feat.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: WHITE, fontFamily: 'Inter, sans-serif' }}>{feat.title}</div>
                <div style={{ fontSize: 16, color: GRAY, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>{feat.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── SCENE 4 — Mobile App (300–375 frames = 2.5s) ─────────── */
const MobileScene: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneScale = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 70 }, delay: 5 });
  const phoneY = interpolate(frame, [0, 25], [80, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Text animations
  const textOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textX = interpolate(frame, [20, 40], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${DARK} 0%, ${DARK2} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${ORANGE}25, transparent 70%)`,
        filter: 'blur(100px)', left: '25%', top: '20%',
      }} />

      {/* Phone mockup */}
      <div style={{
        width: 380, borderRadius: 40, overflow: 'hidden',
        boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 40px ${ORANGE}15`,
        transform: `scale(${phoneScale}) translateY(${phoneY}px)`,
        marginRight: 120,
      }}>
        <Img src={staticFile('assets/mobile.png')} style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Text */}
      <div style={{
        position: 'absolute', right: 120, top: '50%', transform: 'translateY(-50%)',
        opacity: textOpacity,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: ORANGE, fontFamily: 'Inter, sans-serif',
          textTransform: 'uppercase', letterSpacing: 4, marginBottom: 16,
          transform: `translateX(${textX}px)`,
        }}>
          Seus clientes pedem
        </div>
        <div style={{
          fontSize: 52, fontWeight: 900, color: WHITE, fontFamily: 'Inter, sans-serif',
          lineHeight: 1.15, maxWidth: 500, transform: `translateX(${textX}px)`,
        }}>
          Direto pelo celular
        </div>
        <div style={{
          fontSize: 20, color: GRAY, fontFamily: 'Inter, sans-serif', marginTop: 20,
          maxWidth: 450, lineHeight: 1.6, transform: `translateX(${textX}px)`,
        }}>
          QR Code na mesa, delivery no app, totem de autoatendimento. Tudo integrado.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── SCENE 5 — CTA Final (375–450 frames = 2.5s) ─────────── */
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pulsing background
  const bgPulse = interpolate(frame, [0, 37, 75], [1, 1.1, 1], { extrapolateRight: 'clamp' });

  // Main text
  const mainScale = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 60 }, delay: 5 });

  // Button animation
  const btnOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btnY = interpolate(frame, [25, 40], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Pulse ring on button
  const ringScale = interpolate(frame % 45, [0, 44], [1, 2], { extrapolateRight: 'clamp' });
  const ringOpacity = interpolate(frame % 45, [0, 44], [0.6, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${DARK2}, ${DARK})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', width: 800, height: 800, borderRadius: '50%',
        background: `radial-gradient(circle, ${ORANGE}30, transparent 60%)`,
        filter: 'blur(120px)', transform: `scale(${bgPulse})`,
      }} />

      {/* Logo small */}
      <div style={{
        fontSize: 48, marginBottom: 20, transform: `scale(${mainScale})`,
      }}>
        🍔
      </div>

      {/* Main text */}
      <div style={{
        fontSize: 72, fontWeight: 900, fontFamily: 'Inter, sans-serif',
        background: `linear-gradient(135deg, ${WHITE}, ${ORANGE})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        textAlign: 'center', lineHeight: 1.1, transform: `scale(${mainScale})`,
        marginBottom: 16,
      }}>
        Comece agora
      </div>

      <div style={{
        fontSize: 24, color: GRAY, fontFamily: 'Inter, sans-serif', textAlign: 'center',
        transform: `scale(${mainScale})`, marginBottom: 50, maxWidth: 600,
      }}>
        Teste grátis por 7 dias. Sem cartão de crédito.
      </div>

      {/* CTA Button */}
      <div style={{ position: 'relative', opacity: btnOpacity, transform: `translateY(${btnY}px)` }}>
        {/* Pulse ring */}
        <div style={{
          position: 'absolute', inset: -10, borderRadius: 30,
          border: `2px solid ${ORANGE}`,
          transform: `scale(${ringScale})`, opacity: ringOpacity,
        }} />

        <div style={{
          background: `linear-gradient(135deg, ${ORANGE}, #FF8C38)`,
          padding: '20px 60px', borderRadius: 20,
          fontSize: 24, fontWeight: 800, color: WHITE, fontFamily: 'Inter, sans-serif',
          boxShadow: `0 20px 60px ${ORANGE}50`, letterSpacing: 1,
        }}>
          ideafood.com.br
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── MAIN COMPOSITION ─────────── */
export const IdeaFoodPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: DARK }}>
      {/* Cena 1: Splash + Logo (3s) */}
      <Sequence from={0} durationInFrames={90}>
        <SplashScene />
      </Sequence>

      {/* Cena 2: Dashboard Hero (3.5s) */}
      <Sequence from={90} durationInFrames={105}>
        <DashboardScene />
      </Sequence>

      {/* Cena 3: Features Grid (3.5s) */}
      <Sequence from={195} durationInFrames={105}>
        <FeaturesScene />
      </Sequence>

      {/* Cena 4: Mobile App (2.5s) */}
      <Sequence from={300} durationInFrames={75}>
        <MobileScene />
      </Sequence>

      {/* Cena 5: CTA Final (2.5s) */}
      <Sequence from={375} durationInFrames={75}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
