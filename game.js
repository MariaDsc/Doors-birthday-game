// =============================================
//  CONFIGURAÇÕES DO JOGO
// =============================================
const GAME_W = 900;
const GAME_H = 500;

const COLORS = {
  bg: 0x0a0a0f,
  floor: 0x1a1a28,
  floorEdge: 0x2a2840,
  wall: 0x111120,
  wallDetail: 0x1e1e32,
  player: 0xd0c8f0,
  playerEye: 0x9988dd,
  door: 0x3a2a5a,
  doorFrame: 0x6644aa,
  doorGlow: 0x9966ff,
  platform: 0x22203a,
  platformTop: 0x3a3060,
  torch: 0xffaa33,
  torchGlow: 0xff7700,
  highlight: 0x8866cc,
  danger: 0xe05555,
  text: 0xc0aae8,
  shadow: 0x050508,
};

// Textos do jogo
const TEXTS = {
  MOVE: '<- -> para mover',
  JUMP: 'ESPAÇO ou ↑ para pular',
  EXPLORE: 'Explore as salas...',
  ENTER_DOOR: '[E] para entrar na porta',
  ENTER: '[E] Entrar',
  HIDE: '[E] Esconder',
  EXIT_HIDE: '[E] Sair',
  NEED_KEY: 'Precisa da chave!',
  KEY_FOUND: 'Chave encontrada! Vá para a saída!',
  GAME_OVER: 'VOCÊ MORREU',
  TRY_AGAIN: 'Pressione R para tentar de novo',
  WIN: 'PARABÉNS!',
  BIRTHDAY: 'Feliz Aniversário!',
  PHASE_1: 'FASE 1 - O CORREDOR',
  PHASE_2: 'FASE 2 - HI, BELLS...',
  PHASE_3: 'FASE 3 - A SALA DO SALMÃO',
  PHASE_4: 'FASE 4 - A ACADEMIA',
  PHASE_5: 'FASE 5 - O CLUBE',
  PHASE_FINAL: 'FASE FINAL - BIBLIOTECA'
};

// Estado global do jogo
const GameState = {
  health: 4,
  door: 1,
  
  damage(amount = 1) {
    this.health = Math.max(0, this.health - amount);
    this.updateUI();
    return this.health <= 0;
  },
  
  heal(amount = 1) {
    this.health = Math.min(4, this.health + amount);
    this.updateUI();
  },
  
  reset() {
    this.health = 4;
    this.door = 1;
    this.updateUI();
  },
  
  updateUI() {
    for (let i = 1; i <= 4; i++) {
      const h = document.getElementById('h' + i);
      if (h) h.classList.toggle('empty', i > this.health);
    }
    const el = document.getElementById('door-num');
    if (el) el.textContent = String(this.door).padStart(3, '0');
  }
};

// =============================================
//  CLASSE BASE - TODAS AS FASES HERDAM DAQUI
// =============================================
class BaseScene extends Phaser.Scene {
  constructor(key) {
    super({ key });
  }

  init() {
    this.player = null;
    this.playerGfx = null;
    this.playerShadow = null;
    this.platforms = null;
    this.cursors = null;
    this.keys = null;
    this.facingLeft = false;
    this.transitioning = false;
    this.activePrompt = null;
    this.floorY = GAME_H - 60;
    this.worldWidth = 2400;
  }

  create() {
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.setupControls();
    this.createPlayer();
    this.setupWorld();
  }

  setupWorld() {
    this.physics.world.setBounds(0, 0, this.worldWidth, GAME_H);
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(80, this.floorY - 40)
      .setVisible(false)
      .setCollideWorldBounds(true);
    
    this.player.body.setSize(24, 40);
    this.player.body.setGravityY(700);
    this.player.body.setMaxVelocityY(900);
    
    this.playerGfx = this.add.graphics().setDepth(5);
    this.playerShadow = this.add.graphics().setDepth(1);
  }

  drawPlayer() {
    const x = this.player.x;
    const y = this.player.y;
    const g = this.playerGfx;
    
    g.clear();
    
    // Sombra
    this.playerShadow.clear();
    this.playerShadow.fillStyle(0x000000, 0.25);
    this.playerShadow.fillEllipse(x, GAME_H - 62, 34, 10);
    
    // Corpo
    g.fillStyle(COLORS.player);
    g.fillRect(x - 10, y - 38, 20, 28);
    
    // Cabeça
    g.fillRect(x - 9, y - 58, 18, 18);
    
    // Olhos
    g.fillStyle(COLORS.playerEye);
    const eyeX = this.facingLeft ? x - 5 : x + 2;
    g.fillRect(eyeX, y - 53, 4, 4);
    
    // Pernas
    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 8, y - 10, 7, 12);
    g.fillRect(x + 1, y - 10, 7, 12);
    
    // Braços
    g.fillRect(x - 14, y - 36, 5, 20);
    g.fillRect(x + 9, y - 36, 5, 20);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
    });
    
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.eKey.on('down', () => this.handleInteract());
  }

  handleMovement() {
    if (this.transitioning) return;
    
    const onGround = this.player.body.blocked.down;
    const speed = 200;

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
  }

  isNear(obj, distance = 70) {
    if (!this.player || !obj) return false;
    return Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      obj.x, obj.y
    ) < distance;
  }

  createPrompt(text, yOffset = -70, color = '#ddbbff') {
    if (this.activePrompt) this.activePrompt.destroy();
    this.activePrompt = this.add.text(this.player.x, this.player.y + yOffset, text, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: color,
      letterSpacing: 2,
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
  }

  showPhaseTitle(text) {
    const title = this.add.text(GAME_W/2, 100, text, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#8866cc',
      letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    
    this.tweens.add({
      targets: title,
      alpha: 0,
      duration: 2500,
      delay: 1000,
      onComplete: () => title.destroy()
    });
  }

  transitionTo(sceneKey) {
    this.transitioning = true;
    if (this.activePrompt) this.activePrompt.destroy();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(650, () => {
      this.scene.start(sceneKey);
    });
  }

  handleInteract() {}

  update() {
    if (this.transitioning) return;
    
    this.handleMovement();
    this.drawPlayer();
    
    if (this.activePrompt) {
      this.activePrompt.x = this.player.x;
      this.activePrompt.y = this.player.y - 70;
    }
  }
}

// =============================================
//  CENA: BOOT (TELA DE TÍTULO)
// =============================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const g = this.add.graphics();
    
    // Fundo
    g.fillStyle(COLORS.bg);
    g.fillRect(0, 0, GAME_W, GAME_H);
    
    // Vinheta
    for (let i = 0; i < 60; i++) {
      g.lineStyle(2, 0x000000, (i / 60) * 0.6);
      g.strokeRect(i, i, GAME_W - i*2, GAME_H - i*2);
    }

    // Título
    this.add.text(GAME_W/2, GAME_H/2 - 60, 'DOORS', {
      fontSize: '72px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 20,
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2 + 10, '-- EDIÇÃO DE ANIVERSÁRIO --', {
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

    // Animação da dica
    this.tweens.add({
      targets: hint,
      alpha: 0.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.once('keydown', () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(620, () => this.scene.start('Phase1Scene'));
    });
  }
}

// =============================================
//  CENA: FASE 1 - CORREDOR
// =============================================
class Phase1Scene extends BaseScene {
  constructor() { 
    super('Phase1Scene'); 
    this.worldWidth = 2400;
  }

  create() {
    super.create();
    GameState.door = 1;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_1);
    
    this.platforms = this.physics.add.staticGroup();
    this.buildLevel();
    this.createDoor();
    this.createTutorials();
    
    this.physics.add.collider(this.player, this.platforms);
  }

  buildLevel() {
    const g = this.add.graphics();

    // Chão principal
    g.fillStyle(COLORS.floor);
    g.fillRect(0, this.floorY, this.worldWidth, 60);
    g.fillStyle(COLORS.floorEdge);
    g.fillRect(0, this.floorY, this.worldWidth, 4);
    
    // Teto
    g.fillStyle(COLORS.wall);
    g.fillRect(0, 0, this.worldWidth, 30);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      { x: 300, y: 340, w: 120 },
      { x: 520, y: 280, w: 100 },
      { x: 750, y: 320, w: 140 },
      { x: 1050, y: 260, w: 100 },
      { x: 1300, y: 310, w: 120 },
      { x: 1600, y: 270, w: 100 },
      { x: 1850, y: 300, w: 130 },
      { x: 2100, y: 250, w: 110 },
    ];

    platforms.forEach(p => {
      g.fillStyle(COLORS.platform);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(COLORS.platformTop);
      g.fillRect(p.x, p.y, p.w, 3);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Decorações de parede
    for (let x = 0; x < this.worldWidth; x += 200) {
      g.fillStyle(COLORS.wallDetail, 0.5);
      g.fillRect(x, 30, 3, this.floorY - 30);
    }
  }

  createDoor() {
    const dx = 2300, dw = 55, dh = 95, dy = this.floorY - dh;

    const g = this.add.graphics();
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.add.text(dx + dw/2, dy - 18, '001', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.doorZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh);
    this.physics.add.existing(this.doorZone, true);
  }

  createTutorials() {
    const tutorials = [
      { x: 80, y: GAME_H - 110, text: TEXTS.MOVE },
      { x: 300, y: 300, text: TEXTS.JUMP },
      { x: 700, y: GAME_H - 110, text: TEXTS.EXPLORE },
      { x: 2200, y: GAME_H - 110, text: TEXTS.ENTER_DOOR }
    ];

    tutorials.forEach(t => {
      this.add.text(t.x, t.y, t.text, {
        fontSize: '12px',
        fontFamily: 'Courier New',
        color: '#6666aa',
        letterSpacing: 2
      }).setOrigin(0.5);
    });
  }

  handleInteract() {
    if (this.transitioning) return;
    if (this.isNear(this.doorZone)) {
      this.transitionTo('Phase2Scene');
    }
  }

  update() {
    super.update();
    
    if (this.isNear(this.doorZone) && !this.activePrompt) {
      this.createPrompt(TEXTS.ENTER);
    } else if (!this.isNear(this.doorZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }
}

// =============================================
//  CENA: FASE 2 - JEREMIAH
// =============================================
class Phase2Scene extends BaseScene {
  constructor() { 
    super('Phase2Scene'); 
    this.worldWidth = 2000;
  }

  create() {
    super.create();
    GameState.door = 2;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_2);
    
    this.platforms = this.physics.add.staticGroup();
    this.wardrobes = [];
    this.jeremiah = null;
    this.jeremiahGfx = null;
    this.jeremiahDir = 1;
    this.jeremiahSpeed = 80;
    this.jeremiahLooking = false;
    this.hitCooldown = false;
    this.inWardrobe = false;
    
    this.buildLevel();
    this.createJeremiah();
    this.createWardrobes();
    this.createExitDoor();
    
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.jeremiah, this.platforms);
  }

  buildLevel() {
    const g = this.add.graphics();
    g.fillStyle(0x070710);
    g.fillRect(0, 0, this.worldWidth, GAME_H);

    // Chão
    g.fillStyle(0x111122);
    g.fillRect(0, this.floorY, this.worldWidth, 60);
    g.fillStyle(0x1a1a30);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      { x: 200, y: 330, w: 120 },
      { x: 500, y: 270, w: 100 },
      { x: 800, y: 310, w: 140 },
      { x: 1100, y: 250, w: 100 },
      { x: 1400, y: 290, w: 120 },
      { x: 1700, y: 260, w: 110 },
    ];

    platforms.forEach(p => {
      g.fillStyle(0x161628);
      g.fillRect(p.x, p.y, p.w, 16);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });
  }

  createJeremiah() {
    this.jeremiah = this.physics.add.sprite(900, this.floorY - 60)
      .setVisible(false)
      .setCollideWorldBounds(true);
    
    this.jeremiah.body.setSize(30, 60);
    this.jeremiah.body.setGravityY(400);
    
    this.jeremiahGfx = this.add.graphics();
  }

  drawJeremiah() {
    const x = this.jeremiah.x;
    const y = this.jeremiah.y;
    const g = this.jeremiahGfx;
    
    g.clear();
    
    const color = this.jeremiahLooking ? 0x88ff88 : 0x447744;
    
    g.fillStyle(color, this.jeremiahLooking ? 0.9 : 0.7);
    g.fillRect(x - 12, y - 58, 24, 35);
    g.fillRect(x - 10, y - 82, 20, 22);
    
    g.fillStyle(0xeeffee);
    g.fillCircle(x - 4, y - 72, this.jeremiahLooking ? 5 : 3);
    g.fillCircle(x + 4, y - 72, this.jeremiahLooking ? 5 : 3);
    
    g.fillStyle(0x00aa00);
    g.fillCircle(x - 4, y - 72, this.jeremiahLooking ? 2 : 1);
    g.fillCircle(x + 4, y - 72, this.jeremiahLooking ? 2 : 1);
  }

  createWardrobes() {
    const g = this.add.graphics();
    const positions = [150, 600, 1000, 1500, 1850];

    positions.forEach(x => {
      g.fillStyle(0x2a1a1a);
      g.fillRect(x, this.floorY - 80, 36, 80);
      
      const zone = this.add.zone(x + 18, this.floorY - 40, 50, 80);
      this.physics.add.existing(zone, true);
      this.wardrobes.push(zone);
    });
  }

  createExitDoor() {
    const dx = 1900, dw = 55, dh = 95, dy = this.floorY - dh;

    const g = this.add.graphics();
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

    this.exitZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh);
    this.physics.add.existing(this.exitZone, true);
  }

  checkJeremiah() {
    if (this.inWardrobe) {
      this.jeremiahLooking = false;
      return;
    }

    const dx = Math.abs(this.player.x - this.jeremiah.x);
    const dy = Math.abs(this.player.y - this.jeremiah.y);
    
    const facingRight = this.jeremiahDir > 0;
    const playerInFront = facingRight ? 
      (this.player.x > this.jeremiah.x) : 
      (this.player.x < this.jeremiah.x);
    
    if (dx < 220 && dy < 90 && playerInFront && !this.hitCooldown) {
      this.jeremiahLooking = true;
      this.hitCooldown = true;
      
      if (GameState.damage(2)) {
        this.transitionTo('GameOverScene');
        return;
      }
      
      this.time.delayedCall(4000, () => { this.hitCooldown = false; });
    } else if (dx >= 220 || !playerInFront) {
      this.jeremiahLooking = false;
    }
  }

  handleInteract() {
    if (this.transitioning) return;
    
    // Verificar armários
    for (let w of this.wardrobes) {
      if (this.isNear(w)) {
        this.inWardrobe = !this.inWardrobe;
        this.player.body.setAllowGravity(!this.inWardrobe);
        if (this.inWardrobe) this.player.body.setVelocity(0, 0);
        return;
      }
    }
    
    // Verificar saída
    if (this.isNear(this.exitZone)) {
      this.transitionTo('Phase3Scene');
    }
  }

  update() {
    super.update();
    
    if (this.transitioning) return;
    
    // Atualizar Jeremiah
    if (!this.inWardrobe) {
      this.jeremiah.body.setVelocityX(this.jeremiahSpeed * this.jeremiahDir);
      if (this.jeremiah.x > 1700 || this.jeremiah.x < 200) {
        this.jeremiahDir *= -1;
        this.jeremiah.x = Phaser.Math.Clamp(this.jeremiah.x, 201, 1699);
      }
    } else {
      this.jeremiah.body.setVelocityX(0);
    }
    
    this.drawJeremiah();
    this.checkJeremiah();
    
    // Prompts
    let nearWardrobe = false;
    for (let w of this.wardrobes) {
      if (this.isNear(w)) {
        nearWardrobe = true;
        break;
      }
    }
    
    if (nearWardrobe && !this.activePrompt) {
      this.createPrompt(this.inWardrobe ? TEXTS.EXIT_HIDE : TEXTS.HIDE, -70, '#44bbff');
    } else if (this.isNear(this.exitZone) && !this.activePrompt && !nearWardrobe) {
      this.createPrompt(TEXTS.ENTER);
    } else if (!nearWardrobe && !this.isNear(this.exitZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }
}
  // =============================================
//  CENA: FASE 3 - SALA DO SALMÃO
// =============================================
class Phase3Scene extends BaseScene {
  constructor() { 
    super('Phase3Scene'); 
    this.worldWidth = 1200;
  }

  create() {
    super.create();
    GameState.door = 3;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_3);
    
    // Configurações específicas da fase
    this.timeLeft = 30;
    this.keyFound = false;
    this.waterLevel = GAME_H + 100;
    this.gameActive = false;
    this.waterRiseSpeed = 0.15;
    
    this.platforms = this.physics.add.staticGroup();
    this.salmons = [];
    
    this.buildRoom();
    this.createHiddenKey();
    this.createWater();
    this.createExitDoor();
    this.createSalmons();
    this.createTimerUI();
    
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.keyZone, this.collectKey, null, this);
    
    // Inicia a água após 2 segundos
    this.time.delayedCall(2000, () => {
      this.gameActive = true;
      this.startTimer();
    });
    
    // Aviso inicial
    const warn = this.add.text(GAME_W/2, GAME_H/2 - 30, '(!) ENCONTRE A CHAVE ANTES QUE A ÁGUA SUBA!', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#55aaff',
      letterSpacing: 2,
      align: 'center',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    
    this.tweens.add({
      targets: warn,
      alpha: 0,
      duration: 1000,
      delay: 1800,
      onComplete: () => warn.destroy()
    });
  }

  buildRoom() {
    const g = this.add.graphics();
    
    // Fundo subaquático
    g.fillStyle(0x050d14);
    g.fillRect(0, 0, this.worldWidth, GAME_H);
    
    // Bolhas decorativas
    for (let i = 0; i < 30; i++) {
      const bx = Phaser.Math.Between(20, this.worldWidth - 20);
      const by = Phaser.Math.Between(50, this.floorY - 20);
      g.fillStyle(0x1155aa, 0.15);
      g.fillCircle(bx, by, Phaser.Math.Between(2, 6));
    }

    // Chão
    g.fillStyle(0x0d1e2a);
    g.fillRect(0, this.floorY, this.worldWidth, 60);
    g.fillStyle(0x1a3444);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      { x: 100, y: 350, w: 150 },
      { x: 350, y: 280, w: 120 },
      { x: 580, y: 200, w: 130 },
      { x: 800, y: 300, w: 110 },
      { x: 950, y: 200, w: 100 },
      { x: 200, y: 160, w: 120 },
      { x: 700, y: 130, w: 100 },
    ];

    platforms.forEach(p => {
      g.fillStyle(0x122230);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x1e3a50);
      g.fillRect(p.x, p.y, p.w, 3);
      
      // Algas decorativas
      g.fillStyle(0x0d4422, 0.7);
      g.fillRect(p.x + 10, p.y - 15, 4, 15);
      g.fillRect(p.x + 20, p.y - 22, 4, 22);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Coral decorativo
    [80, 250, 500, 780, 1050].forEach(x => {
      g.fillStyle(0x994422, 0.5);
      g.fillRect(x, this.floorY - 30, 8, 30);
      g.fillCircle(x + 4, this.floorY - 32, 10);
    });

    // Paredes laterais
    const wallL = this.add.rectangle(10, GAME_H/2, 20, GAME_H).setVisible(false);
    this.physics.add.existing(wallL, true);
    this.platforms.add(wallL);
    
    const wallR = this.add.rectangle(this.worldWidth - 10, GAME_H/2, 20, GAME_H).setVisible(false);
    this.physics.add.existing(wallR, true);
    this.platforms.add(wallR);
  }

  createHiddenKey() {
    const keyX = 720, keyY = 105;
    
    // Desenho da chave
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(keyX, keyY, 8);
    g.fillStyle(0xffaa00);
    g.fillCircle(keyX, keyY, 5);
    g.fillRect(keyX + 2, keyY, 18, 4);
    g.fillRect(keyX + 14, keyY + 4, 4, 4);
    g.fillRect(keyX + 18, keyY + 4, 4, 4);

    // Brilho
    const glow = this.add.rectangle(keyX, keyY, 24, 24, 0xffdd44, 0.06).setDepth(3);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.02, to: 0.1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Dica "?"
    this.add.text(keyX, keyY - 22, '?', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#443300',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(4);

    // Zona de coleta
    this.keyZone = this.add.zone(keyX, keyY, 24, 24).setDepth(4);
    this.physics.add.existing(this.keyZone, true);
    
    this.keyGfx = g;
    this.keyGlow = glow;
  }

  createWater() {
    this.waterGfx = this.add.graphics().setDepth(3);
  }

  updateWater() {
    if (!this.gameActive || this.transitioning) return;
    
    // Água sobe cada vez mais rápido
    const elapsed = 30 - this.timeLeft;
    this.waterRiseSpeed = 0.15 + elapsed * 0.03;
    this.waterLevel -= this.waterRiseSpeed;

    const g = this.waterGfx;
    g.clear();
    
    // Corpo d'água
    g.fillStyle(0x0044aa, 0.4);
    g.fillRect(0, this.waterLevel, this.worldWidth, GAME_H - this.waterLevel + 100);
    
    // Superfície
    g.fillStyle(0x2266cc, 0.25);
    g.fillRect(0, this.waterLevel, this.worldWidth, 6);
    g.fillStyle(0x44aaff, 0.12);
    g.fillRect(0, this.waterLevel + 3, this.worldWidth, 3);

    // Verifica afogamento
    if (this.player.y > this.waterLevel && !this.transitioning) {
      if (GameState.damage(1)) {
        this.transitionTo('GameOverScene');
      } else {
        this.transitioning = true;
        this.cameras.main.fadeOut(600, 0, 20, 60);
        this.time.delayedCall(650, () => {
          this.scene.restart();
        });
      }
    }
  }

  createExitDoor() {
    const dx = 1100, dw = 55, dh = 95, dy = this.floorY - dh;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COLORS.doorFrame, 0.5);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door, 0.5);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow, 0.5);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.exitGlow = this.add.rectangle(dx + dw/2, dy + dh/2, dw + 20, dh + 20, COLORS.doorGlow, 0.04).setDepth(2);

    this.add.text(dx + dw/2, dy - 18, '003', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    this.exitZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh).setDepth(5);
    this.physics.add.existing(this.exitZone, true);
  }

  createSalmons() {
    this.salmonGfx = this.add.graphics().setDepth(4);
    const positions = [
      { x: 200, dir: 1 },
      { x: 500, dir: -1 },
      { x: 800, dir: 1 },
      { x: 1000, dir: -1 }
    ];
    
    positions.forEach(p => {
      const salmon = {
        x: p.x,
        y: GAME_H - 110,
        dir: p.dir,
        speed: 60
      };
      this.salmons.push(salmon);
    });
  }

  drawSalmons() {
    const g = this.salmonGfx;
    g.clear();
    
    // Só mostra salmões quando a água cobre 30% da tela
    const waterDepth = GAME_H - this.waterLevel;
    if (waterDepth < GAME_H * 0.3) return;

    this.salmons.forEach(s => {
      // Move os salmões
      s.x += s.speed * s.dir * 0.016; // 60fps adjustment
      s.y = this.waterLevel + 30;
      
      // Inverte direção nas bordas
      if (s.x > this.worldWidth - 30 || s.x < 30) {
        s.dir *= -1;
      }
      
      const flip = s.dir < 0 ? -1 : 1;
      
      // Desenha salmão
      g.fillStyle(0xff8866, 0.85);
      g.fillEllipse(s.x, s.y, 30 * flip, 12);
      
      g.fillTriangle(
        s.x - 14 * flip, s.y,
        s.x - 22 * flip, s.y - 8,
        s.x - 22 * flip, s.y + 8
      );
      
      g.fillStyle(0xffffff);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 2);
      g.fillStyle(0x220000);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 1);
    });
  }

  createTimerUI() {
    this.timerText = this.add.text(GAME_W/2, 20, '30', {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#55aaff',
      letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.gameActive || this.transitioning) return;
        
        this.timeLeft--;
        this.timerText.setText(String(this.timeLeft).padStart(2, '0'));
        
        if (this.timeLeft <= 10) {
          this.timerText.setColor('#ff5555');
        }
        
        if (this.timeLeft <= 0) {
          this.gameActive = false;
          
          if (GameState.damage(1)) {
            this.transitionTo('GameOverScene');
          } else {
            this.cameras.main.fadeOut(500, 0, 20, 60);
            this.time.delayedCall(550, () => {
              this.scene.restart();
            });
          }
        }
      },
      repeat: 29
    });
  }

  collectKey() {
    if (this.keyFound) return;
    
    this.keyFound = true;
    this.keyGfx.destroy();
    this.keyGlow.destroy();
    
    // Mensagem de sucesso
    const msg = this.add.text(GAME_W/2, GAME_H/2 - 20, TEXTS.KEY_FOUND, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ffdd44',
      letterSpacing: 2,
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    
    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 800,
      delay: 2000,
      onComplete: () => msg.destroy()
    });
    
    // Faz a porta brilhar
    this.tweens.add({
      targets: this.exitGlow,
      alpha: 0.2,
      duration: 500
    });
  }

  handleInteract() {
    if (this.transitioning) return;
    
    // Verificar saída
    if (this.isNear(this.exitZone)) {
      if (!this.keyFound) {
        if (!this.noKeyMsg) {
          this.noKeyMsg = this.add.text(GAME_W/2, GAME_H - 120, TEXTS.NEED_KEY, {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#ff6666',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
          }).setOrigin(0.5).setDepth(25).setScrollFactor(0);
          
          this.time.delayedCall(1500, () => {
            if (this.noKeyMsg) {
              this.noKeyMsg.destroy();
              this.noKeyMsg = null;
            }
          });
        }
        return;
      }
      this.transitionTo('Phase4Scene');
    }
  }

  update() {
    super.update();
    
    if (this.transitioning) return;
    
    this.updateWater();
    this.drawSalmons();
    
    // Prompts
    if (this.isNear(this.exitZone) && !this.activePrompt) {
      this.createPrompt(this.keyFound ? TEXTS.ENTER : '🔒 Trancada', -70, this.keyFound ? '#ffdd44' : '#ff6666');
    } else if (!this.isNear(this.exitZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
    
    if (this.noKeyMsg) {
      this.noKeyMsg.x = GAME_W/2;
    }
  }
}

// =============================================
//  CENA: FASE 4 - ACADEMIA
// =============================================
class Phase4Scene extends BaseScene {
  constructor() { 
    super('Phase4Scene'); 
    this.worldWidth = 2200;
  }

  create() {
    super.create();
    GameState.door = 4;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_4);
    
    // Configurações específicas
    this.inLocker = false;
    this.mariaCooldown = false;
    this.hitCooldown = false;
    this.lockerXs = [139, 719, 1319, 1919];
    this.mariaTriggerXs = [500, 1200, 1800];
    this.mariaTriggered = [false, false, false];
    
    this.platforms = this.physics.add.staticGroup();
    this.weightData = [];
    this.lockerZones = [];
    
    this.buildLevel();
    this.createWeights();
    this.createLockers();
    this.createExitDoor();
    
    this.physics.add.collider(this.player, this.platforms);
    
    this.mariaGfx = this.add.graphics().setDepth(15);
  }

  buildLevel() {
    const g = this.add.graphics();
    
    // Fundo
    g.fillStyle(0x080810);
    g.fillRect(0, 0, this.worldWidth, GAME_H);
    
    // Chão com padrão
    for (let x = 0; x < this.worldWidth; x += 40) {
      g.fillStyle(x % 80 === 0 ? 0x111120 : 0x0e0e1c);
      g.fillRect(x, this.floorY, 40, 60);
    }
    
    g.fillStyle(0x2a2840);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      {x:150,y:350,w:160}, {x:420,y:290,w:120}, {x:680,y:330,w:140},
      {x:950,y:260,w:130}, {x:1200,y:310,w:150}, {x:1480,y:270,w:120},
      {x:1720,y:300,w:140}, {x:1980,y:240,w:120}
    ];

    platforms.forEach(p => {
      g.fillStyle(0x2a1a0a);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x4a3010);
      g.fillRect(p.x, p.y, p.w, 3);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Tochas
    [80,300,600,900,1200,1500,1800,2100].forEach(x => {
      g.fillStyle(0x551100,0.7);
      g.fillRect(x-2, this.floorY-130, 4, 25);
      g.fillStyle(0xff4400,0.8);
      g.fillCircle(x, this.floorY-138, 6);
    });
  }

  createLockers() {
    const g = this.add.graphics().setDepth(2);
    
    this.lockerXs.forEach(cx => {
      const x = cx - 19;
      g.fillStyle(0x1a2233);
      g.fillRect(x, this.floorY-90, 38, 90);
      g.lineStyle(2, 0x4488cc, 0.9);
      g.strokeRect(x, this.floorY-90, 38, 90);
      
      // Rótulo
      this.add.text(cx, this.floorY-105, 'LOCKER', {
        fontSize:'9px',
        fontFamily:'Courier New',
        color:'#4499dd',
        letterSpacing:1
      }).setOrigin(0.5).setDepth(3);
      
      // Zona de interação
      const zone = this.add.zone(cx, this.floorY-45, 50, 80);
      this.physics.add.existing(zone, true);
      this.lockerZones.push(zone);
    });
  }

  createWeights() {
    this.weightGfx = this.add.graphics().setDepth(2);
    
    [200,600,1000,1400,1800].forEach((x,i) => {
      const weight = {
        x: x,
        y: this.floorY - 20,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 60
      };
      this.weightData.push(weight);
    });
  }

  drawWeights() {
    const g = this.weightGfx;
    g.clear();
    
    this.weightData.forEach(w => {
      // Move os pesos
      w.x += w.speed * w.dir * 0.016;
      
      if (w.x > this.worldWidth - 50 || w.x < 50) {
        w.dir *= -1;
      }
      
      // Desenha peso
      g.fillStyle(0x333344);
      g.fillRect(w.x - 18, w.y - 6, 36, 12);
      g.fillStyle(0x222233);
      g.fillRect(w.x - 22, w.y - 9, 8, 18);
      g.fillRect(w.x + 14, w.y - 9, 8, 18);
      g.fillStyle(0x444466);
      g.fillCircle(w.x - 18, w.y, 9);
      g.fillCircle(w.x + 18, w.y, 9);
    });
  }

  createExitDoor() {
    const dx = 2100, dw = 55, dh = 95, dy = this.floorY - dh;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.add.text(dx + dw/2, dy - 18, '004', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.exitZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh);
    this.physics.add.existing(this.exitZone, true);
  }

  triggerMaria() {
    if (this.mariaCooldown || this.inLocker) return;
    
    this.mariaCooldown = true;
    
    // Desenha Maria
    const g = this.mariaGfx;
    g.clear();
    g.setAlpha(1);
    
    const mx = this.player.x + 80;
    const my = this.floorY - 60;
    
    g.fillStyle(0x110011, 0.9);
    g.fillRect(mx - 12, my - 55, 24, 35);
    g.fillRect(mx - 9, my - 78, 18, 22);
    
    g.fillStyle(0xffffff);
    g.fillCircle(mx - 4, my - 68, 7);
    g.fillCircle(mx + 4, my - 68, 7);
    
    g.fillStyle(0x660066);
    g.fillCircle(mx - 4, my - 68, 4);
    g.fillCircle(mx + 4, my - 68, 4);
    
    // Animação de fade
    this.tweens.add({
      targets: this.mariaGfx,
      alpha: 0,
      duration: 2000,
      onComplete: () => this.mariaGfx.clear()
    });

    // Aviso
    const warn = this.add.text(GAME_W/2, GAME_H/2 - 20, '(!) ENTRE NO LOCKER!', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ff5555',
      letterSpacing: 2,
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(25);
    
    this.tweens.add({
      targets: warn,
      alpha: { from: 1, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: 6,
      onComplete: () => warn.destroy()
    });

    // Dano se não se esconder
    this.time.delayedCall(3000, () => {
      if (!this.inLocker && !this.hitCooldown) {
        this.hitCooldown = true;
        
        if (GameState.damage(1)) {
          this.transitionTo('GameOverScene');
        }
        
        this.time.delayedCall(2000, () => {
          this.hitCooldown = false;
        });
      }
      this.time.delayedCall(2000, () => {
        this.mariaCooldown = false;
      });
    });
  }

  handleInteract() {
    if (this.transitioning) return;
    
    // Verificar lockers
    for (let locker of this.lockerZones) {
      if (this.isNear(locker)) {
        this.inLocker = !this.inLocker;
        this.player.body.setAllowGravity(!this.inLocker);
        if (this.inLocker) this.player.body.setVelocity(0, 0);
        return;
      }
    }
    
    // Verificar saída
    if (this.isNear(this.exitZone)) {
      this.transitionTo('Phase5Scene');
    }
  }

  update() {
    if (this.transitioning) return;
    
    // Verifica se está em locker
    if (this.inLocker) {
      this.player.body.setVelocity(0, 0);
      this.player.body.setAllowGravity(false);
      
      // Desenha silhueta no locker
      const lockerX = this.lockerXs.find(lx => Math.abs(this.player.x - lx) < 60) || this.player.x;
      this.playerGfx.clear();
      this.playerGfx.fillStyle(0x112233, 0.7);
      this.playerGfx.fillRect(lockerX - 8, this.player.y - 35, 16, 35);
    } else {
      this.player.body.setAllowGravity(true);
      this.handleMovement();
      this.drawPlayer();
    }
    
    this.drawWeights();
    
    // Gatilhos da Maria
    this.mariaTriggerXs.forEach((tx, i) => {
      if (!this.mariaTriggered[i] && Math.abs(this.player.x - tx) < 50) {
        this.mariaTriggered[i] = true;
        this.triggerMaria();
      }
    });
    
    // Prompts
    let nearLocker = false;
    for (let locker of this.lockerZones) {
      if (this.isNear(locker)) {
        nearLocker = true;
        break;
      }
    }
    
    if (nearLocker && !this.activePrompt) {
      this.createPrompt(this.inLocker ? TEXTS.EXIT_HIDE : TEXTS.HIDE, -70, '#44bbff');
    } else if (this.isNear(this.exitZone) && !this.activePrompt && !nearLocker) {
      this.createPrompt(TEXTS.ENTER);
    } else if (!nearLocker && !this.isNear(this.exitZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }
}

// =============================================
//  CENA: FASE 5 - ARENA
// =============================================
class Phase5Scene extends BaseScene {
  constructor() { 
    super('Phase5Scene'); 
    this.worldWidth = 1800;
  }

  create() {
    super.create();
    GameState.door = 5;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_5);
    
    // Configurações específicas
    this.inHiding = false;
    this.hitCooldown = false;
    this.mariaCooldown = false;
    this.hideXs = [119, 869, 1669];
    this.mariaTriggerXs = [450, 1200];
    this.mariaTriggered = [false, false];
    
    this.platforms = this.physics.add.staticGroup();
    this.enemies = [];
    this.hideZones = [];
    
    this.buildLevel();
    this.createEnemies();
    this.createHideSpots();
    this.createExitDoor();
    
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    
    this.mariaGfx = this.add.graphics().setDepth(15);
  }

  buildLevel() {
    const g = this.add.graphics();
    
    // Fundo
    g.fillStyle(0x050510);
    g.fillRect(0, 0, this.worldWidth, GAME_H);
    
    // Chão xadrez
    for(let x = 0; x < this.worldWidth; x += 50) {
      for(let y = this.floorY; y < GAME_H; y += 50) {
        g.fillStyle(((x + y) / 50) % 2 === 0 ? 0x0d0d20 : 0x0a0a18);
        g.fillRect(x, y, 50, 50);
      }
    }

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      {x:80,y:200,w:100}, {x:300,y:300,w:120}, {x:550,y:240,w:100},
      {x:750,y:310,w:130}, {x:980,y:260,w:110}, {x:1200,y:290,w:120},
      {x:1430,y:240,w:100}, {x:1650,y:200,w:100}
    ];

    platforms.forEach(p => {
      g.fillStyle(0x161630);
      g.fillRect(p.x, p.y, p.w, 16);
      
      const plat = this.add.rectangle(p.x + p.w/2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Tochas azuis
    [80,350,650,950,1250,1550,1750].forEach(x => {
      g.fillStyle(0x221155,0.8);
      g.fillRect(x-2, this.floorY-130, 4, 25);
      g.fillStyle(0x6633ff,0.8);
      g.fillCircle(x, this.floorY-138, 6);
    });
  }

  createHideSpots() {
    const g = this.add.graphics().setDepth(2);
    
    this.hideXs.forEach(cx => {
      const x = cx - 19;
      g.fillStyle(0x1a1a2a);
      g.fillRect(x, this.floorY-85, 38, 85);
      g.lineStyle(1, 0x334466, 0.9);
      g.strokeRect(x, this.floorY-85, 38, 85);
      
      this.add.text(cx, this.floorY-98, 'ESCONDER', {
        fontSize: '8px',
        fontFamily: 'Courier New',
        color: '#4466aa',
        letterSpacing: 1
      }).setOrigin(0.5);
      
      const zone = this.add.zone(cx, this.floorY-42, 50, 80);
      this.physics.add.existing(zone, true);
      this.hideZones.push(zone);
    });
  }

  createEnemies() {
    this.enemyGfx = this.add.graphics().setDepth(4);
    
    const enemyTypes = ['knight', 'giant', 'archer'];
    const positions = [300, 600, 900, 1200, 1500];
    
    this.enemyList = positions.map((x, i) => ({
      x: x,
      y: this.floorY - 40,
      type: enemyTypes[i % 3],
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: 60,
      hp: i % 3 === 1 ? 2 : 1 // giant tem 2 de vida
    }));
  }

  drawEnemies() {
    const g = this.enemyGfx;
    g.clear();
    
    this.enemyList.forEach(e => {
      // Move inimigo
      e.x += e.speed * e.dir * 0.016;
      
      if (e.x > this.worldWidth - 50 || e.x < 50) {
        e.dir *= -1;
      }
      
      const flip = e.dir < 0 ? -1 : 1;
      const x = e.x;
      const y = e.y;
      
      if (e.type === 'knight') {
        g.fillStyle(0x888899);
        g.fillRect(x - 11, y - 38, 22, 28);
        g.fillStyle(0xaaaacc);
        g.fillRect(x - 10, y - 58, 20, 20);
        g.fillStyle(0x444455);
        g.fillRect(x - 9, y - 10, 8, 12);
        g.fillRect(x + 1, y - 10, 8, 12);
      } else if (e.type === 'giant') {
        g.fillStyle(0x556644);
        g.fillRect(x - 14, y - 40, 28, 34);
        g.fillStyle(0x667755);
        g.fillRect(x - 12, y - 62, 24, 22);
        g.fillStyle(0x445533);
        g.fillRect(x - 11, y - 10, 10, 14);
        g.fillRect(x + 1, y - 10, 10, 14);
      } else {
        g.fillStyle(0x885533);
        g.fillRect(x - 9, y - 38, 18, 28);
        g.fillStyle(0x996644);
        g.fillRect(x - 8, y - 58, 16, 20);
        g.fillStyle(0x775522);
        g.fillRect(x - 8, y - 10, 7, 12);
        g.fillRect(x + 1, y - 10, 7, 12);
      }
    });
  }

  checkEnemyCollision() {
    if (this.hitCooldown || this.inHiding) return;
    
    for (let e of this.enemyList) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        e.x, e.y
      );
      
      if (dist < 40) {
        this.hitCooldown = true;
        
        if (GameState.damage(1)) {
          this.transitionTo('GameOverScene');
          return;
        }
        
        // Repulsão
        const dir = this.player.x < e.x ? -1 : 1;
        this.player.body.setVelocityX(dir * 300);
        this.player.body.setVelocityY(-200);
        
        this.time.delayedCall(1200, () => {
          this.hitCooldown = false;
        });
        
        break;
      }
    }
  }

  createExitDoor() {
    const dx = 1700, dw = 55, dh = 95, dy = this.floorY - dh;

    const g = this.add.graphics().setDepth(2);
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    g.fillStyle(COLORS.door);
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(dx + dw - 10, dy + dh/2, 4);

    this.add.text(dx + dw/2, dy - 18, '005', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.exitZone = this.add.zone(dx + dw/2, dy + dh/2, dw, dh);
    this.physics.add.existing(this.exitZone, true);
  }

  triggerMaria() {
    if (this.mariaCooldown || this.inHiding) return;
    
    this.mariaCooldown = true;
    
    // Desenha Maria
    const g = this.mariaGfx;
    g.clear();
    g.setAlpha(1);
    
    const mx = this.player.x + 80;
    const my = this.floorY - 60;
    
    g.fillStyle(0xff00ff, 0.25);
    g.fillCircle(mx, my - 40, 55);
    g.fillStyle(0xcc44cc);
    g.fillRect(mx - 13, my - 55, 26, 36);
    g.fillRect(mx - 10, my - 78, 20, 24);
    g.fillStyle(0xffffff);
    g.fillCircle(mx - 5, my - 68, 8);
    g.fillCircle(mx + 5, my - 68, 8);
    
    this.tweens.add({
      targets: this.mariaGfx,
      alpha: 0,
      duration: 2000,
      onComplete: () => this.mariaGfx.clear()
    });

    // Aviso
    const warn = this.add.text(GAME_W/2, GAME_H/2 - 20, '(!) ESCONDA-SE!', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#ff5555',
      letterSpacing: 2,
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(25);
    
    this.tweens.add({
      targets: warn,
      alpha: { from: 1, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: 6,
      onComplete: () => warn.destroy()
    });

    // Dano se não se esconder
    this.time.delayedCall(2000, () => {
      if (!this.inHiding && !this.hitCooldown) {
        this.hitCooldown = true;
        
        if (GameState.damage(1)) {
          this.transitionTo('GameOverScene');
        }
        
        this.time.delayedCall(1500, () => {
          this.hitCooldown = false;
        });
      }
      this.time.delayedCall(2000, () => {
        this.mariaCooldown = false;
      });
    });
  }

  handleInteract() {
    if (this.transitioning) return;
    
    // Verificar esconderijos
    for (let hide of this.hideZones) {
      if (this.isNear(hide)) {
        this.inHiding = !this.inHiding;
        this.player.body.setAllowGravity(!this.inHiding);
        if (this.inHiding) this.player.body.setVelocity(0, 0);
        return;
      }
    }
    
    // Verificar saída
    if (this.isNear(this.exitZone)) {
      this.transitionTo('FinalScene');
    }
  }

  update() {
    if (this.transitioning) return;
    
    // Verifica se está escondido
    if (this.inHiding) {
      this.player.body.setVelocity(0, 0);
      this.player.body.setAllowGravity(false);
      
      // Desenha silhueta
      const hideX = this.hideXs.find(hx => Math.abs(this.player.x - hx) < 50) || this.player.x;
      this.playerGfx.clear();
      this.playerGfx.fillStyle(0x112233, 0.7);
      this.playerGfx.fillRect(hideX - 8, this.player.y - 35, 16, 35);
    } else {
      this.player.body.setAllowGravity(true);
      this.handleMovement();
      this.drawPlayer();
      this.checkEnemyCollision();
    }
    
    this.drawEnemies();
    
    // Gatilhos da Maria
    this.mariaTriggerXs.forEach((tx, i) => {
      if (!this.mariaTriggered[i] && Math.abs(this.player.x - tx) < 40) {
        this.mariaTriggered[i] = true;
        this.triggerMaria();
      }
    });
    
    // Prompts
    let nearHide = false;
    for (let hide of this.hideZones) {
      if (this.isNear(hide)) {
        nearHide = true;
        break;
      }
    }
    
    if (nearHide && !this.activePrompt) {
      this.createPrompt(this.inHiding ? TEXTS.EXIT_HIDE : TEXTS.HIDE, -70, '#44bbff');
    } else if (this.isNear(this.exitZone) && !this.activePrompt && !nearHide) {
      this.createPrompt(TEXTS.ENTER);
    } else if (!nearHide && !this.isNear(this.exitZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }
}

// =============================================
//  CENA: FASE FINAL - BIBLIOTECA
// =============================================
class FinalScene extends BaseScene {
  constructor() { 
    super('FinalScene'); 
    this.worldWidth = GAME_W;
  }

  create() {
    super.create();
    GameState.door = 100;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_FINAL);
    
    // Configurações específicas
    this.solvedCount = 0;
    this.totalPuzzles = 3;
    this.activePuzzle = null;
    this.puzzles = [];
    
    this.platforms = this.physics.add.staticGroup();
    this.puzzleZones = this.physics.add.staticGroup();
    
    this.buildLibrary();
    this.createPuzzles();
    
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.puzzleZones, this.nearPuzzle, null, this);
  }

  buildLibrary() {
    const g = this.add.graphics();
    
    // Fundo
    g.fillStyle(0x06060e);
    g.fillRect(0, 0, this.worldWidth, GAME_H);
    
    // Chão
    g.fillStyle(0x0e0e1a);
    g.fillRect(0, this.floorY, this.worldWidth, 60);
    g.fillStyle(0x1a1a28);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth/2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Estantes como plataformas
    const shelves = [
      {x:50,y:320,w:160}, {x:350,y:260,w:160},
      {x:650,y:300,w:160}, {x:700,y:200,w:120}
    ];

    shelves.forEach(s => {
      g.fillStyle(0x1a0e05);
      g.fillRect(s.x, s.y, s.w, GAME_H - 60 - s.y);
      
      // Livros
      const bookColors = [0x8b0000, 0x006400, 0x00008b, 0x8b6914];
      for(let bx = s.x + 4; bx < s.x + s.w - 4; bx += 12) {
        g.fillStyle(bookColors[Math.floor((bx/12) % bookColors.length)], 0.8);
        g.fillRect(bx, s.y - 20, 10, 20);
      }
      
      const plat = this.add.rectangle(s.x + s.w/2, s.y + 8, s.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // A porta final (trancada)
    const dx = GAME_W/2 - 30, dy = this.floorY - 110;
    g.fillStyle(0x2a1a00);
    g.fillRect(dx - 4, dy - 6, 68, 116);
    g.fillStyle(0x1a0e00);
    g.fillRect(dx, dy, 60, 110);
    
    // Cadeado
    g.fillStyle(0x775500);
    g.fillRect(dx + 22, dy + 50, 16, 14);
    
    this.add.text(GAME_W/2, dy - 20, 'DOOR 100', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#553300',
      letterSpacing: 2
    }).setOrigin(0.5);
  }

  createPuzzles() {
    const g = this.add.graphics().setDepth(3);
    
    const puzzleData = [
      { x: 150, code: '? + ? = 10\n(5 + _)', answer: '5', hint: 'Dois iguais que somam 10' },
      { x: 450, code: 'CHUCHU\n ao cubo', answer: '3', hint: 'Letras de CHUCHU' },
      { x: 750, code: 'Porta\n___ + 1\n= 100', answer: '99', hint: 'Porta anterior à final' },
    ];

    this.puzzles = puzzleData.map((p, i) => {
      // Pedestal
      g.fillStyle(0x1a1408);
      g.fillRect(p.x - 20, this.floorY - 55, 40, 55);
      
      // Orbe brilhante
      g.fillStyle(0x4444aa, 0.6);
      g.fillCircle(p.x, this.floorY - 70, 12);
      
      // Número
      this.add.text(p.x, this.floorY - 95, `[${i+1}]`, {
        fontSize: '12px',
        fontFamily: 'Courier New',
        color: '#6666aa',
        letterSpacing: 2
      }).setOrigin(0.5).setDepth(4);

      const zone = this.add.zone(p.x, this.floorY - 30, 50, 60);
      this.physics.add.existing(zone, true);
      this.puzzleZones.add(zone);
      
      return { zone, ...p, solved: false };
    });
  }

  nearPuzzle(player, zone) {
    if (this.activePuzzle !== null) return;
    
    const puzzle = this.puzzles.find(p => p.zone === zone);
    if (!puzzle || puzzle.solved) return;

    if (!this.interactHint) {
      this.interactHint = this.add.text(GAME_W/2, GAME_H - 90, '[E] Examinar', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#6666aa',
        letterSpacing: 2,
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
    }

    this.nearPuzzleObj = puzzle;
  }

  showPuzzleUI(puzzle) {
    // Overlay escuro
    this.overlay = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(30);
    
    // Caixa do puzzle
    this.add.rectangle(GAME_W/2, GAME_H/2, 400, 250, 0x0e0e1a)
      .setScrollFactor(0).setDepth(31);
    this.add.rectangle(GAME_W/2, GAME_H/2, 400, 250, 0x0, 0)
      .setStrokeStyle(2, 0x4444aa).setScrollFactor(0).setDepth(32);

    // Conteúdo
    this.add.text(GAME_W/2, GAME_H/2 - 80, '-- ENIGMA --', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#8888cc',
      letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W/2, GAME_H/2 - 40, puzzle.code, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 2,
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W/2, GAME_H/2, puzzle.hint, {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#445566',
      letterSpacing: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W/2 - 60, GAME_H/2 + 40, 'RESPOSTA:', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#6666aa',
      letterSpacing: 1
    }).setOrigin(0,0.5).setScrollFactor(0).setDepth(32);

    this.answerText = '';
    this.answerDisplay = this.add.text(GAME_W/2 + 20, GAME_H/2 + 40, '_', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 3
    }).setOrigin(0,0.5).setScrollFactor(0).setDepth(32);

    this.feedbackText = this.add.text(GAME_W/2, GAME_H/2 + 80, '', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#ff5555',
      letterSpacing: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    // Input handler
    this.puzzleKeyHandler = (e) => {
      if (e.key === 'Escape') {
        this.closePuzzleUI();
        return;
      }
      if (e.key === 'Enter') {
        this.checkAnswer();
        return;
      }
      if (e.key === 'Backspace') {
        this.answerText = this.answerText.slice(0, -1);
      } else if (e.key.length === 1 && this.answerText.length < 6) {
        this.answerText += e.key;
      }
      this.answerDisplay.setText(this.answerText || '_');
    };
    
    window.addEventListener('keydown', this.puzzleKeyHandler);
    
    if (this.interactHint) {
      this.interactHint.destroy();
      this.interactHint = null;
    }
  }

  checkAnswer() {
    if (this.answerText.trim() === this.activePuzzle.answer) {
      // Correto
      this.feedbackText.setColor('#00ff88').setText('✓ CORRETO!');
      window.removeEventListener('keydown', this.puzzleKeyHandler);
      
      this.activePuzzle.solved = true;
      this.solvedCount++;
      
      this.time.delayedCall(1000, () => {
        this.closePuzzleUI();
        this.checkWin();
      });
    } else {
      // Errado
      this.feedbackText.setText('✗ ERRADO. Tente novamente.');
      this.answerText = '';
      this.answerDisplay.setText('_');
      
      if (GameState.damage(1)) {
        window.removeEventListener('keydown', this.puzzleKeyHandler);
        this.closePuzzleUI();
        this.time.delayedCall(500, () => this.transitionTo('GameOverScene'));
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
      const msg = this.add.text(GAME_W/2, GAME_H/2 - 20, `${remaining} enigma(s) restante(s)...`, {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#6666aa',
        letterSpacing: 2,
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
      
      this.tweens.add({
        targets: msg,
        alpha: 0,
        duration: 800,
        delay: 1500,
        onComplete: () => msg.destroy()
      });
      return;
    }
    
    // Todos resolvidos - vitória!
    this.transitioning = true;
    
    const unlock = this.add.text(GAME_W/2, GAME_H/2, '✓ PORTA DESTRANCADA!', {
      fontSize: '20px',
      fontFamily: 'Courier New',
      color: '#ffdd44',
      letterSpacing: 3,
      backgroundColor: '#000000',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    
    this.tweens.add({
      targets: unlock,
      alpha: { from: 1, to: 0.3 },
      duration: 400,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        unlock.destroy();
        this.transitionTo('WinScene');
      }
    });
  }

  handleInteract() {
    if (this.transitioning || this.activePuzzle) return;
    
    if (this.nearPuzzleObj && !this.nearPuzzleObj.solved) {
      this.activePuzzle = this.nearPuzzleObj;
      this.showPuzzleUI(this.nearPuzzleObj);
    }
  }

  update() {
    if (this.transitioning) return;
    if (this.activePuzzle) return;
    
    this.handleMovement();
    this.drawPlayer();
    
    // Atualiza dica de interação
    if (this.nearPuzzleObj && !this.interactHint) {
      this.interactHint = this.add.text(GAME_W/2, GAME_H - 90, '[E] Examinar', {
        fontSize: '14px',
        fontFamily: 'Courier New',
        color: '#6666aa',
        letterSpacing: 2,
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
    } else if (!this.nearPuzzleObj && this.interactHint) {
      this.interactHint.destroy();
      this.interactHint = null;
    }
    
    this.nearPuzzleObj = null;
  }
}
// =============================================
//  CENA: GAME OVER
// =============================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(700, 0, 0, 0);
    
    this.add.text(GAME_W/2, GAME_H/2 - 80, TEXTS.GAME_OVER, {
      fontSize: '52px',
      fontFamily: 'Courier New',
      color: '#ff4444',
      letterSpacing: 8
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2 - 10, TEXTS.TRY_AGAIN, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#cc7777',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-R', () => {
      GameState.reset();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(450, () => this.scene.start('Phase1Scene'));
    });
  }
}

// =============================================
//  CENA: VITÓRIA
// =============================================
class WinScene extends Phaser.Scene {
  constructor() { super({ key: 'WinScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    
    // Confetes
    const g = this.add.graphics();
    for(let i = 0; i < 60; i++) {
      const cx = Phaser.Math.Between(0, GAME_W);
      const cy = Phaser.Math.Between(0, GAME_H);
      const cc = [0xffdd44, 0xff6688, 0x66ffaa][i % 3];
      g.fillStyle(cc, Phaser.Math.FloatBetween(0.3, 0.8));
      g.fillRect(cx, cy, Phaser.Math.Between(4, 10), Phaser.Math.Between(4, 10));
    }

    this.add.text(GAME_W/2, GAME_H/2 - 10, TEXTS.WIN, {
      fontSize: '52px',
      fontFamily: 'Courier New',
      color: '#ffdd44',
      letterSpacing: 8
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2 + 55, 'Você chegou à Porta 100!', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.add.text(GAME_W/2, GAME_H/2 + 90, TEXTS.BIRTHDAY, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ff88aa',
      letterSpacing: 4
    }).setOrigin(0.5);

    const restart = this.add.text(GAME_W/2, GAME_H/2 + 140, '[ R ] Jogar novamente', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#44445a',
      letterSpacing: 2
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: restart,
      alpha: 0.2,
      duration: 700,
      yoyo: true,
      repeat: -1
    });

    this.input.keyboard.on('keydown-R', () => {
      GameState.reset();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(520, () => this.scene.start('Phase1Scene'));
    });
  }
}
// =============================================
//  INICIALIZAÇÃO DO JOGO
// =============================================
const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  physics: {
    default: 'arcade',
    arcade: { 
      gravity: { y: 0 },
      debug: false 
    }
  },
  scene: [
    BootScene,
    Phase1Scene,
    Phase2Scene,
    Phase3Scene,
    Phase4Scene,
    Phase5Scene,
    FinalScene,
    GameOverScene,
    WinScene
  ]
};

// Inicializa o jogo quando a página carregar
window.onload = () => {
  new Phaser.Game(config);
};