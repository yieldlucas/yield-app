"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChefHat,
  Database,
  Headphones,
  HelpCircle,
  Layers,
  MessageCircle,
  X,
} from "lucide-react";

const FAQ_ITEMS: { q: string; Icon: typeof Database; a: string }[] = [
  {
    q: "Comment sont conservées mes données ?",
    Icon: Database,
    a: "Vos bons de livraison sont chiffrés (AES-256) et stockés sur des serveurs européens (AWS Paris, RGPD natif). Personne — ni l'équipe YIELD, ni un tiers — n'a accès au contenu de vos factures. Vous pouvez exporter ou supprimer toutes vos données en un clic depuis votre profil.",
  },
  {
    q: "Comment scanner plusieurs pages ?",
    Icon: Layers,
    a: "Au moment du scan, photographiez chaque page une par une depuis le sélecteur d'appareil photo (le bouton « Scanner un BL » garde la session ouverte entre chaque cliché). Pour les BL déjà numérisés en PDF multi-pages, utilisez « Importer » : YIELD lit toutes les pages d'un seul coup.",
  },
  {
    q: "Mon fournisseur n'est pas reconnu",
    Icon: HelpCircle,
    a: "YIELD lit n'importe quel BL imprimé ou manuscrit. Si le nom du fournisseur n'apparaît pas correctement, vous pouvez le corriger manuellement dans le détail de la facture. Le système retient la correction pour les prochains scans.",
  },
  {
    q: "Contacter un humain",
    Icon: Headphones,
    a: "L'équipe YIELD répond sous 2h en jours ouvrés (anciens chefs et restaurateurs). Email : chef@yield.restaurant — précisez votre numéro et l'urgence, on vous rappelle si besoin.",
  },
];

/**
 * Bouton flottant "Conciergerie" en bas-gauche du dashboard. Ouvre un drawer
 * contenant une FAQ pliable + un mailto pour joindre l'équipe.
 * State 100% interne — aucune donnée user requise, donc pas de prop.
 */
export function ConciergeButton() {
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-5 z-30 w-14 h-14 glass rounded-2xl flex items-center justify-center shadow-card border border-blue-100"
        aria-label="Aide & Conciergerie"
      >
        <MessageCircle size={22} className="text-blue-600" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-card md:bottom-6 md:left-6 md:right-auto md:w-96 md:rounded-3xl md:max-h-[80vh]"
            >
              <div className="sticky top-0 bg-white/90 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 btn-primary rounded-xl flex items-center justify-center">
                    <ChefHat size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-sm">Aide & Conciergerie</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Équipe disponible · réponse sous 2h
                    </div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-2">
                {FAQ_ITEMS.map((item, i) => {
                  const isOpen = openIdx === i;
                  const Icon = item.Icon;
                  return (
                    <div key={i} className={`rounded-2xl border transition-colors ${isOpen ? "border-blue-200 bg-blue-50/30" : "border-slate-100 bg-white"}`}>
                      <button
                        onClick={() => setOpenIdx(isOpen ? null : i)}
                        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOpen ? "bg-blue-100" : "bg-slate-50"}`}>
                          <Icon size={14} className={isOpen ? "text-blue-600" : "text-slate-500"} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-slate-800">{item.q}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <p className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                              {item.a}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <a
                  href="mailto:chef@yield.restaurant?subject=Aide%20YIELD"
                  className="btn-primary w-full mt-2 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Headphones size={15} /> Écrire à l&apos;équipe
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
