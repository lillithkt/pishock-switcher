import prompts from "prompts";
import { PromptsOptions, spinner } from "tui";

export async function getOpenShockFirmwareURL() {
  const latestVer = await fetch(
    "https://firmware.openshock.org/version-stable.txt"
  ).then((i) => i.text().then((i) => i.replace("\n", "")));
  const boards = await fetch(
    `https://firmware.openshock.org/${latestVer}/boards.txt`
  ).then((i) => i.text().then((i) => i.split("\n")));
  spinner.stop();
  const { board } = await prompts(
    {
      type: "select",
      name: "board",
      message: "Please choose your board",
      choices: boards
        .filter((i) => i.toLocaleLowerCase().includes("pishock"))
        .map((i) => ({ title: i, value: i })),
    },
    PromptsOptions
  );
  spinner.start();
  return `https://firmware.openshock.org/${latestVer}/${board}/firmware.bin`;
}
