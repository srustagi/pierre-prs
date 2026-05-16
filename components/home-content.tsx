"use client";

import { Box, Button, Container, Flex, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { FiMoon, FiSun } from "react-icons/fi";
import { usePrTheme } from "@/app/provider";
import { SignInButton, SignOutButton } from "@/components/auth-button";
import { RepoPicker } from "@/components/repo-picker";
import type { RecentRepoWithPullRequests, Repo } from "@/lib/github";

type Props =
  | {
      signedIn: false;
      repos?: never;
      recentRepos?: never;
    }
  | {
      signedIn: true;
      repos: Repo[];
      recentRepos: RecentRepoWithPullRequests[];
    };

export function HomeContent(props: Props) {
  const { theme, toggleTheme } = usePrTheme();
  const lightMode = theme === "light";

  return (
    <Box minH="100vh" bg="var(--pr-bg)" color="var(--pr-text)">
      <Container maxW="6xl" py={{ base: 8, md: 12 }}>
        <Flex
          align={{ base: "stretch", md: "flex-start" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
          gap={6}
          mb={7}
        >
          <VStack align="flex-start" gap={3} maxW="3xl">
            <Text
              color="var(--pr-text-subtle)"
              fontSize="sm"
              fontWeight="510"
              textTransform="uppercase"
            >
              Pierre PRs
            </Text>
            <Heading
              as="h1"
              size={{ base: "3xl", md: "5xl" }}
              lineHeight="1"
              letterSpacing="normal"
              fontWeight="510"
            >
              {props.signedIn
                ? "Select a pull request."
                : "Review GitHub pull requests on the go or without KYSing."}
            </Heading>
            {!props.signedIn ? (
              <Text
                color="var(--pr-text-muted)"
                fontSize="md"
                lineHeight="1.7"
                maxW="xl"
              >
                Sign in, pick a repo, open a PR, and keep every review action
                persisted back to GitHub.
              </Text>
            ) : null}
          </VStack>

          <HStack
            gap={2}
            flexShrink={0}
            alignSelf={{ base: "flex-start", md: "auto" }}
          >
            <Button
              variant="outline"
              aria-pressed={lightMode}
              bg={lightMode ? "var(--pr-surface-hover)" : "var(--pr-surface)"}
              color="var(--pr-text)"
              h="32px"
              px={3}
              borderWidth="0.5px"
              borderColor={
                lightMode ? "var(--pr-border-strong)" : "var(--pr-border)"
              }
              rounded="full"
              fontSize="13px"
              fontWeight="510"
              _hover={{
                bg: "var(--pr-surface-hover)",
                borderColor: "var(--pr-border-strong)",
              }}
              onClick={toggleTheme}
            >
              {lightMode ? (
                <FiMoon aria-hidden="true" />
              ) : (
                <FiSun aria-hidden="true" />
              )}
              {lightMode ? "Dark mode" : "Light mode"}
            </Button>
            {props.signedIn ? <SignOutButton /> : <SignInButton />}
          </HStack>
        </Flex>

        {props.signedIn ? (
          <RepoPicker repos={props.repos} recentRepos={props.recentRepos} />
        ) : null}
      </Container>
    </Box>
  );
}
