// src/components/home/TiltCard.jsx
import React, { useState, useRef } from 'react';

const TiltCard = ({ children, className = '', maxRotate = 15, scale = 1.05 }) => {
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Mouse coordinates relative to card center (from -0.5 to 0.5)
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;

    // Calculate rotation: Y rotation is based on X position, X rotation is based on Y position (inverted)
    setRotateX(-mouseY * maxRotate);
    setRotateY(mouseX * maxRotate);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const cardStyle = {
    transform: isHovered
      ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
    transition: isHovered ? 'transform 0.05s linear' : 'transform 0.5s ease',
    transformStyle: 'preserve-3d',
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      className={`${className}`}
    >
      {children}
    </div>
  );
};

export default TiltCard;
