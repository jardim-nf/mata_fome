// components/LazyCardapioItem.jsx
import React, { useState, useRef, useEffect } from 'react';

const LazyCardapioItem = ({ item, onAddItem, coresEstabelecimento }) => {
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={itemRef} className="transition-opacity duration-300">
      {isVisible ? (
        <CardapioItem 
          item={item} 
          onAddItem={onAddItem}
          coresEstabelecimento={coresEstabelecimento}
        />
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 h-32 animate-pulse">
          {/* Skeleton loading */}
        </div>
      )}
    </div>
  );
};