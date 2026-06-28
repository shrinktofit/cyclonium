import * as cc from 'cc';
import { getCanvas, setupGame } from '@cyclonium/cc-test/runtime';
import { expect, it } from 'vitest';

it('should use the configured canvas', async () => {
  expect(cc.game).toBeDefined();

  const canvas = getCanvas();
  expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  expectConfiguredCanvas(canvas);
  expect(document.getElementById('ConfiguredGameCanvas')).toBe(canvas);

  const gameDiv = document.getElementById('GameDiv');
  const gameContainer = document.getElementById('Cocos3dGameContainer');
  expectGameDivStyle(gameDiv, 128, 64);
  expectGameContainerStyle(gameContainer);

  const canvasSnapshot = snapshotCanvas(canvas);
  const gameDivSnapshot = snapshotElementStyle(gameDiv);
  const gameContainerSnapshot = snapshotElementStyle(gameContainer);

  await setupGame();

  expect(getCanvas()).toBe(canvas);
  expect(cc.game.canvas).toBe(canvas);
  expectCocosScreenSize({
    devicePixelRatio: 1.5,
    frameWidth: 128,
    frameHeight: 64,
    windowWidth: 192,
    windowHeight: 96,
  });
  expect(snapshotCanvas(canvas)).toEqual(canvasSnapshot);
  expect(snapshotElementStyle(gameDiv)).toEqual(gameDivSnapshot);
  expect(snapshotElementStyle(gameContainer)).toEqual(gameContainerSnapshot);
});

function expectConfiguredCanvas(element: HTMLElement | null | undefined): void {
  expect(element).toBeInstanceOf(HTMLCanvasElement);
  const canvas = element as HTMLCanvasElement;
  expect(canvas.id).toBe('ConfiguredGameCanvas');
  expect(canvas.width).toBe(192);
  expect(canvas.height).toBe(96);
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

function snapshotCanvas(element: HTMLElement | null | undefined): object {
  expect(element).toBeInstanceOf(HTMLCanvasElement);
  const canvas = element as HTMLCanvasElement;
  return {
    width: canvas.width,
    height: canvas.height,
    style: snapshotElementStyle(canvas),
  };
}

function snapshotElementStyle(element: HTMLElement | null | undefined): object {
  expect(element).toBeInstanceOf(HTMLElement);
  const style = (element as HTMLElement).style;
  return {
    margin: style.margin,
    padding: style.padding,
    border: style.border,
    outline: style.outline,
    position: style.position,
    top: style.top,
    left: style.left,
    width: style.width,
    height: style.height,
    overflow: style.overflow,
    display: style.display,
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
  };
}
