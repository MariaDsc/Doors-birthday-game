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
  KEY_FOUND: 'Chave encontrada!\n\n Vá para a saída!',
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

    this.load.audio('som_chave', 'assets/audio/key.ogg');
    this.load.audio('som_porta', 'assets/audio/door.ogg');
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
    this.createDoor(1900, '002', 'Phase3Scene');
    this.createTorches();
    this.createWallCracks();

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.jeremiah, this.platforms);
  }

  buildLevel() {
    const g = this.add.graphics();

    // Fundo mais escuro
    g.fillStyle(0x070710);
    g.fillRect(0, 0, this.worldWidth, GAME_H);

    // Chão
    g.fillStyle(0x111122);
    g.fillRect(0, this.floorY, this.worldWidth, 60);
    g.fillStyle(0x1a1a30);
    g.fillRect(0, this.floorY, this.worldWidth, 3);

    // Teto
    g.fillStyle(0x050510);
    g.fillRect(0, 0, this.worldWidth, 30);

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth / 2, this.floorY + 30, this.worldWidth, 60)
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
      g.fillStyle(0x2a2848, 0.8);
      g.fillRect(p.x, p.y, p.w, 3);

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });
  }

  createTorches() {
    const g = this.add.graphics();
    const positions = [100, 400, 700, 1000, 1300, 1600, 1900];

    positions.forEach(x => {
      // Suporte da tocha
      g.fillStyle(0x550000, 0.6);
      g.fillRect(x - 2, this.floorY - 130, 4, 25);

      // Chama avermelhada
      g.fillStyle(0xdd2222, 0.7);
      g.fillCircle(x, this.floorY - 138, 6);

      // Brilho animado
      const glow = this.add.rectangle(x, this.floorY - 138, 28, 28, 0xdd2222, 0.05);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.02, to: 0.09 },
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    });
  }

  createWallCracks() {
    const g = this.add.graphics();
    const positions = [300, 700, 1200, 1600];

    positions.forEach(x => {
      g.lineStyle(1, 0x221122, 0.8);
      g.beginPath();
      g.moveTo(x, 30);
      g.lineTo(x - 10, 80);
      g.lineTo(x + 5, 120);
      g.lineTo(x - 8, 160);
      g.strokePath();
    });
  }

  createJeremiah() {
    this.jeremiah = this.physics.add.sprite(900, this.floorY - 60)
      .setVisible(false)
      .setCollideWorldBounds(true);

    this.jeremiah.body.setSize(30, 60);
    this.jeremiah.body.setGravityY(400);

    this.jeremiahGfx = this.add.graphics();

    // "Oi, Bells..." popup
    this.hibells = this.add.text(0, 0, '"Oi, Bells..."', {
      fontSize: '13px',
      fontFamily: 'Courier New',
      color: '#aaffaa',
      letterSpacing: 1,
      backgroundColor: '#0a1a0a',
      padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setAlpha(0).setDepth(10);
  }

  drawJeremiah() {
    const x = this.jeremiah.x;
    const y = this.jeremiah.y;
    const g = this.jeremiahGfx;

    g.clear();

    const color = this.jeremiahLooking ? 0x88ff88 : 0x447744;

    // Corpo
    g.fillStyle(color, this.jeremiahLooking ? 0.9 : 0.7);
    g.fillRect(x - 12, y - 58, 24, 35);

    // Cabeça
    g.fillStyle(color, this.jeremiahLooking ? 1 : 0.8);
    g.fillRect(x - 10, y - 82, 20, 22);

    // Olhos (brilhantes)
    g.fillStyle(0xeeffee);
    g.fillCircle(x - 4, y - 72, this.jeremiahLooking ? 5 : 3);
    g.fillCircle(x + 4, y - 72, this.jeremiahLooking ? 5 : 3);

    // Pupilas
    g.fillStyle(0x00aa00);
    g.fillCircle(x - 4, y - 72, this.jeremiahLooking ? 2 : 1);
    g.fillCircle(x + 4, y - 72, this.jeremiahLooking ? 2 : 1);

    // Pernas
    g.fillStyle(color, 0.7);
    g.fillRect(x - 10, y - 22, 9, 22);
    g.fillRect(x + 1, y - 22, 9, 22);

    // Braços longos
    g.fillRect(x - 18, y - 56, 6, 28);
    g.fillRect(x + 12, y - 56, 6, 28);

    if (this.jeremiahLooking) {
      // Brilho quando olhando
      g.fillStyle(0x00ff00, 0.08);
      g.fillCircle(x, y - 50, 50);
    }
  }

  createWardrobes() {
    const g = this.add.graphics();
    const positions = [150, 600, 1000, 1500, 1850];

    positions.forEach(x => {
      // Armário
      g.fillStyle(0x2a1a1a);
      g.fillRect(x, this.floorY - 80, 36, 80);
      g.lineStyle(1, 0x553333, 0.8);
      g.strokeRect(x, this.floorY - 80, 36, 80);

      // Maçaneta
      g.fillStyle(0x441111, 0.5);
      g.fillRect(x + 16, this.floorY - 45, 4, 20);

      // Rótulo
      this.add.text(x + 18, this.floorY - 92, 'ARMÁRIO', {
        fontSize: '8px',
        fontFamily: 'Courier New',
        color: '#443333',
        letterSpacing: 1
      }).setOrigin(0.5);

      const zone = this.add.zone(x + 18, this.floorY - 40, 50, 80);
      this.physics.add.existing(zone, true);
      this.wardrobes.push(zone);
    });
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

      // Mostra "Oi, Bells..."
      this.hibells.setPosition(this.jeremiah.x, this.jeremiah.y - 110).setAlpha(1);
      this.tweens.killTweensOf(this.hibells);
      this.tweens.add({
        targets: this.hibells,
        alpha: 0,
        duration: 1000,
        delay: 1000
      });

      if (GameState.damage(2)) {
        this.transitionTo('GameOverScene');
        return;
      }

      // Flash de dano
      const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x00ff00, 0.25)
        .setScrollFactor(0).setDepth(25);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 700,
        onComplete: () => flash.destroy()
      });

      this.time.delayedCall(4000, () => { this.hitCooldown = false; });
    } else if (dx >= 220 || !playerInFront) {
      this.jeremiahLooking = false;
    }
  }

  handleInteract() {
    if (this.transitioning) return;

    if (this.isNear(this.doorZone)) {
      this.sound.play('som_porta', { volume: 1.2, seek: 0.5 });
      this.transitionTo(this.doorDestination);
    }
  }
  update() {
    if (this.transitioning) return;

    // Detecta E manualmente
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      for (let w of this.wardrobes) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, w.x, w.y);
        if (dist < 70) {
          this.inWardrobe = !this.inWardrobe;
          this.player.body.setAllowGravity(!this.inWardrobe);
          if (this.inWardrobe) this.player.body.setVelocity(0, 0);
          return;
        }
      }
    }
    if (this.transitioning) return;

    if (this.inWardrobe) {
      this.player.body.setVelocity(0, 0);
      this.player.body.setAllowGravity(false);
      this.playerGfx.clear();
      this.playerShadow.clear();
      this.jeremiah.body.setVelocityX(0);
    } else {
      this.player.body.setAllowGravity(true);
      this.handleMovement();
      this.drawPlayer();
      this.jeremiah.body.setVelocityX(this.jeremiahSpeed * this.jeremiahDir);
      if (this.jeremiah.x > 1700 || this.jeremiah.x < 200) {
        this.jeremiahDir *= -1;
        this.jeremiah.x = Phaser.Math.Clamp(this.jeremiah.x, 201, 1699);
      }
    }

    this.drawJeremiah();
    this.checkJeremiah();

    if (this.activePrompt) {
      this.activePrompt.x = this.player.x;
      this.activePrompt.y = this.player.y - 70;
    }

    // Prompts (mantém igual)
    let nearWardrobe = false;
    for (let w of this.wardrobes) {
      if (this.isNear(w)) { nearWardrobe = true; break; }
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
//  CENA: FASE 3 - SALA DO SALMÃO (COM DECORAÇÕES)
// =============================================
class Phase3Scene extends BaseScene {
  constructor() {
    super('Phase3Scene');
    this.worldWidth = 4000; // largura total do cenário
  }
  init() {
  super.init();
  this.worldWidth = 4000;
}
  create() {
    super.create();
    GameState.door = 3;
    GameState.updateUI();
    this.showPhaseTitle(TEXTS.PHASE_3);

    // Variáveis da fase
    this.timeLeft = 45;          // tempo total em segundos
    this.keyFound = false;       // chave ainda não coletada
    this.waterLevel = GAME_H + 100; // água começa abaixo da tela
    this.gameActive = true;      // fase ativa desde o início
    this.hitCooldown = false;    // controle para não tomar dano contínuo
    this.underwaterTimer = null; // timer de afogamento
    this.waterRiseSpeed = 0.4;   // velocidade inicial da água
    this.stepXRef = 1400;        // posição X onde começa o desnível

    this.platforms = this.physics.add.staticGroup();
    this.salmons = [];

    // Constrói o cenário
    this.buildRoom();
    this.createWater();
    this.createSalmons();
    this.createCoral();
    this.createBubbles();
    this.createTimerUI();
    this.createHiddenKey(1400, 105);
    this.createPlayerBubbles();

    // Colisões e overlaps
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.keyZone, this.collectKey, null, this);

    // Câmera começa fixa verticalmente na primeira metade
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.startTimer();

  }
  // Constrói chão, desnível, escadinha, plataformas e porta
  buildRoom() {
    const gBg = this.add.graphics().setDepth(0); // fundo
    gBg.fillStyle(0x050d14);
    gBg.fillRect(0, 0, this.worldWidth, GAME_H + 200);

    const g = this.add.graphics().setDepth(1); // resto do cenário

    const floorY1 = this.floorY;      // nível do chão da primeira metade
    const floorY2 = this.floorY + 80; // nível do chão da segunda metade (mais baixo)
    const stepX = this.stepXRef;      // onde começa a escadinha
    this.floorY2 = floorY2;           // salva para uso em outros métodos

    // Chão da primeira metade
    g.fillStyle(0x0d1e2a);
    g.fillRect(0, floorY1, stepX, 80);
    g.fillStyle(0x1a3444);
    g.fillRect(0, floorY1, stepX, 3); // borda superior do chão

    // Três degraus da escadinha de descida
    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX, floorY1 + 20, 80, 80);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 80);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 80);
    // Bordas dos degraus
    g.fillStyle(0x1a3444);
    g.fillRect(stepX, floorY1 + 20, 80, 3);
    g.fillRect(stepX + 80, floorY1 + 40, 80, 3);
    g.fillRect(stepX + 160, floorY1 + 60, 80, 3);

    // Chão da segunda metade (nível mais baixo)
    g.fillStyle(0x0d1e2a);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 100);
    g.fillStyle(0x1a3444);
    g.fillRect(stepX + 240, floorY2, this.worldWidth - stepX - 240, 3);

    // Teto
    g.fillStyle(0x050d14);
    g.fillRect(0, 0, this.worldWidth, 30);

    // Paredes laterais
    g.fillStyle(0x080f18);
    g.fillRect(0, 0, 20, GAME_H + 150);
    g.fillRect(this.worldWidth - 20, 0, 20, GAME_H + 150);

    // Física do chão primeira metade
    const floor1 = this.add.rectangle(stepX / 2, floorY1 + 40, stepX, 80).setVisible(false);
    this.physics.add.existing(floor1, true);
    this.platforms.add(floor1);

    // Física dos degraus
    [
      { x: stepX + 40, y: floorY1 + 60, w: 80 },
      { x: stepX + 120, y: floorY1 + 80, w: 80 },
      { x: stepX + 200, y: floorY1 + 100, w: 80 },
    ].forEach(s => {
      const r = this.add.rectangle(s.x, s.y, s.w, 80).setVisible(false);
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    });

    // Física do chão segunda metade
    const floor2W = this.worldWidth - stepX - 240;
    const floor2 = this.add.rectangle(stepX + 240 + floor2W / 2, floorY2 + 50, floor2W, 100).setVisible(false);
    this.physics.add.existing(floor2, true);
    this.platforms.add(floor2);

    // Física das paredes
    const wallL = this.add.rectangle(10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    const wallR = this.add.rectangle(this.worldWidth - 10, GAME_H / 2, 20, GAME_H + 150).setVisible(false);
    [wallL, wallR].forEach(w => {
      this.physics.add.existing(w, true);
      this.platforms.add(w);
    });

    // Plataformas da primeira metade
    const platforms1 = [
      { x: 100, y: 350, w: 150 },
      { x: 350, y: 270, w: 120 },
      { x: 600, y: 190, w: 130 },
      { x: 850, y: 300, w: 110 },
      { x: 1050, y: 170, w: 120 },
      { x: 200, y: 140, w: 100 },
    ];

    // Plataformas da segunda metade (baseadas no floorY2)
    const platforms2 = [
      { x: 1700, y: floorY2 - 130, w: 130 },
      { x: 1950, y: floorY2 - 210, w: 120 },
      { x: 2200, y: floorY2 - 150, w: 110 },
      { x: 2500, y: floorY2 - 230, w: 130 },
      { x: 2750, y: floorY2 - 170, w: 120 },
      { x: 3000, y: floorY2 - 250, w: 130 },
      { x: 3250, y: floorY2 - 180, w: 120 },
      { x: 3500, y: floorY2 - 130, w: 110 },
    ];

    // Desenha e cria física de todas as plataformas
    [...platforms1, ...platforms2].forEach(p => {
      g.fillStyle(0x122230);
      g.fillRect(p.x, p.y, p.w, 16);
      g.fillStyle(0x1e3a50);
      g.fillRect(p.x, p.y, p.w, 3);
      // Algas decorativas em cima das plataformas
      g.fillStyle(0x0d4422, 0.7);
      g.fillRect(p.x + 10, p.y - 15, 4, 15);
      g.fillRect(p.x + 20, p.y - 22, 4, 22);

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Plataforma submersa no final — porta fica aqui
    const platFinal = { x: 3750, y: floorY2 - 60, w: 180 };
    g.fillStyle(0x122230);
    g.fillRect(platFinal.x, platFinal.y, platFinal.w, 16);
    g.fillStyle(0x1e3a50);
    g.fillRect(platFinal.x, platFinal.y, platFinal.w, 3);
    const platFinalR = this.add.rectangle(platFinal.x + platFinal.w / 2, platFinal.y + 8, platFinal.w, 16).setVisible(false);
    this.physics.add.existing(platFinalR, true);
    this.platforms.add(platFinalR);

    // Porta em cima da plataforma submersa
    const dx = platFinal.x + platFinal.w / 2 - 27, dw = 55, dh = 95;
    const dy = platFinal.y - dh;
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
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.15 },
      duration: 1200,
      yoyo: true,
      repeat: -1
    });

    this.add.text(dx + dw / 2, dy - 18, '003', {
      fontSize: '14px', fontFamily: 'Courier New',
      color: '#bb99ff', letterSpacing: 2
    }).setOrigin(0.5).setDepth(6);

    this.doorZone = this.add.zone(dx + dw / 2, dy + dh / 2, dw, dh);
    this.physics.add.existing(this.doorZone, true);
    this.doorDestination = 'Phase4Scene';
  }
  
  // Cria os salmões com posição, direção, velocidade e profundidade na água
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
      this.salmons.push({
        x: p.x,
        y: GAME_H,
        dir: p.dir,
        speed: p.speed,
        depth: p.depth, // profundidade fixa abaixo da superfície da água
        alpha: 0        // começa invisível — aparece suavemente
      });
    });
  }
 

  // Move, desenha e verifica colisão dos salmões a cada frame
  drawSalmons() {
    const g = this.salmonGfx;
    g.clear();

    const waterDepth = GAME_H - this.waterLevel;
    if (waterDepth < 10) return; // não desenha se a água ainda não apareceu

    this.salmons.forEach(s => {
      // Move horizontalmente
      s.x += s.speed * s.dir * 0.016;
      // Mantém na profundidade correta dentro da água
      s.y = this.waterLevel + s.depth;

      // Inverte direção nas bordas do cenário
      if (s.x > this.worldWidth - 30 || s.x < 30) s.dir *= -1;

      // Fade in suave ao aparecer
      if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + 0.02);

      // Verifica colisão com o player
      const dx = Math.abs(this.player.x - s.x);
      const dy = Math.abs(this.player.y - s.y);
      if (dx < 20 && dy < 20 && !this.hitCooldown) {
        this.hitCooldown = true;
        if (GameState.damage(1)) this.transitionTo('GameOverScene');
        this.time.delayedCall(2000, () => { this.hitCooldown = false; });
      }

      // Desenha o salmão
      const flip = s.dir < 0 ? -1 : 1;
      g.fillStyle(0xff8866, 0.85 * s.alpha);
      g.fillEllipse(s.x, s.y, 30 * flip, 12); // corpo
      g.fillStyle(0xff6644, 0.85 * s.alpha);
      g.fillTriangle(s.x - 14 * flip, s.y, s.x - 22 * flip, s.y - 8, s.x - 22 * flip, s.y + 8); // cauda
      g.fillStyle(0xffffff, s.alpha);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 2); // olho branco
      g.fillStyle(0x220000, s.alpha);
      g.fillCircle(s.x + 10 * flip, s.y - 1, 1); // pupila
      g.lineStyle(1, 0xff4444, 0.5 * s.alpha);
      g.beginPath();
      g.moveTo(s.x - 8 * flip, s.y - 4);
      g.lineTo(s.x + 6 * flip, s.y - 4);
      g.strokePath(); // listra lateral
    });
  }

  // Cria o objeto gráfico da água (preenchido no updateWater)
  createWater() {
    this.waterGfx = this.add.graphics().setDepth(3);
  }

  createPlayerBubbles() {
    this.bubbleGfx = this.add.graphics().setDepth(6);
    this.bubbles = [];
  }

  updatePlayerBubbles() {
    // Só cria bolhas quando a cabeça está submersa (player.y - 58 = topo da cabeça)
    if (this.player.y - 58 < this.waterLevel) {
      this.bubbleGfx.clear();
      return;
    }

    // Cria nova bolha a cada 30 frames
    if (Phaser.Math.Between(0, 30) === 0) {
      this.bubbles.push({
        x: this.player.x + Phaser.Math.Between(-8, 8),
        y: this.player.y - 20,
        r: Phaser.Math.Between(2, 4),
        speed: Phaser.Math.Between(1, 3) * 0.5
      });
    }

    // Move e desenha cada bolha
    const g = this.bubbleGfx;
    g.clear();
    this.bubbles = this.bubbles.filter(b => b.y > this.waterLevel - 10);
    this.bubbles.forEach(b => {
      b.y -= b.speed;
      b.x += Math.sin(b.y * 0.1) * 0.3; // movimento ondulante
      g.fillStyle(0x88ccff, 0.4);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(1, 0xaaddff, 0.3);
      g.strokeCircle(b.x, b.y, b.r);
    });
  }

  // Atualiza a água a cada frame — sobe, desenha e verifica física do player
  updateWater() {
    if (!this.gameActive || this.transitioning) return;

    // Velocidade normal nos primeiros 30s, acelera nos últimos 15s
    if (this.timeLeft > 15) {
      this.waterRiseSpeed = 0.4;
    } else {
      this.waterRiseSpeed = 0.4 + (15 - this.timeLeft) * 0.08;
    }

    // Para de subir quando chega a 80px do topo (deixa espaço para respirar)
    if (this.waterLevel > 80) {
      this.waterLevel -= this.waterRiseSpeed;
    }

    // Desenha a água
    const g = this.waterGfx;
    g.clear();
    g.fillStyle(0x0044aa, 0.4);
    g.fillRect(0, this.waterLevel, this.worldWidth, GAME_H + 150 - this.waterLevel);
    g.fillStyle(0x2266cc, 0.25);
    g.fillRect(0, this.waterLevel, this.worldWidth, 6); // superfície
    g.fillStyle(0x44aaff, 0.12);
    g.fillRect(0, this.waterLevel + 3, this.worldWidth, 3); // brilho da superfície

    if (this.player.y > this.waterLevel + 10 && !this.transitioning) {
      // Física dentro da água — gravidade reduzida e movimento flutuante
      this.player.body.setGravityY(-500);
      this.player.body.setMaxVelocityY(80);

      // Nadar para cima
      if (this.cursors.up.isDown || this.keys.jump.isDown || this.spaceKey.isDown) {
        this.player.body.setVelocityY(-500); // aumenta força do pulo
        this.player.body.setMaxVelocityY(500); // remove limite na hora do pulo
      }
      if (this.cursors.down.isDown || this.keys.down.isDown) {
        this.player.body.setVelocityY(120);
      }

      // Inicia o timer de afogamento — morre após 15 segundos submerso
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
    } else {
      // Fora da água — restaura física normal
      this.player.body.setGravityY(700);
      this.player.body.setMaxVelocityY(900);

      // Cancela o timer de afogamento ao sair da água
      if (this.underwaterTimer) {
        this.underwaterTimer.remove();
        this.underwaterTimer = null;
      }
    }
  }

  drawPlayer() {
    const isUnderwater = this.player.y > this.waterLevel;

    if (isUnderwater && this.underwaterTimer) {
      // Calcula quanto tempo passou submerso (0 = acabou de entrar, 1 = vai morrer)
      const elapsed = this.underwaterTimer.getElapsed();
      const progress = Math.min(elapsed / 15000, 1); // 15000ms = 15 segundos

      // Só começa a ficar vermelho nos últimos 5 segundos (progress > 0.66)
      if (progress > 0.66) {
        const redProgress = (progress - 0.66) / 0.34; // 0 a 1 nos últimos 5s

        // Interpola entre a cor normal e vermelho
        const r = Math.floor(0xd0 + (0xff - 0xd0) * redProgress);
        const g = Math.floor(0xc8 * (1 - redProgress));
        const b = Math.floor(0xf0 * (1 - redProgress));
        const color = (r << 16) | (g << 8) | b;

        this.playerGfx.clear();
        this.drawPlayerColor(color);
        return;
      }
    }

    super.drawPlayer(); // cor normal
  }

  //player muda de cor quando está prestes a se afogar
  drawPlayerColor(color) {
    const x = this.player.x;
    const y = this.player.y;
    const g = this.playerGfx;

    g.fillStyle(color);
    g.fillRect(x - 10, y - 38, 20, 28); // corpo
    g.fillRect(x - 9, y - 58, 18, 18); // cabeça
    g.fillStyle(COLORS.playerEye);
    const eyeX = this.facingLeft ? x - 5 : x + 2;
    g.fillRect(eyeX, y - 53, 4, 4);     // olho
    g.fillStyle(color, 0.8);
    g.fillRect(x - 8, y - 10, 7, 12);   // perna esquerda
    g.fillRect(x + 1, y - 10, 7, 12);   // perna direita
    g.fillRect(x - 14, y - 36, 5, 20);  // braço esquerdo
    g.fillRect(x + 9, y - 36, 5, 20);  // braço direito
  }

  // Bolhas decorativas espalhadas pelo cenário
  createBubbles() {
    const g = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const bx = Phaser.Math.Between(20, this.worldWidth - 20);
      const by = Phaser.Math.Between(50, this.floorY - 20);
      g.fillStyle(0x1155aa, 0.15);
      g.fillCircle(bx, by, Phaser.Math.Between(2, 6));
    }
  }

  // Corais decorativos no chão
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

  // Cria o contador de tempo no topo da tela
  createTimerUI() {
    this.timerText = this.add.text(GAME_W / 2, 20, '45', {
      fontSize: '22px',
      fontFamily: 'Courier New',
      color: '#55aaff',
      letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
  }

  // Contador regressivo — fica vermelho nos últimos 10s e mata ao chegar a 0
  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.gameActive || this.transitioning) return;
        this.timeLeft--;
        this.timerText.setText(String(this.timeLeft).padStart(2, '0'));
        if (this.timeLeft <= 10) this.timerText.setColor('#ff5555'); // fica vermelho
        if (this.timeLeft <= 0) {
          this.gameActive = false;
          if (GameState.damage(1)) {
            this.transitionTo('GameOverScene');
          } else {
            // Animação de inundação antes de reiniciar
            const flood = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0044aa, 0)
              .setScrollFactor(0).setDepth(30);
            this.tweens.add({
              targets: flood,
              alpha: 0.7,
              duration: 1000,
              onComplete: () => {
                this.cameras.main.fadeOut(500, 0, 20, 60);
                this.time.delayedCall(550, () => { this.scene.restart(); });
              }
            });
          }
        }
      },
      repeat: 44 // repete 44 vezes (45 segundos no total)
    });
  }

  // Verifica interação com a porta de saída
  handleInteract() {
    if (this.transitioning) return;
    if (this.isNear(this.doorZone)) {
      if (!this.keyFound) {
        this.showLockedMessage(); // aviso de porta trancada
        return;
      }
      this.transitionTo(this.doorDestination);
    }
  }

  update() {
    super.update();
    if (this.transitioning) return;

    // Câmera acompanha verticalmente apenas após o desnível
    if (this.player.x > this.stepXRef) {
      this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H + 200);
    } else {
      this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_H);
    }

    this.updateWater();
    this.drawSalmons();
    this.updatePlayerBubbles();

    // Prompt de interação com a porta
    if (this.isNear(this.doorZone) && !this.activePrompt) {
      this.createPrompt(this.keyFound ? TEXTS.ENTER : '🔒 Trancada', -70, this.keyFound ? '#ffdd44' : '#ff6666');
    } else if (!this.isNear(this.doorZone) && this.activePrompt) {
      this.activePrompt.destroy();
      this.activePrompt = null;
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
//  CENA: FASE 5 - ARENA (COM DECORAÇÕES)
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
    this.createTorches();
    this.createBanners();

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
    for (let x = 0; x < this.worldWidth; x += 50) {
      for (let y = this.floorY; y < GAME_H; y += 50) {
        g.fillStyle(((x + y) / 50) % 2 === 0 ? 0x0d0d20 : 0x0a0a18);
        g.fillRect(x, y, 50, 50);
      }
    }

    // Física do chão
    const floor = this.add.rectangle(this.worldWidth / 2, this.floorY + 30, this.worldWidth, 60)
      .setVisible(false);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

    // Plataformas em estilo torre
    const platforms = [
      { x: 80, y: 200, w: 100, tower: true }, { x: 300, y: 300, w: 120 }, { x: 550, y: 240, w: 100 },
      { x: 750, y: 310, w: 130 }, { x: 980, y: 260, w: 110 }, { x: 1200, y: 290, w: 120 },
      { x: 1430, y: 240, w: 100 }, { x: 1650, y: 200, w: 100, tower: true }
    ];

    platforms.forEach(p => {
      if (p.tower) {
        // Estrutura de torre
        g.fillStyle(0x1a1a3a);
        g.fillRect(p.x, p.y, p.w, GAME_H - 60 - p.y);
        g.fillStyle(0x2a2a5a);
        g.fillRect(p.x, p.y, p.w, 16);

        // Ameias
        for (let bx = p.x; bx < p.x + p.w; bx += 16) {
          g.fillStyle(0x3a3a6a);
          g.fillRect(bx, p.y - 12, 10, 12);
        }
      } else {
        g.fillStyle(0x161630);
        g.fillRect(p.x, p.y, p.w, 16);
        g.fillStyle(0x2a2a55, 0.8);
        g.fillRect(p.x, p.y, p.w, 3);
      }

      const plat = this.add.rectangle(p.x + p.w / 2, p.y + 8, p.w, 16).setVisible(false);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });
  }

  createTorches() {
    const g = this.add.graphics();
    const positions = [80, 350, 650, 950, 1250, 1550, 1750];

    positions.forEach(x => {
      // Tochas azuis/roxas (estilo arena)
      g.fillStyle(0x221155, 0.8);
      g.fillRect(x - 2, this.floorY - 130, 4, 25);
      g.fillStyle(0x6633ff, 0.8);
      g.fillCircle(x, this.floorY - 138, 6);

      const glow = this.add.rectangle(x, this.floorY - 138, 26, 26, 0x6633ff, 0.07);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.03, to: 0.13 },
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    });
  }

  createBanners() {
    const g = this.add.graphics();
    const positions = [200, 600, 1000, 1400];

    positions.forEach(x => {
      // Bandeira
      g.fillStyle(0x2200aa, 0.6);
      g.fillRect(x, 30, 40, 60);
      g.fillStyle(0x4400cc, 0.4);
      g.fillRect(x + 5, 35, 30, 50);

      // Símbolo de coroa
      g.fillStyle(0xffdd00, 0.6);
      g.fillTriangle(x + 8, 55, x + 14, 40, x + 20, 55);
      g.fillTriangle(x + 16, 55, x + 20, 40, x + 26, 55);
      g.fillTriangle(x + 22, 55, x + 28, 42, x + 34, 55);
    });
  }

  createHideSpots() {
    const g = this.add.graphics().setDepth(2);

    this.hideXs.forEach(cx => {
      const x = cx - 19;
      g.fillStyle(0x1a1a2a);
      g.fillRect(x, this.floorY - 85, 38, 85);
      g.lineStyle(1, 0x334466, 0.9);
      g.strokeRect(x, this.floorY - 85, 38, 85);

      // Maçaneta
      g.fillStyle(0x223355, 0.6);
      g.fillRect(x + 17, this.floorY - 46, 4, 18);

      this.add.text(cx, this.floorY - 98, 'ESCONDER', {
        fontSize: '8px',
        fontFamily: 'Courier New',
        color: '#4466aa',
        letterSpacing: 1
      }).setOrigin(0.5);

      const zone = this.add.zone(cx, this.floorY - 42, 50, 80);
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
        // Cavaleiro
        g.fillStyle(0x888899);
        g.fillRect(x - 11, y - 38, 22, 28);
        g.fillStyle(0xaaaacc);
        g.fillRect(x - 10, y - 58, 20, 20);
        g.fillStyle(0x666677);
        g.fillRect(x - 10, y - 62, 20, 8); // elmo
        g.fillStyle(0xccccee, 0.9);
        g.fillRect(x - 3 * flip, y - 55, 6, 8); // viseira
        g.fillStyle(0x444455);
        g.fillRect(x - 9, y - 10, 8, 12);
        g.fillRect(x + 1, y - 10, 8, 12);
        g.fillStyle(0x999aaa);
        g.fillRect(x + 9 * flip, y - 38, 8, 22); // escudo
      } else if (e.type === 'giant') {
        // Gigante
        g.fillStyle(0x556644);
        g.fillRect(x - 14, y - 40, 28, 34);
        g.fillStyle(0x667755);
        g.fillRect(x - 12, y - 62, 24, 22);
        g.fillStyle(0x223322);
        g.fillRect(x - 12, y - 65, 24, 8);
        g.fillStyle(0x445533);
        g.fillRect(x - 11, y - 10, 10, 14);
        g.fillRect(x + 1, y - 10, 10, 14);
        g.fillStyle(0x334422);
        g.fillRect(x - 18, y - 38, 6, 25);
        g.fillRect(x + 12, y - 38, 6, 25);
      } else {
        // Arqueiro
        g.fillStyle(0x885533);
        g.fillRect(x - 9, y - 38, 18, 28);
        g.fillStyle(0x996644);
        g.fillRect(x - 8, y - 58, 16, 20);
        g.fillStyle(0x553322);
        g.fillRect(x - 8, y - 62, 16, 8);
        g.fillStyle(0x775522);
        g.fillRect(x - 8, y - 10, 7, 12);
        g.fillRect(x + 1, y - 10, 7, 12);

        // Arco
        g.lineStyle(2, 0x664411, 0.9);
        g.beginPath();
        g.arc(x + 10 * flip, y - 30, 16, Math.PI * 0.3, Math.PI * 1.7);
        g.strokePath();
        g.lineStyle(1, 0xccaa77, 0.7);
        g.beginPath();
        g.moveTo(x + 10 * flip, y - 44);
        g.lineTo(x + 10 * flip, y - 16);
        g.strokePath();
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

        // Flash vermelho
        const flash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xff2200, 0.3)
          .setScrollFactor(0).setDepth(25);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 400,
          onComplete: () => flash.destroy()
        });

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

    this.add.text(dx + dw / 2, dy - 18, '005', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#bb99ff',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.exitZone = this.add.zone(dx + dw / 2, dy + dh / 2, dw, dh);
    this.physics.add.existing(this.exitZone, true);
  }

  triggerMaria() {
    if (this.mariaCooldown || this.inHiding) return;

    this.mariaCooldown = true;

    // Desenha Maria (versão roxa/glitch)
    const g = this.mariaGfx;
    g.clear();
    g.setAlpha(1);

    const mx = this.player.x + 80;
    const my = this.floorY - 60;

    g.fillStyle(0xff00ff, 0.25);
    g.fillCircle(mx, my - 40, 55);
    g.fillStyle(0xff44ff, 0.15);
    g.fillCircle(mx, my - 40, 70);
    g.fillStyle(0xcc44cc);
    g.fillRect(mx - 13, my - 55, 26, 36);
    g.fillRect(mx - 10, my - 78, 20, 24);
    g.fillStyle(0x330033);
    g.fillRect(mx - 12, my - 86, 24, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(mx - 5, my - 68, 8);
    g.fillCircle(mx + 5, my - 68, 8);
    g.fillStyle(0xaa00aa);
    g.fillCircle(mx - 5, my - 68, 5);
    g.fillCircle(mx + 5, my - 68, 5);
    g.fillStyle(0x000000);
    g.fillCircle(mx - 5, my - 68, 2);
    g.fillCircle(mx + 5, my - 68, 2);
    g.fillStyle(0x993399);
    g.fillRect(mx - 10, my - 19, 9, 20);
    g.fillRect(mx + 1, my - 19, 9, 20);

    this.tweens.add({
      targets: this.mariaGfx,
      alpha: 0,
      duration: 2000,
      onComplete: () => this.mariaGfx.clear()
    });

    // Aviso
    const warn = this.add.text(GAME_W / 2, GAME_H / 2 - 20, '(!) ESCONDA-SE!', {
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