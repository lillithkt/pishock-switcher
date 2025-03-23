import { SerialCommandEnum } from ".";

export type SerialCommandNoValues = {
  cmd: SerialCommandEnum.INFO | SerialCommandEnum.RESTART;
};
