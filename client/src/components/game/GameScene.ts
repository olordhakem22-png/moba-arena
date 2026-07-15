import Phaser from 'phaser';
import type { GameState, GameEntity, Vector2 } from '../../../../shared/src/types/game.js';
import { MAP_CONFIG } from '../../../../shared/src/constants/game.js';

export default class GameScene extends Phaser.Scene {
  private gameId!: string;
  private socket: any;
  private gameState!: GameState;
  private entities: Map<string, Phaser.GameObjects.Container> = new Map();
  private minimap!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private healthBars: Map<string, { health: Phaser.GameObjects.Graphics; mana: Phaser.GameObjects.Graphics }> = new Map();
  private selectedEntity: string | null = null;
  private playerId: string = '';
  private isMyTurn: boolean = false;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private zoomLevel: number = 1;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    console.log('[GameScene] Creating game scene');
    
    this.socket = (this.game as any).__socket;
    this.gameId = (this.game as any).__gameId;
    console.log('[GameScene] Socket:', !!this.socket, 'GameId:', this.gameId);
    
    this.playerId = 'player';

    this.camera = this.cameras.main;
    this.camera.setBackgroundColor('#1a2a1a');
    this.camera.setZoom(1);
    this.camera.centerOn(400, 300); // Center of 800x600 view
    console.log('[GameScene] Camera setup done');

    // Draw smaller, focused map
    this.drawSmallMap();
    console.log('[GameScene] Map drawn');
    
    this.createMinimap();
    this.setupInput();
    this.setupSocketListeners();
    this.createDemoEntities();
    console.log('[GameScene] Demo entities created');
    
    // Hide loading after short delay
    setTimeout(() => {
      const loadingOverlay = document.querySelector('.fixed.inset-0.bg-game-darker\/90');
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
      }
    }, 2000);
  }

  // ==========================================
  // MAP RENDERING
  // ==========================================

  private drawSmallMap() {
    const graphics = this.add.graphics();
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background - grass
    graphics.fillStyle(0x1a3a1a, 1);
    graphics.fillRect(0, 0, width, height);

    // Grid
    graphics.lineStyle(1, 0x2a4a2a, 0.3);
    for (let x = 0; x <= width; x += 50) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 50) {
      graphics.lineBetween(0, y, width, y);
    }

    // Lane - middle horizontal
    graphics.lineStyle(60, 0x3a3a2a, 0.5);
    graphics.lineBetween(50, centerY, width - 50, centerY);

    // Blue base - left
    graphics.fillStyle(0x1e3a5f, 0.3);
    graphics.fillRect(20, 100, 150, 400);

    // Red base - right
    graphics.fillStyle(0x5f1e1e, 0.3);
    graphics.fillRect(width - 170, 100, 150, 400);

    // River
    graphics.fillStyle(0x2a4a6a, 0.4);
    graphics.beginPath();
    graphics.moveTo(centerX - 100, 0);
    graphics.lineTo(centerX + 100, 0);
    graphics.lineTo(width, height);
    graphics.lineTo(0, height);
    graphics.closePath();
    graphics.fill();

    console.log('[GameScene] Small map drawn');
  }

  private drawMap() {
    const graphics = this.add.graphics();
    const scale = 0.5; // Map scale factor

    const mapW = MAP_CONFIG.width * scale;
    const mapH = MAP_CONFIG.height * scale;
    const centerX = MAP_CONFIG.centerX * scale;
    const centerY = MAP_CONFIG.centerY * scale;

    // Background
    graphics.fillStyle(0x1a2a1a, 1);
    graphics.fillRect(0, 0, mapW, mapH);

    // Grid lines
    graphics.lineStyle(1, 0xffffff, 0.03);
    for (let x = 0; x <= mapW; x += 200) {
      graphics.lineBetween(x, 0, x, mapH);
    }
    for (let y = 0; y <= mapH; y += 200) {
      graphics.lineBetween(0, y, mapW, y);
    }

    // River (diagonal)
    graphics.fillStyle(0x2a4a6a, 0.4);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(centerX + 300, centerY - 200);
    graphics.lineTo(mapW, mapH);
    graphics.lineTo(centerX - 200, mapH);
    graphics.lineTo(0, centerY + 300);
    graphics.closePath();
    graphics.fill();

    // Blue base area
    graphics.fillStyle(0x1e3a5f, 0.15);
    graphics.fillCircle(MAP_CONFIG.BLUE_SPAWN.x * scale, MAP_CONFIG.BLUE_SPAWN.y * scale, 400);

    // Red base area
    graphics.fillStyle(0x5f1e1e, 0.15);
    graphics.fillCircle(MAP_CONFIG.RED_SPAWN.x * scale, MAP_CONFIG.RED_SPAWN.y * scale, 400);

    // Lanes
    graphics.lineStyle(40, 0x4a3a2a, 0.3);
    // Top lane
    graphics.lineBetween(
      MAP_CONFIG.BLUE_SPAWN.x * scale, MAP_CONFIG.BLUE_SPAWN.y * scale,
      MAP_CONFIG.RED_SPAWN.x * scale, MAP_CONFIG.RED_SPAWN.y * scale
    );

    // Mid lane
    graphics.lineBetween(
      MAP_CONFIG.BLUE_SPAWN.x * scale + 2000, MAP_CONFIG.BLUE_SPAWN.y * scale + 2000,
      MAP_CONFIG.RED_SPAWN.x * scale - 2000, MAP_CONFIG.RED_SPAWN.y * scale - 2000
    );

    // Jungle areas
    graphics.fillStyle(0x1a3a1a, 0.3);
    // Blue jungle
    graphics.fillRect(2000, 3000, 2000, 2500);
    // Red jungle
    graphics.fillRect(
      MAP_CONFIG.MAP_WIDTH * scale - 4000, MAP_CONFIG.MAP_HEIGHT * scale - 5500,
      2000, 2500
    );

    // Nexus
    graphics.fillStyle(0x3a8fff, 0.5);
    graphics.fillCircle(MAP_CONFIG.BLUE_NEXUS.x * scale, MAP_CONFIG.BLUE_NEXUS.y * scale, 50);
    graphics.fillStyle(0xff3a3a, 0.5);
    graphics.fillCircle(MAP_CONFIG.RED_NEXUS.x * scale, MAP_CONFIG.RED_NEXUS.y * scale, 50);

    // Set world bounds
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.centerOn(centerX, centerY);
  }

  // ==========================================
  // MINIMAP
  // ==========================================

  private createMinimap() {
    const mmWidth = 200;
    const mmHeight = 200;
    const mmX = this.cameras.main.width - mmWidth - 16;
    const mmY = this.cameras.main.height - mmHeight - 16;

    // Minimap background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0e17, 0.9);
    bg.fillRoundedRect(mmX - 4, mmY - 4, mmWidth + 8, mmHeight + 8, 8);
    bg.lineStyle(2, 0xffffff, 0.2);
    bg.strokeRoundedRect(mmX - 4, mmY - 4, mmWidth + 8, mmHeight + 8, 8);

    // Minimap content (scaled down)
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setPosition(mmX, mmY);
    this.drawMinimapContent();

    // Click to move camera on minimap
    const mmHitArea = this.add.rectangle(mmX + mmWidth / 2, mmY + mmHeight / 2, mmWidth, mmHeight, 0xffffff, 0);
    mmHitArea.setInteractive();
    mmHitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - mmX;
      const localY = pointer.y - mmY;
      const scaleX = (MAP_CONFIG.width * 0.5) / mmWidth;
      const scaleY = (MAP_CONFIG.height * 0.5) / mmHeight;
      this.cameras.main.centerOn(localX * scaleX, localY * scaleY);
    });
  }

  private drawMinimapContent() {
    this.minimapGraphics.clear();
    const scale = 0.5;

    // Map background
    this.minimapGraphics.fillStyle(0x1a2a1a, 1);
    this.minimapGraphics.fillRect(0, 0, 200, 200);

    // River
    this.minimapGraphics.fillStyle(0x2a4a6a, 0.5);
    this.minimapGraphics.beginPath();
    this.minimapGraphics.moveTo(0, 0);
    this.minimapGraphics.lineTo(100, 90);
    this.minimapGraphics.lineTo(200, 200);
    this.minimapGraphics.lineTo(100, 110);
    this.minimapGraphics.closePath();
    this.minimapGraphics.fill();

    // Nexuses
    this.minimapGraphics.fillStyle(0x3a8fff, 0.8);
    this.minimapGraphics.fillCircle(40, 40, 8);
    this.minimapGraphics.fillStyle(0xff3a3a, 0.8);
    this.minimapGraphics.fillCircle(160, 160, 8);

    // Draw entities on minimap
    for (const [id, container] of this.entities) {
      const entity = this.gameState?.entities[id];
      if (!entity) continue;

      const x = (entity.position.x * scale / 200) * 200;
      const y = (entity.position.y * scale / 200) * 200;
      const color = entity.team === 'blue' ? 0x3a8fff : 0xff3a3a;
      const size = entity.type === 'champion' ? 4 : 2;

      this.minimapGraphics.fillStyle(color, entity.team === 'blue' ? 0.8 : 0.8);
      this.minimapGraphics.fillCircle(x, y, size);
    }
  }

  // ==========================================
  // INPUT
  // ==========================================

  private setupInput() {
    // Mouse movement for camera
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.mouseX = pointer.x;
      this.mouseY = pointer.y;
    });

    // Right click - move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.socket?.emit('game:input', {
          type: 'move',
          data: { targetX: worldPoint.x / 0.5, targetY: worldPoint.y / 0.5 },
          timestamp: Date.now(),
        });
        this.showPingEffect(worldPoint.x, worldPoint.y, 0xffffff);
      }

      // Left click - select / attack
      if (pointer.leftButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const clicked = this.findEntityAt(worldPoint.x, worldPoint.y);

        if (clicked) {
          if (clicked !== this.playerId) {
            this.socket?.emit('game:input', {
              type: 'attack',
              data: { targetId: clicked },
              timestamp: Date.now(),
            });
          }
          this.selectEntity(clicked);
        } else {
          this.deselectEntity();
        }
      }
    });

    // Keyboard shortcuts
    const keys = this.input.keyboard!.addKeys({
      // @ts-ignore // @ts-ignore
      
      // @ts-ignore
      Q: Phaser.Input.Keyboard.KeyCodes.Q,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      F: Phaser.Input.Keyboard.KeyCodes.F,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
    });

    (keys as any).Q.on('down', () => this.castAbility('Q'));
    (keys as any).W.on('down', () => this.castAbility('W'));
    (keys as any).E.on('down', () => this.castAbility('E'));
    (keys as any).R.on('down', () => this.castAbility('R'));
    (keys as any).D.on('down', () => this.castAbility('D'));
    (keys as any).F.on('down', () => this.castAbility('F'));
    (keys as any).S.on('down', () => {
      this.socket?.emit('game:input', { type: 'stop', data: {}, timestamp: Date.now() });
    });
    (keys as any).ESC.on('down', () => this.deselectEntity());

    // Camera zoom
    this.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: any, deltaY: number) => {
      this.zoomLevel = Phaser.Math.Clamp(this.zoomLevel - deltaY * 0.001, 0.5, 2);
      this.cameras.main.setZoom(this.zoomLevel);
    });
  }

  private castAbility(key: string) {
    let targetX: number | undefined;
    let targetY: number | undefined;
    let targetId: string | undefined;

    if (this.selectedEntity && this.selectedEntity !== this.playerId) {
      targetId = this.selectedEntity;
    } else {
      const worldPoint = this.cameras.main.getWorldPoint(this.mouseX, this.mouseY);
      targetX = worldPoint.x / 0.5;
      targetY = worldPoint.y / 0.5;
    }

    this.socket?.emit('game:input', {
      type: 'ability',
      data: { ability: key, targetId, targetX, targetY },
      timestamp: Date.now(),
    });
  }

  // ==========================================
  // ENTITY RENDERING
  // ==========================================

  private createDemoEntities() {
    // Use smaller map area for mobile visibility
    const viewWidth = 800;
    const viewHeight = 600;
    const centerX = viewWidth / 2;
    const centerY = viewHeight / 2;

    // Create demo champions in center of screen
    const demoEntities: Partial<GameEntity>[] = [
      // Blue team - left side
      { id: 'player', team: 'blue', type: 'champion', position: { x: centerX - 150, y: centerY } },
      { id: 'ally1', team: 'blue', type: 'champion', position: { x: centerX - 200, y: centerY - 80 } },
      { id: 'ally2', team: 'blue', type: 'champion', position: { x: centerX - 200, y: centerY + 80 } },
      
      // Red team - right side
      { id: 'enemy1', team: 'red', type: 'champion', position: { x: centerX + 150, y: centerY } },
      { id: 'enemy2', team: 'red', type: 'champion', position: { x: centerX + 200, y: centerY - 80 } },
      { id: 'enemy3', team: 'red', type: 'champion', position: { x: centerX + 200, y: centerY + 80 } },
      
      // Minions in middle
      { id: 'minion1', team: 'blue', type: 'minion', position: { x: centerX - 80, y: centerY - 30 } },
      { id: 'minion2', team: 'blue', type: 'minion', position: { x: centerX - 60, y: centerY + 30 } },
      { id: 'minion3', team: 'red', type: 'minion', position: { x: centerX + 80, y: centerY - 30 } },
      { id: 'minion4', team: 'red', type: 'minion', position: { x: centerX + 60, y: centerY + 30 } },
      
      // Towers
      { id: 'tower1', team: 'blue', type: 'tower', position: { x: centerX - 300, y: centerY } },
      { id: 'tower2', team: 'red', type: 'tower', position: { x: centerX + 300, y: centerY } },
    ];

    for (const entity of demoEntities) {
      this.createEntity(entity as GameEntity);
    }

    this.playerId = 'player';
    console.log('[GameScene] Created', demoEntities.length, 'entities');
  }

  createEntity(entity: GameEntity) {
    // Direct positioning without scale
    const container = this.add.container(
      entity.position.x,
      entity.position.y
    );

    const isBlue = entity.team === 'blue';
    const baseColor = isBlue ? 0x1e3a5f : 0x5f1e1e;
    const accentColor = isBlue ? 0x3a8fff : 0xff3a3a;

    let size = 40; // Larger for mobile visibility
    let shape: Phaser.GameObjects.Shape;

    switch (entity.type) {
      case 'champion':
        // Body
        shape = this.add.circle(0, 0, size, baseColor);
        // Ring
        const ring = this.add.circle(0, 0, size + 5, accentColor, 0);
        ring.setStrokeStyle(4, accentColor);
        // Health bar
        const healthBar = this.add.rectangle(0, -size - 15, size * 2, 8, 0x00ff00);
        healthBar.setStrokeStyle(1, 0xffffff, 0.5);
        container.add([shape, ring, healthBar]);
        break;

      case 'minion':
        size = 15;
        shape = this.add.circle(0, 0, size, baseColor);
        container.add(shape);
        break;

      case 'tower':
        size = 50;
        shape = this.add.polygon(0, 0, [0, -size, size * 0.7, size * 0.5, -size * 0.7, size * 0.5], baseColor);
        const towerRing = this.add.circle(0, 0, size + 10, accentColor, 0);
        towerRing.setStrokeStyle(4, accentColor, 0.7);
        container.add([shape, towerRing]);
        break;

      default:
        shape = this.add.circle(0, 0, size, baseColor);
        container.add(shape);
    }

    this.entities.set(entity.id, container);

    // Health bar
    const healthBg = this.add.graphics();
    healthBg.fillStyle(0x000000, 0.7);
    healthBg.fillRect(-size, -size - 10, size * 2, 5);
    const healthFill = this.add.graphics();
    healthFill.fillStyle(0xe73c3c, 1);
    healthFill.fillRect(-size, -size - 10, size * 2 * 1, 5);
    container.add([healthBg, healthFill]);

    // Entity name
    const nameText = this.add.text(0, -size - 18, entity.id, {
      fontSize: '10px',
      color: isBlue ? '#3a8fff' : '#ff3a3a',
      fontFamily: 'Rajdhani',
    }).setOrigin(0.5);
    container.add(nameText);

    this.entities.set(entity.id, container);
    this.healthBars.set(entity.id, { health: healthFill, mana: healthFill });
  }

  updateEntity(id: string, updates: Partial<GameEntity>) {
    const container = this.entities.get(id);
    if (!container) return;

    if (updates.position) {
      const scale = 0.5;
      this.tweens.add({
        targets: container,
        x: updates.position.x * scale,
        y: updates.position.y * scale,
        duration: 100,
        ease: 'Linear',
      });
    }
  }

  private findEntityAt(worldX: number, worldY: number): string | null {
    const scale = 0.5;
    for (const [id, container] of this.entities) {
      const dx = container.x - worldX;
      const dy = container.y - worldY;
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        return id;
      }
    }
    return null;
  }

  private selectEntity(id: string) {
    this.selectedEntity = id;

    // Visual feedback
    const container = this.entities.get(id);
    if (container) {
      this.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        yoyo: true,
      });
    }
  }

  private deselectEntity() {
    this.selectedEntity = null;
  }

  // ==========================================
  // EFFECTS
  // ==========================================

  showPingEffect(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 10, color, 0);
    ring.setStrokeStyle(3, color);

    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  // ==========================================
  // SOCKET LISTENERS
  // ==========================================

  private setupSocketListeners() {
    this.socket?.on('game:state', (state: GameState) => {
      this.updateState(state);
    });

    this.socket?.on('game:chat', (data: any) => {
      this.showChatMessage(data);
    });

    this.socket?.on('game:ping', (data: any) => {
      const scale = 0.5;
      const color = data.type === 'danger' ? 0xff0000 : data.type === 'missing' ? 0xffff00 : 0x00ffff;
      this.showPingEffect(data.position.x * scale, data.position.y * scale, color);
    });

    this.socket?.on('game:emote', (data: any) => {
      this.showEmote(data.entityId, data.emoteId);
    });
  }

  updateState(state: GameState) {
    this.gameState = state;

    for (const entity of Object.values(state.entities)) {
      if (!this.entities.has(entity.id)) {
        this.createEntity(entity);
      }
      this.updateEntity(entity.id, entity);
    }

    this.drawMinimapContent();
  }

  private showChatMessage(data: any) {
    const text = this.add.text(this.cameras.main.centerX, 100, `${data.senderName}: ${data.message}`, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: 80,
      delay: 4000,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private showEmote(_entityId: string, _emoteId: string) {
    // Show floating emote above entity
  }

  // ==========================================
  // GAME LOOP
  // ==========================================

  update() {
    // Smooth entity interpolation happens via tweens in updateEntity
    this.drawMinimapContent();
  }
}
