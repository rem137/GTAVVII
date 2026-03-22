const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  money: document.getElementById('money'),
  rep: document.getElementById('rep'),
  hp: document.getElementById('hp'),
  armor: document.getElementById('armor'),
  wanted: document.getElementById('wanted'),
  district: document.getElementById('district'),
  missionTitle: document.getElementById('missionTitle'),
  missionDesc: document.getElementById('missionDesc'),
  missionProgress: document.getElementById('missionProgress'),
  feed: document.getElementById('feed'),
  menu: document.getElementById('menu'),
  startBtn: document.getElementById('startBtn'),
  pausePanel: document.getElementById('pausePanel'),
};

const keys = new Set();
const bullets = [];
const particles = [];
const feed = [];
let running = false;
let paused = false;

const world = {
  width: 3800,
  height: 2200,
  districts: [
    { name: 'Downtown', x: 0, y: 0, w: 1300, h: 1000, tint: '#2c364d' },
    { name: 'Old Port', x: 1300, y: 0, w: 1300, h: 1000, tint: '#33303c' },
    { name: 'South Blocks', x: 0, y: 1000, w: 1300, h: 1200, tint: '#2e4636' },
    { name: 'Tech Valley', x: 1300, y: 1000, w: 2500, h: 1200, tint: '#28314d' },
    { name: 'Hills', x: 2600, y: 0, w: 1200, h: 1000, tint: '#3b2f2c' },
  ],
  roads: [],
  buildings: [],
  pickups: [],
  safehouse: { x: 320, y: 320, w: 90, h: 90 },
};

for (let y = 220; y < world.height; y += 340) {
  world.roads.push({ x: 0, y, w: world.width, h: 90, horizontal: true });
}
for (let x = 220; x < world.width; x += 360) {
  world.roads.push({ x, y: 0, w: 90, h: world.height, horizontal: false });
}

for (let i = 0; i < 90; i++) {
  const size = 130 + (i * 7) % 100;
  const x = 45 + ((i * 233) % (world.width - size - 80));
  const y = 45 + ((i * 157) % (world.height - size - 80));
  if (Math.abs(x - world.safehouse.x) < 220 && Math.abs(y - world.safehouse.y) < 220) continue;
  world.buildings.push({ x, y, w: size, h: size, color: `hsl(${(i * 9) % 360}, 20%, ${18 + (i % 4) * 7}%)` });
}

const player = {
  x: 320,
  y: 320,
  r: 14,
  speed: 220,
  dashCd: 0,
  hp: 100,
  armor: 30,
  money: 0,
  rep: 0,
  wanted: 0,
  weaponCd: 0,
  vehicle: null,
  facing: 0,
  kills: 0,
};

const cars = Array.from({ length: 45 }, (_, i) => ({
  x: 160 + ((i * 211) % (world.width - 200)),
  y: 260 + ((i * 149) % (world.height - 260)),
  w: 52,
  h: 28,
  color: `hsl(${(i * 37) % 360}, 80%, 60%)`,
  speed: 80 + (i % 7) * 14,
  dir: i % 2 ? 1 : -1,
  route: i % 2 ? 'h' : 'v',
  occupiedBy: null,
  destroyed: false,
  respawn: 0,
}));

const gangs = Array.from({ length: 24 }, (_, i) => ({
  x: 700 + ((i * 271) % 2600),
  y: 450 + ((i * 191) % 1500),
  r: 11,
  hp: 45,
  speed: 95,
  shootCd: Math.random() * 2,
  color: i % 2 ? '#ff7a7a' : '#ffad70',
  alive: true,
}));

const cops = Array.from({ length: 28 }, (_, i) => ({
  x: 1200 + ((i * 90) % 1100),
  y: 600 + ((i * 120) % 800),
  r: 12,
  hp: 60,
  speed: 120,
  active: false,
  shootCd: 0,
}));

const missionFlow = [
  {
    title: 'Initiation',
    desc: 'Vole 2 voitures dans Downtown.',
    target: 2,
    type: 'steal',
    progress: 0,
    reward: 300,
  },
  {
    title: 'Nettoyage de rue',
    desc: 'Élimine 6 gangsters dans South Blocks.',
    target: 6,
    type: 'gang',
    progress: 0,
    reward: 600,
  },
  {
    title: 'Cash Runner',
    desc: 'Récupère 4 sacs de cash largués en ville.',
    target: 4,
    type: 'pickup',
    progress: 0,
    reward: 900,
  },
  {
    title: 'Évasion finale',
    desc: 'Atteins le safehouse avec au moins 1500$ et 2★ max.',
    target: 1,
    type: 'escape',
    progress: 0,
    reward: 1400,
  },
];
let missionIndex = 0;

function addFeed(message) {
  const stamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  feed.unshift(`[${stamp}] ${message}`);
  feed.splice(10);
  ui.feed.innerHTML = feed.map((m) => `<li>${m}</li>`).join('');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function circleRectCollision(cx, cy, rr, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < rr * rr;
}

function getDistrict(x, y) {
  return world.districts.find((d) => pointInRect(x, y, d))?.name || 'Outskirts';
}

function spawnPickup(type, x, y) {
  world.pickups.push({ type, x, y, r: 10, alive: true });
}

function bootstrapWorld() {
  for (let i = 0; i < 12; i++) {
    spawnPickup('cash', 320 + Math.random() * 3000, 340 + Math.random() * 1500);
  }
  for (let i = 0; i < 8; i++) {
    spawnPickup('armor', 320 + Math.random() * 3000, 340 + Math.random() * 1500);
  }
}
bootstrapWorld();

function currentMission() {
  return missionFlow[missionIndex] || null;
}

function completeMission() {
  const mission = currentMission();
  if (!mission) return;

  player.money += mission.reward;
  player.rep += 8;
  addFeed(`Mission réussie: ${mission.title} (+$${mission.reward})`);
  missionIndex += 1;

  if (missionIndex >= missionFlow.length) {
    addFeed('Campagne terminée. Mode free roam débloqué.');
    ui.missionTitle.textContent = 'Campagne terminée';
    ui.missionDesc.textContent = 'Continue en mode libre, améliore ton score.';
    ui.missionProgress.textContent = '';
    return;
  }

  missionFlow[missionIndex].progress = 0;
}

function registerMissionEvent(type) {
  const mission = currentMission();
  if (!mission || mission.type !== type) return;

  mission.progress += 1;
  if (mission.progress >= mission.target) {
    completeMission();
  }
}

function applyDamage(amount) {
  const absorbed = Math.min(player.armor, amount * 0.65);
  player.armor -= absorbed;
  player.hp -= (amount - absorbed);

  if (player.hp <= 0) {
    player.hp = 0;
    running = false;
    addFeed('Tu es tombé. Appuie sur Jouer pour recommencer.');
    ui.menu.classList.add('visible');
  }
}

function shoot(owner, tx, ty, speed = 520, power = 22) {
  const ang = Math.atan2(ty - owner.y, tx - owner.x);
  bullets.push({
    x: owner.x,
    y: owner.y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    power,
    owner,
    ttl: 1.6,
  });
}

function burst(x, y, color = '#ffffff', n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 160;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ttl: 0.5 + Math.random() * 0.6, color });
  }
}

function tryVehicleInteract() {
  if (player.vehicle) {
    player.vehicle.occupiedBy = null;
    player.vehicle = null;
    addFeed('Sortie du véhicule.');
    return;
  }

  let nearest = null;
  let best = 42;
  for (const car of cars) {
    if (car.destroyed || car.occupiedBy) continue;
    const cx = car.x + car.w / 2;
    const cy = car.y + car.h / 2;
    const d = Math.hypot(player.x - cx, player.y - cy);
    if (d < best) {
      nearest = car;
      best = d;
    }
  }

  if (!nearest) return;
  nearest.occupiedBy = player;
  player.vehicle = nearest;
  player.wanted = clamp(player.wanted + 0.8, 0, 5);
  player.money += 80;
  registerMissionEvent('steal');
  addFeed('Véhicule volé. La police est alertée.');
}

function updateInput(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('z') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  if (player.vehicle) {
    const car = player.vehicle;
    car.x = clamp(car.x + dx * 360 * dt, 0, world.width - car.w);
    car.y = clamp(car.y + dy * 360 * dt, 0, world.height - car.h);
    player.x = car.x + car.w / 2;
    player.y = car.y + car.h / 2;
  } else {
    const speed = player.speed * (keys.has('shift') ? 1.38 : 1);
    let nx = clamp(player.x + dx * speed * dt, player.r, world.width - player.r);
    let ny = clamp(player.y + dy * speed * dt, player.r, world.height - player.r);

    for (const b of world.buildings) {
      if (circleRectCollision(nx, ny, player.r, b)) {
        nx = player.x;
        ny = player.y;
        break;
      }
    }

    player.x = nx;
    player.y = ny;
  }

  player.dashCd = Math.max(0, player.dashCd - dt);
  player.weaponCd = Math.max(0, player.weaponCd - dt);
}

function updateCars(dt) {
  for (const c of cars) {
    if (c.destroyed) {
      c.respawn -= dt;
      if (c.respawn <= 0) {
        c.destroyed = false;
        c.hp = 60;
        c.x = 160 + Math.random() * (world.width - 260);
        c.y = 200 + Math.random() * (world.height - 300);
      }
      continue;
    }

    if (c.occupiedBy) continue;

    if (c.route === 'h') {
      c.x += c.speed * c.dir * dt;
      if (c.x < -c.w) c.x = world.width;
      if (c.x > world.width) c.x = -c.w;
    } else {
      c.y += c.speed * c.dir * dt;
      if (c.y < -c.h) c.y = world.height;
      if (c.y > world.height) c.y = -c.h;
    }
  }
}

function updateGangs(dt) {
  for (const g of gangs) {
    if (!g.alive) continue;

    const d = dist(g, player);
    if (d < 500) {
      const a = Math.atan2(player.y - g.y, player.x - g.x);
      if (d > 160) {
        g.x += Math.cos(a) * g.speed * dt;
        g.y += Math.sin(a) * g.speed * dt;
      }
      g.shootCd -= dt;
      if (g.shootCd <= 0) {
        g.shootCd = 1.3 + Math.random() * 0.8;
        shoot(g, player.x, player.y, 420, 10);
      }
    }
  }
}

function updateCops(dt) {
  const active = Math.round(player.wanted * 4);
  cops.forEach((c, i) => {
    c.active = i < active;
    if (!c.active) return;

    const a = Math.atan2(player.y - c.y, player.x - c.x);
    c.x += Math.cos(a) * c.speed * dt * (1 + player.wanted * 0.2);
    c.y += Math.sin(a) * c.speed * dt * (1 + player.wanted * 0.2);

    const d = dist(c, player);
    c.shootCd -= dt;
    if (d < 460 && c.shootCd <= 0) {
      c.shootCd = 0.8 + Math.random() * 0.5;
      shoot(c, player.x, player.y, 500, 11);
    }
  });

  player.wanted = clamp(player.wanted - (player.vehicle ? 0.01 : 0.02) * dt, 0, 5);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.ttl -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.ttl <= 0 || b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height) {
      bullets.splice(i, 1);
      continue;
    }

    if (b.owner !== player && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 3) {
      applyDamage(b.power);
      burst(b.x, b.y, '#ff8095', 8);
      bullets.splice(i, 1);
      continue;
    }

    if (b.owner === player) {
      let hit = false;
      for (const g of gangs) {
        if (!g.alive) continue;
        if (Math.hypot(g.x - b.x, g.y - b.y) < g.r + 3) {
          g.hp -= b.power;
          burst(g.x, g.y, '#ffc099', 8);
          if (g.hp <= 0) {
            g.alive = false;
            player.money += 65;
            player.rep += 1;
            player.kills += 1;
            player.wanted = clamp(player.wanted + 0.2, 0, 5);
            registerMissionEvent('gang');
            addFeed('Gang neutralisé.');
          }
          hit = true;
          break;
        }
      }

      if (!hit) {
        for (const c of cops) {
          if (!c.active) continue;
          if (Math.hypot(c.x - b.x, c.y - b.y) < c.r + 3) {
            c.hp -= b.power;
            burst(c.x, c.y, '#9fd6ff', 8);
            if (c.hp <= 0) {
              c.hp = 60;
              c.x = 1000 + Math.random() * 1600;
              c.y = 300 + Math.random() * 1400;
              player.wanted = clamp(player.wanted + 0.6, 0, 5);
              player.money += 40;
            }
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        bullets.splice(i, 1);
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.ttl <= 0) particles.splice(i, 1);
  }
}

function updatePickups() {
  for (const p of world.pickups) {
    if (!p.alive) continue;
    if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r + 5) {
      p.alive = false;
      if (p.type === 'cash') {
        player.money += 140;
        registerMissionEvent('pickup');
        addFeed('Sac de cash récupéré.');
      } else {
        player.armor = clamp(player.armor + 25, 0, 100);
        addFeed('Armure récupérée.');
      }
    }
  }

  if (world.pickups.filter((p) => p.alive).length < 10) {
    spawnPickup(Math.random() < 0.7 ? 'cash' : 'armor', 250 + Math.random() * 3200, 220 + Math.random() * 1700);
  }
}

function updateMission() {
  const m = currentMission();
  if (!m) return;

  if (m.type === 'escape') {
    const inSafe = pointInRect(player.x, player.y, world.safehouse);
    if (inSafe && player.money >= 1500 && player.wanted <= 2) {
      m.progress = 1;
      completeMission();
    }
  }
}

function updateUI() {
  const mission = currentMission();
  ui.money.textContent = `$${Math.floor(player.money)}`;
  ui.rep.textContent = `${player.rep}`;
  ui.hp.textContent = `${Math.floor(player.hp)}`;
  ui.armor.textContent = `${Math.floor(player.armor)}`;
  ui.wanted.textContent = `${'★'.repeat(Math.round(player.wanted))}${'☆'.repeat(5 - Math.round(player.wanted))}`;
  ui.district.textContent = getDistrict(player.x, player.y);

  if (mission) {
    ui.missionTitle.textContent = mission.title;
    ui.missionDesc.textContent = mission.desc;
    ui.missionProgress.textContent = `${mission.progress} / ${mission.target}`;
  }
}

function renderWorld(camX, camY, t) {
  const cycle = (Math.sin(t * 0.04) + 1) / 2;
  const sky = Math.floor(20 + cycle * 35);
  ctx.fillStyle = `rgb(${sky}, ${sky + 10}, ${sky + 20})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const d of world.districts) {
    ctx.fillStyle = d.tint;
    ctx.fillRect(d.x - camX, d.y - camY, d.w, d.h);
  }

  ctx.fillStyle = '#49556e';
  for (const r of world.roads) ctx.fillRect(r.x - camX, r.y - camY, r.w, r.h);

  for (const b of world.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(b.x - camX + 8, b.y - camY + 8, b.w - 16, 5);
  }

  ctx.fillStyle = '#4cc9f0';
  ctx.fillRect(world.safehouse.x - camX, world.safehouse.y - camY, world.safehouse.w, world.safehouse.h);
  ctx.fillStyle = '#09192b';
  ctx.fillText('SAFEHOUSE', world.safehouse.x - camX + 8, world.safehouse.y - camY + 52);
}

function renderEntities(camX, camY) {
  for (const p of world.pickups) {
    if (!p.alive) continue;
    ctx.beginPath();
    ctx.fillStyle = p.type === 'cash' ? '#6cff8d' : '#8bc2ff';
    ctx.arc(p.x - camX, p.y - camY, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of cars) {
    if (c.destroyed) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - camX, c.y - camY, c.w, c.h);
    ctx.fillStyle = '#101521';
    ctx.fillRect(c.x - camX + 8, c.y - camY + 5, c.w - 16, c.h - 10);
  }

  for (const g of gangs) {
    if (!g.alive) continue;
    ctx.beginPath();
    ctx.fillStyle = g.color;
    ctx.arc(g.x - camX, g.y - camY, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of cops) {
    if (!c.active) continue;
    ctx.beginPath();
    ctx.fillStyle = '#73b5ff';
    ctx.arc(c.x - camX, c.y - camY, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.fillStyle = '#3ef3bb';
  ctx.arc(player.x - camX, player.y - camY, player.r, 0, Math.PI * 2);
  ctx.fill();

  for (const b of bullets) {
    ctx.fillStyle = b.owner === player ? '#ffff8a' : '#ff7d9c';
    ctx.fillRect(b.x - camX - 2, b.y - camY - 2, 4, 4);
  }

  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camX, p.y - camY, 2, 2);
  }
}

function renderMinimap(camX, camY) {
  const w = 220;
  const h = 130;
  const x = canvas.width - w - 18;
  const y = 18;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = '#0c1220';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#35507e';
  ctx.strokeRect(x, y, w, h);

  const sx = w / world.width;
  const sy = h / world.height;

  ctx.fillStyle = '#324a75';
  for (const r of world.roads) {
    ctx.fillRect(x + r.x * sx, y + r.y * sy, r.w * sx, r.h * sy);
  }

  ctx.fillStyle = '#3ef3bb';
  ctx.fillRect(x + player.x * sx - 2, y + player.y * sy - 2, 4, 4);

  ctx.strokeStyle = '#8fe7ff';
  ctx.strokeRect(x + camX * sx, y + camY * sy, canvas.width * sx, canvas.height * sy);

  ctx.globalAlpha = 1;
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (running && !paused) {
    updateInput(dt);
    updateCars(dt);
    updateGangs(dt);
    updateCops(dt);
    updateBullets(dt);
    updateParticles(dt);
    updatePickups();
    updateMission();
  }

  const camX = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  const camY = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);

  renderWorld(camX, camY, now / 1000);
  renderEntities(camX, camY);
  renderMinimap(camX, camY);
  updateUI();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function resetGame() {
  player.x = 320;
  player.y = 320;
  player.hp = 100;
  player.armor = 30;
  player.money = 0;
  player.rep = 0;
  player.wanted = 0;
  player.kills = 0;
  player.vehicle = null;
  missionIndex = 0;
  missionFlow.forEach((m) => (m.progress = 0));

  gangs.forEach((g, i) => {
    g.alive = true;
    g.hp = 45;
    g.x = 700 + ((i * 271) % 2600);
    g.y = 450 + ((i * 191) % 1500);
  });

  world.pickups = [];
  bootstrapWorld();
  feed.length = 0;
  addFeed('Nouvelle partie lancée.');
}

ui.startBtn.addEventListener('click', () => {
  resetGame();
  running = true;
  paused = false;
  ui.menu.classList.remove('visible');
  ui.pausePanel.classList.remove('visible');
});

canvas.addEventListener('mousedown', (e) => {
  if (!running || paused || player.weaponCd > 0) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const camX = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  const camY = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);
  shoot(player, mx + camX, my + camY, 620, 24);
  player.weaponCd = 0.12;
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === 'e' && running && !paused) {
    tryVehicleInteract();
  }

  if (k === ' ' && running && !paused && player.dashCd <= 0 && !player.vehicle) {
    player.dashCd = 1.2;
    const a = player.facing;
    player.x = clamp(player.x + Math.cos(a) * 95, 0, world.width);
    player.y = clamp(player.y + Math.sin(a) * 95, 0, world.height);
    burst(player.x, player.y, '#7fffd4', 18);
  }

  if (k === 'p' && running) {
    paused = !paused;
    ui.pausePanel.classList.toggle('visible', paused);
    addFeed(paused ? 'Pause activée.' : 'Retour en jeu.');
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - canvas.width / 2;
  const y = e.clientY - rect.top - canvas.height / 2;
  player.facing = Math.atan2(y, x);
});
