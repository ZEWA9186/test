import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AppGatewayNames } from './globalTypes';

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

  sendPrinterConnectionStatus(arrPrinter: any[]): void {
    // console.log('____________sendPrinterConnectionStatus', arrPrinter);
    this.server.emit(AppGatewayNames.PrinterStatus, arrPrinter);
  }
}
