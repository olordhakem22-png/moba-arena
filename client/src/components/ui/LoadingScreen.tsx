export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-game-darker flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-float">🎮</div>
        <h1 className="font-game text-3xl font-bold text-white mb-2">
          MOBA<span className="text-primary-400">ARENA</span>
        </h1>
        <div className="flex items-center gap-2 justify-center mt-4">
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-white/40 mt-4 text-sm">Loading...</p>
      </div>
    </div>
  );
}
