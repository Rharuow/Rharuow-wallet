"use client";

import {
  createContext,
  useContext,
  useTransition,
  type TransitionStartFunction,
} from "react";

interface FiisLoadingContextValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

const FiisLoadingContext = createContext<FiisLoadingContextValue>({
  isPending: false,
  startTransition: (fn) => fn(),
});

export function useFiisLoading() {
  return useContext(FiisLoadingContext);
}

export function FiisLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition();

  return (
    <FiisLoadingContext.Provider value={{ isPending, startTransition }}>
      {children}
    </FiisLoadingContext.Provider>
  );
}
