import { Injectable } from '@nestjs/common';

@Injectable()
export class CurrencyService {
  private readonly conversionRate = 1.6; // 1 INR = 1.6 NPR

  convertToNPR(amount: number, fromCurrency: string): number {
    if (fromCurrency === 'INR') {
      return amount * this.conversionRate;
    }
    return amount;
  }

  convertToINR(amount: number, fromCurrency: string): number {
    if (fromCurrency === 'NPR') {
      return amount / this.conversionRate;
    }
    return amount;
  }

  formatCurrency(amount: number, currency: string): string {
    const symbol = currency === 'INR' ? '₹' : 'Rs.';
    return `${symbol} ${amount.toFixed(2)}`;
  }

  getSymbol(currency: string): string {
    return currency === 'INR' ? '₹' : 'Rs.';
  }
}