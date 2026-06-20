import { isWall, breakWall, breakWallsInRadius, breakWallsAlongLine, COLS, ROWS } from './map.js';
import { MAP_W, MAP_H, TILE } from './constants.js';

export class Bullet {
  constructor({ x,y,angle,speed=480,damage,radius,color,pierce,team,owner,maxRange,wallBreak=false }) {
    this.x=x; this.y=y; this.startX=x; this.startY=y;
    this.angle=angle; this.speed=speed; this.damage=damage;
    this.radius=radius; this.color=color; this.pierce=pierce;
    this.team=team; this.owner=owner;
    this.maxRange=maxRange||99999; this.wallBreak=wallBreak;
    this.dead=false; this.hitTargets=new Set();
  }
  get traveledDist() { return Math.hypot(this.x-this.startX,this.y-this.startY); }
 update(dt, units) {
  if (this.dead) return;

  // 사거리 체크
  if (this.traveledDist >= this.maxRange) {
    this.dead = true;
    return;
  }

  // 이동
  this.x += Math.cos(this.angle) * this.speed * dt;
  this.y += Math.sin(this.angle) * this.speed * dt;

  // 맵 밖
  if (
    this.x < 0 ||
    this.x > MAP_W ||
    this.y < 0 ||
    this.y > MAP_H
  ) {
    this.dead = true;
    return;
  }

  // 벽 충돌
  if (isWall(this.x, this.y)) {
    if (this.wallBreak) {
      breakWall(this.x, this.y);
    } else {
      this.dead = true;
      return;
    }
  }

  // 유닛 충돌
  for (const u of units) {
    if (
      u.dead ||
      u.team === this.team ||
      this.hitTargets.has(u)
    ) {
      continue;
    }

    // 에이프릴 우산
    if (!u.dead && u.umbrella) {
      if (u.umbrella.blocksAttack(this.x, this.y)) {
        u.umbrella.takeDamage(this.damage);
        this.hitTargets.add(u);

        if (!this.pierce) {
          this.dead = true;
          return;
        }
        continue;
      }
    }

    // 본체 충돌
    if (
      Math.hypot(
        u.x - this.x,
        u.y - this.y
      ) < this.radius + u.radius
    ) {
      u.takeDamage(this.damage, this.owner);
      this.hitTargets.add(u);

      if (!this.pierce) {
        this.dead = true;
        return;
      }
    }
  }
 }
  
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const sx=this.x-camX,sy=this.y-camY;
    ctx.save();
    ctx.shadowColor=this.color; ctx.shadowBlur=10;
    ctx.fillStyle=this.color;
    ctx.beginPath(); ctx.arc(sx,sy,this.radius,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// 에이프릴 2연발 총알 (색상 번갈아)
export class AprilBullet extends Bullet {
  constructor(opts, colorAlt=false) {
    super(opts);
    this.colorAlt=colorAlt;
  }
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const sx=this.x-camX,sy=this.y-camY;
    ctx.save();
    // 핑크+하늘색 혼합 특수 총알
    const c1=this.colorAlt?'#00ccff':'#ff66bb';
    const c2=this.colorAlt?'#88eeff':'#f8aaff';
    ctx.shadowColor=c1; ctx.shadowBlur=12;
    ctx.fillStyle=c1;
    ctx.beginPath(); ctx.arc(sx,sy,this.radius,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=c2;
    ctx.beginPath(); ctx.arc(sx,sy,this.radius*0.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

export class Laser {
  constructor({ owner,target,damage,duration,team }) {
    this.owner=owner; this.target=target;
    this.damage=damage; this.duration=duration;
    this.team=team; this.dead=false;
    this.elapsed=0; this.tickTimer=0;
    this.beamX=owner.x; this.beamY=owner.y;
    this.followSpeed=420;
  }
  update(dt,units) {
    if (this.dead) return;
    this.elapsed+=dt;
    if (this.elapsed>=this.duration||this.target.dead){this.dead=true;return;}
    const dx=this.target.x-this.beamX, dy=this.target.y-this.beamY;
    const dist=Math.hypot(dx,dy);
    if (dist>0) {
      const move=Math.min(dist,this.followSpeed*dt);
      this.beamX+=dx/dist*move; this.beamY+=dy/dist*move;
    }
    this.tickTimer+=dt;
    if (this.tickTimer>=0.1) {
      this.tickTimer-=0.1;
      const hitDist=Math.hypot(this.target.x-this.beamX,this.target.y-this.beamY);
      if (hitDist<28) this.target.takeDamage(this.damage,this.owner);
    }
  }
  draw(ctx,camX,camY) {
    if (this.dead||this.target.dead) return;
    const ox=this.owner.x-camX,oy=this.owner.y-camY;
    const tx=this.beamX-camX,ty=this.beamY-camY;
    ctx.save();
    ctx.strokeStyle='#44bbff'; ctx.lineWidth=8;
    ctx.shadowColor='#88ddff'; ctx.shadowBlur=18; ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(tx,ty); ctx.stroke();
    ctx.restore();
  }
}

// 캐논 충격파 (벽 파괴 포함)
export class Shockwave {
  constructor({ x,y,radius,team,owner,wallBreak=false }) {
    this.x=x; this.y=y; this.radius=radius;
    this.team=team; this.owner=owner; this.wallBreak=wallBreak;
    this.dead=false; this.elapsed=0; this.duration=0.35; this.done=false;
  }
  update(dt,units) {
    if (this.dead) return;
    this.elapsed+=dt;
    if (!this.done) {
      if (this.wallBreak) breakWallsInRadius(this.x,this.y,this.radius*0.6);
      for (const u of units) {
        if (u.dead||u.team===this.team) continue;
        const dx=u.x-this.x,dy=u.y-this.y,dist=Math.hypot(dx,dy);
        if (dist<this.radius+u.radius) {
          const nx=dist>0?dx/dist:1,ny=dist>0?dy/dist:0;
          u.x+=nx*this.owner.def.ult.knockback; u.y+=ny*this.owner.def.ult.knockback;
          u.clampToMap();
        }
      }
      this.done=true;
    }
    if (this.elapsed>=this.duration) this.dead=true;
  }
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const sx=this.x-camX,sy=this.y-camY,prog=this.elapsed/this.duration;
    ctx.save(); ctx.globalAlpha=1-prog;
    ctx.strokeStyle='#ffffaa'; ctx.lineWidth=6;
    ctx.shadowColor='#ffff44'; ctx.shadowBlur=18;
    ctx.beginPath(); ctx.arc(sx,sy,this.radius*prog,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

// 타이탄 지진 (벽 파괴 포함)
export class QuakeCone {
  constructor({ x,y,angle,range,coneAngle,team,owner,damage,knockback,stunDuration,wallBreak=false }) {
    this.x=x; this.y=y; this.angle=angle;
    this.range=range; this.coneAngle=coneAngle*Math.PI/180;
    this.team=team; this.owner=owner;
    this.damage=damage; this.knockback=knockback; this.stunDuration=stunDuration;
    this.wallBreak=wallBreak;
    this.dead=false; this.elapsed=0; this.duration=0.45; this.done=false;
  }
  inCone(tx,ty) {
    const dx=tx-this.x,dy=ty-this.y;
    if (Math.hypot(dx,dy)>this.range) return false;
    let diff=Math.atan2(dy,dx)-this.angle;
    while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
    return Math.abs(diff)<=this.coneAngle/2;
  }
  update(dt,units) {
    if (this.dead) return;
    this.elapsed+=dt;
    if (!this.done) {
      if (this.wallBreak) {
        // 부채꼴 방향으로 벽 파괴
        for (let a=this.angle-this.coneAngle/2; a<=this.angle+this.coneAngle/2; a+=0.2) {
          for (let d=TILE; d<=this.range; d+=TILE) {
            breakWall(this.x+Math.cos(a)*d, this.y+Math.sin(a)*d);
          }
        }
      }
      for (const u of units) {
        if (u.dead||u.team===this.team) continue;
        if (this.inCone(u.x,u.y)) {
          u.takeDamage(this.damage,this.owner);
          const dx=u.x-this.x,dy=u.y-this.y,dist=Math.hypot(dx,dy)||1;
          u.x+=(dx/dist)*this.knockback; u.y+=(dy/dist)*this.knockback;
          u.clampToMap(); u.stun(this.stunDuration);
        }
      }
      this.done=true;
    }
    if (this.elapsed>=this.duration) this.dead=true;
  }
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const sx=this.x-camX,sy=this.y-camY;
    const prog=Math.min(this.elapsed/this.duration*2.5,1);
    ctx.save(); ctx.globalAlpha=(1-prog)*0.6; ctx.fillStyle='#ff8800';
    ctx.shadowColor='#ffaa00'; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(sx,sy);
    ctx.arc(sx,sy,this.range*prog,this.angle-this.coneAngle/2,this.angle+this.coneAngle/2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#cc5500'; ctx.lineWidth=3; ctx.globalAlpha=(1-prog)*0.9;
    for (let i=0;i<4;i++) {
      const a=this.angle+(i-1.5)*(this.coneAngle/4);
      ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(a)*this.range*prog,sy+Math.sin(a)*this.range*prog);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class FlameCone {
  constructor({ x,y,angle,range,coneAngle,team,owner,damage }) {
    this.x=x; this.y=y; this.angle=angle;
    this.range=range; this.coneAngle=coneAngle*Math.PI/180;
    this.team=team; this.owner=owner; this.damage=damage;
    this.dead=false; this.elapsed=0; this.duration=1.1; this.tickTimer=0;
  }
  inCone(tx,ty) {
    const dx=tx-this.x,dy=ty-this.y;
    if (Math.hypot(dx,dy)>this.range) return false;
    let diff=Math.atan2(dy,dx)-this.angle;
    while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
    return Math.abs(diff)<=this.coneAngle/2;
  }
  update(dt,units) {
    if (this.dead) return;
    this.elapsed+=dt;
    this.x=this.owner.x; this.y=this.owner.y; this.angle=this.owner.facing;
    this.tickTimer+=dt;
    while (this.tickTimer>=0.1) {
      this.tickTimer-=0.1;
      for (const u of units) {
        if (u.dead||u.team===this.team) continue;
        if (this.inCone(u.x,u.y)) u.takeDamage(this.damage,this.owner);
      }
    }
    if (this.elapsed>=this.duration) this.dead=true;
  }
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const sx=this.x-camX,sy=this.y-camY,prog=this.elapsed/this.duration;
    ctx.save(); ctx.globalAlpha=(1-prog)*0.8;
    const grad=ctx.createRadialGradient(sx,sy,0,sx,sy,this.range);
    grad.addColorStop(0,'rgba(255,255,100,0.95)');
    grad.addColorStop(0.45,'rgba(255,140,0,0.8)');
    grad.addColorStop(1,'rgba(200,30,0,0)');
    ctx.fillStyle=grad; ctx.shadowColor='#ff6600'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.moveTo(sx,sy);
    ctx.arc(sx,sy,this.range,this.angle-this.coneAngle/2,this.angle+this.coneAngle/2);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

// 블랙 발도 대시 이펙트
export class BlackDash {
  constructor({ x,y,angle,range,team,owner,damage,isUlt=false }) {
    this.startX=x; this.startY=y; this.angle=angle;
    this.range=range; this.team=team; this.owner=owner;
    this.damage=damage; this.isUlt=isUlt;
    this.dead=false; this.elapsed=0;
    this.duration=isUlt?0.12:0.1;
    this.hitTargets=new Set();
    this.trailPoints=[];
  }
  update(dt,units) {
    if (this.dead) return;
    this.elapsed+=dt;
    const prog=Math.min(this.elapsed/this.duration,1);
    // 경로상의 적 히트
    for (const u of units) {
      if (u.dead||u.team===this.team||this.hitTargets.has(u)) continue;
      // 선분과 유닛의 거리 체크
      const tx=this.startX, ty=this.startY;
      const ex=this.startX+Math.cos(this.angle)*this.range;
      const ey=this.startY+Math.sin(this.angle)*this.range;
      const dx=ex-tx,dy=ey-ty,len=Math.hypot(dx,dy)||1;
      const t2=Math.max(0,Math.min(1,((u.x-tx)*dx+(u.y-ty)*dy)/(len*len)));
      const closestX=tx+t2*dx, closestY=ty+t2*dy;
      if (Math.hypot(u.x-closestX,u.y-closestY)<u.radius+14) {
        u.takeDamage(this.damage,this.owner);
        this.hitTargets.add(u);
      }
    }
    if (this.elapsed>=this.duration) this.dead=true;
  }
  draw(ctx,camX,camY) {
    if (this.dead) return;
    const prog=this.elapsed/this.duration;
    const sx=this.startX-camX, sy=this.startY-camY;
    const ex=sx+Math.cos(this.angle)*this.range;
    const ey=sy+Math.sin(this.angle)*this.range;
    ctx.save();
    ctx.globalAlpha=(1-prog)*0.8;
    ctx.strokeStyle=this.isUlt?'#ffffff':'#aaaaff';
    ctx.lineWidth=this.isUlt?8:5;
    ctx.shadowColor='#ffffff'; ctx.shadowBlur=15;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.restore();
  }
}