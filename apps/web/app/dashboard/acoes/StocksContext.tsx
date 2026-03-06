"use client";

import {
  createContext,
  useContext,
  useTransition,
  type TransitionStartFunction,
} from "react";

interface StocksLoadingContextValue {
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

const StocksLoadingContext = createContext<StocksLoadingContextValue>({
  isPending: false,
  startTransition: (fn) => fn(),
});

export function useStocksLoading() {
  return useContext(StocksLoadingContext);
}

export function StocksLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <StocksLoadingContext.Provider value={{ isPending, startTransition }}>
      {children}
    </StocksLoadingContext.Provider>
  );
}
