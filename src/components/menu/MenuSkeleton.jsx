import React from 'react';

const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

const CardSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-100 p-3">
    <div className="flex gap-4">
      {/* Image placeholder */}
      <div className="flex-shrink-0">
        <div className="w-28 h-28 rounded-lg skeleton-shimmer" />
      </div>
      {/* Text content */}
      <div className="flex-1 flex flex-col justify-between py-1">
        <div>
          <Pulse className="h-5 w-3/4 mb-2" />
          <Pulse className="h-3 w-full mb-1" />
          <Pulse className="h-3 w-2/3" />
        </div>
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-100">
          <Pulse className="h-5 w-20" />
          <Pulse className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

export default function MenuSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gray-50" style={{ paddingBottom: '150px' }}>
      <div className="max-w-7xl mx-auto px-4 w-full">

        {/* Header skeleton */}
        <div className="py-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full skeleton-shimmer" />
          <div className="flex-1">
            <Pulse className="h-6 w-48 mb-2" />
            <Pulse className="h-4 w-32" />
          </div>
        </div>

        {/* Category pills skeleton */}
        <div className="flex gap-2 overflow-hidden py-4 mb-6">
          {[80, 64, 72, 56, 88, 60].map((w, i) => (
            <Pulse key={i} className="h-9 rounded-full flex-shrink-0" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Category title */}
        <Pulse className="h-7 w-36 mb-4" />

        {/* Product cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>

        {/* Second category */}
        <div className="mt-8">
          <Pulse className="h-7 w-28 mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
