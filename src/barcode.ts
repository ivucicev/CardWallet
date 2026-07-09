export type BarcodeType = 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR';

// Single source of truth for guessing a code's format from raw text.
// Used both for manual card-number entry and as a fallback when the
// scanner can't report a format itself (e.g. image upload decoding).
export function detectBarcodeType(code: string): BarcodeType {
  const clean = code.trim();
  if (!clean) return 'CODE128';

  // URL or typical long identifier implies QR Code
  if (/^(https?:\/\/|ftp:\/\/|mailto:|tel:)/i.test(clean) || (clean.length > 25 && /[/:?=&]/.test(clean))) {
    return 'QR';
  }

  // Remove spaces or dashes commonly used in card numbers
  const digitsOnly = clean.replace(/[\s-]/g, '');

  // If it is numeric only
  if (/^\d+$/.test(digitsOnly)) {
    if (digitsOnly.length === 13) return 'EAN13';
    if (digitsOnly.length === 8) return 'EAN8';
    if (digitsOnly.length === 12) return 'UPCA';
  }

  // Anything else that isn't a clean short alphanumeric code (spaces, newlines,
  // punctuation, or long free-form text) is more likely QR content than a
  // linear barcode, which only encodes a narrow character set.
  if (!/^[0-9A-Za-z-]{1,30}$/.test(clean)) {
    return 'QR';
  }

  // Default fallback for general alphanumeric barcodes
  return 'CODE128';
}
