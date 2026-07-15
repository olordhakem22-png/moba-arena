import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-game-darker flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl mb-4">404</div>
        <h1 className="font-game text-3xl font-bold mb-2">PAGE NOT FOUND</h1>
        <p className="text-white/40 mb-6">The page you're looking for doesn't exist</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    </div>
  );
}
