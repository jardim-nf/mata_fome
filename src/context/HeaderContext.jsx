// src/context/HeaderContext.jsx - VERSÃO DEFINITIVA (SEM LOOP)
import React, { createContext, useContext, useState, useCallback } from 'react';

const HeaderContext = createContext();

export const useHeader = () => {
    const context = useContext(HeaderContext);
    if (!context) {
        throw new Error('useHeader must be used within a HeaderProvider');
    }
    return context;
};

export const HeaderProvider = ({ children }) => {
    const [headerActions, setHeaderActions] = useState(null);
    const [headerTitle, setHeaderTitle] = useState(null);
    const [headerSubtitle, setHeaderSubtitle] = useState(null);

    // ✅ CORREÇÃO DO LOOP: Só atualiza o estado se o valor for realmente diferente.
    // Isso impede que componentes como ControleSalao fiquem recarregando infinitamente.
    
    const setActions = useCallback((actions) => {
        setHeaderActions(prev => {
            if (prev === actions) return prev; // Se for igual, não faz nada
            return actions;
        });
    }, []);

    const clearActions = useCallback(() => {
        setHeaderActions(prev => (prev === null ? prev : null));
    }, []);

    const setTitle = useCallback((title) => {
        setHeaderTitle(prev => (prev === title ? prev : title));
    }, []);

    const setSubtitle = useCallback((subtitle) => {
        setHeaderSubtitle(prev => (prev === subtitle ? prev : subtitle));
    }, []);

    const clearAll = useCallback(() => {
        // Limpa tudo de uma vez sem causar múltiplos renders desnecessários
        setHeaderActions(null);
        setHeaderTitle(null);
        setHeaderSubtitle(null);
    }, []);

    return (
        <HeaderContext.Provider value={{ 
            headerActions, 
            headerTitle,
            headerSubtitle,
            setActions, 
            clearActions,
            setTitle,
            setSubtitle,
            clearAll
        }}>
            {children}
        </HeaderContext.Provider>
    );
};