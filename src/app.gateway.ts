import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AppGatewayNames, RootMessage, RootStatuses } from './globalTypes';

@WebSocketGateway({
  cors: {
    origin: '*', // Разрешить доступ с любого источника
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
})
export class AppGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit() {}

  sendModbusConnectionStatus(status: string): void {
    this.server.emit(AppGatewayNames.PLCStatus, status);
  }

  sendPrinterConnectionStatus(arrPrinter: any[]): void {
    // console.log('____________sendPrinterConnectionStatus', arrPrinter);
    this.server.emit(AppGatewayNames.PrinterStatus, arrPrinter);
  }

  sendCameraConnectionStatus(status: string): void {
    // console.log('____________sendCameraConnectionStatus', status);
    this.server.emit(AppGatewayNames.CameraStatus, status);
  }

  sendControllerConfigStatus(status: string): void {
    this.server.emit(AppGatewayNames.ConfigStatus, status);
  }

  sendConturNumber(number: number): void {
    this.server.emit(AppGatewayNames.ConturNumber, number);
  }

  sendProductCount(productCount: any): void {
    this.server.emit(AppGatewayNames.ProductCount, productCount);
  }

  sendLogData(logData: any): void {
    this.server.emit(AppGatewayNames.LogData, logData);
  }

  sendRootMessage(RootMessage: RootMessage): void {
    this.server.emit(AppGatewayNames.RootMessage, RootMessage);
  }

  sendRootStatuses(RootStatuses: RootStatuses): void {
    this.server.emit(AppGatewayNames.RootStatuses, RootStatuses);
  }

  sendCod(cod: string, inputID: string): void {
    this.server.emit(AppGatewayNames.SendCod, { cod, inputID });
  }

  sendStatusSecondDB(massege: string): any {
    console.log({ massege }, '[[[[]]][asfasf');
    this.server.emit(AppGatewayNames.sendStatusSecondDB, { massege });
  }
}
