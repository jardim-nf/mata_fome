// src/hocs/withStandardHeader.jsx
import React, { useEffect } from 'react';
import { useHeader } from '../context/HeaderContext';

const withStandardHeader = (WrappedComponent, options = {}) => {
  return (props) => {
    const { 
      setActions, 
      clearActions, 
      setTitle, 
      setSubtitle,
      clearAll 
    } = useHeader();

    useEffect(() => {
      // Configurar título e subtítulo se fornecidos
      if (options.title) {
        setTitle(options.title);
      }
      if (options.subtitle) {
        setSubtitle(options.subtitle);
      }

      // Limpar ao desmontar
      return () => {
        clearAll();
      };
    }, [setTitle, setSubtitle, clearAll, options.title, options.subtitle]);

    return <WrappedComponent {...props} />;
  };
};

export default withStandardHeader;