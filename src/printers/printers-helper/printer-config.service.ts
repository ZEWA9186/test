import { Injectable, Inject } from '@nestjs/common';
import { PrinterConfigRepository } from '../printer-config.repository';
import { PrinterConfig } from '../printer-config.entity';

@Injectable()
export class PrinterConfigService {
  constructor(
    @Inject('PrinterConfigRepository')
    private readonly printerConfigRepo: PrinterConfigRepository,
  ) {}

  async findAll(): Promise<PrinterConfig[]> {
    return this.printerConfigRepo.find();
  }

  async findByName(name: string): Promise<PrinterConfig | null> {
    return this.printerConfigRepo.findOne({
      where: { name },
    });
  }

  async saveConfig(
    name: string,
    type: string,
    host: string,
    port: number,
    enabled: boolean,
  ): Promise<PrinterConfig> {
    let config = await this.printerConfigRepo.findOne({
      where: { name },
    });

    if (!config) {
      config = this.printerConfigRepo.create({
        name,
        type,
        host,
        port,
        enabled,
      });
    } else {
      config.type = type;
      config.host = host;
      config.port = port;
      config.enabled = enabled;
    }

    return this.printerConfigRepo.save(config);
  }
}
