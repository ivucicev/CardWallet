import { StorePreset } from './types';

export const STORE_PRESETS: StorePreset[] = [
  {
    id: 'dm',
    name: 'DM',
    color: 'bg-pink-600 border border-pink-700/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'dm'
  },
  {
    id: 'pevex',
    name: 'PEVEX',
    color: 'bg-green-600 border border-green-700/10',
    textColor: 'text-white',
    defaultBarcodeType: 'CODE128',
    logoText: 'PVX'
  },
  {
    id: 'emmezeta',
    name: 'Emezzeta',
    color: 'bg-blue-700 border border-blue-800/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'EMZ'
  },
  {
    id: 'babycenter',
    name: 'BabyCenter',
    color: 'bg-sky-400 border border-sky-500/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'BBC'
  },
  {
    id: 'konzum',
    name: 'Konzum',
    color: 'bg-red-600 border border-red-700/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'KON'
  },
  {
    id: 'lidl',
    name: 'Lidl',
    color: 'bg-blue-600 border border-blue-700/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'LIDL'
  },
  {
    id: 'spar',
    name: 'Spar / Interspar',
    color: 'bg-emerald-700 border border-emerald-800/10',
    textColor: 'text-white',
    defaultBarcodeType: 'EAN13',
    logoText: 'SPAR'
  },
  {
    id: 'muller',
    name: 'Müller',
    color: 'bg-orange-500 border border-orange-600/10',
    textColor: 'text-white',
    defaultBarcodeType: 'CODE128',
    logoText: 'MUL'
  },
  {
    id: 'custom_indigo',
    name: 'Custom (Slate Blue)',
    color: 'bg-slate-700 border border-slate-800/10',
    textColor: 'text-white',
    defaultBarcodeType: 'CODE128',
    logoText: 'CARD'
  },
  {
    id: 'custom_violet',
    name: 'Custom (Indigo)',
    color: 'bg-indigo-600 border border-indigo-700/10',
    textColor: 'text-white',
    defaultBarcodeType: 'CODE128',
    logoText: 'CARD'
  },
  {
    id: 'custom_dark',
    name: 'Custom (Slate-900)',
    color: 'bg-slate-900 border border-slate-950/20',
    textColor: 'text-white',
    defaultBarcodeType: 'CODE128',
    logoText: 'CARD'
  }
];

export const BARCODE_TYPES = [
  { value: 'CODE128', label: 'Code 128 (Most common for alphanumeric / general cards)' },
  { value: 'EAN13', label: 'EAN-13 (13-digit retail barcode standard)' },
  { value: 'EAN8', label: 'EAN-8 (8-digit short retail barcode)' },
  { value: 'UPCA', label: 'UPC-A (12-digit standard retail barcode)' },
  { value: 'QR', label: 'QR Code (Perfect for square barcodes)' }
];
