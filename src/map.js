import { MAP_W, MAP_H, TILE } from './constants.js';

export const COLS = MAP_W / TILE;
export const ROWS = MAP_H / TILE;

// 타일 타입
// 0=빈땅, 1=벽, 2=가시덤불(감속), 3=물웅덩이(감속+시야감소), 4=황금블록(장식)
export let grid = [];
export let specialTiles = []; // {r,c,type}

export function generateMap() {
  grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  specialTiles = [];

  // 테두리 벽
  for (let c = 0; c < COLS; c++) { grid[0][c] = 1; grid[ROWS-1][c] = 1; }
  for (let r = 0; r < ROWS; r++) { grid[r][0] = 1; grid[r][COLS-1] = 1; }

  // 랜덤 벽 클러스터
  for (let i = 0; i < 80; i++) {
    const ww = 2 + Math.floor(Math.random() * 5);
    const hh = 2 + Math.floor(Math.random() * 5);
    const cc = 2 + Math.floor(Math.random() * (COLS - ww - 4));
    const rr = 2 + Math.floor(Math.random() * (ROWS - hh - 4));
    const cx = cc + ww/2, cy = rr + hh/2;
    const midC = COLS/2, midR = ROWS/2;
    if (Math.abs(cx-midC)<6 && Math.abs(cy-midR)<6) continue;
    if (Math.abs(cx-5)<5 && Math.abs(cy-5)<5) continue;
    if (Math.abs(cx-(COLS-5))<5 && Math.abs(cy-(ROWS-5))<5) continue;
    for (let dr=0; dr<hh; dr++)
      for (let dc=0; dc<ww; dc++)
        grid[rr+dr][cc+dc] = 1;
  }

  ensureConnectivity();

  // 특수 타일 배치 (벽 아닌 곳 중 랜덤)
  placeSpecialTiles();
}

function placeSpecialTiles() {
  const openCells = [];
  for (let r=2; r<ROWS-2; r++)
    for (let c=2; c<COLS-2; c++)
      if (grid[r][c] === 0) openCells.push([r,c]);
  
  // 셔플
  for (let i=openCells.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [openCells[i],openCells[j]] = [openCells[j],openCells[i]];
  }

  let placed = 0;
  // 가시덤불 (25개)
  for (let i=0; i<Math.min(25, openCells.length) && placed<25; i++) {
    const [r,c] = openCells[i];
    // 스폰 근처 제외
    if ((r<8&&c<8)||(r>ROWS-9&&c>COLS-9)) continue;
    grid[r][c] = 2;
    specialTiles.push({r,c,type:2});
    placed++;
  }
  placed = 0;
  // 물웅덩이 (15개)
  for (let i=25; i<openCells.length && placed<15; i++) {
    const [r,c] = openCells[i];
    if ((r<8&&c<8)||(r>ROWS-9&&c>COLS-9)) continue;
    // 2x2로
    if (r+1<ROWS-1 && c+1<COLS-1 && grid[r][c]===0 && grid[r+1][c]===0 && grid[r][c+1]===0 && grid[r+1][c+1]===0) {
      grid[r][c]=3; grid[r+1][c]=3; grid[r][c+1]=3; grid[r+1][c+1]=3;
      specialTiles.push({r,c,type:3},{r:r+1,c,type:3},{r,c:c+1,type:3},{r:r+1,c:c+1,type:3});
      placed++;
    }
  }
  placed = 0;
  // 황금블록 (장식, 8개, 벽이 될 수도 있음)
  for (let i=40; i<openCells.length && placed<8; i++) {
    const [r,c] = openCells[i];
    if ((r<10&&c<10)||(r>ROWS-11&&c>COLS-11)) continue;
    grid[r][c] = 4;
    specialTiles.push({r,c,type:4});
    placed++;
  }
}

function ensureConnectivity() {
  const visited = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const queue = [[Math.floor(ROWS/2), Math.floor(COLS/2)]];
  if (grid[queue[0][0]][queue[0][1]]===1) grid[queue[0][0]][queue[0][1]]=0;
  visited[queue[0][0]][queue[0][1]] = true;
  while (queue.length) {
    const [r,c] = queue.shift();
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr=r+dr, nc=c+dc;
      if (nr<0||nr>=ROWS||nc<0||nc>=COLS||visited[nr][nc]) continue;
      visited[nr][nc] = true;
      if (grid[nr][nc]===0) queue.push([nr,nc]);
    }
  }
  for (let r=1; r<ROWS-1; r++)
    for (let c=1; c<COLS-1; c++)
      if (grid[r][c]===0 && !visited[r][c]) grid[r][c]=1;
}

export function isWall(worldX, worldY) {
  const c = Math.floor(worldX/TILE), r = Math.floor(worldY/TILE);
  if (r<0||r>=ROWS||c<0||c>=COLS) return true;
  return grid[r][c]===1 || grid[r][c]===4;
}

export function isWallTile(r, c) {
  if (r<0||r>=ROWS||c<0||c>=COLS) return true;
  return grid[r][c]===1 || grid[r][c]===4;
}

export function getTileEffect(worldX, worldY) {
  const c = Math.floor(worldX/TILE), r = Math.floor(worldY/TILE);
  if (r<0||r>=ROWS||c<0||c>=COLS) return 0;
  return grid[r][c]; // 2=가시, 3=물
}

// 벽 파괴 (타일 좌표)
export function breakWall(worldX, worldY) {
  const c = Math.floor(worldX/TILE), r = Math.floor(worldY/TILE);
  if (r<0||r>=ROWS||c<0||c>=COLS) return false;
  if (r===0||r===ROWS-1||c===0||c===COLS-1) return false; // 테두리는 못 부숨
  if (grid[r][c]===1) { grid[r][c]=0; return true; }
  return false;
}

// 범위 내 벽 파괴
export function breakWallsInRadius(worldX, worldY, radius) {
  const r0=Math.floor((worldY-radius)/TILE), r1=Math.floor((worldY+radius)/TILE);
  const c0=Math.floor((worldX-radius)/TILE), c1=Math.floor((worldX+radius)/TILE);
  for (let r=r0; r<=r1; r++) {
    for (let c=c0; c<=c1; c++) {
      const wx=c*TILE+TILE/2, wy=r*TILE+TILE/2;
      if (Math.hypot(wx-worldX, wy-worldY)<radius) breakWall(wx,wy);
    }
  }
}

// 직선 경로 벽 파괴
export function breakWallsAlongLine(x1,y1,angle,dist) {
  const steps = Math.ceil(dist/TILE*2);
  for (let i=0; i<=steps; i++) {
    const t=i/steps;
    const wx=x1+Math.cos(angle)*dist*t;
    const wy=y1+Math.sin(angle)*dist*t;
    breakWall(wx,wy);
  }
}

export function worldToTile(worldX, worldY) {
  return [Math.floor(worldX/TILE), Math.floor(worldY/TILE)];
}
export function tileToWorld(c, r) {
  return [c*TILE+TILE/2, r*TILE+TILE/2];
}

// A* 경로탐색
export function findPath(wx1,wy1,wx2,wy2) {
  const [sc,sr]=worldToTile(wx1,wy1), [ec,er]=worldToTile(wx2,wy2);
  if (isWallTile(sr,sc)||isWallTile(er,ec)) return null;
  if (sc===ec&&sr===er) return [];
  const key=(r,c)=>r*COLS+c;
  const open=new Map(), closed=new Set(), g=new Map(), parent=new Map();
  const h=(r,c)=>Math.abs(r-er)+Math.abs(c-ec);
  g.set(key(sr,sc),0); open.set(key(sr,sc),h(sr,sc));
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  let iter=0;
  while (open.size>0&&iter++<2000) {
    let bestKey=null,bestF=Infinity;
    for (const [k,f] of open) if(f<bestF){bestF=f;bestKey=k;}
    const curR=Math.floor(bestKey/COLS),curC=bestKey%COLS;
    if (curR===er&&curC===ec) {
      const path=[]; let k=bestKey;
      while (parent.has(k)) {
        const r2=Math.floor(k/COLS),c2=k%COLS;
        path.unshift(tileToWorld(c2,r2)); k=key(...parent.get(k));
      }
      return path;
    }
    open.delete(bestKey); closed.add(bestKey);
    for (const [dr,dc] of dirs) {
      const nr=curR+dr,nc=curC+dc;
      if (isWallTile(nr,nc)) continue;
      if (dr!==0&&dc!==0&&(isWallTile(curR+dr,curC)||isWallTile(curR,curC+dc))) continue;
      const nk=key(nr,nc);
      if (closed.has(nk)) continue;
      const cost=dr!==0&&dc!==0?1.414:1;
      const ng=(g.get(bestKey)||0)+cost;
      if (!g.has(nk)||ng<g.get(nk)) {
        g.set(nk,ng); parent.set(nk,[curR,curC]); open.set(nk,ng+h(nr,nc));
      }
    }
  }
  return null;
}

// 맵 렌더
export function drawMap(ctx, camX, camY, canvasW, canvasH) {
  ctx.fillStyle='#2d5a1b';
  ctx.fillRect(0,0,canvasW,canvasH);
  const startC=Math.max(0,Math.floor(camX/TILE));
  const startR=Math.max(0,Math.floor(camY/TILE));
  const endC=Math.min(COLS,Math.ceil((camX+canvasW)/TILE));
  const endR=Math.min(ROWS,Math.ceil((camY+canvasH)/TILE));
  for (let r=startR;r<endR;r++) {
    for (let c=startC;c<endC;c++) {
      const sx=c*TILE-camX, sy=r*TILE-camY;
      const t=grid[r][c];
      if (t===1) {
        // 벽: 돌 질감
        ctx.fillStyle='#5a4a3a'; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(sx+2,sy+2,TILE-4,6);
        ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,TILE,TILE);
      } else if (t===2) {
        // 가시덤불
        ctx.fillStyle='#1a4010'; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle='#2d7a1a';
        for (let i=0;i<5;i++) {
          const bx=sx+4+i*7,by=sy+TILE/2;
          ctx.beginPath();ctx.arc(bx,by-6,4,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#d44'; ctx.beginPath();ctx.arc(bx,by-6,2,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#2d7a1a';
        }
      } else if (t===3) {
        // 물웅덩이
        const wave=Math.sin(Date.now()*0.002+r*0.5+c*0.5)*2;
        ctx.fillStyle=`rgba(20,80,180,0.75)`; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle=`rgba(60,160,255,0.3)`;
        ctx.fillRect(sx,sy+10+wave,TILE,4);
        ctx.fillRect(sx,sy+22+wave,TILE,3);
      } else if (t===4) {
        // 황금블록 (통과 불가 장식)
        ctx.fillStyle='#b8860b'; ctx.fillRect(sx,sy,TILE,TILE);
        ctx.fillStyle='#ffd700'; ctx.fillRect(sx+3,sy+3,TILE-6,TILE-6);
        ctx.fillStyle='#b8860b';
        ctx.fillRect(sx+10,sy+10,TILE-20,TILE-20);
        ctx.strokeStyle='#8B6914'; ctx.lineWidth=1; ctx.strokeRect(sx,sy,TILE,TILE);
      } else {
        // 일반 바닥 (살짝 패턴)
        ctx.fillStyle=(r+c)%2===0?'#2e5f1e':'#2a581a';
        ctx.fillRect(sx,sy,TILE,TILE);
      }
    }
  }
}