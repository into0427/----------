import { CHAR_DEFS, MAP_W, MAP_H, TILE } from './constants.js';
import { isWall } from './map.js';
import { Bullet, AprilBullet, Laser, Shockwave, QuakeCone, FlameCone } from './bullet.js';

export class Unit {
  constructor(type, team, x, y, badge = null) {
    this.type = type;
    this.team = team;
    this.burstShotsLeft = 0;
    this.burstTimer = 0;
    this.def = JSON.parse(JSON.stringify(CHAR_DEFS[type]));
    this.x = x; this.y = y;
    this.kills = 0;
    this.deaths = 0;
    this.badge = badge;
    // 타이탄은 더 크게
    if (type === 'titan')
    this.radius = 26;
   else if (type === 'april')
    this.radius = 18;
   else
  this.radius = 20;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.speed = this.def.speed;
    this.facing = -Math.PI / 2;
    this.dead = false;
    // 배지   
    if (this.badge === 'tank') {
      this.maxHp *= 1.1;
      this.hp = this.maxHp;
    }
    if (this.badge === 'speed') {
      this.speed *= 1.1;
    }  

    // 에이프릴 전용
    if (type === 'april') {
    this.umbrellaBroken = false;
    this.umbrellaHp = 150;
    this.maxUmbrellaHp = 150;
    this.umbrellaRegenTimer = 0;
    this.flying = false;
    this.flyTimer = 0;
    this.flyDuration = 2;
    this.flyStartX = 0;
    this.flyStartY = 0;
    this.flyTargetX = 0;
    this.flyTargetY = 0;  
    }
    
    // 공격 상태
    this.attackCooldown = 0;
    this.ultCharge = 0;
    this.ultActive = false;
    this.ultTimer = 0;
    this.stunTimer = 0;

    // 근접 스윙 상태
    this.swinging = false;
    this.swingTimer = 0;
    this.swingPhase = 'windup'; // 'windup' | 'hit' | 'recovery'
    this.swingIsUlt = false;
    this.swingAngle = 0;        // 시각 효과용 현재 스윙 각도
    this.swingProgress = 0;     // 0~1

    // 타이탄: 방망이 시각 상태
    this.clubAngle = 0;         // 방망이 렌더 각도 (facing 기준 오프셋)
    this.clubIsUlt = false;

    // 티라노
    this.riding = false;
    this.knifeAngle = 0;        // 장난감 칼 렌더 오프셋

    // 캐논
    this.recoilTimer = 0;

    // 시각
    this.flashTimer = 0;
    this.lasers = [];
  }

  stun(duration) {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  takeDamage(amount, attacker) {
    if (this.flying) return;
    if (
    this.type === 'april' &&
    !this.umbrellaBroken &&
    attacker
  ) {
    const dx = attacker.x - this.x;
    const dy = attacker.y - this.y;

    let diff =
      Math.atan2(dy, dx) - this.facing;

    while (diff > Math.PI)
      diff -= Math.PI * 2;

    while (diff < -Math.PI)
      diff += Math.PI * 2;

    // 전방 120도 방어
    if (Math.abs(diff) < Math.PI / 3) {
      this.umbrellaHp -= amount;

      if (this.umbrellaHp <= 0) {
        this.umbrellaHp = 0;
        this.umbrellaBroken = true;
        this.umbrellaRegenTimer = 0;
      }

      return;
    }
  }  
    
    if (this.dead) return;
    this.hp -= amount;
    this.flashTimer = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(attacker);
    }
  }

  die(killer) {
    this.dead = true;
    this.deaths = (this.deaths || 0) + 1;
    if (killer) {
      killer.kills = (killer.kills || 0) + 1;
    }
  }

  clampToMap() {
    this.x = Math.max(this.radius, Math.min(MAP_W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(MAP_H - this.radius, this.y));
  }

  move(dx, dy, dt) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = (dx / len) * this.speed;
    const ny = (dy / len) * this.speed;
    const nx2 = this.x + nx;
    const ny2 = this.y + ny;
    if (!isWall(nx2, this.y) && nx2 > this.radius && nx2 < MAP_W - this.radius) this.x = nx2;
    if (!isWall(this.x, ny2) && ny2 > this.radius && ny2 < MAP_H - this.radius) this.y = ny2;
  }

  get ultReady() {
    return this.ultCharge >= this.def.ult.charge;
  }

  // ─── update ───────────────────────────────────────────────────────────────

  update(dt, projectiles, units) {
      if (this.flying) {
    this.flyTimer += dt;
    const t =
      Math.min(1, this.flyTimer / this.flyDuration);
    this.x =
      this.flyStartX +
      (this.flyTargetX - this.flyStartX) * t;
    this.y =
      this.flyStartY +
      (this.flyTargetY - this.flyStartY) * t;
    if (t >= 1) {
      this.flying = false;
      this.ultActive = false;
      this.umbrellaHp =
        this.maxUmbrellaHp;
      this.umbrellaBroken = false;
      this.findLandingSpot();
    }
    return;
  }
      
    if (this.dead) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (!this.ultActive) this.ultCharge += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.recoilTimer > 0) this.recoilTimer -= dt;
    if (this.ultActive) {
      this.ultTimer -= dt;
      if (this.ultTimer <= 0) {
        this.ultActive = false;
        this.riding = false;
        if (this.type === 'tyranno') this.speed = this.def.speed;
      }
    }
   
    // ⭐ 에이프릴 우산 회복
    if (this.type === 'april' && this.umbrellaBroken) {
      this.umbrellaRegenTimer += dt;
      // 3.5초 후부터 회복 시작
      if (this.umbrellaRegenTimer >= 3.5) {
        this.umbrellaHp += 20 * dt; // 초당 20 = 0.1초당 2
        if (this.type === 'april' && this.umbrellaHp < this.maxUmbrellaHp) {
         if (this.umbrellaBroken) {
           this.umbrellaRegenTimer += dt;
         }
          if (this.umbrellaRegenTimer >= 3.5) {
            this.umbrellaHp += 20 * dt;
            if (this.umbrellaHp > 0) {
              this.umbrellaBroken = false;
            }
            if (this.umbrellaHp > this.maxUmbrellaHp) {
              this.umbrellaHp = this.maxUmbrellaHp;
           }
          }
        }
      }
    }  

    if (this.type === 'april' && this.burstShotsLeft > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
          this.burstShotsLeft--;
          const angle = this.facing;
          projectiles.push(
            new AprilBullet({
              x: this.x + Math.cos(angle) * 18,
              y: this.y + Math.sin(angle) * 18,
              angle,
              speed: 520,
              damage: this.def.attack.damage,
              radius: this.def.attack.bulletR,
              team: this.team,
              owner: this,
              maxRange: this.def.attack.range,
            }, true)
          );
          if (this.burstShotsLeft > 0) {
            this.burstTimer = this.def.attack.burstDelay;
          }
        }
      }

    this.updateSwing(dt, units, projectiles);
  }

  // ─── 근접 스윙 업데이트 ────────────────────────────────────────────────────
  updateSwing(dt, units, projectiles) {
    if (!this.swinging) return;

    this.swingTimer -= dt;

    // 진행도 계산 (시각용)
    const ult = this.swingIsUlt;
    const def = ult ? this.def.ult : this.def.attack;

    if (this.swingPhase === 'windup') {
      const total = def.windup;
      this.swingProgress = total > 0 ? Math.max(0, 1 - this.swingTimer / total) : 1;
      // 타이탄 방망이: windup 중 들어올리기 (-90도 → 0도)
      if (this.type === 'titan') {
        this.clubAngle = -Math.PI * 0.5 * (1 - this.swingProgress);
      }
      if (this.type === 'tyranno') {
        this.knifeAngle = -Math.PI * 0.4 * (1 - this.swingProgress);
      }

      if (this.swingTimer <= 0) {
        // 타격 실행
        this.executeHit(units, projectiles);
        this.swingPhase = 'hit';
        this.swingTimer = 0.08; // 타격 프레임 짧게 유지
      }
    } else if (this.swingPhase === 'hit') {
      // 타격 포즈 잠깐 유지
      if (this.type === 'titan') this.clubAngle = Math.PI * 0.35;
      if (this.type === 'tyranno') this.knifeAngle = Math.PI * 0.55;
      if (this.swingTimer <= 0) {
        this.swingPhase = 'recovery';
        this.swingTimer = def.recovery;
      }
    } else if (this.swingPhase === 'recovery') {
      const total = def.recovery;
      const p = 1 - Math.max(0, this.swingTimer / total);
      // 타이탄 방망이: recovery 중 내려오기
      if (this.type === 'titan') {
        this.clubAngle = Math.PI * 0.35 * (1 - p);
      }
      if (this.type === 'tyranno') {
        this.knifeAngle = Math.PI * 0.55 * (1 - p);
      }
      if (this.swingTimer <= 0) {
        this.swinging = false;
        this.clubAngle = 0;
        this.knifeAngle = 0;
        //this.attackCooldown = 0;
      }
    }
  }

  executeHit(units, projectiles) {
    const ult = this.swingIsUlt;
    const def = ult ? this.def.ult : this.def.attack;

    if (this.type === 'titan') {
      if (ult) {
        projectiles.push(new QuakeCone({
          x: this.x, y: this.y, angle: this.facing,
          range: def.range, coneAngle: def.cone,
          team: this.team, owner: this,
          damage: def.damage, knockback: def.knockback, stunDuration: def.stunDuration,
        }));
      } else {
        // 일반 근접: 전방 부채꼴
        for (const u of units) {
          if (u.dead || u.team === this.team) continue;
          const dx = u.x - this.x, dy = u.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < def.range + u.radius) {
            let diff = Math.atan2(dy, dx) - this.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < Math.PI * 0.65) u.takeDamage(def.damage, this);
          }
        }
      }
    }

    if (this.type === 'tyranno') {
      if (!ult) {
        // 짧은 근접
        for (const u of units) {
          if (u.dead || u.team === this.team) continue;
          const dx = u.x - this.x, dy = u.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < def.range + u.radius) {
            let diff = Math.atan2(dy, dx) - this.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < Math.PI * 0.7) u.takeDamage(def.damage, this);
          }
        }
      } else {
        // 궁극기 화염 (FlameCone)
        projectiles.push(new FlameCone({
          x: this.x, y: this.y, angle: this.facing,
          range: def.range, coneAngle: def.cone,
          team: this.team, owner: this, damage: def.damage,
        }));
      }
    }
  }
  
  startSwing(ult) {
    if (this.swinging) return;
    this.swinging = true;
    this.swingIsUlt = ult;
    this.clubIsUlt = ult;
    const def = ult ? this.def.ult : this.def.attack;
    this.swingPhase = 'windup';
    this.swingTimer = def.windup;
    this.swingProgress = 0;
    if (def.windup === 0) {
      // windup 없으면 즉시 타격
      this.swingPhase = 'hit';
      this.swingTimer = 0.08;
    }
  }

  // ─── 발사 (총기 캐릭터) ────────────────────────────────────────────────────
  fireBullet(projectiles, targetX, targetY, ult = false) {
    const def = ult ? this.def.ult : this.def.attack;
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.facing = angle;

    if (this.type === 'cannon' && !ult) {
      projectiles.push(new Bullet({
        x: this.x, y: this.y, angle, speed: 520,
        damage: def.damage, radius: def.bulletR, color: def.bulletColor,
        pierce: false, team: this.team, owner: this,
      }));
      // 반동
      this.x -= Math.cos(angle) * this.def.attack.recoil;
      this.y -= Math.sin(angle) * this.def.attack.recoil;
      this.clampToMap();
      this.attackCooldown = this.def.attack.recovery;
      this.recoilTimer = this.def.attack.recovery;
      return;
    }

    if (this.type === 'cannon' && ult) {
      projectiles.push(new Shockwave({ x: this.x, y: this.y, radius: this.def.ult.radius, team: this.team, owner: this }));
      return;
    }

      if (this.type === 'april') {
        const spawnX = this.x + Math.cos(angle) * 18;
        const spawnY = this.y + Math.sin(angle) * 18;
        // 첫 발
        projectiles.push(
          new AprilBullet({
            x: spawnX,
            y: spawnY,
            angle,
            speed: 520,
            damage: def.damage,
            radius: def.bulletR,
            team: this.team,
            owner: this,
            maxRange: def.range,
          }, false)
        );
        // 두 번째 발 예약
        this.burstShotsLeft = 1;
        this.burstTimer = def.burstDelay;
        return;
      }

    // 총알 발사 (reddy, bluey)
    const b = new Bullet({
      x: this.x, y: this.y, angle, speed: 500,
      damage: def.damage,
      radius: ult ? def.bulletR : this.def.attack.bulletR,
      color: ult ? def.bulletColor : this.def.attack.bulletColor,
      pierce: ult ? def.pierce : this.def.attack.pierce,
      team: this.team, owner: this,
      maxRange: ult ? def.range : this.def.attack.range,
    });
    projectiles.push(b);
  }

  useUlt(targetX, targetY, projectiles, units) {
    if (!this.ultReady) return;
    this.ultCharge = 0;

    if (this.type === 'bluey') {
      const enemies = units.filter(u => !u.dead && u.team !== this.team)
        .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
        .slice(0, 3);
      for (const e of enemies) {
        const l = new Laser({ owner: this, target: e, damage: this.def.ult.dps / 10, duration: this.def.ult.laserDuration, team: this.team });
        projectiles.push(l);
        this.lasers.push(l);
      }
      this.ultActive = true;
      this.ultTimer = this.def.ult.laserDuration;
      return;
    }

    if (this.type === 'tyranno') {
      this.riding = true;
      this.speed = this.def.ult.speedBonus;
      this.ultActive = true;
      this.ultTimer = this.def.ult.duration;
      return;
    }

    if (this.type === 'titan') {
      const def = this.def.ult;
      this.startSwing(true);
      this.ultActive = true;
      this.ultTimer = def.windup + def.recovery + 0.3;
      return;
    }

    if (this.type === 'cannon') {
      projectiles.push(new Shockwave({ x: this.x, y: this.y, radius: this.def.ult.radius, team: this.team, owner: this }));
      return;
    }

    // reddy 궁극기: 3초간 강화
    this.ultActive = true;
    this.ultTimer = this.def.ult.duration;

    if (this.type === 'april') {
     const distance = 200;
     this.flying = true;
     this.ultActive = true;
     this.flyTimer = 0;
     this.flyDuration = 2;
     this.flyStartX = this.x;
     this.flyStartY = this.y;
     this.flyTargetX =
     this.x + Math.cos(this.facing) * distance;
     this.flyTargetY =
     this.y + Math.sin(this.facing) * distance;
      return;
    }    

    
  }

  // 에이프릴 착지
  findLandingSpot() {
    if (!isWall(this.x, this.y))
      return;
    for (let r = 10; r <= 120; r += 10) {
      for (
        let a = 0;
        a < Math.PI * 2;
        a += Math.PI / 8
      ) {
        const nx =
          this.x + Math.cos(a) * r;
        const ny =
          this.y + Math.sin(a) * r;
        if (!isWall(nx, ny)) {
          this.x = nx;
          this.y = ny;
          return;
        }
      }
    }
  }


  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  draw(ctx, camX, camY) {
    if (this.dead) return;
    const sx = this.x - camX, sy = this.y - camY;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.facing + Math.PI / 2);
    if (this.flashTimer > 0) {
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(this.flashTimer * 40));
    }
    this['draw_' + this.type]?.(ctx);
    ctx.restore();

    // HP 바
    const BW = this.type === 'titan' ? 52 : 44;
    const hpFrac = this.hp / this.maxHp;
    ctx.fillStyle = '#222';
    ctx.fillRect(sx - BW/2, sy - 34, BW, 5);
    ctx.fillStyle = hpFrac > 0.5 ? '#44ee44' : hpFrac > 0.25 ? '#ffcc00' : '#ff4444';
    ctx.fillRect(sx - BW/2, sy - 34, BW * hpFrac, 5);

    // 궁극기 게이지
    const ultFrac = Math.min(1, this.ultCharge / this.def.ult.charge);
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(sx - BW/2, sy - 28, BW, 3);
    ctx.fillStyle = this.ultReady ? '#dd44ff' : '#7722aa';
    ctx.fillRect(sx - BW/2, sy - 28, BW * ultFrac, 3);
  }

  // ─── 캐릭터별 그리기 ──────────────────────────────────────────────────────

  draw_reddy(ctx) {
    // 탑뷰: 위쪽 = 앞쪽 (rotate로 처리됨)
    // 스퀘어 몸통 (빨간 머리)
    ctx.fillStyle = '#e03030';
    ctx.fillRect(-14, -20, 28, 20);
    // 주둥이 타원 (아래쪽)
    ctx.fillStyle = '#d4a020';
    ctx.beginPath(); ctx.ellipse(0, 8, 19, 14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#a07018';
    ctx.beginPath(); ctx.ellipse(0, 10, 11, 8, 0, 0, Math.PI*2); ctx.fill();
    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, -12, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -12, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-7, -11, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -11, 2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-3, -18, 6, 3);
    // 총기 표시 (작은 검정 막대 오른쪽)
    ctx.fillStyle = '#333';
    ctx.fillRect(12, -5, 8, 4);
    // 팀 색 테두리
    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2.5; ctx.strokeRect(-14, -20, 28, 20);
    // 궁극기 중 빛남
    if (this.ultActive) {
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 8, 19, 14, 0, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  draw_bluey(ctx) {
    ctx.fillStyle = '#2060e0';
    ctx.fillRect(-14, -20, 28, 20);
    // 주둥이
    ctx.fillStyle = '#c8a018';
    ctx.beginPath(); ctx.ellipse(0, 8, 19, 13, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#9a7a10';
    ctx.beginPath(); ctx.ellipse(0, 10, 10, 8, 0, 0, Math.PI*2); ctx.fill();
    // 선글라스
    ctx.fillStyle = '#111';
    ctx.fillRect(-12, -16, 9, 6); ctx.fillRect(3, -16, 9, 6);
    ctx.fillRect(-3, -13, 6, 3);
    // 사이드 블록
    ctx.fillStyle = '#111';
    ctx.fillRect(14, -14, 5, 9); ctx.fillRect(-19, -14, 5, 9);
    ctx.fillStyle = '#111'; ctx.fillRect(-3, -18, 6, 3);
    // 총기
    ctx.fillStyle = '#333'; ctx.fillRect(12, -5, 8, 4);
    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2.5; ctx.strokeRect(-14, -20, 28, 20);
    if (this.ultActive) {
      ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  draw_tyranno(ctx) {
    if (this.riding) { this.draw_tyranno_riding(ctx); return; }

    // 수정: 가로 세로 비율 조정 (덩치 약간 축소, 더 둥글게)
    // 몸통 - 작은 타원 (세로 좀 줄임)
    ctx.fillStyle = '#33cc33';
    ctx.beginPath(); ctx.ellipse(0, 6, 16, 19, 0, 0, Math.PI*2); ctx.fill();
    // 윗부분 (머리+몸통 연결)
    ctx.fillStyle = '#22aa22';
    ctx.fillRect(-12, -18, 24, 16);
    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -13, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -13, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-6, -12, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -12, 2, 0, Math.PI*2); ctx.fill();
    // 빨간 왕관
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(0, -20, 5, 0, Math.PI*2); ctx.fill();
    // 배 점 (노란 타원 3개)
    ctx.fillStyle = '#eecc00';
    ctx.beginPath(); ctx.ellipse(0, 1, 4, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 11, 3, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 19, 2.5, 4, 0, 0, Math.PI*2); ctx.fill();

    // ── 장난감 칼 모션 ──
    if (this.swinging) {
      ctx.save();
      ctx.rotate(this.knifeAngle); // facing 기준 오프셋 회전
      // 칼 손잡이
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(8, -4, 5, 10);
      // 칼날
      ctx.fillStyle = '#c0c0c0';
      ctx.beginPath();
      ctx.moveTo(13, -4); ctx.lineTo(13, -22); ctx.lineTo(15, -22); ctx.lineTo(16, -4);
      ctx.closePath(); ctx.fill();
      // 칼날 빛
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(13.5, -22, 1, 18);
      ctx.restore();
    }

    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 6, 16, 19, 0, 0, Math.PI*2); ctx.stroke();
  }

  draw_tyranno_riding(ctx) {
    // 티라노사우루스 (더 크게)
    ctx.fillStyle = '#2fa82f';
    ctx.beginPath(); ctx.ellipse(0, 14, 20, 26, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2fa82f';
    ctx.fillRect(-9, -28, 18, 22);
    ctx.fillStyle = '#33cc33';
    ctx.beginPath(); ctx.ellipse(0, -30, 13, 11, 0, 0, Math.PI*2); ctx.fill();
    // 턱 (불 뿜는 중이면 빨갛게)
    ctx.fillStyle = this.ultActive ? '#ff4444' : '#cc3333';
    ctx.fillRect(-11, -24, 22, 6);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -32, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -32, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-5, -32, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -32, 2, 0, Math.PI*2); ctx.fill();
    // 작은 라이더
    ctx.fillStyle = '#33cc33';
    ctx.fillRect(-7, -10, 14, 12);
    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 14, 20, 26, 0, 0, Math.PI*2); ctx.stroke();
  }

  draw_titan(ctx) {
    // 타이탄: 더 크고 위압감 있게
    const ult = this.ultActive;

    // 몸통 (더 큰 직사각형)
    const grad = ctx.createLinearGradient(-26, -22, 26, 22);
    grad.addColorStop(0, ult ? '#ee3333' : '#cc66ff');
    grad.addColorStop(1, ult ? '#990000' : '#6600cc');
    ctx.fillStyle = grad;
    ctx.fillRect(-26, -22, 52, 44);

    // 볼트 (옆 돌출)
    ctx.fillStyle = '#7aaa88';
    ctx.beginPath(); ctx.arc(-32, 2, 9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(32, 2, 9, 0, Math.PI*2); ctx.fill();
    // 볼트 안쪽 어두운 원
    ctx.fillStyle = '#4a7a58';
    ctx.beginPath(); ctx.arc(-32, 2, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(32, 2, 5, 0, Math.PI*2); ctx.fill();

    // 눈 (더 크게)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-10, -6, 9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -6, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-10, -5, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -5, 4, 0, Math.PI*2); ctx.fill();

    // 흉터 (궁극기 아닐 때)
    if (!ult) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, -10); ctx.lineTo(18, -14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, -10); ctx.lineTo(22, -14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, -14); ctx.lineTo(16, -8); ctx.stroke();
    }

    // ── 방망이 (타이탄 무기) 모션 ──
    // 방망이는 facing 기준으로 오른쪽에 위치, clubAngle 만큼 회전
    ctx.save();
    ctx.rotate(this.clubAngle + (ult ? 0 : 0));

    // 방망이 자루
    const clubColor = (ult && this.swingPhase !== 'recovery') ? '#ff3300' : '#6633aa';
    ctx.fillStyle = clubColor;
    ctx.fillRect(20, -6, 8, 36);

    // 방망이 헤드 (6번 사진: 큰 직사각형에 가시)
    ctx.fillStyle = ult ? '#ff6600' : '#9955dd';
    ctx.fillRect(14, -30, 22, 22);
    // 가시들
    const spikeColor = ult ? '#ffaa00' : '#cc77ff';
    ctx.fillStyle = spikeColor;
    // 왼쪽 가시
    for (let i = 0; i < 4; i++) {
      const sy2 = -28 + i * 6;
      ctx.beginPath();
      ctx.moveTo(14, sy2); ctx.lineTo(7, sy2 + 3); ctx.lineTo(14, sy2 + 5);
      ctx.fill();
    }
    // 오른쪽 가시
    for (let i = 0; i < 4; i++) {
      const sy2 = -28 + i * 6;
      ctx.beginPath();
      ctx.moveTo(36, sy2); ctx.lineTo(43, sy2 + 3); ctx.lineTo(36, sy2 + 5);
      ctx.fill();
    }
    // 윗쪽 가시
    ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(21, -38); ctx.lineTo(24, -30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, -30); ctx.lineTo(29, -38); ctx.lineTo(32, -30); ctx.fill();

    // 궁극기 글로우
    if (ult && this.swingPhase !== 'recovery') {
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2;
      ctx.strokeRect(14, -30, 22, 22);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // 팀 테두리
    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2.5; ctx.strokeRect(-26, -22, 52, 44);
  }

  draw_cannon(ctx) {
    // 몸통
    ctx.fillStyle = '#f4a0a0';
    ctx.fillRect(-22, -18, 44, 36);
    // 웃는 입
    ctx.fillStyle = '#eedd00';
    ctx.beginPath(); ctx.arc(0, 6, 14, 0.15, Math.PI - 0.15); ctx.fill();
    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-8, -5, 7, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -5, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-7, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -4, 3, 0, Math.PI*2); ctx.fill();
    // 눈썹
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-13, -11); ctx.lineTo(-4, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -9); ctx.lineTo(13, -11); ctx.stroke();
    // 오른쪽 대포
    ctx.fillStyle = '#1133cc';
    ctx.beginPath(); ctx.ellipse(28, 0, 12, 20, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#eedd00'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(28, 4, 12, 5, 0, 0, Math.PI*2); ctx.stroke();
    // 포구
    ctx.fillStyle = '#0a1f88';
    ctx.fillRect(22, -22, 12, 8);

    ctx.strokeStyle = this.team === 'A' ? '#00ffee' : '#ffaa00';
    ctx.lineWidth = 2.5; ctx.strokeRect(-22, -18, 44, 36);
    if (this.recoilTimer > 0) {
      ctx.shadowColor = '#ccccff'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#aaaaff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(28, 0, 12, 20, 0, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  draw_april(ctx) {
    // =========================
    // 비행 중 그림자
    // =========================
    if (this.flying) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // =========================
    // 일반 우산 (몸 뒤)
    // =========================
    if (!this.flying) {
      // 펼쳐진 우산
      if (!this.umbrellaBroken) {
        ctx.save();
        ctx.translate(0, -20);
        ctx.fillStyle = '#ff8bc8';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff63b0';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(a) * 10,
            Math.sin(a) * 10
          );
          ctx.stroke();
        }
        ctx.fillStyle = '#b68a20';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 접힌 우산
      else {
        ctx.save();
        ctx.translate(0, -20);
        ctx.fillStyle = '#ff8bc8';
        ctx.beginPath();
        ctx.moveTo(-4, -14);
        ctx.lineTo(4, -14);
        ctx.lineTo(7, 12);
        ctx.lineTo(-7, 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(-1, 12, 2, 12);
        ctx.restore();
      }
    }
    // =========================
    // 몸통
    // =========================
    const yOff = this.flying ? -12 : 0;
    ctx.fillStyle = '#4fd8ff';
    ctx.fillRect(-18, -15 + yOff, 36, 30);
    // 얼굴
    ctx.fillStyle = '#efff00';
    ctx.beginPath();
    ctx.ellipse(
      0,
      8 + yOff,
      18,
      13,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // 코
    ctx.fillStyle = '#f6f4d5';
    ctx.beginPath();
    ctx.arc(
      0,
      9 + yOff,
      7,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(
      -7,
      -9 + yOff,
      6,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      7,
      -9 + yOff,
      6,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // 눈동자
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(
      -7,
      -10 + yOff,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      7,
      -10 + yOff,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // 눈썹
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-2, -20 + yOff);
    ctx.lineTo(6, -21 + yOff);
    ctx.stroke();
    // 똥머리
    ctx.fillStyle = '#f2d94c';
    ctx.beginPath();
    ctx.arc(
      0,
      -28 + yOff,
      6,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // 팀 테두리
    ctx.strokeStyle =
      this.team === 'A'
        ? '#00ffee'
        : '#ffaa00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      -22,
      -18 + yOff,
      44,
      36
    );
    // =========================
    // 궁극기 우산 (몸 앞)
    // =========================
    if (this.flying) {
      ctx.save();
      ctx.translate(10, -5);
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff8bc8';
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        28,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.strokeStyle = '#ff63b0';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(a) * 18,
          Math.sin(a) * 18
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#b68a20';
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }
}