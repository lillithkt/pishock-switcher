import { readFileSync, writeFileSync } from "fs";
import prompts from "prompts";
import { PromptsOptions, setSpinnerState, spinner, State } from "tui";

export default async function getPiShockFirmwareUrl() {
  spinner.stop();
  const { next } = await prompts(
    {
      message: "Does your hub have USB-C?",
      type: "confirm",
      name: "next",
      initial: true,
    },
    PromptsOptions
  );
  spinner.start();
  // values taken from https://github.com/zerario/Python-PiShock/blob/62984dfda94a026fd0eaf58010ec7b4c5e3bddaf/src/pishock/firmwareupdate.py#L18
  return `https://do.pishock.com/api/GetLatestFirmware?type=${next ? 3 : 4}`;
}

export function truncateBinary(filePath: string): void {
  setSpinnerState(State.Processing);
  const size = 0x3ff000;
  const data = new Uint8Array(readFileSync(filePath));
  const truncated = data.slice(0, size);
  const rest = data.slice(size);

  if (new Set(rest).size > 1 || !rest.every((byte) => byte === 0xff)) {
    throw new Error(
      `Truncated part is not all 0xff:\n${Array.from(rest)
        .map((b) => b.toString(16))
        .join(" ")}`
    );
  }

  writeFileSync(filePath, truncated);
}
