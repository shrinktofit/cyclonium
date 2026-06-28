import * as cc from 'cc';
import { getCanvas, setupGame } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should apply setupGame canvas options before initializing game', async () => {
  expect(cc.game).toBeDefined();

  const canvas = getCanvas();
  expectCanvas(canvas, {
    id: 'ConfiguredGameCanvas',
    width: 192,
    height: 96,
  });
  expect(document.getElementById('ConfiguredGameCanvas')).toBe(canvas);
  expectGameDivStyle(document.getElementById('GameDiv'), 128, 64);
  expectGameContainerStyle(document.getElementById('Cocos3dGameContainer'));

  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 4,
  });

  await setupGame({
    canvas: {
      id: 'PerTestGameCanvas',
      devicePixelRatio: 2.5,
      size: {
        width: 80,
      },
    },
  });

  expect(getCanvas()).toBe(canvas);
  expect(document.getElementById('PerTestGameCanvas')).toBe(canvas);
  expect(document.getElementById('ConfiguredGameCanvas')).toBeNull();
  expect(document.getElementById('GameCanvas')).toBe(canvas);
  expect(cc.game.canvas).toBe(canvas);
  expectCanvas(canvas, {
    id: 'PerTestGameCanvas',
    width: 200,
    height: 160,
  });
  expectCocosScreenSize({
    devicePixelRatio: 2.5,
    frameWidth: 80,
    frameHeight: 64,
    windowWidth: 200,
    windowHeight: 160,
  });
  expectGameDivStyle(document.getElementById('GameDiv'), 80, 64);
  expectGameContainerStyle(document.getElementById('Cocos3dGameContainer'));
});

interface ExpectedCanvas {
  id: string;
  width: number;
  height: number;
}

function expectCanvas(element: HTMLElement | null | undefined, expected: ExpectedCanvas): void {
  expect(element).toBeInstanceOf(HTMLCanvasElement);
  const canvas = element as HTMLCanvasElement;
  expect(canvas.id).toBe(expected.id);
  expect(canvas.width).toBe(expected.width);
  expect(canvas.height).toBe(expected.height);
  expectGameCanvasStyle(canvas);
}

function expectResetStyle(element: HTMLElement | null | undefined): void {
  expect(element).toBeInstanceOf(HTMLElement);
  expect(element?.style.margin).toBe('0px');
  expect(element?.style.padding).toBe('0px');
  expect(element?.style.border).toBe('0px');
  expect(element?.style.outline).toBe('0px');
}

function expectGameDivStyle(element: HTMLElement | null | undefined, width: number, height: number): void {
  expectResetStyle(element);
  expect(element?.style.position).toBe('absolute');
  expect(element?.style.top).toBe('0px');
  expect(element?.style.left).toBe('0px');
  expect(element?.style.width).toBe(`${width}px`);
  expect(element?.style.height).toBe(`${height}px`);
  expect(element?.style.overflow).toBe('hidden');
  expect(element?.style.display).toBe('flex');
  expect(element?.style.justifyContent).toBe('center');
  expect(element?.style.alignItems).toBe('center');
}

function expectGameContainerStyle(element: HTMLElement | null | undefined): void {
  expectAbsoluteStyle(element);
  expect(element?.style.width).toBe('100%');
  expect(element?.style.height).toBe('100%');
  expect(element?.style.overflow).toBe('hidden');
}

function expectGameCanvasStyle(element: HTMLElement | null | undefined): void {
  expectAbsoluteStyle(element);
  expect(element?.style.display).toBe('block');
  expect(element?.style.width).toBe('100%');
  expect(element?.style.height).toBe('100%');
}

function expectAbsoluteStyle(element: HTMLElement | null | undefined): void {
  expectResetStyle(element);
  expect(element?.style.position).toBe('absolute');
  expect(element?.style.top).toBe('0px');
  expect(element?.style.left).toBe('0px');
}

interface ExpectedCocosScreenSize {
  devicePixelRatio: number;
  frameWidth: number;
  frameHeight: number;
  windowWidth: number;
  windowHeight: number;
}

function expectCocosScreenSize(expected: ExpectedCocosScreenSize): void {
  expect(cc.screen.devicePixelRatio).toBeCloseTo(expected.devicePixelRatio);
  expect(cc.screen.windowSize.width).toBeCloseTo(expected.windowWidth);
  expect(cc.screen.windowSize.height).toBeCloseTo(expected.windowHeight);
  expect(cc.screen.resolution.width).toBeCloseTo(expected.windowWidth);
  expect(cc.screen.resolution.height).toBeCloseTo(expected.windowHeight);
  expect(cc.view.getFrameSize().width).toBeCloseTo(expected.frameWidth);
  expect(cc.view.getFrameSize().height).toBeCloseTo(expected.frameHeight);
}
