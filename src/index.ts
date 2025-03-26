import { randomBytes } from "crypto";
import esptool from "esptool";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { get } from "https";
import log, { DEBUG } from "logs";
import { getOpenShockFirmwareURL } from "openshock";
import { tmpdir } from "os";
import { join } from "path";
import getPiShockFirmwareUrl, { truncateBinary } from "pishock";
import prompts from "prompts";
import { SerialPort } from "serialport";
import {
  PromptsOptions,
  rootPrompt,
  setSpinnerState,
  spinner,
  State,
} from "tui";
import { iJsonConfig } from "types/openshock/jsonconfig";
import { SerialCommandEnum, SerialCommands } from "types/pishock";
import iTerminalInfo from "types/pishock/terminalinfo";
export enum BoardFirmware {
  PISHOCK = "PiShock",
  OPENSHOCK = "OpenShock",
}
process.removeAllListeners("warning"); // suppress warnings in exe
const PISHOCK_VID = "1A86";
const PISHOCK_PID = "7523";
const TERMINALINFO_REGEX = /(?<=TERMINALINFO: )\{.*ownerId":\d+\}/;
const JSONCONFIG_REGEX = /(?<=JsonConfig\|)\{.*\}\}/;

const DATA_DIR = join(
  process.env.APPDATA ||
    (process.platform == "darwin"
      ? process.env.HOME + "/Library/Preferences"
      : process.env.HOME + "/.local/share"),
  "PiShock-Switcher"
);

export class Device {
  port: SerialPort | null = null;
  firmware: BoardFirmware | null = null;

  private tryGetOpenShockJsonConfig(): Promise<iJsonConfig | null> {
    return new Promise<iJsonConfig | null>((res) => {
      let data = "";
      const interval = setInterval(() => this.sendCommand("jsonconfig"), 1000);

      const listener = (chunk: { toString(): string }) => {
        data += chunk.toString();
        if (data.includes("$SYS$|Response|JsonConfig|")) {
          const match = data.match(JSONCONFIG_REGEX);
          if (match) {
            data = "";
            clearTimeout(timeout);
            this.port?.off("data", listener);
            res(JSON.parse(match[0]));
          }
        }
      };

      const timeout = setTimeout(() => {
        this.port?.off("data", listener);
        clearInterval(interval);
        res(null);
      }, 10000);

      this.port?.on("data", listener);
    });
  }

  private tryGetPiShockTermInfo(): Promise<iTerminalInfo | null> {
    return new Promise<iTerminalInfo | null>((res) => {
      let data = "";
      const interval = setInterval(
        () =>
          this.sendCommand({
            cmd: SerialCommandEnum.INFO,
          }),
        1000
      );

      const listener = (chunk: { toString(): string }) => {
        data += chunk.toString();
        if (data.includes("TERMINALINFO")) {
          const match = data.match(TERMINALINFO_REGEX);
          if (match) {
            data = "";
            clearTimeout(timeout);
            this.port?.off("data", listener);
            res(JSON.parse(match[0]));
          }
        }
      };

      const timeout = setTimeout(() => {
        this.port?.off("data", listener);
        clearInterval(interval);
        res(null);
      }, 10000);

      this.port?.on("data", listener);
    });
  }

  private async findPort(): Promise<void> {
    // Find the port
    const ports = await SerialPort.list();
    const foundPortId = ports.find((port) => {
      return (
        port.vendorId?.toLocaleLowerCase() ===
          PISHOCK_VID.toLocaleLowerCase() &&
        port.productId?.toLocaleLowerCase() === PISHOCK_PID.toLocaleLowerCase()
      );
    });
    if (!foundPortId) {
      setTimeout(this.findPort.bind(this), 1000);
      return;
    }
    this.port = new SerialPort({
      path: foundPortId.path,
      baudRate: 115200,
    });
    this.detectFirmware();
  }
  private async tryDetectPishock(): Promise<boolean> {
    return (await this.tryGetPiShockTermInfo()) !== null;
  }
  private async tryDetectOpenShock(): Promise<boolean> {
    return (await this.tryGetOpenShockJsonConfig()) !== null;
  }

  sendCommand(command: SerialCommands | string) {
    if (typeof command === "string") return this.port!.write(command + "\n");
    if (!command.cmd) {
      throw new Error("Command must have a cmd property");
    }
    this.port!.write(JSON.stringify(command) + "\n");
  }
  async detectFirmware() {
    setSpinnerState(State.DetectingFirmware);
    if (!DEBUG)
      this.firmware = await new Promise<BoardFirmware | null>((res) => {
        let resolved = 0;
        const checkIfNone = () => {
          if (resolved === 2) {
            spinner.stop();
            log.error("Could not detect firmware!");
            res(null);
          }
        };
        this.tryDetectPishock().then((isPishock) => {
          resolved += 1;
          if (isPishock) {
            resolved = 0;
            return res(BoardFirmware.PISHOCK);
          }
          checkIfNone();
        });
        this.tryDetectOpenShock().then((isOpenShock) => {
          resolved += 1;
          if (isOpenShock) {
            resolved = 0;
            return res(BoardFirmware.OPENSHOCK);
          }
          checkIfNone();
        });
      });
    spinner.stop();
    await rootPrompt();
  }
  constructor() {
    setSpinnerState(State.FindingHub);
    this.findPort();
  }

  async flash(type: BoardFirmware) {
    esptool.init();
    spinner.stop();
    if (this.firmware) {
      const { shouldSave } = await prompts(
        {
          type: "confirm",
          name: "shouldSave",
          message: `Do you want to save your ${this.firmware} settings?`,
          initial: true,
        },
        PromptsOptions
      );
      if (shouldSave) {
        setSpinnerState(State.Saving);
        let data: any = undefined;
        switch (this.firmware) {
          case BoardFirmware.OPENSHOCK:
            data = await this.tryGetOpenShockJsonConfig();
            break;
          case BoardFirmware.PISHOCK: {
            const terminfo = await this.tryGetPiShockTermInfo();
            if (terminfo) {
              data = terminfo.networks;
            }
          }
        }
        if (!data) {
          const { shouldContinue } = await prompts(
            {
              type: "confirm",
              name: "shouldContinue",
              initial: false,
              message: `There was a problem saving your settings. Do you want to flash anyway?`,
            },
            PromptsOptions
          );
          if (!shouldContinue) return;
        }
        if (!existsSync(DATA_DIR))
          await mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(
          join(DATA_DIR, this.firmware + ".json"),
          JSON.stringify(data)
        );
        log.log("Saved your data!");
      }
    }
    setSpinnerState(State.DownloadingFirmware);
    let firmwareUrl: string | null = null;
    switch (type) {
      case BoardFirmware.OPENSHOCK:
        firmwareUrl = await getOpenShockFirmwareURL();
        break;
      case BoardFirmware.PISHOCK:
        firmwareUrl = await getPiShockFirmwareUrl();
        break;
      default: {
        spinner.stop();
        log.error(`Tried to get firmware for ${type}. How did we get here?`);
        process.exit(1);
      }
    }
    if (!firmwareUrl) {
      spinner.stop();
      log.error("Could not get firmware url!");
      process.exit(1);
    }

    log.debug("Got url " + firmwareUrl);

    const filePath = join(
      tmpdir(),
      `pishock-switcher-${type}-firmware-${randomBytes(8).toString("hex")}`
    );

    await new Promise((resolve, reject) => {
      const request = get(
        firmwareUrl,
        { headers: { Accept: "application/octet-stream" } },
        (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Download failed with status ${response.statusCode}`)
            );
            return;
          }

          const totalSize = parseInt(
            response.headers["content-length"] || "0",
            10
          );
          let downloadedSize = 0;

          const file = createWriteStream(filePath);
          response.pipe(file);

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize) {
              const percent = Math.floor((downloadedSize / totalSize) * 100);
              setSpinnerState(State.DownloadingFirmware, ` (${percent}%)`);
            }
          });

          file.on("finish", () => file.close(() => resolve(filePath)));
          file.on("error", reject);
        }
      );

      request.on("error", reject);
    });

    spinner.stop();
    log.debug(`Downloaded to ${filePath}`);

    if (BoardFirmware.PISHOCK) truncateBinary(filePath);

    setSpinnerState(State.Flashing);
    this.port?.close();
    await esptool.flash(filePath, type);
    rmSync(filePath);
    spinner.stop();
    this.port?.open();

    const savePath = join(DATA_DIR, type + ".json");
    if (existsSync(savePath)) {
      const { shouldLoadData } = await prompts(
        {
          type: "confirm",
          name: "shouldLoadData",
          message: `You have data saved for ${type}! Do you want to restore it?`,
          initial: true,
        },
        PromptsOptions
      );
      if (!shouldLoadData) return;
      setSpinnerState(State.Restoring);
      const data: iTerminalInfo["networks"] | iJsonConfig = JSON.parse(
        readFileSync(savePath).toString()
      );
      switch (type) {
        case BoardFirmware.OPENSHOCK:
          log.debug("sending jsonconfig " + JSON.stringify(data));
          this.sendCommand("jsonconfig " + JSON.stringify(data));
          break;
        case BoardFirmware.PISHOCK:
          // FIXME: waiting on pishock support on if its okay to rapid fire this or not
          for (const network of data as iTerminalInfo["networks"]) {
            this.sendCommand({
              cmd: SerialCommandEnum.ADDNETWORK,
              value: network,
            });
          }
      }
      setSpinnerState(State.WaitingForRestart);
      await new Promise((res) => setTimeout(res, 20000));
    }
  }
}
const device = new Device();
export default device;
