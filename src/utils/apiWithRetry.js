// src/utils/apiWithRetry.js
export const apiWithRetry = async (apiCall, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      console.log(`Tentativa ${attempt} falhou:`, error);
      
      if (attempt < maxRetries) {
        // Espera progressivamente mais entre tentativas
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * attempt)
        );
      }
    }
  }
  
  throw lastError;
};

// Uso:
const restaurants = await apiWithRetry(
  () => fetchRestaurants(), 
  3
);