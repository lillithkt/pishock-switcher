import { SerialCommandEnum } from ".";

export type SerialCommandAddNetwork = {
  cmd: SerialCommandEnum.ADDNETWORK;
  value: {
    ssid: string;
    password: string;
  };
};
