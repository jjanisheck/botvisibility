# CI/CD integration

BotVisibility's `--json` output makes it easy to gate deployments on agent-readiness. This page collects copy-paste recipes.

## GitHub Actions

```yaml
name: BotVisibility check
on:
  pull_request:
  schedule:
    - cron: '0 6 * * *'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run scan
        run: |
          SCORE=$(npx -y botvisibility ${{ vars.PRODUCTION_URL }} --json | jq '.currentLevel')
          echo "BotVisibility score: $SCORE"
          if [ "$SCORE" -lt 2 ]; then
            echo "::error::BotVisibility score $SCORE is below required Level 2"
            exit 1
          fi
```

## GitLab CI

```yaml
botvisibility:
  image: node:20
  script:
    - SCORE=$(npx -y botvisibility "$PRODUCTION_URL" --json | jq '.currentLevel')
    - 'echo "Score: $SCORE"'
    - test "$SCORE" -ge 2
```

## CircleCI

```yaml
version: 2.1
jobs:
  botvisibility:
    docker:
      - image: cimg/node:20.0
    steps:
      - run:
          name: Scan
          command: |
            SCORE=$(npx -y botvisibility "$PRODUCTION_URL" --json | jq '.currentLevel')
            test "$SCORE" -ge 2

workflows:
  scan:
    jobs:
      - botvisibility
```

## Reading specific check results

The `--json` payload exposes the full check list, so you can surface exactly which checks regressed:

```bash
npx botvisibility example.com --json | jq '.checks[] | select(.status == "fail") | {id, name}'
```

Combine with PR comments or Slack notifications to alert on regressions per-check.

## Tips

- Pin the CLI version (`npx -y botvisibility@1.3.1 ...`) in CI to avoid surprise behavior changes.
- Use the `--repo .` flag in CI when you also want Level 4 code-level checks. Run from the repo root so the scanner can walk the source tree.
- BotVisibility makes outbound HTTP requests; in air-gapped CI runners you'll need to whitelist the target domain.
