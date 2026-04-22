export const dynamic = 'force-dynamic';
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-5">
      <div className="text-center max-w-sm">
        {/* Animated icon */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="w-20 h-20 rounded-2xl btn-brand flex items-center justify-center">
            <span className="text-3xl">📡</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-surface flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Pas de connexion</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          MargeChef nécessite une connexion internet pour analyser vos factures.
          Reconnectez-vous et réessayez.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="btn-brand text-white font-semibold px-8 py-3 rounded-xl w-full"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
