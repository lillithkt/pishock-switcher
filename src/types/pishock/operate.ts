import { SerialCommandEnum } from "./";

export enum SerialOperateEnum {
  SHOCK = "shock",
  VIBRATE = "vibrate",
  BEEP = "beep",
  END = "end",
}
export type SerialCommandOperate = {
  cmd: SerialCommandEnum.OPERATE;
  value: {
    id: string;
    op: SerialOperateEnum;
    duration: number;
    intensity: number;
  };
};
