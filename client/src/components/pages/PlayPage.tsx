import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketStore } from '../../stores/socketStore.js';
import toast from 'react-hot-toast';

const QUEUE_TYPES = [
  { id: 'ranked', name: 'Ranked Solo', icon: '🏆', description: 'Competitive 5v5 - Climb the ladder', color: 'border-yellow-500' },
  { id: 'normal', name: 'Normal Draft', icon: '⚔', description: 'Casual 5v5 - Practice and have fun', color: 'border-blue-500' },
  { id: 'practice', name: 'Practice Mode', icon: '🎯', description: 'vs AI - Learn the game', color: 'border-green-500' },
];

const ROLES = ['any', 'top', 'jungle', 'mid', 'adc', 'support'];

export default function PlayPage() {
  const navigate = useNavigate();
  const { emit, isConnected } = useSocketStore();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('any');
  const [isInQueue, setIsInQueue] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  const startQueue = () => {
    if (!selectedQueue) {
      toast.error('Please select a queue type');
      return;
    }
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }

    setIsInQueue(true);
    setQueueTime(0);

    emit('queue:join', {
      queueType: selectedQueue,
      role: selectedRole,
      championId: 'lux',
    });

    toast.success('Searching for match...');

    // Simulate queue time
    const interval = setInterval(() => {
      setQueueTime((t) => t + 1);
    }, 1000);

    // Listen for match found
    const handleMatchFound = (data: { gameId: string }) => {
      clearInterval(interval);
      toast.success('Match found!');
      navigate(`/game/${data.gameId}`);
    };

    // @ts-ignore
    window.__matchFoundHandler = handleMatchFound;
  };

  const cancelQueue = () => {
    emit('queue:cancel');
    setIsInQueue(false);
    setQueueTime(0);
    toast.success('Queue cancelled');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-game text-4xl font-bold text-center mb-8">
        CHOOSE YOUR <span className="text-primary-400">QUEUE</span>
      </h1>

      {/* Queue Type Selection */}
      {!isInQueue ? (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {QUEUE_TYPES.map((queue) => (
              <button
                key={queue.id}
                onClick={() => setSelectedQueue(queue.id)}
                className={`card border-2 transition-all ${
                  selectedQueue === queue.id
                    ? `border-primary-500 bg-primary-500/10 ${queue.color}`
                    : 'border-transparent hover:border-white/20'
                } text-left`}
              >
                <div className="text-4xl mb-3">{queue.icon}</div>
                <h3 className="font-game text-xl font-bold">{queue.name}</h3>
                <p className="text-white/40 text-sm mt-1">{queue.description}</p>
              </button>
            ))}
          </div>

          {/* Role Selection */}
          <div className="mb-8">
            <h2 className="font-game text-lg font-bold mb-3 text-white/60">Preferred Role</h2>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedRole === role
                      ? 'bg-primary-600 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {role === 'any' ? '🔀 Any' : role === 'top' ? '🛡️ Top' : role === 'jungle' ? '🌲 Jungle' : role === 'mid' ? '✨ Mid' : role === 'adc' ? '🏹 ADC' : '💚 Support'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startQueue} className="btn-primary w-full text-lg py-4" disabled={!selectedQueue}>
            🔍 Find Match
          </button>
        </>
      ) : (
        /* Queue Active */
        <div className="text-center py-16">
          <div className="text-6xl mb-6 animate-pulse">🔍</div>
          <h2 className="font-game text-3xl font-bold mb-2">Searching for Match...</h2>
          <p className="text-white/40 text-xl mb-2">
            {QUEUE_TYPES.find((q) => q.id === selectedQueue)?.name}
          </p>
          <p className="text-primary-400 text-4xl font-game font-bold my-6">
            {formatTime(queueTime)}
          </p>
          <p className="text-white/30 text-sm mb-8">Estimated wait time depends on your rank and role</p>

          <button onClick={cancelQueue} className="btn-danger">
            Cancel Search
          </button>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 card bg-game-dark/50">
        <h3 className="font-game text-lg font-bold mb-2">📋 Queue Info</h3>
        <ul className="text-white/50 text-sm space-y-1">
          <li>• All matches are 5v5 Summoner's Rift</li>
          <li>• Draft pick: both teams ban 3 champions each</li>
          <li>• Ranked matches award LP based on MMR difference</li>
          <li>• Surrender available after 15 minutes</li>
        </ul>
      </div>
    </div>
  );
}
