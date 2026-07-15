import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { useSocketStore, useGameStore } from '../../stores/socketStore.js';
import GameScene from '../game/GameScene.ts';

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocketStore();
  const { setGameId, setPhase, setInGame } = useGameStore();
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserRef = useRef<Phaser.Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !isConnected || !socket) return;

    setGameId(gameId);
    setInGame(true);

    // Join the game room
    socket.emit('game:join', { gameId });
    socket.emit('game:ready');

    // Receive game state
    socket.on('game:joined', (data: { phase: string }) => {
      setPhase(data.phase);
      setLoading(false);
    });

    socket.on('game:error', (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
    });

    socket.on('game:state', (state: any) => {
      if (phaserRef.current) {
        const scene = phaserRef.current.scene.getScene('GameScene') as any;
        if (scene) {
          scene.updateState(state);
        }
      }
    });

    socket.on('game:ended', (data: { winner: string; duration: number }) => {
      setPhase('end');
      setTimeout(() => {
        setInGame(false);
        navigate(`/profile`);
      }, 10000);
    });

    // Initialize Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameRef.current!,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0a0e17',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [GameScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    };

    phaserRef.current = new Phaser.Game(config);

    // Pass socket to scene
    (phaserRef.current as any).__socket = socket;
    (phaserRef.current as any).__gameId = gameId;

    return () => {
      socket?.off('game:joined');
      socket?.off('game:error');
      socket?.off('game:state');
      socket?.off('game:ended');
      phaserRef.current?.destroy(true);
      phaserRef.current = null;
      setInGame(false);
    };
  }, [gameId, isConnected, socket]);

  if (error) {
    return (
      <div className="min-h-screen bg-game-darker flex items-center justify-center">
        <div className="card text-center max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="font-game text-2xl font-bold mb-2">Game Error</h2>
          <p className="text-white/60 mb-4">{error}</p>
          <button onClick={() => navigate('/play')} className="btn-primary">
            Return to Play
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-game-darker">
      {/* Phaser Canvas */}
      <div ref={gameRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-game-darker/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">⚔</div>
            <h2 className="font-game text-2xl font-bold mb-2">Loading Game...</h2>
            <p className="text-white/40">Preparing the battlefield</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
