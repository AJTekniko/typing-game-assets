(() => {
  // ----- Config -----
  const CANVAS_W = 960;
  const CANVAS_H = 540;
  const INITIAL_LIVES = 3;
  const SPAWN_INTERVAL_BASE = 1600; // ms
  const WORDS = [
    "galaxy","orbit","thruster","comet","asteroid","nebula","quantum","stellar","warp","probe",
    "planet","cosmos","alien","rocket","eclipse","fusion","ion","module","solar","lunar",
    "drift","engine","shuttle","cargo","pilot","signal","relay","turbo","sensor","gravity",
    "binary","gamma","pulsar","satellite","vector","plasma","meteor","voyager","colony","frontier",
    "beacon","corsair","navigator","aster","flare","dock","hull","shield","laser","plasma"
  ];

  // ----- Game state -----
  const canvas = document.getElementById('gameCanvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const typingInput = document.getElementById('typing');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const scoreEl = document.getElementById('score');
  const activeEl = document.getElementById('active');
  const messageEl = document.getElementById('message');

  let running = false;
  let paused = false;
  let lastTime = 0;
  let spawnTimer = 0;
  let spawnInterval = SPAWN_INTERVAL_BASE;
  let enemies = [];
  let lives = INITIAL_LIVES;
  let score = 0;
  let level = 1;
  let maxEnemies = 5;
  let targetInput = ''; // current typed sequence
  let frameId = null;

  // utility
  function rand(min, max){ return Math.random()*(max-min)+min; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // Enemy class
  class Enemy {
    constructor(word, x, y, speed){
      this.word = word;
      this.x = x;
      this.y = y;
      this.speed = speed;
      this.progress = 0; // chars matched
      this.dead = false;
      this.w = 0;
      this.h = 0;
    }
    update(dt){
      this.y += this.speed * dt;
    }
    draw(ctx){
      // draw shadow/planet-approach color
      const alpha = Math.min(1, 0.35 + (this.y / CANVAS_H) * 0.65);
      ctx.save();
      ctx.translate(this.x, this.y);
      // hull
      ctx.fillStyle = `rgba(120,150,255,${0.08})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 70, 34, 0, 0, Math.PI*2);
      ctx.fill();
      // word background
      ctx.fillStyle = `rgba(10,12,25,0.6)`;
      ctx.roundRect(-60, -24, 120, 40, 8);
      ctx.fill();
      // word text: matched and remaining
      ctx.font = '18px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // matched
      const matched = this.word.slice(0, this.progress);
      const remain = this.word.slice(this.progress);
      // measure matched width to draw highlight
      const full = this.word;
      const fullW = ctx.measureText(full).width;
      const matchedW = ctx.measureText(matched).width;
      // highlight matched
      if(matched.length>0){
        ctx.fillStyle = 'rgba(110,231,183,0.12)';
        ctx.fillRect(-matchedW/2 - 4, -12, matchedW + 8, 24);
      }
      // draw matched text
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(matched + remain, 0, 0);
      // progress bar small
      ctx.fillStyle = '#16323a';
      ctx.fillRect(-40, 18, 80, 6);
      const pct = this.progress / Math.max(1, this.word.length);
      ctx.fillStyle = '#6ee7b7';
      ctx.fillRect(-40, 18, 80 * pct, 6);
      ctx.restore();
    }
  }

  // polyfill for roundRect
  CanvasRenderingContext2D.prototype.roundRect = CanvasRenderingContext2D.prototype.roundRect || function(x,y,w,h,r){
    if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
    else r = r || {tl:0,tr:0,br:0,bl:0};
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.lineTo(x + w - r.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    this.lineTo(x + w, y + h - r.br);
    this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    this.lineTo(x + r.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    this.lineTo(x, y + r.tl);
    this.quadraticCurveTo(x, y, x + r.tl, y);
    this.closePath();
  };

  // spawn enemy
  function spawnEnemy(){
    if(enemies.length >= maxEnemies) return;
    const word = pick(WORDS);
    const x = rand(80, CANVAS_W - 80);
    const y = -40;
    const speedBase = 20 + level*12;
    const speed = rand(speedBase*0.6, speedBase*1.1);
    enemies.push(new Enemy(word, x, y, speed));
  }

  // reset game
  function resetGame(){
    running = false;
    paused = false;
    enemies = [];
    lives = INITIAL_LIVES;
    score = 0;
    level = 1;
    maxEnemies = 5;
    spawnInterval = SPAWN_INTERVAL_BASE;
    targetInput = '';
    updateUI();
    message('Press Start to play', 3000);
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  function startGame(){
    if(running) return;
    running = true;
    paused = false;
    lastTime = performance.now();
    spawnTimer = 0;
    enemies = [];
    targetInput = '';
    updateUI();
    typingInput.value = '';
    typingInput.focus();
    message('Go!', 900);
    frameId = requestAnimationFrame(loop);
  }

  function pauseGame(){
    if(!running) return;
    paused = !paused;
    if(!paused){
      // resume
      lastTime = performance.now();
      frameId = requestAnimationFrame(loop);
      message('Resume', 600);
      typingInput.focus();
    } else {
      message('Paused', 600);
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function endGame(final=true){
    running = false;
    paused = false;
    cancelAnimationFrame(frameId);
    frameId = null;
    if(final){
      message(`Game Over — Score: ${score}`, 5000);
    }
  }

  // message display
  function message(text, time=1500){
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
    if(time>0){
      setTimeout(()=> messageEl.classList.add('hidden'), time);
    }
  }

  // choose target enemy based on current input
  function findBestTarget(input){
    if(!input) return null;
    // prefer the enemy closest to bottom whose word starts with input
    const candidates = enemies.filter(e => e.word.startsWith(input));
    if(candidates.length === 0) return null;
    candidates.sort((a,b) => (b.y - a.y)); // descending y => closest
    return candidates[0];
  }

  // update typed progress across enemies (progress applies only to targeted enemy)
  function applyTypingToTarget(input){
    const target = findBestTarget(input);
    // clear all progress first (we only give progress to the matched enemy with same prefix)
    enemies.forEach(e => {
      if(e !== target) e.progress = 0;
    });
    if(target){
      target.progress = input.length;
      // if fully matched
      if(target.progress >= target.word.length){
        // destroy
        destroyEnemy(target, true);
        targetInput = '';
        typingInput.value = '';
      }
    }
  }

  function destroyEnemy(enemy, byPlayer){
    enemy.dead = true;
    // explosion effect — quick simple score and level-up
    if(byPlayer){
      score += Math.round(10 + enemy.word.length * 2 + level*2);
    } else {
      // reached planet (handled elsewhere)
    }
    // remove after a tiny delay for visual
    setTimeout(()=> {
      const idx = enemies.indexOf(enemy);
      if(idx>=0) enemies.splice(idx,1);
    }, 60);
    updateUI();
  }

  function updateUI(){
    livesEl.textContent = lives;
    scoreEl.textContent = score;
    levelEl.textContent = level;
    activeEl.textContent = enemies.length;
  }

  // main loop
  function loop(now){
    if(!running || paused) return;
    const dt = Math.min(0.06, (now - lastTime)/1000); // seconds
    lastTime = now;

    // spawn logic
    spawnTimer += (now ? (now - (lastTime - dt*1000)) : 0); // approximate fallback, safe
    // simpler spawn: accumulate and spawn based on interval
    spawnTimer += (dt*1000);
    if(spawnTimer >= spawnInterval){
      spawnTimer = 0;
      spawnEnemy();
    }

    // update enemies
    enemies.forEach(e => e.update(dt));
    // check for enemies reaching bottom
    for(let i = enemies.length-1; i>=0; i--){
      const e = enemies[i];
      if(e.y > CANVAS_H - 40){
        // enemy hit planet
        destroyEnemy(e, false);
        lives -= 1;
        updateUI();
        if(lives <= 0){
          endGame(true);
          return;
        }
      }
      if(e.dead) continue;
    }

    // difficulty scaling: increase level based on score or time
    const newLevel = 1 + Math.floor(score / 150);
    if(newLevel !== level){
      level = newLevel;
      // increase max enemies and spawn speed
      maxEnemies = 5 + Math.min(12, level);
      spawnInterval = Math.max(500, SPAWN_INTERVAL_BASE - level * 80);
      message('Level ' + level, 800);
    }

    // draw
    drawFrame();

    // continue
    frameId = requestAnimationFrame(loop);
  }

  // draw background, planet, enemies, HUD overlays
  function drawFrame(){
    // clear
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

    // starfield background
    drawStarfield();

    // draw planet at bottom center
    const planetY = CANVAS_H - 10;
    ctx.save();
    const gx = ctx.createLinearGradient(0, CANVAS_H-120,0,CANVAS_H);
    gx.addColorStop(0,'#052535');
    gx.addColorStop(1,'#012028');
    ctx.fillStyle = gx;
    ctx.beginPath();
    ctx.ellipse(CANVAS_W/2, planetY, CANVAS_W/2 + 100, 120, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // draw enemies
    enemies.forEach(e => {
      e.draw(ctx);
    });

    // draw target input hint (overlay typed characters above canvas)
    ctx.save();
    ctx.font = '14px Inter, Arial';
    ctx.fillStyle = '#9fb3c7';
    ctx.textAlign = 'left';
    ctx.fillText('Current typing: ' + (targetInput || '-'), 12, 20);
    ctx.restore();
  }

  // simple starfield
  const stars = Array.from({length:40}, () => ({x: rand(0,CANVAS_W), y: rand(0,CANVAS_H), s: rand(0.5,1.8)}));
  function drawStarfield(){
    ctx.fillStyle = '#001823';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    for(const s of stars){
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + s.s*0.18) +')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI*2);
      ctx.fill();
      // animate slowly downward
      s.y += 0.2 * s.s;
      if(s.y > CANVAS_H) s.y = 0;
    }
  }

  // input handling
  typingInput.addEventListener('input', (e) => {
    if(!running) return;
    let val = typingInput.value.toLowerCase();
    // strip any whitespace inside; we only accept letters
    val = val.replace(/[^a-z]/g,'');
    typingInput.value = val;
    targetInput = val;
    applyTypingToTarget(targetInput);
  });

  // support Backspace/clear via keydown: if Escape clears current input
  typingInput.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      typingInput.value = '';
      targetInput = '';
      applyTypingToTarget('');
    }
  });

  // Start/pause/reset events
  startBtn.addEventListener('click', () => {
    startGame();
    typingInput.focus();
  });
  pauseBtn.addEventListener('click', () => {
    pauseGame();
  });
  resetBtn.addEventListener('click', () => {
    resetGame();
  });

  // focus input if player clicks canvas
  canvas.addEventListener('click', () => typingInput.focus());

  // initialize
  resetGame();

})();
