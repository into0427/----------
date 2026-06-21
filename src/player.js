export class PlayerController {
  constructor(unit, canvas) {
    this.unit = unit;
    this.keys = {};
    this.mouseX = 0; this.mouseY = 0;
    this.shooting = false;
    this.ultPressed = false;
    this.bindEvents(canvas);
  }

  bindEvents(canvas) {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.ultPressed = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.shooting = true; });
    canvas.addEventListener('mouseup',   e => { if (e.button === 0) this.shooting = false; });
  }

  update(dt, camX, camY, projectiles, units) {
    const u = this.unit;
    if (u.dead) return;

    // 이동
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    if (dx !== 0 || dy !== 0) u.move(dx, dy, dt);

    // 조준
    const wx = this.mouseX + camX, wy = this.mouseY + camY;
    if (Math.hypot(wx - u.x, wy - u.y) > 5) u.facing = Math.atan2(wy - u.y, wx - u.x);

    // 궁극기
    if (this.ultPressed && u.ultReady && !u.ultActive && !u.swinging) {
      u.useUlt(wx, wy, projectiles, units);
    }
    this.ultPressed = false;

    // 공격 (스윙 중 / 경직 중엔 무시)
    if (this.shooting && u.attackCooldown <= 0 && !u.swinging) {
      this.doAttack(u, wx, wy, projectiles, units);
    }
  }

  doAttack(u, wx, wy, projectiles, units) {
  
    let cooldownMult =
    u.comebackActive ? 0.9 : 1;
    
    if (u.type === 'tyranno') {
      if (u.ultActive) {
        // 궁극기 중 화염: startSwing(true) → executeHit → FlameCone
        u.startSwing(true);
        u.attackCooldown = u.def.ult.cooldown * cooldownMult;
      } else {
        u.startSwing(false);
        u.attackCooldown = (u.def.attack.windup + u.def.attack.recovery + 0.05) * cooldownMult;
      }
      return;
    }

    if (u.type === 'titan') {
      // 일반 공격 스윙
      u.startSwing(false);
     u.attackCooldown = u.def.attack.cooldown * cooldownMult;
     return;
    }

    if (u.type === 'cannon') {
      if (u.recoilTimer > 0) return;
      u.fireBullet(projectiles, wx, wy, false);
      return;
    }

    // 총기 (reddy, bluey)
    if (u.ultActive && u.type === 'reddy') {
      u.fireBullet(projectiles, wx, wy, true);
      u.attackCooldown = u.def.ult.cooldown * cooldownMult;
    } else {
      u.fireBullet(projectiles, wx, wy, false);
      u.attackCooldown = u.def.attack.cooldown * cooldownMult;
    }
  }
}