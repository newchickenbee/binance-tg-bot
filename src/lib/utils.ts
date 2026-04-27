import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

/**
 * 智能格式化多位小数（特别适合加密货币价格）
 * - 大于等于 1000 的数字保留 2 位小数
 * - 大于等于 1 的数字保留 2-4 位小数
 * - 小于 1 的极小数字保留 4 位有效数字
 */
export function formatCryptoPrice(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || numValue === 0) return '0.00';
  
  const absValue = Math.abs(numValue);
  
  if (absValue >= 1000) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }
  
  if (absValue >= 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(numValue);
  }

  if (absValue >= 0.001) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(numValue);
  }
  
  // 对于极小的数字 (例如 0.00001234)，基于有效数字保留
  return new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: 4,
  }).format(numValue);
}
