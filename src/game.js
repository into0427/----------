import { CANVAS_W, CANVAS_H, MAP_W, MAP_H, TILE, WIN_KILLS, TEAM, CHAR_DEFS } from './constants.js';
import { generateMap, drawMap, isWall } from './map.js';
import { Unit } from './unit.js';
import { AIController } from './ai.js';
import { PlayerController } from './player.js';
 
const RESPAWN_TIME = 3;
 
export class Game {
  constructor(canvas, playerCharType) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.playerCharType = playerCharType;
    this.running = false;
    this.paused = false;
 
    this.units = [];
    this.projectiles = [];
    this.controllers = [];
    this.respawnQueue = [];
 
    this.killsA = 0;
    this.killsB = 0;
 
    this.camX = 0;
    this.camY = 0;
 
    this.over = false;
    this.winner = null;
 
    this.lastTime = 0;
 
    this.floatingTexts = [];
  }
 
  start() {
    generateMap();
    this.spawnUnits();
    this.running = true;
    requestAnimationFrame(this.loop.bind(this));
  }
 
  spawnUnits() {
    const types = Object.keys(CHAR_DEFS);
    const shuffle = arr => arr.sort(() => Math.random() - 0.5);
    const teamATypes = shuffle([...types]).slice(0, 4);
    const teamBTypes = shuffle([...types]).slice(0, 4);
 
    // Ensure player type is in team A
    if (!teamATypes.includes(this.playerCharType)) {
      teamATypes[0] = this.playerCharType;
    }
 
    const spawnA = this.findSpawnCluster(TILE * 4, TILE * 4, 4);
    const spawnB = this.findSpawnCluster(MAP_W - TILE * 5, MAP_H - TILE * 5, 4);
 
    teamATypes.forEach((type, i) => {
      const pos = spawnA[i] || { x: TILE * 4 + i * TILE, y: TILE * 4 };
      const unit = new Unit(type, TEAM.A, pos.x, pos.y);
      this.units.push(unit);
      if (type === this.playerCharType && !this.playerUnit) {
        this.playerUnit = unit;
        this.playerCtrl = new PlayerController(unit, this.canvas);
      } else {
        this.controllers.push({ unit, ctrl: new AIController(unit) });
      }
    });
 
    teamBTypes.forEach((type, i) => {
      const pos = spawnB[i] || { x: MAP_W - TILE * 5 + i * TILE, y: MAP_H - TILE * 5 };
      const unit = new Unit(type, TEAM.B, pos.x, pos.y);
      this.units.push(unit);
      this.controllers.push({ unit, ctrl: new AIController(unit) });
    });
  }
 
  findSpawnCluster(cx, cy, count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      let x, y, tries = 0;
      do {
        x = cx + (Math.random() - 0.5) * TILE * 4;
        y = cy + (Math.random() - 0.5) * TILE * 4;
        tries++;
      } while (isWall(x, y) && tries < 50);
      pts.push({ x, y });
    }
    return pts;
  }
 
  loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
 
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }
 
  update(dt) {
    if (this.over) return;
 
    // Count kills
    this.killsA = this.units.filter(u => u.team === TEAM.A).reduce((s, u) => s + (u.kills || 0), 0);
    this.killsB = this.units.filter(u => u.team === TEAM.B).reduce((s, u) => s + (u.kills || 0), 0);
 
    if (this.killsA >= WIN_KILLS) { this.over = true; this.winner = TEAM.A; return; }
    if (this.killsB >= WIN_KILLS) { this.over = true; this.winner = TEAM.B; return; }
 
    // Player controller
    if (this.playerUnit && !this.playerUnit.dead) {
      this.playerCtrl.update(dt, this.camX, this.camY, this.projectiles, this.units);
    }
 
    // AI controllers
    for (const { unit, ctrl } of this.controllers) {
      if (!unit.dead) ctrl.update(dt, this.units, this.projectiles);
    }
 
    // Units update (swings, timers, etc.)
    for (const u of this.units) {
      if (!u.dead) {
        u.update(dt, this.projectiles, this.units, null);
        u.updateSwing(dt, this.units, this.projectiles);
        // Tyranno ult restore speed
        if (u.type === 'tyranno' && !u.ultActive && u.speed !== u.def.speed) {
          u.speed = u.def.speed;
          u.riding = false;
        }
      }
    }
 
    // Projectiles
    this.projectiles = this.projectiles.filter(p => !p.dead);
    for (const p of this.projectiles) {
      p.update(dt, this.units);
    }
 
    // Respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const r = this.respawnQueue[i];
      r.timer -= dt;
      if (r.timer <= 0) {
        this.respawn(r.unit);
        this.respawnQueue.splice(i, 1);
      }
    }
 
    // Check dead units → queue respawn
    for (const u of this.units) {
      if (u.dead && !this.respawnQueue.find(r => r.unit === u) && !u._queued) {
        u._queued = true;
        this.respawnQueue.push({ unit: u, timer: RESPAWN_TIME });
      }
    }
 
    // Floating texts
    this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
    for (const t of this.floatingTexts) {
      t.y -= 30 * dt;
      t.life -= dt;
    }
 
    // Camera follows player
    if (this.playerUnit) {
      const targetX = this.playerUnit.x - CANVAS_W / 2;
      const targetY = this.playerUnit.y - CANVAS_H / 2;
      this.camX += (targetX - this.camX) * 0.1;
      this.camY += (targetY - this.camY) * 0.1;
    }
    this.camX = Math.max(0, Math.min(MAP_W - CANVAS_W, this.camX));
    this.camY = Math.max(0, Math.min(MAP_H - CANVAS_H, this.camY));
  }
 
  respawn(unit) {
    unit.dead = false;
    unit._queued = false;
    unit.hp = unit.maxHp;
    unit.stunTimer = 0;
    unit.swinging = false;
    unit.ultActive = false;
    unit.riding = false;
    unit.speed = unit.def.speed;
 
    const side = unit.team === TEAM.A;
    const cx = side ? TILE * 4 : MAP_W - TILE * 5;
    const cy = side ? TILE * 4 : MAP_H - TILE * 5;
    const pts = this.findSpawnCluster(cx, cy, 1);
    unit.x = pts[0].x;
    unit.y = pts[0].y;
  }
 
  draw() {
    const ctx = this.ctx;
    const camX = this.camX, camY = this.camY;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
 
    drawMap(ctx, camX, camY, CANVAS_W, CANVAS_H);
 
    // Sort units by y for pseudo-depth
    const visible = this.units.filter(u => !u.dead);
    visible.sort((a, b) => a.y - b.y);
 
    // Draw projectiles behind units? No, on top is more readable
    for (const p of this.projectiles) {
      if (!p.dead) p.draw(ctx, camX, camY);
    }
 
    for (const u of visible) {
      u.draw(ctx, camX, camY);
    }
 
    // Dead ghost (semi-transparent)
    for (const u of this.units) {
      if (u.dead) {
        const sx = u.x - camX, sy = u.y - camY;
        if (sx < -50 || sx > CANVAS_W + 50 || sy < -50 || sy > CANVAS_H + 50) continue;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.translate(sx, sy);
        ctx.rotate(u.facing + Math.PI / 2);
        u['draw_' + u.type]?.(ctx);
        ctx.restore();
        // Respawn timer
        const r = this.respawnQueue.find(r => r.unit === u);
        if (r) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.ceil(r.timer)}s`, sx, sy - 35);
        }
      }
    }
 
    // HUD
    this.drawHUD(ctx);
 
    // Floating texts
    for (const t of this.floatingTexts) {
      const sx = t.x - camX, sy = t.y - camY;
      ctx.globalAlpha = t.life;
      ctx.fillStyle = t.color || 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
 
    if (this.over) this.drawGameOver(ctx);
  }
 
  drawHUD(ctx) {
    const pu = this.playerUnit;
    // Score bar top
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, 44);
 
    ctx.font = 'bold 22px Arial Black';
    ctx.textAlign = 'center';
    // Team A
    ctx.fillStyle = '#44eeff';
    ctx.fillText(`🔵 팀A  ${this.killsA}`, CANVAS_W / 2 - 100, 28);
    // vs
    ctx.fillStyle = 'white';
    ctx.fillText('vs', CANVAS_W / 2, 28);
    // Team B
    ctx.fillStyle = '#ffaa33';
    ctx.fillText(`${this.killsB}  팀B 🔴`, CANVAS_W / 2 + 100, 28);
    // Goal
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Arial';
    ctx.fillText(`선 ${WIN_KILLS}킬 승리`, CANVAS_W / 2, 42);
 
    if (!pu) return;
 
    // Player HP + Ult bar (bottom)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 60);
 
    // Character name
    ctx.fillStyle = 'white';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(CHAR_DEFS[this.playerCharType].name, 16, CANVAS_H - 40);
 
    // HP bar
    const hpFrac = pu.hp / pu.maxHp;
    ctx.fillStyle = '#333';
    ctx.fillRect(16, CANVAS_H - 32, 200, 12);
    ctx.fillStyle = hpFrac > 0.5 ? '#44ff44' : hpFrac > 0.25 ? '#ffcc00' : '#ff4444';
    ctx.fillRect(16, CANVAS_H - 32, 200 * hpFrac, 12);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, CANVAS_H - 32, 200, 12);
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(`${Math.ceil(pu.hp)} / ${pu.maxHp}`, 222, CANVAS_H - 22);
 
    // Ult bar
    const ultFrac = Math.min(1, pu.ultCharge / pu.def.ult.charge);
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(16, CANVAS_H - 16, 200, 8);
    ctx.fillStyle = pu.ultReady ? '#cc44ff' : '#7722aa';
    ctx.fillRect(16, CANVAS_H - 16, 200 * ultFrac, 8);
    ctx.strokeStyle = '#cc44ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, CANVAS_H - 16, 200, 8);
    ctx.fillStyle = pu.ultReady ? '#eeddff' : '#9966cc';
    ctx.font = '10px Arial';
    ctx.fillText(pu.ultReady ? `[E] ${pu.def.ult.name} 준비!` : `[E] ${pu.def.ult.name} (${Math.ceil(pu.def.ult.charge - pu.ultCharge)}s)`, 222, CANVAS_H - 9);
 
    // Controls reminder
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('WASD 이동  /  마우스 조준  /  클릭 공격  /  E 궁극기', CANVAS_W - 14, CANVAS_H - 9);
  }
 
  drawGameOver(ctx) {
    const player = this.playerUnit || {
     kills: 0,
     deaths: 0
    };
    
   const mvp = this.units
     .slice()
     .sort(
       (a,b)=>
         (b.kills-b.deaths)
         -
         (a.kills-a.deaths)
      )[0];

    const teamA = this.units.filter(
      u => u.team === 'A'
    );

   const teamB = this.units.filter(
      u => u.team === 'B'
    );

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
 
    const isWin = this.winner === TEAM.A;
    ctx.font = 'bold 64px Arial Black';
    ctx.textAlign = 'center';
    ctx.fillStyle = isWin ? '#44ffcc' : '#ff4444';
    ctx.fillText(isWin ? '🏆 승리!' : '💀 패배...', CANVAS_W / 2, CANVAS_H / 2 - 30);
     
ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(
      `MVP : ${mvp.def.name}`,
      CANVAS_W / 2,
      CANVAS_H / 2 + 80
    );
    ctx.font = '18px Arial';
    ctx.fillStyle = 'white';
    let y = CANVAS_H / 2 + 120;
    ctx.fillText(
      '[우리 팀]',
      CANVAS_W / 2 - 170,
      y
    );
    y += 25;
    for (const u of teamA) {
      ctx.fillText(
        `${u.def.name}  ${u.kills}/${u.deaths}`,
        CANVAS_W / 2 - 170,
        y
      );
      y += 22;
    }
    y = CANVAS_H / 2 + 120;
    ctx.fillText(
      '[상대 팀]',
      CANVAS_W / 2 + 170,
      y
    );
    y += 25;
    for (const u of teamB) {
      ctx.fillText(
        `${u.def.name}  ${u.kills}/${u.deaths}`,
        CANVAS_W / 2 + 170,
        y
      );
      y += 22;
    }

    ctx.font = '18px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('R 키를 눌러 재시작', CANVAS_W / 2, CANVAS_H / 2 + 50);
 
    // R to restart
    if (!this._restartBound) {
      this._restartBound = true;
      window.addEventListener('keydown', e => {
        if (e.code === 'KeyR') location.reload();
      });
    }
  }
 
  addFloatingText(x, y, text, color = 'white') {
    this.floatingTexts.push({ x, y, text, color, life: 1.2 });
  }
}