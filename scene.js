/* All art is generated at game resolution. X and Y lie on the ground; Z points up. */
(() => {
  'use strict';

  const PITCH = 28;
  const SQUASH = 0.58;
  const ANGLES = 72;
  const TAU = 2 * Math.PI;
  const GROUND_SIZE = 204;
  const ORIGIN = GROUND_SIZE / 2;
  const CLIFF = 20;
  const makeCanvas = (w, h = w) => Object.assign(document.createElement('canvas'), {width: w, height: h});
  const frameIndex = angle => ((Math.round(angle * ANGLES / TAU) % ANGLES) + ANGLES) % ANGLES;
  const turnAngle = angle => frameIndex(angle) * TAU / ANGLES;
  const nearest = (x, y, color, ctx) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const hash = (x, y) => {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  function rng(seed) {
    let s = seed;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function shore(x, y) {
    const u = x - 40;
    const v = y - 43;
    const a = Math.atan2(v, u);
    return (Math.hypot(u / 31, (v + u * 0.13) / 24) - 1) * 24
      + 1.7 * Math.sin(a * 3 + 0.8) + 1.2 * Math.cos(a * 5) + 0.6 * Math.sin(a * 9);
  }

  function pathCenter(y) { return -28 + Math.sin((y + 14) / 22) * 3.7 + Math.max(0, y - 60) * 0.16; }
  function pathDistance(x, y) {
    if (y < -25) return 100;
    return Math.abs(x - pathCenter(y)) - (7.7 + 1.2 * Math.sin(y / 12) + 0.5 * Math.cos(y / 3.2));
  }

  function turfDistance(x, y) {
    const a = Math.abs(x), b = Math.abs(y);
    return Math.min(94 - a, 94 - b, (162 - a - b) * 0.707)
      + Math.sin(x * 0.19 + y * 0.11) * 1.25 + Math.sin(x * 0.048 - y * 0.094) * 1.6;
  }

  function groundColor(x, y, edge, pond, path) {
    const grain = hash(x >> 1, y >> 1);
    const patch = 0.46 * Math.sin(x / 12 + Math.sin(y / 17)) + 0.30 * Math.cos(y / 8 + x / 21)
      + 0.24 * Math.sin(x / 25 - y / 13) + (grain - 0.5) * 0.1;
    if (pond < -3.4) {
      if (pond > -5) return '#8bc8af';
      if (pond < -12 + 1.6 * Math.sin(x / 4 + y / 11)) return patch > 0 ? '#5ba9aa' : '#62b1af';
      return patch > -0.2 ? '#72bcb0' : '#7ac2b2';
    }
    if (pond < -1.5) return '#b4d4ac';
    if (pond < 0) return '#788e76';
    if (pond < 1.9) return '#c1c187';
    if (path < -1) return patch > 0.45 ? '#d4c18d' : (patch < -0.35 ? '#c2aa77' : '#cbb781');
    if (path < 0.6) return '#b7ad73';
    if (edge < 1.3) return '#859150';
    if (edge < 2.5) return '#a7b66b';
    if (patch > 0.47) return '#b5c77a';
    if (patch > 0.09) return '#adbf72';
    if (patch > -0.37) return '#a5b96d';
    if (patch > -0.74) return '#9db368';
    return '#96ac65';
  }

  const soil = [
    ['#7a684d','#8b7252','#705e4b','#957c58','#655b4c'],
    ['#9e7b54','#ad895f','#8d704f','#b39467','#846945'],
    ['#af885a','#bd9769','#a17c55','#c5a375','#94704d']
  ];
  function sideColor(x, y, z, dist) {
    const ax = Math.abs(x), ay = Math.abs(y);
    const face = ax > ay + 6 ? x : y;
    const stripe = ax > ay + 6 ? y : x;
    const set = soil[face > 0 ? (ax > ay + 6 ? 1 : 2) : 0];
    const level = z + 20;
    const lip = (Math.sin(stripe * .27) + Math.sin(stripe * .62)) * 1.15;
    if (z > -3.2 + lip * 0.45) return z === -1 ? '#98a765' : '#839950';
    if (z > -5.2 + lip) return face > 0 ? '#819452' : '#6b8148';
    if (level < 2) return set[4];
    // Small stones are embedded in the cut bank. Each occupies multiple slices.
    for (let row = 0; row < 2; row++) {
      const i = Math.floor((stripe + row * 7 + 200) / 14);
      const u = (stripe + row * 7 + 200) - i * 14;
      const k = hash(i, row + (face > 0 ? 13 : 32));
      const dx = Math.abs(u - (4 + k * 6)) / (2.5 + k * 2.7);
      const dz = (level - (4 + row * 6 + (k - .5) * 4)) / (1.4 + k * 1.4);
      if (k > .22 && dx + Math.abs(dz) * 0.74 < 1.18)
        return dz > 0.25 ? set[3] : (dz < -.40 ? set[4] : set[1]);
    }
    const root = hash((stripe + 200) >> 1, 67);
    if (root > .945 && z > -9 - root * 2) return set[4];
    return dist < 2 && Math.sin(stripe / 6) * 1.6 + level < 4.5 ? set[2] : set[0];
  }

  const rgbCache = new Map();
  function rgb(hex) {
    if (!rgbCache.has(hex)) {
      const n = parseInt(hex.slice(1), 16);
      rgbCache.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    }
    return rgbCache.get(hex);
  }
  function pixel(data, off, hex) {
    const c = rgb(hex);
    data[off] = c[0]; data[off + 1] = c[1]; data[off + 2] = c[2]; data[off + 3] = 255;
  }

  function makeGround() {
    const slices = [], coords = [];
    for (let j = 0; j < GROUND_SIZE; j++) for (let i = 0; i < GROUND_SIZE; i++) {
      const x = i - ORIGIN, y = j - ORIGIN, edge = turfDistance(x, y);
      if (edge < 0) continue;
      coords.push({i, j, x, y, edge, off: (j * GROUND_SIZE + i) * 4});
    }
    for (let z = -CLIFF; z <= 0; z++) {
      const layer = makeCanvas(GROUND_SIZE), ctx = layer.getContext('2d');
      const img = ctx.createImageData(GROUND_SIZE, GROUND_SIZE);
      const inset = z >= -3 ? 0 : Math.pow((-z - 3) / (CLIFF - 3), 1.35) * 7.2;
      for (const p of coords) {
        if (p.edge < inset) continue;
        // On a solid shelf only the side wall and the upper surface can be seen.
        if (z < 0 && p.edge > inset + 7 && z > -CLIFF) continue;
        const col = z === 0 ? groundColor(p.x, p.y, p.edge, shore(p.x, p.y), pathDistance(p.x, p.y))
          : sideColor(p.x, p.y, z, p.edge - inset);
        pixel(img.data, p.off, col);
      }
      ctx.putImageData(img, 0, 0);
      slices.push(layer);
    }
    paintGroundDetail(slices[slices.length - 1].getContext('2d'));
    return {size: GROUND_SIZE, slices, pivotX: ORIGIN, pivotY: ORIGIN};
  }

  function paintGroundDetail(ctx) {
    const r = rng(17089);
    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x),Math.round(y),w,h); };
    ctx.save(); ctx.translate(ORIGIN, ORIGIN);
    for (let k = 0; k < 715; k++) {
      const x = Math.round((r()-.5)*190), y = Math.round((r()-.5)*190);
      if (turfDistance(x,y) < 2) continue;
      const path = pathDistance(x,y), pond = shore(x,y);
      if (pond < 2) continue;
      if (path < 0) {
        rect(x,y,1 + Math.floor(r()*2),1,r() > .56 ? '#b69b6e':'#dfcc99');
        continue;
      }
      const dark = r() < .75 ? '#90a561' : '#849b5c';
      if (r() < .38) {
        rect(x,y,2,1,dark); rect(x+1,y-1,1,1,'#a4b76a'); rect(x+2,y,2,1,'#bfcc83');
      } else {
        rect(x,y,1,1,dark); rect(x-1,y-1,1,1,'#b9c981');
        if (r()>.5) rect(x+1,y-1,1,1,'#a1b069');
      }
    }
    // Flagstones turn as part of the ground texture; their scuffed tops stay aligned.
    let i = 0;
    for (let y = -8; y < 96; y += 9 + Math.round(r()*2)) {
      const x = Math.round(pathCenter(y) + Math.sin(++i * 1.9)*2);
      const w = 4 + Math.floor(r()*3), h = 2 + Math.floor(r()*2);
      rect(x-w+1,y-1,w*2-1,h+2,'#a79c77'); rect(x-w,y,w*2+1,h,'#a79c77');
      rect(x-w+1,y-1,w*2-2,h+1,'#c4bc99'); rect(x-w+2,y-2,w*2-4,2,'#d5cfad');
      if (i%3===0) rect(x+1,y,2,1,'#b2aa8b');
    }
    // Broken bands and tiny points in the water, grouped to leave quiet areas.
    for (let k=0;k<55;k++) {
      const x=Math.round(8+r()*65), y=Math.round(17+r()*52);
      if(shore(x,y)>-5) continue;
      rect(x,y,2+Math.floor(r()*4),1,r()>.5?'#96d0bd':'#82c3b9');
    }
    const lilies = [[23,40],[25,42],[52,31],[54,34],[54,48],[18,51],[31,60]];
    for (const [x,y] of lilies) {
      if(shore(x,y)>-3) continue;
      rect(x-2,y,5,2,'#5e977b'); rect(x-1,y-1,4,2,'#91b873');
      rect(x,y-1,2,1,'#c3ce89'); rect(x+1,y,1,1,'#76b8ad');
    }
    rect(24,39,2,1,'#f6dfc5');rect(53,30,2,1,'#e9b6ae');
    // A scattering of very small meadow blossoms at the edges.
    for(const [cx,cy] of [[-68,7],[-49,48],[3,-58],[64,-35],[-73,-52],[-8,67],[64,61],[53,-6],[-40,78]]) {
      for(let f=0;f<6;f++) {
        const x=cx+Math.round((r()-.5)*12), y=cy+Math.round((r()-.5)*9);
        if(turfDistance(x,y)<4 || shore(x,y)<2 || pathDistance(x,y)<1) continue;
        rect(x,y,1,2,'#789352'); rect(x-1,y-1,3,1, r()>.23?'#e8dc9d':'#dbaa82');
        rect(x,y-2,1,2,'#f1e7bc');
      }
    }
    ctx.restore();
  }

  function layersOf(size, height, paint) {
    const slices = [];
    for(let z=0;z<height;z++) {
      const c=makeCanvas(size), ctx=c.getContext('2d');
      const rect=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.floor(size/2)+x,Math.floor(size/2)+y,w,h);};
      paint(z,rect);
      slices.push(c);
    }
    return {size,pivotX:Math.floor(size/2),pivotY:Math.floor(size/2),slices};
  }
  function staticModels() {
    const fence = layersOf(31,11,(z,rect)=>{
      if(z===4||z===8) {rect(-13,-1,26,2,'#99794c');rect(-13,0,26,1,'#b39461');}
      if(z===5||z===9) rect(-13,-1,26,2,'#d0ae72');
      rect(-14,-2,4,4,z===10?'#dcc08c':'#96744a');
      rect(-14,0,4,2,z===10?'#e8ce98':'#b28b57');
    });
    const post = layersOf(7,11,(z,rect)=>{
      rect(-2,-2,4,4,z===10?'#ddc18d':'#94734b');rect(-2,0,4,2,z===10?'#e5c995':'#af8958');
    });
    const dock = layersOf(24,5,(z,rect)=>{
      if(z<3) for(const x of [-5,5]) for(const y of [-8,7]) rect(x,y,2,2,'#806e4e');
      if(z===2) {rect(-5,-10,2,19,'#8a7451');rect(4,-10,2,19,'#8a7451');}
      if(z>=3) for(let p=0;p<5;p++) {
        const y=-10+p*4;
        rect(-7,y,15,3,z===3?'#a48052':(p%2?'#cfa773':'#c19d69'));
        if(z===4) {rect(-6,y,13,1,'#dcc08a');rect(p%2?2:-3,y+1,3,1,'#b38d60');rect(5,y+1,1,1,'#927b59');}
      }
    });
    const stones = layersOf(13,5,(z,rect)=>{
      if (z<3) {rect(-5,-2,9,5,z===0?'#748473':'#96a395');rect(-3,-4,5,8,'#9eab9b');}
      if(z===3) {rect(-4,-2,7,4,'#aebaab');rect(-3,-3,5,4,'#b6c0ad');}
      if(z===4) rect(-3,-2,4,2,'#ccd0b7');
    });
    const reeds = layersOf(12,8,(z,rect)=>{
      for(const [x,y,h] of [[-3,2,5],[0,-2,7],[2,1,6],[3,-1,4],[-1,1,3]]) {
        if(z>h) continue;
        rect(x+(z>3?Math.sign(x):0),y,1,z<3?2:1,z===h&&h>4?'#ad9263':(x<0?'#77945e':'#8fa561'));
      }
    });
    // The bluebird is faced along +X so its beak and fanned tail read in profile.
    const bird = layersOf(19,11,(z,rect)=>{
      if(z<2) {
        for(const y of [-1,1]) rect(0,y,z===0?3:1,1,'#9c7445');
      }
      if(z>=2 && z<=7) {
        const width=z===2||z===7?5:7;
        rect(-3,-1,width,3,z<5?'#e6d39c':'#517d99');
        if(z>2 && z<7) {
          rect(-3,-2,5,5,z===3?'#e4d8aa':'#4285af');
          rect(-3,1,4,2,z===4?'#2d668a':'#5da3c7');
          rect(-4,-2,4,2,'#386c95');
        }
      }
      if(z>=4 && z<=6) {
        const tip=z===6?-7:-6;
        rect(tip,-1,-tip-2,2,z===5?'#376485':'#5190b5');
      }
      if(z>=5 && z<=9) {
        const top=z===9;
        rect(1,top?-1:-2,top?3:4,top?3:5,top?'#69b2d2':z<7?'#efdfab':'#508eb7');
        if(z===8) {rect(4,1,1,1,'#283f48');rect(4,-2,1,1,'#283f48');}
        if(z===7) {rect(5,-1,3,2,'#a37b43');rect(5,0,3,1,'#e7b45b');}
      }
    });
    return {fence,post,dock,stones,reeds,bird};
  }

  const fixed = [
    {type:'fence',wx:0,wy:-84}, {type:'fence',wx:26,wy:-84}, {type:'fence',wx:52,wy:-84},
    {type:'post',wx:65,wy:-84},{type:'fence',wx:84,wy:-39,turn:Math.PI/2},
    {type:'fence',wx:84,wy:-13,turn:Math.PI/2},{type:'post',wx:84,wy:0},
    {type:'dock',wx:40,wy:67,turn:-.12},
    {type:'stones',wx:-75,wy:30},{type:'stones',wx:67,wy:8},{type:'stones',wx:-58,wy:-75},
    {type:'reeds',wx:14,wy:35},{type:'reeds',wx:17,wy:32},{type:'reeds',wx:57,wy:60},
    {type:'reeds',wx:59,wy:58},{type:'stones',wx:17,wy:54},
    {type:'bush',wx:-73,wy:-64},{type:'bush',wx:65,wy:-63,turn:1.8},
    {type:'rock',wx:-65,wy:67},{type:'mushroom',wx:-72,wy:58,turn:.6}
  ];
  let island, scenery;
  function project(x,y,angle) {
    const c=Math.cos(angle), s=Math.sin(angle);
    return {x:x*c-y*s, y:(x*s+y*c)*SQUASH};
  }

  function composite(model, angle) {
    const d=Math.ceil(model.size*1.45)+4;
    const head=model.slices.length-1;
    const tall=Math.ceil(d*SQUASH)+head+5;
    const out=makeCanvas(d,tall);
    const ctx=out.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=false;
    const px=Math.floor(d/2), py=Math.ceil(d*SQUASH/2)+head+1;
    const c=Math.cos(angle),s=Math.sin(angle);
    for(let z=0;z<model.slices.length;z++) {
      ctx.setTransform(c,s*SQUASH,-s,c*SQUASH,px,py-z);
      ctx.drawImage(model.slices[z],-model.pivotX,-model.pivotY);
    }
    return {canvas:out,px,py};
  }
  const byModel=new WeakMap();
  function cached(model, angle, limit=ANGLES) {
    let cache=byModel.get(model);
    if(!cache) {cache=new Map();byModel.set(model,cache);}
    const i=frameIndex(angle);
    if(!cache.has(i)) {
      if(cache.size>=limit) cache.delete(cache.keys().next().value);
      cache.set(i,composite(model,i*TAU/ANGLES));
    }
    return cache.get(i);
  }
  function stamp(ctx,bmp,x,y) {
    ctx.drawImage(bmp.canvas,Math.round(x)-bmp.px,Math.round(y)-bmp.py);
  }
  function modelFor(type) {
    return window.GardenModels?.get(type);
  }

  function ellipse(ctx,x,y,rx,ry,color) {
    ctx.fillStyle=color;
    for(let dy=-ry;dy<=ry;dy++) {
      const w=Math.round(rx*Math.sqrt(Math.max(0,1-(dy/(ry+.2))**2)));
      ctx.fillRect(Math.round(x)-w,Math.round(y)+dy,2*w+1,1);
    }
  }

  class GardenScene {
    constructor(canvas) {
      this.canvas=canvas;
      this.ctx=canvas.getContext('2d');
      island ||= makeGround();
      scenery ||= staticModels();
      this.setSize();
    }

    setSize() {
      const rect=this.canvas.getBoundingClientRect();
      const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
      const zoom=Math.min(w/261,h/201);
      const width=Math.max(1,Math.round(w/zoom)), height=Math.max(1,Math.round(h/zoom));
      if(this.canvas.width!==width) this.canvas.width=width;
      if(this.canvas.height!==height) this.canvas.height=height;
      this.ctx.imageSmoothingEnabled=false;
      this.cx=Math.round(width*.5);
      this.cy=Math.round(height*.495);
    }

    canPlant(x,y) {
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>6||y>6) return false;
      if((x===0||x===6)&&(y===0||y===6)) return false;
      if(x===2&&y>=3) return false;
      return !((x===4||x===5)&&(y===4||y===5));
    }

    point(clientX,clientY) {
      const b=this.canvas.getBoundingClientRect();
      return {x:(clientX-b.left)*this.canvas.width/(b.width||1)-this.cx,
        y:(clientY-b.top)*this.canvas.height/(b.height||1)-this.cy};
    }

    pick(clientX,clientY,angle=0) {
      const p=this.point(clientX,clientY), a=turnAngle(angle), c=Math.cos(a),s=Math.sin(a);
      const wx=p.x*c+p.y/SQUASH*s, wy=-p.x*s+p.y/SQUASH*c;
      if(turfDistance(wx,wy)<0) return null;
      const x=Math.round(wx/PITCH)+3, y=Math.round(wy/PITCH)+3;
      return x<0||x>6||y<0||y>6 ? null : {x,y};
    }

    pickObject(clientX,clientY,angle,objects) {
      const p=this.point(clientX,clientY),a=turnAngle(angle);
      const list=objects.map(o=>({o,p:project((o.x-3)*PITCH,(o.y-3)*PITCH,a)}))
        .sort((l,r)=>r.p.y-l.p.y);
      for(const item of list) {
        const m=modelFor(item.o.type);
        if(!m) continue;
        const bitmap=cached(m,a+(item.o.turn||0));
        const u=Math.floor(p.x)-Math.round(item.p.x)+bitmap.px, v=Math.floor(p.y)-Math.round(item.p.y)+bitmap.py;
        if(u<0||v<0||u>=bitmap.canvas.width||v>=bitmap.canvas.height) continue;
        if(bitmap.canvas.getContext('2d').getImageData(u,v,1,1).data[3]>64) return item.o;
      }
      return null;
    }

    icon(canvas,type) {
      const m=modelFor(type);
      if(!m) return;
      const bmp=cached(m,-.55);
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(!bmp.tight) {
        const {width:w,height:h}=bmp.canvas, data=bmp.canvas.getContext('2d').getImageData(0,0,w,h).data;
        let x0=w,y0=h,x1=0,y1=0;
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(data[(x+y*w)*4+3]>0) {
          x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
        }
        bmp.tight={x:x0,y:y0,w:Math.max(1,x1-x0+1),h:Math.max(1,y1-y0+1)};
      }
      const b=bmp.tight,scale=Math.min(canvas.width*.85/b.w,canvas.height*.84/b.h);
      const w=Math.max(1,Math.round(b.w*scale)),h=Math.max(1,Math.round(b.h*scale));
      ctx.drawImage(bmp.canvas,b.x,b.y,b.w,b.h,Math.round((canvas.width-w)/2),Math.round((canvas.height-h)/2),w,h);
    }

    selection(ctx,h,a) {
      const wx=(h.x-3)*PITCH, wy=(h.y-3)*PITCH;
      const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>project(wx+x*12,wy+y*12,a));
      ctx.fillStyle=h.valid?'rgba(255,249,186,.30)':'rgba(194,113,90,.24)';
      ctx.beginPath(); corners.forEach((p,i)=>i===0?ctx.moveTo(Math.round(p.x),Math.round(p.y)):ctx.lineTo(Math.round(p.x),Math.round(p.y)));
      ctx.closePath();ctx.fill();
      const col=h.valid?'#fff6c0':'#bd6b59';
      for(let i=0;i<4;i++) {
        const o=corners[i];
        for(const adj of [corners[(i+1)%4],corners[(i+3)%4]]) {
          const length=Math.max(Math.abs(adj.x-o.x),Math.abs(adj.y-o.y));
          for(let n=0;n<=length*.30;n++) nearest(o.x+(adj.x-o.x)*n/length,o.y+(adj.y-o.y)*n/length,col,ctx);
        }
      }
    }

    water(ctx,a,t) {
      let i=0;
      for(const [x,y] of [[23,49],[38,32],[57,42],[45,58],[30,39],[49,46]]) {
        const pulse=Math.sin(t*.0016+i++*2.5);
        if(pulse<-.36) continue;
        const p=project(x+Math.sin(t*.0005+i)*1.2,y,a);
        const n=pulse>.64?5:3;
        ctx.fillStyle=pulse>.5?'#c0e5cf':'#9ed4c4';
        ctx.fillRect(Math.round(p.x)-1,Math.round(p.y),n,1);
        if(pulse>.91) ctx.fillRect(Math.round(p.x),Math.round(p.y)-1,1,3);
      }
    }

    smoke(ctx,o,a,ms) {
      const flue=project(8.5,-4.5,a+o.turn);
      const t=ms*.00022+hash(o.wx,o.wy);
      for (let i=0;i<3;i++) {
        const phase=(t+i/3)%1;
        const dx=Math.round(phase*4+Math.sin(phase*7)*1.3);
        const x=Math.round(o.x+flue.x)+dx,y=Math.round(o.y+flue.y-37-phase*13);
        ctx.globalAlpha=Math.sin(phase*Math.PI)*.62;
        ctx.fillStyle='#f1e6c9';ctx.fillRect(x-1,y,phase>.4?4:2,2);
        if(phase>.35) {ctx.fillStyle='#e2d8c3';ctx.fillRect(x,y-1,2,1);}
      }
      ctx.globalAlpha=1;
    }

    bluebird(ctx,a,time,perch) {
      const phase=(time%8400)/1000;
      const go=Math.min(1,phase/.42),back=Math.max(0,Math.min(1,(phase-4.6)/.42));
      const along=-3+6*(go-back);
      const lift=Math.round((Math.sin(go*Math.PI)+Math.sin(back*Math.PI))*3);
      const facing=back>0 || go===0 ? Math.PI : 0;
      let x,y,height,turn;
      if(perch) {
        turn=perch.turn;
        const p=project(along,-3.5,a+turn);
        x=perch.x+p.x; y=perch.y+p.y; height=13;
      } else {
        const p=project(40+along,70,a);
        x=p.x; y=p.y; height=5; turn=0;
      }
      stamp(ctx,cached(scenery.bird,a+turn+facing),x,y-height-lift);
    }

    // Free cells get a tiny seed mark; cells that would finish the current letter pulse in gold.
    marks(ctx,a,t,dots,hints) {
      for(const d of dots) {
        const p=project((d.x-3)*PITCH,(d.y-3)*PITCH,a);
        ctx.fillStyle='rgba(255,252,214,.55)';ctx.fillRect(Math.round(p.x),Math.round(p.y),1,1);
      }
      const pulse=.5+.5*Math.sin(t*.005);
      for(const h of hints) {
        const wx=(h.x-3)*PITCH, wy=(h.y-3)*PITCH;
        const r=h.soft?7:8+Math.round(pulse*2);
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>project(wx+x*r,wy+y*r,a));
        ctx.fillStyle='rgba(255,226,120,'+(h.soft?.10+pulse*.08:.20+pulse*.18).toFixed(3)+')';
        ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(Math.round(p.x),Math.round(p.y)):ctx.moveTo(Math.round(p.x),Math.round(p.y)));
        ctx.closePath();ctx.fill();
        if(h.soft) continue;
        for(let i=0;i<4;i++) {
          const o=corners[i],n=corners[(i+1)%4],len=Math.max(Math.abs(n.x-o.x),Math.abs(n.y-o.y),1);
          for(let k=0;k<=len;k+=2) nearest(o.x+(n.x-o.x)*k/len,o.y+(n.y-o.y)*k/len,'#ffe58a',ctx);
        }
        const c=project(wx,wy,a);
        ctx.fillStyle='#fff4c2';ctx.fillRect(Math.round(c.x),Math.round(c.y)-3-Math.round(pulse*2),1,2);
      }
    }

    // Dusk: the whole scene dims to evening, then lamp heads, house windows and fireflies glow.
    dusk(ctx,visible,a,t) {
      const w=this.canvas.width,h=this.canvas.height;
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation='multiply';
      const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#7d7fb6');g.addColorStop(1,'#c99a8c');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='lighter';
      ctx.translate(this.cx,this.cy);
      const glow=(x,y,r,rgb,alpha)=>{
        for(let k=r;k>0;k-=2) ellipse(ctx,x,y,k,Math.max(1,Math.round(k*.62)),'rgba('+rgb+','+(alpha*(1-k/(r+1))*.55).toFixed(3)+')');
      };
      for(const o of visible) {
        if(o.ghost) continue;
        if(o.kind==='lamp') {glow(o.x,o.y-18,14,'255,196,110',.55);glow(o.x,o.y,10,'255,186,100',.22);}
        if(o.kind==='house') {glow(o.x,o.y-9,16,'255,178,96',.28);}
      }
      for(let i=0;i<9;i++) {
        const k=t*.0004+i*1.7;
        const blink=Math.sin(t*.003+i*2.3);
        if(blink<.1) continue;
        const p=project(Math.sin(k*1.3+i)*70,Math.cos(k+i*.8)*68,a);
        ctx.fillStyle='rgba(235,255,160,'+(.45+blink*.5).toFixed(2)+')';
        ctx.fillRect(Math.round(p.x),Math.round(p.y-6-4*Math.sin(k*3)),1,1);
      }
      ctx.restore();
    }

    render({objects=[],angle=-.55,time=0,highlight=null,mode='plant',completed=0,hints=[],dots=[],dusk=false}={}) {
      this.setSize();
      const a=turnAngle(angle),ctx=this.ctx;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
      ctx.translate(this.cx,this.cy);
      // A projected island-shaped shadow anchors the floating cutaway to the sky.
      const shadowPoly = [[-68,-91],[68,-91],[91,-69],[91,69],[69,91],[-68,91],[-91,68],[-91,-68]];
      for(const [size,shift,alpha] of [[1.01,26,.052],[.975,23,.072]]) {
        ctx.fillStyle='rgba(43,92,93,'+alpha+')';ctx.beginPath();
        shadowPoly.forEach(([x,y],i)=>{const p=project(x*size,y*size,a);if(i===0) ctx.moveTo(Math.round(p.x)+4,Math.round(p.y)+shift);else ctx.lineTo(Math.round(p.x)+4,Math.round(p.y)+shift);});
        ctx.closePath();ctx.fill();
      }
      stamp(ctx,cached(island,a,14),0,CLIFF);
      this.water(ctx,a,time);
      const visible=[];
      for(const f of fixed) {
        const model=scenery[f.type] || modelFor(f.type);
        if(model) visible.push({model,kind:f.type,turn:f.turn||0,...project(f.wx,f.wy,a),fixed:true});
      }
      for(const o of objects) {
        const model=modelFor(o.type);if(!model) continue;
        const wx=(o.x-3)*PITCH,wy=(o.y-3)*PITCH;
        const p=project(wx,wy,a);
        visible.push({model,kind:o.type,turn:o.turn||0,...p,wx,wy,id:o.id});
      }
      for(const o of visible) {
        const rx=({house:20,oak:13,pine:10,flower:6,bench:11,lamp:4,bush:7,stones:5,reeds:3,mushroom:6,rock:8,crate:6,sign:4,fence:9})[o.kind];
        if(rx) ellipse(ctx,o.x+3,o.y+1,rx,Math.max(2,Math.round(rx*.34)),'rgba(52,76,53,.16)');
      }
      if(mode==='plant') this.marks(ctx,a,time,dots,hints);
      if(highlight) {
        this.selection(ctx,highlight,a);
        if(mode==='plant' && highlight.valid && highlight.type) {
          const model=modelFor(highlight.type);
          const p=project((highlight.x-3)*PITCH,(highlight.y-3)*PITCH,a);
          if(model) visible.push({model,kind:highlight.type,turn:highlight.turn||0,...p,ghost:true});
        }
      }
      const bench=completed>=3 ? [...visible].reverse().find(o=>o.kind==='bench'&&!o.ghost) : null;
      visible.sort((l,r)=>l.y-r.y || l.x-r.x);
      for(const o of visible) {
        if(o.ghost) ctx.globalAlpha=.48;
        stamp(ctx,cached(o.model,a+o.turn),o.x,o.y);
        ctx.globalAlpha=1;
        if(o.kind==='house' && !o.ghost) this.smoke(ctx,o,a,time);
        if(completed>=3 && (o===bench || (!bench && o.kind==='dock'))) this.bluebird(ctx,a,time,bench);

      }
      // Two tiny butterflies drift among the meadow planting.
      for(let i=0;i<2;i++) {
        const t=time*.00052+i*3.1;
        const p=project(-47+i*70+Math.cos(t)*4.3,42-i*59+Math.sin(t*1.35)*3.5,a);
        const x=Math.round(p.x),y=Math.round(p.y-8-Math.sin(t*2.1)*1.6);
        const spread=Math.sin(t*15)>0 ? 2:1;
        ctx.fillStyle=i?'#e4ab72':'#fff2ad';ctx.fillRect(x-spread,y-1,spread,2);ctx.fillRect(x+1,y,spread,1);
        ctx.fillStyle='#9a8b64';ctx.fillRect(x,y,1,2);
      }
      if(dusk) this.dusk(ctx,visible,a,time);
      ctx.setTransform(1,0,0,1,0,0);
    }
  }
  window.GardenScene=GardenScene;
})();
