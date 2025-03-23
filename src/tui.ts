import kleur, { Color } from "kleur";
import log from "logs";
import ora from "ora";
import prompts from "prompts";
import device, { BoardFirmware } from "./";

export enum State {
  FindingHub = "Finding Hub",
  DetectingFirmware = "Detecting Firmware",
  FindingESPTool = "Finding ESPTool",
  DownloadingFirmware = "Downloading Firmware",
  Processing = "Processing Firmware",
  Flashing = "Flashing",
  Saving = "Saving Data",
  Restoring = "Restoring Data",
  WaitingForRestart = "Waiting For Restart",
}

export const spinner = ora();

export const PromptsOptions = { onCancel: () => process.exit(1) };

export function setSpinnerState(state: State, suffix: string = "") {
  spinner.text = state + suffix;
  spinner.start();
}

const BoardColors: Record<BoardFirmware, Color> = {
  [BoardFirmware.PISHOCK]: kleur.yellow,
  [BoardFirmware.OPENSHOCK]: kleur.magenta,
};

export async function rootPrompt() {
  while (true) {
    spinner.stop();
    if (device.firmware) log.log("Board is running " + device.firmware);
    const { firmware } = await prompts(
      {
        type: "select",
        name: "firmware",
        message: "What would you like to flash",
        choices: Object.values(BoardFirmware).map((firm) => ({
          title: BoardColors[firm](firm),
          value: firm,
        })),
      },
      PromptsOptions
    );
    await device.flash(firmware);
    await device.detectFirmware();
  }
}
