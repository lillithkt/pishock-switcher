import { execSync, spawn } from "child_process";
import { existsSync } from "fs";
import device, { BoardFirmware } from "index";
import log, { DEBUG } from "logs";
import { platform } from "os";
import { delimiter } from "path";
import { setSpinnerState, spinner, State } from "tui";

export class ESPTool {
  private static instance: ESPTool;
  private esptoolPath: string | null = null;
  private initialized = false;

  constructor() {}

  public static getInstance(): ESPTool {
    if (!this.instance) {
      this.instance = new ESPTool();
    }
    return this.instance;
  }

  public init(): void {
    if (this.initialized) return;

    setSpinnerState(State.FindingESPTool);

    this.esptoolPath = this.findESPToolPath();
    if (!this.esptoolPath) {
      spinner.stop();
      log.error("ESPTool is required to flash firmware! Please install it!");
      process.exit(1);
    }

    this.initialized = true;
  }

  private findESPToolPath(): string | null {
    try {
      // Try finding esptool.py using system command
      for (const extension of ["", ".exe", ".py"]) {
        const globalPath = execSync(
          platform() === "win32"
            ? `where esptool${extension}`
            : `which esptool${extension}`,
          { stdio: "pipe" }
        )
          .toString()
          .trim();
        if (globalPath && existsSync(globalPath)) return globalPath;
      }
    } catch {
      // empty
    }

    // Search manually in system PATH directories
    const pathDirs = process.env.PATH?.split(delimiter) || [];
    for (const dir of pathDirs) {
      const fullPath = `${dir}/esptool.py`;
      if (existsSync(fullPath)) return fullPath;
    }

    return null;
  }

  public getPath(): string {
    if (!this.initialized) {
      throw new Error("ESPTool is not initialized.");
    }
    return this.esptoolPath!;
  }
  public async flash(filePath: string, type: BoardFirmware): Promise<void> {
    if (!this.initialized || !this.esptoolPath || !device.port?.path) {
      throw new Error("ESPTool is not initialized or port is not set.");
    }

    return new Promise((resolve, reject) => {
      const args = ["--port", device.port!.path, "write_flash"];
      switch (type) {
        case BoardFirmware.PISHOCK:
          for (const i of ["--flash_freq", "40m", "-z", "0x1000"]) {
            args.push(i);
          }
          break;
        case BoardFirmware.OPENSHOCK:
          args.push("0x0");
      }
      args.push(filePath);

      if (DEBUG) log.log("Executing:", this.esptoolPath, ...args);

      const childProcess = spawn(this.esptoolPath!, args, {
        stdio: ["inherit", "pipe", "pipe"],
      });

      childProcess.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (DEBUG) log.log(output);

        // Extract progress percentage
        const match = output.match(/Writing at 0x[0-9a-f]+\.{3} \((\d+) %\)/);
        if (match) {
          setSpinnerState(State.Flashing, ` (${match[1]}%)`);
        }
      });

      childProcess.stderr.on("data", (data) => {
        log.error(data.toString().trim());
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          spinner.stop();
          resolve();
        } else {
          reject(new Error(`ESPTool exited with code ${code}`));
        }
      });
    });
  }
}

export default new ESPTool();
