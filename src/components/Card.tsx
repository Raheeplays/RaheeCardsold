import React from 'react';
import { motion } from 'motion/react';
import { CardData } from '../types';
import { STAT_LABELS, STAT_KEYS } from '../constants';

interface CardProps {
  card: CardData;
  isTop?: boolean;
  onStatSelect?: (stat: keyof CardData['stats']) => void;
  onNotchClick?: () => void;
  onNotchLongPress?: () => void;
  onSwipe?: (direction: 'left' | 'right') => void;
  disabled?: boolean;
  isOpponent?: boolean;
  isRevealed?: boolean;
  isSelected?: boolean;
  isAdmin?: boolean;
}

export default function Card({ 
  card, 
  isTop = false, 
  onStatSelect, 
  onNotchClick,
  onNotchLongPress,
  onSwipe,
  disabled = false,
  isOpponent = false,
  isRevealed = true,
  isSelected = false,
  isAdmin = false
}: CardProps) {
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (!onNotchLongPress) return;
    longPressTimer.current = setTimeout(() => {
      onNotchLongPress();
    }, 5000);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const [hoveredStat, setHoveredStat] = React.useState<keyof CardData['stats'] | null>(null);

  if (!isRevealed) {
    return (
      <div className="relative w-full aspect-[5.7/8.9] rounded-2xl border border-white/5 overflow-hidden flex flex-col items-center justify-center">
        {/* Minimalist hidden state */}
      </div>
    );
  }

  return (
    <motion.div 
      layout
      drag={onSwipe ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (!onSwipe) return;
        if (info.offset.x > 50) onSwipe('right');
        else if (info.offset.x < -50) onSwipe('left');
      }}
      whileDrag={{ scale: 1.05, zIndex: 50 }}
      animate={{ 
        scale: isSelected ? 1.1 : 1,
        y: isSelected ? -20 : 0,
        zIndex: isSelected ? 100 : 1
      }}
      className={`relative w-full aspect-[5.7/8.9] bg-white rounded-2xl border-4 border-white overflow-hidden shadow-2xl flex flex-col font-sans touch-none`}
    >
      {/* Background removed as requested */}

      {/* Top Left Symbol Square */}
      <div className="absolute top-4 left-4 z-20 w-12 h-14 bg-white border border-zinc-200 rounded-xl flex flex-col items-center justify-center shadow-lg">
        <span className="text-2xl leading-none text-black">{card.symbol}</span>
        <span className="text-sm font-bold text-black mt-1">A</span>
      </div>

      {/* Top Center Notch */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onNotchClick?.();
        }}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 px-6 py-1 bg-white rounded-b-xl shadow-lg border-x border-b border-zinc-200 hover:bg-zinc-50 transition-colors cursor-pointer"
      >
        <span className="text-[10px] font-black text-rahee uppercase tracking-widest whitespace-nowrap">
          Rahee Cards
        </span>
      </button>

      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center pt-16">
        {/* Circular Portrait */}
        <div className="w-40 h-40 rounded-full border-[6px] border-white overflow-hidden shadow-2xl bg-black">
          <img 
            src={card.image} 
            alt={card.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Name Bar */}
        <div className="mt-4 w-full bg-black py-2 px-4 flex justify-center">
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">
            {card.name}
          </h3>
        </div>

        {/* Stats Section */}
        <div className="w-full">
          {/* Stats Labels Bar (Blue) */}
          <div 
            className="bg-rahee grid grid-cols-5 px-2 py-1 border-y border-white/20"
            onPointerLeave={() => setHoveredStat(null)}
          >
            {STAT_KEYS.map((statKey) => (
              <span 
                key={`label-${statKey}`} 
                onPointerOver={() => !disabled && !isOpponent && setHoveredStat(statKey)}
                className={`text-lg font-black uppercase tracking-tighter text-center transition-colors duration-200
                  ${hoveredStat === statKey ? 'text-[#32befa]' : 'text-white'}
                `}
              >
                {STAT_LABELS[statKey]}
              </span>
            ))}
          </div>

          {/* Stats Values Bar (Black) */}
          <div 
            className="bg-black grid grid-cols-5 px-2 py-2"
            onPointerLeave={() => setHoveredStat(null)}
          >
            {STAT_KEYS.map((statKey) => (
              <button
                key={`value-${statKey}`}
                disabled={disabled || isOpponent}
                onPointerOver={() => !disabled && !isOpponent && setHoveredStat(statKey)}
                onClick={() => onStatSelect?.(statKey)}
                className={`text-lg font-black transition-all text-center relative py-2
                  ${!disabled && !isOpponent ? 'cursor-pointer' : ''}
                `}
              >
                <motion.span
                  animate={{ 
                    scale: hoveredStat === statKey ? 1.4 : 1,
                    y: hoveredStat === statKey ? -4 : 0,
                    color: hoveredStat === statKey ? '#32befa' : '#ffffff'
                  }}
                  className="inline-block pointer-events-none"
                >
                  {card.stats[statKey]}
                </motion.span>
              </button>
            ))}
          </div>
        </div>

        {/* Description Area */}
        <div className="flex-1 w-full bg-[#E5E5E5] p-4 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-black leading-tight text-center uppercase">
            {isOpponent && !isAdmin ? "Description hidden for opponent card" : card.details}
          </p>
          
          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-black/10 text-center">
            <span className="text-[8px] font-bold text-black/60 uppercase tracking-tighter">
              All Rights Reserved © Rahee Cards
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Overlay for whole card if needed, but we have specific stat buttons now */}
    </motion.div>
  );
}
