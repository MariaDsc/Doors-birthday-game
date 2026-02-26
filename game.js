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
  ENTER: '[E] Entrar',
  HIDE: '[E] Esconder',
  EXIT_HIDE: '[E] Sair',
  NEED_KEY: 'Pegue a chave!',
  KEY_FOUND: 'Chave encontrada',
  GAME_OVER: 'VOCÊ MORREU',
  TRY_AGAIN: 'Pressione R para tentar de novo',
  WIN: 'PARABÉNS!',
  BIRTHDAY: 'Feliz Aniversário, Xu!',
  PHASE_1: 'FASE 1 - O CORREDOR',
  PHASE_2: 'FASE 2 - OI, BELLS...',
  PHASE_3: 'FASE 3 - SALA DO SALMÃO',
  PHASE_4: 'FASE 4 - ACADEMIA',
  PHASE_5: 'FASE 5 - A ARENA',
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
      down: Phaser.Input.Keyboard.KeyCodes.S,
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
    const title = this.add.text(GAME_W / 2, 100, text, {
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
    if (this.music) this.music.stop();
    this.transitioning = true;
    if (this.activePrompt) this.activePrompt.destroy();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(650, () => {
      this.scene.start(sceneKey);
    });
  }

  handleInteract() { }

  update() {
    if (this.transitioning) return;

    this.handleMovement();
    this.drawPlayer();

    if (this.activePrompt) {
      this.activePrompt.x = this.player.x;
      this.activePrompt.y = this.player.y - 70;
    }
  }

  /* CHAVE (compartilhado entre fases)*/
  createHiddenKey(keyX, keyY) {
    // keyX e keyY = posição da chave (cada fase passa valores diferentes)

    // Começa com a chave não coletada
    this.keyFound = false;

    // Cria o "pincel" pra desenhar a chave
    // setDepth(4)= "profundidade" no cenário >> garante que apareça na frente
    const g = this.add.graphics().setDepth(4);

    // ── DESENHO DA CHAVE ──────────────────────────────────

    // Círculo externo da cabeça (amarelo dourado)
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(keyX, keyY, 8);

    // Círculo interno da cabeça (laranja) — profundidade
    g.fillStyle(0xffaa00);
    g.fillCircle(keyX, keyY, 5);

    // Cabo e dentes da chave (três retângulos)
    g.fillRect(keyX + 2, keyY, 18, 4);       // cabo principal
    g.fillRect(keyX + 14, keyY + 4, 4, 4);   // primeiro dente
    g.fillRect(keyX + 18, keyY + 4, 4, 4);   // segundo dente

    // ── BRILHO  ───────────────────────────────────

    // Retângulo dourado semitransparente que vai piscar
    const glow = this.add.rectangle(keyX, keyY, 24, 24, 0xffdd44, 0.06).setDepth(3);

    // Animação do brilho: vai de quase invisível (0.02) até levemente visível (0.1)
    // yoyo: true  → volta ao valor inicial depois de chegar ao final
    // repeat: -1  → repete para sempre
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.02, to: 0.1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // ── ZONA DE COLISÃO INVISÍVEL ─────────────────────────

    // Área invisível de 24x24 pixels — é o que o sistema de física enxerga
    // O desenho acima é só visual, quem detecta o toque do player é essa zona
    this.keyZone = this.add.zone(keyX, keyY, 24, 24).setDepth(4);

    // Registra a zona no sistema de física
    // true = estática (não cai, não se move)
    this.physics.add.existing(this.keyZone, true);
    this.keyZone.body.setSize(24, 24);

    // ── GUARDA REFERÊNCIAS ────────────────────────────────

    // Salva cada elemento pra que collectKey() consiga apagá-los depois
    this.keyGfx = g;       // o desenho da chave
    this.keyGlow = glow;    // o brilho pulsante
  }

  collectKey() {
    // Proteção: o Phaser chama essa função 60x por segundo enquanto
    // o player estiver em cima da zona — sem esse if, tudo aconteceria várias vezes
    if (this.keyFound) return;

    // Marca como coletada pra o if acima bloquear as próximas chamadas
    this.keyFound = true;
    this.sound.play('som_chave', { volume: 1.5, seek: 2 }); //toca o som da chave, começando a 2s 

    // remove a chave da tela >> destroy() apaga o elemento completamente 
    this.keyGfx.destroy();   // apaga o desenho
    this.keyGlow.destroy();  // apaga o brilho

    const msg = this.add.text(GAME_W / 2, GAME_H / 2 - 20, TEXTS.KEY_FOUND, {
      fontSize: '13px', fontFamily: 'Courier New',
      color: '#ffdd44', letterSpacing: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20); //setScrollFactor(0) fixa o texto na tela >> não rola com a câmera

    // Animação de desaparecimento:
    // delay: 2000   → espera 2 segundos antes de começar
    // duration: 800 → leva 800ms pra chegar em alpha 0 (invisível)
    // onComplete    → quando terminar a animação, apaga o objeto da memória
    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 800,
      delay: 2000,
      onComplete: () => msg.destroy()
    });
  }

  showLockedMessage() {
    // Só cria a mensagem se ela ainda não estiver na tela
    if (this.noKeyMsg) return;

    this.noKeyMsg = this.add.text(GAME_W / 2, GAME_H - 120, TEXTS.NEED_KEY, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#ff6666',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(25).setScrollFactor(0);

    // Apaga automaticamente depois de 1.5 segundos
    this.time.delayedCall(1500, () => {
      if (this.noKeyMsg) {
        this.noKeyMsg.destroy();
        this.noKeyMsg = null;
      }
    });
  }
  createDoor(x, label, destination) {
    const dw = 55, dh = 95, dy = this.floorY - dh;
    const dx = x;

    const g = this.add.graphics().setDepth(3);

    // Moldura
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);

    // Porta
    g.fillStyle(COLORS.door);
    g.fillRect(dx, dy, dw, dh);

    // Painéis
    g.lineStyle(1, COLORS.highlight, 0.3);
    g.strokeRect(dx + 5, dy + 5, dw - 10, (dh - 15) / 2);
    g.strokeRect(dx + 5, dy + 10 + (dh - 15) / 2, dw - 10, (dh - 15) / 2 - 5);

    // Maçaneta
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(dx + dw - 10, dy + dh / 2, 4);

    // Brilho de fundo
    g.fillStyle(COLORS.doorGlow, 0.08);
    g.fillRect(dx - 20, dy - 20, dw + 40, dh + 40);

    // Número da porta
    this.add.text(dx + dw / 2, dy - 18, label, {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    // Brilho animado
    const glow = this.add.rectangle(dx + dw / 2, dy + dh / 2, dw + 20, dh + 20, COLORS.doorGlow, 0.06).setDepth(3);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.10 },
      duration: 1200,
      yoyo: true,
      repeat: -1
    });

    // Zona de colisão
    this.doorZone = this.add.zone(dx + dw / 2, dy + dh / 2, dw, dh);
    this.physics.add.existing(this.doorZone, true);

    // Guarda o destino pra usar no handleInteract()
    this.doorDestination = destination;
  }
  preload() {
    // Músicas
    this.load.audio('musica_fase1', ['assets/audio/fase1.ogg', 'assets/audio/fase1.mp3']);
    this.load.audio('musica_fase2', ['assets/audio/fase2.mp3', 'assets/audio/fase2.mp3']);

    this.load.audio('som_chave', 'assets/audio/key.ogg');
    this.load.audio('som_porta', 'assets/audio/door.ogg');
    this.load.audio('som_gaveta', 'assets/audio/drawer.mp3');
    this.load.audio('psst', 'assets/audio/psst.mp3');
    this.load.audio('screech_jumpscare', 'assets/audio/screech jumpscare.mp3');
  }
}
// =============================================
//  CENA: BOOT (TELA DE TÍTULO) - CORRIGIDA
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
      g.strokeRect(i, i, GAME_W - i * 2, GAME_H - i * 2);
    }

    // Título - guardando referência para animação
    const title = this.add.text(GAME_W / 2, GAME_H / 2 - 60, 'DOORS', {
      fontSize: '72px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 20,
    }).setOrigin(0.5);

    const subtitle = this.add.text(GAME_W / 2, GAME_H / 2 + 10, '-- EDIÇÃO DE ANIVERSÁRIO --', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#6655aa',
      letterSpacing: 6,
    }).setOrigin(0.5);

    const hint = this.add.text(GAME_W / 2, GAME_H / 2 + 80, 'PRESSIONE QUALQUER TECLA', {
      fontSize: '14px',
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

    // Animação do título - AGORA title ESTÁ DEFINIDO
    this.tweens.add({
      targets: title,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    // Porta decorativa
    this.drawDoor(g, GAME_W / 2 - 20, GAME_H / 2 - 120, 40, 70, 0.15);

    this.input.keyboard.once('keydown', () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(620, () => this.scene.start('Phase3Scene'));
    });
  }

  drawDoor(g, x, y, w, h, alpha) {
    g.fillStyle(COLORS.doorFrame, alpha);
    g.fillRect(x - w / 2 - 4, y - h - 4, w + 8, h + 4);
    g.fillStyle(COLORS.door, alpha * 1.5);
    g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle(COLORS.doorGlow, alpha * 2);
    g.fillCircle(x + w / 2 - 5, y - h / 2, 3);
  }
}

// =============================================
//  CENA: FASE 1 - CORREDOR (COM DECORAÇÕES)
// =============================================
class Phase1Scene extends BaseScene {
  constructor() {
    super('Phase1Scene');
    this.worldWidth = 2400;
  }

  create() {
    super.create();
    GameState.door = 1;
    this.keyFound = false;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_1);
    this.sound.stopAll();
    this.sound.play('musica_fase1', { loop: true, volume: 0.5 });

    this.platforms = this.physics.add.staticGroup();
    this.buildLevel();
    this.createDoor(2300, '001', 'Phase2Scene');
    this.createTorches();
    this.createDecorations();
    this.createHiddenKey(1100, 238);

    this.physics.add.collider(this.player, this.platforms); //player e plataformas colidem, são objetos sólidos
    this.physics.add.overlap(this.player, this.keyZone, this.collectKey, null, this); //detecta quando dois objetos se sobrepõem >> coleta a chave
  }

  buildLevel() {
    const g = this.add.graphics().setDepth(0); //chão e paredes
    const gPlat = this.add.graphics().setDepth(3); //plataformas (para aparecer na frente do chão)

    // Chão principal
    this.drawFloorSegment(g, 0, this.floorY, this.worldWidth, 60);

    // Teto
    g.fillStyle(COLORS.wall);
    g.fillRect(0, 0, this.worldWidth, 30);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth / 2, this.floorY + 30, this.worldWidth, 60)
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
      this.drawPlatform(gPlat, p.x, p.y, p.w);

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Divisórias verticais na parede
    for (let x = 0; x < this.worldWidth; x += 200) {
      g.fillStyle(COLORS.wallDetail, 0.5);
      g.fillRect(x, 30, 3, this.floorY - 30);
    }

    // Rodapé (wainscoting)
    g.fillStyle(COLORS.wallDetail, 0.7);
    g.fillRect(0, this.floorY - 85, this.worldWidth, 5);

    // Faixa de carpete
    g.fillStyle(0x4433aa, 0.3);
    g.fillRect(0, this.floorY + 8, this.worldWidth, 22);
    g.fillStyle(0x6655cc, 0.15);
    g.fillRect(0, this.floorY + 12, this.worldWidth, 8);
  }

  drawFloorSegment(g, x, y, w, h) {
    g.fillStyle(COLORS.floor);
    g.fillRect(x, y, w, h);
    g.fillStyle(COLORS.floorEdge);
    g.fillRect(x, y, w, 4);
  }

  drawPlatform(g, x, y, w) {
    g.fillStyle(COLORS.platform);
    g.fillRect(x, y, w, 16);
    g.fillStyle(COLORS.platformTop);
    g.fillRect(x, y, w, 3);

    // Velas decorativas nas plataformas
    g.fillStyle(COLORS.torch, 0.8);
    g.fillRect(x + 4, y - 8, 3, 8);
    g.fillCircle(x + 5, y - 10, 3);
  }

  createTorches() {
    const g = this.add.graphics();
    const positions = [80, 240, 480, 700, 950, 1150, 1400, 1650, 1900, 2150, 2350];

    positions.forEach(x => {
      // Suporte da tocha
      g.fillStyle(0x443333);
      g.fillRect(x - 2, this.floorY - 140, 4, 30);
      g.fillRect(x - 8, this.floorY - 145, 16, 4);

      // Chama
      g.fillStyle(COLORS.torchGlow, 0.9);
      g.fillCircle(x, this.floorY - 152, 7);
      g.fillStyle(COLORS.torch, 0.8);
      g.fillCircle(x, this.floorY - 155, 4);

      // Brilho animado
      const glow = this.add.rectangle(x, this.floorY - 152, 30, 30, COLORS.torchGlow, 0.08);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.03, to: 0.13 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: Phaser.Math.Between(400, 700),
        yoyo: true,
        repeat: -1
      });
    });
  }

  createDecorations() {
    const g = this.add.graphics().setDepth(2);;

    // Pinturas na parede
    const paintingPositions = [160, 450, 820, 1100, 1450, 1750, 2050, 2300];
    paintingPositions.forEach(x => {
      // Moldura
      g.lineStyle(3, COLORS.highlight, 0.5);
      g.strokeRect(x, this.floorY - 200, 60, 80);
      g.fillStyle(0x0d0d18, 0.8);
      g.fillRect(x + 3, this.floorY - 197, 54, 74);

      // Arte abstrata aleatória
      const r = Phaser.Math.Between(0, 3);
      if (r === 0) {
        g.fillStyle(COLORS.door, 0.6);
        g.fillRect(x + 15, this.floorY - 180, 30, 50);
      } else if (r === 1) {
        g.fillStyle(COLORS.danger, 0.4);
        g.fillCircle(x + 30, this.floorY - 155, 20);
      } else if (r === 2) {
        g.fillStyle(COLORS.highlight, 0.4);
        g.fillTriangle(x + 30, this.floorY - 185, x + 5, this.floorY - 125, x + 55, this.floorY - 125);
      } else {
        g.fillStyle(COLORS.torch, 0.3);
        g.fillRect(x + 10, this.floorY - 175, 40, 8);
        g.fillRect(x + 10, this.floorY - 160, 40, 8);
        g.fillRect(x + 10, this.floorY - 145, 40, 8);
      }
    });

    // Sombras no chão
    for (let x = 100; x < this.worldWidth; x += 200) {
      g.fillStyle(0x000000, 0.15);
      g.fillEllipse(x, this.floorY + 5, 80, 10);
    }
  }

  handleInteract() {
    // Se já está em transição, ignora qualquer interação
    if (this.transitioning) return;

    // Verifica se o player está perto da porta
    if (this.isNear(this.doorZone)) {

      // Se a chave NÃO foi coletada, mostra o aviso e bloqueia a entrada
      if (!this.keyFound) {
        this.showLockedMessage(); // método herdado da BaseScene
        return;                   // interrompe aqui — não deixa entrar
      }

      this.sound.play('som_porta', { volume: 1.2, seek: 0.5 }); //toca o som da porta, começando a 0.5s
      // Só chega aqui se keyFound = true
      this.transitionTo(this.doorDestination);
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
//  CENA: FASE 2 - JEREMIAH (COM DECORAÇÕES)
// =============================================
class Phase2Scene extends BaseScene {
  constructor() {
    super('Phase2Scene');
    this.worldWidth = 5100; // 3400 * 1.5
    this.s = 1.5; // fator de escala global
  }

  init() {
    super.init();
    this.worldWidth = 5100;
    this.floorY = GAME_H - 30; // ajustado para escala 1.5
    this.passingThrough = false;
  }

  create() {
    super.create();
    // Aumenta o player só nessa fase (escala 1.5)
    this.player.body.setSize(36, 60); // 24*1.5 = 36, 40*1.5 = 60
    this.player.setPosition(80 * this.s, this.floorY - 50 * this.s);
    GameState.door = 2;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_2);
    this.sound.stopAll();
    this.sound.play('musica_fase2', { loop: true, volume: 0.3, seek: 5 });

    this.platforms = this.physics.add.staticGroup();
    this.wardrobes = [];
    this.drawers = [];
    this.jeremiah = null;
    this.jeremiahGfx = null;
    this.jeremiahDir = 1;
    this.jeremiahSpeed = 90 * this.s;
    this.jeremiahLooking = false;
    this.hitCooldown = false;
    this.inWardrobe = false;
    this.inPool = false;
    this.inBush = false;
    this.keyFound = false;

    this.buildKitchen();
    this.buildGardenPool();
    this.buildPier();
    this.createJeremiah();
    this.createDoor(3330 * this.s, '002', 'Phase3Scene');

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.jeremiah, this.platforms);
  }

  drawPlayer() {
    const x = this.player.x;
    const y = this.player.y;
    const g = this.playerGfx;
    g.clear();

    // Escala 1.5 (igual ao corpo da física)
    const s = 1.5;

    this.playerShadow.clear();
    this.playerShadow.fillStyle(0x000000, 0.25);
    this.playerShadow.fillEllipse(x, this.floorY - 2, 50 * s, 14 * s);

    g.fillStyle(COLORS.player);
    g.fillRect(x - 15 * s, y - 55 * s, 30 * s, 40 * s);  // corpo
    g.fillRect(x - 13 * s, y - 82 * s, 26 * s, 26 * s);  // cabeça

    g.fillStyle(COLORS.playerEye);
    const eyeX = this.facingLeft ? x - 7 * s : x + 3 * s;
    g.fillRect(eyeX, y - 75 * s, 6 * s, 6 * s);  // olhos

    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 12 * s, y - 14 * s, 10 * s, 16 * s);  // perna esq
    g.fillRect(x + 2 * s, y - 14 * s, 10 * s, 16 * s);   // perna dir
    g.fillRect(x - 20 * s, y - 52 * s, 7 * s, 28 * s);   // braço esq
    g.fillRect(x + 13 * s, y - 52 * s, 7 * s, 28 * s);   // braço dir
  }

  // ─── COZINHA ──────────────────────────────────────
  buildKitchen() {
    const g = this.add.graphics().setDepth(1);
    const s = this.s;
    const ch = 75;
    const topMargin = 55;

    // ── PAREDE ───────────────────────────────────────
    g.fillStyle(0xadebb3);
    g.fillRect(0, 0, 1400, GAME_H);
    g.fillStyle(0x081828, 0.55);
    g.fillRect(0, 0, 1400, GAME_H);

    // ── TETO ─────────────────────────────────────────
    g.fillStyle(0xc8d4dc);
    g.fillRect(0, 0, 1400, 22);
    [120, 340, 560, 780, 1000, 1220].forEach(x => {
      g.fillStyle(0xb8c4cc);
      g.fillRect(x, 0, 20, 22);
    });

    // ── CHÃO ─────────────────────────────────────────
    g.fillStyle(0x0a0806);
    g.fillRect(0, this.floorY, 1400, 8);
    g.fillStyle(0x060504, 0.9);
    g.fillRect(0, this.floorY + 8, 1400, 72);

    const floor = this.add.rectangle(700, this.floorY + 30, 1400, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // ── ARMÁRIO ALTO ESQUERDO ────────────────────────
    g.fillStyle(0xd8e0e8);
    g.fillRect(0, 22, 140, this.floorY - 22);
    g.lineStyle(1, 0xc0ccd4);
    g.strokeRect(5, 28, 130, (this.floorY - 30) / 2);
    g.strokeRect(5, 32 + (this.floorY - 30) / 2, 130, (this.floorY - 40) / 2);
    g.fillStyle(0x8898a8);
    g.fillRect(58, this.floorY / 2 - 4, 24, 5);
    g.fillRect(58, this.floorY * 0.75 - 4, 24, 5);
    g.fillStyle(0x8a5a3a, 0.9);
    g.fillCircle(30, 18, 14);
    g.fillCircle(70, 15, 12);
    g.fillStyle(0x3a6a8a, 0.8);
    g.fillCircle(110, 17, 10);
    g.fillStyle(0x081828, 0.2);
    g.fillRect(135, 22, 8, this.floorY - 22);

    // ── ARMÁRIO AÉREO ESQUERDO ───────────────────────
    const aereoY = topMargin + 35;
    const aereoH = 210;
    g.fillStyle(0xd8e0e8);
    g.fillRect(142, aereoY, 380, aereoH); // corpo do armário

    // trapézio fino em cima do armário esquerdo
    const trapHEsq = 20;
    g.fillStyle(0xd8e0e8);
    g.fillPoints([
      { x: 142, y: aereoY - trapHEsq },
      { x: 142 + 380 + 14, y: aereoY - trapHEsq },
      { x: 142 + 380, y: aereoY },
      { x: 142, y: aereoY }
    ], true);

    // vidros (4 colunas x 3 linhas)
    const totalCols = 4;
    const totalRows = 3;
    const padX = 10;
    const padYTop = 26;
    const padYBot = 16;
    const gapX = 8;
    const gapY = 3;
    const vw = (380 - padX * 2 - gapX * (totalCols - 1)) / totalCols;
    const vh = (aereoH - padYTop - padYBot - gapY * (totalRows - 1)) / totalRows;

    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < totalRows; row++) {
        const vx = 142 + padX + col * (vw + gapX);
        const vy = aereoY + padYTop + row * (vh + gapY);

        g.fillStyle(0x050e1c, 0.35);
        if (row === 0 && col === 0) {
          // vidro superior esquerdo — arredonda só o canto esquerdo
          g.fillRoundedRect(vx, vy, vw, vh, { tl: 26, tr: 0, bl: 0, br: 0 });
          g.strokeRoundedRect(vx, vy, vw, vh, { tl: 26, tr: 0, bl: 0, br: 0 });
        } else if (row === 0 && col === totalCols - 1) {
          // vidro superior direito — arredonda só o canto direito
          g.fillRoundedRect(vx, vy, vw, vh, { tl: 0, tr: 26, bl: 0, br: 0 });
          g.strokeRoundedRect(vx, vy, vw, vh, { tl: 0, tr: 26, bl: 0, br: 0 });
        } else {
          g.fillRect(vx, vy, vw, vh);
          g.lineStyle(1, 0xc8d4dc);
          g.strokeRect(vx, vy, vw, vh);
        }

        // borda do vidro
        g.lineStyle(1, 0xc8d4dc);
        if (row === 0) {
          g.strokeRoundedRect(vx, vy, vw, vh, { tl: 5, tr: 5, bl: 0, br: 0 });
        } else {
          g.strokeRect(vx, vy, vw, vh);
        }
      }
    }

    // moldura externa da porta
    g.lineStyle(2, 0xb8c4cc);
    g.strokeRect(142 + 4, aereoY + 4, 380 - 8, aereoH - 8);

    // pés do armário
    g.fillStyle(0x8898a8);
    g.fillRect(142, aereoY + aereoH, 5, 26);   // pé esquerdo
    g.fillRect(517, aereoY + aereoH, 5, 26);   // pé direito

    // ── JANELA CENTRAL ───────────────────────────────
    const winX = 560, winY = topMargin + 5, winW = 240, winH = 275;

    // fundo da janela
    g.fillStyle(0x040b18);
    g.fillRect(winX, winY, winW, winH);

    // estrelas
    [[570, winY + 12], [590, winY + 22], [614, winY + 8], [640, winY + 26],
    [666, winY + 14], [692, winY + 32], [718, winY + 10], [742, winY + 24],
    [570, winY + 75], [597, winY + 90], [630, winY + 65], [660, winY + 82],
    [687, winY + 72], [717, winY + 88], [744, winY + 60], [770, winY + 78]].forEach(([sx, sy]) => {
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(sx, sy, 1.5);
    });

    // lua
    g.fillCircle(740, winY + 25, 18);

    // árvores
    g.fillStyle(0x060e08);
    g.fillTriangle(562, winY + winH, 617, winY + winH, 589, winY + winH - 70);
    g.fillTriangle(600, winY + winH, 658, winY + winH, 629, winY + winH - 85);
    g.fillTriangle(677, winY + winH, 734, winY + winH, 705, winY + winH - 72);
    g.fillTriangle(717, winY + winH, 778, winY + winH, 747, winY + winH - 88);

    // troncos
    g.fillRect(585, winY + winH - 82, 7, 82);
    g.fillRect(625, winY + winH - 98, 7, 98);
    g.fillRect(701, winY + winH - 84, 7, 84);

    // moldura da janela
    g.fillStyle(0xd8e4ec);
    g.fillRect(winX - 10, winY - 8, winW + 20, 10);
    g.fillRect(winX - 10, winY + winH, winW + 20, 10);
    g.fillRect(winX - 10, winY - 8, 10, winH + 18);
    g.fillRect(winX + winW, winY - 8, 10, winH + 18);

    // grades da janela
    g.fillRect(winX + winW / 2 - 4, winY, 8, winH);
    g.fillRect(winX + winW / 4 - 4, winY, 8, winH / 2 - 3);
    g.fillRect(winX + winW / 4 * 3 - 4, winY, 8, winH / 2 - 3);
    g.fillRect(winX, winY + winH / 2 - 3, winW, 6);
    g.fillStyle(0xc8d4dc);

    // sombras no chão embaixo da janela
    g.fillRect(winX - 14, winY + winH + 10, winW + 28, 10);
    g.fillStyle(0x1a3820);
    g.fillCircle(winX + 22, winY + winH + 8, 11);
    g.fillCircle(winX + 42, winY + winH + 5, 7);
    g.fillStyle(0x223828);
    g.fillRect(winX + 20, winY + winH + 8, 3, 10);
    g.fillRect(winX + 40, winY + winH + 5, 3, 13);
    g.fillStyle(0x1a3820);
    g.fillCircle(winX + winW - 22, winY + winH + 8, 9);
    g.fillStyle(0x8ab0d0, 0.03);
    g.fillTriangle(winX + 40, winY + winH + 20, winX + winW - 40, winY + winH + 20, winX + winW / 2, this.floorY);

    // ── ARMÁRIO AÉREO DIREITO ─────────────────────────
    const shelf1X = 834;
    const aereoHDir = 210;
    const aereoYDir = aereoY;
    const shelf1W = 160;
    const trapH = 20;
    const bodyY = aereoYDir + trapH; // armário desce para dar espaço ao trapézio

    // trapézio fino em cima do armário
    g.fillStyle(0xd8e0e8);
    g.fillPoints([
      { x: shelf1X - 14, y: aereoYDir },
      { x: shelf1X + shelf1W + 14, y: aereoYDir },
      { x: shelf1X + shelf1W, y: bodyY },
      { x: shelf1X, y: bodyY }
    ], true);

    // corpo do armário
    g.fillRect(shelf1X, bodyY, shelf1W, aereoHDir);

    // moldura sólida
    const frameT = 12;
    g.fillStyle(0xd8e0e8);
    g.fillRect(shelf1X, bodyY, shelf1W, frameT);                       // topo
    g.fillRect(shelf1X, bodyY + aereoHDir - frameT, shelf1W, frameT); // baixo
    g.fillRect(shelf1X, bodyY, frameT, aereoHDir);                     // esquerda
    g.fillRect(shelf1X + shelf1W - frameT, bodyY, frameT, aereoHDir); // direita

    // divisória vertical central grossa
    const divT = 20;
    g.fillStyle(0xd8e0e8);
    g.fillRect(shelf1X + shelf1W / 2 - divT / 2, bodyY + frameT, divT, aereoHDir - frameT * 2);

    // configuração dos vidros
    const s1Cols = 2;
    const s1Rows = 2;
    const divTH = 2;
    const s1GapX = 4;
    const s1GapY = 4;

    const groupW = (shelf1W - frameT * 2 - divT) / 2;
    const groupH = (aereoHDir - frameT * 2) / 2 - divTH / 2;
    const s1vw = (groupW - s1GapX * (s1Cols - 1)) / s1Cols;
    const s1vh = (groupH - s1GapY * (s1Rows - 1)) / s1Rows;

    // divisória horizontal fina
    g.lineStyle(1, 0xc8d4dc);
    g.strokeRect(shelf1X + frameT, bodyY + aereoHDir / 2 - 1, shelf1W - frameT * 2, 1);

    [shelf1X + frameT, shelf1X + frameT + groupW + divT].forEach(groupX => {
      // grupo de cima
      for (let col = 0; col < s1Cols; col++) {
        for (let row = 0; row < s1Rows; row++) {
          const vx = groupX + col * (s1vw + s1GapX);
          const vy = bodyY + frameT + row * (s1vh + s1GapY);
          g.fillStyle(0x050e1c, 0.35);
          g.fillRect(vx, vy, s1vw, s1vh);
          g.lineStyle(1, 0xc8d4dc);
          g.strokeRect(vx, vy, s1vw, s1vh);
        }
      }

      // grupo de baixo
      for (let col = 0; col < s1Cols; col++) {
        for (let row = 0; row < s1Rows; row++) {
          const vx = groupX + col * (s1vw + s1GapX);
          const vy = bodyY + aereoHDir / 2 + divTH / 2 + row * (s1vh + s1GapY);
          g.fillStyle(0x050e1c, 0.35);
          g.fillRect(vx, vy, s1vw, s1vh);
          g.lineStyle(1, 0xc8d4dc);
          g.strokeRect(vx, vy, s1vw, s1vh);
        }
      }

      // linha exatamente no meio da segunda linha de baixo para cima
      const row2Y = bodyY + aereoHDir / 2 + divTH / 2;
      const midLineY = row2Y + s1vh / 2;
      g.lineStyle(1, 0xc8d4dc);
      g.strokeRect(groupX, midLineY, groupW, 1);
    });

    // pés do armário
    g.fillStyle(0x8898a8);
    g.fillRect(shelf1X, bodyY + aereoHDir, 5, 26);
    g.fillRect(shelf1X + shelf1W - 5, bodyY + aereoHDir, 5, 26);

    // bancada termina antes da moldura
    g.fillStyle(0xa8b4c0);
    g.fillRect(140, this.floorY - ch, 870, ch);
    g.fillStyle(0xbcc8d4);
    g.fillRect(140, this.floorY - ch - 6, 870, 8);
    g.fillStyle(0x060e18, 0.3);
    g.fillRect(140, this.floorY - ch + 3, 870, 5);

    // ── GAVETAS INTERATIVAS ───────────────────────────
    [155, 248, 342, 436].forEach((x, i) => {
      g.fillStyle(0xd8e0e8);
      g.fillRect(x, this.floorY - ch + 5, 85, ch - 8);
      g.fillStyle(0xb8c4cc);
      g.fillRect(x + 2, this.floorY - ch + 5, 81, (ch - 10) / 2);
      g.fillRect(x + 2, this.floorY - ch + 7 + (ch - 10) / 2, 81, (ch - 12) / 2);
      g.lineStyle(1, 0xa8b4c0);
      g.strokeRect(x + 2, this.floorY - ch + 5, 81, (ch - 10) / 2);
      g.strokeRect(x + 2, this.floorY - ch + 7 + (ch - 10) / 2, 81, (ch - 12) / 2);
      g.fillStyle(0x9898a8);
      g.fillRect(x + 26, this.floorY - ch + 18, 34, 4);
      g.fillRect(x + 26, this.floorY - ch + 38, 34, 4);
      const zone = this.add.zone(x + 42, this.floorY - ch / 2, 85, ch);
      this.physics.add.existing(zone, true);
      this.drawers.push({ zone, hasKey: i === 2, searched: false });
    });

    // ── ARMÁRIOS BAIXOS ───────────────────────────────
    [540, 640, 740, 840, 940].forEach(x => {
      g.fillStyle(0xd8e0e8);
      g.fillRect(x + 3, this.floorY - ch + 5, 88, ch - 8);
      g.lineStyle(1, 0xa8b4c0);
      g.strokeRect(x + 5, this.floorY - ch + 7, 84, ch - 12);
      g.fillStyle(0x9898a8);
      g.fillRect(x + 36, this.floorY - ch + 26, 22, 4);
    });

    // ── PIA ──────────────────────────────────────────
    // torneira centralizada abaixo da janela
    const tornX = winX + winW / 2;
    const tornY = this.floorY - ch - 2;

    // base da torneira
    g.fillStyle(0x9aaabb);
    g.fillRect(tornX - 14, tornY - 8, 28, 8);

    // cano vertical
    g.fillRect(tornX - 3, tornY - 30, 6, 24);

    // bico curvado (barra horizontal + ponta)
    g.fillRect(tornX - 3, tornY - 30, 22, 6);
    g.fillRect(tornX + 16, tornY - 30, 6, 14);

    // alavanca
    g.fillStyle(0x7a8a9a);
    g.fillRect(tornX - 18, tornY - 28, 14, 4);

    // ── MOLDURA DE PASSAGEM ───────────────────────────
    const passX = 1080;
    const passW = 250;
    const pillarW = 18;

    // pilares da moldura
    g.fillStyle(0xd8e0e8);
    g.fillRect(passX, topMargin, pillarW, this.floorY - topMargin);
    g.fillRect(passX + passW - pillarW, topMargin, pillarW, this.floorY - topMargin);

    // viga superior
    g.fillRect(passX, topMargin, passW, 20);

    // detalhe interno — sombra da passagem
    g.fillStyle(0x040c18, 0.4);
    g.fillRect(passX + pillarW, topMargin + 20, passW - pillarW * 2, this.floorY - topMargin - 20);

    // borda interna da moldura
    g.lineStyle(2, 0xb8c4cc);
    g.strokeRect(passX + 4, topMargin + 4, passW - 8, this.floorY - topMargin - 4);

    // zona de passagem cozinha → jardim
    this.passageZone = this.add.zone(passX + passW / 2, this.floorY - ch / 2, passW - pillarW * 2, this.floorY);
    this.physics.add.existing(this.passageZone, true);

    // ── LUMINÁRIAS ────────────────────────────────────
    [240, 480, 720].forEach(x => {
      g.fillStyle(0x788898);
      g.fillRect(x, 22, 3, topMargin - 22);
      g.fillStyle(0xc8d4dc);
      g.fillEllipse(x + 1, topMargin + 14, 30, 24);
      g.fillStyle(0xeef8ff, 0.25);
      g.fillEllipse(x + 1, topMargin + 18, 20, 14);
      g.fillStyle(0x8ab0cc, 0.05);
      g.fillTriangle(x - 60, topMargin + 26, x + 62, topMargin + 26, x + 1, this.floorY);
    });
  }

  // ─── JARDIM + PISCINA ─────────────────────────────
  // ─── JARDIM + PISCINA ─────────────────────────────
  buildGardenPool() {
    const g = this.add.graphics().setDepth(1);
    const s = this.s;
    const startX = 1400;

    // Céu noturno
    g.fillStyle(0x0a0f1a);
    g.fillRect(startX, 0, 1400, GAME_H);

    // Grama
    g.fillStyle(0x1a3a1a);
    g.fillRect(startX, this.floorY, 1400, 80 * s);
    g.fillStyle(0x224422);
    g.fillRect(startX, this.floorY, 1400, 4 * s);

    // Física do chão jardim — cobre desde o início do jardim
    const floor = this.add.rectangle(startX + 700, this.floorY + 30, 1400 * 2, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Lua
    g.fillStyle(0xfffde0, 0.9);
    g.fillCircle(startX + 200, 60, 35);
    g.fillStyle(0xf5f0cc, 0.15);
    g.fillCircle(startX + 200, 60, 55);

    // Estrelas
    for (let i = 0; i < 40; i++) {
      const sx = startX + Phaser.Math.Between(0, 1400);
      const sy = Phaser.Math.Between(0, 200);
      g.fillStyle(0xffffff, Math.random() * 0.8 + 0.2);
      g.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
    }

    // Árvores e arbustos — Jeremiah pode sair de trás
    const trees = [
      { x: 100, h: 180, w: 60 },
      { x: 400, h: 150, w: 50 },
      { x: 700, h: 200, w: 70 },
      { x: 1000, h: 160, w: 55 },
    ];

    trees.forEach(t => {
      // Tronco
      g.fillStyle(0x3a2a1a);
      g.fillRect(startX + t.x + (t.w / 2) - 8, this.floorY - t.h, 16, t.h);
      // Copa em camadas
      g.fillStyle(0x0d2a0d);
      g.fillTriangle(
        startX + t.x, this.floorY - t.h * 0.5,
        startX + t.x + t.w, this.floorY - t.h * 0.5,
        startX + t.x + (t.w / 2), this.floorY - t.h
      );
      g.fillStyle(0x102e10);
      g.fillTriangle(
        startX + t.x + 5, this.floorY - t.h * 0.3,
        startX + t.x + t.w - 5, this.floorY - t.h * 0.3,
        startX + t.x + (t.w / 2), this.floorY - t.h * 0.8
      );
      g.fillStyle(0x143414);
      g.fillTriangle(
        startX + t.x + 10, this.floorY - t.h * 0.1,
        startX + t.x + t.w - 10, this.floorY - t.h * 0.1,
        startX + t.x + (t.w / 2), this.floorY - t.h * 0.6
      );
    });

    // Arbustos interativos — esconderijo do player
    const bushes = [
      { x: 250, w: 80 },
      { x: 600, w: 70 },
      { x: 950, w: 90 },
    ];

    bushes.forEach(b => {
      g.fillStyle(0x0d2a0d);
      g.fillEllipse(startX + b.x + (b.w / 2), this.floorY - 25, b.w, 50);
      g.fillStyle(0x102e10);
      g.fillEllipse(startX + b.x + (b.w / 2) - 15, this.floorY - 30, b.w * 0.6, 40);
      g.fillStyle(0x143414);
      g.fillEllipse(startX + b.x + (b.w / 2) + 10, this.floorY - 28, b.w * 0.5, 35);

      const zone = this.add.zone(startX + b.x + (b.w / 2), this.floorY - 25, b.w, 50);
      this.physics.add.existing(zone, true);
      this.wardrobes.push(zone);
    });

    // Muro com plataforma para escapar
    g.fillStyle(0xd4c8b0);
    g.fillRect(startX + 500, this.floorY - 120, 200, 20);
    g.fillRect(startX + 500, this.floorY - 120, 200, 4);
    const muro = this.add.rectangle(startX + 600, this.floorY - 110, 200, 20).setVisible(false);
    this.physics.add.existing(muro, true);
    this.platforms.add(muro);

    g.fillStyle(0xd4c8b0);
    g.fillRect(startX + 900, this.floorY - 150, 180, 20);
    const muro2 = this.add.rectangle(startX + 990, this.floorY - 140, 180, 20).setVisible(false);
    this.physics.add.existing(muro2, true);
    this.platforms.add(muro2);

    // Piscina
    const poolX = startX + 800;
    const poolW = 500;
    const poolY = this.floorY - 60;
    const poolH = 60;

    g.fillStyle(0x1a5f8a);
    g.fillRect(poolX, poolY, poolW, poolH);
    // Brilho da piscina
    g.fillStyle(0x2288cc, 0.3);
    g.fillRect(poolX, poolY, poolW, 8);
    g.fillStyle(0x44aaff, 0.15);
    g.fillRect(poolX + 20, poolY + 15, poolW - 40, 4);
    g.fillRect(poolX + 40, poolY + 30, poolW - 80, 3);
    // Borda da piscina
    g.fillStyle(0xe8e0d0);
    g.fillRect(poolX - 10, poolY - 8, poolW + 20, 10);
    g.fillRect(poolX - 10, poolY + poolH, poolW + 20, 10);

    // Luz azul animada da piscina
    const poolGlow = this.add.rectangle(poolX + poolW / 2, poolY + poolH / 2, poolW, poolH, 0x1188ee, 0.12).setDepth(2);
    this.tweens.add({
      targets: poolGlow,
      alpha: { from: 0.08, to: 0.18 },
      duration: 1800,
      yoyo: true,
      repeat: -1
    });

    // Zona da piscina — mergulhar para se esconder
    this.poolZone = this.add.zone(poolX + poolW / 2, poolY + poolH / 2, poolW, poolH);
    this.physics.add.existing(this.poolZone, true);

    // Física da borda da piscina (player anda em cima)
    const poolEdge = this.add.rectangle(poolX + poolW / 2, poolY - 4, poolW, 8).setVisible(false);
    this.physics.add.existing(poolEdge, true);
    this.platforms.add(poolEdge);

    // zona de retorno jardim → cozinha
    this.returnZone = this.add.zone(1420, this.floorY - 50, 40, 200);
    this.physics.add.existing(this.returnZone, true);
  }

  // ─── JEREMIAH ─────────────────────────────────────
  createJeremiah() {
    // spawn no jardim sem escala
    this.jeremiah = this.physics.add.sprite(1800, this.floorY - 60)
      .setVisible(false)
      .setCollideWorldBounds(true);

    this.jeremiah.body.setSize(30 * this.s, 60 * this.s);
    this.jeremiah.body.setGravityY(400);
    this.jeremiahGfx = this.add.graphics().setDepth(6);

    this.hibells = this.add.text(0, 0, '"Oi, Bells..."', {
      fontSize: `${13 * this.s}px`,
      fontFamily: 'Courier New',
      color: '#aaffaa',
      letterSpacing: 1 * this.s,
      backgroundColor: '#0a1a0a',
      padding: { x: 6 * this.s, y: 4 * this.s }
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
  }

  // ─── PIER ─────────────────────────────────────────
  buildPier() {
    const g = this.add.graphics().setDepth(1);
    const s = this.s;
    const startX = 2800 * s;

    // Céu noturno continuando
    g.fillStyle(0x080d18);
    g.fillRect(startX, 0, 600 * s, GAME_H);

    // Água
    g.fillStyle(0x0a2a3a);
    g.fillRect(startX, this.floorY - 20 * s, 600 * s, 100 * s);
    g.fillStyle(0x0d3a4a, 0.5);
    g.fillRect(startX, this.floorY - 20 * s, 600 * s, 6 * s);

    // Reflexo da lua na água
    g.fillStyle(0xfffde0, 0.06);
    g.fillRect(startX + 200 * s, this.floorY - 15 * s, 80 * s, 80 * s);

    // Estrutura do pier
    g.fillStyle(0x5a3a1a);
    g.fillRect(startX, this.floorY - 30 * s, 600 * s, 12 * s); // chão do pier
    // Vigas do pier
    [50, 150, 250, 350, 450, 550].forEach(x => {
      g.fillStyle(0x4a2a10);
      g.fillRect(startX + x * s, this.floorY - 20 * s, 10 * s, 80 * s);
    });

    // Cobertura do gazebo no final
    g.fillStyle(0x4a3010);
    g.fillTriangle(
      startX + 350 * s, this.floorY - 180 * s,
      startX + 600 * s, this.floorY - 180 * s,
      startX + 480 * s, this.floorY - 280 * s
    );
    g.fillRect(startX + 350 * s, this.floorY - 180 * s, 250 * s, 15 * s);
    // Colunas do gazebo
    g.fillStyle(0x5a3a1a);
    g.fillRect(startX + 360 * s, this.floorY - 165 * s, 12 * s, 135 * s);
    g.fillRect(startX + 578 * s, this.floorY - 165 * s, 12 * s, 135 * s);

    // Física do pier
    const pierFloor = this.add.rectangle(startX + 300 * s, this.floorY - 24 * s, 600 * s, 12 * s).setVisible(false);
    this.physics.add.existing(pierFloor, true);
    this.platforms.add(pierFloor);

    // Luzes de fada — string lights
    const pierGfx = this.add.graphics().setDepth(3);
    const lightPositions = [];
    for (let i = 0; i <= 12; i++) {
      lightPositions.push({
        x: startX + i * 48 * s,
        y: this.floorY - 120 * s + Math.sin(i * 0.5) * 15 * s
      });
    }
    // Fio
    pierGfx.lineStyle(1 * s, 0x5a4a2a, 0.6);
    pierGfx.beginPath();
    lightPositions.forEach((p, i) => {
      if (i === 0) pierGfx.moveTo(p.x, p.y);
      else pierGfx.lineTo(p.x, p.y);
    });
    pierGfx.strokePath();
    // Bolinhas de luz
    lightPositions.forEach(p => {
      pierGfx.fillStyle(0xffee88, 0.9);
      pierGfx.fillCircle(p.x, p.y, 3 * s);
      pierGfx.fillStyle(0xffee88, 0.15);
      pierGfx.fillCircle(p.x, p.y, 8 * s);
    });

    // Brilho animado das luzes de fada
    const fairyGlow = this.add.rectangle(startX + 300 * s, this.floorY - 120 * s, 600 * s, 60 * s, 0xffee44, 0.04).setDepth(2);
    this.tweens.add({
      targets: fairyGlow,
      alpha: { from: 0.02, to: 0.07 },
      duration: 2000,
      yoyo: true,
      repeat: -1
    });
  }

  setupWorld() {
    this.physics.world.setBounds(0, 0, this.worldWidth, GAME_H);
    // câmera começa restrita à cozinha — impede de ver o jardim antes da transição
    this.cameras.main.setBounds(0, 0, 1400, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  // ─── JEREMIAH ─────────────────────────────────────
  createJeremiah() {
    this.jeremiah = this.physics.add.sprite(1600 * this.s, this.floorY - 60 * this.s)
      .setVisible(false)
      .setCollideWorldBounds(true);

    this.jeremiah.body.setSize(30 * this.s, 60 * this.s);
    this.jeremiah.body.setGravityY(400 * this.s);
    this.jeremiahGfx = this.add.graphics().setDepth(6);

    this.hibells = this.add.text(0, 0, '"Oi, Bells..."', {
      fontSize: `${13 * this.s}px`,
      fontFamily: 'Courier New',
      color: '#aaffaa',
      letterSpacing: 1 * this.s,
      backgroundColor: '#0a1a0a',
      padding: { x: 6 * this.s, y: 4 * this.s }
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
  }

  drawJeremiah() {
    const x = this.jeremiah.x;
    const y = this.jeremiah.y;
    const g = this.jeremiahGfx;
    const s = this.s;
    g.clear();

    const color = this.jeremiahLooking ? 0x88ff88 : 0x447744;

    g.fillStyle(color, this.jeremiahLooking ? 0.9 : 0.7);
    g.fillRect(x - 12 * s, y - 58 * s, 24 * s, 35 * s);
    g.fillStyle(color, this.jeremiahLooking ? 1 : 0.8);
    g.fillRect(x - 10 * s, y - 82 * s, 20 * s, 22 * s);
    g.fillStyle(0xeeffee);
    g.fillCircle(x - 4 * s, y - 72 * s, (this.jeremiahLooking ? 5 : 3) * s);
    g.fillCircle(x + 4 * s, y - 72 * s, (this.jeremiahLooking ? 5 : 3) * s);
    g.fillStyle(0x00aa00);
    g.fillCircle(x - 4 * s, y - 72 * s, (this.jeremiahLooking ? 2 : 1) * s);
    g.fillCircle(x + 4 * s, y - 72 * s, (this.jeremiahLooking ? 2 : 1) * s);
    g.fillStyle(color, 0.7);
    g.fillRect(x - 10 * s, y - 22 * s, 9 * s, 22 * s);
    g.fillRect(x + 1 * s, y - 22 * s, 9 * s, 22 * s);
    g.fillRect(x - 18 * s, y - 56 * s, 6 * s, 28 * s);
    g.fillRect(x + 12 * s, y - 56 * s, 6 * s, 28 * s);

    if (this.jeremiahLooking) {
      g.fillStyle(0x00ff00, 0.08);
      g.fillCircle(x, y - 50 * s, 50 * s);
    }
  }

  checkJeremiah() {
    // Escondido em qualquer lugar — Jeremiah não vê
    if (this.inWardrobe || this.inBush || this.inPool) {
      this.jeremiahLooking = false;
      return;
    }

    const dx = Math.abs(this.player.x - this.jeremiah.x);
    const dy = Math.abs(this.player.y - this.jeremiah.y);
    const facingRight = this.jeremiahDir > 0;
    const playerInFront = facingRight ?
      (this.player.x > this.jeremiah.x) :
      (this.player.x < this.jeremiah.x);

    if (dx < 220 * this.s && dy < 90 * this.s && playerInFront && !this.hitCooldown) {
      this.jeremiahLooking = true;
      this.hitCooldown = true;

      this.hibells.setPosition(this.jeremiah.x, this.jeremiah.y - 110 * this.s).setAlpha(1);
      this.tweens.killTweensOf(this.hibells);
      this.tweens.add({ targets: this.hibells, alpha: 0, duration: 1000, delay: 1000 });

      if (GameState.damage(2)) {
        this.transitionTo('GameOverScene');
        return;
      }

      const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x00ff00, 0.25)
        .setScrollFactor(0).setDepth(25);
      this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      this.time.delayedCall(4000, () => { this.hitCooldown = false; });
    } else if (dx >= 220 * this.s || !playerInFront) {
      this.jeremiahLooking = false;
    }
  }

  checkDrawers() {
    for (let d of this.drawers) {
      if (d.searched) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.zone.x, d.zone.y);
      if (dist < 70 * this.s) {
        d.searched = true;

        this.sound.play('som_gaveta', { volume: 1.2 });
        const x = d.zone.x - 42; // x base da gaveta
        const ch = 75;

        // redesenha a gaveta aberta — empurra o painel para baixo
        const dg = this.add.graphics().setDepth(3);

        // fundo da gaveta aberta (interior escuro)
        dg.fillStyle(0x888898);
        dg.fillRect(x + 2, this.floorY - ch + 5, 81, (ch - 10) / 2);

        // painel superior puxado para baixo (sobrepõe o interior)
        dg.fillStyle(0xd8e0e8);
        dg.fillRect(x + 2, this.floorY - ch + 22, 81, (ch - 10) / 2);

        // painel inferior igual — não mexe
        dg.fillStyle(0xb8c4cc);
        dg.fillRect(x + 2, this.floorY - ch + 7 + (ch - 10) / 2, 81, (ch - 12) / 2);

        // bordas
        dg.lineStyle(1, 0xa8b4c0);
        dg.strokeRect(x + 2, this.floorY - ch + 22, 81, (ch - 10) / 2);
        dg.strokeRect(x + 2, this.floorY - ch + 7 + (ch - 10) / 2, 81, (ch - 12) / 2);

        // puxador deslocado junto com o painel
        dg.fillStyle(0x9898a8);
        dg.fillRect(x + 26, this.floorY - ch + 35, 34, 4);
        dg.fillRect(x + 26, this.floorY - ch + 38, 34, 4);

        if (d.hasKey) {
          this.keyFound = false;

          // desenha a chave dentro da gaveta aberta
          const keyX = d.zone.x;
          const keyY = this.floorY - ch + 16; // dentro do interior visível

          const kg = this.add.graphics().setDepth(4);

          // cabeça da chave
          kg.fillStyle(0xffdd44, 0.9);
          kg.fillCircle(keyX, keyY, 8);
          kg.fillStyle(0xffaa00);
          kg.fillCircle(keyX, keyY, 5);

          // cabo e dentes
          kg.fillRect(keyX + 2, keyY, 18, 4);
          kg.fillRect(keyX + 14, keyY + 4, 4, 4);
          kg.fillRect(keyX + 18, keyY + 4, 4, 4);

          // brilho pulsante
          const glow = this.add.rectangle(keyX, keyY, 24, 24, 0xffdd44, 0.06).setDepth(3);
          this.tweens.add({
            targets: glow,
            alpha: { from: 0.02, to: 0.1 },
            duration: 800,
            yoyo: true,
            repeat: -1
          });

          // zona de coleta
          this.keyZone = this.add.zone(keyX, keyY, 24, 24).setDepth(4);
          this.physics.add.existing(this.keyZone, true);
          this.keyZone.body.setSize(24, 24);

          // guarda referências para o collectKey() do BaseScene
          this.keyGfx = kg;
          this.keyGlow = glow;

          // coleta ao tocar
          this.physics.add.overlap(this.player, this.keyZone, () => this.collectKey());
        }

        return;
      }
    }
  }

  handleInteract() {
    if (this.transitioning) return;

    // Porta
    if (this.isNear(this.doorZone)) {
      if (!this.keyFound) {
        this.showLockedMessage();
        return;
      }
      this.sound.play('som_porta', { volume: 1.2, seek: 0.5 });
      this.transitionTo(this.doorDestination);
      return;
    }

    // Armários de cozinha e arbustos
    for (let w of this.wardrobes) {
      if (this.isNear(w)) {
        this.inWardrobe = !this.inWardrobe;
        this.inBush = false;
        this.player.body.setAllowGravity(!this.inWardrobe);
        if (this.inWardrobe) this.player.body.setVelocity(0, 0);
        return;
      }
    }

    // Piscina
    if (this.isNear(this.poolZone)) {
      this.inPool = !this.inPool;
      this.player.body.setAllowGravity(!this.inPool);
      if (this.inPool) this.player.body.setVelocity(0, 0);
      return;
    }

    // Gavetas
    this.checkDrawers();

  }

  update() {
    super.update();
    if (this.transitioning) return;

    // Jeremiah patrulha só no jardim/piscina
    if (!this.inWardrobe && !this.inBush && !this.inPool) {
      this.jeremiah.body.setVelocityX(this.jeremiahSpeed * this.jeremiahDir);
      if (this.jeremiah.x > 2700 * this.s || this.jeremiah.x < 1450 * this.s) {
        this.jeremiahDir *= -1;
        this.jeremiah.x = Phaser.Math.Clamp(this.jeremiah.x, 1451 * this.s, 2699 * this.s);
      }
    } else {
      this.jeremiah.body.setVelocityX(0);
    }

    this.drawJeremiah();
    this.checkJeremiah();

    // passagem cozinha → jardim
    if (!this.passingThrough && this.passageZone && this.isNear(this.passageZone)) {
      this.passingThrough = true;
      this.player.body.setVelocity(0, 0);
      this.player.body.setAllowGravity(false);
      this.cameras.main.stopFollow(); // para a câmera antes do fade — impede de ver o jardim
      this.cameras.main.fade(500, 0, 0, 0);

      this.time.delayedCall(1500, () => {
        this.player.setPosition(1400 + 200, this.floorY - 50 * this.s);
        this.player.body.setAllowGravity(true);
        // câmera agora cobre só o jardim e pier
        this.cameras.main.setBounds(1400, 0, this.worldWidth - 1400, GAME_H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(600, () => { this.passingThrough = false; });
      });
    }

    // retorno jardim → cozinha
    this.passageZone.active = false;
    if (!this.passingThrough && this.returnZone && this.isNear(this.returnZone)) {
      this.passingThrough = true;
      this.player.body.setVelocity(0, 0);
      this.player.body.setAllowGravity(false);
      this.cameras.main.stopFollow(); // para a câmera antes do fade — impede de ver a cozinha
      this.cameras.main.fade(500, 0, 0, 0);

      this.time.delayedCall(1500, () => {
        this.player.setPosition(800, this.floorY - 50 * this.s);
        this.player.body.setAllowGravity(true);
        // câmera volta para a cozinha
        this.cameras.main.setBounds(0, 0, 1400, GAME_H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(600, () => {
          this.passingThrough = false;
          this.passageZone.active = true; // reativa só depois
        });
        this.time.delayedCall(600, () => { this.passingThrough = false; });
      });
    }

    // Prompts
    let nearWardrobe = this.wardrobes.some(w => this.isNear(w));
    let nearPool = this.isNear(this.poolZone);
    let nearDrawer = this.drawers.some(d => !d.searched && this.isNear(d.zone));
    let nearDoor = this.isNear(this.doorZone);

    if (nearWardrobe && !this.activePrompt) {
      this.createPrompt(this.inWardrobe ? TEXTS.EXIT_HIDE : TEXTS.HIDE, -70 * this.s, '#44bbff');
    } else if (nearPool && !this.activePrompt) {
      this.createPrompt(this.inPool ? '[E] Sair da piscina' : '[E] Mergulhar', -70 * this.s, '#44aaff');
    } else if (nearDrawer && !this.activePrompt) {
      this.createPrompt('[E] Vasculhar', -70 * this.s, '#ffdd88');
    } else if (nearDoor && !this.activePrompt) {
      this.createPrompt(this.keyFound ? TEXTS.ENTER : '🔒 Trancada', -70 * this.s, this.keyFound ? '#ffdd44' : '#ff6666');
    } else if (!nearWardrobe && !nearPool && !nearDrawer && !nearDoor && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }
}


// =============================================
//  FASE 3 — "A SALA DO SALMÃO"
// =============================================
class Phase3Scene extends BaseScene {
  constructor() {
    super('Phase3Scene');
    this.worldWidth = 4000;
  }

  init() {
    super.init();
    this.worldWidth = 2000;
  }

  create() {
    super.create();
    GameState.door = 3;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_3);

    // ── Estado da fase ──────────────────────────────────────────────────
    this.timeLeft = 60;
    this.keyFound = false;
    this.gameActive = true;
    this.hitCooldown = false;
    this.underwaterTimer = null;
    this.stepXRef = 750;

    // ── Estado da água ──────────────────────────────────────────────────
    // Nível BASE (água sobe até aqui quando alavanca 1 está ativada)
    this.waterLevelBase = 260;          // nível alto (submerge alavanca 2)
    this.waterLevelLow = GAME_H + 100; // abaixo da tela (água baixa)
    this.waterLevel = GAME_H + 100; // começa fora
    this.waterTargetLevel = GAME_H + 100; // alvo atual
    this.waterRiseSpeed = 1.2;          // px por frame subindo (suave)
    this.waterFallSpeed = 2.0;          // px por frame descendo (mais rápido)
    this.waterRising = false;        // alavanca 1 ativa?

    // ── Estado dos puzzles ──────────────────────────────────────────────
    this.lever1Active = false;  // alavanca 1: sobe/para a água
    this.lever2Active = false;  // alavanca 2: baixa água + desliza bloco
    this.button1Revealed = false;  // botão 1 está visível (debaixo do bloco)
    this.button1Pressed = false;  // botão 1 foi pressionado?
    this.button2Revealed = false;  // botão 2 foi revelado?
    this.button2Pressed = false;  // botão 2 foi pressionado?
    this.doorBlockOpen = false;  // bloco esquerdo da porta está aberto?
    this.doorBlockTimer = null;   // timer para fechar o bloco da porta
    this.concreteSliding = false;  // bloco de concreto animando?
    this.doorBlockY = 0;      // posição Y atual do bloco da porta
    this.doorBlockTargetY = 0;      // posição Y alvo do bloco da porta

    // ── Grupos e objetos ────────────────────────────────────────────────
    this.platforms = this.physics.add.staticGroup();
    this.salmons = [];

    // ── Construção do cenário ───────────────────────────────────────────
    this.buildRoom();
    this.createWater();
    this.createSalmons();
    this.createCoral();
    this.createBubbles();
    this.createTimerUI();
    this.createPlayerBubbles();

    // ── Puzzles ─────────────────────────────────────────────────────────
    this.createLever1();
    this.createLever2();
    this.createButton1Setup();
    this.createDoorBlock();

    // ── Colisões ────────────────────────────────────────────────────────
    this.physics.add.collider(this.player, this.platforms);

    // ── Câmera ──────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.startTimer();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CENÁRIO
  // ════════════════════════════════════════════════════════════════════════
  buildRoom() {
    const gBg = this.add.graphics().setDepth(0);
    gBg.fillStyle(0x050d14);
    gBg.fillRect(0, 0, this.worldWidth, GAME_H + 200);

    const g = this.add.graphics().setDepth(1);

    const floorY1 = this.floorY;
    const floorY2 = this.floorY + 80;
    const stepX = this.stepXRef;
    this.floorY2 = floorY2;

    // ── Chão primeira metade ────────────────────────────────────────────
    g.fillStyle(0x0d1e2a);
    g.fillRect(0, floorY1, stepX, 80);
    g.fillStyle(0x1a3444);
    g.fillRect(0, floorY1, stepX, 3);

    // ── Degraus ─────────────────────────────────────────────────────────
    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX, floorY1 + 20, 80, 80);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 80);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 80);
    g.fillStyle(0x1a3444);
    g.fillRect(stepX, floorY1 + 20, 80, 3);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 3);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 3);

    // ── Chão segunda metade ─────────────────────────────────────────────
    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 100);
    g.fillStyle(0x1a3444);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 3);

    // ── Teto e paredes ──────────────────────────────────────────────────
    g.fillStyle(0x050d14);
    g.fillRect(0, 0, this.worldWidth, 30);
    g.fillStyle(0x080f18);
    g.fillRect(0, 0, 20, GAME_H + 150);
    g.fillRect(this.worldWidth - 20, 0, 20, GAME_H + 150);

    // ── Física: chão 1 ──────────────────────────────────────────────────
    const floor1 = this.add.rectangle(stepX / 2, floorY1 + 40, stepX, 80).setVisible(false);
    this.physics.add.existing(floor1, true);
    this.platforms.add(floor1);

    // ── Física: degraus ─────────────────────────────────────────────────
    [
      { x: stepX + 40, y: floorY1 + 60, w: 80 },
      { x: stepX + 120, y: floorY1 + 80, w: 80 },
      { x: stepX + 200, y: floorY1 + 100, w: 80 },
    ].forEach(s => {
      const r = this.add.rectangle(s.x, s.y, s.w, 80).setVisible(false);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    });

    // ── Física: chão 2 ──────────────────────────────────────────────────
    const floor2W = this.worldWidth - stepX - 240;
    const floor2 = this.add.rectangle(stepX + 240 + floor2W / 2, floorY2 + 50, floor2W, 100).setVisible(false);
    this.physics.add.existing(floor2, true);
    this.platforms.add(floor2);

    // ── Física: paredes ─────────────────────────────────────────────────
    const wallL = this.add.rectangle(10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    const wallR = this.add.rectangle(this.worldWidth - 10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    [wallL, wallR].forEach(w => {
      this.physics.add.existing(w, true);
      this.platforms.add(w);
    });

    // ── Plataformas primeira metade ─────────────────────────────────────
    const platforms1 = [
      { x: 100, y: 350, w: 150 },
      { x: 350, y: 270, w: 120 },
      { x: 600, y: 190, w: 130 },
      { x: 200, y: 140, w: 100 },
    ];

    // ── Plataformas segunda metade ──────────────────────────────────────
    const platforms2 = [
      { x: 1700, y: floorY2 - 230, w: 130 }, // ← alavanca 2 fica aqui (alta, precisa de água)
      { x: 2750, y: floorY2 - 170, w: 120 },
      { x: 3000, y: floorY2 - 250, w: 130 },
      { x: 3250, y: floorY2 - 180, w: 120 },
      { x: 3500, y: floorY2 - 130, w: 110 },
    ];

    [...platforms1, ...platforms2].forEach(p => {
      g.fillStyle(0x122230);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x1e3a50);
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle(0x0d4422, 0.7);
      g.fillRect(p.x + 10, p.y - 15, 4, 15);
      g.fillRect(p.x + 20, p.y - 22, 4, 22);

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // ── Plataforma alta da porta (canto superior direito) ───────────────
    // Posição: bem alta, próxima à parede direita
    const doorPlatY = 110; // bem alto
    const doorPlatX = this.worldWidth - 250;
    const doorPlatW = 220;

    g.fillStyle(0x1a2d40);
    g.fillRect(doorPlatX, doorPlatY, doorPlatW, 18);
    g.fillStyle(0x2a4a64);
    g.fillRect(doorPlatX, doorPlatY, doorPlatW, 3);

    const doorPlat = this.add.rectangle(doorPlatX + doorPlatW / 2, doorPlatY + 9, doorPlatW, 18).setVisible(false);
    this.physics.add.existing(doorPlat, true);
    this.platforms.add(doorPlat);

    // Salva referência para posicionar a porta e os blocos
    this.doorPlatX = doorPlatX;
    this.doorPlatY = doorPlatY;
    this.doorPlatW = doorPlatW;

    // ── Porta ───────────────────────────────────────────────────────────
    const dx = doorPlatX + doorPlatW / 2 - 27;
    const dy = doorPlatY - 95;
    const dw = 55, dh = 95;
    this.buildDoor(dx, dy, dw, dh);

    // ── Blocos de concreto ao redor da porta (visual) ───────────────────
    this.drawDoorConcreteBlocks(g, dx, dy, dw, dh);
  }

  buildDoor(dx, dy, dw, dh) {
    const gDoor = this.add.graphics().setDepth(8);
    gDoor.fillStyle(COLORS.doorFrame);
    gDoor.fillRect(dx - 4, dy - 6, dw + 8, dh + 8);
    gDoor.fillStyle(COLORS.door);
    gDoor.fillRect(dx, dy, dw, dh);
    gDoor.lineStyle(1, COLORS.highlight, 0.3);
    gDoor.strokeRect(dx + 5, dy + 5, dw - 10, (dh - 15) / 2);
    gDoor.strokeRect(dx + 5, dy + 10 + (dh - 15) / 2, dw - 10, (dh - 15) / 2 - 5);
    gDoor.fillStyle(COLORS.doorGlow);
    gDoor.fillCircle(dx + dw - 10, dy + dh / 2, 4);

    const glow = this.add.rectangle(dx + dw / 2, dy + dh / 2, dw + 20, dh + 20, COLORS.doorGlow, 0.06).setDepth(5);
    this.tweens.add({ targets: glow, alpha: { from: 0.03, to: 0.15 }, duration: 1200, yoyo: true, repeat: -1 });

    this.add.text(dx + dw / 2, dy - 18, '003', {
      fontSize: '14px', fontFamily: 'Courier New', color: '#bb99ff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(9);

    this.doorZone = this.add.zone(dx + dw / 2, dy + dh / 2, dw, dh);
    this.physics.add.existing(this.doorZone, true);
    this.doorDestination = 'Phase4Scene';

    // Salva posições para os blocos
    this.doorDx = dx; this.doorDy = dy; this.doorDw = dw; this.doorDh = dh;
  }

  drawDoorConcreteBlocks(g, dx, dy, dw, dh) {
    // Blocos de concreto finos ao redor da porta
    // Bloco superior
    g.fillStyle(0x2a3a4a);
    g.fillRect(dx - 8, dy - 14, dw + 16, 10);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(dx - 8, dy - 14, dw + 16, 2);

    // Bloco direito (fixo — parede direita está perto)
    g.fillStyle(0x2a3a4a);
    g.fillRect(dx + dw + 4, dy - 14, 10, dh + 22);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(dx + dw + 4, dy - 14, 2, dh + 22);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BLOCO ESQUERDO DA PORTA (o que o botão 2 abre)
  // ════════════════════════════════════════════════════════════════════════
  createDoorBlock() {
    const dx = this.doorDx, dy = this.doorDy, dh = this.doorDh;

    // Bloco fica à esquerda da porta
    const bx = dx - 8;
    const bw = 10;
    const bh = dh + 22;
    const by = dy - 14; // posição Y fechado (bloqueando)

    this.doorBlockClosedY = by;
    this.doorBlockOpenY = by - bh - 20; // sobe para fora do frame
    this.doorBlockY = by;
    this.doorBlockTargetY = by;

    // Gráfico do bloco (será redesenhado no update)
    this.doorBlockGfx = this.add.graphics().setDepth(9);
    this._redrawDoorBlock();

    // Física do bloco (colisão com o player para impedir entrada)
    this.doorBlockPhysRect = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh).setVisible(false);
    this.physics.add.existing(this.doorBlockPhysRect, true);
    this.platforms.add(this.doorBlockPhysRect);

    this._doorBlockBx = bx; this._doorBlockBw = bw; this._doorBlockBh = bh;
  }

  _redrawDoorBlock() {
    const g = this.doorBlockGfx;
    g.clear();
    if (this.doorBlockOpen && this.doorBlockY <= this.doorBlockOpenY + 5) return; // já aberto — invisível

    const bx = this._doorBlockBx;
    const bw = this._doorBlockBw;
    const bh = this._doorBlockBh;
    const by = this.doorBlockY;

    g.fillStyle(0x2a3a4a);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(bx, by, 2, bh);
    // Detalhes de parafusos
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + bw / 2, by + 8, 2);
    g.fillCircle(bx + bw / 2, by + bh - 8, 2);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALAVANCA 1  —  controla a água (sobe / para)
  //  Posição: início do cenário, chão da primeira metade, próxima à parede E
  // ════════════════════════════════════════════════════════════════════════
  createLever1() {
    const lx = 120;
    const ly = this.floorY - 32; // em cima do chão

    this.lever1X = lx;
    this.lever1Y = ly;
    this.lever1Gfx = this.add.graphics().setDepth(5);
    this._drawLever(this.lever1Gfx, lx, ly, this.lever1Active, 1);

    // Zona de interação
    this.lever1Zone = this.add.zone(lx, ly - 10, 40, 50);
    this.physics.add.existing(this.lever1Zone, true);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALAVANCA 2  —  plataforma alta (x≈2500), só alcançável com água alta
  //  Ao ativar: baixa a água + desliza bloco de concreto sobre o botão 1
  // ════════════════════════════════════════════════════════════════════════
  createLever2() {
    // Plataforma de referência: { x: 1700, y: floorY2 - 230, w: 130 }
    const platY = this.floorY2 - 230;
    const platX = 1700;
    const platW = 130;

    const lx = platX + platW / 2; // centro da plataforma
    const ly = platY - 32;

    this.lever2X = lx;
    this.lever2Y = ly;
    this.lever2Gfx = this.add.graphics().setDepth(5);
    this._drawLever(this.lever2Gfx, lx, ly, this.lever2Active, 2);

    this.lever2Zone = this.add.zone(lx, ly - 10, 40, 50);
    this.physics.add.existing(this.lever2Zone, true);

    // Altura mínima da superfície da água para alcançar a plataforma
    // (a plataforma fica em platY, precisa flutuar perto)
    this.lever2RequiredWaterLevel = platY + 60; // player precisa estar flutuando perto
  }

  _drawLever(g, x, y, active, id) {
    g.clear();
    // Base da alavanca
    g.fillStyle(0x334455);
    g.fillRect(x - 12, y + 10, 24, 14);
    g.fillStyle(0x445566);
    g.fillRect(x - 12, y + 10, 24, 3);

    // Haste — inclina conforme o estado
    const angle = active ? -0.7 : 0.7; // radianos
    const len = 28;
    const ex = x + Math.sin(angle) * len;
    const ey = (y + 10) - Math.cos(angle) * len;

    g.lineStyle(4, active ? 0x44ffaa : 0x888899);
    g.beginPath();
    g.moveTo(x, y + 10);
    g.lineTo(ex, ey);
    g.strokePath();

    // Bolinha no topo
    g.fillStyle(active ? 0x44ffaa : 0xaabbcc);
    g.fillCircle(ex, ey, 6);

    // Label pequeno
    g.fillStyle(active ? 0x44ffaa : 0x556677, 0.9);
    g.fillRect(x - 8, y + 26, 16, 5);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOTÃO 1 + estrutura de concreto + caixote
  //  Posição: próximo à parede/escada, chão segunda metade
  // ════════════════════════════════════════════════════════════════════════
  createButton1Setup() {
    // Botão 1 fica logo após a descida, próximo à parede da escada
    const btn1X = 1500;
    const btn1Y = this.floorY2; // nível do chão

    this.btn1X = btn1X;
    this.btn1Y = btn1Y;

    // Estrutura de concreto: 3 blocos empilhados + 1 bloco no topo que desliza
    // Layout: [bloco esq fixo] [bloco top MÓVEL] [bloco dir fixo]
    // O botão fica dentro, escondido pelo bloco móvel quando active=false
    // Após alavanca2: bloco móvel desliza p/ direita → botão aparece

    this._drawButton1Setup();
    this._createCrate();
    this._createRock2();


  }

  _drawButton1Setup() {
    const bx = this.btn1X;
    const by = this.btn1Y;
    const bw = 16;  // blocos laterais finos
    const inner = 60;  // abertura interna — espaço onde o player entra
    const bh = 70;  // altura dos blocos laterais
    const tbh = 12;  // altura do bloco deslizante (fino)

    // Salva tudo para uso nos outros métodos
    this._btn1Bx = bx;
    this._btn1By = by;
    this._btn1Bw = bw;
    this._btn1Bh = bh;
    this._btn1TbH = tbh;
    this._btn1Inner = inner;

    // ── Gráfico fixo (blocos laterais) ──────────────────────────────────
    const g = this.add.graphics().setDepth(4);

    // Bloco esquerdo fixo — de (bx - bw) até (bx)
    g.fillStyle(0x2a3a4a);
    g.fillRect(bx - bw, by - bh, bw, bh);
    g.fillStyle(0x3a5060, 0.5);
    g.fillRect(bx - bw, by - bh, bw, 2);   // borda superior
    g.fillRect(bx - bw, by - bh, 2, bh);   // borda esquerda
    // Parafusos decorativos
    g.fillStyle(0x1a2530);
    g.fillCircle(bx - bw + 5, by - bh + 8, 2);
    g.fillCircle(bx - bw + 5, by - 8, 2);

    // Bloco direito fixo — de (bx + inner) até (bx + inner + bw)
    g.fillStyle(0x2a3a4a);
    g.fillRect(bx + inner, by - bh, bw, bh);
    g.fillStyle(0x3a5060, 0.5);
    g.fillRect(bx + inner, by - bh, bw, 2);          // borda superior
    g.fillRect(bx + inner + bw - 2, by - bh, 2, bh); // borda direita
    // Parafusos decorativos
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + inner + bw - 5, by - bh + 8, 2);
    g.fillCircle(bx + inner + bw - 5, by - 8, 2);

    // ── Física dos blocos laterais ───────────────────────────────────────
    // Bloco esq: centro X = bx - bw/2
    const leftBlock = this.add.rectangle(bx - bw / 2, by - bh / 2, bw, bh).setVisible(false);
    // Bloco dir: centro X = bx + inner + bw/2
    const rightBlock = this.add.rectangle(bx + inner + bw / 2, by - bh / 2, bw, bh).setVisible(false);
    this.physics.add.existing(leftBlock, true);
    this.physics.add.existing(rightBlock, true);
    this.platforms.add(leftBlock);
    this.platforms.add(rightBlock);

    // ── Bloco deslizante (começa cobrindo a abertura, desliza p/ direita) ─
    // Largura total = bw (esq) + inner (abertura) + bw (dir) = cobre tudo
    this.slidingBlockGfx = this.add.graphics().setDepth(6);
    this.slidingBlockX = bx - bw;              // começa alinhado à borda esq
    this.slidingBlockTargX = bx - bw;              // alvo inicial (parado)
    this.slidingBlockW = bw + inner + bw;       // cobre toda a estrutura
    this._redrawSlidingBlock();

    // Física do bloco deslizante — bloqueia a entrada de cima
    const slidingTopY = by - bh - tbh; // Y do topo da abertura
    this.slidingBlockPhys = this.add.rectangle(
      bx - bw + (bw + inner + bw) / 2,  // centro X inicial (cobre tudo)
      slidingTopY + tbh / 2,             // centro Y
      bw + inner + bw,                   // largura = mesma do visual
      tbh                                // altura fina
    ).setVisible(false);
    this.physics.add.existing(this.slidingBlockPhys, true);
    this.platforms.add(this.slidingBlockPhys);

    // ── Botão 1 (no centro da abertura, inicialmente coberto) ────────────
    const btnCenterX = bx + inner / 2;             // centro da abertura
    this.btn1Gfx = this.add.graphics().setDepth(5);
    this._drawButton(this.btn1Gfx, btnCenterX, by - 8, this.button1Pressed, '#ffaa00');

    // Zona de interação — só funciona quando button1Revealed = true
    this.button1Zone = this.add.zone(btnCenterX, by - 8, inner, 20);
    this.physics.add.existing(this.button1Zone, true);
  }

  _redrawSlidingBlock() {
    const g = this.slidingBlockGfx;
    g.clear();
    const bx = this.slidingBlockX;
    const by = this._btn1By - this._btn1Bh - this._btn1TbH;
    const bw = this.slidingBlockW;
    const bh = this._btn1TbH;

    g.fillStyle(0x2a3a4a);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(bx, by, bw, 2);
    // Parafusos decorativos
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + 8, by + bh / 2, 2);
    g.fillCircle(bx + bw - 8, by + bh / 2, 2);
  }

  _createCrate() {
    // Caixote de madeira em cima do bloco superior da estrutura
    const cx = this._btn1Bx + this._btn1Bw / 2; // centro dos blocos
    const cy = this._btn1By - this._btn1Bh - this._btn1TbH - 18; // em cima do bloco

    this.crateGfx = this.add.graphics().setDepth(7);

    // Física do caixote (dinâmica — pode flutuar)
    this.crate = this.physics.add.image(cx, cy, '__DEFAULT').setVisible(false);
    this.crate.setDisplaySize(28, 28);
    this.crate.body.setSize(28, 28);
    this.crate.body.setCollideWorldBounds(false);
    this.crate.body.setBounce(0.1);
    this.crate.body.setDragX(200);
    this.crate.body.setGravityY(300);

    this.physics.add.collider(this.crate, this.platforms);
    this.physics.add.collider(this.crate, this.player, this._pushCrate, null, this);

    this._drawCrate();
  }

  _drawCrate() {
    const g = this.crateGfx;
    g.clear();
    const cx = this.crate.x - 14;
    const cy = this.crate.y - 14;
    const s = 28;

    // Corpo de madeira
    g.fillStyle(0x8B5E3C);
    g.fillRect(cx, cy, s, s);

    // Ripas verticais
    g.lineStyle(1, 0x5a3a20, 0.8);
    g.beginPath(); g.moveTo(cx + s / 3, cy); g.lineTo(cx + s / 3, cy + s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 2 * s / 3, cy); g.lineTo(cx + 2 * s / 3, cy + s); g.strokePath();

    // Ripas horizontais
    g.beginPath(); g.moveTo(cx, cy + s / 3); g.lineTo(cx + s, cy + s / 3); g.strokePath();
    g.beginPath(); g.moveTo(cx, cy + 2 * s / 3); g.lineTo(cx + s, cy + 2 * s / 3); g.strokePath();

    // Borda escura
    g.lineStyle(2, 0x3a2010, 0.9);
    g.strokeRect(cx, cy, s, s);

    // Brilho
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(cx + 2, cy + 2, s - 4, 4);
  }

  _pushCrate(player, crate) {
    // O player empurra o caixote horizontalmente
    const dir = crate.x > player.x ? 1 : -1;
    crate.body.setVelocityX(dir * 180);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOTÃO 2  —  abre o bloco esquerdo da porta
  //  Aparece após botão 1 ser pressionado
  //  Posição: próximo ao final, antes da porta
  // ════════════════════════════════════════════════════════════════════════
  _createButton2() {
    this.btn2Gfx = this.add.graphics().setDepth(5);
    this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y - 8, false, '#00aaff');

    this.button2Zone = this.add.zone(this.btn2X, this.btn2Y - 8, 50, 20);
    this.physics.add.existing(this.button2Zone, true);

    this.button2Revealed = true;
  }

  _redrawRock2() {
    const g = this.rock2Gfx;
    g.clear();
    const rx = this.rock2X - this.rock2W / 2;
    const ry = this.btn2Y - this.rock2H;
    const rw = this.rock2W;
    const rh = this.rock2H;

    // Corpo da rocha — irregular com polígono
    g.fillStyle(0x4a5560);
    g.fillRect(rx + 4, ry, rw - 8, rh);       // centro
    g.fillRect(rx, ry + 6, rw, rh - 10);       // laterais mais baixas
    // Topo irregular
    g.fillStyle(0x5a6570);
    g.fillTriangle(rx + 4, ry, rx + rw / 2, ry - 8, rx + rw - 4, ry);
    // Sombra / detalhe
    g.fillStyle(0x2a3540, 0.6);
    g.fillRect(rx + 4, ry + rh - 5, rw - 8, 4);
    // Brilho
    g.fillStyle(0x7a8a99, 0.4);
    g.fillRect(rx + 6, ry + 4, 8, 3);
  }

  _drawButton(g, x, y, pressed, color) {
    g.clear();
    const col = Phaser.Display.Color.HexStringToColor(color).color;

    // Corpo do botão
    g.fillStyle(pressed ? col : 0x334455);
    g.fillEllipse(x, y, 26, 12);

    // Anel externo
    g.lineStyle(2, col, pressed ? 1.0 : 0.5);
    g.strokeEllipse(x, y, 32, 16);

    // Brilho
    g.fillStyle(0xffffff, pressed ? 0.3 : 0.1);
    g.fillEllipse(x - 4, y - 2, 10, 5);
  }

  _updateRock2() {
    if (!this.rock2Gfx) return;
    const diff = this.rock2X - this.rock2TargX;
    if (Math.abs(diff) > 0.5) {
      this.rock2X -= diff * 0.08;
      // Move física junto
      this.rock2PhysRect.x = this.rock2X;
      this.rock2PhysRect.body.reset(this.rock2X, this.rock2PhysRect.y);
      this._redrawRock2();
    }
  }
  _createRock2() {
    const b2x = this.doorPlatX - 120;
    const b2y = this.floorY2;

    this.btn2X = b2x;
    this.btn2Y = b2y;
    this.rock2W = 60;
    this.rock2H = 28;
    this.rock2X = b2x;
    this.rock2TargX = b2x; // parada até botão 1 ser pressionado

    this.rock2Gfx = this.add.graphics().setDepth(6);
    this._redrawRock2();

    this.rock2PhysRect = this.add.rectangle(b2x, b2y - this.rock2H / 2, this.rock2W, this.rock2H).setVisible(false);
    this.physics.add.existing(this.rock2PhysRect, true);
    this.platforms.add(this.rock2PhysRect);
  }
  // ════════════════════════════════════════════════════════════════════════
  //  ÁGUA
  // ════════════════════════════════════════════════════════════════════════
  createWater() {
    this.waterGfx = this.add.graphics().setDepth(3);
  }

  updateWater() {
    if (!this.gameActive || this.transitioning) return;

    // Interpola suavemente em direção ao alvo
    const diff = this.waterLevel - this.waterTargetLevel;
    if (Math.abs(diff) > 0.5) {
      this.waterLevel -= diff * 0.04 * this.waterRiseSpeed;
    } else {
      this.waterLevel = this.waterTargetLevel;
    }

    const g = this.waterGfx;
    g.clear();

    if (this.waterLevel >= GAME_H) return; // fora da tela

    g.fillStyle(0x0044aa, 0.4);
    g.fillRect(0, this.waterLevel, this.worldWidth, GAME_H + 200 - this.waterLevel);

    // Superfície
    const t = this.time.now / 800;
    g.fillStyle(0x2266cc, 0.25);
    for (let wx = 0; wx < this.worldWidth; wx += 80) {
      const wave = Math.sin(t + wx * 0.02) * 3;
      g.fillRect(wx, this.waterLevel + wave, 80, 6);
    }
    g.fillStyle(0x44aaff, 0.12);
    g.fillRect(0, this.waterLevel + 4, this.worldWidth, 3);

    // ── Física da água no player ────────────────────────────────────────
    if (this.player.y > this.waterLevel + 10 && !this.transitioning) {
      this.player.body.setGravityY(-500);
      this.player.body.setMaxVelocityY(80);

      if (this.cursors.up.isDown || this.keys.jump.isDown || this.spaceKey.isDown) {
        this.player.body.setVelocityY(-500);
        this.player.body.setMaxVelocityY(500);
      }
      if (this.cursors.down.isDown || this.keys.down.isDown) {
        this.player.body.setVelocityY(120);
      }

      if (!this.underwaterTimer) {
        this.underwaterTimer = this.time.delayedCall(15000, () => {
          if (this.player.y > this.waterLevel) {
            if (GameState.damage(1)) {
              this.transitionTo('GameOverScene');
            } else {
              this.transitioning = true;
              this.cameras.main.fadeOut(600, 0, 20, 60);
              this.time.delayedCall(650, () => { this.scene.restart(); });
            }
          }
          this.underwaterTimer = null;
        });
      }

      // ── Flutuação do caixote ──────────────────────────────────────────
      if (this.crate && this.crate.y > this.waterLevel) {
        // Empuxo: quanto mais submerso, mais sobe
        const submerge = Math.min(1, (this.crate.y - this.waterLevel) / 28);
        this.crate.body.setGravityY(-500 * submerge);
        this.crate.body.setMaxVelocityY(60);
        this.crate.body.setDragX(300); // mais resistência na água
      }
    } else {
      this.player.body.setGravityY(700);
      this.player.body.setMaxVelocityY(900);

      if (this.underwaterTimer) {
        this.underwaterTimer.remove();
        this.underwaterTimer = null;
      }

      // Caixote fora da água — gravidade normal
      if (this.crate && this.crate.y <= this.waterLevel) {
        this.crate.body.setGravityY(300);
        this.crate.body.setMaxVelocityY(400);
        this.crate.body.setDragX(200);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ANIMAÇÃO: bloco deslizante sobre o botão 1
  // ════════════════════════════════════════════════════════════════════════
  _updateSlidingBlock() {
    const diff = this.slidingBlockX - this.slidingBlockTargX;
    if (Math.abs(diff) > 0.5) {
      this.slidingBlockX -= diff * 0.08;

      // Move a física junto com o visual
      this.slidingBlockPhys.x = this.slidingBlockX + this.slidingBlockW / 2;
      this.slidingBlockPhys.body.reset(
        this.slidingBlockPhys.x,
        this.slidingBlockPhys.y
      );

      this._redrawSlidingBlock();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ANIMAÇÃO: bloco da porta (sobe ao abrir)
  // ════════════════════════════════════════════════════════════════════════
  _updateDoorBlock() {
    if (!this.doorBlockOpen) return;

    const diff = this.doorBlockY - this.doorBlockTargetY;
    if (Math.abs(diff) > 0.5) {
      this.doorBlockY -= diff * 0.07;
      // Move também a física
      const bx = this._doorBlockBx;
      const bh = this._doorBlockBh;
      this.doorBlockPhysRect.setPosition(bx + this._doorBlockBw / 2, this.doorBlockY + bh / 2);
      this.doorBlockPhysRect.body.reset(bx + this._doorBlockBw / 2, this.doorBlockY + bh / 2);
      this._redrawDoorBlock();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  LÓGICA DE INTERAÇÕES
  // ════════════════════════════════════════════════════════════════════════
  handleInteract() {
    if (this.transitioning) return;

    // ── Porta ───────────────────────────────────────────────────────────
    if (this.isNear(this.doorZone)) {
      if (!this.button2Pressed || !this.doorBlockOpen) {
        this.showLockedMessage();
        return;
      }
      this.transitionTo(this.doorDestination);
      return;
    }

    // ── Alavanca 1 ──────────────────────────────────────────────────────
    if (this.isNear(this.lever1Zone)) {
      this.lever1Active = !this.lever1Active;
      this._drawLever(this.lever1Gfx, this.lever1X, this.lever1Y, this.lever1Active, 1);

      if (this.lever1Active) {
        // Liga a subida da água
        this.waterTargetLevel = this.waterLevelBase;
      } else {
        // Para onde está (não desce — só a alavanca 2 baixa)
        this.waterTargetLevel = this.waterLevel;
      }
      return;
    }

    // ── Alavanca 2 ──────────────────────────────────────────────────────
    if (this.isNear(this.lever2Zone)) {
      if (this.lever2Active) return; // só ativa uma vez

      // Verifica se o player está alto o suficiente (água subiu)
      // A alavanca está em posição alta; se chegou até lá, já está OK
      this.lever2Active = true;
      this._drawLever(this.lever2Gfx, this.lever2X, this.lever2Y, true, 2);

      // Baixa a água
      this.lever1Active = false;
      this._drawLever(this.lever1Gfx, this.lever1X, this.lever1Y, false, 1);
      this.waterTargetLevel = this.waterLevelLow;

      // Desliza o bloco de concreto para revelar o botão 1
      this.slidingBlockTargX = this._btn1Bx + this._btn1Bw * 2 + 20; // desliza p/ direita
      this._scheduleRevealButton1();
      return;
    }

    // ── Botão 1 ──────────────────────────────────────────────────────────
    if (this.button1Revealed && !this.button1Pressed && this.isNear(this.button1Zone)) {
      this.button1Pressed = true;
      this._drawButton(this.btn1Gfx, this._btn1Bx + this._btn1Inner / 2, this._btn1By - 8, true, '#ffaa00');

      // Desliza a pedra para o lado
      this.rock2TargX = this.btn2X + this.rock2W + 20;

      // Cria o botão 2 após a pedra ter saído
      this.time.delayedCall(800, () => { this._createButton2(); });
      return;
    }

    // ── Botão 2 ──────────────────────────────────────────────────────────
    if (this.button2Revealed && !this.button2Pressed && this.isNear(this.button2Zone)) {
      // Verifica se o caixote está em cima do botão 2
      if (!this._crateOnButton2()) {
        // Pisca o botão — precisa do caixote
        this._flashButton2();
        return;
      }
      this._activateButton2();
      return;
    }
  }

  _scheduleRevealButton1() {
    // O bloco começa a deslizar imediatamente (animado no update)
    // Depois de ~1.5s revela o botão visualmente
    this.time.delayedCall(1500, () => {
      this.button1Revealed = true;
    });
  }

  _crateOnButton2() {
    if (!this.crate || !this.button2Revealed) return false;
    const dx = Math.abs(this.crate.x - this.btn2X);
    const dy = Math.abs(this.crate.y - this.btn2Y);
    return dx < 20 && dy < 30;
  }

  _flashButton2() {
    // Pisca o botão 2 para indicar que falta algo
    let count = 0;
    const t = this.time.addEvent({
      delay: 150,
      repeat: 5,
      callback: () => {
        count++;
        const col = count % 2 === 0 ? '#00aaff' : '#ff4444';
        this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y, false, col);
      }
    });
  }

  _activateButton2() {
    this.button2Pressed = true;
    this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y, true, '#00aaff');

    // Abre o bloco esquerdo da porta (sobe)
    this.doorBlockOpen = true;
    this.doorBlockTargetY = this.doorBlockOpenY;

    // Timer: bloco fecha após 8 segundos (tempo desafiador porém possível)
    this.doorBlockTimer = this.time.delayedCall(8000, () => {
      this._closeDoorBlock();
    });
  }

  _closeDoorBlock() {
    this.doorBlockOpen = false;
    this.doorBlockTargetY = this.doorBlockClosedY;
    this.button2Pressed = false;
    this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y, false, '#00aaff');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SALMÕES (sem alteração)
  // ════════════════════════════════════════════════════════════════════════
  createSalmons() {
    this.salmonGfx = this.add.graphics().setDepth(4);
    const positions = [
      { x: 150, dir: 1, speed: 55, depth: 30 },
      { x: 400, dir: -1, speed: 65, depth: 120 },
      { x: 650, dir: 1, speed: 50, depth: 60 },
      { x: 900, dir: -1, speed: 70, depth: 150 },
      { x: 1150, dir: 1, speed: 60, depth: 90 },
      { x: 1450, dir: -1, speed: 55, depth: 30 },
      { x: 1700, dir: 1, speed: 65, depth: 120 },
      { x: 1950, dir: -1, speed: 50, depth: 60 },
      { x: 2200, dir: 1, speed: 70, depth: 150 },
      { x: 2450, dir: -1, speed: 60, depth: 90 },
      { x: 2700, dir: 1, speed: 55, depth: 30 },
      { x: 2950, dir: -1, speed: 65, depth: 120 },
    ];
    positions.forEach(p => {
      this.salmons.push({ x: p.x, y: GAME_H, dir: p.dir, speed: p.speed, depth: p.depth, alpha: 0 });
    });
  }

  drawSalmons() {
    const g = this.salmonGfx;
    g.clear();
    if (GAME_H - this.waterLevel < 10) return;

    this.salmons.forEach(s => {
      s.x += s.speed * s.dir * 0.016;
      s.y = this.waterLevel + s.depth;
      if (s.x > this.worldWidth - 30 || s.x < 30) s.dir *= -1;
      if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + 0.02);

      const dx = Math.abs(this.player.x - s.x);
      const dy = Math.abs(this.player.y - s.y);
      if (dx < 20 && dy < 20 && !this.hitCooldown) {
        this.hitCooldown = true;
        if (GameState.damage(1)) this.transitionTo('GameOverScene');
        this.time.delayedCall(2000, () => { this.hitCooldown = false; });
      }

      const flip = s.dir < 0 ? -1 : 1;
      g.fillStyle(0xff8866, 0.85 * s.alpha);
      g.fillEllipse(s.x, s.y, 30 * flip, 12);
      g.fillStyle(0xff6644, 0.85 * s.alpha);
      g.fillTriangle(s.x - 14 * flip, s.y, s.x - 22 * flip, s.y - 8, s.x - 22 * flip, s.y + 8);
      g.fillStyle(0xffffff, s.alpha);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 2);
      g.fillStyle(0x220000, s.alpha);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 1);
      g.lineStyle(1, 0xff4444, 0.5 * s.alpha);
      g.beginPath();
      g.moveTo(s.x - 8 * flip, s.y - 4);
      g.lineTo(s.x + 6 * flip, s.y - 4);
      g.strokePath();
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOLHAS, CORAIS, DECORAÇÃO (sem alteração)
  // ════════════════════════════════════════════════════════════════════════
  createPlayerBubbles() {
    this.bubbleGfx = this.add.graphics().setDepth(6);
    this.bubbles = [];
  }

  updatePlayerBubbles() {
    if (this.player.y - 58 < this.waterLevel) { this.bubbleGfx.clear(); return; }
    if (Phaser.Math.Between(0, 30) === 0) {
      this.bubbles.push({
        x: this.player.x + Phaser.Math.Between(-8, 8),
        y: this.player.y - 20,
        r: Phaser.Math.Between(2, 4),
        speed: Phaser.Math.Between(1, 3) * 0.5
      });
    }
    const g = this.bubbleGfx;
    g.clear();
    this.bubbles = this.bubbles.filter(b => b.y > this.waterLevel - 10);
    this.bubbles.forEach(b => {
      b.y -= b.speed;
      b.x += Math.sin(b.y * 0.1) * 0.3;
      g.fillStyle(0x88ccff, 0.4);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(1, 0xaaddff, 0.3);
      g.strokeCircle(b.x, b.y, b.r);
    });
  }

  createBubbles() {
    const g = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const bx = Phaser.Math.Between(20, this.worldWidth - 20);
      const by = Phaser.Math.Between(50, this.floorY - 20);
      g.fillStyle(0x1155aa, 0.15);
      g.fillCircle(bx, by, Phaser.Math.Between(2, 6));
    }
  }

  createCoral() {
    const g = this.add.graphics();
    const positions = [80, 250, 500, 780, 1050, 1300, 1600, 1900, 2200, 2500, 2800];
    positions.forEach(x => {
      g.fillStyle(0x994422, 0.5);
      g.fillRect(x, this.floorY - 30, 8, 30);
      g.fillCircle(x + 4, this.floorY - 32, 10);
      g.fillStyle(0xcc5533, 0.4);
      g.fillRect(x + 15, this.floorY - 20, 6, 20);
      g.fillCircle(x + 18, this.floorY - 22, 7);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TIMER UI
  // ════════════════════════════════════════════════════════════════════════
  createTimerUI() {
    this.timerText = this.add.text(GAME_W / 2, 20, '60', {
      fontSize: '22px', fontFamily: 'Courier New',
      color: '#55aaff', letterSpacing: 4
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
          if (GameState.damage(1)) {
            this.transitionTo('GameOverScene');
          } else {
            const flood = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0044aa, 0)
              .setScrollFactor(0).setDepth(30);
            this.tweens.add({
              targets: flood, alpha: 0.7, duration: 1000,
              onComplete: () => {
                this.cameras.main.fadeOut(500, 0, 20, 60);
                this.time.delayedCall(550, () => { this.scene.restart(); });
              }
            });
          }
        }
      },
      repeat: 59
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PLAYER COM COR DE AFOGAMENTO
  // ════════════════════════════════════════════════════════════════════════
  drawPlayer() {
    const isUnderwater = this.player.y > this.waterLevel;
    if (isUnderwater && this.underwaterTimer) {
      const elapsed = this.underwaterTimer.getElapsed();
      const progress = Math.min(elapsed / 15000, 1);
      if (progress > 0.66) {
        const redProgress = (progress - 0.66) / 0.34;
        const r = Math.floor(0xd0 + (0xff - 0xd0) * redProgress);
        const gv = Math.floor(0xc8 * (1 - redProgress));
        const b = Math.floor(0xf0 * (1 - redProgress));
        this.playerGfx.clear();
        this.drawPlayerColor((r << 16) | (gv << 8) | b);
        return;
      }
    }
    super.drawPlayer();
  }

  drawPlayerColor(color) {
    const x = this.player.x, y = this.player.y;
    const g = this.playerGfx;
    g.fillStyle(color);
    g.fillRect(x - 10, y - 38, 20, 28);
    g.fillRect(x - 9, y - 58, 18, 18);
    g.fillStyle(COLORS.playerEye);
    const eyeX = this.facingLeft ? x - 5 : x + 2;
    g.fillRect(eyeX, y - 53, 4, 4);
    g.fillStyle(color, 0.8);
    g.fillRect(x - 8, y - 10, 7, 12);
    g.fillRect(x + 1, y - 10, 7, 12);
    g.fillRect(x - 14, y - 36, 5, 20);
    g.fillRect(x + 9, y - 36, 5, 20);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UPDATE PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════
  update() {
    super.update();
    if (this.transitioning) return;

    // Câmera
    if (this.player.x > this.stepXRef) {
      this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H + 200);
    } else {
      this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H);
    }

    this.updateWater();
    this.drawSalmons();
    this.updatePlayerBubbles();
    this._updateSlidingBlock();
    this._updateRock2();
    this._updateDoorBlock();
    this._drawCrate();

    // ── Prompts de interação ────────────────────────────────────────────
    let promptText = null;
    let promptColor = '#ffdd44';
    let promptZone = null;

    if (this.isNear(this.doorZone)) {
      const open = this.button2Pressed && this.doorBlockOpen;
      promptText = open ? TEXTS.ENTER : '🔒';
      promptColor = open ? '#ffdd44' : '#ff6666';
      promptZone = this.doorZone;
    } else if (this.isNear(this.lever1Zone)) {
      promptText = this.lever1Active ? '⬇ Alavanca' : '⬆ Alavanca';
      promptColor = '#44ffaa';
      promptZone = this.lever1Zone;
    } else if (this.isNear(this.lever2Zone)) {
      promptText = '⬇ Alavanca';
      promptColor = '#44ffaa';
      promptZone = this.lever2Zone;
    } else if (this.button1Revealed && !this.button1Pressed && this.isNear(this.button1Zone)) {
      promptText = '● Botão';
      promptColor = '#ffaa00';
      promptZone = this.button1Zone;
    } else if (this.button2Revealed && !this.button2Pressed && this.isNear(this.button2Zone)) {
      promptText = '● Botão';
      promptColor = '#00aaff';
      promptZone = this.button2Zone;
    }

    if (promptText && !this.activePrompt) {
      this.createPrompt(promptText, -70, promptColor);
    } else if (!promptText && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    } else if (promptText && this.activePrompt) {
      // Atualiza texto do prompt se mudou
      if (this.activePrompt.text !== promptText) {
        this.activePrompt.destroy();
        this.activePrompt = null;
        this.createPrompt(promptText, -70, promptColor);
      }
    }
  }
}

// =============================================
//  CENA: FASE 4 - ACADEMIA (COM DECORAÇÕES)
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
    this.createTorches();
    this.createMirrors();

    this.physics.add.collider(this.player, this.platforms);

    this.mariaGfx = this.add.graphics().setDepth(15);
  }

  buildLevel() {
    const g = this.add.graphics();

    // Fundo
    g.fillStyle(0x080810);
    g.fillRect(0, 0, this.worldWidth, GAME_H);

    // Chão com padrão quadriculado
    for (let x = 0; x < this.worldWidth; x += 40) {
      g.fillStyle(x % 80 === 0 ? 0x111120 : 0x0e0e1c);
      g.fillRect(x, this.floorY, 40, 60);
    }

    g.fillStyle(0x2a2840);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth / 2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas
    const platforms = [
      { x: 150, y: 350, w: 160 }, { x: 420, y: 290, w: 120 }, { x: 680, y: 330, w: 140 },
      { x: 950, y: 260, w: 130 }, { x: 1200, y: 310, w: 150 }, { x: 1480, y: 270, w: 120 },
      { x: 1720, y: 300, w: 140 }, { x: 1980, y: 240, w: 120 }
    ];

    platforms.forEach(p => {
      g.fillStyle(0x2a1a0a);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x4a3010);
      g.fillRect(p.x, p.y, p.w, 3);

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });
  }

  createTorches() {
    const g = this.add.graphics();
    const positions = [80, 300, 600, 900, 1200, 1500, 1800, 2100];

    positions.forEach(x => {
      g.fillStyle(0x551100, 0.7);
      g.fillRect(x - 2, this.floorY - 130, 4, 25);
      g.fillStyle(0xff4400, 0.8);
      g.fillCircle(x, this.floorY - 138, 6);

      const glow = this.add.rectangle(x, this.floorY - 138, 26, 26, 0xff4400, 0.05);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.02, to: 0.10 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    });
  }

  createMirrors() {
    const g = this.add.graphics();
    const positions = [100, 500, 900, 1300, 1700, 2100];

    positions.forEach(x => {
      g.fillStyle(0x334455, 0.4);
      g.fillRect(x, this.floorY - 200, 70, 140);
      g.lineStyle(2, 0x5566aa, 0.5);
      g.strokeRect(x, this.floorY - 200, 70, 140);
    });
  }

  createLockers() {
    const g = this.add.graphics().setDepth(2);

    this.lockerXs.forEach(cx => {
      const x = cx - 19;
      g.fillStyle(0x1a2233);
      g.fillRect(x, this.floorY - 90, 38, 90);
      g.lineStyle(2, 0x4488cc, 0.9);
      g.strokeRect(x, this.floorY - 90, 38, 90);

      // Maçaneta
      g.fillStyle(0x2255aa, 0.5);
      g.fillRect(x + 15, this.floorY - 50, 6, 20);

      // Rótulo
      this.add.text(cx, this.floorY - 105, 'LOCKER', {
        fontSize: '9px',
        fontFamily: 'Courier New',
        color: '#4499dd',
        letterSpacing: 1
      }).setOrigin(0.5).setDepth(3);

      // Zona de interação
      const zone = this.add.zone(cx, this.floorY - 45, 50, 80);
      this.physics.add.existing(zone, true);
      this.lockerZones.push(zone);
    });
  }

  createWeights() {
    this.weightGfx = this.add.graphics().setDepth(2);

    [200, 600, 1000, 1400, 1800].forEach((x, i) => {
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
    g.fillCircle(dx + dw - 10, dy + dh / 2, 4);

    // Brilho animado
    const glow = this.add.rectangle(dx + dw / 2, dy + dh / 2, dw + 20, dh + 20, COLORS.doorGlow, 0.06);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.10 },
      duration: 1200,
      yoyo: true,
      repeat: -1
    });

    this.add.text(dx + dw / 2, dy - 18, '004', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.exitZone = this.add.zone(dx + dw / 2, dy + dh / 2, dw, dh);
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

    g.fillStyle(0x220022, 0.9);
    g.fillRect(mx - 11, my - 85, 22, 10);
    g.fillRect(mx - 10, my - 20, 8, 20);
    g.fillRect(mx + 2, my - 20, 8, 20);

    // Brilho
    g.fillStyle(0xff00ff, 0.05);
    g.fillCircle(mx, my - 40, 45);

    // Animação de fade
    this.tweens.add({
      targets: this.mariaGfx,
      alpha: 0,
      duration: 2000,
      onComplete: () => this.mariaGfx.clear()
    });

    // Aviso
    const warn = this.add.text(GAME_W / 2, GAME_H / 2 - 20, '(!) ENTRE NO LOCKER!', {
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

        // Flash vermelho
        const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff0000, 0.4)
          .setScrollFactor(0).setDepth(30);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 500,
          onComplete: () => flash.destroy()
        });

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
//  CENA: FASE 5 - ACADEMIA ESCURA  (v5)
// =============================================
class Phase5Scene extends BaseScene {
  constructor() {
    super('Phase5Scene');
    this.worldWidth = Math.round(GAME_W * 3.5); // fase bem mais longa
  }

  create() {
    super.create();
    GameState.door = 5;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_5);

    // ── ESTADO ─────────────────────────────────────────────
    this.keyFound = false;
    this.screechDerrotado = false;
    this.portaAberta = false;
    this.tempoPassado = 0;
    this.tempoLimite = 30000; // 1º ataque em 30s
    this.cicloAtaque = 0;     // conta quantos ataques já ocorreram
    this.punicaoAplicada = false;
    this.bauAberto = false;
    this.screechAtacando = false;

    // ── CENÁRIO ────────────────────────────────────────────
    this.platforms = this.physics.add.staticGroup();
    this.buildAcademia();

    // ── BAÚ ────────────────────────────────────────────────
    this.criarBau();

    // ── SCREECH ────────────────────────────────────────────
    this.screechObj = this.criarScreech();

    // ── ESCURIDÃO COM GEOMETRYMASK ─────────────────────────
    this.escuridaoRect = this.add.graphics()
      .setDepth(20).setScrollFactor(0);
    this.escuridaoRect.fillStyle(0x000000, 0.97);
    this.escuridaoRect.fillRect(0, 0, GAME_W, GAME_H);

    // lantGfx recebe DOIS círculos: mouse + player
    this.lantGfx = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.lantMask = this.lantGfx.createGeometryMask();
    this.lantMask.setInvertAlpha(true);
    this.escuridaoRect.setMask(this.lantMask);

    // ── AVISO ──────────────────────────────────────────────
    this.textoAviso = this.add.text(GAME_W / 2, GAME_H - 40, '', {
      fontSize: '15px', fill: '#ffdd44', align: 'center',
      backgroundColor: '#000000', padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(55).setScrollFactor(0);

    // ── COLISÕES ───────────────────────────────────────────
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.bauZone, () => this.abrirBau(), null, this);

    // ── PSST após 7s ───────────────────────────────────────
    this.time.delayedCall(7000, () => {
      try { this.sound.play('psst', { volume: 1.0 }); } catch (e) { }
    });
  }

  // ── CENÁRIO DA ACADEMIA ───────────────────────────────────
  buildAcademia() {
    const g = this.add.graphics().setDepth(1);
    const W = this.worldWidth;
    const fy = this.floorY;

    // Fundo
    g.fillStyle(0x050508);
    g.fillRect(0, 0, W, GAME_H);

    // Chão
    for (let x = 0; x < W; x += 40) {
      g.fillStyle(x % 80 === 0 ? 0x0e0e14 : 0x0b0b10);
      g.fillRect(x, fy, 40, 60);
    }
    g.fillStyle(0x1a1a28);
    g.fillRect(0, fy, W, 3);

    // Teto
    g.fillStyle(0x080810);
    g.fillRect(0, 0, W, 28);
    g.fillStyle(0x111118);
    g.fillRect(0, 28, W, 4);

    // Física do chão
    const floor = this.add.rectangle(W / 2, fy + 30, W, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Esteiras (mais espalhadas)
    [120, 480, 900, 1380, 1820, 2300, 2750].forEach(x => this._esteira(g, x, fy));

    // Halteres
    [300, 660, 1050, 1530, 1980, 2450, 2900].forEach(x => this._halteres(g, x, fy));

    // Espelhos
    [60, 340, 700, 1100, 1560, 2000, 2460, 2880, 3200].forEach(x => this._espelho(g, x, fy));

    // Bancos como plataformas (mais deles, mais distribuídos)
    [
      { x: 200, y: fy - 60, w: 100 },
      { x: 520, y: fy - 80, w: 120 },
      { x: 820, y: fy - 55, w: 100 },
      { x: 1150, y: fy - 75, w: 110 },
      { x: 1460, y: fy - 60, w: 100 },
      { x: 1750, y: fy - 80, w: 120 },
      { x: 2080, y: fy - 60, w: 100 },
      { x: 2380, y: fy - 75, w: 110 },
      { x: 2700, y: fy - 55, w: 100 },
      { x: 3000, y: fy - 70, w: 120 },
    ].forEach(b => {
      g.fillStyle(0x1a1228);
      g.fillRect(b.x, b.y, b.w, 18);
      g.fillStyle(0x2a1a3a);
      g.fillRect(b.x, b.y, b.w, 4);
      g.fillStyle(0x111118);
      g.fillRect(b.x + 8, b.y + 18, 10, 42);
      g.fillRect(b.x + b.w - 18, b.y + 18, 10, 42);
      const plat = this.add.rectangle(b.x + b.w / 2, b.y + 9, b.w, 18).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Barras no teto (onde screech anda)
    for (let x = 150; x < W - 100; x += 320) {
      g.fillStyle(0x1a1a22);
      g.fillRect(x, 28, 160, 8);
      g.fillStyle(0x2a2a38);
      g.fillRect(x, 28, 160, 2);
    }

    // Porta (oculta até abrir)
    this.portaGfx = this.add.graphics().setDepth(2);
    const px = W - 80, dw = 55, dh = 95, dy = fy - dh;
    this.portaGfx.fillStyle(COLORS.doorFrame);
    this.portaGfx.fillRect(px - 4, dy - 6, dw + 8, dh + 8);
    this.portaGfx.fillStyle(COLORS.door);
    this.portaGfx.fillRect(px, dy, dw, dh);
    this.portaGfx.lineStyle(1, COLORS.highlight, 0.3);
    this.portaGfx.strokeRect(px + 5, dy + 5, dw - 10, (dh - 15) / 2);
    this.portaGfx.fillStyle(COLORS.doorGlow);
    this.portaGfx.fillCircle(px + dw - 10, dy + dh / 2, 4);
    this.portaGfx.setAlpha(0);

    this.textPorta = this.add.text(W - 55, fy - 115, '005', {
      fontSize: '13px', fontFamily: 'Courier New',
      color: '#bb99ff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(3).setAlpha(0);

    this.exitZone = this.add.zone(W - 55, fy - 48, 55, 95);
    this.physics.add.existing(this.exitZone, true);
  }

  _esteira(g, x, fy) {
    g.fillStyle(0x111118);
    g.fillRect(x, fy - 55, 120, 55);
    g.fillStyle(0x1a1a28);
    g.fillRect(x + 8, fy - 48, 104, 38);
    g.fillStyle(0x222230);
    g.fillRect(x + 8, fy - 22, 104, 4);
    g.fillStyle(0x333344);
    g.fillRect(x + 90, fy - 52, 22, 30);
    g.fillStyle(0x1155aa, 0.6);
    g.fillRect(x + 94, fy - 49, 14, 6);
  }

  _halteres(g, x, fy) {
    g.fillStyle(0x222233);
    g.fillRect(x, fy - 18, 12, 18);
    g.fillRect(x + 24, fy - 18, 12, 18);
    g.fillRect(x + 12, fy - 14, 12, 10);
    g.fillStyle(0x333344);
    g.fillRect(x, fy - 18, 12, 4);
    g.fillRect(x + 24, fy - 18, 12, 4);
  }

  _espelho(g, x, fy) {
    g.fillStyle(0x0d1520, 0.8);
    g.fillRect(x, fy - 220, 60, 180);
    g.lineStyle(2, 0x2233aa, 0.5);
    g.strokeRect(x, fy - 220, 60, 180);
  }

  // ── BAÚ DOURADO ───────────────────────────────────────────
  // Posicionado a ~40% do mapa — acessível mas exige exploração
  criarBau() {
    const bx = Math.round(this.worldWidth * 0.40);
    const by = this.floorY - 52;
    const fy = this.floorY;

    const g = this.add.graphics().setDepth(3);

    // Sombra
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(bx + 22, fy - 4, 64, 12);

    // Base azul
    g.fillStyle(0x1a3a8a);
    g.fillRect(bx, by + 20, 44, 32);

    // Tampa azul
    g.fillStyle(0x2255bb);
    g.fillRect(bx, by, 44, 22);
    g.fillStyle(0x2a66cc);
    g.fillEllipse(bx + 22, by, 44, 14);

    // Faixas douradas
    g.fillStyle(0xddaa00);
    g.fillRect(bx + 19, by, 6, 52);
    g.fillRect(bx, by + 18, 44, 5);
    g.fillRect(bx, by, 6, 52);
    g.fillRect(bx + 38, by, 6, 52);

    // Cadeado
    g.fillStyle(0xffcc00);
    g.fillRect(bx + 17, by + 21, 10, 9);
    g.lineStyle(2.5, 0xffcc00);
    g.beginPath();
    g.arc(bx + 22, by + 21, 5, Math.PI, 0);
    g.strokePath();

    // Rebites
    g.fillStyle(0xffdd44);
    [[bx + 3, by + 3], [bx + 3, by + 45], [bx + 41, by + 3], [bx + 41, by + 45]].forEach(([rx, ry]) => {
      g.fillCircle(rx, ry, 3);
    });

    // Brilho animado pulsante — ajuda a achar no escuro
    const glow = this.add.rectangle(bx + 22, by + 26, 80, 80, 0x3366ff, 0.10).setDepth(2);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.05, to: 0.22 },
      duration: 700, yoyo: true, repeat: -1
    });

    // Partículas douradas
    [0, 1, 2].forEach(i => {
      const spark = this.add.rectangle(bx + 5 + i * 17, by - 8 - i * 4, 3, 3, 0xffdd44).setDepth(3);
      this.tweens.add({
        targets: spark, y: spark.y - 14, alpha: 0,
        duration: 800 + i * 200, repeat: -1, delay: i * 300
      });
    });

    this.bauZone = this.add.zone(bx + 22, by + 26, 60, 60);
    this.physics.add.existing(this.bauZone, true);
    this.bauGfx = g;
    this.bauX = bx;
    this.bauY = by;
  }

  // Na Phase5Scene.js, no método abrirBau():

  abrirBau() {
    if (this.bauAberto) return;

    console.log("ABRINDO BAÚ!");
    this.bauAberto = true;

    // Redesenhar baú aberto
    const g = this.bauGfx, bx = this.bauX, by = this.bauY, fy = this.floorY;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(bx + 22, fy - 4, 64, 12);
    g.fillStyle(0x1a3a8a);
    g.fillRect(bx, by + 20, 44, 32);
    g.fillStyle(0xddaa00);
    g.fillRect(bx, by + 18, 44, 5);
    g.fillRect(bx, by + 18, 6, 34);
    g.fillRect(bx + 38, by + 18, 6, 34);
    g.fillRect(bx + 19, by + 18, 6, 34);
    g.fillStyle(0x2255bb);
    g.fillRect(bx - 4, by - 30, 52, 18);
    g.fillStyle(0x2a66cc);
    g.fillEllipse(bx + 22, by - 30, 52, 10);
    g.fillStyle(0xddaa00);
    g.fillRect(bx - 4, by - 30, 6, 18);
    g.fillRect(bx + 42, by - 30, 6, 18);
    g.fillStyle(0x8855aa, 0.5);
    g.fillRect(bx + 3, by + 22, 38, 26);

    // 🔥 CRIAR A CHAVE VISUAL DENTRO DO BAÚ 🔥
    // Chamar o método da BaseScene para criar a chave
    this.createHiddenKey(bx + 22, by + 35);

    // A chave agora aparece e o jogador precisa passar por cima para pegar
    // (o método createHiddenKey já configura tudo: visual, brilho, zona de coleta)

    // Mensagem indicando que a chave apareceu
    const msg = this.add.text(GAME_W / 2, GAME_H / 2 - 40, TEXTS.KEY_FOUND, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

    this.tweens.add({
      targets: msg,
      y: msg.y - 30,
      alpha: 0,
      duration: 2000,
      onComplete: () => msg.destroy()
    });
  }
  // ── SCREECH ───────────────────────────────────────────────
  criarScreech() {
    const x = Phaser.Math.Between(GAME_W * 0.6, this.worldWidth * 0.85);
    const container = this.add.container(x, 45).setDepth(19);

    const corpo = this.add.ellipse(0, 0, 30, 20, 0x0d0505);
    corpo.setStrokeStyle(1.5, 0x880000);

    const patas = this.add.graphics();
    patas.lineStyle(1, 0x660000, 0.8);
    [[-18, -8], [-22, 0], [-18, 8], [18, -8], [22, 0], [18, 8]].forEach(([px, py]) => {
      patas.beginPath(); patas.moveTo(0, 0); patas.lineTo(px, py); patas.strokePath();
    });

    const olhoE = this.add.ellipse(-6, -2, 7, 9, 0xff0000);
    const olhoD = this.add.ellipse(6, -2, 7, 9, 0xff0000);
    const pupE = this.add.ellipse(-6, -2, 3, 5, 0x220000);
    const pupD = this.add.ellipse(6, -2, 3, 5, 0x220000);

    container.add([patas, corpo, olhoE, olhoD, pupE, pupD]);

    container.vx = Phaser.Math.Between(18, 32) * (Math.random() < 0.5 ? 1 : -1);
    container.vy = Phaser.Math.Between(5, 12) * (Math.random() < 0.5 ? 1 : -1);

    this.tetoTween = this.tweens.add({
      targets: container, y: 52,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    return container;
  }

  // ── UPDATE ────────────────────────────────────────────────
  update(time, delta) {
    if (this.transitioning) return;

    this.handleMovement();
    this.drawPlayer();

    if (!this.screechDerrotado) {
      this.moverScreech(delta);
      this.atualizarTimer(delta);
      this.verificarLanterna();
    }

    if (this.portaAberta && this.isNear(this.exitZone)) {
      if (this.keyFound) {
        this.transitionTo('FinalScene');
      } else {
        this.showLockedMessage();
      }
    }

    if (!this.bauAberto && this.isNear(this.bauZone) && !this.activePrompt) {
      this.createPrompt('[E] Abrir baú', -70, '#ffdd44');
    } else if ((this.bauAberto || !this.isNear(this.bauZone)) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }

    if (this.portaAberta && this.isNear(this.exitZone) && !this.activePrompt) {
      this.createPrompt(this.keyFound ? TEXTS.ENTER : TEXTS.NEED_KEY, -70,
        this.keyFound ? '#ffdd44' : '#ff6666');
    }

    // Lanterna — sempre por último
    this.desenharLanterna();
  }

  handleInteract() {
    if (this.transitioning) return;
    if (!this.bauAberto && this.isNear(this.bauZone)) this.abrirBau();
  }

  // ── MOVE SCREECH ──────────────────────────────────────────
  moverScreech(delta) {
    const dt = delta / 1000;

    if (this.screechAtacando) {
      const dx = this.player.x - this.screechObj.x;
      const dy = this.player.y - this.screechObj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 20) {
        // Velocidade aumenta a cada ciclo de ataque (mais agressivo)
        const velocidade = 160 + this.cicloAtaque * 25;
        this.screechObj.x += (dx / dist) * velocidade * dt;
        this.screechObj.y += (dy / dist) * velocidade * dt;
      } else {
        this.screechAtacando = false;
        this.aplicarDanoAtaque();
      }
    } else {
      this.screechObj.x += this.screechObj.vx * dt;
      this.screechObj.y += this.screechObj.vy * dt;

      if (this.screechObj.x < 40 || this.screechObj.x > this.worldWidth - 40)
        this.screechObj.vx *= -1;
      if (this.screechObj.y < 35 || this.screechObj.y > 85)
        this.screechObj.vy *= -1;

      this.screechObj.y = Phaser.Math.Clamp(this.screechObj.y, 35, 85);
    }
  }

  // ── TIMER PROPORCIONAL ────────────────────────────────────
  // Ciclo 0: 30s | Ciclo 1: 22s | Ciclo 2: 16s | Ciclo 3+: 12s
  atualizarTimer(delta) {
    if (this.punicaoAplicada || this.screechAtacando) return;
    this.tempoPassado += delta;

    if (this.tempoPassado >= this.tempoLimite) {
      this.punicaoAplicada = true;
      this.cicloAtaque++;

      if (this.tetoTween) this.tetoTween.stop();
      this.screechAtacando = true;

      // Som + flash vermelho imediato ao iniciar ataque
      try { this.sound.play('screech_jumpscare', { volume: 1.5 }); } catch (e) { }

      const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff0000, 0.55)
        .setScrollFactor(0).setDepth(60);
      this.tweens.add({
        targets: flash, alpha: 0, duration: 800,
        onComplete: () => flash.destroy()
      });
    }
  }

  // ── DANO ──────────────────────────────────────────────────
  aplicarDanoAtaque() {
    const morreu = GameState.damage(2);

    if (morreu) {
      this.time.delayedCall(900, () => this.transitionTo('GameOverScene'));
      return;
    }

    // Screech volta ao teto
    this.time.delayedCall(400, () => {
      if (!this.screechObj) return;
      this.screechObj.x = Phaser.Math.Between(300, this.worldWidth - 300);
      this.screechObj.y = 45;
      this.screechObj.alpha = 1;

      this.tetoTween = this.tweens.add({
        targets: this.screechObj, y: 52,
        duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      // Próximo timer: 30s → 22s → 16s → 12s (mínimo)
      const limites = [30000, 22000, 16000, 12000];
      this.tempoLimite = limites[Math.min(this.cicloAtaque, limites.length - 1)];
      this.tempoPassado = 0;
      this.punicaoAplicada = false;
    });
  }

  // ── LANTERNA MATA INSTANTANEAMENTE ────────────────────────
  verificarLanterna() {
    if (this.screechDerrotado) return;

    const cam = this.cameras.main;
    const screenX = this.screechObj.x - cam.scrollX;
    const screenY = this.screechObj.y - cam.scrollY;
    const dx = this.input.x - screenX;
    const dy = this.input.y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 90 + 35) {
      this.derrotarScreech();
    }
  }

  derrotarScreech() {
    if (this.screechDerrotado) return;
    this.screechDerrotado = true;
    this.screechAtacando = false;

    if (this.tetoTween) this.tetoTween.stop();

    this.tweens.add({
      targets: this.screechObj,
      alpha: 0, scaleX: 2.5, scaleY: 2.5, duration: 400,
      onComplete: () => { if (this.screechObj) this.screechObj.destroy(); }
    });

    this.time.delayedCall(500, () => {
      this.portaAberta = true;
      this.portaGfx.setAlpha(1);
      this.textPorta.setAlpha(1);
      this.mostrarAviso('✅ Screech derrotado! Encontre a saída.', 3000);
    });
  }

  // ── LANTERNA: mouse + luz ao redor do player ──────────────
  desenharLanterna() {
    const cam = this.cameras.main;

    // Posição do player na tela
    const px = this.player.x - cam.scrollX;
    const py = this.player.y - cam.scrollY;

    this.lantGfx.clear();
    this.lantGfx.fillStyle(0xffffff);

    // Círculo da lanterna (mouse) — raio 95
    this.lantGfx.fillCircle(this.input.x, this.input.y, 95);

    // Luz ao redor do player — raio 70 (pequena penumbra)
    this.lantGfx.fillCircle(px, py - 20, 70);
  }

  mostrarAviso(texto, duracao) {
    this.textoAviso.setText(texto);
    this.time.delayedCall(duracao, () => {
      if (this.textoAviso) this.textoAviso.setText('');
    });
  }
}

// =============================================
//  CENA: FASE FINAL - BIBLIOTECA (COM DECORAÇÕES)
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
    this.createCandles();

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
    const floor = this.add.rectangle(this.worldWidth / 2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Estantes como plataformas
    const shelves = [
      { x: 50, y: 320, w: 160 }, { x: 350, y: 260, w: 160 },
      { x: 650, y: 300, w: 160 }, { x: 700, y: 200, w: 120 }
    ];

    shelves.forEach(s => {
      // Estante
      g.fillStyle(0x1a0e05);
      g.fillRect(s.x, s.y, s.w, GAME_H - 60 - s.y);
      g.fillStyle(0x2a1a08);
      g.fillRect(s.x, s.y, s.w, 14);

      // Livros
      const bookColors = [0x8b0000, 0x006400, 0x00008b, 0x8b6914, 0x4b0082, 0x8b4513];
      for (let bx = s.x + 4; bx < s.x + s.w - 4; bx += 12) {
        g.fillStyle(bookColors[Math.floor((bx / 12) % bookColors.length)], 0.8);
        g.fillRect(bx, s.y - 20, 10, 20);
        g.fillStyle(0xffffff, 0.1);
        g.fillRect(bx + 2, s.y - 18, 1, 16);
      }

      const plat = this.add.rectangle(s.x + s.w / 2, s.y + 8, s.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Estantes de parede (decorativas)
    for (let x = 0; x < this.worldWidth; x += 120) {
      g.fillStyle(0x120a04, 0.8);
      g.fillRect(x, 30, 110, this.floorY - 200);
      g.fillStyle(0x1e1008, 0.5);
      g.fillRect(x, 30, 110, 3);

      for (let by = 50; by < this.floorY - 200; by += 30) {
        for (let bx = x + 4; bx < x + 106; bx += 12) {
          const bc = [0x6b0000, 0x005000, 0x00006b, 0x6b5014, 0x3b0062][Math.floor((bx * by / 100) % 5)];
          g.fillStyle(bc, 0.6);
          g.fillRect(bx, by, 10, 26);
        }
      }
    }

    // A porta final (trancada)
    const dx = GAME_W / 2 - 30, dy = this.floorY - 110;
    g.fillStyle(0x2a1a00);
    g.fillRect(dx - 4, dy - 6, 68, 116);
    g.fillStyle(0x1a0e00);
    g.fillRect(dx, dy, 60, 110);
    g.lineStyle(2, 0x886600, 0.5);
    g.strokeRect(dx, dy, 60, 110);

    // Cadeado
    g.fillStyle(0x775500);
    g.fillRect(dx + 22, dy + 50, 16, 14);
    g.lineStyle(3, 0x886600, 0.8);
    g.beginPath();
    g.arc(dx + 30, dy + 50, 7, Math.PI, 0);
    g.strokePath();

    this.add.text(GAME_W / 2, dy - 20, 'DOOR 100', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#553300',
      letterSpacing: 2
    }).setOrigin(0.5);
  }

  createCandles() {
    const g = this.add.graphics();
    const positions = [120, 280, 480, 620, 780];

    positions.forEach(x => {
      // Vela
      g.fillStyle(0xeeeecc, 0.9);
      g.fillRect(x - 2, this.floorY - 25, 4, 25);
      g.fillStyle(0xffdd44, 0.8);
      g.fillCircle(x, this.floorY - 27, 5);

      // Brilho
      const glow = this.add.rectangle(x, this.floorY - 30, 20, 20, 0xffdd44, 0.08);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.04, to: 0.14 },
        duration: Phaser.Math.Between(400, 700),
        yoyo: true,
        repeat: -1
      });
    });
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
      g.fillStyle(0x2a2010);
      g.fillRect(p.x - 22, this.floorY - 60, 44, 8);
      g.fillStyle(0x3a3018);
      g.fillRect(p.x - 18, this.floorY - 55, 36, 4);

      // Orbe brilhante
      g.fillStyle(0x4444aa, 0.6);
      g.fillCircle(p.x, this.floorY - 70, 12);
      g.fillStyle(0x8888ff, 0.4);
      g.fillCircle(p.x, this.floorY - 70, 7);

      const orbGlow = this.add.rectangle(p.x, this.floorY - 70, 28, 28, 0x6666ff, 0.08).setDepth(3);
      this.tweens.add({
        targets: orbGlow,
        alpha: { from: 0.04, to: 0.15 },
        duration: 900,
        yoyo: true,
        repeat: -1
      });

      // Número
      this.add.text(p.x, this.floorY - 95, `[${i + 1}]`, {
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
      this.interactHint = this.add.text(GAME_W / 2, GAME_H - 90, '[E] Examinar', {
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
    this.overlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(30);

    // Caixa do puzzle
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 400, 250, 0x0e0e1a)
      .setScrollFactor(0).setDepth(31);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 400, 250, 0x0, 0)
      .setStrokeStyle(2, 0x4444aa).setScrollFactor(0).setDepth(32);

    // Conteúdo
    this.add.text(GAME_W / 2, GAME_H / 2 - 80, '-- ENIGMA --', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#8888cc',
      letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W / 2, GAME_H / 2 - 40, puzzle.code, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 2,
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W / 2, GAME_H / 2, puzzle.hint, {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#445566',
      letterSpacing: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W / 2 - 60, GAME_H / 2 + 40, 'RESPOSTA:', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#6666aa',
      letterSpacing: 1
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);

    this.answerText = '';
    this.answerDisplay = this.add.text(GAME_W / 2 + 20, GAME_H / 2 + 40, '_', {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(32);

    this.feedbackText = this.add.text(GAME_W / 2, GAME_H / 2 + 80, '', {
      fontSize: '12px',
      fontFamily: 'Courier New',
      color: '#ff5555',
      letterSpacing: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

    this.add.text(GAME_W / 2, GAME_H / 2 + 108, 'ENTER confirmar  |  ESC cancelar', {
      fontSize: '9px',
      fontFamily: 'Courier New',
      color: '#333355',
      letterSpacing: 1
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
      const msg = this.add.text(GAME_W / 2, GAME_H / 2 - 20, `${remaining} enigma(s) restante(s)...`, {
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

    const unlock = this.add.text(GAME_W / 2, GAME_H / 2, '✓ PORTA DESTRANCADA!', {
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
      this.interactHint = this.add.text(GAME_W / 2, GAME_H - 90, '[E] Examinar', {
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
    GameState.reset();

    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(700, 0, 0, 0);

    this.add.text(GAME_W / 2, GAME_H / 2 - 80, TEXTS.GAME_OVER, {
      fontSize: '52px',
      fontFamily: 'Courier New',
      color: '#ff4444',
      letterSpacing: 8
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 - 10, TEXTS.TRY_AGAIN, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#cc7777',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 + 30, 'ou aguarde 5 segundos...', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#664444',
      letterSpacing: 2
    }).setOrigin(0.5);

    // Barra de progresso
    this.add.rectangle(GAME_W / 2, GAME_H / 2 + 75, 302, 12, 0x331111);
    const bar = this.add.rectangle(GAME_W / 2 - 150, GAME_H / 2 + 75, 1, 12, 0xff4444).setOrigin(0, 0.5);
    this.tweens.add({
      targets: bar,
      width: 300,
      duration: 5000,
      ease: 'Linear',
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
//  CENA: VITÓRIA
// =============================================
class WinScene extends Phaser.Scene {
  constructor() { super({ key: 'WinScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#050508');
    this.cameras.main.fadeIn(1200, 0, 0, 0);

    // Confetes
    const g = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const cx = Phaser.Math.Between(0, GAME_W);
      const cy = Phaser.Math.Between(0, GAME_H);
      const cc = [0xffdd44, 0xff6688, 0x66ffaa][i % 3];
      g.fillStyle(cc, Phaser.Math.FloatBetween(0.3, 0.8));
      g.fillRect(cx, cy, Phaser.Math.Between(4, 10), Phaser.Math.Between(4, 10));
    }

    // Porta brilhante
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(GAME_W / 2 - 34, GAME_H / 2 - 150, 68, 115);
    g.fillStyle(0x000000, 0.1);
    g.fillRect(GAME_W / 2 - 30, GAME_H / 2 - 146, 60, 110);

    const light = this.add.rectangle(GAME_W / 2, GAME_H / 2 - 95, 80, 130, 0xffeedd, 0.15);
    this.tweens.add({
      targets: light,
      alpha: { from: 0.08, to: 0.25 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.add.text(GAME_W / 2, GAME_H / 2 - 10, TEXTS.WIN, {
      fontSize: '52px',
      fontFamily: 'Courier New',
      color: '#ffdd44',
      letterSpacing: 8
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 + 55, 'Você chegou à Porta 100!', {
      fontSize: '16px',
      fontFamily: 'Courier New',
      color: '#c0aae8',
      letterSpacing: 3
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 + 90, TEXTS.BIRTHDAY, {
      fontSize: '18px',
      fontFamily: 'Courier New',
      color: '#ff88aa',
      letterSpacing: 4
    }).setOrigin(0.5);

    const restart = this.add.text(GAME_W / 2, GAME_H / 2 + 140, '[ R ] Jogar novamente', {
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