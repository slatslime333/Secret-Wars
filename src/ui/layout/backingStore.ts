import Phaser from 'phaser';

/**
 * Canvas backing-store scale. Logical game size stays in CSS pixels so camera
 * zoom and HUD layout are unchanged; only the bitmap is sharper on HiDPI.
 *
 * Cap at 2: 3× phones still get a large upgrade over 1×, without a 9× pixel cost.
 * Prefer integers so pixel art stays on pixel boundaries.
 */
export const displayPixelRatio = (): number => {
  if (typeof window === 'undefined') {
    return 1;
  }
  const raw = window.devicePixelRatio || 1;
  if (raw >= 1.5) {
    return 2;
  }
  return 1;
};

type WebGlRenderer = Phaser.Renderer.WebGL.WebGLRenderer & {
  gl: WebGLRenderingContext;
  drawingBufferHeight: number;
  defaultScissor: number[];
  setScissor(x: number, y: number, width: number, height: number, drawingBufferHeight?: number): void;
};

const isWebGl = (
  renderer: Phaser.Renderer.WebGL.WebGLRenderer | Phaser.Renderer.Canvas.CanvasRenderer,
): renderer is WebGlRenderer => 'gl' in renderer && Boolean((renderer as WebGlRenderer).gl);

let scissorPatched = false;
let textFactoryPatched = false;

const patchScissorForDpr = (renderer: WebGlRenderer): void => {
  if (scissorPatched) {
    return;
  }
  scissorPatched = true;
  const original = renderer.setScissor.bind(renderer);
  renderer.setScissor = function patchedSetScissor(
    x: number,
    y: number,
    width: number,
    height: number,
    drawingBufferHeight?: number,
  ) {
    const dpr = displayPixelRatio();
    if (dpr <= 1) {
      return original(x, y, width, height, drawingBufferHeight);
    }
    return original(x * dpr, y * dpr, width * dpr, height * dpr, drawingBufferHeight);
  };
};

const patchTextFactory = (): void => {
  if (textFactoryPatched) {
    return;
  }
  textFactoryPatched = true;
  const factory = Phaser.GameObjects.GameObjectFactory.prototype;
  const original = factory.text;
  factory.text = function patchedText(
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text?: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const obj = original.call(this, x, y, text ?? '', style);
    const dpr = displayPixelRatio();
    if (dpr > 1 && obj.style.resolution < dpr) {
      obj.setResolution(dpr);
    }
    return obj;
  };
};

/**
 * Keep Phaser's logical size in CSS pixels, then raise the canvas backing
 * store to `displayPixelRatio()`. Must run after Scale Manager RESIZE so
 * Phaser does not clobber the buffer.
 */
export const applyBackingStore = (game: Phaser.Game): void => {
  const dpr = displayPixelRatio();
  const canvas = game.canvas;
  const cssW = Math.max(1, Math.round(game.scale.width));
  const cssH = Math.max(1, Math.round(game.scale.height));
  const bufferW = Math.round(cssW * dpr);
  const bufferH = Math.round(cssH * dpr);

  canvas.style.setProperty('width', `${cssW}px`, 'important');
  canvas.style.setProperty('height', `${cssH}px`, 'important');
  canvas.style.imageRendering = 'pixelated';

  patchTextFactory();

  const renderer = game.renderer;
  if (!renderer) {
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }
    return;
  }

  if (isWebGl(renderer)) {
    patchScissorForDpr(renderer);
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }
    renderer.width = cssW;
    renderer.height = cssH;
    renderer.setProjectionMatrix(cssW, cssH);
    const gl = renderer.gl;
    gl.viewport(0, 0, bufferW, bufferH);
    renderer.drawingBufferHeight = gl.drawingBufferHeight;
    gl.scissor(0, 0, bufferW, bufferH);
    renderer.defaultScissor[0] = 0;
    renderer.defaultScissor[1] = 0;
    renderer.defaultScissor[2] = cssW;
    renderer.defaultScissor[3] = cssH;
    return;
  }

  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  const canvasRenderer = renderer as Phaser.Renderer.Canvas.CanvasRenderer;
  canvasRenderer.width = cssW;
  canvasRenderer.height = cssH;
  canvasRenderer.gameContext.setTransform(dpr, 0, 0, dpr, 0, 0);
};

export const installBackingStore = (game: Phaser.Game): void => {
  const apply = () => applyBackingStore(game);
  game.events.once(Phaser.Core.Events.READY, apply);
  game.scale.on(Phaser.Scale.Events.RESIZE, apply);
  apply();
};
