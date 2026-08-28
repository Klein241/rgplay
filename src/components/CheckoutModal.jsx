import React, { useState } from 'react';
import { 
  X, Smartphone, CreditCard, Wallet, ShieldCheck, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Sparkles, AlertCircle, Lock, 
  KeyRound, Eye, EyeOff, ShieldAlert, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../services/api';
import { useAudio } from '../context/AudioContext';

export const CheckoutModal = ({ book, isOpen, onClose, onSuccess }) => {
  const { playBook } = useAudio();
  const [paymentMethod, setPaymentMethod] = useState('mobile_om'); // 'mobile_om', 'mobile_momo', 'card', 'wallet'
  const [phoneNumber, setPhoneNumber] = useState('690000000');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  
  // Saisie du mot de passe / PIN de débit
  const [secretPin, setSecretPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const [step, setStep] = useState('form'); // 'form', 'pin_auth', 'processing', 'success'
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  if (!isOpen || !book) return null;

  const finalPrice = book.discount_price || book.price;

  // 1. Passage à l'étape de saisie du mot de passe / code secret
  const handleProceedToPin = (e) => {
    e.preventDefault();
    setPinError('');
    setSecretPin('');
    setStep('pin_auth');
  };

  // 2. Validation du Code Secret & Déclenchement du Débit
  const handleConfirmDebit = async (e) => {
    if (e) e.preventDefault();
    if (!secretPin || secretPin.length < 4) {
      setPinError('Veuillez saisir votre mot de passe / code secret (minimum 4 caractères).');
      return;
    }

    setPinError('');
    setIsProcessing(true);
    setStep('processing');

    try {
      const res = await apiClient.checkout({
        audiobook: book,
        payment_method: paymentMethod,
        phone_number: phoneNumber,
        secret_pin: secretPin,
      });

      const tx = res.transaction_id || `TX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      setTransactionId(tx);
      setStep('success');
      setIsProcessing(false);

      // Déclencher les confettis
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#9d4edd', '#c77dff', '#f72585', '#06d6a0', '#ffbe0b']
      });

      if (onSuccess) onSuccess(book);
    } catch (err) {
      setIsProcessing(false);
      setStep('pin_auth');
      setPinError('Échec de la validation du mot de passe ou solde insuffisant. Veuillez réessayer.');
    }
  };

  const handleKeypadPress = (digit) => {
    if (secretPin.length < 6) {
      setSecretPin(prev => prev + digit);
      setPinError('');
    }
  };

  const handleKeypadDelete = () => {
    setSecretPin(prev => prev.slice(0, -1));
  };

  const handleStartListening = () => {
    playBook(book, 0, 0);
    onClose();
  };

  const getMethodDetails = () => {
    switch (paymentMethod) {
      case 'mobile_om':
        return {
          title: 'Orange Money Cameroun',
          subtitle: `Compte +237 ${phoneNumber}`,
          pinLabel: 'Code Secret Orange Money (PIN)',
          icon: '🟠',
          color: 'text-orange-400',
        };
      case 'mobile_momo':
        return {
          title: 'MTN Mobile Money',
          subtitle: `Compte +237 ${phoneNumber}`,
          pinLabel: 'Code Secret MTN MoMo (PIN)',
          icon: '🟡',
          color: 'text-yellow-400',
        };
      case 'card':
        return {
          title: 'Carte Bancaire Visa / Mastercard',
          subtitle: cardNumber ? `Carte se terminant par •••• ${cardNumber.slice(-4)}` : 'Carte Visa / Mastercard Sécurisée',
          pinLabel: 'Mot de Passe 3D Secure / Code Secret Bancaire',
          icon: '💳',
          color: 'text-purple-400',
        };
      case 'wallet':
        return {
          title: 'Portefeuille RG Play',
          subtitle: 'Solde du compte utilisateur',
          pinLabel: 'Mot de passe de confirmation de compte',
          icon: '💼',
          color: 'text-emerald-400',
        };
      default:
        return {
          title: 'Paiement Sécurisé',
          subtitle: 'Compte Débité',
          pinLabel: 'Code Secret / Mot de Passe',
          icon: '🔒',
          color: 'text-purple-400',
        };
    }
  };

  const methodDetails = getMethodDetails();

  return (
    <div className="fixed inset-0 z-55 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-md border border-purple-500/40 p-5 sm:p-7 shadow-2xl relative">
        
        {/* Bouton de fermeture */}
        {step !== 'processing' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ÉTAPE 1 : CHOIX DU MOYEN DE PAIEMENT & COORDONNÉES
            ══════════════════════════════════════════════════════════════════ */}
        {step === 'form' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-['Outfit']">Paiement Sécurisé</h3>
                <p className="text-xs text-purple-300">Orange Money, MTN MoMo & Carte Bancaire</p>
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
                  Montant à débiter : <span className="text-sm font-black">{finalPrice} FCFA</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleProceedToPin} className="space-y-4">
              {/* Choix des Moyens de Paiement */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Sélectionnez le compte à débiter :
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Orange Money */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_om')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'mobile_om'
                        ? 'bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-orange-400">Orange Money</span>
                    <span className="text-[10px] text-slate-400">Code #150#</span>
                  </button>

                  {/* MTN MoMo */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_momo')}
                    className={`p-3 rounded-2xl border flex flex-col items-start transition-all ${
                      paymentMethod === 'mobile_momo'
                        ? 'bg-yellow-500/20 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold text-yellow-400">MTN MoMo</span>
                    <span className="text-[10px] text-slate-400">Code *126#</span>
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
                    <span className="text-xs font-bold text-purple-300">Carte Visa / MC</span>
                    <span className="text-[10px] text-slate-400">Débit sécurisé</span>
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
                    <span className="text-xs font-bold text-emerald-400">Solde Compte</span>
                    <span className="text-[10px] text-slate-400">Débit direct</span>
                  </button>
                </div>
              </div>

              {/* Champ Numéro de Téléphone pour Mobile Money */}
              {paymentMethod.startsWith('mobile') && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Numéro de Téléphone {paymentMethod === 'mobile_om' ? 'Orange' : 'MTN'} :
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
                </div>
              )}

              {/* Champ Carte Bancaire */}
              {paymentMethod === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Numéro de Carte Visa / Mastercard :</label>
                    <input
                      type="text"
                      placeholder="4111 2222 3333 4444"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">Expiration :</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">CVV (3 chiffres) :</label>
                      <input
                        type="password"
                        maxLength="4"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton vers la saisie du mot de passe */}
              <button
                type="submit"
                className="w-full btn-gradient py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 group"
              >
                <Lock className="w-4 h-4 text-purple-200 group-hover:scale-110 transition-transform" />
                <span>Procéder à l'Autorisation ({finalPrice} FCFA)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ÉTAPE 2 : MODAL D'AUTORISATION & SAISIE DU MOT DE PASSE / PIN
            ══════════════════════════════════════════════════════════════════ */}
        {step === 'pin_auth' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Header avec icône de cadenas de sécurité */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Autorisation Sécurisée</span>
              </div>
            </div>

            {/* Récapitulatif du débit */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/30 text-center space-y-1.5">
              <span className="text-2xl">{methodDetails.icon}</span>
              <h4 className="text-xs font-bold text-slate-200">{methodDetails.title}</h4>
              <p className="text-[11px] text-purple-300">{methodDetails.subtitle}</p>
              <div className="pt-2">
                <span className="text-xs text-slate-400 block">Montant exact à débiter :</span>
                <span className="text-2xl font-black text-emerald-400">{finalPrice} FCFA</span>
              </div>
            </div>

            {/* Formulaire de Mot de Passe / Code Secret */}
            <form onSubmit={handleConfirmDebit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-pink-400" />
                    {methodDetails.pinLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1"
                  >
                    {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPin ? 'Masquer' : 'Afficher'}</span>
                  </button>
                </label>

                {/* Champ Password / PIN */}
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={secretPin}
                    onChange={(e) => {
                      setSecretPin(e.target.value);
                      setPinError('');
                    }}
                    placeholder="Entrez votre mot de passe ou code secret..."
                    autoFocus
                    required
                    maxLength="8"
                    className="w-full bg-white/8 border border-white/20 focus:border-emerald-400 rounded-2xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-none transition-colors"
                  />
                </div>

                {/* Clavier Virtuel Numérique Rapide pour Mobile Money */}
                {paymentMethod.startsWith('mobile') && (
                  <div className="mt-3 p-2 rounded-2xl bg-white/4 border border-white/8">
                    <div className="grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleKeypadPress(String(num))}
                          className="py-2.5 rounded-xl bg-white/5 hover:bg-purple-600/30 text-white font-bold text-sm hover:scale-105 active:scale-95 transition-all"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSecretPin('')}
                        className="py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/30 text-rose-300 font-bold text-xs"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('0')}
                        className="py-2.5 rounded-xl bg-white/5 hover:bg-purple-600/30 text-white font-bold text-sm"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={handleKeypadDelete}
                        className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                )}

                {pinError && (
                  <p className="text-[11px] text-rose-400 font-semibold mt-2 flex items-center gap-1 justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{pinError}</span>
                  </p>
                )}

                <p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">
                  🔒 Transaction chiffrée SSL 256 bits. Votre mot de passe autorise le débit immédiat.
                </p>
              </div>

              {/* Bouton de confirmation finale de débit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-98 transition-all"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmer & Débiter {finalPrice} FCFA</span>
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ÉTAPE 3 : TRAITEMENT SÉCURISÉ & DÉBIT
            ══════════════════════════════════════════════════════════════════ */}
        {step === 'processing' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 mx-auto flex items-center justify-center shadow-xl shadow-purple-500/40">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">
              Validation du mot de passe & débit en cours...
            </h3>
            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Débit de <strong>{finalPrice} FCFA</strong> sur votre compte <strong>{methodDetails.title}</strong>.
              Veuillez patienter un instant.
            </p>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-emerald-400 flex items-center justify-center gap-1.5 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Connexion sécurisée à la passerelle bancaire</span>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ÉTAPE 4 : DÉBIT RÉUSSI & LIVRE DÉBLOQUÉ
            ══════════════════════════════════════════════════════════════════ */}
        {step === 'success' && (
          <div className="text-center py-4 space-y-4 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white font-['Outfit']">
                Paiement & Débit Confirmés !
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Le livre <strong className="text-purple-300">{book.title}</strong> est désormais débloqué dans votre bibliothèque.
              </p>
            </div>

            {/* Reçu de transaction */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-1.5 text-left">
              <div className="flex justify-between text-slate-400">
                <span>Réf. Transaction :</span>
                <span className="font-mono text-purple-300 font-bold">{transactionId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Montant débité :</span>
                <span className="text-emerald-400 font-bold">{finalPrice} FCFA</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mode de débit :</span>
                <span className="text-slate-200">{methodDetails.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Statut :</span>
                <span className="text-emerald-400 font-bold">Validé & Débloqué</span>
              </div>
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
                Fermer & Continuer la Navigation
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
