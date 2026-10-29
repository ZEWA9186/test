import { Inject, Injectable } from '@nestjs/common';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from 'winston';

import { PrinterConnectionService } from './printer-connection.service';
import { printerLogger } from '../../logger-winston/winston.config';
import { getTemplateDirectory } from '../../config/config.paths';
import { getPcName } from '../../config/config.env';

const execAsync = promisify(exec);

@Injectable()
export class PrinterTransportService {
  constructor(
    private readonly printerConnectionService: PrinterConnectionService,
    @Inject('winston') private readonly logger: Logger = printerLogger,
  ) {}

  async sendCommands(name: string, commands: Array<string | Buffer>): Promise<void> {
    const endpoint = this.printerConnectionService.getEndpoint(name);

    if (!endpoint) {
      throw new Error(`Принтер ${name} не подключён`);
    }

    const buffers = commands.map((command) =>
      typeof command === 'string'
        ? Buffer.from(command + '\n', 'ascii')
        : Buffer.concat([command, Buffer.from('\n', 'ascii')]),
    );

    const payload = Buffer.concat(buffers);

    await new Promise<void>((resolve, reject) => {
      const client = new net.Socket();

      client.setTimeout(5000);

      client.connect(endpoint.port, endpoint.host, () => {
        client.write(payload, (error) => {
          client.destroy();

          if (error) {
            this.printerConnectionService.setConnected(name, false);
            this.logger.error(`Ошибка отправки команды для ДМ: ${error.message}`);
            reject(error);
            return;
          }

          this.printerConnectionService.setConnected(name, true);
          resolve();
        });
      });

      client.on('error', (error) => {
        client.destroy();
        this.printerConnectionService.setConnected(name, false);
        this.logger.error(`Ошибка подключения при печати ДМ: ${error.message}`);
        reject(error);
      });

      client.on('timeout', () => {
        client.destroy();
        this.printerConnectionService.setConnected(name, false);

        const error = new Error(`Таймаут при печати ДМ`);

        this.logger.error(error.message);
        reject(error);
      });
    });
  }

  async sendFile(printerName: string, data: Buffer, label: string): Promise<void> {
    const tempFile = path.join(getTemplateDirectory(), `${Date.now()}.prn`);
    const sharePath = `\\\\${getPcName()}\\${printerName}`;

    await fs.writeFile(tempFile, data);

    try {
      const { stderr } = await execAsync(`COPY /B "${tempFile}" "${sharePath}"`);

      if (stderr) {
        throw new Error(stderr);
      }

      this.logger.info(`Файл для ${label} отправлен на печать`);
    } finally {
      await fs.unlink(tempFile).catch((error) => {
        this.logger.error('Ошибка удаления файла:', error);
      });
    }
  }
}
