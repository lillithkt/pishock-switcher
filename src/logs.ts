import { spinner } from "tui";

export const DEBUG = process.argv.includes("--debug");

const log = Object.fromEntries(
  ["log", "warn", "error", "debug"].map((i) => [
    i,
    (...args: unknown[]) => {
      if (i === "debug" && !DEBUG) return;
      const state = spinner.isSpinning;
      spinner.stop();
      (console[i as keyof typeof console] as typeof console.log)(...args);
      if (state) spinner.start();
    },
  ])
) as {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
};

export default log;
