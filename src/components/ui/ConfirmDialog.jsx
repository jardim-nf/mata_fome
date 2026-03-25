// src/components/ui/ConfirmDialog.jsx
import React from 'react';
import './DialogStyles.css';

/**
 * ConfirmDialog — drop-in replacement for window.confirm().
 *
 * Usage:
 *   const [confirm, ConfirmUI] = useConfirmDialog();
 *   // inside handler:
 *   if (!(await confirm("Tem certeza?"))) return;
 *   // in JSX:  <ConfirmUI />
 */
const ConfirmDialog = ({ open, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'default', onConfirm, onCancel }) => {
    if (!open) return null;
    return (
        <div className="dialog-overlay" onClick={onCancel}>
            <div className={`dialog-box dialog-${variant}`} onClick={e => e.stopPropagation()}>
                {title && <h3 className="dialog-title">{title}</h3>}
                <p className="dialog-message">{message}</p>
                <div className="dialog-actions">
                    <button className="dialog-btn dialog-btn-cancel" onClick={onCancel}>{cancelText}</button>
                    <button className="dialog-btn dialog-btn-confirm" onClick={onConfirm}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
