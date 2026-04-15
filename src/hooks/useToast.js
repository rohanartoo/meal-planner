import { useState, useCallback, useEffect } from 'react';

export default function useToast(duration = 2500) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(t);
    }
  }, [toast, duration]);

  const showToast = useCallback((msg) => setToast(msg), []);

  const isError = toast
    ? /error|required|failed|already exists/i.test(toast)
    : false;

  return { toast, isError, showToast };
}
