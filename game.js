const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  money: document.getElementById('money'),
  wanted: document.getElementById('wanted'),
  health: document.getElementById('health'),
  state: document.getElementById('state'),
  mission: document.getElementById('mission'),
};

const world = {
  width: 2200,
  height: 1400,
  roads: [
    { x: 0, y: 320, w: 2200, h: 120 },
    { x: 0, y: 860, w: 2200, h: 120 },
    { x: 680, y: 0, w: 140, h: 1400 },
    { x: 1480, y: 0, w: 140, h: 1400 },
  ],
  buildings: [],
};

for (let i = 0; i < 22; i++) {
  const x = (i % 6) * 340 + 30;
  const y = Math.floor(i / 6) * 280 + 30;
  world.buildings.push({
    x,
    y,
    w: 200 + ((i * 11) % 70),
    h: 150 + ((i * 7) % 90),
    color: `hsl(${210 + (i % 5) * 12}, 35%, ${18 + (i % 3) * 4}%)`,
  });
}

const keys = new Set();
let lastTime = performance.now();
let missionComplete = false;

const player = {
  x: 250,
  y: 250,
  r: 12,
  speed: 170,
  sprintBoost: 1.65,
  color: '#00d08e',
  health: 100,
  money: 0,
  wanted: 0,
  stolenCars: 0,
  vehicle: null,
  stealCooldown: 0,
};

const cars = Array.from({ length: 16 }, (_, i) => ({
  x: 180 + ((i * 130) % 1850),
  y: i % 2 === 0 ? 370 + (i % 4) * 8 : 900 + (i % 3) * 7,
  w: 48,
  h: 24,
  speed: 70 + (i % 5) * 12,
  dir: i % 2 === 0 ? 1 : -1,
  color: `hsl(${(i * 35) % 360}, 78%, 60%)`,
  taken: false,
  respawn: 0,
}));

const cops = Array.from({ length: 8 }, (_, i) => ({
  x: 1000 + i * 80,
  y: 300 + (i % 4) * 180,
  r: 11,
  speed: 90,
  active: false,
}));

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRectCollision(cx, cy, r, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

function updateCars(dt) {
  for (const car of cars) {
    if (car.taken && car !== player.vehicle) {
      car.respawn -= dt;
      if (car.respawn <= 0) {
        car.taken = false;
        car.x = 120 + Math.random() * 1900;
        car.y = Math.random() > 0.5 ? 380 : 900;
      }
      continue;
    }

    if (car === player.vehicle) continue;

    car.x += car.speed * car.dir * dt;
    if (car.x < -car.w) car.x = world.width + car.w;
    if (car.x > world.width + car.w) car.x = -car.w;
  }
}

function updatePlayer(dt) {
  const up = keys.has('w') || keys.has('z') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('q') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const sprint = keys.has('shift');

  let moveX = 0;
  let moveY = 0;
  if (left) moveX -= 1;
  if (right) moveX += 1;
  if (up) moveY -= 1;
  if (down) moveY += 1;

  const len = Math.hypot(moveX, moveY) || 1;
  moveX /= len;
  moveY /= len;

  if (player.vehicle) {
    const car = player.vehicle;
    car.x += moveX * 260 * dt;
    car.y += moveY * 260 * dt;
    car.x = clamp(car.x, 0, world.width - car.w);
    car.y = clamp(car.y, 0, world.height - car.h);

    player.x = car.x + car.w / 2;
    player.y = car.y + car.h / 2;
  } else {
    const speed = player.speed * (sprint ? player.sprintBoost : 1);
    const nextX = clamp(player.x + moveX * speed * dt, player.r, world.width - player.r);
    const nextY = clamp(player.y + moveY * speed * dt, player.r, world.height - player.r);

    let blocked = false;
    for (const b of world.buildings) {
      if (circleRectCollision(nextX, nextY, player.r, b)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      player.x = nextX;
      player.y = nextY;
    }
  }

  player.stealCooldown = Math.max(0, player.stealCooldown - dt);
}

function tryInteract() {
  if (player.stealCooldown > 0) return;

  if (player.vehicle) {
    player.vehicle = null;
    player.stealCooldown = 0.3;
    return;
  }

  let nearest = null;
  let distMin = 45;

  for (const car of cars) {
    if (car.taken) continue;
    const cx = car.x + car.w / 2;
    const cy = car.y + car.h / 2;
    const d = Math.hypot(player.x - cx, player.y - cy);
    if (d < distMin) {
      distMin = d;
      nearest = car;
    }
  }

  if (nearest) {
    nearest.taken = true;
    player.vehicle = nearest;
    player.money += 120;
    player.wanted = clamp(player.wanted + 1, 0, 5);
    player.stolenCars += 1;
    player.stealCooldown = 0.35;
  }
}

function updateCops(dt) {
  const activeCount = player.wanted * 2;
  cops.forEach((c, i) => {
    c.active = i < activeCount;
    if (!c.active) return;

    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;

    c.x += (dx / dist) * c.speed * dt * (1 + player.wanted * 0.2);
    c.y += (dy / dist) * c.speed * dt * (1 + player.wanted * 0.2);

    if (dist < (player.vehicle ? 22 : 18)) {
      player.health -= (7 + player.wanted * 1.5) * dt;
      player.wanted = clamp(player.wanted + 0.05 * dt, 0, 5);
    }
  });

  if (player.wanted > 0 && !player.vehicle) {
    player.wanted = Math.max(0, player.wanted - 0.03 * dt);
  }
}

function updateMission() {
  if (!missionComplete && player.stolenCars >= 3 && player.money >= 1000 && player.health > 0) {
    missionComplete = true;
    ui.mission.textContent = 'Mission réussie: Tu deviens le boss de la ville. Continue en mode bac à sable.';
  }

  if (player.health <= 0) {
    ui.mission.textContent = 'Mission échouée: Busted. Appuie sur R pour recommencer.';
  }
}

function restart() {
  player.x = 250;
  player.y = 250;
  player.money = 0;
  player.wanted = 0;
  player.health = 100;
  player.stolenCars = 0;
  player.vehicle = null;
  player.stealCooldown = 0;
  missionComplete = false;
  ui.mission.textContent = 'Mission: Voler 3 voitures sans mourir.';

  for (const car of cars) {
    car.taken = false;
    car.respawn = 0;
  }
}

function drawBackground(camX, camY) {
  ctx.fillStyle = '#171d2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2b3a55';
  for (const r of world.roads) {
    ctx.fillRect(r.x - camX, r.y - camY, r.w, r.h);
  }

  ctx.fillStyle = '#314666';
  for (let x = -camX % 40; x < canvas.width; x += 40) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  for (let y = -camY % 40; y < canvas.height; y += 40) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  for (const b of world.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(b.x - camX + 8, b.y - camY + 8, b.w - 16, 6);
  }
}

function drawCars(camX, camY) {
  for (const car of cars) {
    if (car.taken && car !== player.vehicle) continue;
    ctx.fillStyle = car.color;
    ctx.fillRect(car.x - camX, car.y - camY, car.w, car.h);
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(car.x - camX + 8, car.y - camY + 4, 14, 16);
  }
}

function drawCops(camX, camY) {
  for (const c of cops) {
    if (!c.active) continue;
    ctx.beginPath();
    ctx.fillStyle = '#5cb3ff';
    ctx.arc(c.x - camX, c.y - camY, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(camX, camY) {
  if (!player.vehicle) {
    ctx.beginPath();
    ctx.fillStyle = player.color;
    ctx.arc(player.x - camX, player.y - camY, player.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.wanted > 0) {
    ctx.fillStyle = 'rgba(255,79,100,0.2)';
    ctx.beginPath();
    ctx.arc(player.x - camX, player.y - camY, 100 + player.wanted * 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateUI() {
  ui.money.textContent = `${Math.floor(player.money)}$`;
  ui.wanted.textContent = `${'★'.repeat(Math.round(player.wanted))}${'☆'.repeat(5 - Math.round(player.wanted))}`;
  ui.health.textContent = `${Math.max(0, Math.floor(player.health))}`;
  ui.state.textContent = player.vehicle ? 'En véhicule' : 'À pied';
}

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  if (player.health > 0) {
    updateCars(dt);
    updatePlayer(dt);
    updateCops(dt);
    updateMission();
  }

  const camX = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  const camY = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);

  drawBackground(camX, camY);
  drawCars(camX, camY);
  drawCops(camX, camY);
  drawPlayer(camX, camY);
  updateUI();

  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === 'e') {
    tryInteract();
  }

  if (k === 'r' && player.health <= 0) {
    restart();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

requestAnimationFrame(gameLoop);
