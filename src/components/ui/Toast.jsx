// src/components/ui/Toast.jsx — Lightweight toast notification system
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './DialogStyles.css';

/**
 * Toast variants:
 *  success  → green  ✅
 *  error    → red    ❌
 *  warning  → amber  ⚠️
 *  info     → blue   ℹ️
 */

const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

const COLORS = {
    success: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
};

let _toastId = 0;

/** Singleton toast state used across the app */
let _listeners = [];
let _toasts = [];

function emit() { _listeners.forEach(fn => fn([..._toasts])); }

export const toast = {
    show(message, variant = 'info', duration = 3500) {
        const id = ++_toastId;
        _toasts = [..._toasts, { id, message, variant, duration }];
        emit();
        if (duration > 0) setTimeout(() => toast.dismiss(id), duration);
        return id;
    },
    success(msg, dur) { return toast.show(msg, 'success', dur); },
    error(msg, dur)   { return toast.show(msg, 'error', dur ?? 5000); },
    warning(msg, dur) { return toast.show(msg, 'warning', dur); },
    info(msg, dur)    { return toast.show(msg, 'info', dur); },
    dismiss(id) {
        _toasts = _toasts.filter(t => t.id !== id);
        emit();
    },
};

/** Renders toasts — place <ToastContainer /> once at app root or in PdvScreen */
export function ToastContainer() {
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        _listeners.push(setToasts);
        return () => { _listeners = _listeners.filter(fn => fn !== setToasts); };
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 99999,
            display: 'flex', flexDirection: 'column', gap: 8,
            pointerEvents: 'none', maxWidth: 380,
        }}>
            {toasts.map(t => (
                <div
                    key={t.id}
                    onClick={() => toast.dismiss(t.id)}
                    style={{
                        pointerEvents: 'auto', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 16px', borderRadius: 10,
                        backgroundColor: COLORS[t.variant]?.bg || COLORS.info.bg,
                        border: `1px solid ${COLORS[t.variant]?.border || COLORS.info.border}`,
                        color: COLORS[t.variant]?.text || COLORS.info.text,
                        boxShadow: '0 4px 24px rgba(0,0,0,.12)',
                        fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                        animation: 'dialogFadeIn .25s ease',
                    }}
                >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[t.variant] || ICONS.info}</span>
                    <span style={{ flex: 1 }}>{t.message}</span>
                </div>
            ))}
        </div>,
        document.body
    );
}
