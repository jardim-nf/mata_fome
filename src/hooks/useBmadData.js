import { useState, useEffect } from 'react';
import { processBmadPayment, isBmadActive } from '../utils/bmadIntegration';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook to handle BMAD payment process state and actions
 */
const useBmadData = () => {
  const { userData } = useAuth();
  const [isBmadAvailable, setIsBmadAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    // Check if BMAD integration is active
    const checkBmadIntegration = async () => {
      try {
        const active = await isBmadActive();
        setIsBmadAvailable(active);
      } catch (error) {
        console.error('Error checking BMAD integration:', error);
      }
    };

    checkBmadIntegration();
  }, [userData]);

  /**
   * Initiates a payment using BMAD
   * @param {number} amount - The amount to be paid
   * @param {string} paymentMethod - Selected payment method
   */
  const initiatePayment = async (amount, paymentMethod) => {
    setLoading(true);
    setPaymentError(null);

    try {
      await processBmadPayment(amount, paymentMethod);
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    isBmadAvailable,
    initiatePayment,
    loading,
    paymentError,
  };
};

export default useBmadData;