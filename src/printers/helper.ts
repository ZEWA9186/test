import { getGLN } from '../config/config.env';

export const getBoxNetto = (productNetto: string, count: number) => {
  return Number(productNetto) * count;
};

export const getNettoUnitKG = (productNetto: string) => {
  return Number(productNetto) / 1000;
};

export const getBoxNettoKG = (productNetto: string, count: number) => {
  return (Number(productNetto) * count) / 1000;
};

// ============ УТИЛИТЫ ============
const formatDate = (date: string) => {
  const [day, month, year] = date.split('.');
  return `${year.slice(2)}${month}${day}`;
};

const padEven = (value: string, isZPL: boolean) =>
  isZPL && value.length % 2 !== 0 ? `0${value}` : value;

const hasNextNonEmpty = (arr: string[], index: number) =>
  arr.slice(index + 1).some((item) => item?.trim());

// Форматирование веса (6 символов: 3 целых + 3 десятичных)
const formatWeight = (weight: number | string): string => {
  const num = typeof weight === 'string' ? parseFloat(weight) : weight;
  if (isNaN(num) || num < 0) return '000000';

  // Умножаем на 1000 для 3 десятичных знаков
  const rounded = Math.round(num * 1000);
  return String(rounded).padStart(6, '0');
};

//TODO расчёт контрольной суммы
const calculateControlSum = (tempLabel: string) => {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += Number(tempLabel[i]) * (i % 2 === 0 ? 3 : 1);
  }

  return `${tempLabel}${(10 - (sum % 10)) % 10}`;
};

export const generateLabel = (labelType: string, packageNumber: string): string => {
  const formatPackageNumber = packageNumber.padStart(7, '0');
  const tempLabel = `00${labelType}${getGLN()}${formatPackageNumber}`;
  calculateControlSum(tempLabel);

  return calculateControlSum(tempLabel);
};
