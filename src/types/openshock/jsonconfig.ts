export type iJsonConfig = {
  rf: {
    txPin: number;
    keepAliveEnabled: boolean;
  };
  wifi: {
    accessPointSSID: string;
    hostname: string;
    credentials: string[];
  };
  captivePortal: {
    alwaysEnabled: boolean;
  };
  backend: {
    domain: string;
    authToken: string;
    lcgOverride: string;
  };
  serialInput: {
    echoEnabled: boolean;
  };
  otaUpdate: {
    isEnabled: boolean;
    cdnDomain: string;
    updateChannel: string;
    checkOnStartup: boolean;
    checkPeriodically: boolean;
    checkInterval: number;
    allowBackendManagement: boolean;
    requireManualApproval: boolean;
    updateId: number;
    updateStep: string;
  };
  estop: {
    enabled: boolean;
    gpioPin: number;
  };
};
