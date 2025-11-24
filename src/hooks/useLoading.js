// src/hooks/useLoading.js
import { useState, useCallback } from 'react';

export const useLoading = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  const [error, setError] = useState(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  const setLoadingError = useCallback((errorMessage) => {
    setLoading(false);
    setError(errorMessage);
  }, []);

  const executeWithLoading = useCallback(async (asyncFunction) => {
    try {
      startLoading();
      const result = await asyncFunction();
      stopLoading();
      return result;
    } catch (error) {
      setLoadingError(error.message);
      throw error;
    }
  }, [startLoading, stopLoading, setLoadingError]);

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    executeWithLoading
  };
};

// Uso em componentes:
const MyComponent = () => {
  const { loading, error, executeWithLoading } = useLoading();

  const loadRestaurants = async () => {
    try {
      const data = await executeWithLoading(() => 
        fetchRestaurants()
      );
      // Dados carregados com sucesso
    } catch (err) {
      // Erro já tratado pelo hook
    }
  };
};