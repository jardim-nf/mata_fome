// src/hooks/useDialogs.js
import { useState, useCallback, useRef } from 'react';
import React from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PromptDialog from '../components/ui/PromptDialog';

/**
 * useConfirmDialog — async confirm() replacement.
 *
 * @returns {[Function, React.FC]}
 *   [0] confirm(message, opts?) → Promise<boolean>
 *   [1] <ConfirmUI /> — render this in your JSX
 */
export function useConfirmDialog() {
    const [state, setState] = useState({ open: false, message: '', title: '', variant: 'default', confirmText: 'Confirmar', cancelText: 'Cancelar' });
    const resolveRef = useRef(null);

    const confirm = useCallback((message, opts = {}) => {
        return new Promise(resolve => {
            resolveRef.current = resolve;
            setState({
                open: true,
                message,
                title: opts.title || '',
                variant: opts.variant || 'default',
                confirmText: opts.confirmText || 'Confirmar',
                cancelText: opts.cancelText || 'Cancelar',
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        resolveRef.current?.(true);
        setState(s => ({ ...s, open: false }));
    }, []);

    const handleCancel = useCallback(() => {
        resolveRef.current?.(false);
        setState(s => ({ ...s, open: false }));
    }, []);

    const ConfirmUI = useCallback(() => (
        <ConfirmDialog
            open={state.open}
            title={state.title}
            message={state.message}
            variant={state.variant}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ), [state, handleConfirm, handleCancel]);

    return [confirm, ConfirmUI];
}

/**
 * usePromptDialog — async prompt() replacement.
 *
 * @returns {[Function, React.FC]}
 *   [0] prompt(message, defaultValue?, opts?) → Promise<string|null>
 *   [1] <PromptUI /> — render this in your JSX
 */
export function usePromptDialog() {
    const [state, setState] = useState({ open: false, message: '', title: '', defaultValue: '', placeholder: '', confirmText: 'OK', cancelText: 'Cancelar' });
    const resolveRef = useRef(null);

    const prompt = useCallback((message, defaultValue = '', opts = {}) => {
        return new Promise(resolve => {
            resolveRef.current = resolve;
            setState({
                open: true,
                message,
                defaultValue,
                title: opts.title || '',
                placeholder: opts.placeholder || '',
                confirmText: opts.confirmText || 'OK',
                cancelText: opts.cancelText || 'Cancelar',
            });
        });
    }, []);

    const handleConfirm = useCallback((value) => {
        resolveRef.current?.(value);
        setState(s => ({ ...s, open: false }));
    }, []);

    const handleCancel = useCallback(() => {
        resolveRef.current?.(null);
        setState(s => ({ ...s, open: false }));
    }, []);

    const PromptUI = useCallback(() => (
        <PromptDialog
            open={state.open}
            title={state.title}
            message={state.message}
            defaultValue={state.defaultValue}
            placeholder={state.placeholder}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ), [state, handleConfirm, handleCancel]);

    return [prompt, PromptUI];
}
