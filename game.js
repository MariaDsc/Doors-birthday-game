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
  PHASE_FINAL: 'FASE FINAL - BIBLIOTECA'
};

// Estado global do jogo
const GameState = {
  health: 4,
  door: 1,

  damage(amount = 1, scene = null) {
    const perdidos = this.health - Math.max(0, this.health - amount);
    this.health = Math.max(0, this.health - amount);
    this.updateUI();

    if (scene) {
      for (let i = 0; i < perdidos; i++) {
        scene.time.delayedCall(i * 180, () => {
          scene.sound.play('damage_sound', { volume: 1.0 });
        });
      }
    }

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
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
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
    const cam = this.cameras.main;
    const sx = (this.player.x - cam.scrollX) * cam.zoom;
    const sy = (this.player.y - cam.scrollY) * cam.zoom + yOffset;
    this.activePrompt = this.add.text(sx, sy, text, {
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
      const cam = this.cameras.main;
      this.activePrompt.x = (this.player.x - cam.scrollX) * cam.zoom;
      this.activePrompt.y = (this.player.y - cam.scrollY) * cam.zoom - 70;
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
    this.load.audio('musica_fase1', ['assets/audio/fase1.ogg', 'assets/audio/fase1.ogg']);
    this.load.audio('musica_fase2', ['assets/audio/fase2.mp3', 'assets/audio/fase2.mp3']);
    this.load.audio('musica_fase3', ['assets/audio/fase3.mp3', 'assets/audio/fase3.mp3']);
    this.load.audio('music_final', ['assets/audio/library.mp3', 'assets/audio/library.mp3']);
    this.load.audio('musica_win', ['assets/audio/win.mp3', 'assets/audio/win.mp3']);
    this.load.audio('musica_gameover', ['assets/audio/game_over.mp3', 'assets/audio/game_over.mp3']);

    //efeitos sonoros
    this.load.audio('som_chave', 'assets/audio/key.ogg');
    this.load.audio('som_porta', 'assets/audio/door.ogg');
    this.load.audio('som_gaveta', 'assets/audio/drawer.mp3');
    this.load.audio('psst', 'assets/audio/psst.mp3');
    this.load.audio('screech_jumpscare', 'assets/audio/screech jumpscare.mp3');
    this.load.audio('figure_grunt_far', 'assets/audio/grunt_far.mp3');
    this.load.audio('figure_grunt_medium', 'assets/audio/grunt_medium.mp3');
    this.load.audio('figure_grunt_close', 'assets/audio/grunt_near.mp3');
    this.load.audio('figure_stomps', 'assets/audio/stomps.mp3');
    this.load.audio('figure_jumpscare', 'assets/audio/figure_jumpscare.mp3');
    this.load.audio('damage_sound', ['assets/audio/damage.mp3', 'assets/audio/damage.mp3']);
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
      this.time.delayedCall(620, () => this.scene.start('Phase1Scene'));
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
    this.worldWidth = 5600;
    this.s = 1.5;
  }

  init() {
    super.init();
    this.worldWidth = 5600;
    this.floorY = GAME_H - 30;
    this.passingThrough = false;
    this.currentWall = 1;
  }

  create() {
    super.create();
    this.player.setPosition(80, this.floorY - 50);
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
    this.jeremiahSpeed = 120 * this.s;
    this.jeremiahLooking = false;
    this.hitCooldown = false;
    this.inWardrobe = false;
    this.keyFound = false;
    this.keyZone = null;
    this.keyGfx = null;
    this.keyGlow = null;
    this.keyWorldX = null;
    this.keyWorldY = null;

    if (this.currentWall === 4) {
      this.player.body.setSize(24, 40);
    } else {
      this.player.body.setSize(36, 60);
    }

    this.buildKitchen();
    this.buildStoveWall();
    this.buildPantryWall();
    this.buildMansionFacade();

    // Zonas de transição
    this.zoneW1toW2 = this.add.zone(1390, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW1toW2, true);
    this.zoneW2toW1 = this.add.zone(1410, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW2toW1, true);
    this.zoneW2toW3 = this.add.zone(2790, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW2toW3, true);
    this.zoneW3toW2 = this.add.zone(2810, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW3toW2, true);
    this.zoneW3toW4 = this.add.zone(4160, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW3toW4, true);
    this.zoneW4toW3 = this.add.zone(4240, this.floorY - 150, 10, 300);
    this.physics.add.existing(this.zoneW4toW3, true);

    this.createJeremiah();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.jeremiah, this.platforms);

    // Sorteia qual gaveta esconde a chave
    this.assignKeyToRandomDrawer();
  }

  // ─── SORTEIA A GAVETA COM A CHAVE (só wall 2 e 3) ─
  assignKeyToRandomDrawer() {
    const eligible = this.drawers.filter(d => d.wall === 2 || d.wall === 3);
    if (eligible.length === 0) return;
    const idx = Phaser.Math.Between(0, eligible.length - 1);
    eligible[idx].hasKey = true;
  }

  // ─── COLETA A CHAVE ───────────────────────────────
  collectKey() {
    if (this.keyFound) return;
    this.keyWorldX = null;
    this.keyWorldY = null;
    super.collectKey(); // destrói keyGfx e keyGlow, marca keyFound, toca som, mostra mensagem
    this.keyGfx = null;
    this.keyGlow = null;
  }

  drawPlayer() {
    const x = this.player.x;
    const y = this.player.y;
    const g = this.playerGfx;
    g.clear();

    const s = this.currentWall <= 3 ? 1.5 : 1.0;

    this.playerShadow.clear();
    this.playerShadow.fillStyle(0x000000, 0.25);
    this.playerShadow.fillEllipse(x, this.floorY - 2, 50 * s, 14 * s);
    g.fillStyle(COLORS.player);
    g.fillRect(x - 15 * s, y - 55 * s, 30 * s, 40 * s);
    g.fillRect(x - 13 * s, y - 82 * s, 26 * s, 26 * s);
    g.fillStyle(COLORS.playerEye);
    const eyeX = this.facingLeft ? x - 7 * s : x + 3 * s;
    g.fillRect(eyeX, y - 75 * s, 6 * s, 6 * s);
    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 12 * s, y - 14 * s, 10 * s, 16 * s);
    g.fillRect(x + 2 * s, y - 14 * s, 10 * s, 16 * s);
    g.fillRect(x - 20 * s, y - 52 * s, 7 * s, 28 * s);
    g.fillRect(x + 13 * s, y - 52 * s, 7 * s, 28 * s);
  }

  // ─── PAREDE 1: COZINHA  (X: 0 → 1400) ────────────
  buildKitchen() {
    const g = this.add.graphics().setDepth(1);
    const ch = 75;
    const topMargin = 55;

    g.fillStyle(0xadebb3);
    g.fillRect(0, 0, 1400, GAME_H);
    g.fillStyle(0x081828, 0.55);
    g.fillRect(0, 0, 1400, GAME_H);

    g.fillStyle(0xc8d4dc);
    g.fillRect(0, 0, 1400, 22);
    [120, 340, 560, 780, 1000, 1220].forEach(x => {
      g.fillStyle(0xb8c4cc);
      g.fillRect(x, 0, 20, 22);
    });

    g.fillStyle(0x0a0806);
    g.fillRect(0, this.floorY, 1400, 8);
    g.fillStyle(0x060504, 0.9);
    g.fillRect(0, this.floorY + 8, 1400, 72);
    const floor = this.add.rectangle(700, this.floorY + 30, 1400, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

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

    const aereoY = topMargin + 35;
    const aereoH = 210;
    g.fillStyle(0xd8e0e8);
    g.fillRect(142, aereoY, 380, aereoH);
    const trapHEsq = 20;
    g.fillStyle(0xd8e0e8);
    g.fillPoints([
      { x: 142, y: aereoY - trapHEsq },
      { x: 142 + 380 + 14, y: aereoY - trapHEsq },
      { x: 142 + 380, y: aereoY },
      { x: 142, y: aereoY }
    ], true);
    const totalCols = 4, totalRows = 3;
    const padX = 10, padYTop = 26, padYBot = 16, gapX = 8, gapY = 3;
    const vw = (380 - padX * 2 - gapX * (totalCols - 1)) / totalCols;
    const vh = (aereoH - padYTop - padYBot - gapY * (totalRows - 1)) / totalRows;
    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < totalRows; row++) {
        const vx = 142 + padX + col * (vw + gapX);
        const vy = aereoY + padYTop + row * (vh + gapY);
        g.fillStyle(0x050e1c, 0.35);
        if (row === 0 && col === 0) {
          g.fillRoundedRect(vx, vy, vw, vh, { tl: 26, tr: 0, bl: 0, br: 0 });
          g.strokeRoundedRect(vx, vy, vw, vh, { tl: 26, tr: 0, bl: 0, br: 0 });
        } else if (row === 0 && col === totalCols - 1) {
          g.fillRoundedRect(vx, vy, vw, vh, { tl: 0, tr: 26, bl: 0, br: 0 });
          g.strokeRoundedRect(vx, vy, vw, vh, { tl: 0, tr: 26, bl: 0, br: 0 });
        } else {
          g.fillRect(vx, vy, vw, vh);
          g.lineStyle(1, 0xc8d4dc);
          g.strokeRect(vx, vy, vw, vh);
        }
        g.lineStyle(1, 0xc8d4dc);
        if (row === 0) g.strokeRoundedRect(vx, vy, vw, vh, { tl: 5, tr: 5, bl: 0, br: 0 });
        else g.strokeRect(vx, vy, vw, vh);
      }
    }
    g.lineStyle(2, 0xb8c4cc);
    g.strokeRect(142 + 4, aereoY + 4, 380 - 8, aereoH - 8);
    g.fillStyle(0x8898a8);
    g.fillRect(142, aereoY + aereoH, 5, 26);
    g.fillRect(517, aereoY + aereoH, 5, 26);

    const winX = 560, winY = topMargin + 5, winW = 240, winH = 275;
    g.fillStyle(0x040b18);
    g.fillRect(winX, winY, winW, winH);
    [[570, winY + 12], [590, winY + 22], [614, winY + 8], [640, winY + 26],
    [666, winY + 14], [692, winY + 32], [718, winY + 10], [742, winY + 24],
    [570, winY + 75], [597, winY + 90], [630, winY + 65], [660, winY + 82],
    [687, winY + 72], [717, winY + 88], [744, winY + 60], [770, winY + 78]].forEach(([sx, sy]) => {
      g.fillStyle(0xffffff, 0.75);
      g.fillCircle(sx, sy, 1.5);
    });
    g.fillStyle(0xfffde0);
    g.fillCircle(740, winY + 25, 18);
    g.fillStyle(0x060e08);
    g.fillTriangle(562, winY + winH, 617, winY + winH, 589, winY + winH - 70);
    g.fillTriangle(600, winY + winH, 658, winY + winH, 629, winY + winH - 85);
    g.fillTriangle(677, winY + winH, 734, winY + winH, 705, winY + winH - 72);
    g.fillTriangle(717, winY + winH, 778, winY + winH, 747, winY + winH - 88);
    g.fillRect(585, winY + winH - 82, 7, 82);
    g.fillRect(625, winY + winH - 98, 7, 98);
    g.fillRect(701, winY + winH - 84, 7, 84);
    g.fillStyle(0xd8e4ec);
    g.fillRect(winX - 10, winY - 8, winW + 20, 10);
    g.fillRect(winX - 10, winY + winH, winW + 20, 10);
    g.fillRect(winX - 10, winY - 8, 10, winH + 18);
    g.fillRect(winX + winW, winY - 8, 10, winH + 18);
    g.fillRect(winX + winW / 2 - 4, winY, 8, winH);
    g.fillRect(winX + winW / 4 - 4, winY, 8, winH / 2 - 3);
    g.fillRect(winX + winW / 4 * 3 - 4, winY, 8, winH / 2 - 3);
    g.fillRect(winX, winY + winH / 2 - 3, winW, 6);
    g.fillStyle(0xc8d4dc);
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

    const shelf1X = 834, aereoHDir = 210, aereoYDir = aereoY, shelf1W = 160;
    const trapH = 20, bodyY = aereoYDir + trapH;
    g.fillStyle(0xd8e0e8);
    g.fillPoints([
      { x: shelf1X - 14, y: aereoYDir },
      { x: shelf1X + shelf1W + 14, y: aereoYDir },
      { x: shelf1X + shelf1W, y: bodyY },
      { x: shelf1X, y: bodyY }
    ], true);
    g.fillRect(shelf1X, bodyY, shelf1W, aereoHDir);
    const frameT = 12;
    g.fillStyle(0xd8e0e8);
    g.fillRect(shelf1X, bodyY, shelf1W, frameT);
    g.fillRect(shelf1X, bodyY + aereoHDir - frameT, shelf1W, frameT);
    g.fillRect(shelf1X, bodyY, frameT, aereoHDir);
    g.fillRect(shelf1X + shelf1W - frameT, bodyY, frameT, aereoHDir);
    const divT = 20;
    g.fillRect(shelf1X + shelf1W / 2 - divT / 2, bodyY + frameT, divT, aereoHDir - frameT * 2);
    const s1Cols = 2, s1Rows = 2, divTH = 2, s1GapX = 4, s1GapY = 4;
    const groupW = (shelf1W - frameT * 2 - divT) / 2;
    const groupH = (aereoHDir - frameT * 2) / 2 - divTH / 2;
    const s1vw = (groupW - s1GapX * (s1Cols - 1)) / s1Cols;
    const s1vh = (groupH - s1GapY * (s1Rows - 1)) / s1Rows;
    g.lineStyle(1, 0xc8d4dc);
    g.strokeRect(shelf1X + frameT, bodyY + aereoHDir / 2 - 1, shelf1W - frameT * 2, 1);
    [shelf1X + frameT, shelf1X + frameT + groupW + divT].forEach(groupX => {
      for (let col = 0; col < s1Cols; col++) for (let row = 0; row < s1Rows; row++) {
        const vx = groupX + col * (s1vw + s1GapX), vy = bodyY + frameT + row * (s1vh + s1GapY);
        g.fillStyle(0x050e1c, 0.35); g.fillRect(vx, vy, s1vw, s1vh);
        g.lineStyle(1, 0xc8d4dc); g.strokeRect(vx, vy, s1vw, s1vh);
      }
      for (let col = 0; col < s1Cols; col++) for (let row = 0; row < s1Rows; row++) {
        const vx = groupX + col * (s1vw + s1GapX), vy = bodyY + aereoHDir / 2 + divTH / 2 + row * (s1vh + s1GapY);
        g.fillStyle(0x050e1c, 0.35); g.fillRect(vx, vy, s1vw, s1vh);
        g.lineStyle(1, 0xc8d4dc); g.strokeRect(vx, vy, s1vw, s1vh);
      }
      const midLineY = bodyY + aereoHDir / 2 + divTH / 2 + s1vh / 2;
      g.lineStyle(1, 0xc8d4dc); g.strokeRect(groupX, midLineY, groupW, 1);
    });
    g.fillStyle(0x8898a8);
    g.fillRect(shelf1X, bodyY + aereoHDir, 5, 26);
    g.fillRect(shelf1X + shelf1W - 5, bodyY + aereoHDir, 5, 26);

    g.fillStyle(0xa8b4c0);
    g.fillRect(140, this.floorY - ch, 870, ch);
    g.fillStyle(0xbcc8d4);
    g.fillRect(140, this.floorY - ch - 6, 870, 8);
    g.fillStyle(0x060e18, 0.3);
    g.fillRect(140, this.floorY - ch + 3, 870, 5);

    // GAVETAS INTERATIVAS — parede 1
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

      const dx = x;
      const dy = this.floorY - ch + 5;
      const dw = 85;
      const dh = ch - 8;
      const zone = this.add.zone(x + 42, dy + dh / 2, dw, dh);
      this.physics.add.existing(zone, true);
      this.drawers.push({
        zone, hasKey: false, searched: false, wall: 1,
        dx, dy, dw, dh
      });
    });

    [540, 640, 740, 840, 940].forEach(x => {
      g.fillStyle(0xd8e0e8);
      g.fillRect(x + 3, this.floorY - ch + 5, 88, ch - 8);
      g.lineStyle(1, 0xa8b4c0);
      g.strokeRect(x + 5, this.floorY - ch + 7, 84, ch - 12);
      g.fillStyle(0x9898a8);
      g.fillRect(x + 36, this.floorY - ch + 26, 22, 4);
    });

    const tornX = winX + winW / 2, tornY = this.floorY - ch - 2;
    g.fillStyle(0x9aaabb);
    g.fillRect(tornX - 14, tornY - 8, 28, 8);
    g.fillRect(tornX - 3, tornY - 30, 6, 24);
    g.fillRect(tornX - 3, tornY - 30, 22, 6);
    g.fillRect(tornX + 16, tornY - 30, 6, 14);
    g.fillStyle(0x7a8a9a);
    g.fillRect(tornX - 18, tornY - 28, 14, 4);

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

    const passX = 1080, passW = 320, pillarW = 18;
    g.fillStyle(0xd8e0e8);
    g.fillRect(passX, topMargin, pillarW, this.floorY - topMargin);
    g.fillRect(passX + passW - pillarW, topMargin, pillarW, this.floorY - topMargin);
    g.fillRect(passX, topMargin, passW, 20);
    g.fillStyle(0x040c18, 0.4);
    g.fillRect(passX + pillarW, topMargin + 20, passW - pillarW * 2, this.floorY - topMargin - 20);
    g.lineStyle(2, 0xb8c4cc);
    g.strokeRect(passX + 4, topMargin + 4, passW - 8, this.floorY - topMargin - 4);
  }

  // ─── PAREDE 2: FOGÃO  (X: 1400 → 2800) ───────────
  buildStoveWall() {
    const g = this.add.graphics().setDepth(1);
    const gFront = this.add.graphics().setDepth(2);
    const floorY = this.floorY;
    const topMargin = 55;
    const ch = 75;
    const counterTop = floorY - ch;

    const ox = 1400;
    const wallW = 1400;
    const centerX = ox + wallW / 2;

    g.fillStyle(0x8fa89a);
    g.fillRect(ox, 0, wallW, floorY);
    g.fillStyle(0x081828, 0.28);
    g.fillRect(ox, 0, wallW, floorY);

    g.fillStyle(0xd8e0e4);
    g.fillRect(ox, 0, wallW, 22);
    [ox + 120, ox + 340, ox + 560, ox + 780, ox + 1000, ox + 1220].forEach(x => {
      g.fillStyle(0xc8d0d4); g.fillRect(x, 0, 20, 22);
    });

    g.fillStyle(0x3a2010);
    g.fillRect(ox, floorY, wallW, 8);
    g.fillStyle(0x2a1a0e, 0.9);
    g.fillRect(ox, floorY + 8, wallW, 72);
    const floor2 = this.add.rectangle(ox + wallW / 2, floorY + 30, wallW, 60).setVisible(false);
    this.physics.add.existing(floor2, true);
    this.platforms.add(floor2);

    const stoveW = 260;
    const stoveX = centerX - stoveW / 2;
    const hoodW = 360;
    const hoodX = centerX - hoodW / 2;
    const hoodTopY = topMargin + 22;
    const hoodBodyH = 130;
    const hoodTrapH = 12;
    const hoodBotW = stoveW + 20;
    const hoodBotX = centerX - hoodBotW / 2;
    const hoodBotY = hoodTopY + hoodBodyH + hoodTrapH;

    const sideAereoW = 110;
    const sideAereoLX = hoodX - sideAereoW;
    const sideAereoRX = hoodX + hoodW;

    const passW = 170;
    const passLX = sideAereoLX - passW;
    const passRX = sideAereoRX + sideAereoW;

    const extLX = ox;
    const extLW = passLX - ox;
    const extRX = passRX + passW;
    const extRW = ox + wallW - extRX;

    [
      { ex: extLX, ew: extLW, mirror: false },
      { ex: extRX, ew: extRW, mirror: true }
    ].forEach(({ ex, ew, mirror }) => {
      if (ew <= 0) return;
      const cabinetH = floorY - topMargin;

      g.fillStyle(0xeae6de);
      g.fillRect(ex, topMargin, ew, cabinetH);
      g.lineStyle(3, 0xc8c4b8);
      g.strokeRect(ex + 4, topMargin + 4, ew - 8, cabinetH - 8);

      g.fillStyle(0xeae6de);
      g.fillRect(ex, topMargin, ew, 18);
      g.lineStyle(2, 0xc8c4b8);
      g.strokeRect(ex, topMargin, ew, 18);
      g.fillStyle(0xe0dcd4);
      g.fillRect(ex + 2, topMargin + 18, ew - 4, 4);

      const doorW = ew - 14;
      const doorX = ex + 7;
      const halfH = (cabinetH - 30) / 2;

      const door1Y = topMargin + 22;
      g.fillStyle(0xe8e4dc);
      g.fillRect(doorX, door1Y, doorW, halfH);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(doorX + 4, door1Y + 4, doorW - 8, halfH - 8);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRect(doorX + 10, door1Y + 10, doorW - 20, halfH - 20);

      const ph1x = ex + ew / 2;
      const ph1y = door1Y + halfH - 18;
      g.fillStyle(0xa8b0b8);
      g.fillRect(ph1x - 16, ph1y, 32, 6);
      g.fillStyle(0xb8c0c8);
      g.fillRect(ph1x - 18, ph1y - 3, 36, 4);

      g.fillStyle(0xe0dcd4);
      g.fillRect(ex + 4, topMargin + 22 + halfH, ew - 8, 6);

      const door2Y = door1Y + halfH + 6;
      const door2H = cabinetH - halfH - 30;
      g.fillStyle(0xe8e4dc);
      g.fillRect(doorX, door2Y, doorW, door2H);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(doorX + 4, door2Y + 4, doorW - 8, door2H - 8);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRect(doorX + 10, door2Y + 10, doorW - 20, door2H - 20);

      const ph2y = door2Y + 16;
      g.fillStyle(0xa8b0b8);
      g.fillRect(ph1x - 16, ph2y, 32, 6);
      g.fillStyle(0xb8c0c8);
      g.fillRect(ph1x - 18, ph2y - 3, 36, 4);
    });

    [
      { ax: sideAereoLX, mirror: false },
      { ax: sideAereoRX, mirror: true }
    ].forEach(({ ax, mirror }) => {
      const aw = sideAereoW;
      const aH = (counterTop - topMargin) - 90;
      const glassH = aH * 0.48;

      gFront.fillStyle(0xeae6de);
      gFront.fillRect(ax, topMargin, aw, aH);
      gFront.lineStyle(2, 0xc8c4b8);
      gFront.strokeRect(ax + 4, topMargin + 4, aw - 8, aH - 8);

      gFront.fillStyle(0xe0dcd4);
      gFront.fillRect(ax + 2, topMargin + 18, aw - 4, 3);

      const vidroW = (aw - 40) / 2;
      const vidroH = (glassH - 40) / 2;
      const inicioY = topMargin + 35;

      for (let linha = 0; linha < 2; linha++) {
        for (let coluna = 0; coluna < 2; coluna++) {
          const x = ax + 16 + (coluna * (vidroW + 8));
          const y = inicioY + (linha * (vidroH + 8));
          gFront.fillStyle(0x8aaabb, 0.3);
          gFront.fillRect(x, y, vidroW, vidroH);
          gFront.lineStyle(1, 0xaabccc, 0.5);
          gFront.strokeRect(x, y, vidroW, vidroH);
        }
      }

      const botY = topMargin + glassH + 15;
      const botH = aH - glassH - 18;
      gFront.fillStyle(0xe8e4dc);
      gFront.fillRect(ax + 5, botY, aw - 10, botH);
      gFront.lineStyle(2, 0xc8c4b8);
      gFront.strokeRect(ax + 9, botY + 4, aw - 18, botH - 8);
      gFront.lineStyle(1, 0xd8d4cc);
      gFront.strokeRect(ax + 14, botY + 9, aw - 28, botH - 18);
    });

    const corniceH = 50;
    const corniceW = hoodW;
    const corniceX = hoodX;
    const corniceY = topMargin - corniceH;
    gFront.fillStyle(0xeae6de);
    gFront.fillRect(corniceX, corniceY, corniceW, corniceH + 4);
    gFront.fillStyle(0xc8c4bc);
    gFront.fillRect(corniceX, topMargin - 4, corniceW, 4);

    gFront.fillStyle(0xeae6de);
    gFront.fillRect(hoodX - sideAereoW - 10, topMargin, sideAereoW * 2 + hoodW + 20, 20);
    gFront.fillRect(hoodX - sideAereoW - 10, topMargin, 10, floorY - topMargin);
    gFront.fillRect(hoodX + hoodW + sideAereoW, topMargin, 10, floorY - topMargin);

    gFront.fillStyle(0xeae6de);
    gFront.fillRect(hoodX, hoodTopY, hoodW, hoodBodyH);
    gFront.lineStyle(4, 0xd0ccC4);
    gFront.strokeRect(hoodX + 6, hoodTopY + 6, hoodW - 12, hoodBodyH - 12);
    gFront.lineStyle(2, 0xd8d4cc);
    gFront.strokeRect(hoodX + 14, hoodTopY + 14, hoodW - 28, hoodBodyH - 28);
    gFront.fillStyle(0xe2ddd5);
    gFront.fillRect(hoodX + 20, hoodTopY + 20, hoodW - 40, hoodBodyH - 40);

    const pCount = 3;
    const pMargin = 22;
    const pGap = 8;
    const pW = (hoodW - pMargin * 2 - pGap * (pCount - 1)) / pCount;
    const pH = hoodBodyH - 32;
    const pY = hoodTopY + 16;

    for (let i = 0; i < pCount; i++) {
      const px = hoodX + pMargin + i * (pW + pGap);
      gFront.fillStyle(0xb8b4ac);
      gFront.fillRect(px, pY, pW, pH);
      gFront.fillStyle(0xe8e4dc);
      gFront.fillRect(px + 3, pY + 3, pW - 6, pH - 6);
      gFront.lineStyle(2, 0xc8c4bc);
      gFront.strokeRect(px + 1, pY + 1, pW - 2, pH - 2);
      gFront.lineStyle(1, 0xd8d4cc);
      gFront.strokeRect(px + 6, pY + 6, pW - 12, pH - 12);
    }

    g.fillStyle(0xeae6de);
    gFront.fillPoints([
      { x: hoodX, y: hoodTopY + hoodBodyH },
      { x: hoodX + hoodW, y: hoodTopY + hoodBodyH },
      { x: hoodBotX + hoodBotW, y: hoodBotY },
      { x: hoodBotX, y: hoodBotY }
    ], true);
    gFront.lineStyle(2, 0xc8c4b8);
    gFront.strokePoints([
      { x: hoodX, y: hoodTopY + hoodBodyH },
      { x: hoodX + hoodW, y: hoodTopY + hoodBodyH },
      { x: hoodBotX + hoodBotW, y: hoodBotY },
      { x: hoodBotX, y: hoodBotY }
    ], true);

    gFront.fillStyle(0xa8b4bc);
    gFront.fillRect(hoodBotX, hoodBotY, hoodBotW, 6);

    const chNew = 95;
    const counterTopNew = floorY - chNew;

    const bancadaLX = sideAereoLX;
    const bancadaLW = stoveX - bancadaLX;
    const bancadaRX = stoveX + stoveW;
    const bancadaRW = sideAereoRX + sideAereoW - bancadaRX;

    [{ bx: bancadaLX, bw: bancadaLW }, { bx: bancadaRX, bw: bancadaRW }].forEach(({ bx, bw }) => {
      if (bw <= 0) return;

      const drawerH = chNew * 0.25;
      const drawerW = (bw - 10) / 2;

      gFront.fillStyle(0xf0ede6);
      gFront.fillRect(bx, counterTopNew - 6, bw, 6);
      gFront.fillStyle(0xe8e4dc);
      gFront.fillRect(bx, counterTopNew, bw, chNew);
      gFront.fillStyle(0x060e18, 0.12);
      gFront.fillRect(bx, counterTopNew + 4, bw, 4);

      for (let idx = 0; idx < 2; idx++) {
        const dxx = bx + 3 + idx * (drawerW + 4);
        const dyy = counterTopNew + 6;
        const dhh = drawerH;
        gFront.fillStyle(0xe8e4dc);
        gFront.fillRect(dxx, dyy, drawerW, dhh);
        gFront.lineStyle(1, 0xc8c4b8);
        gFront.strokeRect(dxx + 3, dyy + 3, drawerW - 6, dhh - 6);
        gFront.fillStyle(0xa8b0b8);
        gFront.fillRect(dxx + drawerW / 2 - 14, dyy + dhh / 2 - 3, 28, 5);
        gFront.fillStyle(0xb8c0c8);
        gFront.fillRect(dxx + drawerW / 2 - 16, dyy + dhh / 2 - 6, 32, 3);

        const zone = this.add.zone(dxx + drawerW / 2, dyy + dhh / 2, drawerW, dhh);
        this.physics.add.existing(zone, true);
        this.drawers.push({
          zone, hasKey: false, searched: false, wall: 2,
          dx: dxx, dy: dyy, dw: drawerW, dh: dhh
        });
      }

      const doorTopY = counterTopNew + 6 + drawerH + 4;
      const doorH = chNew - drawerH - 16;
      for (let idx = 0; idx < 2; idx++) {
        const dxx = bx + 3 + idx * (drawerW + 4);
        gFront.fillStyle(0xe8e4dc);
        gFront.fillRect(dxx, doorTopY, drawerW, doorH);
        gFront.lineStyle(2, 0xc8c4b8);
        gFront.strokeRect(dxx + 3, doorTopY + 3, drawerW - 6, doorH - 6);
        gFront.lineStyle(1, 0xd8d4cc);
        gFront.strokeRect(dxx + 7, doorTopY + 7, drawerW - 14, doorH - 14);
        gFront.fillStyle(0xa8b0b8);
        gFront.fillRect(dxx + drawerW / 2 - 14, doorTopY + 12, 28, 5);
        gFront.fillStyle(0xb8c0c8);
        gFront.fillRect(dxx + drawerW / 2 - 16, doorTopY + 10, 32, 3);
      }
    });

    const stoveTopY = counterTopNew;
    const stoveH = floorY - stoveTopY - 12;

    gFront.fillStyle(0xb0b8c0);
    gFront.fillRect(stoveX - 4, stoveTopY, stoveW + 8, stoveH + 12);

    gFront.fillStyle(0x1a6268);
    gFront.fillRect(stoveX, stoveTopY, stoveW, stoveH);

    const panelH = 22;
    const panelY = stoveTopY + 2;
    gFront.fillStyle(0xb8c0c8);
    gFront.fillRect(stoveX, panelY, stoveW, panelH);
    gFront.fillStyle(0xd0d8e0);
    gFront.fillRect(stoveX + 2, panelY + 2, stoveW - 4, 5);
    gFront.fillStyle(0xa8b0b8);
    gFront.fillRect(stoveX + 2, panelY + panelH - 4, stoveW - 4, 3);

    const knobY = panelY + panelH / 2;
    const displayW = 40;
    const knobAreaW = (stoveW - displayW - 20) / 2;
    const kSpacing = knobAreaW / 4;
    for (let i = 0; i < 4; i++) {
      const kxL = stoveX + 10 + kSpacing * i + kSpacing / 2;
      const kxR = centerX + displayW / 2 + 10 + kSpacing * i + kSpacing / 2;
      [kxL, kxR].forEach(kx => {
        gFront.fillStyle(0x888898); gFront.fillEllipse(kx, knobY, 14, 14);
        gFront.fillStyle(0x606070); gFront.fillEllipse(kx, knobY, 9, 9);
        gFront.fillStyle(0x303038); gFront.fillEllipse(kx, knobY, 4, 4);
        gFront.fillStyle(0xd0d8e0); gFront.fillRect(kx - 1, knobY - 7, 2, 4);
      });
    }

    gFront.fillStyle(0x101820);
    gFront.fillRect(centerX - displayW / 2, panelY + 4, displayW, panelH - 8);
    gFront.fillStyle(0x2a7888, 0.8);
    gFront.fillRect(centerX - displayW / 2 + 3, panelY + 6, displayW - 6, panelH - 12);
    gFront.fillStyle(0x4aaabb, 0.6);
    gFront.fillRect(centerX - 10, panelY + 8, 8, 3);
    gFront.fillRect(centerX + 2, panelY + 8, 8, 3);

    const divY2 = panelY + panelH + 2;
    const divW = 10;
    gFront.fillStyle(0xb8c0c8);
    gFront.fillRect(centerX - divW / 2, divY2, divW, stoveH - (divY2 - stoveTopY));
    gFront.fillStyle(0xd0d8e0);
    gFront.fillRect(centerX - divW / 2 + 2, divY2, 3, stoveH - (divY2 - stoveTopY));

    const ovenY = divY2 + 2;
    const ovenH2 = stoveH - (ovenY - stoveTopY) - 2;
    const ovenPad = 5;
    [
      [stoveX + ovenPad, centerX - divW / 2 - stoveX - ovenPad],
      [centerX + divW / 2, stoveX + stoveW - centerX - divW / 2 - ovenPad]
    ].forEach(([ox2, ow]) => {
      gFront.fillStyle(0x142028);
      gFront.fillRect(ox2, ovenY, ow, ovenH2);
      gFront.fillStyle(0xb0b8c0);
      gFront.fillRect(ox2, ovenY, ow, 4);
      gFront.fillRect(ox2, ovenY, 4, ovenH2);
      gFront.fillRect(ox2 + ow - 4, ovenY, 4, ovenH2);
      gFront.fillRect(ox2, ovenY + ovenH2 - 4, ow, 4);
      const puxY = ovenY + 6;
      gFront.fillStyle(0xd0d8e0);
      gFront.fillRect(ox2 + 10, puxY, ow - 20, 6);
      gFront.fillStyle(0xe0e8f0);
      gFront.fillRect(ox2 + 10, puxY, ow - 20, 2);
      gFront.fillStyle(0xa0a8b0);
      gFront.fillRect(ox2 + 10, puxY - 2, 8, 10);
      gFront.fillRect(ox2 + ow - 18, puxY - 2, 8, 10);
      const winY = puxY + 10;
      const winH = ovenH2 - (winY - ovenY) - 6;
      gFront.fillStyle(0x1a3040, 0.9);
      gFront.fillRect(ox2 + 6, winY, ow - 12, winH);
      gFront.fillStyle(0x3a6878, 0.5);
      gFront.fillRect(ox2 + 8, winY + 2, (ow - 12) * 0.45, winH - 4);
      gFront.fillStyle(0xaaccdd, 0.07);
      gFront.fillRect(ox2 + 9, winY + 3, (ow - 12) * 0.2, winH - 6);
      gFront.lineStyle(2, 0x9aa8b0);
      gFront.strokeRect(ox2 + 6, winY, ow - 12, winH);
    });

    const footH = 12, footW = 10;
    [stoveX + 8, stoveX + 28, stoveX + stoveW - 38, stoveX + stoveW - 18].forEach(fx => {
      gFront.fillStyle(0xb8c0c8);
      gFront.fillRect(fx, floorY - footH, footW, footH);
      gFront.fillStyle(0xd0d8e0);
      gFront.fillRect(fx + 2, floorY - footH + 1, footW - 4, 3);
      gFront.fillStyle(0x909098);
      gFront.fillRect(fx, floorY - 4, footW, 4);
    });

    const bsX = sideAereoLX;
    const bsW = sideAereoW * 2 + hoodW;
    const bsY = hoodBotY + 6;
    const tileW = 38, tileH = 18;

    g.fillStyle(0xc8d4ce);
    g.fillRect(bsX, hoodBotY + 6, bsW, counterTop - hoodBotY - 6);

    for (let ty = bsY; ty < counterTop - 2; ty += tileH + 2) {
      const rowN = Math.floor((ty - (bsY - 40)) / (tileH + 2));
      const off = (rowN % 2 === 0) ? 0 : tileW / 2;
      for (let tx = bsX - tileW / 2 + off; tx < bsX + bsW; tx += tileW + 2) {
        const c = (Math.floor((tx - bsX) / (tileW + 2)) + rowN) % 2 === 0 ? 0xb8cac4 : 0xaabcb6;
        const cx2 = Math.max(tx, bsX);
        const cw = Math.min(tx + tileW, bsX + bsW) - cx2;
        if (cw > 0) { g.fillStyle(c); g.fillRoundedRect(cx2, ty, cw, tileH, 2); }
      }
    }

    const plateY = topMargin - 8;
    [centerX - 120, centerX - 60, centerX, centerX + 60, centerX + 120].forEach((px, i) => {
      const pr = 20 + (i % 2) * 4;
      g.fillStyle(0xeaf0f8); g.fillEllipse(px, plateY, pr * 2, pr * 2);
      g.lineStyle(2, 0x3a68c8); g.strokeEllipse(px, plateY, pr * 1.6, pr * 1.6);
      g.fillStyle(0x2a58b8, 0.5); g.fillEllipse(px, plateY, pr * 0.6, pr * 0.6);
    });

    [ox + extLW / 2, extRX + extRW / 2].forEach(lx => {
      g.fillStyle(0x888070);
      g.fillRect(lx - 2, 22, 4, topMargin - 14);
      g.fillStyle(0xf4f4f0);
      g.fillEllipse(lx, topMargin + 20, 64, 56);
      g.lineStyle(1, 0xd8d4cc);
      g.strokeEllipse(lx, topMargin + 20, 64, 56);
      g.fillStyle(0x888070);
      g.fillRect(lx - 12, topMargin - 2, 24, 8);
      g.fillRect(lx - 5, topMargin + 46, 10, 8);
      g.fillStyle(0xfff8e0, 0.15);
      g.fillEllipse(lx, topMargin + 14, 38, 28);
    });

    // ESCONDERIJOS — portas inferiores dos armários externos
    [
      { ex: extLX, ew: extLW },
      { ex: extRX, ew: extRW }
    ].forEach(({ ex, ew }) => {
      if (ew <= 0) return;
      const cabinetH = this.floorY - topMargin;
      const halfH = (cabinetH - 30) / 2;
      const door2Y_s = topMargin + 22 + halfH + 6;
      const door2H_s = cabinetH - halfH - 30;

      const hideZone = this.add.zone(
        ex + ew / 2,
        this.floorY - 40,
        ew, door2H_s
      );
      this.physics.add.existing(hideZone, true);
      this.wardrobes.push(hideZone);
    });
  }

  // ─── PAREDE 3: PANTRY + GELADEIRA  (X: 2800 → 4200) ──
  buildPantryWall() {
    const g = this.add.graphics().setDepth(1);
    const floorY = this.floorY;
    const topMargin = 55;
    const ch = 75;

    const ox = 2800;
    const wallW = 1400;
    const centerX = ox + wallW / 2;

    g.fillStyle(0xaab8b8);
    g.fillRect(ox, 0, wallW, floorY);
    g.fillStyle(0x081828, 0.3);
    g.fillRect(ox, 0, wallW, floorY);

    g.fillStyle(0xd8e0e4);
    g.fillRect(ox, 0, wallW, 22);
    g.fillStyle(0xc8d0d4);
    [ox + 100, ox + 300, ox + 500, ox + 700, ox + 900, ox + 1100, ox + 1300].forEach(x => {
      g.fillRect(x, 0, 18, topMargin + 10);
    });
    g.fillStyle(0xc0c8cc);
    g.fillRect(ox, topMargin - 12, wallW, 10);
    g.fillRect(ox, topMargin / 2 - 6, wallW, 8);

    g.fillStyle(0x3a2a1a);
    g.fillRect(ox, floorY, wallW, 8);
    g.fillStyle(0x2a1a0e, 0.9);
    g.fillRect(ox, floorY + 8, wallW, 72);
    const floor3 = this.add.rectangle(ox + wallW / 2, floorY + 30, wallW, 60).setVisible(false);
    this.physics.add.existing(floor3, true);
    this.platforms.add(floor3);

    const pantryX = ox + 60, pantryW = 280;
    const pantryH = floorY - topMargin;

    g.fillStyle(0xeae6de);
    g.fillRect(pantryX, topMargin, pantryW, pantryH);
    g.lineStyle(3, 0xc8c4b8);
    g.strokeRect(pantryX + 4, topMargin + 4, pantryW - 8, pantryH - 8);

    g.fillStyle(0xe0dcd4);
    g.fillRect(pantryX + 2, topMargin + 16, pantryW - 4, 5);

    const pDoorW = pantryW / 2 - 8;
    const doorPad = 6;
    const innerPad = 12;

    const totalDoorH = pantryH - 22;
    const gap = 8;
    const door1H = Math.floor(totalDoorH * 0.58);
    const door2H = totalDoorH - door1H - gap;
    const door1Y = topMargin + 22;
    const door2Y = door1Y + door1H + gap;

    [[pantryX + doorPad], [pantryX + pantryW / 2 + 2]].forEach(([dx]) => {
      const isRight = dx > pantryX + pantryW / 2;

      g.fillStyle(0xe8e4dc);
      g.fillRect(dx, door1Y, pDoorW, door1H);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(dx + 3, door1Y + 3, pDoorW - 6, door1H - 6);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRoundedRect(dx + innerPad, door1Y + innerPad, pDoorW - innerPad * 2, door1H - innerPad * 2, 6);

      g.fillStyle(0xe8e4dc);
      g.fillRect(dx, door2Y, pDoorW, door2H);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(dx + 3, door2Y + 3, pDoorW - 6, door2H - 6);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRoundedRect(dx + innerPad, door2Y + innerPad, pDoorW - innerPad * 2, door2H - innerPad * 2, 6);

      const ph2X = isRight ? dx + 4 : dx + pDoorW - 16;
      const ph2Y = door2Y - 24;
      const ph2H = door2H * 0.4;
      g.fillStyle(0xb0b8c0); g.fillRect(ph2X, ph2Y, 8, ph2H);
      g.fillStyle(0xd0d8e0);
      g.fillRect(ph2X - 2, ph2Y - 4, 12, 7);
      g.fillRect(ph2X - 2, ph2Y + ph2H - 3, 12, 7);
      g.fillStyle(0xe0e8f0); g.fillRect(ph2X + 1, ph2Y + 4, 3, ph2H - 8);
    });

    g.fillStyle(0xd8d4cc);
    g.fillRect(pantryX + pantryW / 2 - 2, topMargin + 22, 4, pantryH - 22);
    g.fillStyle(0x081828, 0.18);
    g.fillRect(pantryX + pantryW - 5, topMargin, 5, pantryH);

    const nichoX = pantryX + pantryW + 6, nichoW = 200, nichoH = floorY - topMargin;
    g.fillStyle(0x98a8a8);
    g.fillRect(nichoX, topMargin, nichoW, nichoH);
    g.fillStyle(0xeae6de);
    g.fillRect(nichoX - 16, topMargin, 16, nichoH);
    g.fillRect(nichoX + nichoW, topMargin, 16, nichoH);
    g.fillRect(nichoX - 16, topMargin, nichoW + 32, 20);

    const shelf1Y = topMargin + 30, shelf1H = 70;
    g.fillStyle(0xeae6de);
    g.fillRect(nichoX, shelf1Y + shelf1H - 8, nichoW, 8);
    const bookColors = [0xd44444, 0xe8a030, 0x4488cc, 0xcc4444, 0x44aa66, 0xe05050, 0x3366aa, 0xaa4488, 0xddbb44, 0x558844];
    const bookW = nichoW / bookColors.length;
    bookColors.forEach((col, i) => {
      const bx = nichoX + i * bookW + 2, bh = 36 + (i % 3) * 8;
      g.fillStyle(col); g.fillRect(bx, shelf1Y + shelf1H - 8 - bh, bookW - 2, bh);
      g.fillStyle(col, 0.6); g.fillRect(bx + 1, shelf1Y + shelf1H - 8 - bh, 3, bh);
    });

    const shelf2Y = shelf1Y + shelf1H + 4, shelf2H = 75;
    g.fillStyle(0xeae6de);
    g.fillRect(nichoX, shelf2Y + shelf2H - 8, nichoW, 8);
    const lamp1X = nichoX + 30, lamp1Y = shelf2Y + shelf2H - 8;
    g.fillStyle(0xd8c8a0);
    g.fillPoints([{ x: lamp1X - 16, y: lamp1Y - 44 }, { x: lamp1X + 16, y: lamp1Y - 44 }, { x: lamp1X + 11, y: lamp1Y - 8 }, { x: lamp1X - 11, y: lamp1Y - 8 }], true);
    g.fillStyle(0x9a8870); g.fillRect(lamp1X - 3, lamp1Y - 50, 6, 10);
    g.fillStyle(0xfff8e0, 0.4); g.fillEllipse(lamp1X, lamp1Y - 26, 24, 16);
    g.fillStyle(0xd8d0c8); g.fillRect(nichoX + 62, shelf2Y + 8, 70, 50);
    g.lineStyle(2, 0xb8b0a8); g.strokeRect(nichoX + 64, shelf2Y + 10, 66, 46);
    g.fillStyle(0x8898a8, 0.4); g.fillRect(nichoX + 68, shelf2Y + 14, 58, 38);
    const lamp2X = nichoX + nichoW - 30;
    g.fillStyle(0xd8c8a0);
    g.fillPoints([{ x: lamp2X - 16, y: lamp1Y - 44 }, { x: lamp2X + 16, y: lamp1Y - 44 }, { x: lamp2X + 11, y: lamp1Y - 8 }, { x: lamp2X - 11, y: lamp1Y - 8 }], true);
    g.fillStyle(0x9a8870); g.fillRect(lamp2X - 3, lamp1Y - 50, 6, 10);
    g.fillStyle(0xfff8e0, 0.4); g.fillEllipse(lamp2X, lamp1Y - 26, 24, 16);

    const mwY = shelf2Y + shelf2H + 4, mwH = 90;
    g.fillStyle(0x282828); g.fillRect(nichoX + 4, mwY, nichoW - 8, mwH);
    g.lineStyle(2, 0x484848); g.strokeRect(nichoX + 4, mwY, nichoW - 8, mwH);
    g.fillStyle(0x1a1a1a); g.fillRect(nichoX + nichoW - 44, mwY + 4, 36, mwH - 8);
    g.fillStyle(0x0a1818, 0.9); g.fillRect(nichoX + 8, mwY + 8, nichoW - 60, mwH - 16);
    g.lineStyle(1, 0x3a4848); g.strokeRect(nichoX + 8, mwY + 8, nichoW - 60, mwH - 16);
    [mwY + 20, mwY + 36, mwY + 52, mwY + 68].forEach(by => {
      g.fillStyle(0x505050); g.fillCircle(nichoX + nichoW - 24, by, 4);
    });
    g.fillStyle(0x585858); g.fillRect(nichoX + nichoW - 52, mwY + mwH / 2 - 20, 4, 40);

    const drawerY = mwY + mwH + 4, drawerH = 30;
    g.fillStyle(0xe8e4dc); g.fillRect(nichoX + 4, drawerY, nichoW - 8, drawerH);
    g.lineStyle(1, 0xc8c4b8); g.strokeRect(nichoX + 8, drawerY + 4, nichoW - 16, drawerH - 8);
    g.fillStyle(0xa0a8b0); g.fillRect(nichoX + nichoW / 2 - 18, drawerY + drawerH / 2 - 3, 36, 6);

    const botNichoY = drawerY + drawerH + 4;
    const botNichoH = floorY - botNichoY;
    const pDoorW2 = (nichoW - 12) / 2;
    const innerPad2 = 10;

    [[nichoX + 4, 'left'], [nichoX + nichoW / 2 + 2, 'right']].forEach(([dx, side]) => {
      const isRight = side === 'right';
      const dw = pDoorW2;
      g.fillStyle(0xe8e4dc);
      g.fillRect(dx, botNichoY, dw, botNichoH - 4);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(dx + 3, botNichoY + 3, dw - 6, botNichoH - 10);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRoundedRect(dx + innerPad2, botNichoY + innerPad2, dw - innerPad2 * 2, botNichoH - innerPad2 * 2 - 4, 5);
      const phX = isRight ? dx + 4 : dx + dw - 16;
      const phY = botNichoY + 5;
      const phH = botNichoH * 0.35;
      g.fillStyle(0xb0b8c0); g.fillRect(phX, phY, 8, phH);
      g.fillStyle(0xd0d8e0);
      g.fillRect(phX - 2, phY - 4, 12, 7);
      g.fillRect(phX - 2, phY + phH - 3, 12, 7);
      g.fillStyle(0xe0e8f0); g.fillRect(phX + 1, phY + 4, 3, phH - 8);
    });

    const fridgeX = nichoX + nichoW + 32, fridgeW = 300;
    const fridgeH = floorY - topMargin - 10, fridgeY = topMargin;
    const fridgeMidX = fridgeX + fridgeW / 2;

    const fridgeCaixilhoH = shelf1Y + shelf1H - fridgeY;
    g.fillStyle(0xeae6de);
    g.fillRect(fridgeX - 16, fridgeY, fridgeW + 32, fridgeCaixilhoH);
    g.lineStyle(2, 0xc8c4b8); g.strokeRect(fridgeX - 12, fridgeY + 4, fridgeW + 24, fridgeCaixilhoH - 8);
    g.lineStyle(1, 0xd8d4cc); g.strokeRect(fridgeX - 6, fridgeY + 8, fridgeW + 12, fridgeCaixilhoH - 16);

    g.fillStyle(0xe8e4dc);
    g.fillRect(fridgeX, fridgeY + fridgeCaixilhoH, fridgeW, fridgeH - fridgeCaixilhoH);
    g.fillStyle(0xb8bcc4);
    g.fillRect(fridgeMidX - 3, fridgeY + fridgeCaixilhoH, 6, fridgeH - fridgeCaixilhoH);

    g.lineStyle(2, 0xc8c4b8);
    g.strokeRect(fridgeX + 6, fridgeY + fridgeCaixilhoH + 6, fridgeW / 2 - 12, (fridgeH - 50) / 2);
    g.strokeRect(fridgeX + 6, fridgeY + fridgeCaixilhoH + 10 + (fridgeH - 50) / 2, fridgeW / 2 - 12, (fridgeH - 60) / 2);
    g.lineStyle(1, 0xd8d4cc);
    g.strokeRect(fridgeX + 12, fridgeY + fridgeCaixilhoH + 12, fridgeW / 2 - 24, (fridgeH - 50) / 2 - 10);
    g.strokeRect(fridgeX + 12, fridgeY + fridgeCaixilhoH + 18 + (fridgeH - 50) / 2, fridgeW / 2 - 24, (fridgeH - 60) / 2 - 12);

    g.lineStyle(2, 0xc8c4b8);
    g.strokeRect(fridgeMidX + 6, fridgeY + fridgeCaixilhoH + 6, fridgeW / 2 - 12, (fridgeH - 50) / 2);
    g.strokeRect(fridgeMidX + 6, fridgeY + fridgeCaixilhoH + 10 + (fridgeH - 50) / 2, fridgeW / 2 - 12, (fridgeH - 60) / 2);
    g.lineStyle(1, 0xd8d4cc);
    g.strokeRect(fridgeMidX + 12, fridgeY + fridgeCaixilhoH + 12, fridgeW / 2 - 24, (fridgeH - 50) / 2 - 10);
    g.strokeRect(fridgeMidX + 12, fridgeY + fridgeCaixilhoH + 18 + (fridgeH - 50) / 2, fridgeW / 2 - 24, (fridgeH - 60) / 2 - 12);

    const phY = fridgeY + fridgeH * 0.60;
    const phH = 80;
    const ph1X = fridgeMidX - 16;
    g.fillStyle(0xb0b8c0); g.fillRect(ph1X, phY, 8, phH);
    g.fillStyle(0xd0d8e0);
    g.fillRect(ph1X - 2, phY - 4, 12, 7);
    g.fillRect(ph1X - 2, phY + phH - 3, 12, 7);
    g.fillStyle(0xe0e8f0); g.fillRect(ph1X + 1, phY + 4, 3, phH - 8);
    const ph2X = fridgeMidX + 8;
    g.fillStyle(0xb0b8c0); g.fillRect(ph2X, phY, 8, phH);
    g.fillStyle(0xd0d8e0);
    g.fillRect(ph2X - 2, phY - 4, 12, 7);
    g.fillRect(ph2X - 2, phY + phH - 3, 12, 7);
    g.fillStyle(0xe0e8f0); g.fillRect(ph2X + 1, phY + 4, 3, phH - 8);

    const rightWallX = fridgeX + fridgeW + 16;
    const chR = 100;
    const counterTopR = floorY - chR;
    const rightW = 210;

    g.fillStyle(0xf0ede6);
    g.fillRect(rightWallX, counterTopR - 6, rightW, 6);
    g.fillStyle(0xe8e4dc);
    g.fillRect(rightWallX, counterTopR, rightW, chR);
    g.fillStyle(0x060e18, 0.12);
    g.fillRect(rightWallX, counterTopR + 4, rightW, 4);

    const drawerHR = chR * 0.25;
    const drawerWR = (rightW - 10) / 2;
    for (let i = 0; i < 2; i++) {
      const dx = rightWallX + 3 + i * (drawerWR + 4);
      const dy = counterTopR + 5;
      g.fillStyle(0xe8e4dc);
      g.fillRect(dx, dy, drawerWR, drawerHR);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(dx + 3, dy + 3, drawerWR - 6, drawerHR - 6);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRect(dx + 7, dy + 7, drawerWR - 14, drawerHR - 14);
      g.fillStyle(0xb0b8c0);
      g.fillRect(dx + drawerWR / 2 - 16, dy + drawerHR / 2 - 3, 32, 6);
      g.fillStyle(0xd0d8e0);
      g.fillRect(dx + drawerWR / 2 - 18, dy + drawerHR / 2 - 5, 36, 3);
      g.fillStyle(0xa0a8b0);
      g.fillRect(dx + drawerWR / 2 - 18, dy + drawerHR / 2 - 5, 5, 8);
      g.fillRect(dx + drawerWR / 2 + 13, dy + drawerHR / 2 - 5, 5, 8);
    }

    const doorTopYR = counterTopR + drawerHR + 9;
    const doorHR = chR - drawerHR - 14;
    const innerPadR = 10;
    for (let i = 0; i < 2; i++) {
      const dx = rightWallX + 3 + i * (drawerWR + 4);
      g.fillStyle(0xe8e4dc);
      g.fillRect(dx, doorTopYR, drawerWR, doorHR);
      g.lineStyle(2, 0xc0bcb4);
      g.strokeRect(dx + 3, doorTopYR + 3, drawerWR - 6, doorHR - 6);
      g.fillStyle(0xd8d4cc);
      g.fillRect(dx + innerPadR, doorTopYR + innerPadR, drawerWR - innerPadR * 2, doorHR - innerPadR * 2);
      g.fillStyle(0xe8e4dc);
      g.fillRect(dx + innerPadR + 3, doorTopYR + innerPadR + 3, drawerWR - innerPadR * 2 - 6, doorHR - innerPadR * 2 - 6);
      g.lineStyle(1, 0xd0ccC4);
      g.strokeRect(dx + innerPadR, doorTopYR + innerPadR, drawerWR - innerPadR * 2, doorHR - innerPadR * 2);
      const phDy = doorTopYR + 14;
      g.fillStyle(0xb0b8c0);
      g.fillRect(dx + drawerWR / 2 - 16, phDy, 32, 6);
      g.fillStyle(0xd0d8e0);
      g.fillRect(dx + drawerWR / 2 - 18, phDy - 2, 36, 3);
      g.fillStyle(0xa0a8b0);
      g.fillRect(dx + drawerWR / 2 - 18, phDy - 2, 5, 10);
      g.fillRect(dx + drawerWR / 2 + 13, phDy - 2, 5, 10);
    }

    [topMargin + 150].forEach((sy, si) => {
      g.fillStyle(0xeae6de);
      g.fillRect(rightWallX, sy + 60, 210, 8);
      g.fillRect(rightWallX, sy - 8, 8, 76);
      g.fillRect(rightWallX + 202, sy - 8, 8, 76);
      g.fillPoints([{ x: rightWallX, y: sy + 60 }, { x: rightWallX + 28, y: sy + 60 }, { x: rightWallX + 8, y: sy + 20 }], true);
      const bColors = si === 0
        ? [0xcc4444, 0x4488cc, 0xe8a030, 0xaa4488, 0x44aa66, 0xddbb44, 0xd44444]
        : [0x558844, 0x3366aa, 0xcc6644, 0x8844aa, 0xdd9944];
      const bw = (210 - 16) / (bColors.length + 1);
      bColors.forEach((col, i) => {
        const bx = rightWallX + 10 + i * (bw + 1), bh = 36 + (i % 3) * 8;
        g.fillStyle(col); g.fillRect(bx, sy + 60 - bh, bw, bh);
      });
      if (si === 0) {
        g.fillStyle(0x4a7888);
        g.fillRect(rightWallX + 172, sy + 60 - 50, 22, 50);
        g.fillRect(rightWallX + 168, sy + 60 - 55, 30, 8);
      }
    });

    g.fillStyle(0x4488cc, 0.8); g.fillCircle(rightWallX + 106, topMargin + 230, 8);
    g.fillStyle(0x88aacc, 0.8); g.fillCircle(rightWallX + 124, topMargin + 238, 6);
    g.fillStyle(0x446688);
    g.fillRect(rightWallX + 104, topMargin + 240, 4, 24);
    g.fillRect(rightWallX + 122, topMargin + 246, 3, 18);

    const openX = ox + wallW - 260, openW = 260;
    g.fillStyle(0xc8b898);
    g.fillRect(openX, topMargin, openW, floorY - topMargin);
    g.fillStyle(0x181008, 0.18);
    g.fillRect(openX, topMargin, openW, floorY - topMargin);
    g.fillStyle(0xeae6de);
    g.fillRect(openX - 20, topMargin, 20, floorY - topMargin);
    g.fillRect(openX - 20, topMargin, openW + 20, 22);
    g.fillStyle(0xd8e8f0, 0.5);
    g.fillRect(openX + 70, topMargin + 40, 130, 200);
    g.fillStyle(0xfff8f0, 0.25);
    g.fillRect(openX + 74, topMargin + 44, 122, 192);
    g.fillStyle(0xd8c8b0, 0.7);
    g.fillRect(openX + 50, topMargin + 36, 28, 210);
    g.fillRect(openX + 182, topMargin + 36, 28, 210);
    g.fillStyle(0xb8a898);
    g.fillRect(openX + 18, floorY - 90, 96, 60);
    g.fillRect(openX + 12, floorY - 120, 108, 34);
    g.fillRect(openX + 12, floorY - 90, 14, 60);
    g.fillRect(openX + 106, floorY - 90, 14, 60);
    g.fillStyle(0xa09880, 0.4);
    g.fillEllipse(openX + 110, floorY - 20, 150, 28);

    [pantryX + pantryW / 2, fridgeX + fridgeW / 2 + 50].forEach(lx => {
      g.fillStyle(0x888070);
      g.fillRect(lx - 2, 22, 4, topMargin - 22);
      g.fillStyle(0xf0f0ec);
      g.fillEllipse(lx, topMargin + 20, 52, 44);
      g.lineStyle(1, 0xd8d4cc);
      [0.3, 0.55, 0.75, 0.9].forEach(r => g.strokeEllipse(lx, topMargin + 20, 52 * r, 44 * r));
      g.fillStyle(0x888070);
      g.fillRect(lx - 8, topMargin - 6, 16, 8);
      g.fillRect(lx - 4, topMargin + 40, 8, 8);
      g.fillStyle(0xfff8e0, 0.2);
      g.fillEllipse(lx, topMargin + 14, 32, 22);
      g.fillStyle(0x8ab0cc, 0.04);
      g.fillTriangle(lx - 80, topMargin + 44, lx + 80, topMargin + 44, lx, floorY);
    });

    // ESCONDERIJO — armário pantry
    const hideZonePantry = this.add.zone(
      pantryX + pantryW / 2,
      door2Y + door2H / 2,
      pantryW, door2H
    );
    this.physics.add.existing(hideZonePantry, true);
    this.wardrobes.push(hideZonePantry);

    // GAVETAS DA BANCADA DIREITA — parede 3
    for (let i = 0; i < 2; i++) {
      const dx = rightWallX + 3 + i * (drawerWR + 4);
      const dy = counterTopR + 5;
      const zone = this.add.zone(dx + drawerWR / 2, dy + drawerHR / 2, drawerWR, drawerHR);
      this.physics.add.existing(zone, true);
      this.drawers.push({
        zone, hasKey: false, searched: false, wall: 3,
        dx, dy, dw: drawerWR, dh: drawerHR
      });
    }
  }

  // ─── PAREDE 4: FACHADA DA MANSÃO  (X: 4200 → 5600) ───
  buildMansionFacade() {
    const g = this.add.graphics().setDepth(1);
    const floorY = this.floorY;
    const ox = 4200;
    const wallW = 1400;
    const midX = ox + 512;

    const C = {
      wall: 0x8a9aac,
      wallSh: 0x6a7a8c,
      roof: 0x2e3848,
      roofFt: 0x3a4558,
      trim: 0xa8bece,
      col: 0xc8dcea,
      winOn: 0xd4881a,
      winGlow: 0xf0a840,
      attic: 0x2e3a4e,
      porchBg: 0x36424e,
      stone: 0x5a6878,
    };

    const win = (wx, wy, ww, wh) => {
      g.fillStyle(C.winOn, 0.9);
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle(C.winGlow, 0.25);
      g.fillRect(wx + 3, wy + 3, ww - 6, wh * 0.38);
      g.fillStyle(C.trim, 1);
      g.fillRect(wx - 4, wy - 4, ww + 8, 5);
      g.fillRect(wx - 4, wy + wh, ww + 8, 5);
      g.fillRect(wx - 4, wy - 4, 5, wh + 9);
      g.fillRect(wx + ww, wy - 4, 5, wh + 9);
      g.fillStyle(C.wallSh, 1);
      g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      g.fillRect(wx, wy + wh * 0.46, ww, 3);
    };

    const balcony = (sx, by, bw) => {
      g.fillStyle(C.wallSh, 1);
      g.fillRect(sx - 10, by + 4, bw + 20, 8);
      g.fillStyle(C.trim, 1);
      for (let bx = sx - 6; bx <= sx + bw + 2; bx += 10) {
        g.fillRect(bx, by - 38, 3, 42);
      }
      g.fillRect(sx - 10, by - 42, bw + 24, 6);
      g.fillRect(sx - 10, by, bw + 24, 6);
      g.fillEllipse(sx - 10, by - 39, 12, 12);
      g.fillEllipse(sx + bw + 14, by - 39, 12, 12);
    };

    const wing = (sx, flip) => {
      const wW = 196, wH = 200;
      const wY = floorY - wH;
      const ch = 24;

      g.fillStyle(C.wall, 1);
      if (!flip) {
        g.fillPoints([
          { x: sx, y: wY },
          { x: sx + wW, y: wY },
          { x: sx + wW, y: floorY },
          { x: sx + ch, y: floorY },
          { x: sx, y: floorY - ch }
        ], true);
      } else {
        g.fillPoints([
          { x: sx, y: wY },
          { x: sx + wW, y: wY },
          { x: sx + wW, y: floorY - ch },
          { x: sx + wW - ch, y: floorY },
          { x: sx, y: floorY }
        ], true);
      }

      g.fillStyle(C.wallSh, 1);
      if (!flip) g.fillRect(sx, wY, 30, wH);
      else g.fillRect(sx + wW - 30, wY, 30, wH);

      const apexX = sx + wW / 2;
      const apexY = wY - 80;
      g.fillStyle(C.roof, 1);
      g.fillTriangle(apexX, apexY, sx - 12, wY, sx + wW + 12, wY);

      g.fillStyle(C.roofFt, 1);
      g.fillTriangle(apexX, apexY + 14, sx + 20, wY, sx + wW - 20, wY);
      g.lineStyle(2, C.trim, 1);
      g.strokeTriangle(apexX, apexY + 14, sx + 20, wY, sx + wW - 20, wY);

      g.fillStyle(C.trim, 1);
      g.fillRect(sx - 12, wY - 3, wW + 24, 6);

      g.fillStyle(C.winOn, 0.7);
      g.fillEllipse(apexX, wY - 46, 30, 20);
      g.lineStyle(3, C.trim, 1);
      g.strokeEllipse(apexX, wY - 46, 32, 22);

      const divY = wY + wH * 0.46;
      g.fillStyle(C.trim, 1);
      g.fillRect(sx, divY, wW, 6);

      balcony(sx, divY, wW);

      const w2Y = wY + 14;
      const w2H = divY - wY - 24;
      win(sx + 14, w2Y, 42, w2H);
      win(sx + 64, w2Y, 68, w2H);
      win(sx + wW - 56, w2Y, 42, w2H);

      const w1Y = divY + 16;
      const w1H = floorY - 56 - w1Y;
      const w1W = Math.floor((wW - 22 * 2 - 16 * 2) / 3);
      [sx + 22, sx + 22 + w1W + 16, sx + 22 + (w1W + 16) * 2].forEach(wx => {
        win(wx, w1Y, w1W, w1H);
      });
    };

    g.fillStyle(0x0d1825, 1);
    g.fillRect(ox, 0, wallW, floorY);
    g.fillStyle(0x0a1828, 0.6);
    g.fillRect(ox, 0, wallW, 200);

    [
      [ox + 80, 25], [ox + 160, 14], [ox + 250, 38], [ox + 370, 12], [ox + 460, 30],
      [ox + 580, 8], [ox + 700, 32], [ox + 820, 18], [ox + 940, 26], [ox + 1060, 40],
      [ox + 120, 58], [ox + 330, 50], [ox + 550, 65], [ox + 780, 52], [ox + 1200, 35],
      [ox + 290, 80], [ox + 640, 72], [ox + 900, 84], [ox + 1100, 62], [ox + 1320, 48],
    ].forEach(([sx, sy]) => {
      g.fillStyle(0xffffff, 0.45 + (sx % 5) * 0.1);
      g.fillCircle(sx, sy, sx % 4 === 0 ? 2 : 1.5);
    });

    [
      { cx: ox + 60, tw: 110, th: 200 },
      { cx: ox + 155, tw: 130, th: 220 },
      { cx: ox + 255, tw: 105, th: 195 },
      { cx: ox + 1145, tw: 105, th: 195 },
      { cx: ox + 1250, tw: 130, th: 218 },
      { cx: ox + 1345, tw: 110, th: 200 },
    ].forEach(({ cx, tw, th }) => {
      const baseY = floorY - 52;
      g.fillStyle(0x0e1c0c, 1); g.fillRect(cx - 5, baseY - th * 0.25, 10, th * 0.25);
      g.fillStyle(0x0d1c0b, 1); g.fillEllipse(cx, baseY - th * 0.5, tw, th * 0.68);
      g.fillStyle(0x122010, 1); g.fillEllipse(cx - tw * .16, baseY - th * .6, tw * .7, th * .5);
      g.fillStyle(0x162614, 1); g.fillEllipse(cx + tw * .12, baseY - th * .65, tw * .6, th * .44);
    });

    const cX = ox + 340;
    const cW = 344;
    const cY = 215;
    g.fillStyle(C.wall, 1);
    g.fillRect(cX, cY, cW, floorY - cY);

    const sX = ox + 398;
    const sW = 228;
    const sY = 108;
    g.fillStyle(C.attic, 1);
    g.fillRect(sX, sY, sW, cY - sY);

    g.fillStyle(C.wallSh, 1);
    g.fillPoints([
      { x: cX, y: cY },
      { x: sX, y: sY },
      { x: sX, y: cY },
    ], true);
    g.fillPoints([
      { x: cX + cW, y: cY },
      { x: sX + sW, y: sY },
      { x: sX + sW, y: cY },
    ], true);

    g.fillStyle(C.roof, 1);
    g.fillPoints([
      { x: sX - 14, y: sY },
      { x: sX + sW + 14, y: sY },
      { x: sX + sW + 2, y: sY - 44 },
      { x: sX - 2, y: sY - 44 }
    ], true);

    g.fillStyle(C.trim, 1);
    g.fillRect(sX - 18, sY - 3, sW + 36, 7);

    g.fillStyle(C.wallSh, 1);
    g.fillRect(ox + 492, 28, 40, 54);
    g.fillStyle(C.roof, 1);
    g.fillRect(ox + 488, 22, 48, 10);

    const extX = cX + cW;
    g.fillStyle(C.wall, 1);
    g.fillRect(extX, 258, 68, floorY - 258);
    g.fillStyle(C.roof, 1);
    g.fillPoints([
      { x: extX - 10, y: cY },
      { x: extX + 80, y: 258 },
      { x: extX + 80, y: cY }
    ], true);
    g.fillStyle(C.trim, 1);
    g.fillRect(extX - 12, cY - 2, 94, 6);

    wing(ox + 148, false);
    wing(ox + 148 + 196 + cW - 52, true);

    const porchX = ox + 355;
    const porchW = 314;
    const pRoofY = cY;
    const pRoofH = 16;
    g.fillStyle(C.roof, 1);
    g.fillRect(porchX - 12, pRoofY, porchW + 24, pRoofH);
    g.fillStyle(C.trim, 1);
    g.fillRect(porchX - 12, pRoofY + pRoofH - 3, porchW + 24, 5);
    g.fillStyle(0x000000, 0.22);
    g.fillRect(porchX - 12, pRoofY + pRoofH, porchW + 24, 10);

    g.fillStyle(C.porchBg, 1);
    g.fillRect(porchX, pRoofY + pRoofH, porchW, floorY - pRoofY - pRoofH);

    const archY = pRoofY + pRoofH + 10;
    const archH = floorY - archY - 8;
    const archW = 82;
    const archGap = 16;
    const arch1X = porchX + 12;

    [arch1X, arch1X + archW + archGap, arch1X + (archW + archGap) * 2].forEach(ax => {
      const rectH = archH * 0.68;
      const rectY = archY + archH - rectH;
      g.fillStyle(C.winOn, 0.92);
      g.fillRect(ax, rectY, archW, rectH);
      g.fillEllipse(ax + archW / 2, rectY, archW, archW * 0.9);
      g.fillStyle(C.winGlow, 0.2);
      g.fillEllipse(ax + archW / 2, rectY - archW * 0.1, archW * 0.65, archW * 0.5);
      g.lineStyle(3, C.trim, 1);
      g.strokeRect(ax + 2, rectY, archW - 4, rectH - 2);
      g.strokeEllipse(ax + archW / 2, rectY, archW - 4, archW * 0.9 - 4);
      g.fillStyle(C.wallSh, 0.5);
      g.fillRect(ax + archW / 2 - 2, rectY, 4, rectH);
      g.fillStyle(C.trim, 0.4);
      g.fillRect(ax + 2, rectY + rectH * 0.55, archW - 4, 3);
    });

    const colY = pRoofY + pRoofH;
    const colH = floorY - colY;
    const colW = 14;
    const colPositions = [
      porchX + 6,
      porchX + 6 + (porchW - 12) / 3,
      porchX + 6 + (porchW - 12) * 2 / 3,
      porchX + porchW - 6 - colW
    ];
    colPositions.forEach(cx2 => {
      g.fillStyle(C.col, 1);
      g.fillRect(cx2, colY, colW, colH);
      g.fillStyle(0xddeeff, 1);
      g.fillRect(cx2 - 4, colY, colW + 8, 10);
      g.fillRect(cx2 - 3, colY + colH - 7, colW + 6, 7);
    });

    const lantX = ox + 512, lantY = colY + 16;
    g.fillStyle(C.wallSh, 1);
    g.fillRect(lantX - 2, colY, 4, 18);
    g.fillStyle(0x1e2430, 1);
    g.fillRect(lantX - 7, lantY + 16, 14, 20);
    g.fillStyle(C.winOn, 0.75);
    g.fillRect(lantX - 5, lantY + 18, 10, 16);
    g.fillStyle(C.winGlow, 0.07);
    g.fillEllipse(lantX, lantY + 26, 65, 52);

    const a2Y = sY + 14, a2H = (cY - sY) - 24, a2W = 62;
    [sX + 14, sX + 14 + a2W + 14, sX + 14 + (a2W + 14) * 2].forEach(wx => {
      win(wx, a2Y, a2W, a2H);
    });

    g.fillStyle(C.stone, 1);
    g.fillRect(extX + 2, floorY - 28, 46, 8);
    g.fillRect(extX + 2, floorY - 18, 62, 8);
    g.fillRect(extX + 2, floorY - 8, 78, 8);

    g.fillStyle(0x0a160a, 1);
    g.fillRect(ox, floorY - 52, wallW, 52);
    g.fillStyle(C.stone, 1);
    g.fillRect(ox, floorY, wallW, 10);
    g.fillStyle(0x282e3a, 1);
    g.fillRect(ox + 412, floorY + 10, 200, 28);
    g.lineStyle(1, 0x343a48, 0.5);
    for (let tx = ox + 412; tx < ox + 612; tx += 40) {
      g.strokeRect(tx, floorY + 10, 40, 14);
      g.strokeRect(tx, floorY + 24, 40, 14);
    }

    const floor4 = this.add.rectangle(ox + wallW / 2, floorY + 30, wallW, 60).setVisible(false);
    this.physics.add.existing(floor4, true);
    this.platforms.add(floor4);

    const bush = (bx, br, dark = false) => {
      const by = floorY - 50 - br * 0.28;
      g.fillStyle(dark ? 0x183020 : 0x1c3c28, 1);
      g.fillEllipse(bx, by, br * 2, br * 1.4);
      g.fillStyle(dark ? 0x142818 : 0x183422, 1);
      g.fillEllipse(bx - br * 0.3, by - br * 0.18, br * 1.3, br);
    };
    [
      [ox + 190, 22, false], [ox + 230, 16, true], [ox + 268, 20, false],
      [ox + 750, 20, false], [ox + 788, 16, true], [ox + 826, 22, false],
    ].forEach(([bx, br, d]) => bush(bx, br, d));

    [ox + 210, ox + 770].forEach(fx => {
      const fy = floorY - 50;
      g.fillStyle(0x283468, 0.9); g.fillEllipse(fx, fy, 32, 20);
      g.fillStyle(0x384878, 0.6); g.fillEllipse(fx - 8, fy - 4, 20, 14);
    });

    const ux = ox + 600, uy = floorY - 8;
    g.fillStyle(0x485868, 1); g.fillRect(ux - 2, uy - 68, 4, 68);
    g.fillStyle(0x5a6e7a, 1);
    g.fillPoints([{ x: ux, y: uy - 68 }, { x: ux - 50, y: uy - 30 }, { x: ux + 50, y: uy - 30 }], true);
    g.fillStyle(0x485868, 1);
    g.fillRect(ux - 26, uy - 12, 52, 5);
    g.fillRect(ux - 20, uy - 7, 4, 14);
    g.fillRect(ux + 16, uy - 7, 4, 14);
    [-46, 36].forEach(cx2 => {
      g.fillStyle(0x404e5e, 1);
      g.fillRect(ux + cx2, uy - 18, 24, 14);
      g.fillRect(ux + cx2 + 2, uy - 30, 5, 12);
      g.fillRect(ux + cx2 + 17, uy - 30, 5, 12);
    });

    [ox + 340, ox + 540, ox + 700, ox + 900].forEach(lx => {
      const lby = floorY - 52;
      g.fillStyle(0x505868, 1); g.fillRect(lx - 2, lby - 36, 4, 36);
      g.fillStyle(C.winOn, 0.7); g.fillEllipse(lx, lby - 40, 11, 8);
      g.fillStyle(C.winGlow, 0.06); g.fillCircle(lx, lby - 40, 26);
    });

    const sbX = ox + wallW - 72;
    const sbY = floorY - 54;
    g.fillStyle(0x163820, 1); g.fillEllipse(sbX, sbY, 106, 64);
    g.fillStyle(0x1c4428, 1); g.fillEllipse(sbX - 26, sbY - 10, 68, 48);
    g.fillStyle(0x204e2e, 1); g.fillEllipse(sbX + 22, sbY - 8, 56, 42);

    const sbGlow = this.add.rectangle(sbX, sbY, 106, 64, 0x44ff88, 0.04).setDepth(2);
    this.tweens.add({ targets: sbGlow, alpha: { from: 0.02, to: 0.07 }, duration: 2400, yoyo: true, repeat: -1 });

    this.createDoor(sbX - 28, '002', 'Phase3Scene');
  }

  // ── Transição Fake 3D ─────────────────────────────
  transitionWall(direction) {
    console.log('transitionWall chamada:', direction);

    if (this.passingThrough) return;
    this.passingThrough = true;

    const goingRight = direction === 'right';
    const nextWall = goingRight ? this.currentWall + 1 : this.currentWall - 1;

    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);
    this.cameras.main.stopFollow();

    this.cameras.main.fade(350, 0, 0, 0);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: { from: 1.0, to: 1.06 },
      duration: 350,
      ease: 'Sine.easeIn'
    });

    this.time.delayedCall(400, () => {
      this.currentWall = nextWall;

      const wallStartX = (this.currentWall - 1) * 1400;
      const spawnX = goingRight ? wallStartX + 120 : wallStartX + 1280;

      // Atualiza hitbox do player conforme a parede
      if (this.currentWall === 4) {
        this.player.body.setSize(24, 40);
      } else {
        this.player.body.setSize(36, 60);
      }

      this.player.setPosition(spawnX, this.floorY - 80);

      this.cameras.main.setBounds(wallStartX, 0, 1400, GAME_H);
      this.cameras.main.centerOn(spawnX, GAME_H / 2);

      this.tweens.add({
        targets: this.cameras.main,
        zoom: { from: 1.06, to: 1.0 },
        duration: 400,
        ease: 'Sine.easeOut'
      });

      this.player.body.setAllowGravity(true);
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.fadeIn(400, 0, 0, 0);

      this.time.delayedCall(500, () => { this.passingThrough = false; });
    });
  }

  setupWorld() {
    this.physics.world.setBounds(0, 0, this.worldWidth, GAME_H);
    this.cameras.main.setBounds(0, 0, 1400, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  createJeremiah() {
    this.lightFlickering = false;

    this.jeremiah = this.physics.add.sprite(1800, this.floorY - 60)
      .setVisible(false)
      .setCollideWorldBounds(true);
    this.jeremiah.body.setSize(30 * this.s, 60 * this.s);
    this.jeremiah.body.setGravityY(400 * this.s);
    this.jeremiahGfx = this.add.graphics().setDepth(6);

    this.hibells = this.add.text(0, 0, '"Hi, Bells..."', {
      fontSize: `${13 * this.s}px`,
      fontFamily: 'Courier New',
      color: '#aaffaa',
      letterSpacing: 1 * this.s,
      backgroundColor: '#0a1a0a',
      padding: { x: 6 * this.s, y: 4 * this.s }
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
  }

  drawJeremiah() {
    const x = this.jeremiah.x, y = this.jeremiah.y;
    const g = this.jeremiahGfx, s = this.s;
    g.clear();
    const wallStartX = (this.currentWall - 1) * 1400;
    const wallEndX = wallStartX + 1400;
    if (x < wallStartX || x > wallEndX) return;

    const skinColor = 0xc8956c;
    const hairColor = 0xf5c542;
    const shirtColor = 0xffffff;
    const shortsColor = 0xcc2222;
    const shoeColor = 0xeeeeee;
    const eyeColor = 0x44ccff;

    // --- CABELO ---
    g.fillStyle(hairColor, 1);
    g.fillRect(x - 11 * s, y - 105 * s, 22 * s, 10 * s); // topo
    g.fillRect(x - 15 * s, y - 98 * s, 7 * s, 8 * s);    // lateral esq
    g.fillRect(x + 8 * s, y - 98 * s, 7 * s, 8 * s);    // lateral dir

    // --- CABEÇA ---
    g.fillStyle(skinColor, 1);
    g.fillRect(x - 11 * s, y - 97 * s, 22 * s, 28 * s);

    // --- OLHOS ---
    g.fillStyle(eyeColor, 1);
    g.fillRect(x - 8 * s, y - 86 * s, 5 * s, 5 * s);
    g.fillRect(x + 3 * s, y - 86 * s, 5 * s, 5 * s);

    // --- PESCOÇO ---
    g.fillStyle(skinColor, 1);
    g.fillRect(x - 5 * s, y - 69 * s, 10 * s, 8 * s);

    // --- CAMISETA (torso) ---
    g.fillStyle(shirtColor, 1);
    g.fillRect(x - 14 * s, y - 61 * s, 28 * s, 32 * s);

    // --- BRAÇOS ---
    g.fillStyle(skinColor, 1);
    g.fillRect(x - 22 * s, y - 60 * s, 8 * s, 30 * s); // esquerdo
    g.fillRect(x + 14 * s, y - 60 * s, 8 * s, 30 * s); // direito

    // --- SHORTS ---
    g.fillStyle(shortsColor, 1);
    g.fillRect(x - 14 * s, y - 29 * s, 28 * s, 20 * s);

    // --- PERNAS ---
    g.fillStyle(skinColor, 1);
    g.fillRect(x - 13 * s, y - 9 * s, 11 * s, 28 * s); // esquerda
    g.fillRect(x + 2 * s, y - 9 * s, 11 * s, 28 * s); // direita

    // --- TÊNIS ---
    g.fillStyle(shoeColor, 1);
    g.fillRect(x - 14 * s, y + 19 * s, 13 * s, 6 * s); // esquerdo
    g.fillRect(x + 1 * s, y + 19 * s, 13 * s, 6 * s); // direito

    // --- AURA (quando olhando) ---
    if (this.jeremiahLooking) {
      g.fillStyle(0x00ff00, 0.06);
      g.fillCircle(x, y - 50 * s, 65 * s);
    }
  }

  checkJeremiah() {
    // ── Piscar das luzes por proximidade ─────────────────
    const distJer = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.jeremiah.x, this.jeremiah.y
    );

    if (distJer < 1500 && !this.lightFlickering) {
      this.lightFlickering = true;

      let flashes = 0;
      this.time.addEvent({
        delay: 5000,
        repeat: 2,
        callback: () => {
          const on = flashes % 2 === 0;
          const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xfffde0, on ? 0.18 : 0)
            .setScrollFactor(0).setDepth(20);
          this.time.delayedCall(160, () => flash.destroy());
          flashes++;
        }
      });
    }

    if (this.inWardrobe) { this.jeremiahLooking = false; return; }
    const wallStartX = (this.currentWall - 1) * 1400;
    const wallEndX = wallStartX + 1400;
    if (this.jeremiah.x < wallStartX || this.jeremiah.x > wallEndX) return;
    const dx = Math.abs(this.player.x - this.jeremiah.x);
    const dy = Math.abs(this.player.y - this.jeremiah.y);
    const facingRight = this.jeremiahDir > 0;
    const playerInFront = facingRight
      ? this.player.x > this.jeremiah.x
      : this.player.x < this.jeremiah.x;
    if (dx < 220 * this.s && dy < 90 * this.s && playerInFront && !this.hitCooldown) {
      this.jeremiahLooking = true;
      this.hitCooldown = true;
      this.hibells.setPosition(this.jeremiah.x, this.jeremiah.y - 110 * this.s).setAlpha(1);
      this.tweens.killTweensOf(this.hibells);
      this.tweens.add({ targets: this.hibells, alpha: 0, duration: 1000, delay: 1000 });
      if (GameState.damage(2, this)) { this.transitionTo('GameOverScene'); return; }
      const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x00ff00, 0.25)
        .setScrollFactor(0).setDepth(25);
      this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      this.time.delayedCall(4000, () => { this.hitCooldown = false; });
    } else if (dx >= 220 * this.s || !playerInFront) {
      this.jeremiahLooking = false;
    }
  }

  // ─── VERIFICA E ABRE GAVETAS ──────────────────────
  checkDrawers() {
    for (let d of this.drawers) {
      if (d.searched) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.zone.x, d.zone.y);
      if (dist > 70 * this.s) continue;

      d.searched = true;
      this.sound.play('som_gaveta', { volume: 1.2 });

      const dg = this.add.graphics().setDepth(3);
      const { dx, dy, dw, dh } = d;

      if (d.wall === 1) {
        // Gaveta cozinha (ch=75) — animação de abrir
        dg.fillStyle(0x888898);
        dg.fillRect(dx + 2, dy, dw - 2, dh * 0.45);           // frente da gaveta aberta
        dg.fillStyle(0xd8e0e8);
        dg.fillRect(dx + 2, dy + dh * 0.45, dw - 2, dh * 0.55); // interior
        dg.fillStyle(0xb8c4cc);
        dg.fillRect(dx + 2, dy + dh * 0.55, dw - 2, dh * 0.45); // fundo
        dg.lineStyle(1, 0xa8b4c0);
        dg.strokeRect(dx + 2, dy + dh * 0.45, dw - 2, dh * 0.55);
        dg.fillStyle(0x9898a8);
        dg.fillRect(dx + dw / 2 - 17, dy + dh * 0.6, 34, 4);   // puxador

      } else if (d.wall === 2) {
        // Gaveta fogão (chNew=95) — gavetas menores ao lado
        dg.fillStyle(0x888898);
        dg.fillRect(dx, dy, dw, dh * 0.45);
        dg.fillStyle(0xd8d4cc);
        dg.fillRect(dx + 2, dy + dh * 0.45, dw - 4, dh * 0.55);
        dg.fillStyle(0xb8c0c8);
        dg.fillRect(dx + 2, dy + dh * 0.6, dw - 4, dh * 0.4);
        dg.lineStyle(1, 0xa8b0b8);
        dg.strokeRect(dx + 2, dy + dh * 0.45, dw - 4, dh * 0.55);
        dg.fillStyle(0xa8b0b8);
        dg.fillRect(dx + dw / 2 - 14, dy + dh * 0.65, 28, 5);
        dg.fillStyle(0xb8c0c8);
        dg.fillRect(dx + dw / 2 - 16, dy + dh * 0.63, 32, 3);

      } else if (d.wall === 3) {
        // Gaveta bancada direita (chR=100)
        dg.fillStyle(0x888898);
        dg.fillRect(dx, dy, dw, dh * 0.45);
        dg.fillStyle(0xd8d4cc);
        dg.fillRect(dx + 2, dy + dh * 0.45, dw - 4, dh * 0.55);
        dg.fillStyle(0xb8c0c8);
        dg.fillRect(dx + 2, dy + dh * 0.6, dw - 4, dh * 0.4);
        dg.lineStyle(1, 0xa8b0b8);
        dg.strokeRect(dx + 2, dy + dh * 0.45, dw - 4, dh * 0.55);
        dg.fillStyle(0xb0b8c0);
        dg.fillRect(dx + dw / 2 - 16, dy + dh * 0.65, 32, 6);
        dg.fillStyle(0xd0d8e0);
        dg.fillRect(dx + dw / 2 - 18, dy + dh * 0.63, 36, 3);
        dg.fillStyle(0xa0a8b0);
        dg.fillRect(dx + dw / 2 - 18, dy + dh * 0.63, 5, 9);
        dg.fillRect(dx + dw / 2 + 13, dy + dh * 0.63, 5, 9);
      }

      // Se essa gaveta tem a chave — spawn visual + guarda coordenadas para checagem no update
      if (d.hasKey) {
        const keyX = dx + dw / 2;
        const keyY = dy + dh * 0.5;

        const kg = this.add.graphics().setDepth(4);
        kg.fillStyle(0xffdd44, 0.9); kg.fillCircle(keyX, keyY, 8);
        kg.fillStyle(0xffaa00); kg.fillCircle(keyX, keyY, 5);
        kg.fillRect(keyX + 2, keyY, 18, 4);
        kg.fillRect(keyX + 14, keyY + 4, 4, 4);
        kg.fillRect(keyX + 18, keyY + 4, 4, 4);

        const glow = this.add.rectangle(keyX, keyY, 24, 24, 0xffdd44, 0.06).setDepth(3);
        this.tweens.add({ targets: glow, alpha: { from: 0.02, to: 0.1 }, duration: 800, yoyo: true, repeat: -1 });

        // Guarda posição mundial — coleta verificada por distância no update()
        this.keyGfx = kg;
        this.keyGlow = glow;
        this.keyWorldX = null;
        this.keyWorldY = null;
        this.time.delayedCall(800, () => {
          this.keyWorldX = keyX;
          this.keyWorldY = keyY;
        });
      }

      return;
    }
  }

  handleInteract() {
    if (this.transitioning) return;

    if (this.inWardrobe) {
      for (let w of this.wardrobes) {
        if (this.isNear(w, 120)) {
          this.inWardrobe = false;
          this.player.body.setAllowGravity(true);
          this.tweens.add({ targets: this.playerGfx, alpha: 1, duration: 200 });
          this.tweens.add({ targets: this.playerShadow, alpha: 1, duration: 200 });
          return;
        }
      }
      return;
    }

    if (this.isNear(this.doorZone)) {
      if (!this.keyFound) { this.showLockedMessage(); return; }
      this.sound.play('som_porta', { volume: 1.2, seek: 0.5 });
      this.transitionTo(this.doorDestination);
      return;
    }

    for (let w of this.wardrobes) {
      if (this.isNear(w)) {
        this.inWardrobe = !this.inWardrobe;
        this.player.body.setAllowGravity(!this.inWardrobe);

        if (this.inWardrobe) {
          this.player.body.setVelocity(0, 0);
          this.tweens.add({ targets: this.playerGfx, alpha: 0, duration: 200 });
          this.tweens.add({ targets: this.playerShadow, alpha: 0, duration: 200 });
        } else {
          this.tweens.add({ targets: this.playerGfx, alpha: 1, duration: 200 });
          this.tweens.add({ targets: this.playerShadow, alpha: 1, duration: 200 });
        }
        return;
      }
    }

    this.checkDrawers();
  }

  update() {
    super.update();
    if (this.transitioning) return;

    // Bug 1: se estiver escondido, cancela qualquer velocidade que o super.update() aplicou via input
    if (this.inWardrobe) {
      this.player.body.setVelocity(0, 0);
    }

    // Jeremiah patrulha por todo o mundo (0 → 4200) — sempre, independente do armário
    this.jeremiah.body.setVelocityX(this.jeremiahSpeed * this.jeremiahDir);
    if (this.jeremiah.x > 4150 || this.jeremiah.x < 50) {
      this.jeremiahDir *= -1;
      this.jeremiah.x = Phaser.Math.Clamp(this.jeremiah.x, 51, 4149);
    }

    this.drawJeremiah();
    this.checkJeremiah();

    // Bug 3: checagem de coleta da chave por distância (funciona em qualquer wall)
    if (!this.keyFound && this.keyWorldX !== null && this.keyWorldX !== undefined) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.keyWorldX, this.keyWorldY);
      if (dist < 100) this.collectKey();
    }

    // Detecção de transição entre paredes
    if (!this.passingThrough) {
      if (this.currentWall === 1 && this.player.x >= 1350) {
        this.transitionWall('right');
      } else if (this.currentWall === 2 && this.player.x <= 1450) {
        this.transitionWall('left');
      } else if (this.currentWall === 2 && this.player.x >= 2750) {
        this.transitionWall('right');
      } else if (this.currentWall === 3 && this.player.x <= 2850) {
        this.transitionWall('left');
      } else if (this.currentWall === 3 && this.player.x >= 4160) {
        this.transitionWall('right');
      } else if (this.currentWall === 4 && this.player.x <= 4240) {
        this.transitionWall('left');
      }
    }

    // Prompts contextuais
    const nearWardrobe = this.wardrobes.some(w => this.isNear(w));
    const nearDrawer = this.drawers.some(d => !d.searched && this.isNear(d.zone));
    const nearDoor = this.isNear(this.doorZone);

    if (nearWardrobe && !this.activePrompt) {
      this.createPrompt(this.inWardrobe ? TEXTS.EXIT_HIDE : TEXTS.HIDE, -70 * this.s, '#44ff44');
    } else if (nearDrawer && !this.activePrompt) {
      this.createPrompt('[E] Vasculhar', -70 * this.s, '#ffdd88');
    } else if (nearDoor && !this.activePrompt) {
      this.createPrompt(this.keyFound ? TEXTS.ENTER : 'Trancada', -70 * this.s, this.keyFound ? '#ffdd44' : '#ff6666');
    } else if (!nearWardrobe && !nearDrawer && !nearDoor && this.activePrompt) {
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
  }

  init() {
    super.init();
    this.worldWidth = 2000;
  }

  create() {
    super.create();
    this.sound.stopAll();
    this.sound.play('musica_fase3', { loop: true, volume: 1.0 });
    GameState.door = 3;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_3);
    this.physics.world.setBounds(0, 0, this.worldWidth, GAME_H + 100);

    // ── Estado da fase ──────────────────────────────────────────────────
    this.timeLeft = 80;
    this.keyFound = false;
    this.gameActive = true;
    this.hitCooldown = false;
    this.underwaterTimer = null;
    this.stepXRef = 750;

    // ── Estado da água ──────────────────────────────────────────────────
    this.waterLevelBase = 200;
    this.waterLevelLow = GAME_H + 100;
    this.waterLevel = GAME_H + 300;
    this.waterTargetLevel = GAME_H + 100;
    this.waterRiseSpeed = 1.0;
    this.waterFallSpeed = 2.0;
    this.waterRising = false;

    // ── Estado dos puzzles ──────────────────────────────────────────────
    this.lever1Active = false;
    this.lever2Active = false;
    this.button1Revealed = false;
    this.button1Pressed = false;
    this.button2Revealed = false;
    this.button2Pressed = false;
    this.doorBlockOpen = false;
    this.doorBlockTimer = null;
    this.concreteSliding = false;
    this.doorBlockY = 0;
    this.doorBlockTargetY = 0;

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
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 125);

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

    g.fillStyle(0x0d1e2a);
    g.fillRect(0, floorY1, stepX, 80);
    g.fillStyle(0x1a3444);
    g.fillRect(0, floorY1, stepX, 3);

    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX, floorY1 + 20, 80, 80);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 80);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 80);
    g.fillStyle(0x1a3444);
    g.fillRect(stepX, floorY1 + 20, 80, 3);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 3);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 3);

    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 100);
    g.fillStyle(0x1a3444);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 3);

    g.fillStyle(0x050d14);
    g.fillRect(0, 0, this.worldWidth, 30);
    g.fillStyle(0x080f18);
    g.fillRect(0, 0, 20, GAME_H + 150);
    g.fillRect(this.worldWidth - 20, 0, 20, GAME_H + 150);

    const floor1 = this.add.rectangle(stepX / 2, floorY1 + 40, stepX, 80).setVisible(false);
    this.physics.add.existing(floor1, true);
    this.platforms.add(floor1);

    [
      { x: stepX + 40, y: floorY1 + 60, w: 80 },
      { x: stepX + 120, y: floorY1 + 80, w: 80 },
      { x: stepX + 200, y: floorY1 + 100, w: 80 },
    ].forEach(s => {
      const r = this.add.rectangle(s.x, s.y, s.w, 80).setVisible(false);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    });

    const floor2W = this.worldWidth - stepX - 240;
    const floor2 = this.add.rectangle(stepX + 240 + floor2W / 2, floorY2 + 50, floor2W, 100).setVisible(false);
    this.physics.add.existing(floor2, true);
    this.platforms.add(floor2);

    const wallL = this.add.rectangle(10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    const wallR = this.add.rectangle(this.worldWidth - 10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    [wallL, wallR].forEach(w => {
      this.physics.add.existing(w, true);
      this.platforms.add(w);
    });

    const platforms1 = [
      { x: 70, y: 170, w: 100 },
      { x: 210, y: 300, w: 110 },
      { x: 410, y: 250, w: 110 },
      { x: 570, y: 170, w: 120 },
      { x: 760, y: 240, w: 100 },
    ];

    const platforms2 = [
      { x: 1500, y: floorY2 - 230, w: 130 },
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

    const doorPlatY = 110;
    const doorPlatX = this.worldWidth - 250;
    const doorPlatW = 220;

    g.fillStyle(0x1a2d40);
    g.fillRect(doorPlatX, doorPlatY, doorPlatW, 18);
    g.fillStyle(0x2a4a64);
    g.fillRect(doorPlatX, doorPlatY, doorPlatW, 3);

    const doorPlat = this.add.rectangle(doorPlatX + doorPlatW / 2, doorPlatY + 9, doorPlatW, 18).setVisible(false);
    this.physics.add.existing(doorPlat, true);
    this.platforms.add(doorPlat);

    this.doorPlatX = doorPlatX;
    this.doorPlatY = doorPlatY;
    this.doorPlatW = doorPlatW;

    const dx = doorPlatX + doorPlatW / 2 - 27;
    const dy = doorPlatY - 95;
    const dw = 55, dh = 95;
    this.buildDoor(dx, dy, dw, dh);
    this.drawDoorConcreteBlocks(dx, dy, dw, dh);
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

    this.doorDx = dx; this.doorDy = dy; this.doorDw = dw; this.doorDh = dh;
  }

  // Blocos fixos ao redor da porta — mais grossos e afastados
  drawDoorConcreteBlocks(dx, dy, dw, dh) {
    const g = this.add.graphics().setDepth(7);

    // Bloco superior — mais grosso e afastado
    g.fillStyle(0x2a3a4a);
    g.fillRect(dx - 18, dy - 22, dw + 36, 18);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(dx - 18, dy - 22, dw + 36, 2);

    // Bloco direito — mais grosso e afastado
    g.fillStyle(0x2a3a4a);
    g.fillRect(dx + dw + 10, dy - 22, 18, dh + 32);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(dx + dw + 10, dy - 22, 2, dh + 32);

    // Física bloco direito
    const rightBlock = this.add.rectangle(
      dx + dw + 10 + 9, dy - 22 + (dh + 32) / 2,
      18, dh + 32
    ).setVisible(false);
    this.physics.add.existing(rightBlock, true);
    this.platforms.add(rightBlock);

    // Física bloco superior
    const topBlock = this.add.rectangle(
      dx - 18 + (dw + 36) / 2, dy - 22 + 9,
      dw + 36, 18
    ).setVisible(false);
    this.physics.add.existing(topBlock, true);
    this.platforms.add(topBlock);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BLOCO ESQUERDO DA PORTA (controlado pelo botão 2)
  // ════════════════════════════════════════════════════════════════════════
  createDoorBlock() {
    const dx = this.doorDx, dy = this.doorDy, dh = this.doorDh;

    const bx = dx - 28;     // mais afastado da porta
    const bw = 18;           // mais grosso
    const bh = dh + 32;      // mais alto para cobrir tudo
    const by = dy - 22;      // alinhado com os outros blocos

    this.doorBlockClosedY = by;
    this.doorBlockOpenY = by - bh - 20;
    this.doorBlockY = by;
    this.doorBlockTargetY = by;

    this._doorBlockBx = bx;
    this._doorBlockBw = bw;
    this._doorBlockBh = bh;

    this.doorBlockGfx = this.add.graphics().setDepth(9);
    this._redrawDoorBlock();

    this.doorBlockPhysRect = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh).setVisible(false);
    this.physics.add.existing(this.doorBlockPhysRect, true);
    this.platforms.add(this.doorBlockPhysRect);
  }

  _redrawDoorBlock() {
    const g = this.doorBlockGfx;
    g.clear();
    if (this.doorBlockOpen && this.doorBlockY <= this.doorBlockOpenY + 5) return;

    const bx = this._doorBlockBx;
    const bw = this._doorBlockBw;
    const bh = this._doorBlockBh;
    const by = this.doorBlockY;

    g.fillStyle(0x2a3a4a);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x3a5060, 0.6);
    g.fillRect(bx, by, 2, bh);
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + bw / 2, by + 8, 2);
    g.fillCircle(bx + bw / 2, by + bh - 8, 2);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALAVANCA 1
  // ════════════════════════════════════════════════════════════════════════
  createLever1() {
    const lx = 630;
    const ly = 140;

    this.lever1X = lx;
    this.lever1Y = ly;
    this.lever1Gfx = this.add.graphics().setDepth(5);
    this._drawLever(this.lever1Gfx, lx, ly, this.lever1Active, 1);

    this.lever1Zone = this.add.zone(lx, ly - 10, 40, 50);
    this.physics.add.existing(this.lever1Zone, true);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALAVANCA 2
  // ════════════════════════════════════════════════════════════════════════
  createLever2() {
    const platY = this.floorY2 - 230;
    const platX = 1500;
    const platW = 130;

    const lx = platX + platW / 2;
    const ly = platY - 32;

    this.lever2X = lx;
    this.lever2Y = ly;
    this.lever2Gfx = this.add.graphics().setDepth(5);
    this._drawLever(this.lever2Gfx, lx, ly, this.lever2Active, 2);

    this.lever2Zone = this.add.zone(lx, ly - 10, 40, 50);
    this.physics.add.existing(this.lever2Zone, true);

    this.lever2RequiredWaterLevel = platY + 60;
  }

  _drawLever(g, x, y, active, id) {
    g.clear();
    g.fillStyle(0x334455);
    g.fillRect(x - 12, y + 10, 24, 14);
    g.fillStyle(0x445566);
    g.fillRect(x - 12, y + 10, 24, 3);

    const angle = active ? -0.7 : 0.7;
    const len = 28;
    const ex = x + Math.sin(angle) * len;
    const ey = (y + 10) - Math.cos(angle) * len;

    g.lineStyle(4, active ? 0x44ffaa : 0x888899);
    g.beginPath();
    g.moveTo(x, y + 10);
    g.lineTo(ex, ey);
    g.strokePath();

    g.fillStyle(active ? 0x44ffaa : 0xaabbcc);
    g.fillCircle(ex, ey, 6);

    g.fillStyle(active ? 0x44ffaa : 0x556677, 0.9);
    g.fillRect(x - 8, y + 26, 16, 5);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOTÕES
  // ════════════════════════════════════════════════════════════════════════
  _drawButton(g, x, y, pressed, color) {
    g.clear();
    const col = Phaser.Display.Color.HexStringToColor(color).color;
    const w = 44, h = 10, r = 7;

    g.fillStyle(0x111820);
    g.fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h);

    g.fillStyle(pressed ? col : 0x1e2e3e);
    g.fillRect(x - w / 2, y - h / 2, w, h);

    g.lineStyle(1.5, col, pressed ? 1.0 : 0.45);
    g.strokeRect(x - w / 2, y - h / 2, w, h);

    g.fillStyle(pressed ? col : 0x2a3e52);
    g.fillCircle(x, y - h / 2, r);
    g.lineStyle(1.5, col, pressed ? 1.0 : 0.45);
    g.strokeCircle(x, y - h / 2, r);

    g.fillStyle(0xffffff, pressed ? 0.35 : 0.08);
    g.fillCircle(x - 2, y - h / 2 - 2, r * 0.45);

    g.fillStyle(col, pressed ? 0.9 : 0.3);
    g.fillCircle(x - w / 2 + 6, y, 2);
    g.fillCircle(x + w / 2 - 6, y, 2);
  }

  _createButtonSensor(zone, onActivate) {
    this.physics.add.overlap(this.player, zone, () => onActivate(), null, this);
    if (this.crate) {
      this.physics.add.overlap(this.crate, zone, () => onActivate(), null, this);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOTÃO 1 + estrutura de concreto + caixote
  // ════════════════════════════════════════════════════════════════════════
  createButton1Setup() {
    const btn1X = 1200;
    const btn1Y = this.floorY2;

    this.btn1X = btn1X;
    this.btn1Y = btn1Y;

    this._drawButton1Setup();
    this._createCrate();
    this._createRock2();
  }

  _drawButton1Setup() {
    const bx = this.btn1X;
    const by = this.btn1Y;
    const bw = 16;
    const inner = 60;
    const bh = 70;
    const tbh = 12;

    this._btn1Bx = bx;
    this._btn1By = by;
    this._btn1Bw = bw;
    this._btn1Bh = bh;
    this._btn1TbH = tbh;
    this._btn1Inner = inner;

    const g = this.add.graphics().setDepth(4);

    g.fillStyle(0x2a3a4a);
    g.fillRect(bx - bw, by - bh, bw, bh);
    g.fillStyle(0x3a5060, 0.5);
    g.fillRect(bx - bw, by - bh, bw, 2);
    g.fillRect(bx - bw, by - bh, 2, bh);
    g.fillStyle(0x1a2530);
    g.fillCircle(bx - bw + 5, by - bh + 8, 2);
    g.fillCircle(bx - bw + 5, by - 8, 2);

    g.fillStyle(0x2a3a4a);
    g.fillRect(bx + inner, by - bh, bw, bh);
    g.fillStyle(0x3a5060, 0.5);
    g.fillRect(bx + inner, by - bh, bw, 2);
    g.fillRect(bx + inner + bw - 2, by - bh, 2, bh);
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + inner + bw - 5, by - bh + 8, 2);
    g.fillCircle(bx + inner + bw - 5, by - 8, 2);

    const leftBlock = this.add.rectangle(bx - bw / 2, by - bh / 2, bw, bh).setVisible(false);
    const rightBlock = this.add.rectangle(bx + inner + bw / 2, by - bh / 2, bw, bh).setVisible(false);
    this.physics.add.existing(leftBlock, true);
    this.physics.add.existing(rightBlock, true);
    this.platforms.add(leftBlock);
    this.platforms.add(rightBlock);

    this.slidingBlockGfx = this.add.graphics().setDepth(6);
    this.slidingBlockX = bx - bw;
    this.slidingBlockTargX = bx - bw;
    this.slidingBlockW = bw + inner + bw;
    this._redrawSlidingBlock();

    const slidingTopY = by - bh - tbh;
    this.slidingBlockPhys = this.add.rectangle(
      bx - bw + (bw + inner + bw) / 2,
      slidingTopY + tbh / 2,
      bw + inner + bw,
      tbh
    ).setVisible(false);
    this.physics.add.existing(this.slidingBlockPhys, true);
    this.platforms.add(this.slidingBlockPhys);

    const btnCenterX = bx + inner / 2;
    this.btn1Gfx = this.add.graphics().setDepth(5);
    this._drawButton(this.btn1Gfx, btnCenterX, by - 4, false, '#ffaa00');

    this.button1Zone = this.add.zone(btnCenterX, by - 4, inner, 20);
    this.physics.add.existing(this.button1Zone, true);

    this._createButtonSensor(this.button1Zone, () => {
      if (!this.button1Revealed || this.button1Pressed) return;
      this.button1Pressed = true;
      this._drawButton(this.btn1Gfx, btnCenterX, by - 4, true, '#ffaa00');
      this.rock2TargX = this.btn2X + this.rock2W + 20;
      this.time.delayedCall(800, () => { this._createButton2(); });
    });
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
    g.fillStyle(0x1a2530);
    g.fillCircle(bx + 8, by + bh / 2, 2);
    g.fillCircle(bx + bw - 8, by + bh / 2, 2);
  }

  _createCrate() {
    const cx = this._btn1Bx + this._btn1Bw + this._btn1Inner + this._btn1Bw + 40;
    const cy = this._btn1By - 14;

    this.crateGfx = this.add.graphics().setDepth(7);

    this.crate = this.physics.add.image(cx, cy, '__DEFAULT').setVisible(false);
    this.crate.setDisplaySize(28, 28);
    this.crate.body.setSize(28, 28);
    this.crate.body.setCollideWorldBounds(false);
    this.crate.body.setBounce(0.1);
    this.crate.body.setDragX(400);
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

    g.fillStyle(0x8B5E3C);
    g.fillRect(cx, cy, s, s);

    g.lineStyle(1, 0x5a3a20, 0.8);
    g.beginPath(); g.moveTo(cx + s / 3, cy); g.lineTo(cx + s / 3, cy + s); g.strokePath();
    g.beginPath(); g.moveTo(cx + 2 * s / 3, cy); g.lineTo(cx + 2 * s / 3, cy + s); g.strokePath();
    g.beginPath(); g.moveTo(cx, cy + s / 3); g.lineTo(cx + s, cy + s / 3); g.strokePath();
    g.beginPath(); g.moveTo(cx, cy + 2 * s / 3); g.lineTo(cx + s, cy + 2 * s / 3); g.strokePath();

    g.lineStyle(2, 0x3a2010, 0.9);
    g.strokeRect(cx, cy, s, s);

    g.fillStyle(0xffffff, 0.08);
    g.fillRect(cx + 2, cy + 2, s - 4, 4);
  }

  _pushCrate(player, crate) {
    const dir = crate.x > player.x ? 1 : -1;
    crate.body.setVelocityX(dir * 180);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOTÃO 2 — abre bloco esquerdo da porta
  //  Player OU caixote ativam. Fecha 8s após saírem.
  // ════════════════════════════════════════════════════════════════════════
  _createButton2() {
    this.btn2Gfx = this.add.graphics().setDepth(5);
    this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y - 4, false, '#00aaff');

    this.button2Zone = this.add.zone(this.btn2X, this.btn2Y - 4, 50, 20);
    this.physics.add.existing(this.button2Zone, true);
    this.button2Revealed = true;

    // Player ativa
    this.physics.add.overlap(this.player, this.button2Zone, () => {
      this._activateButton2();
    }, null, this);

    // Caixote também ativa
    if (this.crate) {
      this.physics.add.overlap(this.crate, this.button2Zone, () => {
        this._activateButton2();
      }, null, this);
    }
  }

  _activateButton2() {
    if (!this.button2Revealed) return;
    if (!this.doorBlockOpen) {
      this.doorBlockOpen = true;
      this.doorBlockTargetY = this.doorBlockOpenY;
      this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y - 4, true, '#00aaff');
    }
    // Cancela timer de fechar enquanto algo estiver em cima
    if (this.doorBlockTimer) {
      this.doorBlockTimer.remove();
      this.doorBlockTimer = null;
    }
  }

  _redrawRock2() {
    const g = this.rock2Gfx;
    g.clear();
    const rx = this.rock2X - this.rock2W / 2;
    const ry = this.btn2Y - this.rock2H;
    const rw = this.rock2W;
    const rh = this.rock2H;

    g.fillStyle(0x4a5560);
    g.fillRect(rx + 4, ry, rw - 8, rh);
    g.fillRect(rx, ry + 6, rw, rh - 10);
    g.fillStyle(0x5a6570);
    g.fillTriangle(rx + 4, ry, rx + rw / 2, ry - 8, rx + rw - 4, ry);
    g.fillStyle(0x2a3540, 0.6);
    g.fillRect(rx + 4, ry + rh - 5, rw - 8, 4);
    g.fillStyle(0x7a8a99, 0.4);
    g.fillRect(rx + 6, ry + 4, 8, 3);
  }

  _updateRock2() {
    if (!this.rock2Gfx) return;
    const diff = this.rock2X - this.rock2TargX;
    if (Math.abs(diff) > 0.5) {
      this.rock2X -= diff * 0.08;
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
    this.rock2TargX = b2x;

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

    const diff = this.waterLevel - this.waterTargetLevel;
    if (Math.abs(diff) > 0.5) {
      this.waterLevel -= diff * 0.04 * this.waterRiseSpeed;
    } else {
      this.waterLevel = this.waterTargetLevel;
    }

    const g = this.waterGfx;
    g.clear();

    if (this.waterLevel >= GAME_H) return;

    g.fillStyle(0x0044aa, 0.4);
    g.fillRect(0, this.waterLevel, this.worldWidth, GAME_H + 200 - this.waterLevel);

    const t = this.time.now / 800;
    g.fillStyle(0x2266cc, 0.25);
    for (let wx = 0; wx < this.worldWidth; wx += 80) {
      const wave = Math.sin(t + wx * 0.02) * 3;
      g.fillRect(wx, this.waterLevel + wave, 80, 6);
    }
    g.fillStyle(0x44aaff, 0.12);
    g.fillRect(0, this.waterLevel + 4, this.worldWidth, 3);

    const isUnderwater = this.player.y > this.waterLevel && this.player.y < this.waterLevel + 200;

    if (isUnderwater && !this.transitioning) {
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
            if (GameState.damage(1, this)) {
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

      if (this.crate && this.crate.y > this.waterLevel) {
        const submerge = Math.min(1, (this.crate.y - this.waterLevel) / 28);
        this.crate.body.setGravityY(-500 * submerge);
        this.crate.body.setMaxVelocityY(60);
        this.crate.body.setDragX(300);
      }
    } else {
      this.player.body.setGravityY(700);
      this.player.body.setMaxVelocityY(900);

      if (this.underwaterTimer) {
        this.underwaterTimer.remove();
        this.underwaterTimer = null;
      }

      if (this.crate && this.crate.y <= this.waterLevel) {
        this.crate.body.setGravityY(300);
        this.crate.body.setMaxVelocityY(400);
        this.crate.body.setDragX(200);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ANIMAÇÕES DE BLOCOS
  // ════════════════════════════════════════════════════════════════════════
  _updateSlidingBlock() {
    const diff = this.slidingBlockX - this.slidingBlockTargX;
    if (Math.abs(diff) > 0.5) {
      this.slidingBlockX -= diff * 0.08;
      this.slidingBlockPhys.x = this.slidingBlockX + this.slidingBlockW / 2;
      this.slidingBlockPhys.body.reset(this.slidingBlockPhys.x, this.slidingBlockPhys.y);
      this._redrawSlidingBlock();
    }
  }

  _updateDoorBlock() {
    const diff = this.doorBlockY - this.doorBlockTargetY;
    if (Math.abs(diff) > 0.5) {
      this.doorBlockY -= diff * 0.07;
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

    if (this.isNear(this.doorZone)) {
      if (!this.doorBlockOpen) {
        this.showLockedMessage();
        return;
      }
      this.transitionTo(this.doorDestination);
      return;
    }

    if (this.isNear(this.lever1Zone)) {
      this.lever1Active = !this.lever1Active;
      this._drawLever(this.lever1Gfx, this.lever1X, this.lever1Y, this.lever1Active, 1);
      if (this.lever1Active) {
        this.waterTargetLevel = this.waterLevelBase;
      } else {
        this.waterTargetLevel = this.waterLevel;
      }
      return;
    }

    if (this.isNear(this.lever2Zone)) {
      if (this.lever2Active) return;
      this.lever2Active = true;
      this._drawLever(this.lever2Gfx, this.lever2X, this.lever2Y, true, 2);
      this.lever1Active = false;
      this._drawLever(this.lever1Gfx, this.lever1X, this.lever1Y, false, 1);
      this.waterTargetLevel = this.waterLevelLow;
      this.slidingBlockTargX = this._btn1Bx + this._btn1Bw * 2 + 20;
      this._scheduleRevealButton1();
      return;
    }
  }

  _scheduleRevealButton1() {
    this.time.delayedCall(1500, () => {
      this.button1Revealed = true;
    });
  }

  _closeDoorBlock() {
    this.doorBlockOpen = false;
    this.doorBlockTargetY = this.doorBlockClosedY;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SALMÕES
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
        if (GameState.damage(1, this)) this.transitionTo('GameOverScene');

        // Flash de impacto
        const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff4400, 0.35)
          .setScrollFactor(0).setDepth(25);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
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
  //  DECORAÇÃO
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
    this.timerText = this.add.text(GAME_W / 2, 20, '80', {
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
          if (GameState.damage(1, this)) {
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
      repeat: 79
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

    // ── Botão 2: timer de 8s para fechar após player/caixote saírem ─────
    if (this.button2Revealed && this.doorBlockOpen) {
      const playerOnBtn = this.isNear(this.button2Zone, 30);
      const crateOnBtn = this.crate &&
        Math.abs(this.crate.x - this.btn2X) < 30 &&
        Math.abs(this.crate.y - this.btn2Y) < 35;
      const somethingOnBtn = playerOnBtn || crateOnBtn;

      if (somethingOnBtn) {
        // Algo em cima — cancela timer de fechar
        if (this.doorBlockTimer) {
          this.doorBlockTimer.remove();
          this.doorBlockTimer = null;
        }
      } else {
        // Nada em cima — inicia timer de 8s se ainda não iniciou
        if (!this.doorBlockTimer) {
          this.doorBlockTimer = this.time.delayedCall(8000, () => {
            this._closeDoorBlock();
            if (this.btn2Gfx) {
              this._drawButton(this.btn2Gfx, this.btn2X, this.btn2Y - 4, false, '#00aaff');
            }
            this.doorBlockTimer = null;
          });
        }
      }
    }

    // ── Prompts de interação ────────────────────────────────────────────
    let promptText = null;
    let promptColor = '#ffdd44';

    if (this.isNear(this.doorZone)) {
      promptText = this.doorBlockOpen ? TEXTS.ENTER : '🔒';
      promptColor = this.doorBlockOpen ? '#ffdd44' : '#ff6666';
    } else if (this.isNear(this.lever1Zone)) {
      promptText = this.lever1Active ? '⬇ Alavanca' : '⬆ Alavanca';
      promptColor = '#44ffaa';
    } else if (this.isNear(this.lever2Zone)) {
      promptText = '⬇ Alavanca';
      promptColor = '#44ffaa';
    } else if (this.button1Revealed && !this.button1Pressed && this.isNear(this.button1Zone)) {
      promptText = '● Botão';
      promptColor = '#ffaa00';
    } else if (this.button2Revealed && this.isNear(this.button2Zone)) {
      promptText = '● Botão';
      promptColor = '#00aaff';
    }

    if (promptText && !this.activePrompt) {
      this.createPrompt(promptText, -70, promptColor);
    } else if (!promptText && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    } else if (promptText && this.activePrompt && this.activePrompt.text !== promptText) {
      this.activePrompt.destroy();
      this.activePrompt = null;
      this.createPrompt(promptText, -70, promptColor);
    }
  }
}

// =============================================
//  CENA: FASE 4 - ACADEMIA ESCURA  (v5)
// =============================================
class Phase4Scene extends BaseScene {
  constructor() {
    super('Phase4Scene');
    this.worldWidth = Math.round(GAME_W * 3.5);
  }

  preload() {
    this.load.image('screech', 'assets/images/screech.png');
    this.load.audio('psst', 'assets/audio/psst.mp3');
    this.load.audio('som_chave', 'assets/audio/key.ogg');
    this.load.audio('screech_jumpscare', 'assets/audio/screech jumpscare.mp3');
  }

  create() {
    super.create();
    this.sound.stopAll();
    GameState.door = 5;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_4);

    // ── ESTADO ─────────────────────────────────────────────
    this.keyFound = false;
    this.screechDerrotado = false;
    this.portaAberta = false;
    this.bauAberto = false;
    this.emJumpscare = false;   // bloqueia tudo durante o jumpscare
    this.screechVulneravel = false;   // primeiros 5s invulnerável
    this.scaleTween = null;

    // Timer — quando estoura dispara o jumpscare
    this.tempoPassado = 0;
    this.tempoLimite = 30000; // 30s até o 1º susto
    this.cicloAtaque = 0;
    this.punicaoAplicada = false;

    // ── CENÁRIO ────────────────────────────────────────────
    this.platforms = this.physics.add.staticGroup();
    this.buildAcademia();

    // ── BAÚ ────────────────────────────────────────────────
    this.criarBau();

    // ── SCREECH ────────────────────────────────────────────
    this.screechObj = this.criarScreech();

    // Screech invulnerável nos primeiros 5s
    this.time.delayedCall(5000, () => { this.screechVulneravel = true; });

    // ── ESCURIDÃO ──────────────────────────────────────────
    this.escuridaoRect = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.escuridaoRect.fillStyle(0x000000, 0.97);
    this.escuridaoRect.fillRect(0, 0, GAME_W, GAME_H);

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

    // ── PSST em 7s — cria tensão ───────────────────────────
    this.time.delayedCall(7000, () => {
      this.sound.play('psst', { volume: 1.2 });
    });
  }

  // ── CENÁRIO ───────────────────────────────────────────────
  buildAcademia() {
    const g = this.add.graphics().setDepth(1);
    const W = this.worldWidth;
    const fy = this.floorY;

    g.fillStyle(0x050508);
    g.fillRect(0, 0, W, GAME_H);

    for (let x = 0; x < W; x += 40) {
      g.fillStyle(x % 80 === 0 ? 0x0e0e14 : 0x0b0b10);
      g.fillRect(x, fy, 40, 60);
    }
    g.fillStyle(0x1a1a28);
    g.fillRect(0, fy, W, 3);

    g.fillStyle(0x080810);
    g.fillRect(0, 0, W, 28);
    g.fillStyle(0x111118);
    g.fillRect(0, 28, W, 4);

    const floor = this.add.rectangle(W / 2, fy + 30, W, 60).setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    [120, 480, 900, 1380, 1820, 2300, 2750].forEach(x => this._esteira(g, x, fy));
    [300, 660, 1050, 1530, 1980, 2450, 2900].forEach(x => this._halteres(g, x, fy));
    [60, 340, 700, 1100, 1560, 2000, 2460, 2880, 3200].forEach(x => this._espelho(g, x, fy));

    [
      { x: 820, y: fy - 55, w: 100 },
      { x: 1150, y: fy - 75, w: 110 },
      { x: 1460, y: fy - 60, w: 100 },
      { x: 1750, y: fy - 80, w: 120 },
      { x: 2080, y: fy - 60, w: 100 },
      { x: 2380, y: fy - 75, w: 110 },
      { x: 2700, y: fy - 55, w: 100 },
      { x: 3000, y: fy - 70, w: 120 },
    ].forEach(b => this._banco(g, b));

    // Plataforma degrau — jogador sobe aqui primeiro
    const degX = 300, degY = fy - 100, degW = 90;
    g.fillStyle(0x1a1228);
    g.fillRect(degX, degY, degW, 18);
    g.fillStyle(0x2a1a3a);
    g.fillRect(degX, degY, degW, 4);
    g.fillStyle(0x111118);
    g.fillRect(degX + 8, degY + 18, 10, 52);
    g.fillRect(degX + degW - 18, degY + 18, 10, 52);
    const platDeg = this.add.rectangle(degX + degW / 2, degY + 9, degW, 18).setVisible(false);
    this.physics.add.existing(platDeg, true);
    this.platforms.add(platDeg);

    // Plataforma alta — onde fica o baú
    const altX = 450, altY = fy - 160, altW = 130;
    g.fillStyle(0x1a1228);
    g.fillRect(altX, altY, altW, 18);
    g.fillStyle(0x2a1a3a);
    g.fillRect(altX, altY, altW, 4);
    g.fillStyle(0x111118);
    g.fillRect(altX + 8, altY + 18, 10, 112);
    g.fillRect(altX + altW - 18, altY + 18, 10, 112);
    const platAlt = this.add.rectangle(altX + altW / 2, altY + 9, altW, 18).setVisible(false);
    this.physics.add.existing(platAlt, true);
    this.platforms.add(platAlt);

    // Barras no teto
    for (let x = 150; x < W - 100; x += 320) {
      g.fillStyle(0x1a1a22);
      g.fillRect(x, 28, 160, 8);
      g.fillStyle(0x2a2a38);
      g.fillRect(x, 28, 160, 2);
    }

    // Porta
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

    this.textPorta = this.add.text(W - 55, fy - 115, '005', {
      fontSize: '13px', fontFamily: 'Courier New',
      color: '#bb99ff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(3)

    this.exitZone = this.add.zone(W - 55, fy - 48, 55, 95);
    this.physics.add.existing(this.exitZone, true);

    this._bauPlataformaX = altX;
    this._bauPlataformaY = altY;
    this._bauPlataformaW = altW;
  }

  _banco(g, b) {
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

  // ── BAÚ ───────────────────────────────────────────────────
  criarBau() {
    const bx = Math.round(this._bauPlataformaX + this._bauPlataformaW / 2) - 22;
    const by = this._bauPlataformaY - 52;
    const g = this.add.graphics().setDepth(3);

    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(bx + 22, by + 54, 64, 12);
    g.fillStyle(0x1a3a8a);
    g.fillRect(bx, by + 20, 44, 32);
    g.fillStyle(0x2255bb);
    g.fillRect(bx, by, 44, 22);
    g.fillStyle(0x2a66cc);
    g.fillEllipse(bx + 22, by, 44, 14);
    g.fillStyle(0xddaa00);
    g.fillRect(bx + 19, by, 6, 52);
    g.fillRect(bx, by + 18, 44, 5);
    g.fillRect(bx, by, 6, 52);
    g.fillRect(bx + 38, by, 6, 52);
    g.fillStyle(0xffcc00);
    g.fillRect(bx + 17, by + 21, 10, 9);
    g.lineStyle(2.5, 0xffcc00);
    g.beginPath();
    g.arc(bx + 22, by + 21, 5, Math.PI, 0);
    g.strokePath();
    g.fillStyle(0xffdd44);
    [[bx + 3, by + 3], [bx + 3, by + 45], [bx + 41, by + 3], [bx + 41, by + 45]]
      .forEach(([rx, ry]) => g.fillCircle(rx, ry, 3));

    const glow = this.add.rectangle(bx + 22, by + 26, 80, 80, 0x3366ff, 0.10).setDepth(2);
    this.tweens.add({
      targets: glow, alpha: { from: 0.05, to: 0.22 },
      duration: 700, yoyo: true, repeat: -1
    });

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

  abrirBau() {
    if (this.bauAberto) return;
    this.bauAberto = true;

    const g = this.bauGfx, bx = this.bauX, by = this.bauY;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(bx + 22, by + 54, 64, 12);
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

    this.createHiddenKey(bx + 22, by + 35);
  }

  // ── SCREECH — só patrulha o teto, nunca persegue ─────────
  criarScreech() {
    const x = Phaser.Math.Between(this.worldWidth * 0.55, this.worldWidth * 0.85);

    const screech = this.add.image(x, 45, 'screech')
      .setDepth(19)
      .setScale(0.15);

    screech.vx = Phaser.Math.Between(18, 32) * (Math.random() < 0.5 ? 1 : -1);
    screech.vy = Phaser.Math.Between(5, 12) * (Math.random() < 0.5 ? 1 : -1);

    this.tetoTween = this.tweens.add({
      targets: screech, y: 52,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    return screech;
  }

  // ── UPDATE ────────────────────────────────────────────────
  update(time, delta) {
    if (this.transitioning) return;

    this.handleMovement();
    this.drawPlayer();

    // Coleta da chave
    if (!this.keyFound && this.keyZone) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.keyZone.x, this.keyZone.y
      );
      if (dist < 60) this.collectKey();
    }

    // Screech — patrulha + timer + lanterna
    // Tudo pausado durante o jumpscare
    if (!this.screechDerrotado && this.screechObj && !this.emJumpscare) {
      this.moverScreech(delta);
      this.atualizarTimer(delta);
      this.verificarLanterna();
    }

    // Porta
    if (this.portaAberta && this.isNear(this.exitZone, 120) && !this.emJumpscare) {
      if (this.keyFound) {
        this.transitionTo('FinalScene');
      } else if (!this._msgPortaExibida) {
        // FIX: flag evita chamar showLockedMessage todo frame
        this._msgPortaExibida = true;
        this.showLockedMessage();
        this.time.delayedCall(2000, () => { this._msgPortaExibida = false; });
      }
    }

    // Prompts
    const precisaBau = !this.bauAberto && this.isNear(this.bauZone);
    const precisaPorta = this.portaAberta && this.isNear(this.exitZone, 120);

    if (!precisaBau && !precisaPorta) {
      if (this.activePrompt) { this.activePrompt.destroy(); this.activePrompt = null; }
    } else if (precisaBau && !this.activePrompt) {
      this.createPrompt('[E] Abrir baú', -70, '#ffdd44');
    } else if (precisaPorta && !this.activePrompt) {
      this.createPrompt(
        this.keyFound ? TEXTS.ENTER : TEXTS.NEED_KEY,
        -70,
        this.keyFound ? '#ffdd44' : '#ff6666'
      );
    }

    this.desenharLanterna();
  }

  handleInteract() {
    if (this.transitioning) return;
    if (!this.bauAberto && this.isNear(this.bauZone)) this.abrirBau();
  }

  // ── SCREECH SÓ PATRULHA O TETO ───────────────────────────
  moverScreech(delta) {
    if (!this.screechObj) return;
    const dt = delta / 1000;

    this.screechObj.x += this.screechObj.vx * dt;
    this.screechObj.y += this.screechObj.vy * dt;

    if (this.screechObj.x < 40 || this.screechObj.x > this.worldWidth - 40)
      this.screechObj.vx *= -1;
    if (this.screechObj.y < 35 || this.screechObj.y > 85)
      this.screechObj.vy *= -1;

    this.screechObj.y = Phaser.Math.Clamp(this.screechObj.y, 35, 85);
  }

  // ── TIMER — quando estoura dispara o jumpscare ────────────
  atualizarTimer(delta) {
    if (this.punicaoAplicada) return;
    this.tempoPassado += delta;

    if (this.tempoPassado >= this.tempoLimite) {
      this.punicaoAplicada = true;
      this.dispararJumpscare();
    }
  }

  // ── JUMPSCARE — o susto É o dano ─────────────────────────
  dispararJumpscare() {
    this.emJumpscare = true;

    // Som do susto — toca junto com o visual
    this.sound.play('screech_jumpscare', { volume: 1.5 });

    // Flash branco cobre a tela (começa em alpha 0)
    const flashBg = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
      .setScrollFactor(0).setDepth(70);

    // Screech grande no centro (começa pequeno e invisível)
    const jumpscare = this.add.image(GAME_W / 2, GAME_H / 2, 'screech')
      .setScrollFactor(0).setDepth(71)
      .setScale(0.1).setAlpha(0);

    // Fase 1: flash + screech aparecem juntos em 80ms
    this.tweens.add({
      targets: [flashBg, jumpscare],
      alpha: 1,
      duration: 80,
      ease: 'Power3',
      onComplete: () => {
        // Fase 2: screech cresce agressivamente em 400ms
        this.tweens.add({
          targets: jumpscare,
          scale: 2.0,
          duration: 400,
          ease: 'Back.easeOut',
          onComplete: () => {
            // Fase 3: segura na tela por 500ms
            this.time.delayedCall(500, () => {
              // Fase 4: some em 1000s
              this.tweens.add({
                targets: [flashBg, jumpscare],
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                  flashBg.destroy();
                  jumpscare.destroy();

                  // Aplica o dano APÓS o jumpscare terminar
                  const morreu = GameState.damage(2, this);

                  if (morreu) {
                    this.transitionTo('GameOverScene');
                    return;
                  }

                  // Libera o jogo e reinicia o timer
                  this.emJumpscare = false;
                  this.cicloAtaque++;

                  // Ciclos ficam progressivamente mais curtos
                  const limites = [30000, 20000, 14000, 10000];
                  this.tempoLimite = limites[Math.min(this.cicloAtaque, limites.length - 1)];
                  this.tempoPassado = 0;
                  this.punicaoAplicada = false;
                }
              });
            });
          }
        });
      }
    });
  }

  // ── LANTERNA — mata o screech ─────────────────────────────
  verificarLanterna() {
    if (this.screechDerrotado || !this.screechObj) return;
    if (!this.screechVulneravel) return;

    const cam = this.cameras.main;
    const screenX = this.screechObj.x - cam.scrollX;
    const screenY = this.screechObj.y - cam.scrollY;
    const dist = Phaser.Math.Distance.Between(this.input.x, this.input.y, screenX, screenY);

    if (dist < 125) this.derrotarScreech();
  }

  derrotarScreech() {
    if (this.screechDerrotado || !this.screechObj) return;
    this.screechDerrotado = true;

    if (this.scaleTween) this.scaleTween.stop();
    if (this.tetoTween) this.tetoTween.stop();

    // Screech some
    this.tweens.add({
      targets: this.screechObj,
      alpha: 0, scale: 2.5, rotation: 2, duration: 400,
      onComplete: () => {
        if (this.screechObj) { this.screechObj.destroy(); this.screechObj = null; }
      }
    });

    this.time.delayedCall(500, () => {
      this.portaAberta = true;
      this.mostrarAviso('Screech derrotado! Encontre a saída.', 3000);
    });
  }

  // ── LANTERNA ──────────────────────────────────────────────
  desenharLanterna() {
    const cam = this.cameras.main;
    const px = this.player.x - cam.scrollX;
    const py = this.player.y - cam.scrollY;

    this.lantGfx.clear();
    this.lantGfx.fillStyle(0xffffff);
    this.lantGfx.fillCircle(this.input.x, this.input.y, 95);
    this.lantGfx.fillCircle(px, py - 20, 70);
  }

  mostrarAviso(texto, duracao) {
    this.textoAviso.setText(texto);
    this.time.delayedCall(duracao, () => {
      if (this.textoAviso) this.textoAviso.setText('');
    });
  }
}

// ============================================================
//  FinalScene.js  —  Fase Final: Biblioteca
//  Baseada em BaseScene. Estilo Pac-Man + Doors (Figure)
//  Todas as constantes estão encapsuladas no constructor().
//
//  SONS: todos marcados com comentário — substitua pelos
//        arquivos de áudio corretos antes de publicar.
//
//  SPRITESHEET: figure.png (880x1216, 4 cols x 3 rows)
//    linha 0 (frames 0-3): caminhada
//    linha 1 (frames 4-7): ataque/alerta
//    linha 2 (frames 8-11): rastejar (chase)
// ============================================================

class FinalScene extends BaseScene {
  constructor() {
    super('FinalScene');

    // ── Constantes do labirinto ───────────────────────────────
    this.TILE = 32; //unidade básica de mapas/cenários 2d >> tem 32x32 = 1024, que é a largura do sprite do Figure (4 frames)
    this.COLS = 31; // largura do labirinto (número de colunas)
    this.ROWS = 23; //  altura do labirinto (número de linhas)
    this.MAZE_OFFSET_X = 0; // para centralizar o labirinto na tela, se necessário
    this.MAZE_OFFSET_Y = 0; // para centralizar o labirinto na tela, se necessário

    /*Matriz do labirinto (31x23) — 713 caracteres, cada um representando um tile:
    1 → Parede(bloqueado)
    0 → Caminho / Chão(livre)
    S → Start(ponto de início do jogador) - linha 1
    D → Door(porta) - linha 21
    */
    this.RAW_MAZE = [
      "1111111111111111111111111111111", // 0
      "1S00000000000001000100010000001", // 1  ← col:11 aberta
      "1010111010111010101110101111101", // 2
      "1010001010001010100010100000101", // 3
      "1011101011101010111010111110101", // 4
      "1000101000101010000010000010001", // 5
      "1110101110101111101110111010111", // 6
      "1000100010000000000010001010001", // 7
      "1011111011101111101011101110101", // 8
      "1010000010001000100010000010101", // 9
      "1010111110111010111110111110101", // 10
      "1000100000001000000010000010001", // 11
      "1111101111101111101110111010111", // 12
      "1000001000000000000000001010001", // 13
      "1011111011101111101011101110101", // 14
      "1010000010000000100010000010101", // 15  ← col:12 aberta
      "1010111110111010111110111110101", // 16
      "1000100000001000000010000000001", // 17
      "1110101110101111101110111010111", // 18
      "1000001010001010000010001010001", // 19
      "1011101011101010111010111010101", // 20
      "100000001000100010001000000000D", // 21
      "1111111111111111111111111111111", // 22
    ];

    // Posições dos livros com código (5 tomos vermelhos)
    this.CODE_POSITIONS = [
      { col: 5, row: 7 },
      { col: 15, row: 3 },
      { col: 25, row: 9 },
      { col: 9, row: 17 },
      { col: 27, row: 21 }, // último — perto da porta, área mais perigosa
    ];

    this.CODE_BOOK_DATA = [
      { code: "4" },
      { code: "7" },
      { code: "2" },
      { code: "9" },
      { code: "1" },
    ];

    // Posições dos livros comuns (sem código — apenas atmosfera)
    this.COMMON_POSITIONS = [
      { col: 3, row: 5 },
      { col: 11, row: 1 },
      { col: 19, row: 5 },
      { col: 7, row: 11 },
      { col: 21, row: 13 },
      { col: 13, row: 19 },
      { col: 3, row: 19 },
      { col: 23, row: 3 },
      { col: 17, row: 11 },
      { col: 29, row: 15 },
      { col: 5, row: 21 },
      { col: 25, row: 17 },
    ];


    this.FIGURE_PATROL_PATH = [
      { col: 1, row: 13 },
      { col: 7, row: 13 },
      { col: 7, row: 7 },
      { col: 13, row: 7 },
      { col: 13, row: 13 },
      { col: 19, row: 13 },
      { col: 19, row: 7 },
      { col: 25, row: 7 },
      { col: 25, row: 17 },
      { col: 19, row: 17 },
      { col: 13, row: 17 },
      { col: 7, row: 17 },
      { col: 1, row: 17 },
      { col: 1, row: 13 },
    ];
    // ── Constantes do Figure ──────────────────────────────────
    this.FIGURE_PATROL_SPEED = 3.2;
    this.FIGURE_CHASE_SPEED = 5.5;
    this.FIGURE_HEAR_RADIUS = 10;
    this.FIGURE_KILL_RADIUS = 1;
    this.SOUND_MOVE_LEVEL = 1.0;
    this.SOUND_IDLE_LEVEL = 0.0;
  }
  preload() {
    super.preload();
    this.load.spritesheet('figure', 'assets/images/figure.png', {
      frameWidth: 220,
      frameHeight: 405,
    });
  }

  // ── Estado próprio da fase ────────────────────────────────
  init() {
    super.init();

    this.codesFound = [];
    this.bookUIOpen = false;
    this.inputBlocked = false;

    // Movimento em grid (não usa o sistema de física do BaseScene para mover)
    this.playerTile = { col: 1, row: 1 };
    this.playerPx = { x: 0, y: 0 };
    this.moveQueue = null;
    this.moving = false;
    this.moveDir = { dx: 0, dy: 0 };
    this.moveProgress = 0;
    this.MOVE_SPEED = 6.5; // tiles/segundo — mais lento que Pac-Man para tensão

    this.facingDir = 'right';
    this.stepCount = 0;
  }

  // ── Posição pixel do centro de um tile ───────────────────
  tileToPixel(col, row) {
    return {
      x: this.MAZE_OFFSET_X + col * this.TILE + this.TILE / 2,
      y: this.MAZE_OFFSET_Y + row * this.TILE + this.TILE / 2,
    };
  }

  isWalkable(col, row) {
    if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return false;
    return this.RAW_MAZE[row][col] !== '1';
  }

  parseMaze() {
    this.maze = this.RAW_MAZE.map(r => r.split(''));
  }
  setupWorld() {
    // vazio — câmera configurada no create()
  }

  // ─────────────────────────────────────────────────────────
  create() {
    // Recalcula TILE para que o labirinto seja ~1.8x maior que a tela
    // garantindo que a câmera sempre tenha espaço para rolar
    this.TILE = Math.ceil(Math.max(
      (GAME_W * 1.8) / this.COLS,   // baseado na largura
      (GAME_H * 1.8) / this.ROWS    // baseado na altura
    ));
    this.MAZE_W = this.COLS * this.TILE;
    this.MAZE_H = this.ROWS * this.TILE;

    // Atualiza worldWidth ANTES do super.create() para o setupWorld usar o valor certo
    this.worldWidth = this.MAZE_W;
    this.sound.play('music_final', { loop: true, volume: 1.0 });

    // Chama o create do BaseScene (configura câmera, player, controles)
    // MAS não queremos o player de física padrão se movendo livremente,
    // então desativamos a gravidade após o super.create()
    super.create();
    const worldW = this.MAZE_W;
    const worldH = this.MAZE_H;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    console.log('TILE:', this.TILE);
    console.log('MAZE_W:', this.MAZE_W);
    console.log('MAZE_H:', this.MAZE_H);
    console.log('GAME_W:', GAME_W);
    console.log('GAME_H:', GAME_H);
    console.log('camera bounds:', this.cameras.main._bounds);

    GameState.door = 6;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_FINAL);

    this.parseMaze();

    // Desativa física do player — movimento é grid-based aqui
    this.player.body.setGravityY(0);
    this.player.body.setVelocity(0, 0);
    this.player.body.setImmovable(true);
    this.player.body.allowGravity = false;

    // Posiciona player no spawn
    const spawn = this.tileToPixel(1, 1);
    this.player.setPosition(spawn.x, spawn.y);
    this.playerPx = { x: spawn.x, y: spawn.y };

    // Constrói o mundo
    this.buildBackground();
    this.buildMaze();
    this.createLibraryDoor();   // porta de saída específica do labirinto
    this.createBooks();
    this.createWallLights();
    this.createDustParticles();
    this.createHUD();
    this.createBookUI();

    // Tecla E fecha livro também
    this.enterKey.on('down', () => {
      if (this.bookUIOpen) this.closeBook();
    });

    // Figure — PARTE 2
    this.createFigure();

    this.cameras.main.fadeIn(1000, 10, 6, 8);

    this.events.on('shutdown', () => {
      this.figureStepsSound?.stop();
      Object.values(this.figureGruntSounds ?? {}).forEach(s => s.stop());
    });
  }

  // ── Fundo geral — cobre o mundo inteiro ──────────────────
  buildBackground() {
    const worldW = this.MAZE_W + this.MAZE_OFFSET_X * 2;
    const worldH = this.MAZE_H + this.MAZE_OFFSET_Y * 2;
    this.add.rectangle(worldW / 2, worldH / 2, worldW, worldH, 0x0a0608).setDepth(0);
  }

  // ── Constrói o labirinto visualmente ─────────────────────
  buildMaze() {
    const g = this.add.graphics().setDepth(1);
    const gDeco = this.add.graphics().setDepth(2);

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const px = this.MAZE_OFFSET_X + c * this.TILE;
        const py = this.MAZE_OFFSET_Y + r * this.TILE;
        const ch = this.maze[r][c];

        if (ch === '1') {
          // ── Estante de livros ──────────────────────────
          g.fillStyle(0x1a0f08);
          g.fillRect(px, py, this.TILE, this.TILE);
          // Moldura da estante
          g.lineStyle(1, 0x3d2010, 0.9);
          g.strokeRect(px + 1, py + 1, this.TILE - 2, this.TILE - 2);
          // Duas prateleiras horizontais
          g.fillStyle(0x2a1508);
          g.fillRect(px + 2, py + Math.floor(this.TILE * 0.33), this.TILE - 4, 2);
          g.fillRect(px + 2, py + Math.floor(this.TILE * 0.66), this.TILE - 4, 2);
          // Livros decorativos nas prateleiras
          this.drawShelfBooks(gDeco, px, py);
        } else {
          // ── Corredor ──────────────────────────────────
          g.fillStyle(0x0f0c1a);
          g.fillRect(px, py, this.TILE, this.TILE);
          // Tábuas sutis no piso
          g.lineStyle(0.5, 0x1a1628, 0.25);
          if ((c + r) % 4 === 0) g.strokeRect(px + 2, py + 2, this.TILE - 4, this.TILE - 4);
        }
      }
    }

    // Borda geral do labirinto
    g.lineStyle(2, 0x3d2010, 0.9);
    g.strokeRect(this.MAZE_OFFSET_X, this.MAZE_OFFSET_Y, this.MAZE_W, this.MAZE_H);
  }

  drawShelfBooks(g, px, py) {
    const palette = [0x8b1a1a, 0x1a4a8b, 0x1a6b2a, 0x7a5a1a, 0x6b1a6b, 0x8b4a1a];
    // Três faixas de livros dentro do tile (acima de cada prateleira)
    const shelfYs = [
      py + 2,                                        // topo do tile
      py + Math.floor(this.TILE * 0.33) + 2,         // acima da 1ª prateleira
      py + Math.floor(this.TILE * 0.66) + 2,         // acima da 2ª prateleira
    ];
    // Altura disponível por faixa (até a próxima prateleira menos 2px)
    const rowH = Math.floor(this.TILE * 0.33) - 4;

    shelfYs.forEach(sy => {
      let bx = px + 2;
      while (bx < px + this.TILE - 2) {
        const bw = Phaser.Math.Between(2, 5);         // livros finos num tile 32px
        const bh = Phaser.Math.Between(Math.floor(rowH * 0.6), rowH);
        const col = palette[Phaser.Math.Between(0, palette.length - 1)];
        g.fillStyle(col, 0.8);
        g.fillRect(bx, sy, bw, bh);
        // Lombada dourada
        g.fillStyle(0xffd080, 0.20);
        g.fillRect(bx, sy, 1, bh);
        bx += bw + 1;
      }
    });
  }

  // ── Arandelas ─────────────────────────────────────────────
  createWallLights() {
    const pts = [
      { c: 0, r: 5 }, { c: 0, r: 13 }, { c: 0, r: 19 },
      { c: this.COLS - 1, r: 3 }, { c: this.COLS - 1, r: 11 }, { c: this.COLS - 1, r: 17 },
      { c: 10, r: 0 }, { c: 20, r: 0 }, { c: 10, r: this.ROWS - 1 }, { c: 20, r: this.ROWS - 1 },
    ];
    pts.forEach(p => {
      const lx = this.MAZE_OFFSET_X + p.c * this.TILE + this.TILE / 2;
      const ly = this.MAZE_OFFSET_Y + p.r * this.TILE + this.TILE / 2;

      const light = this.add.graphics().setDepth(3);
      light.fillStyle(0xffdd88, 0.04); light.fillCircle(lx, ly, this.TILE * 4);
      light.fillStyle(0xffdd88, 0.08); light.fillCircle(lx, ly, this.TILE * 2);
      light.fillStyle(0xffdd88, 0.18); light.fillCircle(lx, ly, this.TILE * 0.8);

      const fix = this.add.graphics().setDepth(4);
      fix.fillStyle(0x4a3520); fix.fillRect(lx - 4, ly - 8, 8, 12);
      fix.fillStyle(0xffdd88); fix.fillCircle(lx, ly + 4, 3);

      this.tweens.add({
        targets: light,
        alpha: { from: 0.7, to: 1.1 },
        duration: Phaser.Math.Between(800, 1600),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });
  }

  // ── Porta da biblioteca (tile D = col 30, row 21) ─────────
  createLibraryDoor() {
    // Encontra o tile D no mapa
    let doorCol = 30, doorRow = 21;
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.RAW_MAZE[r][c] === 'D') { doorCol = c; doorRow = r; }
      }
    }
    this.doorTile = { col: doorCol, row: doorRow };

    const px = this.MAZE_OFFSET_X + doorCol * this.TILE;
    const py = this.MAZE_OFFSET_Y + doorRow * this.TILE;

    const g = this.add.graphics().setDepth(6);
    g.fillStyle(COLORS.doorFrame);
    g.fillRect(px - 3, py - 3, this.TILE + 6, this.TILE + 6);
    g.fillStyle(COLORS.door);
    g.fillRect(px + 2, py + 2, this.TILE - 4, this.TILE - 4);
    g.lineStyle(1, COLORS.highlight, 0.5);
    g.strokeRect(px + 6, py + 6, this.TILE / 2 - 4, this.TILE - 12);
    g.strokeRect(px + this.TILE / 2 + 2, py + 6, this.TILE / 2 - 4, this.TILE - 12);
    g.fillStyle(COLORS.doorGlow);
    g.fillCircle(px + this.TILE - 10, py + this.TILE / 2, 3);

    this.add.text(px + this.TILE / 2, py - 12, TEXTS.PHASE_FINAL.split(' - ')[0], {
      fontSize: '10px', fontFamily: 'Courier New',
      color: '#bb99ff', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(7);

    const glow = this.add.graphics().setDepth(5);
    glow.fillStyle(COLORS.doorGlow, 0.08);
    glow.fillRect(px - 10, py - 10, this.TILE + 20, this.TILE + 20);
    this.tweens.add({
      targets: glow, alpha: { from: 0.5, to: 1.3 },
      duration: 1400, yoyo: true, repeat: -1,
    });

    // Zona de interação reutilizando o doorZone da BaseScene
    this.doorZone = this.add.zone(px + this.TILE / 2, py + this.TILE / 2, this.TILE, this.TILE);
    this.physics.add.existing(this.doorZone, true);
    this.doorDestination = 'WinScene'; // ajuste conforme sua cena de vitória
  }

  // ── Livros (coletáveis) ───────────────────────────────────
  createBooks() {
    this.bookObjects = [];

    // Junta todas as posições e embaralha
    const todasPosicoes = [...this.CODE_POSITIONS, ...this.COMMON_POSITIONS];
    for (let i = todasPosicoes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [todasPosicoes[i], todasPosicoes[j]] = [todasPosicoes[j], todasPosicoes[i]];
    }

    // As 5 primeiras posições recebem os livros com código
    this.CODE_BOOK_DATA.forEach((data, i) => {
      this.spawnBook(todasPosicoes[i].col, todasPosicoes[i].row, true, data);
    });

    // O restante recebe livros comuns
    for (let i = this.CODE_BOOK_DATA.length; i < todasPosicoes.length; i++) {
      this.spawnBook(todasPosicoes[i].col, todasPosicoes[i].row, false, null);
    }
  }

  spawnBook(col, row, isCode, data) {
    // não spawna se o tile for parede
    if (!this.isWalkable(col, row)) return;

    const { x, y } = this.tileToPixel(col, row);
    const color = 0x335599;
    const glowColor = 0x4466cc;
    const g = this.add.graphics().setDepth(5);
    // Livro
    g.fillStyle(color);
    g.fillRect(x - 8, y - 10, 16, 20);
    g.fillStyle(0xffd080, 0.35);
    g.fillRect(x - 7, y - 9, 2, 18);
    // Halo
    g.fillStyle(glowColor, 0.12);
    g.fillCircle(x, y, 18);

    this.tweens.add({
      targets: g,
      alpha: { from: isCode ? 0.65 : 0.5, to: 1 },
      duration: isCode ? 900 : 1400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.bookObjects.push({ col, row, isCode, data, gfx: g, collected: false });
  }

  // ── HUD: 5 slots de código ────────────────────────────────
  createHUD() {
    this.add.rectangle(GAME_W / 2, 22, 270, 38, 0x080510, 0.88)
      .setScrollFactor(0).setDepth(20)
      .setStrokeStyle(1, 0x3d2010, 0.7);

    this.add.text(GAME_W / 2, 46, 'SEQUÊNCIA DE ACESSO', {
      fontSize: '8px', fontFamily: 'Courier New',
      color: '#4a3010', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.codeSlots = [];
    for (let i = 0; i < 5; i++) {
      const sx = GAME_W / 2 - 100 + i * 50;

      const slot = this.add.graphics().setScrollFactor(0).setDepth(21);
      slot.lineStyle(1, 0x4a3010, 0.8);
      slot.strokeRect(sx - 14, 8, 28, 28);
      slot.fillStyle(0x120c06, 0.9);
      slot.fillRect(sx - 14, 8, 28, 28);
      // ícone de livro vazio
      slot.fillStyle(0x2a1a0a, 0.5);
      slot.fillRect(sx - 7, 12, 14, 18);

      const txt = this.add.text(sx, 22, '—', {
        fontSize: '14px', fontFamily: 'Courier New', color: '#2a2015',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(22);

      this.codeSlots.push({ slot, txt, sx, filled: false });
    }
  }

  fillCodeSlot(index, digit) {
    const slot = this.codeSlots[index];
    if (!slot || slot.filled) return;
    slot.filled = true;

    slot.slot.clear();
    slot.slot.lineStyle(1.5, 0xcc2222, 1);
    slot.slot.strokeRect(slot.sx - 14, 8, 28, 28);
    slot.slot.fillStyle(0x2a0606, 0.95);
    slot.slot.fillRect(slot.sx - 14, 8, 28, 28);

    slot.txt.setText(digit).setColor('#ff6644');
    this.tweens.add({
      targets: slot.txt,
      scaleX: { from: 0, to: 1 }, scaleY: { from: 0, to: 1 },
      duration: 280, ease: 'Back.easeOut',
    });
  }

  // ── UI do livro aberto ────────────────────────────────────
  createBookUI() {
    const cx = GAME_W / 2, cy = GAME_H / 2;
    const bW = 480, bH = 290;

    this.bookUIContainer = this.add.container(0, 0)
      .setScrollFactor(0).setDepth(50).setVisible(false);

    const overlay = this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.72);

    // ── Capa do livro (fundo vermelho escuro — igual para todos) ──
    const bookCover = this.add.graphics();
    bookCover.fillStyle(0x3d0808);
    bookCover.fillRect(cx - bW / 2, cy - bH / 2, bW, bH);
    bookCover.lineStyle(2, 0x6b1a1a, 1);
    bookCover.strokeRect(cx - bW / 2, cy - bH / 2, bW, bH);
    // Lombada
    bookCover.fillStyle(0x2a0505);
    bookCover.fillRect(cx - 6, cy - bH / 2, 12, bH);
    bookCover.lineStyle(0.5, 0x8b3a1a, 0.5);
    bookCover.lineBetween(cx - 6, cy - bH / 2, cx - 6, cy + bH / 2);
    bookCover.lineBetween(cx + 6, cy - bH / 2, cx + 6, cy + bH / 2);

    // ── Página esquerda (papel creme — conteúdo do livro) ──
    this.bookPageLeft = this.add.graphics();
    this.bookPageLeft.fillStyle(0xf5ede0);
    this.bookPageLeft.fillRect(cx - bW / 2 + 8, cy - bH / 2 + 8, bW / 2 - 16, bH - 16);
    // Linhas pautadas
    this.bookPageLeft.lineStyle(0.5, 0xc8b89a, 0.6);
    for (let i = 0; i < 9; i++) {
      this.bookPageLeft.lineBetween(
        cx - bW / 2 + 20, cy - bH / 2 + 44 + i * 22,
        cx - 14, cy - bH / 2 + 44 + i * 22
      );
    }

    // ── Página direita (papel creme — código ou em branco) ──
    this.bookPageRight = this.add.graphics();
    this.bookPageRight.fillStyle(0xf0e8d8);
    this.bookPageRight.fillRect(cx + 8, cy - bH / 2 + 8, bW / 2 - 16, bH - 16);
    // Linhas pautadas (mais fracas — fica em segundo plano)
    this.bookPageRight.lineStyle(0.5, 0xc8b89a, 0.4);
    for (let i = 0; i < 9; i++) {
      this.bookPageRight.lineBetween(
        cx + 14, cy - bH / 2 + 44 + i * 22,
        cx + bW / 2 - 20, cy - bH / 2 + 44 + i * 22
      );
    }

    // Título na página esquerda
    this.bookTitle = this.add.text(cx - bW / 4, cy - bH / 2 + 20, '', {
      fontSize: '12px', fontFamily: 'Georgia, serif',
      color: '#3a1a08', align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Conteúdo na página esquerda
    this.bookContent = this.add.text(cx - bW / 2 + 20, cy - bH / 2 + 48, '', {
      fontSize: '10px', fontFamily: 'Georgia, serif',
      color: '#2a1208', wordWrap: { width: bW / 2 - 36 },
      lineSpacing: 6, align: 'left',
    }).setOrigin(0, 0);

    // Dígito grande na página direita — só livros com código
    this.bookCodeText = this.add.text(cx + bW / 4, cy - 10, '', {
      fontSize: '68px', fontFamily: 'Courier New', color: '#8b0000',
    }).setOrigin(0.5);

    this.bookCodeLabel = this.add.text(cx + bW / 4, cy + 50, '', {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#5a2020', letterSpacing: 2,
    }).setOrigin(0.5);

    const closePrompt = this.add.text(cx, cy + bH / 2 + 18, '[Enter] FECHAR', {
      fontSize: '11px', fontFamily: 'Courier New', color: '#6a5030', letterSpacing: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: closePrompt,
      alpha: { from: 0.35, to: 1 },
      duration: 700, yoyo: true, repeat: -1,
    });

    this.bookUIContainer.add([
      overlay, bookCover,
      this.bookPageLeft, this.bookPageRight,
      this.bookTitle, this.bookContent,
      this.bookCodeText, this.bookCodeLabel,
      closePrompt,
    ]);
  }

  openBook(bookData, isCode, codeIndex) {
    this.bookUIOpen = true;
    this.inputBlocked = true;

    if (isCode && bookData) {
      this.bookTitle.setText(`CÓDIGO ${codeIndex + 1} DE 5`);
      this.bookContent.setText('');
      this.bookCodeText.setText(bookData.code).setVisible(true);
      this.bookCodeLabel.setText('').setVisible(false);
    } else {
      this.bookTitle.setText('...');
      this.bookContent.setText('');
      this.bookCodeText.setVisible(false);
      this.bookCodeLabel.setVisible(false);
    }

    this.bookUIContainer.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.bookUIContainer, alpha: 1, duration: 320, ease: 'Sine.easeOut' });
  }

  closeBook() {
    this.tweens.add({
      targets: this.bookUIContainer, alpha: 0, duration: 220,
      onComplete: () => {
        this.bookUIContainer.setVisible(false);
        this.bookUIOpen = false;
        this.inputBlocked = false;
      },
    });
  }

  // ── Partículas de poeira ──────────────────────────────────
  createDustParticles() {
    this.dustGfx = this.add.graphics().setDepth(7);
    this.dustParts = [];
    for (let i = 0; i < 40; i++) {
      this.dustParts.push({
        x: Phaser.Math.Between(this.MAZE_OFFSET_X, this.MAZE_OFFSET_X + this.MAZE_W),
        y: Phaser.Math.Between(this.MAZE_OFFSET_Y, this.MAZE_OFFSET_Y + this.MAZE_H),
        vx: (Math.random() - 0.5) * 0.18,
        vy: -(Math.random() * 0.12 + 0.04),
        a: Math.random() * 0.35 + 0.05,
        r: Math.random() * 1.5 + 0.5,
      });
    }
  }

  updateDust() {
    const g = this.dustGfx;
    g.clear();
    this.dustParts.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      d.a += (Math.random() - 0.5) * 0.008;
      d.a = Phaser.Math.Clamp(d.a, 0.04, 0.45);
      if (d.y < this.MAZE_OFFSET_Y) d.y = this.MAZE_OFFSET_Y + this.MAZE_H;
      g.fillStyle(0xffd080, d.a);
      g.fillCircle(d.x, d.y, d.r);
    });
  }
  // ── Placeholder Figure (Parte 2) ─────────────────────────



  // ─────────────────────────────────────────────────────────
  //  MOVIMENTO GRID-BASED (sobrescreve handleMovement da BaseScene)
  // ─────────────────────────────────────────────────────────
  handleMovement() {
    if (this.inputBlocked || this.transitioning) return;

    let dx = 0, dy = 0;

    if (this.cursors.left.isDown || this.keys.left.isDown) { dx = -1; this.facingDir = 'left'; }
    if (this.cursors.right.isDown || this.keys.right.isDown) { dx = 1; this.facingDir = 'right'; }
    if (this.cursors.up.isDown || this.keys.jump.isDown) { dy = -1; this.facingDir = 'up'; }
    if (this.cursors.down.isDown || this.keys.down.isDown) { dy = 1; this.facingDir = 'down'; }

    if (dx !== 0 || dy !== 0) this.moveQueue = { dx, dy };
  }

  updateMovement(delta) {
    if (this.inputBlocked || this.transitioning) return;

    const dt = delta / 1000;

    if (this.moving) {
      this.moveProgress += this.MOVE_SPEED * dt;

      if (this.moveProgress >= 1) {
        // Chegou no tile destino
        this.moveProgress = 0;
        this.playerTile.col += this.moveDir.dx;
        this.playerTile.row += this.moveDir.dy;
        const snap = this.tileToPixel(this.playerTile.col, this.playerTile.row);
        this.playerPx.x = snap.x;
        this.playerPx.y = snap.y;
        this.moving = false;
        this.checkTileEvents();

        // Tenta enfileirar próxima direção
        if (this.moveQueue) {
          const { dx, dy } = this.moveQueue;
          if (this.isWalkable(this.playerTile.col + dx, this.playerTile.row + dy)) {
            this.moveDir = { dx, dy };
            this.moving = true;
          }
          this.moveQueue = null;
        }
      } else {
        const from = this.tileToPixel(this.playerTile.col, this.playerTile.row);
        const to = this.tileToPixel(
          this.playerTile.col + this.moveDir.dx,
          this.playerTile.row + this.moveDir.dy
        );
        const t = Phaser.Math.Easing.Cubic.InOut(this.moveProgress);
        this.playerPx.x = Phaser.Math.Linear(from.x, to.x, t);
        this.playerPx.y = Phaser.Math.Linear(from.y, to.y, t);
      }
    } else {
      if (this.moveQueue) {
        const { dx, dy } = this.moveQueue;
        if (this.isWalkable(this.playerTile.col + dx, this.playerTile.row + dy)) {
          this.moveDir = { dx, dy };
          this.moveProgress = 0;
          this.moving = true;
        }
        this.moveQueue = null;
      }
    }

    // Sincroniza o corpo de física com a posição calculada
    this.player.setPosition(this.playerPx.x, this.playerPx.y);
  }

  // ── Eventos ao chegar num tile ────────────────────────────
  checkTileEvents() {
    const { col, row } = this.playerTile;

    // Livro?
    this.bookObjects.forEach(b => {
      if (!b.collected && b.col === col && b.row === row) {
        this.collectBook(b);
      }
    });

    // Porta?
    if (col === this.doorTile.col && row === this.doorTile.row) {
      this.tryEnterDoor();
    }

    // Figure no mesmo tile?
    if (col === this.figure.col && row === this.figure.row) {
      this._figureKillPlayer();
    }
  }

  collectBook(book) {
    book.collected = true;
    // Som de pegar chave reaproveitado
    // som: coleta de livro — substitua pelo áudio correto

    this.tweens.add({
      targets: book.gfx, y: book.gfx.y - 22, alpha: 0,
      duration: 380, onComplete: () => book.gfx.destroy(),
    });

    if (book.isCode) {
      const idx = this.codesFound.length;
      this.codesFound.push(book.data.code);
      this.fillCodeSlot(idx, book.data.code);
    }

    const codeIdx = book.isCode ? this.codesFound.length - 1 : -1;
    this.openBook(book.data, book.isCode, codeIdx);

    // Fecha automaticamente em 4 segundos se o player não fechar
    this.time.delayedCall(4000, () => { if (this.bookUIOpen) this.closeBook(); });
  }

  tryEnterDoor() {
    if (this.codesFound.length < 5) {
      this.showLockedMessage(); // reutiliza o método da BaseScene
      return;
    }
    // Toca som e transita
    // som: porta abrindo — substitua pelo áudio correto
    this.transitionTo(this.doorDestination);
  }

  // ── drawPlayer: sobrescreve o da BaseScene ────────────────
  // O BaseScene usa this.player.x / this.player.y, que aqui é
  // sincronizado com playerPx — então o drawPlayer original funciona,
  // mas vamos enriquecer com a lanterna e animação de passo
  drawPlayer() {
    const g = this.playerGfx;
    g.clear();

    const x = this.playerPx.x;
    const y = this.playerPx.y;

    this.stepCount += this.moving ? 1 : 0;
    const bob = this.moving ? Math.sin(this.stepCount * 0.28) * 2 : 0;

    // Sombra
    this.playerShadow.clear();
    this.playerShadow.fillStyle(0x000000, 0.22);
    this.playerShadow.fillEllipse(x, y + 20, 20, 6);

    // Pernas
    const leg = this.moving ? Math.sin(this.stepCount * 0.38) * 4 : 0;
    g.fillStyle(COLORS.player, 0.8);
    g.fillRect(x - 8, y + 4 + bob, 6, 14 + leg);
    g.fillRect(x + 2, y + 4 + bob, 6, 14 - leg);

    // Corpo
    g.fillStyle(COLORS.player);
    g.fillRect(x - 10, y - 14 + bob, 20, 20);

    // Cabeça
    g.fillRect(x - 8, y - 28 + bob, 16, 14);

    // Olho
    g.fillStyle(COLORS.playerEye);
    const eyeX = (this.facingDir === 'left') ? x - 6 : x + 2;
    if (this.facingDir !== 'up' && this.facingDir !== 'down') {
      g.fillRect(eyeX, y - 25 + bob, 3, 3);
    }

    // Braços
    g.fillStyle(COLORS.player, 0.75);
    g.fillRect(x - 14, y - 12 + bob, 5, 14);
    g.fillRect(x + 9, y - 12 + bob, 5, 14);


  }

  // ─────────────────────────────────────────────────────────
  update(time, delta) {
    if (this.transitioning) return;

    // NÃO chama super.update() para não sobrescrever o movimento grid-based
    this.handleMovement();
    this.updateMovement(delta);
    this.drawPlayer();
    this.updateDust();
    this.updateFigure(time, delta); // Parte 2

    // Prompt de interação com a porta
    const nearDoor = this.playerTile.col === this.doorTile.col &&
      this.playerTile.row === this.doorTile.row;
    if (nearDoor && !this.activePrompt) {
      const label = this.codesFound.length >= 5 ? TEXTS.ENTER : 'Trancada';
      const color = this.codesFound.length >= 5 ? '#ffdd44' : '#ff6666';
      this.createPrompt(label, -60, color);
    } else if (!nearDoor && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
    }
  }

  createFigure() {
    // Estado do Figure
    this.figure = {
      col: 15, row: 1,             // tile inicial (longe do spawn)
      px: { x: 0, y: 0 },         // posição em pixels
      state: 'patrol',             // 'patrol' | 'chase' | 'search' | 'stunned'
      patrolIndex: 0,              // índice do waypoint atual
      targetTile: null,            // tile destino atual
      path: [],                    // caminho calculado pelo BFS
      pathIndex: 0,                // posição no caminho atual
      moving: false,
      moveDir: { dx: 0, dy: 0 },
      moveProgress: 0,
      facingDir: 'right',
      searchTimer: 0,              // tempo restante no estado 'search'
      searchTarget: null,          // última posição ouvida do player
      stunTimer: 0,                // tempo de stun após jumpscare
      alertCooldown: 0,            // cooldown para não ouvir novamente
      noiseLevel: 0,               // nível de ruído percebido
      stepFrame: 0,                // animação de passo
    };

    const start = this.tileToPixel(this.figure.col, this.figure.row);
    this.figure.px = { ...start };

    // ── Animações da spritesheet ──────────────────────────────
    // Linha 0 (frames 0-3): caminhada normal
    if (!this.anims.exists('figure_walk')) {
      this.anims.create({
        key: 'figure_walk',
        frames: this.anims.generateFrameNumbers('figure', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    // Linha 1 (frames 4-7): alerta / ataque
    if (!this.anims.exists('figure_alert')) {
      this.anims.create({
        key: 'figure_alert',
        frames: this.anims.generateFrameNumbers('figure', { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    // Linha 2 (frames 8-11): rastejar (chase rápido)
    if (!this.anims.exists('figure_chase')) {
      this.anims.create({
        key: 'figure_chase',
        frames: this.anims.generateFrameNumbers('figure', { start: 8, end: 11 }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Sprite do Figure (escalado para caber no tile)
    const scaleX = (this.TILE * 1.4) / 220;
    const scaleY = (this.TILE * 2.2) / 405;
    this.figureSprite = this.add.sprite(start.x, start.y, 'figure')
      .setDepth(9)
      .setScale(scaleX, scaleY)
      .setOrigin(0.5, 0.85); // ancora na base do sprite
    this.figureSprite.play('figure_walk');

    // figureGfx ainda usado para a aura e olhos de chase
    this.figureGfx = this.add.graphics().setDepth(9);

    // Overlay de morte (transparente por padrão)
    this.deathOverlay = this.add.rectangle(
      GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0
    ).setScrollFactor(0).setDepth(60).setVisible(false);

    // Tecla R para reiniciar após morte
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Inicializa o primeiro destino de patrulha
    this._figureNextPatrolTarget();

    // ── Áudios do Figure ──────────────────────────────────────────
    try {
      this.figureStepsSound = this.sound.add('figure_stomps', {
        loop: true,
        volume: 0,
      });
      this.figureStepsSound.play();

      this.figureGruntSounds = {
        far: this.sound.add('figure_grunt_far', { volume: 0.7 }),
        medium: this.sound.add('figure_grunt_medium', { volume: 0.8 }),
        close: this.sound.add('figure_grunt_close', { volume: 0.9 }),
      };

      this.figureAttackSound = this.sound.add('figure_jumpscare', { volume: 2.5 });

    } catch (e) {
      console.error('Erro ao criar sons do Figure:', e);
      // Define como null para o guard acima funcionar
      this.figureStepsSound = null;
      this.figureGruntSounds = null;
      this.figureAttackSound = null;
    }
  }

  // ── BFS — encontra caminho entre dois tiles ───────────────────
  _bfsPath(fromCol, fromRow, toCol, toRow) {
    // BFS simples no grid do labirinto
    const visited = new Set();
    const queue = [{ col: fromCol, row: fromRow, path: [] }];
    const key = (c, r) => `${c},${r}`;

    visited.add(key(fromCol, fromRow));

    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    while (queue.length > 0) {
      const { col, row, path } = queue.shift();

      if (col === toCol && row === toRow) return path;

      for (const d of dirs) {
        const nc = col + d.dx;
        const nr = row + d.dy;
        const k = key(nc, nr);
        if (!visited.has(k) && this.isWalkable(nc, nr)) {
          visited.add(k);
          queue.push({ col: nc, row: nr, path: [...path, { col: nc, row: nr, dx: d.dx, dy: d.dy }] });
        }
      }

      // Limite de busca para não travar o frame
      if (queue.length > 800) break;
    }

    return []; // sem caminho
  }

  // ── Define próximo waypoint de patrulha ──────────────────────
  _figureNextPatrolTarget() {
    const fig = this.figure;
    // Tenta até 14 waypoints para achar um acessível
    for (let attempt = 0; attempt < this.FIGURE_PATROL_PATH.length; attempt++) {
      fig.patrolIndex = (fig.patrolIndex + 1) % this.FIGURE_PATROL_PATH.length;
      const wp = this.FIGURE_PATROL_PATH[fig.patrolIndex];
      if (!this.isWalkable(wp.col, wp.row)) continue;
      const path = this._bfsPath(fig.col, fig.row, wp.col, wp.row);
      if (path.length > 0) {
        fig.path = path;
        fig.pathIndex = 0;
        return;
      }
    }
    // Fallback: fica parado e tenta de novo no próximo frame
    fig.path = [];
    fig.pathIndex = 0;
  }
  // ── Distância em tiles entre Figure e player ─────────────────
  _figureDist() {
    return Math.abs(this.figure.col - this.playerTile.col) +
      Math.abs(this.figure.row - this.playerTile.row);
  }

  // ── Nível de ruído que o player está fazendo ─────────────────
  _playerNoiseLevel() {
    if (this.inputBlocked || !this.moving) return this.SOUND_IDLE_LEVEL;
    return this.SOUND_MOVE_LEVEL;
  }

  // ── Verifica se o Figure ouve o player ───────────────────────
  _figureHears() {
    if (this.figure.alertCooldown > 0) return false;
    const dist = this._figureDist();
    const noise = this._playerNoiseLevel();
    // Ruído se propaga — quanto mais perto, mais fácil de ouvir
    const hearThreshold = this.FIGURE_HEAR_RADIUS * noise;
    return dist <= hearThreshold;
  }


  // ── Mata o player ─────────────────────────────────────────────
  _figureKillPlayer() {
    if (this.playerDead || this.transitioning) return;
    this.playerDead = true;
    this.inputBlocked = true;

    this.figureStepsSound?.stop();
    this.figureAttackSound?.play();
    this.cameras.main.shake(400, 0.025);

    // Flash branco — impacto imediato
    const flashWhite = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
      .setScrollFactor(0).setDepth(59);

    this.tweens.add({
      targets: flashWhite,
      alpha: { from: 1, to: 0 },
      duration: 350,
      ease: 'Sine.easeOut',
      onComplete: () => flashWhite.destroy(),
    });

    // Flash vermelho — pulsa por cima enquanto o branco some
    const flashRed = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff0000, 0)
      .setScrollFactor(0).setDepth(58);

    this.tweens.add({
      targets: flashRed, alpha: 0.55, duration: 80,
      yoyo: true, repeat: 2,
      onComplete: () => {
        flashRed.destroy();
        this._showDeathScreen();
      },
    });
  }

  _showDeathScreen() {
    // Reduz vida pelo sistema do GameState
    const isDead = GameState.damage(4, this);

    this.deathOverlay.setVisible(true);
    this.tweens.add({ targets: this.deathOverlay, alpha: 0.82, duration: 600 });

    this.time.delayedCall(2000, () => {
      GameState.reset();
      this.transitionTo('GameOverScene');
    });
  }

  // ── Desenha o Figure (spritesheet) ───────────────────────────
  _drawFigure() {
    const g = this.figureGfx;
    const fig = this.figure;
    const x = fig.px.x;
    const y = fig.px.y;

    // Posiciona e espelha o sprite conforme a direção
    this.figureSprite.setPosition(x, y);
    this.figureSprite.setFlipX(fig.facingDir === 'left');

    // Troca animação conforme estado
    const targetAnim = fig.state === 'chase' ? 'figure_chase'
      : fig.state === 'search' ? 'figure_alert'
        : 'figure_walk';
    if (this.figureSprite.anims.currentAnim?.key !== targetAnim) {
      this.figureSprite.play(targetAnim);
    }

    // Aura de escuridão (graphics simples por cima)
    g.clear();
    const auraAlpha = fig.state === 'chase' ? 0.22 : 0.10;
    g.fillStyle(0x000000, auraAlpha);
    g.fillCircle(x, y - this.TILE * 0.5, this.TILE * 1.8);
  }

  // ── Lógica principal do Figure ────────────────────────────────
  updateFigure(time, delta) {
    if (this.playerDead || this.transitioning) return;

    const fig = this.figure;
    const dt = delta / 1000;

    // Cooldowns
    if (fig.alertCooldown > 0) fig.alertCooldown -= dt;
    if (fig.stunTimer > 0) {
      fig.stunTimer -= dt;
      if (fig.stunTimer <= 0) fig.state = 'patrol';
      this._drawFigure();
      return;
    }

    // ── Máquina de estados ────────────────────────────────────
    switch (fig.state) {

      case 'patrol':
        // Patrulha segue o caminho definido
        if (this._figureHears()) {
          fig.state = 'chase';
          fig.searchTarget = { ...this.playerTile };
          fig.path = this._bfsPath(fig.col, fig.row, this.playerTile.col, this.playerTile.row);
          fig.pathIndex = 0;
          // som: Figure detectou o player — substitua pelo áudio correto
          break;
        }
        this._figureMoveAlongPath(this.FIGURE_PATROL_SPEED, dt);
        if (!fig.moving && fig.pathIndex >= fig.path.length) {
          this._figureNextPatrolTarget();
        } else if (!fig.moving && fig.path.length === 0) {
          // Travado sem caminho — força recalculo
          this._figureNextPatrolTarget();
        }
        break;

      case 'chase':
        // Recalcula caminho a cada tile chegado
        if (!fig.moving) {
          fig.path = this._bfsPath(fig.col, fig.row, this.playerTile.col, this.playerTile.row);
          fig.pathIndex = 0;
        }
        const dist = this._figureDist();
        const chaseSpeed = Phaser.Math.Linear(
          this.FIGURE_CHASE_SPEED,       // velocidade mínima (longe)
          this.FIGURE_CHASE_SPEED * 2.2, // velocidade máxima (colado)
          Phaser.Math.Clamp(1 - dist / this.FIGURE_HEAR_RADIUS, 0, 1)
        );
        this._figureMoveAlongPath(chaseSpeed, dt);

        // Verifica se alcançou o player
        if (this._figureDist() <= this.FIGURE_KILL_RADIUS ||
          (this.figure.col === this.playerTile.col && this.figure.row === this.playerTile.row)) {
          this._figureKillPlayer();
        }

        // Perdeu de ouvir — vai para o último lugar ouvido
        if (!this._figureHears()) {
          fig.alertCooldown = 2.5; // 2.5s antes de ouvir novamente
          fig.state = 'search';
          fig.searchTimer = 4.0;
          fig.path = this._bfsPath(fig.col, fig.row,
            fig.searchTarget.col, fig.searchTarget.row);
          fig.pathIndex = 0;
        }
        break;

      case 'search':
        // Vai até a última posição conhecida do player
        fig.searchTimer -= dt;
        this._figureMoveAlongPath(this.FIGURE_PATROL_SPEED * 1.3, dt);

        if (this._figureHears()) {
          fig.state = 'chase';
          fig.searchTarget = { ...this.playerTile };
          fig.path = this._bfsPath(fig.col, fig.row, this.playerTile.col, this.playerTile.row);
          fig.pathIndex = 0;
          break;
        }

        // Esgotou a busca — volta a patrulhar
        if (fig.searchTimer <= 0 || (!fig.moving && fig.pathIndex >= fig.path.length)) {
          fig.state = 'patrol';
          this._figureNextPatrolTarget();
        }
        break;
    }
    // Verifica colisão por proximidade em pixels (evita o player "passar pelo" Figure)
    const figPx = fig.px;
    const plrPx = this.playerPx;
    const pixelDist = Phaser.Math.Distance.Between(figPx.x, figPx.y, plrPx.x, plrPx.y);
    if (pixelDist < this.TILE * 0.8) {
      this._figureKillPlayer();
    }

    this._drawFigure();

    // Escurece a tela levemente quando o Figure está em chase
    this._updateChaseVignette();
    this._updateFigureAudio(dt);
  }

  // ── Move o Figure um passo ao longo do caminho BFS ───────────
  _figureMoveAlongPath(speed, dt) {
    const fig = this.figure;

    if (fig.moving) {
      fig.moveProgress += speed * dt;

      if (fig.moveProgress >= 1) {
        fig.moveProgress = 0;
        fig.col += fig.moveDir.dx;
        fig.row += fig.moveDir.dy;
        const snap = this.tileToPixel(fig.col, fig.row);
        fig.px = { ...snap };
        fig.moving = false;
      } else {
        const from = this.tileToPixel(fig.col, fig.row);
        const to = this.tileToPixel(fig.col + fig.moveDir.dx, fig.row + fig.moveDir.dy);
        const t = Phaser.Math.Easing.Cubic.InOut(fig.moveProgress); // ← arrastado
        fig.px.x = Phaser.Math.Linear(from.x, to.x, t);
        fig.px.y = Phaser.Math.Linear(from.y, to.y, t);
      }
    } else {
      if (fig.pathIndex < fig.path.length) {
        const next = fig.path[fig.pathIndex];
        fig.pathIndex++;

        // ── Segurança: nunca entra em tile de parede ──
        const destCol = fig.col + next.dx;
        const destRow = fig.row + next.dy;
        if (!this.isWalkable(destCol, destRow)) {
          // Caminho inválido — recalcula do zero
          fig.path = [];
          fig.pathIndex = 0;
          return;
        }

        fig.moveDir = { dx: next.dx, dy: next.dy };
        fig.moveProgress = 0;
        fig.moving = true;

        if (next.dx > 0) fig.facingDir = 'right';
        if (next.dx < 0) fig.facingDir = 'left';
        if (next.dy > 0) fig.facingDir = 'down';
        if (next.dy < 0) fig.facingDir = 'up';
      }
    }
  }

  // ── Vinheta vermelha no chase ─────────────────────────────────
  _updateChaseVignette() {
    if (!this._chaseVignette) {
      this._chaseVignette = this.add.graphics()
        .setScrollFactor(0).setDepth(44);
    }

    const fig = this.figure;
    const g = this._chaseVignette;
    g.clear();

    if (fig.state !== 'chase') return;

    const pulse = (Math.sin(Date.now() * 0.006) + 1) / 2;
    const alpha = 0.04 + pulse * 0.08;

    g.fillStyle(0xff0000, alpha);
    g.fillRect(0, 0, GAME_W, 18);
    g.fillRect(0, GAME_H - 18, GAME_W, 18);
    g.fillRect(0, 0, 18, GAME_H);
    g.fillRect(GAME_W - 18, 0, 18, GAME_H);
  }
  _updateFigureAudio(dt) {
    // Guard: sai se os sons ainda não foram inicializados
    if (!this.figureStepsSound || !this.figureGruntSounds) return;

    const dist = this._figureDist();
    const fig = this.figure;

    // ── Passos: volume proporcional à distância ───────────────
    // distância máxima audível = FIGURE_HEAR_RADIUS * 2
    const maxAudible = this.FIGURE_HEAR_RADIUS * 2;
    const stepVol = fig.state === 'stunned'
      ? 0
      : Phaser.Math.Clamp(1 - dist / maxAudible, 0, 1);

    // Suaviza a mudança de volume (lerp)
    const currentVol = this.figureStepsSound.volume;
    this.figureStepsSound.setVolume(
      Phaser.Math.Linear(currentVol, stepVol, 0.08)
    );

    // ── Grunhidos: dispara de acordo com a zona ───────────────
    this._gruntTimer -= dt;

    let zone = null;
    if (dist <= 3) zone = 'close';
    else if (dist <= this.FIGURE_HEAR_RADIUS) zone = 'medium';
    else if (dist <= this.FIGURE_HEAR_RADIUS * 1.8) zone = 'far';

    // Intervalo entre grunhidos (mais curto quando perto)
    const gruntInterval = zone === 'close' ? 3.5
      : zone === 'medium' ? 6
        : zone === 'far' ? 10
          : 9999;

    if (zone && this._gruntTimer <= 0) {
      // Toca o grunhido da zona correta
      const snd = this.figureGruntSounds[zone];
      if (!snd.isPlaying) snd.play();

      this._gruntTimer = gruntInterval + Phaser.Math.FloatBetween(-0.5, 0.5);
      this._lastGruntZone = zone;
    }

    // Reset timer quando entra em zona nova
    if (zone !== this._lastGruntZone && zone !== null) {
      this._gruntTimer = 0;
      this._lastGruntZone = zone;
    }
  }
}

// =============================================
//  CENA: GAME OVER
// =============================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  create() {
    GameState.reset();

    this.sound.stopAll();
    this.sound.play('musica_gameover', { loop: true, volume: 1.0 });

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
    this.sound.stopAll();
    this.sound.play('musica_win', { loop: true, volume: 1.0 });
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
    FinalScene,
    GameOverScene,
    WinScene
  ],

  scale: {
    mode: Phaser.Scale.ENVELOP,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  }
};

// Inicializa o jogo quando a página carregar
window.onload = () => {
  new Phaser.Game(config);
};