// src/components/ui/PromptDialog.jsx
import React, { useState, useEffect, useRef } from 'react';
import './DialogStyles.css';

/**
 * PromptDialog — drop-in replacement for window.prompt().
 *
 * Usage:
 *   const [prompt, PromptUI] = usePromptDialog();
 *   // inside handler:
 *   const value = await prompt("Digite o nome:", "valor padrão");
 *   if (value === null) return; // cancelled
 *   // in JSX:  <PromptUI />
 */
const PromptDialog = ({ open, title, message, defaultValue = '', placeholder = '', confirmText = 'OK', cancelText = 'Cancelar', onConfirm, onCancel }) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setValue(defaultValue);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open, defaultValue]);

    if (!open) return null;

    const handleSubmit = (e) => { e.preventDefault(); onConfirm(value); };

    return (
        <div className="dialog-overlay" onClick={onCancel}>
            <div className="dialog-box" onClick={e => e.stopPropagation()}>
                {title && <h3 className="dialog-title">{title}</h3>}
                <p className="dialog-message">{message}</p>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        className="dialog-input"
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={placeholder}
                    />
                    <div className="dialog-actions">
                        <button type="button" className="dialog-btn dialog-btn-cancel" onClick={onCancel}>{cancelText}</button>
                        <button type="submit" className="dialog-btn dialog-btn-confirm">{confirmText}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PromptDialog;
