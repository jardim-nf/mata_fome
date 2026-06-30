// src/components/home/TiltCard.jsx
import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const TiltCard = ({ children, className = '', maxRotate = 15, scale = 1.05, parallaxDepth = 20, liquidGlass = false }) => {
  const cardRef = useRef(null);

  // Motion values for pointer position (-1 to 1)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Springs for buttery smooth interpolation
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Transforms for rotation
  const rotateX = useTransform(mouseYSpring, [-1, 1], [maxRotate, -maxRotate]);
  const rotateY = useTransform(mouseXSpring, [-1, 1], [-maxRotate, maxRotate]);

  // Transform for inner parallax
  const innerX = useTransform(mouseXSpring, [-1, 1], [-parallaxDepth, parallaxDepth]);
  const innerY = useTransform(mouseYSpring, [-1, 1], [-parallaxDepth, parallaxDepth]);

  // Z-scale
  const scaleSpring = useSpring(1, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Normalized from -1 to 1
    const mouseX = (e.clientX - rect.left - width / 2) / (width / 2);
    const mouseY = (e.clientY - rect.top - height / 2) / (height / 2);

    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    scaleSpring.set(scale);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    scaleSpring.set(1);
  };

  // Apple Liquid Glass aesthetic classes
  const liquidGlassClasses = liquidGlass 
    ? "bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_25px_50px_-12px_rgba(0,0,0,0.6)] relative overflow-hidden" 
    : "";

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale: scaleSpring,
        transformStyle: 'preserve-3d',
      }}
      className={`perspective-1000 ${liquidGlassClasses} ${className}`}
    >
      {/* Glare effect for Liquid Glass */}
      {liquidGlass && (
        <motion.div 
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 bg-gradient-to-br from-white via-transparent to-transparent"
          style={{
             x: useTransform(mouseXSpring, [-1, 1], ['-20%', '20%']),
             y: useTransform(mouseYSpring, [-1, 1], ['-20%', '20%']),
          }}
        />
      )}
      {/* Container for children with Z-axis parallax */}
      <motion.div
        style={{
          x: innerX,
          y: innerY,
          translateZ: parallaxDepth,
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default TiltCard;
