export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const MAP_W = 2400;
export const MAP_H = 2400;
export const TILE = 40;
export const WIN_KILLS = 20;

export const TEAM = { A: 'A', B: 'B' };

export const CHAR_DEFS = {
  reddy: {
    name: '빨강이', color: '#e03030', hp: 1000, speed: 2.75,
    attack: { damage: 125, cooldown: 0.6, range: 120, bulletR: 6, bulletColor: '#ff4444', pierce: false },
    ult: { name: '울트라샷', charge: 29, damage: 400, cooldown: 1.1, range: 240, bulletR: 18, bulletColor: '#ff2200', pierce: true, duration: 3, wallBreak: true },
  },
  bluey: {
    name: '파랑이', color: '#2060e0', hp: 1000, speed: 2.75,
    attack: { damage: 125, cooldown: 0.6, range: 120, bulletR: 6, bulletColor: '#4488ff', pierce: false },
    ult: { name: '메가폰 레이저', charge: 36, laserCount: 3, dps: 750, laserDuration: 1.8, pierce: true },
  },
  tyranno: {
    name: '티라노', color: '#33cc33', hp: 1800, speed: 1.65,
    attack: { damage: 110, cooldown: 0.6, range: 40, melee: true, windup: 0.15, recovery: 0.45 },
    ult: { name: '공룡 소환', charge: 27, speedBonus: 3.3, damage: 31, range: 75, cooldown: 1.1, duration: 7, cone: 80, windup: 0.1, recovery: 1.0 },
  },
  titan: {
    name: '타이탄', color: '#aa44ee', hp: 2400, speed: 2.2,
    attack: { damage: 140, cooldown: 3.6, range: 108, windup: 0.6, recovery: 2.0, melee: true },
    ult: { name: '지진', charge: 33, damage: 400, range: 168, windup: 1.6, recovery: 2.9, knockback: 55, stunDuration: 4, cone: 120, wallBreak: true },
  },
  cannon: {
    name: '캐논', color: '#f4a0a0', hp: 1600, speed: 0.82,
    attack: { damage: 360, range: 200, bulletR: 14, bulletColor: '#cccccc', windup: 0, recovery: 2.5, recoil: 18, pierce: false },
    ult: { name: '대포 충격파', charge: 40, knockback: 110, radius: 120, wallBreak: true },
  },
  april: {
    name: '에이프릴', color: '#00ccee', hp: 1250, speed: 2.2,
    umbrellaMaxHp: 150,
    attack: { damage: 75, cooldown: 1.6, range: 120, bulletR: 7, burst: 2, burstDelay: 0.18 },
    ult: { name: '날아가요~', charge: 30, flyDist: 200, flyDuration: 2.0 },
  },
};