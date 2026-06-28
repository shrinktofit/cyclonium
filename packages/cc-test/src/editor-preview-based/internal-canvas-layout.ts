export interface CanvasSize {
  width: number;
  height: number;
}

export interface ResolvedCanvasOptions {
  id: string;
  devicePixelRatio: number;
  size: CanvasSize;
}

export function getCanvasSize(canvas: HTMLCanvasElement, configuredSize?: CanvasSize): CanvasSize {
  return {
    width: configuredSize?.width ?? canvas.width,
    height: configuredSize?.height ?? canvas.height,
  };
}

export function applyGameDivStyle(element: HTMLElement, { width, height }: CanvasSize): void {
  applyAbsoluteStyle(element, `${width}px`, `${height}px`);
  element.style.overflow = 'hidden';
  element.style.display = 'flex';
  element.style.justifyContent = 'center';
  element.style.alignItems = 'center';
}

export function applyGameContainerStyle(element: HTMLElement): void {
  applyAbsoluteStyle(element, '100%', '100%');
  element.style.overflow = 'hidden';
}

export function applyGameCanvasStyle(element: HTMLElement): void {
  applyAbsoluteStyle(element, '100%', '100%');
  element.style.display = 'block';
}

function applyAbsoluteStyle(element: HTMLElement, width: string, height: string): void {
  applyResetStyle(element);
  element.style.position = 'absolute';
  element.style.top = '0';
  element.style.left = '0';
  element.style.width = width;
  element.style.height = height;
}

function applyResetStyle(element: HTMLElement): void {
  element.style.margin = '0';
  element.style.padding = '0';
  element.style.border = '0';
  element.style.outline = '0';
}
