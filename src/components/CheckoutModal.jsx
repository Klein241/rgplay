import React, { useState } from 'react';
import { 
  X, Smartphone, CreditCard, Wallet, ShieldCheck, CheckCircle2, 
  ArrowRight, Loader2, Sparkles, AlertCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../services/api';
import { useAudio } from '../context/AudioContext';

export const CheckoutModal = ({ book, isOpen, onClose, onSuccess }) => {
  const { playBook } = useAudio();
  const [paymentMethod, setPaymentMethod] = useState('camerpay_om'); // 'camerpay_om', 'camerpay_momo', 'card', 'wallet'
  const [phoneNumber, setPhoneNumber] = useState('690000000');
  const [cardNumber, setCardNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('form'); // 'form', 'ussd_wait', 'success'
  const [transactionId, setTransactionId] = useState('');

  if (!isOpen || !book) return null;

  const finalPrice = book.discount_price || book.price;

  const handlePay = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    if (paymentMethod.startsWith('camerpay')) {
      setStep('ussd_wait');
    }

    // Simulation de délai réseau & confirmation CamerPay / Cloudflare D1
    setTimeout(async () => {
      try {
        const res = await apiClient.checkout({
          audiobook: book,
          payment_method: paymentMethod,
          phone_number: phoneNumber,
        });

        setTransactionId(res.transaction_id || `CP_TX_${Date.now()}`);
        setStep('success');
        setIsProcessing(false);

        // Déclencher les confettis
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#9d4edd', '#c77dff', '#f72585', '#4cc9f0', '#ffbe0b']
        });

        if (onSuccess) onSuccess(book);
      } catch (err) {
        setIsProcessing(false);
        setStep('form');
        alert('Erreur lors du paiement. Veuillez réessayer.');
      }
    }, 2500);
  };

  const handleStartListening = () => {
    playBook(book, 0, 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-55 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-md border border-purple-500/40 p-6 sm:p-7 shadow-2xl relative">
        {/* Bouton de fermeture */}
        {step !== 'ussd_wait' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Étape 1 : Formulaire de sélection de paiement */}
        {step === 'form' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">Paiement Sécurisé</h3>
                <p className="text-xs text-purple-300">Intégration CamerPay Multi-Opérateurs</p>
              </div>
            </div>

            {/* Récapitulatif du Livre */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 mb-5">
              <img
                src={book.cover_url}
                alt={book.title}
                className="w-14 h-14 rounded-xl object-cover shadow"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">{book.title}</h4>
                <p className="text-[11px] text-slate-400">{book.author}</p>
                <p className="text-xs font-extrabold text-emerald-400 mt-1">
                  Total : {finalPrice} FCFA
                </p>
              </div>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              {/* Méthodes de Paiement */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Choisissez votre moyen de paiement :
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Orange Money */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('camerpay_om')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'camerpay_om'
                        ? 'bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-orange-400">Orange Money</span>
                    <span className="text-[10px] text-slate-400">CamerPay OM</span>
                  </button>

                  {/* MTN MoMo */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('camerpay_momo')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'camerpay_momo'
                        ? 'bg-yellow-500/20 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-yellow-400">MTN MoMo</span>
                    <span className="text-[10px] text-slate-400">CamerPay MoMo</span>
                  </button>

                  {/* Carte Bancaire */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-purple-300">Carte Bancaire</span>
                    <span className="text-[10px] text-slate-400">Visa / Mastercard</span>
                  </button>

                  {/* Portefeuille RG Play */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-emerald-400">Solde (15 000 F)</span>
                    <span className="text-[10px] text-slate-400">Débit immédiat</span>
                  </button>
                </div>
              </div>

              {/* Champ Numéro de Téléphone pour Mobile Money */}
              {paymentMethod.startsWith('camerpay') && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Numéro de Téléphone {paymentMethod === 'camerpay_om' ? 'Orange' : 'MTN'} :
                  </label>
                  <div className="flex rounded-2xl overflow-hidden border border-white/10 focus-within:border-purple-500 transition-colors">
                    <span className="bg-white/10 px-3.5 py-2.5 text-xs font-bold text-slate-300 flex items-center">
                      🇨🇲 +237
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="690 00 00 00"
                      required
                      className="w-full bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Un push USSD sera envoyé sur ce numéro pour valider la transaction.
                  </p>
                </div>
              )}

              {/* Champ Carte */}
              {paymentMethod === 'card' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">Numéro de carte :</label>
                  <input
                    type="text"
                    placeholder="4111 2222 3333 4444"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Bouton de confirmation */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full btn-gradient py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Traitement en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Payer {finalPrice} FCFA</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Étape 2 : Attente du push USSD sur téléphone */}
        {step === 'ussd_wait' && (
          <div className="text-center py-6 space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 mx-auto flex items-center justify-center shadow-xl shadow-purple-500/40">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">
              Validation sur votre téléphone...
            </h3>
            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Une invite sécurisée a été envoyée au <strong>+237 {phoneNumber}</strong>. 
              Veuillez taper votre code secret pour approuver le montant de <strong>{finalPrice} FCFA</strong>.
            </p>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-slate-400">
                Paiement sécurisé et instantané avec confirmation Mobile Money & Carte
              </p>
            </div>
          </div>
        )}

        {/* Étape 3 : Paiement Réussi & Déblocage du Livre */}
        {step === 'success' && (
          <div className="text-center py-4 space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white font-['Outfit']">
                Paiement Confirmé !
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Le livre <strong className="text-purple-300">{book.title}</strong> a été ajouté à votre bibliothèque.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-slate-400">
              Réf : {transactionId}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={handleStartListening}
                className="w-full btn-gradient py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30"
              >
                <Sparkles className="w-4 h-4" />
                <span>Commencer l'Écoute Immédiate</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Retour à la boutique
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
