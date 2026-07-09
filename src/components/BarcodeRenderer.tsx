import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface BarcodeRendererProps {
  value: string;
  type: 'CODE128' | 'EAN13' | 'EAN8' | 'UPCA' | 'QR';
}

export function BarcodeRenderer({ value, type }: BarcodeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedType, setRenderedType] = useState<string>(type);

  useEffect(() => {
    setError(null);
    if (!value) return;

    let targetType = type;
    setRenderedType(type);

    if (type === 'QR') {
      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          value,
          {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          },
          (err) => {
            if (err) {
              console.error('QR rendering error:', err);
              setError('Invalid QR code value');
            }
          }
        );
      }
    } else {
      if (svgRef.current) {
        try {
          // Try to render with the selected format
          JsBarcode(svgRef.current, value, {
            format: targetType,
            width: 2.2,
            height: 90,
            displayValue: true,
            fontSize: 14,
            textMargin: 6,
            font: 'monospace',
            margin: 10,
            background: '#ffffff',
            lineColor: '#000000'
          });
        } catch (err: any) {
          console.warn(`Format ${type} failed for "${value}". Falling back to CODE128...`, err);
          // If EAN/UPC fails (e.g. because of non-digits or wrong length), fall back to Code 128
          if (type !== 'CODE128') {
            try {
              JsBarcode(svgRef.current, value, {
                format: 'CODE128',
                width: 1.8,
                height: 90,
                displayValue: true,
                fontSize: 14,
                textMargin: 6,
                font: 'monospace',
                margin: 10,
                background: '#ffffff',
                lineColor: '#000000'
              });
              setRenderedType('CODE128 (Auto-Fallback)');
            } catch (fallbackErr: any) {
              console.error('Fallback rendering also failed:', fallbackErr);
              setError('Invalid character sequence for barcode');
            }
          } else {
            setError('Could not generate barcode');
          }
        }
      }
    }
  }, [value, type]);

  if (type === 'QR') {
    return (
      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-neutral-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
        <div className="bg-white p-1 rounded-lg">
          <canvas ref={canvasRef} className="mx-auto" />
        </div>
        {error && (
          <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-neutral-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] overflow-hidden w-full">
      {error ? (
        <div className="py-8 px-4 text-center">
          <p className="text-red-500 text-sm font-semibold">{error}</p>
          <p className="text-neutral-400 text-xs mt-1">Please ensure the code format is correct for retail scanners.</p>
        </div>
      ) : (
        <div className="w-full flex justify-center">
          <svg ref={svgRef} className="max-w-full h-auto" />
        </div>
      )}
      {!error && renderedType !== type && (
        <span className="mt-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
          Format adjusted to {renderedType} for rendering compatibility
        </span>
      )}
    </div>
  );
}
