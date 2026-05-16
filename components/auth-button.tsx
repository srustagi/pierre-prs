"use client";

import { Button } from "@chakra-ui/react";
import { signIn, signOut } from "next-auth/react";

export function SignInButton() {
  return (
    <Button colorPalette="blue" onClick={() => signIn("github")}>
      Sign in with GitHub
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button variant="outline" onClick={() => signOut()}>
      Sign out
    </Button>
  );
}
