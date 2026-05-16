"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Field,
  Grid,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PullRequest, Repo } from "@/lib/github";

type Props = {
  repos: Repo[];
};

export function RepoPicker({ repos }: Props) {
  const router = useRouter();
  const initialRepo = repos[0]?.fullName ?? "";
  const [selectedRepo, setSelectedRepo] = useState(initialRepo);
  const [repoQuery, setRepoQuery] = useState(initialRepo);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [mode, setMode] = useState<"recent" | "search" | "direct">("recent");
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  function chooseRepo(repo: Repo) {
    setSelectedRepo(repo.fullName);
    setRepoQuery(repo.fullName);
    setRepoPickerOpen(false);
    setPulls([]);
    setQuery("");
    setError("");
  }

  async function loadPulls(search = query) {
    if (!selected) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/repos/${selected.owner}/${selected.name}/pulls${params}`);

      if (!response.ok) {
        throw new Error("Unable to load PRs");
      }

      setPulls((await response.json()) as PullRequest[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load PRs");
    } finally {
      setLoading(false);
    }
  }

  function openPull(number: number) {
    if (!selected) {
      return;
    }

    router.push(`/r/${selected.owner}/${selected.name}/pull/${number}`);
  }

  function openPastedPull() {
    const parsed = parsePullInput(paste, selected);

    if (!parsed) {
      setError("Paste a PR URL or number.");
      return;
    }

    router.push(`/r/${parsed.owner}/${parsed.repo}/pull/${parsed.number}`);
  }

  return (
    <Card.Root aria-label="Pick a pull request" borderColor="gray.200" shadow="sm">
      <Card.Body gap={5}>
        <Stack gap={1}>
          <Heading as="h2" size="md">
            Pick a repository
          </Heading>
          <Text color="gray.600" fontSize="sm">
            Search your accessible repos, then load recent PRs, search deeply, or jump straight to one.
          </Text>
        </Stack>

        <Field.Root>
          <Field.Label>Repository</Field.Label>
          <Box position="relative">
            <Input
              id="repo"
              value={repoQuery}
              placeholder="Search repositories"
              autoComplete="off"
              onFocus={() => setRepoPickerOpen(true)}
              onBlur={() => window.setTimeout(() => setRepoPickerOpen(false), 120)}
              onChange={(event) => {
                const next = event.target.value;
                setRepoQuery(next);
                setRepoPickerOpen(true);
                if (next !== selectedRepo) {
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
                borderColor="gray.200"
                shadow="lg"
              >
                <Card.Body p={1} gap={1}>
                  {repoMatches.length > 0 ? (
                    repoMatches.map((repo) => (
                      <Button
                        key={repo.id}
                        variant="ghost"
                        justifyContent="flex-start"
                        h="auto"
                        py={2}
                        px={3}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          chooseRepo(repo);
                        }}
                      >
                        <Stack align="flex-start" gap={0} minW={0}>
                          <Text fontWeight="medium" truncate>
                            {repo.fullName}
                          </Text>
                          <Text color="gray.500" fontSize="xs">
                            {repo.private ? "Private" : "Public"}
                          </Text>
                        </Stack>
                      </Button>
                    ))
                  ) : (
                    <Text color="gray.500" fontSize="sm" px={3} py={2}>
                      No repositories found.
                    </Text>
                  )}
                </Card.Body>
              </Card.Root>
            ) : null}
          </Box>
        </Field.Root>

        <HStack bg="gray.100" p={1} rounded="lg" width="fit-content" maxW="100%" wrap="wrap">
          <Button
            size="sm"
            variant={mode === "recent" ? "solid" : "ghost"}
            colorPalette={mode === "recent" ? "blue" : "gray"}
            onClick={() => {
              setMode("recent");
              setError("");
            }}
          >
            Recent
          </Button>
          <Button
            size="sm"
            variant={mode === "search" ? "solid" : "ghost"}
            colorPalette={mode === "search" ? "blue" : "gray"}
            onClick={() => {
              setMode("search");
              setError("");
            }}
          >
            Search
          </Button>
          <Button
            size="sm"
            variant={mode === "direct" ? "solid" : "ghost"}
            colorPalette={mode === "direct" ? "blue" : "gray"}
            onClick={() => {
              setMode("direct");
              setError("");
            }}
          >
            Open URL or #
          </Button>
        </HStack>

        {mode === "recent" ? (
          <Stack gap={4}>
            <Card.Root bg="gray.50" borderColor="gray.200">
              <Card.Body
                gap={4}
                direction={{ base: "column", md: "row" }}
                alignItems={{ base: "stretch", md: "center" }}
                justifyContent="space-between"
              >
                <Stack gap={1}>
                  <Text fontWeight="semibold">Recent open PRs</Text>
                  <Text color="gray.600" fontSize="sm">
                    Pull the latest open PRs for the selected repository.
                  </Text>
                </Stack>
                <Button
                  colorPalette="blue"
                  disabled={!selected || loading}
                  loading={loading}
                  onClick={() => {
                    setQuery("");
                    loadPulls("");
                  }}
                >
                  Load recent
                </Button>
              </Card.Body>
            </Card.Root>

            <PullResults pulls={pulls} emptyText="Load recent PRs for this repository." onOpen={openPull} />
          </Stack>
        ) : mode === "search" ? (
          <Stack gap={4}>
            <Grid templateColumns={{ base: "1fr", md: "1fr auto" }} gap={3} alignItems="end">
              <Field.Root>
                <Field.Label>Search pull requests</Field.Label>
                <Input
                  id="query"
                  value={query}
                  placeholder="Title or #123"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      loadPulls(query);
                    }
                  }}
                />
              </Field.Root>
              <Button
                colorPalette="blue"
                disabled={!selected || loading || !query.trim()}
                loading={loading}
                onClick={() => loadPulls(query)}
              >
                Search PRs
              </Button>
            </Grid>

            <PullResults pulls={pulls} emptyText="Enter a title or PR number to search." onOpen={openPull} />
          </Stack>
        ) : (
          <Grid templateColumns={{ base: "1fr", md: "1fr auto" }} gap={3} alignItems="end">
            <Field.Root>
              <Field.Label>PR URL or number</Field.Label>
              <Input
                id="paste"
                value={paste}
                placeholder="https://github.com/org/repo/pull/123 or 123"
                onChange={(event) => setPaste(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    openPastedPull();
                  }
                }}
              />
            </Field.Root>
            <Button colorPalette="blue" disabled={!paste.trim()} onClick={openPastedPull}>
              Open PR
            </Button>
          </Grid>
        )}

        {error ? (
          <Text color="red.600" fontSize="sm">
            {error}
          </Text>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

function PullResults({
  pulls,
  emptyText,
  onOpen,
}: {
  pulls: PullRequest[];
  emptyText: string;
  onOpen: (number: number) => void;
}) {
  if (pulls.length === 0) {
    return (
      <Box rounded="md" borderWidth="1px" borderColor="gray.200" bg="gray.50" px={4} py={5}>
        <Text color="gray.600" fontSize="sm">
          {emptyText}
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
          h="auto"
          justifyContent="stretch"
          px={3}
          py={3}
          onClick={() => onOpen(pull.number)}
        >
          <HStack gap={3} minW={0} width="100%">
            <Badge colorPalette="blue" variant="subtle">
              #{pull.number}
            </Badge>
            <Text flex="1" minW={0} truncate fontWeight="medium" textAlign="left">
              {pull.title}
            </Text>
            <Text color="gray.500" fontSize="sm" flexShrink={0}>
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
