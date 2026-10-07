/* eslint-disable prettier/prettier */
import { Logger } from 'winston';
// import { Status } from 'src/globalTypes';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import { getTemplateDirectory } from '../path.utils';
import { exec } from 'child_process';
import { getBoxNetto, getBoxNettoKG, getNettoUnitKG, generateLabel } from './helper';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { EncodingType, LABEL_FORMATS, PrintersTypes } from './types';
dotenv.config();
const AVTO = process.env.AVTO === 'true';
const execAsync = promisify(exec);

// let globalPrinterStatus = Status.Connected;
const printer1DecodeType = process.env.PRINTER1_DECODE_TYPE || '';
const printer1EncodeType = process.env.PRINTER1_ENCODE_TYPE || '';
const printer2DecodeType = process.env.PRINTER2_DECODE_TYPE || '';
const printer2EncodeType = process.env.PRINTER2_ENCODE_TYPE || '';

export async function printLabelBox(
  boxNumber: number,
  countInBox: number,
  printer: any,
  boxTemplate: any[],
  task: any,
  logger: Logger,
  printerName: any,
) {
  const PCName = process.env.PC_NAME || '';
  console.log('===============printerName', printerName);

  if (!printer) {
    logger.warn('Принтер: Принтер не подключен');
    return;
  }
  logger.warn(`Печать этикетки для коробки ${boxNumber}`);
  if (!task.smallBoxLabel) {
    logger.warn('Принтер: Не задана этикетка коробки');
    return;
  }
  try {
    printer.clear();
    const encoding = EncodingType.WIN1251;
    const decoding = EncodingType.WIN1251;
    console.log('--------encoding,decoding ----box', encoding, decoding, printerName);
    const label = task.smallBoxLabel;
    const data = await fs.promises.readFile(`${getTemplateDirectory()}/${label}.prn`);
    const decodedData = iconv.decode(data, decoding);
    let modifiedData = decodedData;
    const taskKeys = Object.keys(task);
    taskKeys.forEach((key) => {
      const placeholder = `<${key}>`;
      const value = task[key];
      modifiedData = modifiedData.replace(new RegExp(placeholder, 'g'), value);
    });

    const gs1128 = generateLabel(boxTemplate, task, boxNumber, LABEL_FORMATS.ZPL, countInBox);
    const gs1128_dm = generateLabel(boxTemplate, task, boxNumber, LABEL_FORMATS.DM_ZPL, countInBox);
    const gs1128_dis = generateLabel(
      boxTemplate,
      task,
      boxNumber,
      LABEL_FORMATS.PEOPLE_ZPL,
      countInBox,
    );
    console.log(gs1128_dm, gs1128_dis, gs1128);

    modifiedData = modifiedData
      .replace('<nnn_package>', `${boxNumber}`)
      .replace('<nnn_pallet>', `${boxNumber}`)
      .replace('<nnn_pieces_per_package>', `${countInBox}`)
      .replace('<nnn_netto_box>', `${getBoxNetto(task.nettoUnit, countInBox)}`)
      .replace('<nnn_netto_box_kg>', `${getBoxNettoKG(task.nettoUnit, countInBox)}`)
      .replace('<nnn_netto_unit_kg>', `${getNettoUnitKG(task.nettoUnit)}`)
      .replace('<gs1128>', gs1128)
      .replace('<gs1128_dm>', gs1128_dm)
      .replace('<gs1128_dis>', gs1128_dis);
    console.log('----------=', modifiedData);

    const encodedData = iconv.encode(modifiedData, encoding);
    const newFileName = `${getTemplateDirectory()}\\${Date.now()}.prn`.replace(/\//g, '\\');

    await fs.promises.writeFile(newFileName, encodedData);
    const command = `COPY /B ${newFileName} \\\\${PCName}\\${printerName}`;
    // console.log(command);
    const { stderr } = await execAsync(command);
    if (stderr) {
      logger.error('Ошибка отправки файла на печать:', stderr);
      return;
    }
    setTimeout(async () => {
      try {
        await fs.promises.unlink(newFileName);
        logger.info('Файл успешно удален');
      } catch (unlinkErr) {
        logger.error('Ошибка удаления файла:', unlinkErr);
      }
    }, 500);
    logger.info('Принтер: Печать коробки завершена');
  } catch (err) {
    logger.error('Принтер: Ошибка печати', err);
  }
}

export async function printLabelPallet(
  palletNumber: number,
  countInPallet: number,
  printer: any,
  palletTemplate: any[],
  task: any,
  logger: Logger,
  itemsPerPallet: any,
  printerName: any,
) {
  const PCName = process.env.PC_NAME || '';
  if (!printer) {
    logger.warn('Принтер: Принтер не подключен');
    return;
  }
  console.log(task);
  if (!task.palletLabel) {
    logger.warn('Принтер: Не задана этикетка паллеты');
    return;
  }
  try {
    logger.warn(`Печать этикетки для паллеты ${palletNumber}`);
    printer.clear();
    const encoding =
      printer2EncodeType === PrintersTypes.ZPL ? EncodingType.UTF8 : EncodingType.WIN1251;
    const decoding =
      printer2DecodeType === PrintersTypes.ZPL ? EncodingType.UTF8 : EncodingType.WIN1251;
    console.log('--------encoding,decoding ----pallet', encoding, decoding, printerName);

    fs.readFile(`${getTemplateDirectory()}/${task.palletLabel}.prn`, (err, data) => {
      if (err) {
        logger.error('Ошибка чтения файла паллеты:', err);
        return;
      }
      const decodedData = iconv.decode(data, decoding);
      let modifiedData = decodedData;
      const taskKeys = Object.keys(task);
      taskKeys.forEach((key) => {
        const placeholder = `<${key}>`;
        const value = task[key];
        modifiedData = modifiedData.replace(new RegExp(placeholder, 'g'), value);
      });
      // Заменяем <nnn_items_per_pallet> на значение или пробел, если не указано
      const itemsPerPalletValue = itemsPerPallet ? `${itemsPerPallet}` : '';

      const gs1128 = generateLabel(
        palletTemplate,
        task,
        palletNumber,
        LABEL_FORMATS.ZPL,
        +itemsPerPalletValue,
        countInPallet,
      );
      const gs1128_dm = generateLabel(
        palletTemplate,
        task,
        palletNumber,
        LABEL_FORMATS.DM_ZPL,
        +itemsPerPalletValue,
        countInPallet,
      );
      const gs1128_dis = generateLabel(
        palletTemplate,
        task,
        palletNumber,
        LABEL_FORMATS.PEOPLE_ZPL,
        +itemsPerPalletValue,
        countInPallet,
      );

      modifiedData = modifiedData
        .replace('<nnn_pallet>', `${palletNumber}`)
        .replace('<nnn_items_per_pallet>', itemsPerPalletValue) // Используем подготовленное значение
        .replace('<nnn_box_per_pallet>', `${countInPallet}`)
        .replace('<gs1128>', gs1128)
        .replace('<gs1128_dm>', gs1128_dm)
        .replace('<gs1128_dis>', gs1128_dis);
      const encodedData = iconv.encode(modifiedData, encoding);
      const newFileName = `${getTemplateDirectory()}\\${Date.now()}.prn`.replace(/\//g, '\\');
      fs.writeFile(newFileName, encodedData, (writeErr) => {
        if (writeErr) {
          logger.error('Ошибка записи файла:', writeErr);
          return;
        }
        const command = `COPY /B ${newFileName} \\\\${PCName}\\${printerName}`;
        exec(command, (execErr) => {
          if (execErr) {
            logger.error('Ошибка отправки файла на печать:', execErr);
            return;
          }
          setTimeout(async () => {
            try {
              await fs.promises.unlink(newFileName);
              logger.info('Файл успешно удален');
            } catch (unlinkErr) {
              logger.error('Ошибка удаления файла:', unlinkErr);
            }
          }, 500);
          logger.info('Принтер: Печать паллеты завершена');
        });
      });
    });
  } catch (err) {
    logger.error('Принтер: Ошибка печати:', err);
  }
}
