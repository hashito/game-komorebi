(() => {
  'use strict';

  const canvas = document.getElementById('sky');
  if (!canvas) return;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('aria-hidden', 'true');

  // Each puff is an ellipse on a two-pixel-high grid. Its flat underside
  // joins the adjacent puffs, leaving the strong stair-step cloud silhouette.
  const clouds = [
    {
      puffs: [[6,11,11,4],[17,8,12,6],[27,3,12,8],[38,6,10,7],[50,9,10,5],[60,12,11,3]],
      wisps: [[-9,16,10],[4,18,14],[49,17,13],[65,15,11]]
    },
    {
      puffs: [[4,11,10,4],[15,7,11,7],[24,4,12,8],[32,5,11,7],[41,9,13,5],[51,12,12,3]],
      wisps: [[-12,15,10],[1,17,12],[32,17,15],[58,15,10]]
    },
    {
      puffs: [[4,7,9,3],[13,4,10,5],[24,4,10,5],[34,7,9,3],[42,8,9,2]],
      wisps: [[-9,10,9],[8,13,16],[43,10,12]]
    }
  ];
  const mainTints = ['#c6e5df', '#d5ece2', '#e4efe2', '#f2f3df'];
  const distantTints = ['#c9e5db', '#cfe9dd', '#d8ecdc', '#e1eddb'];

  function puffCloud(form, tints) {
    const img = document.createElement('canvas');
    img.width = 96;
    img.height = 32;
    const c = img.getContext('2d');
    const originX = 15, originY = 7;
    function puff(cx, cy, rx, ry, base, color) {
      c.fillStyle = color;
      for (let row = -ry; row <= base; row += 2) {
        const u = Math.min(0, row + 1) / ry;
        const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - u * u)));
        const left = Math.round((originX + cx - half) / 2) * 2;
        const right = Math.round((originX + cx + half) / 2) * 2;
        if (right > left) c.fillRect(left, originY + cy + row, right - left, 2);
      }
    }
    for (const [cx, cy, rx, ry] of form.puffs) {
      puff(cx, cy, rx, ry, 14-cy, tints[0]);
    }
    for (const [cx, cy, rx, ry] of form.puffs) {
      puff(cx, cy, rx-1, ry, 11-cy, tints[1]);
    }
    for (const [cx, cy, rx, ry] of form.puffs) {
      puff(cx-1, cy-1, rx-2, Math.max(2, ry-1), 9-cy, tints[2]);
    }
    // Break the light rim into larger masses to avoid an outline on every puff.
    for (const [i, [cx, cy, rx, ry]] of form.puffs.entries()) {
      if (i > 0 && i < 4) puff(cx-2,cy-1,rx-4,Math.max(2,ry-1),0,tints[3]);
    }
    form.wisps.forEach(([x,y,w], i) => {
      c.fillStyle = tints[i===1 ? 1 : 0];
      c.fillRect(originX+x, originY+y, w, 1);
    });
    return img;
  }

  const heroClouds = clouds.map(cloud => puffCloud(cloud, mainTints));
  const farClouds = clouds.map(cloud => puffCloud(cloud, distantTints));

  function bird(x, y, face, vivid) {
    const bx = Math.round(x), by = Math.round(y);
    context.fillStyle = vivid ? '#89beb8' : '#a5cebf';
    context.fillRect(bx, by, 2, 1);
    context.fillRect(bx-2, by-1, 2, 1);
    context.fillRect(bx+2, by-1, 2, 1);
    context.fillRect(face ? bx+4 : bx-3, by-2, 1, 1);
  }

  function draw() {
    const {width, height} = canvas.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const scale = width < 520 ? 1.65 : 2;
    const w = Math.round(width / scale), h = Math.round(height / scale);
    if (canvas.width === w && canvas.height === h && canvas.dataset.drawn) return;
    canvas.width = w;
    canvas.height = h;
    canvas.dataset.drawn = 'yes';
    context.imageSmoothingEnabled = false;
    const sky = context.createLinearGradient(0, 0, w * 0.06, h);
    sky.addColorStop(0, '#a5d7d8');
    sky.addColorStop(0.50, '#bfe2da');
    sky.addColorStop(1, '#e0ecda');
    context.fillStyle = sky;
    context.fillRect(0,0,w,h);

    function cloud(sprite, cx, cy, zoom = 1, flip = false) {
      context.save();
      context.translate(Math.round(w*cx), Math.round(h*cy));
      context.scale(flip ? -1 : 1, 1);
      const cw = Math.round(sprite.width*zoom), ch = Math.round(sprite.height*zoom);
      context.drawImage(sprite, -Math.floor(cw/2), -Math.floor(ch/2), cw, ch);
      context.restore();
    }

    // High clouds flank the scene, with the broadest bank scaling out at the
    // frame edge on narrow phones rather than obscuring the floating garden.
    const narrow = width < 520;
    cloud(heroClouds[0], narrow ? .055 : .12, .31, narrow ? .76 : .94);
    cloud(heroClouds[1], narrow ? 1.01 : .925, .244, narrow ? .92 : 1.05, true);
    cloud(farClouds[2], .755, .125, narrow ? .36 : .49);
    cloud(farClouds[2], narrow ? .94 : .88, .61, .52, true);
    cloud(farClouds[2], narrow ? -.035 : .045, .665, .46);
    bird(w*.243,h*.227,true,true);
    bird(w*.269,h*.205,false,false);

    // Just a few broken horizontal lines at the lowest altitude.
    context.fillStyle = '#d1e6d6';
    for (const [x,y,length] of [[.04,.858,14],[.09,.866,5],[.86,.83,14],[.935,.827,7],[.73,.91,11]]) {
      context.fillRect(Math.round(w*x),Math.round(h*y),length,1);
    }
  }
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
  } else {
    window.addEventListener('resize', draw, { passive: true });
  }
  draw();
})();
