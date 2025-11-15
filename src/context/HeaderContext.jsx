// src/context/HeaderContext.jsx - VERSÃO CORRIGIDA
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

    const setActions = useCallback((actions) => {
        console.log('🔄 HeaderContext: Definindo ações no header', actions);
        setHeaderActions(actions);
    }, []);

    const clearActions = useCallback(() => {
        console.log('🧹 HeaderContext: Limpando ações do header');
        setHeaderActions(null);
    }, []);

    const setTitle = useCallback((title) => {
        console.log('📝 HeaderContext: Definindo título:', title);
        setHeaderTitle(title);
    }, []);

    const setSubtitle = useCallback((subtitle) => {
        console.log('📝 HeaderContext: Definindo subtítulo:', subtitle);
        setHeaderSubtitle(subtitle);
    }, []);

    const clearAll = useCallback(() => {
        console.log('🧹 HeaderContext: Limpando tudo');
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