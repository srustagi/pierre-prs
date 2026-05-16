"use client";

import { Box, Container, Flex, Heading, Text, VStack } from "@chakra-ui/react";
import { SignInButton, SignOutButton } from "@/components/auth-button";
import { RepoPicker } from "@/components/repo-picker";
import type { Repo } from "@/lib/github";

type Props =
  | {
      signedIn: false;
      repos?: never;
    }
  | {
      signedIn: true;
      repos: Repo[];
    };

export function HomeContent(props: Props) {
  return (
    <Box minH="100vh" bg="gray.50" color="gray.950">
      <Container maxW="6xl" py={{ base: 8, md: 12 }}>
        <Flex
          align={{ base: "stretch", md: "flex-start" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
          gap={6}
          mb={7}
        >
          <VStack align="flex-start" gap={3} maxW="3xl">
            <Text color="blue.600" fontSize="sm" fontWeight="bold" textTransform="uppercase">
              Pierre PRs
            </Text>
            <Heading
              as="h1"
              size={{ base: "4xl", md: "6xl" }}
              lineHeight="0.95"
              letterSpacing="normal"
            >
              {props.signedIn
                ? "Open a pull request."
                : "Review GitHub pull requests without GitHub's diff UI."}
            </Heading>
            {!props.signedIn ? (
              <Text color="gray.600" fontSize="lg" lineHeight="1.6" maxW="xl">
                Sign in, pick a repo, open a PR, and keep every review action persisted
                back to GitHub.
              </Text>
            ) : null}
          </VStack>

          <Box flexShrink={0}>{props.signedIn ? <SignOutButton /> : <SignInButton />}</Box>
        </Flex>

        {props.signedIn ? <RepoPicker repos={props.repos} /> : null}
      </Container>
    </Box>
  );
}
