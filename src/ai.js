import { findPath } from './map.js';
import { CHAR_DEFS } from './constants.js';

const PATH_INTERVAL = 0.55;

export class AIController {
  constructor(unit) {
    this.unit = unit;
    this.path = [];
    this.pathTimer = Math.random() * PATH_INTERVAL;
    this.target = null;
    this.state = 'hunt';
    this.attackTimer = 0;
    this.jx = (Math.random() - 0.5) * 36;
    this.jy = (Math.random() - 0.5) * 36;
    this.ultTimer = 0;
    this.fleeTarget = null;
  }

  update(dt, units, projectiles) {
    const u = this.unit;
    if (u.dead || u.stunTimer > 0) return;

    // 타이탄 스윙 업데이트는 game.js에서 하므로 여기선 스킵
    // 하지만 swinging 중에는 이동/공격 판단 스킵
    if (u.swinging && u.swingPhase !== 'recovery') {
      // 스윙 중에도 facing은 유지
      return;
    }

    const enemies = units.filter(e => !e.dead && e.team !== u.team);
    if (enemies.length === 0) return;

    enemies.sort((a, b) => dist(u, a) - dist(u, b));
    this.target = enemies[0];
    const t = this.target;
    const d = dist(u, t);
    const atkRange = getAttackRange(u);
    const preferDist = getPreferredDistance(u); // 캐릭터별 선호 거리

    // 체력 낮으면 후퇴 (티라노/타이탄 제외)
    if (u.hp < u.maxHp * 0.2 && u.type !== 'titan' && u.type !== 'tyranno') {
      this.state = 'retreat';
    } else if (d <= atkRange * 0.95) {
      this.state = 'attack';
    } else {
      this.state = 'hunt';
    }

    // 궁극기 판단
    if (u.ultReady && !u.ultActive && !u.swinging) {
      this.tryUseUlt(units, projectiles, t, d);
    }

    // 경로 갱신
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      this.pathTimer = PATH_INTERVAL + Math.random() * 0.2;
      this.recalcPath(t);
    }

    // 상태 실행
    if (this.state === 'retreat') {
      this.doRetreat(dt);
    } else if (this.state === 'attack') {
      this.doAttack(dt, units, projectiles, d, atkRange, preferDist);
    } else {
      this.followPath(dt);
    }
  }

  recalcPath(target) {
    const u = this.unit;
    if (this.state === 'retreat') {
      const dx = u.x - target.x, dy = u.y - target.y;
      const len = Math.hypot(dx, dy) || 1;
      const fx = u.x + (dx/len) * 200, fy = u.y + (dy/len) * 200;
      this.path = findPath(u.x, u.y, fx, fy) || [];
    } else {
      // 공격 범위 안쪽까지만 이동 (선호 거리 고려)
      const pd = getPreferredDistance(u);
      const dx = target.x - u.x, dy = target.y - u.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = target.x - (dx/len) * pd + this.jx;
      const ty = target.y - (dy/len) * pd + this.jy;
      this.path = findPath(u.x, u.y, tx, ty) || [];
    }
  }

  followPath(dt) {
    const u = this.unit;
    if (!this.path.length) return;
    const [wx, wy] = this.path[0];
    const dx = wx - u.x, dy = wy - u.y;
    if (Math.hypot(dx, dy) < 8) { this.path.shift(); return; }
    u.facing = Math.atan2(dy, dx);
    u.move(dx, dy, dt);
  }

  doRetreat(dt) {
    this.followPath(dt);
  }

  doAttack(dt, units, projectiles, d, atkRange, preferDist) {
    const u = this.unit;
    const t = this.target;
    if (!t || t.dead) return;

    const dx = t.x - u.x, dy = t.y - u.y;
    u.facing = Math.atan2(dy, dx);

    // ── 거리 조절 ──
    // 사거리 안이지만 선호 거리보다 너무 가까우면 물러남 (원거리 유닛)
    if (d < preferDist * 0.6 && (u.type === 'reddy' || u.type === 'bluey' || u.type === 'cannon')) {
      // 뒤로 이동
      u.move(-dx, -dy, dt);
    } else if (d > preferDist * 1.15) {
      // 선호 거리까지 접근
      u.move(dx, dy, dt);
    }
    // 근접 유닛은 최대한 붙음
    if ((u.type === 'tyranno' || u.type === 'titan') && d > atkRange * 0.6) {
      u.move(dx, dy, dt);
    }

    // ── 공격 ──
    this.attackTimer -= dt;
    if (this.attackTimer <= 0 && u.attackCooldown <= 0 && !u.swinging) {
      this.performAttack(t, projectiles, d, atkRange);
    }
  }

  performAttack(target, projectiles, d, atkRange) {
    const u = this.unit;
    if (d > atkRange) return; // 사거리 밖이면 공격 안 함

    if (u.ultActive && u.type === 'tyranno') {
      if (u.attackCooldown <= 0) {
        // 궁극기 중 화염 공격 (startSwing으로 FlameCone 발동)
        u.startSwing(true);
        u.attackCooldown = u.def.ult.cooldown;
        this.attackTimer = u.def.ult.cooldown + 0.1;
      }
      return;
    }

    if (u.type === 'tyranno') {
      u.startSwing(false);
      u.attackCooldown = u.def.attack.windup + u.def.attack.recovery + 0.05;
      this.attackTimer = u.def.attack.windup + u.def.attack.recovery + 0.15;
      return;
    }

    if (u.type === 'titan') {
      u.startSwing(false);
      u.attackCooldown = u.def.attack.windup + u.def.attack.recovery + 0.1;
      this.attackTimer = u.def.attack.windup + u.def.attack.recovery + 0.2;
      return;
    }

    if (u.type === 'cannon') {
      if (u.recoilTimer > 0) return;
      u.fireBullet(projectiles, target.x, target.y, false);
      this.attackTimer = u.def.attack.recovery + 0.1;
      return;
    }

    // 총기 캐릭터 (reddy, bluey)
    if (u.ultActive && u.type === 'reddy') {
      u.fireBullet(projectiles, target.x, target.y, true);
      u.attackCooldown = u.def.ult.cooldown;
      this.attackTimer = u.def.ult.cooldown;
    } else {
      u.fireBullet(projectiles, target.x, target.y, false);
      u.attackCooldown = u.def.attack.cooldown;
      this.attackTimer = u.def.attack.cooldown;
    }
  }

  tryUseUlt(units, projectiles, t, d) {
    const u = this.unit;
    if (u.type === 'reddy' && d < u.def.ult.range * 1.2) {
      u.useUlt(t.x, t.y, projectiles, units);
    } else if (u.type === 'bluey') {
      u.useUlt(t.x, t.y, projectiles, units);
    } else if (u.type === 'tyranno') {
      u.useUlt(t.x, t.y, projectiles, units);
    } else if (u.type === 'titan' && d < u.def.ult.range * 1.1) {
      u.useUlt(t.x, t.y, projectiles, units);
    } else if (u.type === 'cannon') {
      const near = units.filter(e => !e.dead && e.team !== u.team && dist(u, e) < u.def.ult.radius * 1.1).length;
      if (near >= 1) u.useUlt(t.x, t.y, projectiles, units);
    } else if (u. type === 'april') {
      u.useUlt(t.x, t.y, projectiles, units);
    }  
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// 캐릭터별 선호 교전 거리 (최대 사거리의 80% 내외)
function getPreferredDistance(u) {
  switch (u.type) {
    case 'reddy':   return u.def.attack.range * 0.78;   // ~94px
    case 'bluey':   return u.def.attack.range * 0.78;
    case 'cannon':  return u.def.attack.range * 0.80;   // ~140px
    case 'tyranno': return u.def.attack.range * 0.55;   // ~22px (붙어야 함)
    case 'titan':   return u.def.attack.range * 0.60;   // ~65px
    case 'april': return u.def.attack.range * 0.78;
    default:        return 80;
  }
}

function getAttackRange(u) {
  const atk = u.def.attack;
  return atk.range || 80;
}