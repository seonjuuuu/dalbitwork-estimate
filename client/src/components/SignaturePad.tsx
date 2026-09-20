import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataUrl: () => string;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#141414';
  }, []);

  const getPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    lastPointRef.current = getPoint(canvas, clientX, clientY);
  };

  const draw = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPointRef.current) return;
    const point = getPoint(canvas, clientX, clientY);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasDrawnRef.current,
    toDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? '',
    clear,
  }));

  return (
    <div className="space-y-2">
      <div className="relative border border-input rounded-md bg-background overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none"
          onMouseDown={(e) => startDrawing(e.clientX, e.clientY)}
          onMouseMove={(e) => draw(e.clientX, e.clientY)}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault();
            const t = e.touches[0];
            startDrawing(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const t = e.touches[0];
            draw(t.clientX, t.clientY);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopDrawing();
          }}
        />
        {!hasDrawn && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            여기에 서명해주세요
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} className="gap-1.5 text-muted-foreground">
        <Eraser className="w-3.5 h-3.5" />
        다시 서명하기
      </Button>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;
