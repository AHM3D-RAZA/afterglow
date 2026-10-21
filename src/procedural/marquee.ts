import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from 'three';
import { createRng } from './random';

const WIDTH = 768;
const HEIGHT = 320;

/**
 * The cabinet's marquee: faded, dusty, unlit backlit-plastic artwork.
 * Painted with Canvas 2D; deterministic like every other procedural texture.
 */
export function createMarqueeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context for the marquee texture.');
  const rng = createRng(7007);

  // Dusk sky.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#1b1722');
  sky.addColorStop(0.6, '#3a2530');
  sky.addColorStop(1, '#57343a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The afterglow itself: a low sun bleeding warm light into the sky.
  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 1.05, 10, WIDTH / 2, HEIGHT * 1.05, HEIGHT * 1.1);
  glow.addColorStop(0, 'rgba(238,168,88,0.85)');
  glow.addColorStop(0.45, 'rgba(206,110,70,0.35)');
  glow.addColorStop(1, 'rgba(206,110,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Horizon lines.
  ctx.strokeStyle = 'rgba(20,14,18,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const y = HEIGHT * 0.72 + i * 14 * (1 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Title.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 112px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#e9b27a';
  ctx.fillText('AFTERGLOW', WIDTH / 2, HEIGHT * 0.42);
  ctx.shadowBlur = 0;
  ctx.font = '600 26px "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = 'rgba(233,178,122,0.8)';
  ctx.fillText('INSERT COIN  ·  1 OR 2 PLAYERS', WIDTH / 2, HEIGHT * 0.7);

  // Age: sun-fading veil, dust speckle, a couple of scratches and a crack.
  ctx.fillStyle = 'rgba(112,104,98,0.28)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${150 + rng() * 80},${140 + rng() * 70},${130 + rng() * 60},${rng() * 0.18})`;
    ctx.fillRect(rng() * WIDTH, rng() * HEIGHT, 1 + rng() * 2.5, 1 + rng() * 2.5);
  }
  ctx.strokeStyle = 'rgba(210,200,190,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = rng() * WIDTH;
    const y = rng() * HEIGHT;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 220, y + (rng() - 0.5) * 60);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(12,10,10,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(WIDTH * 0.78, 0);
  ctx.lineTo(WIDTH * 0.74, HEIGHT * 0.22);
  ctx.lineTo(WIDTH * 0.77, HEIGHT * 0.4);
  ctx.lineTo(WIDTH * 0.7, HEIGHT * 0.64);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}
