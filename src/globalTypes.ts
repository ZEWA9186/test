export enum EventTypes {
  CodeStatusUpdated = 'codeStatusUpdated',
  VariablesUpdated = 'variablesUpdated',
  ConnectionRestored = 'connectionRestored',
}

export enum MonitoringStatusActions {
  Left = 'left',
  Right = 'right',
  Reject = 'reject',
}

export interface IAllCounts {
  productCount: number;
  productsInCurrentBox: number;
  boxesInCurrentPallet: number;
  boxCount: number;
  palletCount: number;
  currentBoxNumber: number;
  currentPalletNumber: number;
}

export interface IMonitoringVariables {
  task: any | null;
  taskName: string;
  tableName: string;
  codeStatus: MonitoringStatusActions | null;
  boxNumber: number;
  palletNumber: number;
  limitProductInBox: number;
  limitBoxInPallet: number;
  productCount: number;
  boxCount: number;
  palletCount: number;
  currentBoxNumber: number;
  currentPalletNumber: number;
  productsInCurrentBox: number;
  boxesInCurrentPallet: number;
  isFirstBoxOdd: boolean;
  // allCodes: Set<string>; // Для быстрой проверки дубликатов
  fileNameCSV: string;
  fileNameXLS: string;
  labelBox: string;
  labelPallet: string;
  isGlobalCodes: boolean;
  isMonitoring: boolean;
  isOldSorting: boolean;
  isPaused: boolean;
  circuitResetDelayTime: number;
  konturTime: any;

  userSessions: Map<number, IUserSession>;
  activePallets: Map<number, IActivePallet>;
  StartDate: any;
  EndDate: any;
  DelayPlc: number;
}

export enum TemplateTypes {
  SmallBox,
  BigBox,
  Pallet,
}

export enum AppGatewayNames {
  PLCStatus = 'connectionPLCStatus',
  PrinterStatus = 'connectionPrinterStatus',
  CameraStatus = 'connectionCameraStatus',
  ConfigStatus = 'controllerConfigStatus',
  ConturNumber = 'conturNumber',
  ProductCount = 'productCount',
  LogData = 'logData',
  RootMessage = 'rootMessage',
  RootStatuses = 'rootStatuses',
  SendCod = 'sendCod',
  sendStatusSecondDB = 'sendStatusSecondDB',
}

export enum Status {
  Connected = 'connected',
  Disconnected = 'disconnected',
}

export enum RootStatus {
  Success = 'success',
  Error = 'error',
  Warn = 'warning',
}

export interface RootMessage {
  status: RootStatus;
  message: string;
}

export interface RootStatuses {
  isMonitoring: boolean;
  isPaused: boolean;
}

export interface IUserSession {
  userId: number;
  currentBoxNumber: number;
  currentPalletNumber: number;
  productsInBox: number;
  lastActivity: Date;
}

export interface IActivePallet {
  palletNumber: number;
  boxesCount: number;
}
