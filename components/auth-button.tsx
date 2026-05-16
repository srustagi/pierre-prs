"use client";

import { Button } from "@chakra-ui/react";
import { signIn, signOut } from "next-auth/react";
import { FiGithub, FiLogOut } from "react-icons/fi";

export function SignInButton() {
  return (
    <Button
      bg="var(--pr-accent)"
      color="white"
      h="32px"
      px={3}
      borderWidth="0.5px"
      borderColor="var(--pr-accent-hover)"
      rounded="full"
      fontSize="13px"
      fontWeight="510"
      _hover={{ bg: "var(--pr-accent-hover)" }}
      _active={{ bg: "var(--pr-accent)" }}
      _focusVisible={{ outline: "2px solid var(--pr-accent-hover)", outlineOffset: "2px" }}
      onClick={() => signIn("github")}
    >
      <FiGithub aria-hidden="true" />
      Sign in with GitHub
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      bg="transparent"
      color="var(--pr-text-muted)"
      h="32px"
      px={3}
      borderColor="transparent"
      rounded="full"
      fontSize="13px"
      fontWeight="400"
      _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
      _focusVisible={{ outline: "2px solid var(--pr-accent-hover)", outlineOffset: "2px" }}
      onClick={() => signOut()}
    >
      <FiLogOut aria-hidden="true" />
      Sign out
    </Button>
  );
}
