/* Komorebi original pixel models. Coordinates are in native pixels with +y
   toward the front door and +z upward. Every painted cell belongs to exactly
   one horizontal sprite. Forms, details, and their palettes remain editable. */
(() => {
  'use strict';

  const wood = [0x493d36, 0x65513b, 0x846344, 0xae8358, 0xd1a570];
  const leaf = [0x305647, 0x3f6950, 0x598452, 0x79a35b, 0xa4be69, 0xc4ce81];
  const fir = [0x2b5149, 0x386652, 0x49805d, 0x609569, 0x84ab75, 0xa8bc7f];
  const straw = [0x9d7955, 0xc3a373, 0xe2c38a, 0xf8dda0, 0xffe9ba];
  const slate = [0x425355, 0x586866, 0x74817b, 0x95a095, 0xb7b9a3];
  const clay = [0x7b4940, 0x994f42, 0xb65e49, 0xcc7550, 0xe28b5d, 0xeca773];
  const glass = [0x3d5752, 0x476f69, 0x6e9d8c, 0xa2c3aa];
  const iron = [0x354741, 0x4d5c4e, 0x718371, 0x93a084];
  const mod = (x,n) => ((x % n) + n) % n;

  function sculpt(size, height, paint) {
    const half = Math.floor(size/2);
    const layers = Array.from({length:height}, () => new Uint32Array(size * size));
    function put(x,y,z,color) {
      x = Math.round(x) + half;
      y = Math.round(y) + half;
      z = Math.round(z);
      if (x >= 0 && y >= 0 && x < size && y < size && z >= 0 && z < height)
        layers[z][x + y * size] = color;
    }
    function box(x0,y0,z0,x1,y1,z1,ink) {
      for (let z=z0; z<=z1; ++z)
        for (let y=y0; y<=y1; ++y)
          for (let x=x0; x<=x1; ++x) put(x,y,z,
            typeof ink === 'number' ? ink : ink(x,y,z,x0,y0,z0,x1,y1,z1));
    }
    function limb(x0,y0,z0,x1,y1,z1,r,colors) {
      const steps = Math.max(Math.abs(x0-x1), Math.abs(y0-y1), Math.abs(z0-z1), 1);
      for (let i=0; i<=steps; ++i) {
        const t=i/steps;
        const x=Math.round(x0+(x1-x0)*t), y=Math.round(y0+(y1-y0)*t), z=Math.round(z0+(z1-z0)*t);
        for(let dy=-r;dy<=r;++dy) for(let dx=-r;dx<=r;++dx) {
          if (dx*dx+dy*dy<=r*r+.5) put(x+dx,y+dy,z, colors[(dx<0 || dy<0) ? 2 : 1]);
        }
      }
    }
    paint({put,box,limb});
    const slices=layers.map(cells => {
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d');
      const pixels=ctx.createImageData(size,size);
      for(let i=0;i<cells.length;i++) {
        const c=cells[i]; if (!c) continue;
        const j=i*4;
        pixels.data[j]=c>>16; pixels.data[j+1]=(c>>8)&255;
        pixels.data[j+2]=c&255; pixels.data[j+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      return canvas;
    });
    return {size,slices,pivotX:half+0.5,pivotY:half+0.5};
  }

  function timber(x,y,z,x0,y0,z0,x1,y1,z1) {
    if (z===z1) return wood[x===x0 || y===y0 ? 4:3];
    if (x===x1 || y===y0) return wood[1];
    return wood[(x===x0 || (y===y1 && mod(x,7)===0)) ? 3:2];
  }
  function stone(x,y,z,x0,y0,z0,x1,y1,z1) {
    if(z===z1) return slate[3];
    return slate[(mod(x+y+3*Math.floor(z/2),7)===0) ? 1 : (x===x1 || y===y0 ? 1:2)];
  }

  function cottage() {
    return sculpt(47,38,({box,put})=>{
      box(-14,-10,0,14,10,2,stone);
      box(-13,-9,3,13,9,16,(x,y)=> x===13 || y===-9 ? straw[1] : straw[3]);
      for(const x of [-13,13]) for(const y of [-9,9]) box(x-1,y-1,2,x,y,16,timber);
      box(-14,-10,15,14,10,16,timber);
      // The wall below each gable also fills the enclosed upper volume.
      for(let z=17;z<=29;z++) {
        const depth=Math.max(0,10-Math.floor((z-17)*.85));
        box(-13,-depth,z,13,depth,z,(x,y)=> x===13 ? straw[1] : straw[2]);
        if(depth>=1) {
          for(const x of [-13,13]) {
            put(x,0,z,wood[2]);
            if(z>18 && depth>2) {
              put(x,depth-1,z,wood[2]); put(x,-depth+1,z,wood[2]);
            }
          }
        }
      }

      function frontWindow(cx,y,dir) {
        const face=y+dir;
        box(cx-3,y,6,cx+3,y,12,wood[1]);
        for(let z=7;z<=11;z++) for(let x=cx-2;x<=cx+2;x++)
          put(x,face,z,(x===cx || z===9) ? wood[2] : (x<cx && z>=10 ? glass[3] : glass[1]));
        box(cx-4,Math.min(face,y),5,cx+4,Math.max(face,y),5,wood[3]);
        box(cx-4,Math.min(face,y),13,cx+4,Math.max(face,y),13,wood[2]);
      }
      frontWindow(-6,9,1); frontWindow(-5,-9,-1); frontWindow(6,-9,-1);
      for(const side of [-1,1]){
        for(let z=6;z<=12;z++) for(let y=-3;y<=3;y++){
          const frame=z===6 || z===12 || Math.abs(y)===3 || y===0 || z===9;
          put(14*side,y,z,frame?wood[1]: y<0 && z>9 ? glass[3] : glass[1]);
        }
        box(Math.min(13*side,15*side),-4,5,Math.max(13*side,15*side),4,5,wood[3]);
      }
      box(2,9,3,9,10,13,wood[0]);
      box(3,10,3,8,10,12,(x,y,z)=> z===12 ? wood[3] : (mod(x,3)===0 ? wood[2] : wood[3]));
      box(4,10,8,7,10,11,glass[1]);
      put(4,10,11,glass[3]); put(8,11,7,0xe7b765);
      box(1,10,0,10,14,1,stone);
      box(2,10,2,9,12,2,slate[3]);
      // Planted window box with three small flowering heads.
      box(-10,10,4,-2,12,5,wood[2]);
      box(-10,11,6,-2,12,6,leaf[2]);
      for(const x of [-9,-6,-3]) {put(x,12,7,0xdb8160);put(x,11,7,0xf5bc7e);}

      // The ridge runs east-west. Broad facets are detailed with offset tile
      // seams, occasional light tiles and a darker clay course at each eave.
      for(let y=-13;y<=13;y++) {
        const row=Math.abs(y);
        const top=30-Math.round(row*1.03);
        box(-16,y,top-2,16,y,top,(x,yy,z)=>{
          if(z<top) return z===top-2 ? wood[1] : clay[1];
          if(Math.abs(x)===16) return clay[2];
          const band=Math.floor(row/3);
          let c = yy>0 ? 3:2;
          if(mod(row,3)===0 && row>0) c--;
          if(mod(x+band*3,7)===0 && mod(row,3)!==0) c--;
          if(mod(Math.floor((x+band*3)/7)+band*2,6)===1 && mod(row,3)!==0) c++;
          return clay[Math.max(1,Math.min(5,c))];
        });
      }
      box(-17,-1,30,17,1,31,(x,y,z)=> z===31 ? (mod(x,6)===0 ? clay[3]:clay[5]) : clay[2]);
      // A forward dormer interrupts the near pitch.
      box(-9,4,21,-2,8,25,straw[3]);
      box(-8,9,22,-3,9,25,wood[1]);
      box(-7,9,23,-4,9,24,glass[2]);put(-6,9,23,wood[1]);put(-6,9,24,wood[1]);
      for(let x=-11;x<=0;x++){
        const top=29-Math.ceil(Math.abs(x+5.5)*.8);
        box(x,3,top-1,x,10,top,(xx,y,z)=> z<top ? clay[1]: x<-5 ? clay[4] : clay[2]);
      }
      // Brick flue and a hollow lip with an unmistakable silhouette.
      box(7,-6,23,10,-3,35,(x,y,z)=>mod(z,3)===0 ? 0xae8067 : mod(x+y+z,7)===0 ? 0xc58868 : 0xaf6b55);
      box(6,-7,34,11,-2,36,(x,y,z)=> z===36 ? clay[4] :clay[1]);
      box(8,-5,36,9,-4,36,wood[0]);
    });
  }

  function crown({put}, blobs, palette) {
    for(const [cx,cy,cz,rx,ry,rz] of blobs) {
      for(let z=Math.max(0,Math.floor(cz-rz));z<=cz+rz;z++) {
        for(let y=Math.floor(cy-ry);y<=cy+ry;y++) for(let x=Math.floor(cx-rx);x<=cx+rx;x++) {
          const nx=(x-cx)/rx, ny=(y-cy)/ry, nz=(z-cz)/rz;
          if(nx*nx+ny*ny+nz*nz>1) continue;
          const light = -.47*nx-.3*ny+.70*nz;
          let shade = light<-.43 ? 0 : light<-.12 ? 1 : light<.21 ? 2 : light<.52 ? 3 : 4;
          // Pairs of leaf tips catch the light as a cluster. Closely spaced
          // surface noise would make the crown twinkle as it turns.
          if(nz>.32 && mod(x+Math.floor(y/3)*3,10)<2 && mod(y+Math.floor(z/4),5)<2) shade++;
          put(x,y,z,palette[Math.min(5,shade)]);
        }
      }
    }
  }
  function oak() {
    return sculpt(35,34,s=>{
      const {limb,box}=s;
      box(-2,-1,0,2,1,3,timber);
      limb(0,0,0,-1,0,13,2,wood);
      limb(-1,0,7,-7,1,17,1,wood);limb(0,0,9,6,3,19,1,wood);
      limb(-1,1,11,1,-4,20,1,wood);
      crown(s,[[-5,-4,19,8,7,7],[5,-4,20,8,7,7],[6,2,20,8,7,7],
        [-6,4,19,8,7,6],[1,5,23,8,7,7],[-3,-1,26,9,8,7]],leaf);
    });
  }
  function pine() {
    return sculpt(31,35,({put,limb})=>{
      limb(0,0,0,0,0,26,2,wood);
      for(const [base,r,h,twist] of [[6,12,14,.3],[12,10,13,.76],[18,8,11,.1],[24,5,10,.7]]) {
        for(let i=0;i<h;i++){
          const radius=(r*(1-i/h))+.25;
          for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++) {
            const a=Math.atan2(y,x)+twist;
            const scallop=.83+.11*Math.cos(5*a)+.06*Math.cos(3*a);
            const dist=Math.hypot(x,y);
            if(dist>radius*scallop) continue;
            let shade = x+y < -radius*.55 ? 3 : x+y < radius*.25 ? 2 : 1;
            if (i<2) shade--; else if (Math.cos(5*a)>.68 && dist>radius*.55) shade++;
            if (i>=h-2) shade++;
            put(x,y,base+i,fir[Math.max(0,Math.min(5,shade))]);
          }
        }
      }
    });
  }
  function flowers() {
    return sculpt(27,13,({put,limb})=>{
      // Clump with separated heads; five petals surround each warm centre.
      const stems=[[-6,2,7,0xe89588],[-2,-5,10,0xffdda0],[4,-4,8,0xeb8b79],
        [6,2,9,0xffe4b5],[0,4,10,0xe78776],[-5,-2,10,0xffddad],[2,0,11,0xf6b4a0]];
      for(const [x,y,h,col] of stems) {
        limb(Math.trunc(x*.6),Math.trunc(y*.6),0,x,y,h-1,0,leaf);
        limb(x,y,2,x-3,y+1,4,0,leaf);limb(x,y,4,x+2,y-1,6,0,leaf);
        put(x-2,y,3,leaf[3]);put(x-2,y+1,3,leaf[2]);put(x+1,y-1,5,leaf[3]);
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          put(x+dx,y+dy,h-1,0xd8876d);
          put(x+dx,y+dy,h,col);
          put(x+dx*2,y+dy*2,h,col);
        }
        put(x,y,h,0xd49345);put(x,y,h+1,0xffdb74);
      }
    });
  }
  function bench() {
    return sculpt(29,13,({box})=>{
      for(const x of [-8,8]) for(const y of [-3,3]) box(x-1,y-1,0,x,y,5,iron[1]);
      for(const x of [-8,8]) box(x-1,-4,4,x,-3,11,iron[0]);
      for(const y of [-3,0,3]) box(-11,y-1,5,11,y,6,timber);
      box(-11,-4,8,11,-3,9,timber);box(-11,-4,11,11,-3,12,timber);
      // Cast-iron ends with an armrest: seen along its length the bench still
      // shows the classic park-bench profile instead of a thin plank.
      for(const x of [-12,12]) {
        box(x,3,0,x,4,5,iron[1]);          // front leg
        box(x,-5,0,x,-4,12,iron[0]);       // back leg rising into the backrest
        box(x,-4,5,x,3,5,iron[2]);         // seat rail
        box(x,2,6,x,3,8,iron[1]);          // arm post
        box(x,-4,9,x,4,9,iron[3]);         // armrest
        box(x,-5,13,x,-4,13,iron[2]);      // cap
      }
    });
  }
  function lantern() {
    return sculpt(19,26,({box,put})=>{
      box(-3,-3,0,3,3,1,stone);box(-2,-2,2,2,2,3,iron[1]);
      box(-1,-1,3,1,1,13,(x,y)=> x===-1 ? iron[2] : iron[0]);
      box(-2,-2,12,2,2,14,iron[1]);box(-3,-3,14,3,3,15,iron[0]);
      box(-2,-2,16,2,2,20,(x,y,z)=> Math.abs(x)===2 && Math.abs(y)===2 ? iron[0] :
        z===16 ? 0xcf965c : (x<0 || y<0 ? 0xffe9ac : 0xf3c77c));
      box(-4,-4,21,4,4,21,iron[0]);box(-3,-3,22,3,3,22,iron[2]);
      box(-2,-2,23,2,2,23,iron[1]);box(-1,-1,24,1,1,24,iron[2]);put(0,0,25,iron[0]);
    });
  }
  function fence() {
    return sculpt(31,12,({box})=>{
      for(const x of [-12,0,12]) {
        box(x-1,-1,0,x+1,1,10,timber);box(x,0,11,x,0,11,wood[4]);
      }
      for(const z of [4,8]) box(-12,1,z,12,2,z+1,timber);
    });
  }
  function rock() {
    return sculpt(23,11,s=>{
      const mineral=[slate[0],slate[1],slate[2],slate[3],slate[4],0xc2c7ab];
      crown(s,[[-3,0,1,6,5,5],[2,-2,2,7,5,7],[5,3,1,4,4,3]],mineral);
      for(const [x,y,z] of [[-2,-1,7],[-1,-1,8],[0,-2,8],[2,-4,8],[1,-5,7]])s.put(x,y,z,leaf[3]);
    });
  }
  function bush() {
    return sculpt(25,13,s=>{
      crown(s,[[-4,0,3,6,6,5],[3,-2,4,7,5,6],[1,3,5,6,5,5]],leaf);
      for(const [x,y,z] of [[-5,4,6],[-4,4,6],[3,4,8],[4,3,8],[1,-5,8]])
        s.put(x,y,z,0xdd9872);
    });
  }
  function sign() {
    return sculpt(21,16,({box,put})=>{
      box(-1,-1,0,1,1,12,timber);box(-7,-1,8,6,1,13,timber);
      box(-8,-1,9,7,1,12,timber);put(8,0,10,wood[2]);put(8,0,11,wood[3]);
      for(const [x,z] of [[-3,10],[-2,10],[-1,10],[0,10],[1,10],[2,10],[2,11],[1,12],[1,9]])put(x,1,z,straw[3]);
    });
  }
  function mushroom() {
    return sculpt(21,10,s=>{
      for(const [x,y,z,r] of [[-3,0,3,4],[4,3,2,3],[2,-5,1,2]]){
        s.box(x-1,y-1,0,x+1,y+1,z+2,straw[2]);
        crown(s,[[x,y,z+2,r,r,2]],[clay[0],clay[1],clay[2],clay[3],clay[4],clay[5]]);
        s.put(x-1,y,z+3,straw[4]);s.put(x+1,y+1,z+3,straw[3]);s.put(x,y,z+4,straw[4]);
      }
    });
  }
  function crate() {
    return sculpt(19,10,({box})=>{
      box(-6,-5,0,6,5,7,(x,y,z)=> (x===-6 || x===6 || z===0 || z===7) ? wood[3] : wood[z%3===1?1:2]);
      for(const x of [-6,-3,0,3,6])box(x,-5,7,x,5,7,wood[1]);
      for(const x of [-6,6])box(x,-5,7,x,5,8,wood[3]);
    });
  }

  const builders={house:cottage, oak, pine, flower:flowers, bench, lamp:lantern, fence, rock, bush, sign, mushroom, crate};
  const models=new Map();
  window.GardenModels={
    get(type){
      if(!Object.prototype.hasOwnProperty.call(builders,type)) return null;
      if(!models.has(type)) models.set(type,builders[type]());
      return models.get(type);
    }
  };
})();
