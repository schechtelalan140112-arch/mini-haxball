(() => {
  "use strict";

  // --- CONFIGURACIÓN DEL CANVAS Y ELEMENTOS ---
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreRedElem = document.getElementById("score-red");
  const scoreBlueElem = document.getElementById("score-blue");
  const timerElem = document.getElementById("timer");

  // --- ESTADO DEL JUEGO ---
  let scoreRed = 0;
  let scoreBlue = 0;
  let matchTime = 180; // 3 minutos
  let lastTime = performance.now();
  let timerInterval = null;

  // --- DIMENSIONES DE LA CANCHA ---
  const PITCH = {
    x: 50,
    y: 50,
    width: 700,
    height: 400,
    goalSize: 120
  };

  // --- ENTIDADES DEL JUEGO ---
  const playerRed = {
    x: 200,
    y: 250,
    vx: 0,
    vy: 0,
    radius: 18,
    color: "#ff4d4d",
    borderColor: "#b30000",
    speed: 5.5,
    friction: 0.88,
    kickPower: 11,
    isKicking: false
  };

  const playerBlue = {
    x: 600,
    y: 250,
    vx: 0,
    vy: 0,
    radius: 18,
    color: "#4d94ff",
    borderColor: "#0047b3",
    speed: 5.5,
    friction: 0.88,
    kickPower: 11,
    isKicking: false
  };

  const ball = {
    x: 400,
    y: 250,
    vx: 0,
    vy: 0,
    radius: 12,
    color: "#ffffff",
    borderColor: "#222222",
    friction: 0.985
  };

  // --- CONTROLES DE TECLADO ---
  const keys = {};

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  });

  // --- CONTROLES TÁCTILES ---
  const touchState = { up: false, down: false, left: false, right: false, kick: false };

  function bindTouch(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); touchState[key] = true; });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); touchState[key] = false; });
    btn.addEventListener("mousedown", () => { touchState[key] = true; });
    btn.addEventListener("mouseup", () => { touchState[key] = false; });
  }

  bindTouch("btn-up", "up");
  bindTouch("btn-down", "down");
  bindTouch("btn-left", "left");
  bindTouch("btn-right", "right");
  bindTouch("btn-kick", "kick");

  // --- REINICIAR POSICIONES TRAS UN GOL ---
  function resetPositions() {
    playerRed.x = 200;
    playerRed.y = PITCH.y + PITCH.height / 2;
    playerRed.vx = 0; playerRed.vy = 0;

    playerBlue.x = 600;
    playerBlue.y = PITCH.y + PITCH.height / 2;
    playerBlue.vx = 0; playerBlue.vy = 0;

    ball.x = PITCH.x + PITCH.width / 2;
    ball.y = PITCH.y + PITCH.height / 2;
    ball.vx = 0; ball.vy = 0;
  }

  // --- TEMPORIZADOR ---
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (matchTime > 0) {
        matchTime--;
        const mins = String(Math.floor(matchTime / 60)).padStart(2, "0");
        const secs = String(matchTime % 60).padStart(2, "0");
        timerElem.textContent = `${mins}:${secs}`;
      } else {
        clearInterval(timerInterval);
        alert(`¡Fin del partido!\nROJO: ${scoreRed} - AZUL: ${scoreBlue}`);
      }
    }, 1000);
  }

  // --- COLISIÓN FÍSICA ENTRE CÍRCULOS ---
  function handleCircleCollision(c1, c2, isPlayerBall = false) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = c1.radius + c2.radius;

    if (dist < minDist) {
      const angle = Math.atan2(dy, dx);
      const overlap = minDist - dist;

      const moveX = Math.cos(angle) * (overlap / 2);
      const moveY = Math.sin(angle) * (overlap / 2);

      c1.x -= moveX;
      c1.y -= moveY;
      c2.x += moveX;
      c2.y += moveY;

      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      const kx = c1.vx - c2.vx;
      const ky = c1.vy - c2.vy;
      const p = 2 * (nx * kx + ny * ky) / 2;

      c1.vx -= p * nx;
      c1.vy -= p * ny;
      c2.vx += p * nx;
      c2.vy += p * ny;

      // Si el jugador está presionando el botón de patear al tocar la pelota
      if (isPlayerBall && c1.isKicking) {
        c2.vx += nx * c1.kickPower;
        c2.vy += ny * c1.kickPower;
      }
    }
  }

  // --- ACTUALIZACIÓN (LÓGICA) ---
  function update() {
    // Control Jugador Rojo (WASD / Flechas / Celular)
    let moveX = 0;
    let moveY = 0;

    if (keys["w"] || keys["ArrowUp"] || touchState.up) moveY -= 1;
    if (keys["s"] || keys["ArrowDown"] || touchState.down) moveY += 1;
    if (keys["a"] || keys["ArrowLeft"] || touchState.left) moveX -= 1;
    if (keys["d"] || keys["ArrowRight"] || touchState.right) moveX += 1;

    playerRed.isKicking = keys[" "] || keys["Space"] || touchState.kick;

    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    playerRed.vx += moveX * playerRed.speed * 0.25;
    playerRed.vy += moveY * playerRed.speed * 0.25;

    // Fricción y movimiento Rojo
    playerRed.vx *= playerRed.friction;
    playerRed.vy *= playerRed.friction;
    playerRed.x += playerRed.vx;
    playerRed.y += playerRed.vy;

    // IA básica Jugador Azul (defiende y persigue la pelota)
    const dxBlue = ball.x - playerBlue.x;
    const dyBlue = ball.y - playerBlue.y;
    const distBlue = Math.hypot(dxBlue, dyBlue);
    if (distBlue > 10) {
      playerBlue.vx += (dxBlue / distBlue) * 0.35;
      playerBlue.vy += (dyBlue / distBlue) * 0.35;
    }
    playerBlue.vx *= playerBlue.friction;
    playerBlue.vy *= playerBlue.friction;
    playerBlue.x += playerBlue.vx;
    playerBlue.y += playerBlue.vy;

    // Fricción y movimiento de la Pelota
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Colisiones
    handleCircleCollision(playerRed, ball, true);
    handleCircleCollision(playerBlue, ball, true);
    handleCircleCollision(playerRed, playerBlue, false);

    // Límites de pared para jugadores
    [playerRed, playerBlue].forEach(p => {
      p.x = Math.max(PITCH.x + p.radius, Math.min(PITCH.x + PITCH.width - p.radius, p.x));
      p.y = Math.max(PITCH.y + p.radius, Math.min(PITCH.y + PITCH.height - p.radius, p.y));
    });

    // Límites y goles para la Pelota
    const goalTop = PITCH.y + (PITCH.height - PITCH.goalSize) / 2;
    const goalBottom = goalTop + PITCH.goalSize;

    // Borde superior e inferior
    if (ball.y - ball.radius <= PITCH.y) {
      ball.y = PITCH.y + ball.radius;
      ball.vy *= -0.8;
    }
    if (ball.y + ball.radius >= PITCH.y + PITCH.height) {
      ball.y = PITCH.y + PITCH.height - ball.radius;
      ball.vy *= -0.8;
    }

    const isInGoalArea = ball.y > goalTop && ball.y < goalBottom;

    // Arco Izquierdo
    if (ball.x - ball.radius <= PITCH.x) {
      if (isInGoalArea) {
        scoreBlue++;
        scoreBlueElem.textContent = scoreBlue;
        resetPositions();
        return;
      } else {
        ball.x = PITCH.x + ball.radius;
        ball.vx *= -0.8;
      }
    }

    // Arco Derecho
    if (ball.x + ball.radius >= PITCH.x + PITCH.width) {
      if (isInGoalArea) {
        scoreRed++;
        scoreRedElem.textContent = scoreRed;
        resetPositions();
        return;
      } else {
        ball.x = PITCH.x + PITCH.width - ball.radius;
        ball.vx *= -0.8;
      }
    }
  }

  // --- RENDERIZADO (DIBUJO) ---
  function draw() {
    ctx.fillStyle = "#55a630";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;

    // Línea exterior del campo
    ctx.strokeRect(PITCH.x, PITCH.y, PITCH.width, PITCH.height);

    // Línea central
    ctx.beginPath();
    ctx.moveTo(PITCH.x + PITCH.width / 2, PITCH.y);
    ctx.lineTo(PITCH.x + PITCH.width / 2, PITCH.y + PITCH.height);
    ctx.stroke();

    // Círculo central
    ctx.beginPath();
    ctx.arc(PITCH.x + PITCH.width / 2, PITCH.y + PITCH.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Red de Arcos
    const goalTop = PITCH.y + (PITCH.height - PITCH.goalSize) / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(PITCH.x - 20, goalTop, 20, PITCH.goalSize);
    ctx.fillRect(PITCH.x + PITCH.width, goalTop, 20, PITCH.goalSize);

    ctx.strokeRect(PITCH.x - 20, goalTop, 20, PITCH.goalSize);
    ctx.strokeRect(PITCH.x + PITCH.width, goalTop, 20, PITCH.goalSize);

    // Dibujar Entidades
    function drawCircle(obj) {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = obj.borderColor;
      ctx.stroke();

      // Halo blanco al patear
      if (obj.isKicking) {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    drawCircle(playerRed);
    drawCircle(playerBlue);
    drawCircle(ball);
  }

  // --- GAME LOOP ---
  function gameLoop(currentTime) {
    let deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    update();
    draw();

    requestAnimationFrame(gameLoop);
  }

  // Inicio
  resetPositions();
  startTimer();
  requestAnimationFrame(gameLoop);
})();
