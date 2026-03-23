import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaCalendarAlt, FaTimes, FaChevronDown } from 'react-icons/fa';

const PRESETS = [
  { label: 'Hoje', key: 'today' },
  { label: '7 dias', key: '7d' },
  { label: '15 dias', key: '15d' },
  { label: '30 dias', key: '30d' },
  { label: 'Este mês', key: 'month' },
  { label: 'Personalizado', key: 'custom' },
];

const getPresetRange = (key) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (key) {
    case 'today':
      return { start: startOfToday, end: endOfToday };
    case '7d':
      return { start: new Date(startOfToday.getTime() - 6 * 86400000), end: endOfToday };
    case '15d':
      return { start: new Date(startOfToday.getTime() - 14 * 86400000), end: endOfToday };
    case '30d':
      return { start: new Date(startOfToday.getTime() - 29 * 86400000), end: endOfToday };
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { start: firstDay, end: endOfToday };
    }
    default:
      return null;
  }
};

const formatInputDate = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date) => {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
};

/**
 * DateRangeFilter — reusable date-range picker with preset buttons.
 *
 * Props:
 *   activePreset   – 'today' | '7d' | '15d' | '30d' | 'month' | 'custom' | null
 *   dateRange      – { start: Date|null, end: Date|null }
 *   onPresetChange – (presetKey: string) => void
 *   onRangeChange  – ({ start: Date, end: Date }) => void
 *   onClear        – () => void
 */
export default function DateRangeFilter({
  activePreset,
  dateRange,
  onPresetChange,
  onRangeChange,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePreset = useCallback(
    (key) => {
      if (key === 'custom') {
        onPresetChange('custom');
        return;
      }
      const range = getPresetRange(key);
      if (range) {
        onPresetChange(key);
        onRangeChange(range);
        setOpen(false);
      }
    },
    [onPresetChange, onRangeChange]
  );

  const handleCustomStart = useCallback(
    (e) => {
      const val = e.target.value;
      if (!val) return;
      const d = new Date(val + 'T00:00:00');
      onRangeChange({ start: d, end: dateRange?.end || new Date() });
    },
    [dateRange, onRangeChange]
  );

  const handleCustomEnd = useCallback(
    (e) => {
      const val = e.target.value;
      if (!val) return;
      const d = new Date(val + 'T23:59:59.999');
      onRangeChange({ start: dateRange?.start || new Date(), end: d });
    },
    [dateRange, onRangeChange]
  );

  const handleClear = useCallback(() => {
    onClear();
    setOpen(false);
  }, [onClear]);

  // Label for the trigger button
  const label = (() => {
    if (!activePreset) return 'Filtrar por data';
    const found = PRESETS.find((p) => p.key === activePreset);
    if (activePreset === 'custom' && dateRange?.start && dateRange?.end) {
      return `${formatDisplayDate(dateRange.start)} – ${formatDisplayDate(dateRange.end)}`;
    }
    return found ? found.label : 'Filtrar por data';
  })();

  const isActive = !!activePreset;

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[11px] font-bold border
          transition-all duration-200 cursor-pointer select-none whitespace-nowrap
          ${
            isActive
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700 shadow-sm shadow-yellow-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-yellow-300 hover:text-yellow-600'
          }
        `}
      >
        <FaCalendarAlt className={isActive ? 'text-yellow-500' : 'text-slate-400'} />
        <span>{label}</span>
        <FaChevronDown
          className={`text-[8px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        {isActive && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-0.5 w-4 h-4 rounded-full bg-yellow-200/60 flex items-center justify-center hover:bg-red-200 hover:text-red-600 transition-colors"
          >
            <FaTimes className="text-[7px]" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl shadow-slate-200/60
            border border-slate-100 p-4 w-[310px]
            animate-in fade-in slide-in-from-top-1 duration-200
          "
          style={{ animation: 'fadeSlideIn .18s ease-out' }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            Período
          </p>

          {/* Preset pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PRESETS.filter((p) => p.key !== 'custom').map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key)}
                className={`
                  px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all duration-150
                  ${
                    activePreset === p.key
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-transparent shadow-md shadow-yellow-300/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-yellow-300 hover:text-yellow-600'
                  }
                `}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Datas personalizadas
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold mb-0.5 block">De</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all"
                  value={activePreset === 'custom' ? formatInputDate(dateRange?.start) : ''}
                  onChange={(e) => {
                    handlePreset('custom');
                    handleCustomStart(e);
                  }}
                  max={formatInputDate(new Date())}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold mb-0.5 block">Até</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all"
                  value={activePreset === 'custom' ? formatInputDate(dateRange?.end) : ''}
                  onChange={(e) => {
                    handlePreset('custom');
                    handleCustomEnd(e);
                  }}
                  max={formatInputDate(new Date())}
                />
              </div>
            </div>
          </div>

          {/* Clear button */}
          {isActive && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-3 w-full py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all"
            >
              Limpar filtro de data
            </button>
          )}
        </div>
      )}

      {/* Keyframe for dropdown animation (inline CSS) */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export { getPresetRange };
