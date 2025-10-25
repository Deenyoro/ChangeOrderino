/**
 * Signature Pad component optimized for iPad
 */

import React, { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { RotateCcw, Check } from 'lucide-react';
import { Button } from './Button';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  initialSignature?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  initialSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;

    if (!parent) return;

    // Set canvas size to match container with device pixel ratio for crisp lines
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = parent.offsetWidth * ratio;
    canvas.height = parent.offsetHeight * ratio;
    canvas.style.width = `${parent.offsetWidth}px`;
    canvas.style.height = `${parent.offsetHeight}px`;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(ratio, ratio);
    }

    // Initialize signature pad
    signaturePadRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 3,
      throttle: 0, // Disable throttling for smoother lines on iPad
      velocityFilterWeight: 0.7,
    });

    // Load initial signature if provided
    if (initialSignature) {
      signaturePadRef.current.fromDataURL(initialSignature);
      setIsEmpty(false);
    }

    // Update isEmpty state on stroke
    const handleStroke = () => {
      setIsEmpty(signaturePadRef.current?.isEmpty() ?? true);
    };

    signaturePadRef.current.addEventListener('endStroke', handleStroke);

    return () => {
      signaturePadRef.current?.off();
    };
  }, [initialSignature]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      return;
    }

    const dataUrl = signaturePadRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col">
      <div className="relative border-2 border-gray-300 rounded-lg bg-white overflow-hidden" style={{ height: '300px' }}>
        <canvas
          ref={canvasRef}
          className="touch-none"
          style={{ touchAction: 'none' }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-lg">Sign here</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClear}
          disabled={isEmpty}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
        >
          <Check className="w-4 h-4 mr-2" />
          Save Signature
        </Button>
      </div>
    </div>
  );
};

/**
 * Signature Display component
 */
interface SignatureDisplayProps {
  signature: string;
  onRemove?: () => void;
  label?: string;
}

export const SignatureDisplay: React.FC<SignatureDisplayProps> = ({
  signature,
  onRemove,
  label = 'Signature',
}) => {
  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded p-2">
        <img src={signature} alt="Signature" className="max-h-32 mx-auto" />
      </div>
    </div>
  );
};
