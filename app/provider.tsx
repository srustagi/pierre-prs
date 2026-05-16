"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { PrThemeProvider } from "@/components/theme-provider";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <PrThemeProvider>{children}</PrThemeProvider>
    </ChakraProvider>
  );
}
