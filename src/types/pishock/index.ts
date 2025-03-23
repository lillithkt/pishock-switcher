import { SerialCommandAddNetwork } from "./addnetwork";
import { SerialCommandOperate } from "./operate";
import { SerialCommandNoValues } from "./others";
export enum SerialCommandEnum {
  INFO = "info",
  OPERATE = "operate",
  ADDNETWORK = "addnetwork",
  RESTART = "restart",
}

export interface LooseSerialCommand {
  cmd: SerialCommandEnum;
  value?: any;
}

export type SerialCommands =
  | SerialCommandOperate
  | SerialCommandNoValues
  | SerialCommandAddNetwork;
