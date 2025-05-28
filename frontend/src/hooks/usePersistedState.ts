import { useState, useEffect } from 'react';

type SetStateAction<T> = T | ((prevState: T) => T);

export function usePersistedState<T>(key: string, initialValue: T): [T, (value: SetStateAction<T>) => void] {
  // Initialize state from localStorage or use initialValue
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }, [key, state]);

  // Wrapper function to handle both direct values and updater functions
  const setPersistedState = (value: SetStateAction<T>) => {
    setState(prevState => {
      const newState = typeof value === 'function' 
        ? (value as (prevState: T) => T)(prevState)
        : value;
      return newState;
    });
  };

  return [state, setPersistedState];
} 