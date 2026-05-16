"use client";

import { Box, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { createContext, useContext, useState } from "react";

type PrTheme = "dark" | "light";

type PrThemeContextValue = {
  theme: PrTheme;
  toggleTheme: () => void;
};

const PrThemeContext = createContext<PrThemeContextValue | null>(null);

export function Provider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PrTheme>("dark");

  return (
    <ChakraProvider value={defaultSystem}>
      <PrThemeContext.Provider
        value={{
          theme,
          toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
        }}
      >
        <Box data-pr-theme={theme}>{children}</Box>
      </PrThemeContext.Provider>
    </ChakraProvider>
  );
}

export function usePrTheme() {
  const value = useContext(PrThemeContext);

  if (!value) {
    throw new Error("usePrTheme must be used inside Provider");
  }

  return value;
}
