"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Field,
  Flex,
  Grid,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiFolder,
  FiGitPullRequest,
  FiGlobe,
  FiLock,
  FiRefreshCcw,
  FiSearch,
} from "react-icons/fi";
import type { PullRequest, RecentRepoWithPullRequests, Repo } from "@/lib/github-types";

type Props = {
  repos: Repo[];
  recentRepos: RecentRepoWithPullRequests[];
};

export function RepoPicker({ repos, recentRepos }: Props) {
  const router = useRouter();
  const initialRepo = repos[0]?.fullName ?? "";
  const [selectedRepo, setSelectedRepo] = useState(initialRepo);
  const [repoQuery, setRepoQuery] = useState(initialRepo);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [pullInput, setPullInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pullRequestSequence = useRef(0);

  const selected = useMemo(
    () => repos.find((repo) => repo.fullName === selectedRepo),
    [repos, selectedRepo],
  );
  const repoMatches = useMemo(() => {
    const normalized = repoQuery.trim().toLowerCase();
    const matches = normalized
      ? repos.filter((repo) => repo.fullName.toLowerCase().includes(normalized))
      : repos;

    return matches.slice(0, 8);
  }, [repos, repoQuery]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    void loadPulls(selected, "");
  }, [selected]);

  function chooseRepo(repo: Repo) {
    pullRequestSequence.current += 1;
    setSelectedRepo(repo.fullName);
    setRepoQuery(repo.fullName);
    setRepoPickerOpen(false);
    setPulls([]);
    setPullInput("");
    setError("");
  }

  async function loadPulls(repo: Repo, search: string) {
    const requestId = pullRequestSequence.current + 1;
    pullRequestSequence.current = requestId;
    setLoading(true);
    setError("");

    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/repos/${repo.owner}/${repo.name}/pulls${params}`);

      if (!response.ok) {
        throw new Error("Unable to load PRs");
      }

      const nextPulls = (await response.json()) as PullRequest[];

      if (pullRequestSequence.current === requestId) {
        setPulls(nextPulls);
      }
    } catch (loadError) {
      if (pullRequestSequence.current === requestId) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load PRs");
      }
    } finally {
      if (pullRequestSequence.current === requestId) {
        setLoading(false);
      }
    }
  }

  function openPull(number: number) {
    if (!selected) {
      return;
    }

    router.push(`/r/${selected.owner}/${selected.name}/pull/${number}`);
  }

  function handlePullInput() {
    if (!selected && !pullInput.trim().startsWith("https://github.com/")) {
      setError("Choose a repository before searching PRs.");
      return;
    }

    const parsed = parsePullInput(pullInput, selected);

    if (parsed) {
      router.push(`/r/${parsed.owner}/${parsed.repo}/pull/${parsed.number}`);
      return;
    }

    if (!selected || !pullInput.trim()) {
      setError("Enter a PR URL, number, or title.");
      return;
    }

    void loadPulls(selected, pullInput);
  }

  return (
    <Card.Root
      aria-label="Pick a pull request"
      bg="var(--pr-bg-elevated)"
      borderWidth="0.5px"
      borderColor="var(--pr-border)"
      rounded="12px"
      shadow="none"
    >
      <Card.Body p={4} gap={4}>
        <Stack gap={1}>
          <Heading as="h2" size="sm" color="var(--pr-text)" fontWeight="510">
            Review a pull request
          </Heading>
          <Text color="var(--pr-text-muted)" fontSize="sm">
            Choose a repository, then paste a PR URL, type a PR number, or
            search by title.
          </Text>
        </Stack>

        {recentRepos.length > 0 ? (
          <Stack gap={2}>
            <HStack justify="space-between" gap={3} wrap="wrap">
              <Box>
                <Text color="var(--pr-text)" fontSize="13px" fontWeight="510">
                  Recent repositories
                </Text>
                <Text color="var(--pr-text-muted)" fontSize="sm">
                  Repositories with recently updated open PRs.
                </Text>
              </Box>
            </HStack>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={2}>
              {recentRepos.map((repo) => {
                const latestPull = repo.recentPullRequests[0];

                return (
                  <Button
                    key={repo.fullName}
                    variant="outline"
                    bg={selectedRepo === repo.fullName ? "var(--pr-accent-soft)" : "var(--pr-surface)"}
                    color="var(--pr-text)"
                    minH="54px"
                    h="auto"
                    justifyContent="stretch"
                    px={3}
                    py={2}
                    borderWidth="0.5px"
                    borderColor={selectedRepo === repo.fullName ? "rgba(94, 106, 210, 0.42)" : "var(--pr-border)"}
                    rounded="6px"
                    fontSize="13px"
                    fontWeight="510"
                    _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
                    onClick={() => chooseRepo(repo)}
                  >
                    <Stack align="stretch" gap={1} minW={0} width="100%">
                      <HStack justify="space-between" gap={2} minW={0}>
                        <HStack gap={2} minW={0}>
                          <Box as={FiFolder} aria-hidden="true" color="var(--pr-text-subtle)" flexShrink={0} />
                          <Text truncate fontWeight="510" textAlign="left">
                            {repo.fullName}
                          </Text>
                        </HStack>
                        <Badge
                          bg="var(--pr-accent-soft)"
                          color="#b8bdf8"
                          borderWidth="0.5px"
                          borderColor="rgba(94, 106, 210, 0.36)"
                          flexShrink={0}
                        >
                          {repo.openPullRequestCount} open
                        </Badge>
                      </HStack>
                      <HStack gap={1.5} minW={0} color="var(--pr-text-muted)">
                        <Box as={FiGitPullRequest} aria-hidden="true" flexShrink={0} />
                        <Text fontSize="xs" truncate textAlign="left">
                          #{latestPull.number} {latestPull.title}
                        </Text>
                      </HStack>
                    </Stack>
                  </Button>
                );
              })}
            </Grid>
          </Stack>
        ) : null}

        <Grid
          templateColumns={{ base: "1fr", lg: "1fr 1fr auto" }}
          gap={3}
          alignItems="end"
        >
          <Field.Root>
            <Field.Label>Repository</Field.Label>
            <Box position="relative">
              <Input
                id="repo"
                value={repoQuery}
                placeholder="Search repositories"
                autoComplete="off"
                bg="var(--pr-surface-subtle)"
                color="var(--pr-text)"
                h="32px"
                fontSize="13px"
                borderWidth="0.5px"
                borderColor="var(--pr-border)"
                rounded="6px"
                _placeholder={{ color: "var(--pr-text-subtle)" }}
                _hover={{ borderColor: "var(--pr-border-strong)" }}
                _focusVisible={{
                  borderColor: "var(--pr-accent)",
                  boxShadow: "0 0 0 1px var(--pr-accent)",
                }}
                onFocus={() => setRepoPickerOpen(true)}
                onBlur={() =>
                  window.setTimeout(() => setRepoPickerOpen(false), 120)
                }
                onChange={(event) => {
                  const next = event.target.value;
                  setRepoQuery(next);
                  setRepoPickerOpen(true);
                  if (next !== selectedRepo) {
                    pullRequestSequence.current += 1;
                    setSelectedRepo("");
                    setPulls([]);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && repoMatches[0]) {
                    chooseRepo(repoMatches[0]);
                  }
                }}
              />
              {repoPickerOpen ? (
                <Card.Root
                  position="absolute"
                  zIndex="dropdown"
                  top="calc(100% + 6px)"
                  left="0"
                  right="0"
                  maxH="280px"
                  overflow="auto"
                  bg="var(--pr-surface)"
                  borderWidth="0.5px"
                  borderColor="var(--pr-border)"
                  rounded="8px"
                  shadow="0 12px 32px rgba(0, 0, 0, 0.38)"
                >
                  <Card.Body p={1} gap={1}>
                    {repoMatches.length > 0 ? (
                      repoMatches.map((repo) => (
                        <Button
                          key={repo.id}
                          variant="ghost"
                          color="var(--pr-text)"
                          justifyContent="flex-start"
                          h="32px"
                          py={0}
                          px={2}
                          rounded="6px"
                          fontSize="13px"
                          fontWeight="510"
                          _hover={{ bg: "var(--pr-surface-hover)" }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            chooseRepo(repo);
                          }}
                        >
                          <HStack gap={2} minW={0}>
                            {repo.private ? (
                              <FiLock aria-hidden="true" />
                            ) : (
                              <FiGlobe aria-hidden="true" />
                            )}
                            <Stack align="flex-start" gap={0} minW={0}>
                              <Text fontWeight="510" truncate>
                                {repo.fullName}
                              </Text>
                              <Text color="var(--pr-text-subtle)" fontSize="xs">
                                {repo.private ? "Private" : "Public"}
                              </Text>
                            </Stack>
                          </HStack>
                        </Button>
                      ))
                    ) : (
                      <Text color="var(--pr-text-subtle)" fontSize="sm" px={3} py={2}>
                        No repositories found.
                      </Text>
                    )}
                  </Card.Body>
                </Card.Root>
              ) : null}
            </Box>
          </Field.Root>

          <Field.Root>
            <Field.Label>PR URL, number, or title</Field.Label>
            <Input
              id="pull"
              value={pullInput}
              placeholder="https://github.com/org/repo/pull/123, 123, or title"
                bg="var(--pr-surface-subtle)"
                color="var(--pr-text)"
                h="32px"
                fontSize="13px"
                borderWidth="0.5px"
                borderColor="var(--pr-border)"
                rounded="6px"
              _placeholder={{ color: "var(--pr-text-subtle)" }}
              _hover={{ borderColor: "var(--pr-border-strong)" }}
              _focusVisible={{
                borderColor: "var(--pr-accent)",
                boxShadow: "0 0 0 1px var(--pr-accent)",
              }}
              onChange={(event) => setPullInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handlePullInput();
                }
              }}
            />
          </Field.Root>

          <Button
            bg="var(--pr-accent)"
            color="white"
            h="32px"
            px={3}
            borderWidth="0.5px"
            borderColor="var(--pr-accent-hover)"
            rounded="6px"
            fontSize="13px"
            fontWeight="510"
            disabled={loading || !pullInput.trim()}
            loading={loading}
            _hover={{ bg: "var(--pr-accent-hover)" }}
            _disabled={{ opacity: 0.48, cursor: "not-allowed" }}
            onClick={handlePullInput}
          >
            <FiSearch aria-hidden="true" />
            Open or search
          </Button>
        </Grid>

        {error ? (
          <Text color="var(--pr-red)" fontSize="sm">
            {error}
          </Text>
        ) : null}

        <Stack gap={3}>
          <Flex align="center" justify="space-between" gap={3} wrap="wrap">
            <Box>
              <Text color="var(--pr-text)" fontSize="13px" fontWeight="510">
                Open PRs
              </Text>
              <Text color="var(--pr-text-muted)" fontSize="sm">
                Recent PRs load automatically when the repository changes.
              </Text>
            </Box>
            <Button
              size="sm"
              variant="outline"
              bg="var(--pr-surface)"
              color="var(--pr-text)"
              h="28px"
              px={2}
              borderWidth="0.5px"
              borderColor="var(--pr-border)"
              rounded="6px"
              fontSize="13px"
              fontWeight="510"
              disabled={!selected || loading}
              loading={loading}
              _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
              _disabled={{ opacity: 0.48, cursor: "not-allowed" }}
              onClick={() => selected && loadPulls(selected, "")}
            >
              <FiRefreshCcw aria-hidden="true" />
              Refresh recent
            </Button>
          </Flex>
          <PullResults
            pulls={pulls}
            loading={loading}
            emptyText="No open PRs found for this repository."
            onOpen={openPull}
          />
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

function PullResults({
  pulls,
  loading,
  emptyText,
  onOpen,
}: {
  pulls: PullRequest[];
  loading: boolean;
  emptyText: string;
  onOpen: (number: number) => void;
}) {
  if (pulls.length === 0) {
    return (
      <Box rounded="8px" borderWidth="0.5px" borderColor="var(--pr-border)" bg="var(--pr-surface-subtle)" px={3} py={4}>
        <Text color="var(--pr-text-muted)" fontSize="sm">
          {loading ? "Loading PRs..." : emptyText}
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap={2}>
      {pulls.map((pull) => (
        <Button
          key={pull.number}
          variant="outline"
          bg="var(--pr-surface)"
          color="var(--pr-text)"
          minH="36px"
          borderWidth="0.5px"
          borderColor="var(--pr-border)"
          rounded="6px"
          h="auto"
          justifyContent="stretch"
          px={2}
          py={2}
          fontSize="13px"
          fontWeight="510"
          _hover={{ bg: "var(--pr-surface-hover)", borderColor: "var(--pr-border-strong)" }}
          onClick={() => onOpen(pull.number)}
        >
          <HStack gap={3} minW={0} width="100%">
            <Box as={FiGitPullRequest} aria-hidden="true" color="var(--pr-text-subtle)" flexShrink={0} />
            <Badge
              bg={pull.draft ? "var(--pr-yellow-soft)" : "var(--pr-accent-soft)"}
              color={pull.draft ? "var(--pr-yellow)" : "#b8bdf8"}
              borderWidth="0.5px"
              borderColor={pull.draft ? "rgba(214, 169, 74, 0.32)" : "rgba(94, 106, 210, 0.36)"}
            >
              #{pull.number}
            </Badge>
            <Text flex="1" minW={0} truncate fontWeight="510" textAlign="left">
              {pull.title}
            </Text>
            <Text color="var(--pr-text-subtle)" fontSize="sm" flexShrink={0}>
              {pull.author ?? "unknown"}
            </Text>
          </HStack>
        </Button>
      ))}
    </Stack>
  );
}

function parsePullInput(input: string, selected?: Repo) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed) && selected) {
    return {
      owner: selected.owner,
      repo: selected.name,
      number: Number(trimmed),
    };
  }

  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(trimmed);

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    number: Number(match[3]),
  };
}
