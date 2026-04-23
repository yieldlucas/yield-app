import { ChefHat } from "lucide-react";

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "#F7F9FF" }}
    >
      <div className="text-center max-w-sm">
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="w-20 h-20 rounded-2xl btn-primary flex items-center justify-center">
            <ChefHat size={32} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">Pas de connexion</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          YIELD nécessite une connexion internet pour analyser vos bons de livraison.
          Reconnectez-vous et réessayez.
        </p>

        <a
          href="/"
          className="btn-primary block text-white font-semibold px-8 py-3 rounded-xl w-full text-center"
        >
          Réessayer
        </a>
      </div>
    </div>
  );
}
