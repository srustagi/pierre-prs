"use client";

import { Box } from "@chakra-ui/react";
import { createContext, useContext, useState } from "react";

type PrTheme = "dark" | "light";

type PrThemeContextValue = {
  theme: PrTheme;
  toggleTheme: () => void;
};

const PrThemeContext = createContext<PrThemeContextValue | null>(null);

export function PrThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PrTheme>("dark");

  return (
    <PrThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
      }}
    >
      <Box data-pr-theme={theme}>{children}</Box>
    </PrThemeContext.Provider>
  );
}

export function usePrTheme() {
  const value = useContext(PrThemeContext);

  if (!value) {
    throw new Error("usePrTheme must be used inside PrThemeProvider");
  }

  return value;
}
