import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface AggregationPalletCounterEvent {
  taskId: number;
  pallet: {
    current: number;
    limit: number;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
})
export class AggregationGateway {
  @WebSocketServer()
  server: Server;

  sendPalletCounter(payload: AggregationPalletCounterEvent): void {
    this.server?.emit('aggregationPalletUpdated', payload);
  }
}
