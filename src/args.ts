export interface ParsedArgs {
  jsonOutput: boolean;
  helpFlag: boolean;
  repoPath: string | null;
  url: string | null;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const jsonOutput = argv.includes('--json');
  const helpFlag = argv.includes('--help') || argv.includes('-h');

  const repoIndex = argv.indexOf('--repo');
  const repoPath = repoIndex !== -1 ? argv[repoIndex + 1] ?? null : null;

  const urlArgs = argv.filter((arg, i) =>
    !arg.startsWith('--') &&
    !arg.startsWith('-') &&
    (repoIndex === -1 || i !== repoIndex + 1)
  );

  return {
    jsonOutput,
    helpFlag,
    repoPath,
    url: urlArgs[0] ?? null,
  };
}
