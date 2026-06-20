import { CANVAS_W, CANVAS_H, CHAR_DEFS } from './constants.js';
import { Game } from './game.js';
 
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// =========================
// BGM
// =========================
export const selectBGM = new Audio('./assets/select_bgm.mp3');
export const battleBGM = new Audio('./assets/battle_bgm.mp3');

selectBGM.loop = true;
battleBGM.loop = true;

selectBGM.volume = 0.4;
battleBGM.volume = 0.4;

// 첫 클릭 시 선택화면 BGM 시작
window.addEventListener('click', () => {
  if (selectBGM.paused) {
    selectBGM.play().catch(() => {});
  }
}, { once: true });

// ─── Select Screen ───────────────────────────────────────────────────────────
const chars = Object.keys(CHAR_DEFS);
let hoveredIdx = -1;
let selectedIdx = -1;
 
const CARD_W = 190, CARD_H = 150;
const COLS_SEL = 4;
const START_X = (CANVAS_W - COLS_SEL * CARD_W - (COLS_SEL - 1) * 12) / 2;
const START_Y = 200;
const GAP = 12;
 
const charColors = {
  reddy:   '#e03030',
  bluey:   '#2060e0',
  tyranno: '#33cc33',
  titan:   '#aa44ee',
  cannon:  '#f4a0a0',
  april:    '#4acef7'
};
 
const charEmoji = {
  reddy:   '🔴',
  bluey:   '🔵',
  tyranno: '🦕',
  titan:   '👾',
  cannon:  '💣',
  april:  '☂️',
};
 
const charImages = {};

chars.forEach(id => {
  const img = new Image();
  img.src = `assets/${id}.png`;
  charImages[id] = img;
});

function getCardRect(i) {
  const col = i % COLS_SEL;
  const row = Math.floor(i / COLS_SEL);
  return {
    x: START_X + col * (CARD_W + GAP),
    y: START_Y + row * (CARD_H + GAP),
    w: CARD_W,
    h: CARD_H,
  };
}
 
function drawSelectScreen() {
  // BG
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0a0a2a');
  grad.addColorStop(1, '#1a0a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
 
  // Title
  ctx.font = 'bold 36px Arial Black';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('스퀘어배틀  올스타전', CANVAS_W / 2, 80);
  ctx.font = '18px Arial';
  ctx.fillStyle = '#aaaaff';
  ctx.fillText('캐릭터를 선택하세요', CANVAS_W / 2, 120);
 
  // Subtitle
  ctx.font = '13px Arial';
  ctx.fillStyle = '#7777aa';
  ctx.fillText('팀전 4:4  ·  20킬 선취 승리  ·  탑뷰 배틀', CANVAS_W / 2, 148);
 
  chars.forEach((id, i) => {
    const def = CHAR_DEFS[id];
    const r = getCardRect(i);
    const isHov = hoveredIdx === i;
    const isSel = selectedIdx === i;
 
    // Card BG
    ctx.save();
    if (isSel) {
      ctx.shadowColor = charColors[id];
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = isSel
      ? charColors[id] + 'cc'
      : isHov
      ? charColors[id] + '55'
      : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = isSel ? charColors[id] : isHov ? charColors[id] + 'aa' : '#444';
    ctx.lineWidth = isSel ? 3 : 1.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
 
    // 캐릭터 이미지
    const img = charImages[id];

    if (img && img.complete) {
      ctx.drawImage(
        img,
        r.x + 0,
        r.y + 10,
        190,
        75,
      );
    }
 
    // Name
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = isSel ? 'white' : '#ccccee';
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 82);
 
    // Stats
    ctx.font = '11px Arial';
    ctx.fillStyle = isSel ? 'rgba(255,255,255,0.9)' : 'rgba(200,200,220,0.7)';
    ctx.fillText(`❤️ ${def.hp}`, r.x + r.w / 2, r.y + 100);
    ctx.fillText(`⚡ 속도 ${def.speed.toFixed(1)}`, r.x + r.w / 2, r.y + 116);
    ctx.fillText(`궁: ${def.ult.name}`, r.x + r.w / 2, r.y + 132);
 
    if (isSel) {
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('✔ 선택됨', r.x + r.w / 2, r.y + 148);
    }
  });
 
  // Start button
  if (selectedIdx >= 0) {
    const bx = CANVAS_W / 2 - 100, by = CANVAS_H - 80;
    ctx.save();
    ctx.fillStyle = '#4488ff';
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 18;
    roundRect(ctx, bx, by, 200, 48, 10);
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 22px Arial Black';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.fillText('게임 시작!', CANVAS_W / 2, by + 30);
  } else {
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666688';
    ctx.textAlign = 'center';
    ctx.fillText('캐릭터를 클릭해 선택하세요', CANVAS_W / 2, CANVAS_H - 55);
  }
}
 
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
 
// Select screen events
canvas.addEventListener('mousemove', e => {
  if (gameStarted) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  hoveredIdx = -1;
  chars.forEach((_, i) => {
    const r = getCardRect(i);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
      hoveredIdx = i;
    }
  });
});
 
canvas.addEventListener('click', e => {
  if (gameStarted) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
 
  chars.forEach((_, i) => {
    const r = getCardRect(i);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
      selectedIdx = i;
    }
  });
 
  // Start button
  if (selectedIdx >= 0) {
    const bx = CANVAS_W / 2 - 100, by = CANVAS_H - 80;
    if (mx >= bx && mx <= bx + 200 && my >= by && my <= by + 48) {
      startGame();
    }
  }
});
 
// ─── Game Loop ────────────────────────────────────────────────────────────────
let gameStarted = false;
let game = null;
 
function startGame() {
  gameStarted = true;

  // 선택화면 BGM 정지
  selectBGM.pause();
  selectBGM.currentTime = 0;

  game = new Game(canvas, chars[selectedIdx]);
  game.start();

  // 1초 후 전투 BGM 시작
  setTimeout(() => {
    battleBGM.play().catch(() => {});
  }, 1000);
}
 
// Select screen render loop
function selectLoop() {
  if (gameStarted) return;
  drawSelectScreen();
  requestAnimationFrame(selectLoop);
}
selectLoop();
 