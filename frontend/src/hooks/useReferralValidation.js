import { useState } from 'react';
import { referralService } from '@/lib/api';

export const useReferralValidation = () => {
  const [validation, setValidation] = useState({
    isValidating: false,
    isValid: null,
    message: ''
  });

  const validateCode = async (code) => {
    if (!code || code.trim() === '') {
      setValidation({ isValidating: false, isValid: null, message: '' });
      return;
    }

    setValidation(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await referralService.validateCode(code);
      if (result.success) {
        setValidation({
          isValidating: false,
          isValid: true,
          message: `✅ Código válido. Referido por: ${result.referrerName}`
        });
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          message: '❌ Código no válido'
        });
      }
    } catch (error) {
      setValidation({
        isValidating: false,
        isValid: false,
        message: '❌ Error al validar código'
      });
    }
  };

  const resetValidation = () => {
    setValidation({ isValidating: false, isValid: null, message: '' });
  };

  return { validation, validateCode, resetValidation };
};
