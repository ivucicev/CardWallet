export interface Card {
  id: string;
  name: string;
  store: string;
  cardNumber: string;
  barcodeType: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR';
  color: string; // Color preset ID or hex gradient string (e.g. "from-blue-600 to-indigo-700")
  notes?: string;
  isCoupon: boolean;
  expiryDate?: string;
  createdAt?: string;
}

export interface StorePreset {
  id: string;
  name: string;
  color: string; // Tailwind class combination, e.g. "bg-gradient-to-br from-blue-700 to-blue-900"
  textColor: string; // e.g. "text-white"
  defaultBarcodeType: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR';
  logoText: string;
}
