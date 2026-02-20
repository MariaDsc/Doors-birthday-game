// =============================================
//  CONFIGURAÇÕES GLOBAIS
// =============================================
const GAME_W = 900;
const GAME_H = 500;

const COLORS = {
  bg:          0x0a0a0f,
  floor:       0x1a1a28,
  floorEdge:   0x2a2840,
  wall:        0x111120,
  wallDetail:  0x1e1e32,
  player:      0xd0c8f0,
  playerEye:   0x9988dd,
  door:        0x3a2a5a,
  doorFrame:   0x6644aa,
  doorGlow:    0x9966ff,
  platform:    0x22203a,
  platformTop: 0x3a3060,
  torch:       0xffaa33,
  torchGlow:   0xff7700,
  highlight:   0x8866cc,
  danger:      0xe05555,
  text:        0xc0aae8,
  shadow:      0x050508,
};

let playerHealth = 4;
let currentDoor  = 1;
let gameState    = 'playing';

// =============================================
//  FUNÇÕES AUXILIARES (UI)
// =============================================
function updateHealthUI() {
  for (let i = 1; i <= 4; i++) {
    const h = document.getElementById('h' + i);
    if (h) h.classList.toggle('empty', i > playerHealth);
  }
}

function updateDoorCounter(num) {
  const el = document.getElementById('door-num');
  if (el) el.textContent = String(num).padStart(3, '0');
}

function showPhaseTitle(text) {
  const el = document.getElementById('phase-title');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// =============================================
//  CLASSE BootScene (TELA INICIAL)
// =============================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // Carrega o sprite do jogador
    this.load.spritesheet('player_run', 'assets/player.png', {
      frameWidth: 96,
      frameHeight: 96
    });
  }

  create() {
    // Cria as animações
    if (this.textures.exists('player_run')) {
      this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('player_run', { start: 0, end: 9 }),
        frameRate: 12,
        repeat: -1
      });
      this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('player_run', { start: 1, end: 1 }),
        frameRate: 1,
        repeat: -1
      });
      this.anims.create({
        key: 'jump',
        frames: this.anims.generateFrameNumbers('player_run', { start: 4, end: 4 }),
        frameRate: 1,
        repeat: -1
      });
    }

    const g = this.add.graphics();

    // Fundo
    g.fillStyle(COLORS.bg);
    g.fillRect(0, 0, GAME_W, GAME_H);

    // Efeito vinheta
    for (let i = 0; i < 60; i++) {
      const alpha = (i / 60) * 0.6;
      g.lineStyle(2, 0x000000, alpha);
      g.strokeRect(i, i, GAME_W - i*2, GAME_H - i*2);
    }

    // Título
    const title = this.add.text(GAME_W/2, GAME_H/2 - 60, 'DOORS', {
      fontSize: '72px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 20,
    }).setOrigin(0.5);

    const subtitle = this.add.text(GAME_W/2, GAME_H/2 + 10, '-- BIRTHDAY EDITION --', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#6655aa',
      letterSpacing: 6,
    }).setOrigin(0.5);

    const hint = this.add.text(GAME_W/2, GAME_H/2 + 80, 'PRESSIONE QUALQUER TECLA', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#44445a',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // Animação da dica (piscando)
    this.tweens.add({
      targets: hint,
      alpha: 0.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Animação do título (brilho)
    this.tweens.add({
      targets: title,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Aguarda tecla para começar
    this.input.keyboard.once('keydown', () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(620, () => this.scene.start('Phase1Scene'));
    });
  }

  drawDoor(g, x, y, w, h, alpha) {
    g.fillStyle(COLORS.doorFrame, alpha);
    g.fillRect(x - w/2 - 4, y - h - 4, w + 8, h + 4);
    g.fillStyle(COLORS.door, alpha * 1.5);
    g.fillRect(x - w/2, y - h, w, h);
    g.fillStyle(COLORS.doorGlow, alpha * 2);
    g.fillCircle(x + w/2 - 5, y - h/2, 3);
  }
}

// =============================================
//  CLASSE Phase1Scene (TUTORIAL)
// =============================================
class Phase1Scene extends Phaser.Scene {
  constructor() { super({ key: 'Phase1Scene' }); }

  create() {
    currentDoor = 1;
    updateDoorCounter(1);
    showPhaseTitle('FASE 1 -- O CORREDOR');

    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0f');

    // Limites do mundo (cenário rolável)
    this.physics.world.setBounds(0, 0, 2400, GAME_H);
    this.cameras.main.setBounds(0, 0, 2400, GAME_H);

    this.buildLevel();
    this.createPlayer();
    this.createDoors();
    this.createTorches();
    this.createDecorations();
    this.setupControls();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Textos de tutorial
    this.tutorialTexts = [];
    this.createTutorial();

    // Colisões
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.doorZones, this.enterDoor, null, this);

    this.transitioning = false;
  }

  buildLevel() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();

    const floorY = GAME_H - 60;

    // Chão principal
    g.fillStyle(COLORS.floor);
    g.fillRect(0, floorY, 2400, 60);
    g.fillStyle(COLORS.floorEdge);
    g.fillRect(0, floorY, 2400, 4);
    g.fillStyle(COLORS.wall);
    g.fillRect(0, 0, 2400, floorY);

    // Física do chão
    const floor = this.add.rectangle(1200, floorY + 30, 2400, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas flutuantes
    const platData = [
      { x: 300, y: 340, w: 120 },
      { x: 520, y: 280, w: 100 },
      { x: 750, y: 320, w: 140 },
      { x: 1050, y: 260, w: 100 },
      { x: 1300, y: 310, w: 120 },
      { x: 1600, y: 270, w: 100 },
      { x: 1850, y: 300, w: 130 },
      { x: 2100, y: 250, w: 110 },
    ];

    platData.forEach(p => {
      // Desenho da plataforma
      g.fillStyle(COLORS.platform);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(COLORS.platformTop);
      g.fillRect(p.x, p.y, p.w, 3);
      
      // Física da plataforma
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Detalhes da parede
    for (let x = 0; x < 2400; x += 200) {
      g.fillStyle(COLORS.wallDetail, 0.5);
      g.fillRect(x, 30, 3, floorY - 30);
    }
  }

  createTorches() {
    const g = this.add.graphics();
    const torchPositions = [80, 240, 480, 700, 950, 1150, 1400, 1650, 1900, 2150, 2350];
    const floorY = GAME_H - 60;

    torchPositions.forEach(x => {
      // Suporte da tocha
      g.fillStyle(0x443333);
      g.fillRect(x - 2, floorY - 140, 4, 30);
      g.fillRect(x - 8, floorY - 145, 16, 4);
      
      // Chama
      g.fillStyle(COLORS.torchGlow, 0.9);
      g.fillCircle(x, floorY - 152, 7);
      g.fillStyle(COLORS.torch, 0.8);
      g.fillCircle(x, floorY - 155, 4);

      // Brilho animado
      const glow = this.add.rectangle(x, GAME_H - 60 - 152, 30, 30, COLORS.torchGlow, 0.08);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.03, to: 0.13 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: Phaser.Math.Between(400, 700),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  createDecorations() {
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    // Quadros na parede
    const paintingPositions = [160, 450, 820, 1100, 1450, 1750, 2050, 2300];
    paintingPositions.forEach(x => {
      g.lineStyle(3, COLORS.highlight, 0.5);
      g.strokeRect(x, floorY - 200, 60, 80);
      g.fillStyle(0x0d0d18, 0.8);
      g.fillRect(x + 3, floorY - 197, 54, 74);
    });

    // Sombras no chão
    for (let x = 100; x < 2400; x += 200) {
      g.fillStyle(0x000000, 0.15);
      g.fillEllipse(x, floorY + 5, 80, 10);
    }
  }

  createDoors() {
    this.doorZones = this.physics.add.staticGroup();
    const floorY = GAME_H - 60;
    const g = this.add.graphics();

    const doors = [
      { x: 2300, label: '001', locked: false },
    ];

    doors.forEach(d => {
      const dw = 55, dh = 95;
      const dx = d.x, dy = floorY - dh;

      // Moldura da porta
      g.fillStyle(COLORS.doorFrame);
      g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
      
      // Porta
      g.fillStyle(COLORS.door);
      g.fillRect(dx, dy, dw, dh);
      
      // Detalhes
      g.lineStyle(1, COLORS.highlight, 0.3);
      g.strokeRect(dx + 5, dy + 5, dw - 10, (dh - 15) / 2);
      g.strokeRect(dx + 5, dy + 10 + (dh - 15) / 2, dw - 10, (dh - 15) / 2 - 5);
      
      // Maçaneta
      g.fillStyle(COLORS.doorGlow);
      g.fillCircle(dx + dw - 10, dy + dh/2, 4);
      
      // Número da porta
      this.add.text(dx + dw/2, dy - 18, d.label, {
        fontSize: '11px',
        fontFamily: 'Courier New',
        color: '#8866cc',
        letterSpacing: 2,
      }).setOrigin(0.5);

      // Brilho animado
      const glow = this.add.rectangle(dx + dw/2, dy + dh/2, dw + 20, dh + 20, COLORS.doorGlow, 0.06);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.03, to: 0.10 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Zona de colisão
      const zone = this.add.rectangle(dx + dw/2, dy + dh/2, dw, dh).setVisible(false);
      this.physics.add.existing(zone, true);
      this.doorZones.add(zone);
      zone.doorLabel = d.label;
    });
  }

  createPlayer() {
    const floorY = GAME_H - 60;
    this.player = this.physics.add.sprite(80, floorY - 40, null);
    this.player.setVisible(false);
    this.player.body.setSize(24, 40);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setGravityY(700);
    this.player.body.setMaxVelocityY(900);

    this.playerGfx = this.add.graphics();
    this.playerShadow = this.add.graphics();
    this.drawPlayer(this.playerGfx, 0, 0, false);
  }

  drawPlayer(g, x, y, facingLeft) {
    g.clear();
    
    // Corpo
    g.fillStyle(COLORS.player);
    g.fillRect(x - 10, y - 38, 20, 28);
    
    // Cabeça
    g.fillRect(x - 9, y - 58, 18, 18);
    
    // Olhos
    g.fillStyle(COLORS.playerEye);
    const ex = facingLeft ? x - 5 : x + 2;
    g.fillRect(ex, y - 53, 4, 4);
    
    // Pernas
    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 8, y - 10, 7, 12);
    g.fillRect(x + 1, y - 10, 7, 12);
    
    // Braços
    g.fillRect(x - 14, y - 36, 5, 20);
    g.fillRect(x + 9, y - 36, 5, 20);
    
    // Detalhe da camisa
    g.fillStyle(COLORS.highlight, 0.3);
    g.fillRect(x - 8, y - 36, 16, 3);
  }

  createTutorial() {
    const tips = [
      { x: 80,  y: GAME_H - 110, text: '<- -> para mover' },
      { x: 300, y: 300,          text: 'ESPAÇO ou ^ para pular' },
      { x: 700, y: GAME_H - 110, text: 'Explore as salas...' },
      { x: 2200, y: GAME_H - 110, text: 'E para entrar na porta' },
    ];

    tips.forEach(t => {
      const txt = this.add.text(t.x, t.y, t.text, {
        fontSize: '11px',
        fontFamily: 'Courier New',
        color: '#44445a',
        letterSpacing: 1,
      }).setOrigin(0.5);
      this.tutorialTexts.push({ text: txt, baseX: t.x });
    });
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left:   Phaser.Input.Keyboard.KeyCodes.A,
      right:  Phaser.Input.Keyboard.KeyCodes.D,
      jump:   Phaser.Input.Keyboard.KeyCodes.W,
      action: Phaser.Input.Keyboard.KeyCodes.E,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft = false;
    this.isNearDoor = false;
    this.doorPrompt = null;
  }

  enterDoor(player, door) {
    if (this.transitioning) return;
    this.isNearDoor = true;
    
    if (!this.doorPrompt) {
      this.doorPrompt = this.add.text(
        this.player.x, this.player.y - 70, '[E] Entrar',
        { fontSize: '15px', fontFamily: 'Courier New', color: '#ddbbff', letterSpacing: 2 }
      ).setOrigin(0.5);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.transitioning = true;
      if (this.doorPrompt) { this.doorPrompt.destroy(); this.doorPrompt = null; }
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(650, () => {
        currentDoor = 2;
        updateDoorCounter(currentDoor);
        this.scene.start('Phase2Scene');
      });
    }
  }

  update() {
    if (this.transitioning) return;

    const onGround = this.player.body.blocked.down;
    const speed = 200;
    let moving = false;

    // Movimento horizontal
    if (this.cursors.left.isDown || this.keys.left.isDown) {
      this.player.body.setVelocityX(-speed);
      this.facingLeft = true;
      moving = true;
    } else if (this.cursors.right.isDown || this.keys.right.isDown) {
      this.player.body.setVelocityX(speed);
      this.facingLeft = false;
      moving = true;
    } else {
      this.player.body.setVelocityX(0);
    }

    // Pulo
    const jumpPressed = this.cursors.up.isDown || this.keys.jump.isDown || this.spaceKey.isDown;
    if (jumpPressed && onGround) {
      this.player.body.setVelocityY(-480);
    }

    // Desenha o jogador
    this.drawPlayer(this.playerGfx, this.player.x, this.player.y, this.facingLeft);

    // Sombra
    this.playerShadow.clear();
    this.playerShadow.fillStyle(0x000000, 0.25);
    this.playerShadow.fillEllipse(this.player.x, GAME_H - 62, 34, 10);

    // Atualiza prompt da porta
    this.isNearDoor = false;
    if (this.doorPrompt) {
      this.doorPrompt.x = this.player.x;
      this.doorPrompt.y = this.player.y - 70;
    }
  }
}

// =============================================
//  CLASSE Phase2Scene (JEREMIAH)
// =============================================
class Phase2Scene extends Phaser.Scene {
  constructor() { super({ key: 'Phase2Scene' }); }

  create() {
    updateDoorCounter(2);
    showPhaseTitle('FASE 2 -- Hi, Bells...');

    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#070710');

    this.physics.world.setBounds(0, 0, 2000, GAME_H);
    this.cameras.main.setBounds(0, 0, 2000, GAME_H);

    this.buildLevel();
    this.createPlayer();
    this.createJeremiah();
    this.createExitDoor();
    this.setupControls();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.jeremiah, this.platforms);
    this.physics.add.overlap(this.player, this.exitZone, this.tryExitDoor, null, this);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.transitioning = false;
    this.inWardrobe = false;
    this.hitCooldown = false;
    this.hidePrompt = null;
  }

  buildLevel() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    // Fundo escuro
    g.fillStyle(0x070710);
    g.fillRect(0, 0, 2000, GAME_H);

    // Chão
    g.fillStyle(0x111122);
    g.fillRect(0, floorY, 2000, 60);
    g.fillStyle(0x1a1a30);
    g.fillRect(0, floorY, 2000, 3);

    // Teto
    g.fillStyle(0x050510);
    g.fillRect(0, 0, 2000, 30);

    // Física do chão
    const floor = this.add.rectangle(1000, floorY + 30, 2000, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platData = [
      { x: 200, y: 330, w: 120 },
      { x: 500, y: 270, w: 100 },
      { x: 800, y: 310, w: 140 },
      { x: 1100, y: 250, w: 100 },
      { x: 1400, y: 290, w: 120 },
      { x: 1700, y: 260, w: 110 },
    ];

    platData.forEach(p => {
      g.fillStyle(0x161628);
      g.fillRect(p.x, p.y, p.w, 14);
      g.fillStyle(0x2a2848, 0.8);
      g.fillRect(p.x, p.y, p.w, 3);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 7, p.w, 14).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Armários (esconderijos)
    this.wardrobes = [];
    const wardrobePos = [150, 600, 1000, 1500, 1850];
    wardrobePos.forEach(x => {
      g.fillStyle(0x2a1a1a);
      g.fillRect(x, floorY - 80, 36, 80);
      g.lineStyle(1, 0x553333, 0.8);
      g.strokeRect(x, floorY - 80, 36, 80);
      
      const zone = this.add.zone(x + 18, floorY - 40, 50, 80);
      this.physics.add.existing(zone, true);
      this.wardrobes.push(zone);
    });
  }

  createJeremiah() {
    const floorY = GAME_H - 60;
    this.jeremiah = this.physics.add.sprite(900, floorY - 60, null).setVisible(false);
    this.jeremiah.body.setSize(30, 60);
    this.jeremiah.setCollideWorldBounds(true);
    this.jeremiah.body.setGravityY(400);

    this.jeremiahGfx = this.add.graphics();
    this.jeremiahDir = 1;
    this.jeremiahSpeed = 80;
    this.jeremiahLooking = false;

    this.hibells = this.add.text(0, 0, '"Hi, Bells..."', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#aaffaa',
      backgroundColor: '#0a1a0a',
      padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
  }

  drawJeremiah(x, y, isLooking) {
    const g = this.jeremiahGfx;
    g.clear();
    
    const color = isLooking ? 0x88ff88 : 0x447744;
    
    // Corpo
    g.fillStyle(color, isLooking ? 0.9 : 0.7);
    g.fillRect(x - 12, y - 58, 24, 35);
    
    // Cabeça
    g.fillStyle(color, isLooking ? 1 : 0.8);
    g.fillRect(x - 10, y - 82, 20, 22);
    
    // Olhos
    g.fillStyle(0xeeffee);
    g.fillCircle(x - 4, y - 72, isLooking ? 5 : 3);
    g.fillCircle(x + 4, y - 72, isLooking ? 5 : 3);
    
    // Pupilas
    g.fillStyle(0x00aa00);
    g.fillCircle(x - 4, y - 72, isLooking ? 2 : 1);
    g.fillCircle(x + 4, y - 72, isLooking ? 2 : 1);
    
    // Pernas
    g.fillStyle(color, 0.7);
    g.fillRect(x - 10, y - 22, 9, 22);
    g.fillRect(x + 1, y - 22, 9, 22);
    
    // Braços
    g.fillRect(x - 18, y - 56, 6, 28);
    g.fillRect(x + 12, y - 56, 6, 28);
  }

  checkJeremiahLOS() {
    if (this.inWardrobe) { 
      this.jeremiahLooking = false; 
      return; 
    }

    const jx = this.jeremiah.x;
    const px = this.player.x;
    const dy = Math.abs(this.player.y - this.jeremiah.y);

    const facingRight = this.jeremiahDir > 0;
    const playerInFront = facingRight ? (px > jx && px - jx < 220) : (px < jx && jx - px < 220);
    const inRange = playerInFront && dy < 90;

    if (inRange && !this.hitCooldown) {
      this.jeremiahLooking = true;

      this.hibells.setPosition(jx, this.jeremiah.y - 110).setAlpha(1);
      this.tweens.killTweensOf(this.hibells);
      this.tweens.add({ targets: this.hibells, alpha: 0, duration: 1000, delay: 1000 });

      this.hitCooldown = true;
      playerHealth = Math.max(0, playerHealth - 2);
      updateHealthUI();

      const flash = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0x00ff00, 0.25).setScrollFactor(0).setDepth(25);
      this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });

      if (playerHealth <= 0) {
        this.transitioning = true;
        this.time.delayedCall(600, () => this.scene.start('GameOverScene'));
      }

      this.time.delayedCall(4000, () => { this.hitCooldown = false; });
    } else if (!inRange) {
      this.jeremiahLooking = false;
    }
  }

  createExitDoor() {
    const floorY = GAME_H - 60;
    const g = this.add.graphics();
    const dx = 1900, dw = 55, dh = 95, dy = floorY - dh;

    g.fillStyle(COLORS.doorFrame);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.add.text(dx + dw/2, dy - 18, '002', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    const glow = this.add.rectangle(dx + dw/2, dy + dh/2, dw + 20, dh + 20, COLORS.doorGlow, 0.06);
    this.tweens.add({ targets: glow, alpha: { from: 0.03, to: 0.10 }, duration: 1200, yoyo: true, repeat: -1 });

    this.exitZone = this.add.rectangle(dx + dw/2, dy + dh/2, dw, dh).setVisible(false);
    this.physics.add.existing(this.exitZone, true);
  }

  tryExitDoor(player, door) {
    if (this.transitioning) return;
    
    if (!this.exitPrompt) {
      this.exitPrompt = this.add.text(
        this.player.x, this.player.y - 70, '[E] Entrar',
        { fontSize: '15px', fontFamily: 'Courier New', color: '#ddbbff', letterSpacing: 2 }
      ).setOrigin(0.5).setDepth(10);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.transitioning = true;
      if (this.exitPrompt) { this.exitPrompt.destroy(); this.exitPrompt = null; }
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(650, () => {
        currentDoor = 3;
        updateDoorCounter(currentDoor);
        this.scene.start('Phase3Scene');
      });
    }
  }

  createPlayer() {
    const floorY = GAME_H - 60;
    this.player = this.physics.add.sprite(80, floorY - 40, null).setVisible(false);
    this.player.body.setSize(24, 40);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(700);
    this.player.body.setMaxVelocityY(900);
    this.playerGfx = this.add.graphics().setDepth(5);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      action: Phaser.Input.Keyboard.KeyCodes.E,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft = false;
    this.exitPrompt = null;
  }

  drawPlayer(x, y, facingLeft, inWardrobe) {
    const g = this.playerGfx;
    g.clear();
    
    if (inWardrobe) {
      g.fillStyle(0x331111, 0.6);
      g.fillRect(x - 6, y - 30, 12, 30);
      return;
    }
    
    g.fillStyle(COLORS.player);
    g.fillRect(x - 10, y - 38, 20, 28);
    g.fillRect(x - 9, y - 58, 18, 18);
    g.fillStyle(COLORS.playerEye);
    const ex = facingLeft ? x - 5 : x + 2;
    g.fillRect(ex, y - 53, 4, 4);
    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 8, y - 10, 7, 12);
    g.fillRect(x + 1, y - 10, 7, 12);
    g.fillRect(x - 14, y - 36, 5, 20);
    g.fillRect(x + 9, y - 36, 5, 20);
  }

  update() {
    if (this.transitioning) return;

    const onGround = this.player.body.blocked.down;
    const speed = 200;

    // Verifica se está perto de armário
    let nearWardrobe = false;
    this.wardrobes.forEach(w => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, w.x, w.y);
      if (dist < 70) nearWardrobe = true;
    });

    // Mostra dica do armário
    if (nearWardrobe && !this.wardrobeHint) {
      this.wardrobeHint = this.add.text(this.player.x, this.player.y - 70, '[E] Entrar no armario',
        { fontSize: '11px', fontFamily: 'Courier New', color: '#aa8866', letterSpacing: 1 }
      ).setOrigin(0.5).setDepth(10);
    } else if (!nearWardrobe && this.wardrobeHint) {
      this.wardrobeHint.destroy(); this.wardrobeHint = null;
    }
    if (this.wardrobeHint) { 
      this.wardrobeHint.x = this.player.x; 
      this.wardrobeHint.y = this.player.y - 70; 
    }

    // Entrar/sair do armário
    if (nearWardrobe && Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.inWardrobe = !this.inWardrobe;
      this.player.body.setAllowGravity(!this.inWardrobe);
      if (this.inWardrobe) this.player.body.setVelocity(0, 0);
    }

    // Movimento (se não estiver no armário)
    if (!this.inWardrobe) {
      this.player.body.setAllowGravity(true);
            if (this.cursors.left.isDown || this.keys.left.isDown) {
        this.player.body.setVelocityX(-speed);
        this.facingLeft = true;
      } else if (this.cursors.right.isDown || this.keys.right.isDown) {
        this.player.body.setVelocityX(speed);
        this.facingLeft = false;
      } else {
        this.player.body.setVelocityX(0);
      }
      
      if ((this.cursors.up.isDown || this.keys.jump.isDown || this.spaceKey.isDown) && onGround) {
        this.player.body.setVelocityY(-480);
      }
    } else {
      this.player.body.setAllowGravity(false);
      this.player.body.setVelocity(0, 0);
    }

    // Desenha o jogador
    this.drawPlayer(this.player.x, this.player.y, this.facingLeft, this.inWardrobe);

    // Movimento do Jeremiah
    this.jeremiah.body.setVelocityX(this.jeremiahSpeed * this.jeremiahDir);
    if (this.jeremiah.x > 1700 || this.jeremiah.x < 200) {
      this.jeremiahDir *= -1;
      this.jeremiah.x = this.jeremiah.x > 1700 ? 1699 : 201;
    }
    this.drawJeremiah(this.jeremiah.x, this.jeremiah.y, this.jeremiahLooking);
    this.checkJeremiahLOS();

    // Atualiza prompts
    if (this.exitPrompt) {
      this.exitPrompt.x = this.player.x;
      this.exitPrompt.y = this.player.y - 70;
    }
    if (this.hidePrompt) {
      this.hidePrompt.x = this.player.x;
      this.hidePrompt.y = this.player.y - 80;
    }
  }
}

// =============================================
//  CLASSE Phase3Scene (SALA DO SALMÃO)
// =============================================
class Phase3Scene extends Phaser.Scene {
  constructor() { super({ key: 'Phase3Scene' }); }

  create() {
    updateDoorCounter(3);
    showPhaseTitle('FASE 3 -- A SALA DO SALMÃO');

    this.cameras.main.fadeIn(800, 0, 0, 10);
    this.cameras.main.setBackgroundColor('#0a1015');

    this.physics.world.setBounds(0, 0, 1200, GAME_H);
    this.cameras.main.setBounds(0, 0, 1200, GAME_H);

    this.timeLeft = 30;
    this.keyFound = false;
    this.waterLevel = GAME_H + 100;
    this.transitioning = false;
    this.gameActive = false;

    this.buildRoom();
    this.createPlayer();
    this.createHiddenKey();
    this.createWater();
    this.createExitDoor();
    this.createSalmons();
    this.setupControls();
    this.createTimerUI();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.keyItem, this.collectKey, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.tryExit, null, this);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.time.delayedCall(2000, () => {
      this.gameActive = true;
      this.startTimer();
    });

    const warn = this.add.text(600, GAME_H/2 - 30, '(!) ENCONTRE A CHAVE ANTES QUE A ÁGUA SUBA!', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#55aaff',
      letterSpacing: 2, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.tweens.add({ targets: warn, alpha: 0, duration: 1000, delay: 1800, onComplete: () => warn.destroy() });
  }

  buildRoom() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    g.fillStyle(0x050d14);
    g.fillRect(0, 0, 1200, GAME_H);

    for (let i = 0; i < 40; i++) {
      const bx = Phaser.Math.Between(20, 1180);
      const by = Phaser.Math.Between(50, floorY - 20);
      g.fillStyle(0x1155aa, 0.15);
      g.fillCircle(bx, by, Phaser.Math.Between(2, 6));
    }

    g.fillStyle(0x0d1e2a);
    g.fillRect(0, floorY, 1200, 60);
    g.fillStyle(0x1a3444);
    g.fillRect(0, floorY, 1200, 3);

    g.fillStyle(0x050d14);
    g.fillRect(0, 0, 1200, 30);

    const floor = this.add.rectangle(600, floorY + 30, 1200, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    const platData = [
      { x: 100, y: 350, w: 150 },
      { x: 350, y: 280, w: 120 },
      { x: 580, y: 200, w: 130 },
      { x: 800, y: 300, w: 110 },
      { x: 950, y: 200, w: 100 },
      { x: 200, y: 160, w: 120 },
      { x: 700, y: 130, w: 100 },
    ];

    platData.forEach(p => {
      g.fillStyle(0x122230);
      g.fillRect(p.x, p.y, p.w, 14);
      g.fillStyle(0x1e3a50);
      g.fillRect(p.x, p.y, p.w, 3);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 7, p.w, 14).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    g.fillStyle(0x080f18);
    g.fillRect(0, 0, 20, GAME_H);
    g.fillRect(1180, 0, 20, GAME_H);

    const wallL = this.add.rectangle(10, GAME_H/2, 20, GAME_H).setVisible(false);
    this.physics.add.existing(wallL, true);
    this.platforms.add(wallL);
    const wallR = this.add.rectangle(1190, GAME_H/2, 20, GAME_H).setVisible(false);
    this.physics.add.existing(wallR, true);
    this.platforms.add(wallR);
  }

  createWater() {
    this.waterGfx = this.add.graphics().setDepth(3);
    this.waterLevel = GAME_H + 50;
  }

  updateWater() {
    if (!this.gameActive) return;
    
    const elapsed = 30 - this.timeLeft;
    const riseSpeed = 0.15 + elapsed * 0.03;
    this.waterLevel -= riseSpeed;

    const g = this.waterGfx;
    g.clear();
    
    g.fillStyle(0x0044aa, 0.4);
    g.fillRect(0, this.waterLevel, 1200, GAME_H - this.waterLevel + 100);
    g.fillStyle(0x2266cc, 0.25);
    g.fillRect(0, this.waterLevel, 1200, 6);
    g.fillStyle(0x44aaff, 0.12);
    g.fillRect(0, this.waterLevel + 3, 1200, 3);

    if (this.player.y > this.waterLevel && !this.transitioning) {
      this.transitioning = true;
      playerHealth = Math.max(0, playerHealth - 1);
      updateHealthUI();
      this.cameras.main.fadeOut(600, 0, 20, 60);
      this.time.delayedCall(650, () => {
        if (playerHealth <= 0) this.scene.start('GameOverScene');
        else this.scene.start('Phase3Scene');
      });
    }
  }

  createHiddenKey() {
    const keyX = 720, keyY = 105;
    const g = this.add.graphics().setDepth(4);
    
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(keyX, keyY, 8);
    g.fillStyle(0xffaa00);
    g.fillCircle(keyX, keyY, 5);
    g.fillRect(keyX + 2, keyY, 18, 4);
    g.fillRect(keyX + 14, keyY + 4, 4, 4);
    g.fillRect(keyX + 18, keyY + 4, 4, 4);

    const glow = this.add.rectangle(keyX, keyY, 24, 24, 0xffdd44, 0.06).setDepth(3);
    this.tweens.add({ targets: glow, alpha: { from: 0.02, to: 0.1 }, duration: 800, yoyo: true, repeat: -1 });

    const hint = this.add.text(keyX, keyY - 22, '?', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#443300', letterSpacing: 1
    }).setOrigin(0.5).setDepth(4);

    this.keyItem = this.add.zone(keyX, keyY, 24, 24).setDepth(4);
    this.physics.add.existing(this.keyItem, true);
    this.keyGfx = g;
    this.keyHint = hint;
    this.keyGlow = glow;
  }

  collectKey(player, key) {
    if (this.keyFound) return;
    this.keyFound = true;
    this.keyGfx.destroy();
    this.keyGlow.destroy();
    this.keyHint.destroy();

    const msg = this.add.text(600, GAME_H/2 - 20, '(ok) Chave encontrada! Vá para a saída!', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#ffdd44',
      letterSpacing: 2, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.tweens.add({ targets: msg, alpha: 0, duration: 800, delay: 2000, onComplete: () => msg.destroy() });

    this.tweens.add({ targets: this.exitGlow, alpha: 0.2, duration: 500 });
  }

  createExitDoor() {
    const floorY = GAME_H - 60;
    const g = this.add.graphics().setDepth(2);
    const dx = 1100, dw = 55, dh = 95, dy = floorY - dh;

    g.fillStyle(COLORS.doorFrame, 0.5);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door, 0.5);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow, 0.5);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.exitGlow = this.add.rectangle(dx + dw/2, dy + dh/2, dw + 20, dh + 20, COLORS.doorGlow, 0.04).setDepth(2);

    this.add.text(dx + dw/2, dy - 18, '003', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#8866cc', letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    this.exitZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh).setDepth(5);
    this.physics.add.existing(this.exitZone, true);
  }

  tryExit(player, door) {
    if (this.transitioning) return;
    
    if (!this.keyFound) {
      if (!this.noKeyMsg) {
        this.noKeyMsg = this.add.text(
          this.player.x, this.player.y - 70, 'Precisa da chave!',
          { fontSize: '15px', fontFamily: 'Courier New', color: '#ff6666', letterSpacing: 1 }
        ).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(1500, () => { if (this.noKeyMsg) { this.noKeyMsg.destroy(); this.noKeyMsg = null; } });
      }
      return;
    }
    
    if (!this.exitPrompt) {
      this.exitPrompt = this.add.text(
        this.player.x, this.player.y - 70, '[E] Sair!',
        { fontSize: '12px', fontFamily: 'Courier New', color: '#ffdd44', letterSpacing: 2 }
      ).setOrigin(0.5).setDepth(20);
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.transitioning = true;
      if (this.exitPrompt) { this.exitPrompt.destroy(); this.exitPrompt = null; }
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(650, () => {
        currentDoor = 4;
        updateDoorCounter(currentDoor);
        this.scene.start('Phase4Scene');
      });
    }
  }

  createSalmons() {
    this.salmons = [];
    this.salmonGfx = this.add.graphics().setDepth(4);
    const positions = [
      { x: 200, dir: 1 }, { x: 500, dir: -1 }, { x: 800, dir: 1 }, { x: 1000, dir: -1 }
    ];
    
    positions.forEach(p => {
      const s = this.physics.add.sprite(p.x, GAME_H - 110, null).setVisible(false);
      s.body.setSize(30, 14);
      s.body.setAllowGravity(false);
      s.body.setVelocityX(60 * p.dir);
      s.dir = p.dir;
      this.salmons.push(s);
    });
  }

  drawSalmon(g, x, y, dir) {
    const flip = dir < 0 ? -1 : 1;
    g.fillStyle(0xff8866, 0.85);
    g.fillEllipse(x, y, 30 * flip, 12);
    g.fillTriangle(
      x - 14 * flip, y,
      x - 22 * flip, y - 8,
      x - 22 * flip, y + 8
    );
    g.fillStyle(0xffffff);
    g.fillCircle(x + 10 * flip, y - 1, 2);
    g.fillStyle(0x220000);
    g.fillCircle(x + 10 * flip, y - 1, 1);
  }

  createTimerUI() {
    this.timerText = this.add.text(GAME_W/2, 16, '30', {
      fontSize: '22px', fontFamily: 'Courier New',
      color: '#55aaff', letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

    this.timerLabel = this.add.text(GAME_W/2, 40, 'SEGUNDOS', {
      fontSize: '10px', fontFamily: 'Courier New',
      color: '#335577', letterSpacing: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.gameActive || this.transitioning) return;
        this.timeLeft--;
        this.timerText.setText(String(this.timeLeft).padStart(2, '0'));
        if (this.timeLeft <= 10) this.timerText.setColor('#ff5555');
        if (this.timeLeft <= 0) {
          this.gameActive = false;
          this.transitioning = true;
          playerHealth = Math.max(0, playerHealth - 1);
          updateHealthUI();
          const flood = this.add.rectangle(600, GAME_H/2, GAME_W, GAME_H, 0x0044aa, 0).setScrollFactor(0).setDepth(30);
          this.tweens.add({
            targets: flood, alpha: 0.7, duration: 1000,
            onComplete: () => {
              this.cameras.main.fadeOut(500, 0, 20, 60);
              this.time.delayedCall(550, () => {
                if (playerHealth <= 0) this.scene.start('GameOverScene');
                else this.scene.start('Phase3Scene');
              });
            }
          });
        }
      },
      repeat: 29
    });
  }

  createPlayer() {
    const floorY = GAME_H - 60;
    this.player = this.physics.add.sprite(80, floorY - 40, null).setVisible(false);
    this.player.body.setSize(24, 40);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(700);
    this.player.body.setMaxVelocityY(900);
    this.playerGfx = this.add.graphics().setDepth(5);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      action: Phaser.Input.Keyboard.KeyCodes.E,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft = false;
    this.exitPrompt = null;
    this.noKeyMsg = null;
  }

  drawPlayer(x, y, fl) {
    const g = this.playerGfx; g.clear();
    g.fillStyle(COLORS.player); g.fillRect(x-10,y-38,20,28); g.fillRect(x-9,y-58,18,18);
    g.fillStyle(COLORS.playerEye); g.fillRect(fl?x-5:x+2,y-53,4,4);
    g.fillStyle(COLORS.player,0.8); g.fillRect(x-8,y-10,7,12); g.fillRect(x+1,y-10,7,12);
    g.fillRect(x-14,y-36,5,20); g.fillRect(x+9,y-36,5,20);
  }

  update() {
    if (this.transitioning) return;
    
    const onGround = this.player.body.blocked.down;
    const speed = 200;

    if (this.cursors.left.isDown || this.keys.left.isDown) {
      this.player.body.setVelocityX(-speed); this.facingLeft = true;
    } else if (this.cursors.right.isDown || this.keys.right.isDown) {
      this.player.body.setVelocityX(speed); this.facingLeft = false;
    } else {
      this.player.body.setVelocityX(0);
    }
    
    if ((this.cursors.up.isDown || this.keys.jump.isDown || this.spaceKey.isDown) && onGround) {
      this.player.body.setVelocityY(-480);
    }

    this.drawPlayer(this.player.x, this.player.y, this.facingLeft);
    this.updateWater();

    this.salmonGfx.clear();
    const waterDepth = GAME_H - this.waterLevel;
    const showSalmons = waterDepth > GAME_H * 0.30;

    if (showSalmons) {
      this.salmons.forEach(s => {
        const targetY = this.waterLevel + 30;
        s.y = targetY;
        s.body.reset(s.x, targetY);
        if (s.x > 1180 || s.x < 30) {
          s.dir *= -1;
          s.body.setVelocityX(60 * s.dir);
        }
        this.drawSalmon(this.salmonGfx, s.x, s.y, s.dir);
      });
    }

    if (this.exitPrompt) { this.exitPrompt.x = this.player.x; this.exitPrompt.y = this.player.y - 70; }
    if (this.noKeyMsg) { this.noKeyMsg.x = this.player.x; this.noKeyMsg.y = this.player.y - 70; }
  }
}

// =============================================
//  CLASSE Phase4Scene (ACADEMIA)
// =============================================
class Phase4Scene extends Phaser.Scene {
  constructor() { super({ key: 'Phase4Scene' }); }

  create() {
    updateDoorCounter(4);
    showPhaseTitle('FASE 4 -- ACADEMIA DAS TREVAS');
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#080810');
    this.physics.world.setBounds(0, 0, 2200, GAME_H);
    this.cameras.main.setBounds(0, 0, 2200, GAME_H);

    this.transitioning = false;
    this.mariaActive = false;
    this.mariaCooldown = false;
    this.inLocker = false;
    this.hitCooldown = false;

    this.buildLevel();
    this.createPlayer();
    this.createObstacles();
    this.createMaria();
    this.createExitDoor();
    this.setupControls();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.weights, this.hitWeight, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.tryExit, null, this);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.mariaTriggerXs = [400, 1100, 1800];
    this.mariaTriggered = [false, false, false];
  }

  buildLevel() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    g.fillStyle(0x080810); g.fillRect(0, 0, 2200, GAME_H);
    
    for (let x = 0; x < 2200; x += 40) {
      g.fillStyle(x % 80 === 0 ? 0x111120 : 0x0e0e1c);
      g.fillRect(x, floorY, 40, 60);
    }
    g.fillStyle(0x2a2840); g.fillRect(0, floorY, 2200, 3);

    g.fillStyle(0x060610); g.fillRect(0, 0, 2200, 30);

    const floor = this.add.rectangle(1100, floorY+30, 2200, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    const platData = [
      {x:150, y:350, w:160}, {x:420, y:290, w:120},
      {x:680, y:330, w:140}, {x:950, y:260, w:130},
      {x:1200, y:310, w:150},{x:1480, y:270, w:120},
      {x:1720, y:300, w:140},{x:1980, y:240, w:120},
    ];

    platData.forEach(p => {
      g.fillStyle(0x2a1a0a); g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x4a3010); g.fillRect(p.x, p.y, p.w, 3);
      
      const pl = this.add.rectangle(p.x+p.w/2, p.y+8, p.w, 16).setVisible(false);
      this.physics.add.existing(pl, true);
      this.platforms.add(pl);
    });
  }

  createObstacles() {
    this.weights = this.physics.add.staticGroup();
    const g = this.add.graphics().setDepth(2);
    const floorY = GAME_H - 60;

    const weightPositions = [200, 500, 750, 1050, 1350, 1650, 1950];
    this.movingWeights = [];

    weightPositions.forEach((x, i) => {
      g.fillStyle(0x333344); g.fillRect(x-18, floorY-6, 36, 12);
      g.fillStyle(0x222233); g.fillRect(x-22, floorY-9, 8, 18); g.fillRect(x+14, floorY-9, 8, 18);
      g.fillStyle(0x111122); g.fillCircle(x-18, floorY, 9); g.fillCircle(x+18, floorY, 9);

      const w = this.add.zone(x, floorY-20, 44, 20);
      this.physics.add.existing(w, false);
      w.body.setAllowGravity(false);
      w.body.setVelocityX(i % 2 === 0 ? 70 : -70);
      w.body.setCollideWorldBounds(true);
      w.body.setBounce(1, 0);
      this.movingWeights.push({zone: w});
      this.weights.add(w);
    });
  }

  hitWeight(player, weight) {
    if (this.transitioning || this.hitCooldown) return;
    this.hitCooldown = true;
    playerHealth = Math.max(0, playerHealth - 1);
    updateHealthUI();
    
    const flash = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0xff2200, 0.3).setScrollFactor(0).setDepth(25);
    this.tweens.add({targets:flash, alpha:0, duration:400, onComplete:()=>flash.destroy()});
    this.time.delayedCall(1500, () => { this.hitCooldown = false; });
    
    if (playerHealth <= 0) {
      this.transitioning = true;
      this.time.delayedCall(600, () => this.scene.start('GameOverScene'));
    }
  }

  createMaria() {
    this.mariaGfx = this.add.graphics().setDepth(15);
    this.wardrobes = [];
    const floorY = GAME_H - 60;
    const g = this.add.graphics().setDepth(2);
    
    [120, 700, 1300, 1900].forEach(x => {
      g.fillStyle(0x112233); g.fillRect(x, floorY-85, 38, 85);
      g.lineStyle(1, 0x224455, 0.9); g.strokeRect(x, floorY-85, 38, 85);
      
      const zone = this.add.zone(x+19, floorY-42, 50, 85);
      this.physics.add.existing(zone, true);
      this.wardrobes.push(zone);
    });
  }

  drawMaria(x, y) {
    const g = this.mariaGfx; g.clear(); g.setAlpha(1);
    g.fillStyle(0xff00ff, 0.25); g.fillCircle(x, y-40, 55);
    g.fillStyle(0xff44ff, 0.15); g.fillCircle(x, y-40, 70);
    g.fillStyle(0xcc44cc); g.fillRect(x-13, y-55, 26, 36);
    g.fillStyle(0xdd55dd); g.fillRect(x-10, y-78, 20, 24);
    g.fillStyle(0x330033); g.fillRect(x-12, y-86, 24, 12);
    g.fillStyle(0xffffff); g.fillCircle(x-5, y-68, 8); g.fillCircle(x+5, y-68, 8);
    g.fillStyle(0xaa00aa); g.fillCircle(x-5, y-68, 5); g.fillCircle(x+5, y-68, 5);
    g.fillStyle(0x000000); g.fillCircle(x-5, y-68, 2); g.fillCircle(x+5, y-68, 2);
    g.fillStyle(0x993399); g.fillRect(x-10, y-19, 9, 20); g.fillRect(x+1, y-19, 9, 20);
  }

  triggerMaria() {
    if (this.mariaCooldown) return;
    this.mariaCooldown = true;
    const floorY = GAME_H - 60;
    
    if (this.hidePrompt) this.hidePrompt.destroy();
    this.hidePrompt = this.add.text(this.player.x, this.player.y-80, '(!) ENTRE NO LOCKER! [E]',
      {fontSize:'12px', fontFamily:'Courier New', color:'#ff5555', letterSpacing:1}).setOrigin(0.5).setDepth(20);
    
    this.tweens.add({targets:this.hidePrompt, alpha:{from:1,to:0.3}, duration:300, yoyo:true, repeat:5,
      onComplete:()=>{ if(this.hidePrompt){this.hidePrompt.destroy();this.hidePrompt=null;} }});
    
    this.drawMaria(this.player.x + 80, floorY - 50);
    this.tweens.add({targets:this.mariaGfx, alpha:{from:1,to:0}, duration:2000,
      onComplete:()=>{ this.mariaGfx.clear(); this.mariaCooldown=false; }});
    
    this.time.delayedCall(800, () => {
      if (!this.inLocker && !this.hitCooldown) {
        this.hitCooldown = true;
        playerHealth = Math.max(0, playerHealth-1);
        updateHealthUI();
        this.time.delayedCall(1500, ()=>{this.hitCooldown=false;});
        if (playerHealth <= 0) { this.transitioning=true; this.time.delayedCall(600,()=>this.scene.start('GameOverScene')); }
      }
    });
  }

  createExitDoor() {
    const floorY = GAME_H - 60;
    const g = this.add.graphics().setDepth(2);
    const dx=2100, dw=55, dh=95, dy=floorY-dh;
    
    g.fillStyle(COLORS.doorFrame); g.fillRect(dx-4,dy-6,dw+8,dh+8);
    g.fillStyle(COLORS.door); g.fillRect(dx,dy,dw,dh);
    g.fillStyle(COLORS.doorGlow); g.fillCircle(dx+dw-10,dy+dh/2,4);
    
    this.add.text(dx+dw/2,dy-18,'004',{fontSize:'11px',fontFamily:'Courier New',color:'#8866cc',letterSpacing:2}).setOrigin(0.5);
    
    const glow=this.add.rectangle(dx+dw/2,dy+dh/2,dw+20,dh+20,COLORS.doorGlow,0.06);
    this.tweens.add({targets:glow,alpha:{from:0.03,to:0.10},duration:1200,yoyo:true,repeat:-1});
    
    this.exitZone=this.add.rectangle(dx+dw/2,dy+dh/2,dw,dh).setVisible(false);
    this.physics.add.existing(this.exitZone,true);
  }

  tryExit(player, door) {
    if (this.transitioning) return;
    if (!this.exitPrompt) {
      this.exitPrompt=this.add.text(this.player.x,this.player.y-70,'[E] Entrar',
        {fontSize:'12px',fontFamily:'Courier New',color:'#c0aae8',letterSpacing:2}).setOrigin(0.5).setDepth(10);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.transitioning=true;
      if(this.exitPrompt){this.exitPrompt.destroy();this.exitPrompt=null;}
      this.cameras.main.fadeOut(600,0,0,0);
      this.time.delayedCall(650,()=>{ currentDoor=5; updateDoorCounter(5); this.scene.start('Phase5Scene'); });
    }
  }

  createPlayer() {
    const floorY = GAME_H - 60;
    this.player = this.physics.add.sprite(80, floorY-40, null).setVisible(false);
    this.player.body.setSize(24,40); this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(700); this.player.body.setMaxVelocityY(900);
    this.playerGfx = this.add.graphics().setDepth(5);
  }

  setupControls() {
    this.cursors=this.input.keyboard.createCursorKeys();
    this.keys=this.input.keyboard.addKeys({left:Phaser.Input.Keyboard.KeyCodes.A,right:Phaser.Input.Keyboard.KeyCodes.D,jump:Phaser.Input.Keyboard.KeyCodes.W,action:Phaser.Input.Keyboard.KeyCodes.E});
    this.spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft=false; this.exitPrompt=null;
  }

  drawPlayer(x,y,fl) {
    const g=this.playerGfx; g.clear();
    g.fillStyle(COLORS.player); g.fillRect(x-10,y-38,20,28); g.fillRect(x-9,y-58,18,18);
    g.fillStyle(COLORS.playerEye); g.fillRect(fl?x-5:x+2,y-53,4,4);
    g.fillStyle(COLORS.player,0.8); g.fillRect(x-8,y-10,7,12); g.fillRect(x+1,y-10,7,12);
    g.fillRect(x-14,y-36,5,20); g.fillRect(x+9,y-36,5,20);
  }

  update() {
    if (this.transitioning) return;
    
    const onGround=this.player.body.blocked.down;
    const speed=200;

    let nearLocker=false;
    this.wardrobes.forEach(w=>{ if(Phaser.Math.Distance.Between(this.player.x,this.player.y,w.x,w.y)<70) nearLocker=true; });

    if (nearLocker && !this.lockerHint) {
      this.lockerHint = this.add.text(this.player.x, this.player.y - 70, '[E] Entrar no locker',
        { fontSize: '11px', fontFamily: 'Courier New', color: '#aa8866', letterSpacing: 1 }
      ).setOrigin(0.5).setDepth(10);
    } else if (!nearLocker && this.lockerHint) {
      this.lockerHint.destroy(); this.lockerHint = null;
    }
    if (this.lockerHint) { this.lockerHint.x = this.player.x; this.lockerHint.y = this.player.y - 70; }

    if (nearLocker && Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.inLocker=!this.inLocker;
      this.player.body.setAllowGravity(!this.inLocker);
      if (this.inLocker) this.player.body.setVelocity(0,0);
    }

    if (!this.inLocker) {
      if (this.cursors.left.isDown||this.keys.left.isDown){this.player.body.setVelocityX(-speed);this.facingLeft=true;}
      else if (this.cursors.right.isDown||this.keys.right.isDown){this.player.body.setVelocityX(speed);this.facingLeft=false;}
      else this.player.body.setVelocityX(0);
      if ((this.cursors.up.isDown||this.keys.jump.isDown||this.spaceKey.isDown)&&onGround) this.player.body.setVelocityY(-480);
    } else {
      this.player.body.setVelocity(0,0);
    }

    this.drawPlayer(this.player.x, this.player.y, this.facingLeft);

    this.mariaTriggerXs.forEach((tx, i) => {
      if (!this.mariaTriggered[i] && Math.abs(this.player.x - tx) < 40) {
        this.mariaTriggered[i] = true;
        this.triggerMaria();
      }
    });

    if(this.exitPrompt){this.exitPrompt.x=this.player.x;this.exitPrompt.y=this.player.y-70;}
    if(this.hidePrompt){this.hidePrompt.x=this.player.x;this.hidePrompt.y=this.player.y-80;}
  }
}

// =============================================
//  CLASSE Phase5Scene (ARENA)
// =============================================
class Phase5Scene extends Phaser.Scene {
  constructor() { super({ key: 'Phase5Scene' }); }

  create() {
    updateDoorCounter(5);
    showPhaseTitle('FASE 5 -- A ARENA');
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#050510');
    this.physics.world.setBounds(0, 0, 1800, GAME_H);
    this.cameras.main.setBounds(0, 0, 1800, GAME_H);
    this.transitioning = false;
    this.hitCooldown = false;
    this.inHiding = false;

    this.buildLevel();
    this.createPlayer();
    this.createEnemies();
    this.createMaria();
    this.createExitDoor();
    this.setupControls();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.tryExit, null, this);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.mariaTriggerXs = [450, 1200];
    this.mariaTriggered = [false, false];
  }

  buildLevel() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    g.fillStyle(0x050510); g.fillRect(0, 0, 1800, GAME_H);
    
    for(let x=0;x<1800;x+=50) for(let y=floorY;y<GAME_H;y+=50) {
      g.fillStyle(((x+y)/50)%2===0?0x0d0d20:0x0a0a18); g.fillRect(x,y,50,50);
    }
    g.fillStyle(0x3322aa,0.3); g.fillRect(0,floorY,1800,3);
    g.fillStyle(0x060610); g.fillRect(0,0,1800,30);

    const floor=this.add.rectangle(900,floorY+30,1800,60).setVisible(false);
    this.physics.add.existing(floor,true); this.platforms.add(floor);

    const platData=[
      {x:80,y:200,w:100,tower:true},{x:300,y:300,w:120},{x:550,y:240,w:100},
      {x:750,y:310,w:130},{x:980,y:260,w:110},{x:1200,y:290,w:120},
      {x:1430,y:240,w:100},{x:1650,y:200,w:100,tower:true}
    ];

    platData.forEach(p=>{
      if(p.tower) {
        g.fillStyle(0x1a1a3a); g.fillRect(p.x,p.y,p.w,GAME_H-60-p.y);
        g.fillStyle(0x2a2a5a); g.fillRect(p.x,p.y,p.w,16);
      } else {
        g.fillStyle(0x161630); g.fillRect(p.x,p.y,p.w,14);
        g.fillStyle(0x2a2a55,0.8); g.fillRect(p.x,p.y,p.w,3);
      }
      const pl=this.add.rectangle(p.x+p.w/2,p.y+8,p.w,16).setVisible(false);
      this.physics.add.existing(pl,true); this.platforms.add(pl);
    });
  }

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.enemyGfxList = [];
    const floorY = GAME_H - 60;

    const enemyData = [
      {x:300, type:'knight', speed:60, hp:1},
      {x:600, type:'giant',  speed:35, hp:2},
      {x:900, type:'archer', speed:80, hp:1},
      {x:1200,type:'knight', speed:60, hp:1},
      {x:1500,type:'giant',  speed:35, hp:2},
    ];

    this.enemyList = enemyData.map(e => {
      const sprite = this.physics.add.sprite(e.x, floorY-40, null).setVisible(false);
      sprite.body.setSize(28, 40); sprite.setCollideWorldBounds(true);
      sprite.body.setGravityY(700); sprite.body.setMaxVelocityY(900);
      sprite.body.setVelocityX(e.speed * (Math.random()>0.5?1:-1));
      sprite.eType = e.type; sprite.hp = e.hp; sprite.dir = 1; sprite.speed = e.speed;
      const gfx = this.add.graphics().setDepth(4);
      this.enemyGfxList.push(gfx);
      this.enemies.add(sprite);
      return {sprite, gfx, ...e};
    });
  }

  drawEnemy(g, x, y, type, dir) {
    g.clear();
    const flip = dir < 0 ? -1 : 1;
    if (type === 'knight') {
      g.fillStyle(0x888899); g.fillRect(x-11,y-38,22,28);
      g.fillStyle(0xaaaacc); g.fillRect(x-10,y-58,20,20);
      g.fillStyle(0x666677); g.fillRect(x-10,y-62,20,8);
      g.fillStyle(0xccccee,0.9); g.fillRect(x-3*flip,y-55,6,8);
      g.fillStyle(0x444455); g.fillRect(x-9,y-10,8,12); g.fillRect(x+1,y-10,8,12);
      g.fillStyle(0x999aaa); g.fillRect(x+9*flip,y-38,8,22);
    } else if (type === 'giant') {
      g.fillStyle(0x556644); g.fillRect(x-14,y-40,28,34);
      g.fillStyle(0x667755); g.fillRect(x-12,y-62,24,22);
      g.fillStyle(0x223322); g.fillRect(x-12,y-65,24,8);
      g.fillStyle(0x445533); g.fillRect(x-11,y-10,10,14); g.fillRect(x+1,y-10,10,14);
      g.fillStyle(0x334422); g.fillRect(x-18,y-38,6,25); g.fillRect(x+12,y-38,6,25);
    } else {
      g.fillStyle(0x885533); g.fillRect(x-9,y-38,18,28);
      g.fillStyle(0x996644); g.fillRect(x-8,y-58,16,20);
      g.fillStyle(0x553322); g.fillRect(x-8,y-62,16,8);
      g.fillStyle(0x775522); g.fillRect(x-8,y-10,7,12); g.fillRect(x+1,y-10,7,12);
    }
  }

  createMaria() {
    this.mariaGfx = this.add.graphics().setDepth(15);
    this.wardrobes = [];
    const floorY = GAME_H - 60;
    const g = this.add.graphics().setDepth(2);
    
    [100, 850, 1650].forEach(x => {
      g.fillStyle(0x1a1a2a); g.fillRect(x,floorY-85,38,85);
      g.lineStyle(1,0x334466,0.9); g.strokeRect(x,floorY-85,38,85);
      
      const zone=this.add.zone(x+19,floorY-42,50,85);
      this.physics.add.existing(zone,true); this.wardrobes.push(zone);
    });
    this.inHiding=false; this.hidePrompt=null;
  }

  drawMaria(x,y){
    const g=this.mariaGfx;g.clear();g.setAlpha(1);
    g.fillStyle(0xff00ff,0.25);g.fillCircle(x,y-40,55);
    g.fillStyle(0xff44ff,0.15);g.fillCircle(x,y-40,70);
    g.fillStyle(0xcc44cc);g.fillRect(x-13,y-55,26,36);
    g.fillStyle(0xdd55dd);g.fillRect(x-10,y-78,20,24);
    g.fillStyle(0x330033);g.fillRect(x-12,y-86,24,12);
    g.fillStyle(0xffffff);g.fillCircle(x-5,y-68,8);g.fillCircle(x+5,y-68,8);
    g.fillStyle(0xaa00aa);g.fillCircle(x-5,y-68,5);g.fillCircle(x+5,y-68,5);
    g.fillStyle(0x000000);g.fillCircle(x-5,y-68,2);g.fillCircle(x+5,y-68,2);
    g.fillStyle(0x993399);g.fillRect(x-10,y-19,9,20);g.fillRect(x+1,y-19,9,20);
  }

  hitEnemy(player, enemySprite) {
    if (this.transitioning || this.hitCooldown) return;
    this.hitCooldown = true;
    playerHealth = Math.max(0, playerHealth-1);
    updateHealthUI();
    
    const dir = player.x < enemySprite.x ? -1 : 1;
    player.body.setVelocityX(dir * 300);
    player.body.setVelocityY(-200);
    
    const flash=this.add.rectangle(GAME_W/2,GAME_H/2,GAME_W,GAME_H,0xff2200,0.3).setScrollFactor(0).setDepth(25);
    this.tweens.add({targets:flash,alpha:0,duration:400,onComplete:()=>flash.destroy()});
    this.time.delayedCall(1200,()=>{this.hitCooldown=false;});
    
    if (playerHealth<=0){this.transitioning=true;this.time.delayedCall(600,()=>this.scene.start('GameOverScene'));}
  }

  createExitDoor() {
    const floorY=GAME_H-60;
    const g=this.add.graphics().setDepth(2);
    const dx=1700,dw=55,dh=95,dy=floorY-dh;
    
    g.fillStyle(COLORS.doorFrame);g.fillRect(dx-4,dy-6,dw+8,dh+8);
    g.fillStyle(COLORS.door);g.fillRect(dx,dy,dw,dh);
    g.fillStyle(COLORS.doorGlow);g.fillCircle(dx+dw-10,dy+dh/2,4);
    
    this.add.text(dx+dw/2,dy-18,'005',{fontSize:'11px',fontFamily:'Courier New',color:'#8866cc',letterSpacing:2}).setOrigin(0.5);
    
    const glow=this.add.rectangle(dx+dw/2,dy+dh/2,dw+20,dh+20,COLORS.doorGlow,0.06);
    this.tweens.add({targets:glow,alpha:{from:0.03,to:0.10},duration:1200,yoyo:true,repeat:-1});
    
    this.exitZone=this.add.rectangle(dx+dw/2,dy+dh/2,dw,dh).setVisible(false);
    this.physics.add.existing(this.exitZone,true);
  }

  tryExit(player,door) {
    if(this.transitioning)return;
    if(!this.exitPrompt){
      this.exitPrompt=this.add.text(this.player.x,this.player.y-70,'[E] Entrar',
        {fontSize:'12px',fontFamily:'Courier New',color:'#c0aae8',letterSpacing:2}).setOrigin(0.5).setDepth(10);
    }
    if(Phaser.Input.Keyboard.JustDown(this.keys.action)){
      this.transitioning=true;
      if(this.exitPrompt){this.exitPrompt.destroy();this.exitPrompt=null;}
      this.cameras.main.fadeOut(600,0,0,0);
      this.time.delayedCall(650,()=>{currentDoor=6;updateDoorCounter(6);this.scene.start('FinalScene');});
    }
  }

  createPlayer() {
    const floorY=GAME_H-60;
    this.player=this.physics.add.sprite(80,floorY-40,null).setVisible(false);
    this.player.body.setSize(24,40);this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(700);this.player.body.setMaxVelocityY(900);
    this.playerGfx=this.add.graphics().setDepth(5);
  }

  setupControls() {
    this.cursors=this.input.keyboard.createCursorKeys();
    this.keys=this.input.keyboard.addKeys({left:Phaser.Input.Keyboard.KeyCodes.A,right:Phaser.Input.Keyboard.KeyCodes.D,jump:Phaser.Input.Keyboard.KeyCodes.W,action:Phaser.Input.Keyboard.KeyCodes.E});
    this.spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft=false;this.exitPrompt=null;
  }

  drawPlayer(x,y,fl){
    const g=this.playerGfx;g.clear();
    g.fillStyle(COLORS.player);g.fillRect(x-10,y-38,20,28);g.fillRect(x-9,y-58,18,18);
    g.fillStyle(COLORS.playerEye);g.fillRect(fl?x-5:x+2,y-53,4,4);
    g.fillStyle(COLORS.player,0.8);g.fillRect(x-8,y-10,7,12);g.fillRect(x+1,y-10,7,12);
    g.fillRect(x-14,y-36,5,20);g.fillRect(x+9,y-36,5,20);
  }

  update() {
    if(this.transitioning)return;
    const onGround=this.player.body.blocked.down;
    const speed=200;

    let nearHide=false;
    this.wardrobes.forEach(w=>{if(Phaser.Math.Distance.Between(this.player.x,this.player.y,w.x,w.y)<70)nearHide=true;});

    if (nearHide && !this.hideHint) {
      this.hideHint = this.add.text(this.player.x, this.player.y - 70, '[E] Esconder',
        { fontSize: '11px', fontFamily: 'Courier New', color: '#aa8866', letterSpacing: 1 }
      ).setOrigin(0.5).setDepth(10);
    } else if (!nearHide && this.hideHint) {
      this.hideHint.destroy(); this.hideHint = null;
    }
    if (this.hideHint) { this.hideHint.x = this.player.x; this.hideHint.y = this.player.y - 70; }

    if(nearHide&&Phaser.Input.Keyboard.JustDown(this.keys.action)){
      this.inHiding=!this.inHiding;
      this.player.body.setAllowGravity(!this.inHiding);
      if(this.inHiding)this.player.body.setVelocity(0,0);
    }

    if(!this.inHiding){
      if(this.cursors.left.isDown||this.keys.left.isDown){this.player.body.setVelocityX(-speed);this.facingLeft=true;}
      else if(this.cursors.right.isDown||this.keys.right.isDown){this.player.body.setVelocityX(speed);this.facingLeft=false;}
      else this.player.body.setVelocityX(0);
      if((this.cursors.up.isDown||this.keys.jump.isDown||this.spaceKey.isDown)&&onGround)this.player.body.setVelocityY(-480);
    } else {
      this.player.body.setVelocity(0,0);
    }

    this.drawPlayer(this.player.x,this.player.y,this.facingLeft);

    this.enemyList.forEach((e,i)=>{
      const s=e.sprite;
      if(s.x>1780||s.x<20){s.body.setVelocityX(-s.body.velocity.x);}
      const dist=this.player.x-s.x;
      if(Math.abs(dist)<250&&!this.inHiding){
        s.body.setVelocityX(dist>0?e.speed*1.5:-e.speed*1.5);
      }
      this.drawEnemy(this.enemyGfxList[i],s.x,s.y,e.type,s.body.velocity.x>0?1:-1);
    });

    this.mariaTriggerXs.forEach((tx,i)=>{
      if(!this.mariaTriggered[i]&&Math.abs(this.player.x-tx)<40){
        this.mariaTriggered[i]=true;
        if(this.hidePrompt)this.hidePrompt.destroy();
        this.hidePrompt=this.add.text(this.player.x,this.player.y-80,'(!) ESCONDA-SE! [E]',
          {fontSize:'12px',fontFamily:'Courier New',color:'#ff5555',letterSpacing:1}).setOrigin(0.5).setDepth(20);
        this.tweens.add({targets:this.hidePrompt,alpha:{from:1,to:0.3},duration:300,yoyo:true,repeat:5,
          onComplete:()=>{if(this.hidePrompt){this.hidePrompt.destroy();this.hidePrompt=null;}}});
        this.drawMaria(this.player.x+80,GAME_H-60-50);
        this.tweens.add({targets:this.mariaGfx,alpha:{from:1,to:0},duration:2000,onComplete:()=>this.mariaGfx.clear()});
        if(!this.inHiding&&!this.hitCooldown){
          this.time.delayedCall(900,()=>{
            if(!this.inHiding){
              this.hitCooldown=true;
              playerHealth=Math.max(0,playerHealth-1);
              updateHealthUI();
              this.time.delayedCall(1500,()=>{this.hitCooldown=false;});
              if(playerHealth<=0){this.transitioning=true;this.time.delayedCall(600,()=>this.scene.start('GameOverScene'));}
            }
          });
        }
      }
    });

    if(this.exitPrompt){this.exitPrompt.x=this.player.x;this.exitPrompt.y=this.player.y-70;}
    if(this.hidePrompt){this.hidePrompt.x=this.player.x;this.hidePrompt.y=this.player.y-80;}
  }
}

// =============================================
//  CLASSE FinalScene (BIBLIOTECA)
// =============================================
class FinalScene extends Phaser.Scene {
  constructor() { super({ key: 'FinalScene' }); }

  create() {
    updateDoorCounter(100);
    showPhaseTitle('FASE FINAL -- A BIBLIOTECA');
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#06060e');
    this.physics.world.setBounds(0, 0, GAME_W, GAME_H);
    this.cameras.main.setBounds(0, 0, GAME_W, GAME_H);

    this.transitioning = false;
    this.solvedCount = 0;
    this.totalPuzzles = 3;
    this.activePuzzle = null;

    this.buildLibrary();
    this.createPlayer();
    this.createPuzzles();
    this.setupControls();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.puzzleZones, this.nearPuzzle, null, this);
  }

  buildLibrary() {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    const floorY = GAME_H - 60;

    g.fillStyle(0x06060e); g.fillRect(0,0,GAME_W,GAME_H);
    g.fillStyle(0x0e0e1a); g.fillRect(0,floorY,GAME_W,60);
    g.fillStyle(0x1a1a28); g.fillRect(0,floorY,GAME_W,3);
    g.fillStyle(0x040408); g.fillRect(0,0,GAME_W,30);

    const floor=this.add.rectangle(GAME_W/2,floorY+30,GAME_W,60).setVisible(false);
    this.physics.add.existing(floor,true); this.platforms.add(floor);

    const shelves=[{x:50,y:320,w:160},{x:350,y:260,w:160},{x:650,y:300,w:160},{x:700,y:200,w:120}];
    shelves.forEach(s=>{
      g.fillStyle(0x1a0e05); g.fillRect(s.x,s.y,s.w,GAME_H-60-s.y);
      g.fillStyle(0x2a1a08); g.fillRect(s.x,s.y,s.w,14);
      
      const pl=this.add.rectangle(s.x+s.w/2,s.y+8,s.w,14).setVisible(false);
      this.physics.add.existing(pl,true); this.platforms.add(pl);
    });

    const ddx=GAME_W/2-30, ddy=floorY-110;
    g.fillStyle(0x2a1a00); g.fillRect(ddx-4,ddy-6,68,116);
    g.fillStyle(0x1a0e00); g.fillRect(ddx,ddy,60,110);
    g.lineStyle(2,0x886600,0.5); g.strokeRect(ddx,ddy,60,110);
    
    g.fillStyle(0x775500); g.fillRect(ddx+22,ddy+50,16,14);
    g.lineStyle(3,0x886600,0.8);
    g.beginPath(); g.arc(ddx+30,ddy+50,7,Math.PI,0); g.strokePath();
    
    this.add.text(GAME_W/2,ddy-20,'DOOR 100',{fontSize:'11px',fontFamily:'Courier New',color:'#553300',letterSpacing:2}).setOrigin(0.5);
  }

  createPuzzles() {
    this.puzzleZones = this.physics.add.staticGroup();
    const floorY = GAME_H - 60;
    const g = this.add.graphics().setDepth(3);

    const puzzleData = [
      { x: 150, code: '? + ? = 10\n(5 + _)', answer: '5', hint: 'Dois iguais que somam 10' },
      { x: 450, code: 'CHUCHU\n ao cubo', answer: '3', hint: 'Letras de CHUCHU' },
      { x: 750, code: 'Porta\n___ + 1\n= 100', answer: '99', hint: 'Porta anterior à final' },
    ];

    this.puzzles = puzzleData.map((p, i) => {
      g.fillStyle(0x1a1408); g.fillRect(p.x-20,floorY-55,40,55);
      g.fillStyle(0x2a2010); g.fillRect(p.x-22,floorY-60,44,8);
      g.fillStyle(0x3a3018); g.fillRect(p.x-18,floorY-55,36,4);
      g.fillStyle(0x4444aa,0.6); g.fillCircle(p.x,floorY-70,12);
      
      const zone=this.add.rectangle(p.x,floorY-30,50,60).setVisible(false);
      this.physics.add.existing(zone,true);
      this.puzzleZones.add(zone);
      return {zone, ...p, solved: false, index: i};
    });
  }

  nearPuzzle(player, zone) {
    if (this.transitioning || this.activePuzzle !== null) return;
    const puzzle = this.puzzles.find(p => p.zone === zone);
    if (!puzzle || puzzle.solved) return;

    if (!this.interactHint) {
      this.interactHint = this.add.text(this.player.x, this.player.y-70, '[E] Examinar',
        {fontSize:'11px',fontFamily:'Courier New',color:'#6666aa',letterSpacing:1}).setOrigin(0.5).setDepth(10).setScrollFactor(0);
      this.interactHint.x = GAME_W/2; this.interactHint.y = GAME_H - 90;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      this.activePuzzle = puzzle;
      this.showPuzzleUI(puzzle);
    }
  }

  showPuzzleUI(puzzle) {
    this.overlay = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0x000000, 0.75).setScrollFactor(0).setDepth(30);
    this.puzzleBox = this.add.rectangle(GAME_W/2, GAME_H/2, 420, 240, 0x0e0e1a).setScrollFactor(0).setDepth(31);
    
    this.add.text(GAME_W/2, GAME_H/2-90, '-- ENIGMA --', {fontSize:'13px',fontFamily:'Courier New',color:'#8888cc',letterSpacing:4}).setOrigin(0.5).setScrollFactor(0).setDepth(32);
    this.add.text(GAME_W/2, GAME_H/2-50, puzzle.code, {fontSize:'16px',fontFamily:'Courier New',color:'#c0aae8',letterSpacing:2,align:'center'}).setOrigin(0.5).setScrollFactor(0).setDepth(32);
    this.add.text(GAME_W/2, GAME_H/2+10, puzzle.hint, {fontSize:'11px',fontFamily:'Courier New',color:'#445566',letterSpacing:1,align:'center'}).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.answerText = '';
    this.answerDisplay = this.add.text(GAME_W/2+20, GAME_H/2+50, '_', {fontSize:'16px',fontFamily:'Courier New',color:'#c0aae8',letterSpacing:3}).setOrigin(0,0.5).setScrollFactor(0).setDepth(32);
    this.feedbackText = this.add.text(GAME_W/2, GAME_H/2+85, '', {fontSize:'12px',fontFamily:'Courier New',color:'#ff5555',letterSpacing:2}).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.puzzleKeyHandler = (e) => {
      if (e.key === 'Escape') { this.closePuzzleUI(); return; }
      if (e.key === 'Enter') { this.checkAnswer(); return; }
      if (e.key === 'Backspace') { this.answerText = this.answerText.slice(0,-1); }
      else if (e.key.length === 1 && this.answerText.length < 6) { this.answerText += e.key; }
      this.answerDisplay.setText(this.answerText || '_');
    };
    window.addEventListener('keydown', this.puzzleKeyHandler);
    if (this.interactHint) { this.interactHint.destroy(); this.interactHint = null; }
  }

  checkAnswer() {
    if (this.answerText.trim() === this.activePuzzle.answer) {
      this.feedbackText.setColor('#00ff88').setText('(ok) CORRETO!');
      window.removeEventListener('keydown', this.puzzleKeyHandler);
      this.activePuzzle.solved = true;
      this.solvedCount++;
      this.time.delayedCall(1000, () => {
        this.closePuzzleUI();
        this.checkWin();
      });
    } else {
      this.feedbackText.setColor('#ff5555').setText('(x) ERRADO. Tente novamente.');
      this.answerText = '';
      this.answerDisplay.setText('_');
      playerHealth = Math.max(0, playerHealth-1);
      updateHealthUI();
      if (playerHealth <= 0) {
        window.removeEventListener('keydown', this.puzzleKeyHandler);
        this.closePuzzleUI();
        this.time.delayedCall(500, () => this.scene.start('GameOverScene'));
      }
    }
  }

  closePuzzleUI() {
    window.removeEventListener('keydown', this.puzzleKeyHandler);
    this.children.list.filter(c => c.depth >= 30).forEach(c => c.destroy());
    this.activePuzzle = null;
  }

  checkWin() {
    if (this.solvedCount < this.totalPuzzles) {
      const remaining = this.totalPuzzles - this.solvedCount;
      const msg = this.add.text(GAME_W/2, GAME_H/2-20, `${remaining} enigma(s) restante(s)...`,
        {fontSize:'13px',fontFamily:'Courier New',color:'#6666aa',letterSpacing:2}).setOrigin(0.5).setScrollFactor(0).setDepth(10);
      this.tweens.add({targets:msg, alpha:0, duration:800, delay:1500, onComplete:()=>msg.destroy()});
      return;
    }
    this.transitioning = true;
    const unlock = this.add.text(GAME_W/2, GAME_H/2, '? PORTA DESBLOQUEADA!',
      {fontSize:'18px',fontFamily:'Courier New',color:'#ffdd44',letterSpacing:3}).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.tweens.add({targets:unlock, alpha:{from:1,to:0.3}, duration:400, yoyo:true, repeat:3,
      onComplete:()=>{
        unlock.destroy();
        this.cameras.main.fadeOut(800,0,0,0);
        this.time.delayedCall(850, ()=>this.scene.start('WinScene'));
      }
    });
  }

  createPlayer() {
    const floorY=GAME_H-60;
    this.player=this.physics.add.sprite(60,floorY-40,null).setVisible(false);
    this.player.body.setSize(24,40);this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(700);this.player.body.setMaxVelocityY(900);
    this.playerGfx=this.add.graphics().setDepth(5);
  }

  setupControls() {
    this.cursors=this.input.keyboard.createCursorKeys();
    this.keys=this.input.keyboard.addKeys({left:Phaser.Input.Keyboard.KeyCodes.A,right:Phaser.Input.Keyboard.KeyCodes.D,jump:Phaser.Input.Keyboard.KeyCodes.W,action:Phaser.Input.Keyboard.KeyCodes.E});
    this.spaceKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facingLeft=false; this.interactHint=null;
  }

  drawPlayer(x,y,fl){
    const g=this.playerGfx;g.clear();
    g.fillStyle(COLORS.player);g.fillRect(x-10,y-38,20,28);g.fillRect(x-9,y-58,18,18);
    g.fillStyle(COLORS.playerEye);g.fillRect(fl?x-5:x+2,y-53,4,4);
    g.fillStyle(COLORS.player,0.8);g.fillRect(x-8,y-10,7,12);g.fillRect(x+1,y-10,7,12);
    g.fillRect(x-14,y-36,5,20);g.fillRect(x+9,y-36,5,20);
  }

  update() {
    if(this.transitioning)return;
    if(this.activePuzzle!==null)return;
    const onGround=this.player.body.blocked.down;
    const speed=180;
    if(this.cursors.left.isDown||this.keys.left.isDown){this.player.body.setVelocityX(-speed);this.facingLeft=true;}
    else if(this.cursors.right.isDown||this.keys.right.isDown){this.player.body.setVelocityX(speed);this.facingLeft=false;}
    else this.player.body.setVelocityX(0);
    if((this.cursors.up.isDown||this.keys.jump.isDown||this.spaceKey.isDown)&&onGround)this.player.body.setVelocityY(-480);
    this.drawPlayer(this.player.x,this.player.y,this.facingLeft);
  }
}

// =============================================
//  CLASSE GameOverScene
// =============================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create() {
    ['Phase1Scene','Phase2Scene','Phase3Scene','Phase4Scene','Phase5Scene','FinalScene','WinScene'].forEach(k => {
      try { if (this.scene.isActive(k)) this.scene.stop(k); } catch(e) {}
    });
    
    playerHealth = 4;
    currentDoor = 1;
    updateHealthUI();
    updateDoorCounter(1);

    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.add.graphics().fillStyle(0x050508).fillRect(0, 0, GAME_W, GAME_H);

    this.add.text(GAME_W/2, GAME_H/2 - 80, 'VOCE MORREU', {
      fontSize: '52px', fontFamily: 'Courier New', color: '#ff4444', letterSpacing: 8
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2 - 10, 'Pressione R para tentar de novo', {
      fontSize: '18px', fontFamily: 'Courier New', color: '#cc7777', letterSpacing: 2
    }).setOrigin(0.5);

    this.add.rectangle(GAME_W/2, GAME_H/2 + 75, 302, 12, 0x331111);
    const bar = this.add.rectangle(GAME_W/2 - 150, GAME_H/2 + 75, 1, 12, 0xff4444).setOrigin(0, 0.5);
    this.tweens.add({ targets: bar, width: 300, duration: 5000, ease: 'Linear',
      onComplete: () => this.doRestart()
    });

    this.input.keyboard.once('keydown-R', () => this.doRestart());
    this._restarting = false;
  }

  doRestart() {
    if (this._restarting) return;
    this._restarting = true;
    this.tweens.killAll();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => this.scene.start('Phase1Scene'));
  }
}

// =============================================
//  CLASSE WinScene
// =============================================
class WinScene extends Phaser.Scene {
  constructor() { super({ key: 'WinScene' }); }
  
  create() {
    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x050508); g.fillRect(0,0,GAME_W,GAME_H);

    for(let i=0;i<60;i++){
      const cx=Phaser.Math.Between(0,GAME_W), cy=Phaser.Math.Between(0,GAME_H);
      const cc=[0xffdd44,0xff6688,0x66ffaa,0x88aaff,0xff8844][i%5];
      g.fillStyle(cc,Phaser.Math.FloatBetween(0.3,0.8));
      g.fillRect(cx,cy,Phaser.Math.Between(4,10),Phaser.Math.Between(4,10));
    }

    g.fillStyle(COLORS.doorFrame); g.fillRect(GAME_W/2-34,GAME_H/2-150,68,115);
    g.fillStyle(0x000000,0.1); g.fillRect(GAME_W/2-30,GAME_H/2-146,60,110);
    const light=this.add.rectangle(GAME_W/2,GAME_H/2-95,80,130,0xffeedd,0.15);
    this.tweens.add({targets:light,alpha:{from:0.08,to:0.25},duration:800,yoyo:true,repeat:-1});

    this.add.text(GAME_W/2, GAME_H/2-10, 'PARABÉNS!', {
      fontSize:'52px', fontFamily:'Courier New', color:'#ffdd44', letterSpacing:8
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2+55, 'Você chegou à Porta 100!', {
      fontSize:'16px', fontFamily:'Courier New', color:'#c0aae8', letterSpacing:3
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2+90, 'Feliz Aniversário! ?', {
      fontSize:'18px', fontFamily:'Courier New', color:'#ff88aa', letterSpacing:4
    }).setOrigin(0.5);

    const restart=this.add.text(GAME_W/2,GAME_H/2+140,'[ R ] Jogar novamente',{
      fontSize:'12px',fontFamily:'Courier New',color:'#44445a',letterSpacing:2
    }).setOrigin(0.5);
    this.tweens.add({targets:restart,alpha:0.2,duration:700,yoyo:true,repeat:-1});

    this.input.keyboard.on('keydown-R',()=>{
      playerHealth=4; updateHealthUI();
      this.cameras.main.fadeOut(500,0,0,0);
      this.time.delayedCall(520,()=>this.scene.start('Phase1Scene'));
    });
  }
}

// =============================================
//  INICIALIZAÇÃO DO JOGO
// =============================================
function startGame() {
  const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: 'game-container',
    backgroundColor: '#0a0a0f',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [BootScene, Phase1Scene, Phase2Scene, Phase3Scene, Phase4Scene, Phase5Scene, FinalScene, GameOverScene, WinScene]
  };
  new Phaser.Game(config);
}

startGame();