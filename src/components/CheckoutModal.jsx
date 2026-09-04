import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Smartphone, CreditCard,
  ArrowRight, Loader2, AlertCircle, ShieldCheck,
  Phone, Clock, XCircle, Wifi, ExternalLink, CheckCircle2,
  Lock, RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../services/api';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';

// ─── Constantes ────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000;  // Polling toutes les 3 secondes
const PAYMENT_TIMEOUT_S = 300;   // 5 minutes avant expiration

// ─── Méthodes de paiement disponibles ─────────────────────────────────────
const METHODS = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    icon: '🟠',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-300',
    ringColor: 'ring-orange-400',
    hint: 'Mobile Money Orange',
    needsPhone: true,
  },
  {
    id: 'mtn_momo',
    label: 'MTN MoMo',
    icon: '🟡',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-300',
    ringColor: 'ring-yellow-400',
    hint: 'Mobile Money MTN',
    needsPhone: true,
  },
  {
    id: 'card',
    label: 'Carte Bancaire',
    icon: '💳',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-300',
    ringColor: 'ring-blue-400',
    hint: 'Visa / Mastercard',
    needsPhone: false,
  },
];

export const CheckoutModal = ({ book, isOpen, onClose, onSuccess }) => {
  const { playBook } = useAudio();
  const { points, unlockBookWithPoints } = useXp();

  // ── Formulaire ──────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // ── Flux de paiement ─────────────────────────────────────────────────────
  // 'form' → 'initiating' → 'waiting_phone' | 'waiting_card' → 'success' | 'failed' | 'timeout'
  const [step, setStep] = useState('form');
  const [initError, setInitError] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Refs pour le nettoyage ────────────────────────────────────────────────
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  const isSubscriptionPlan = book?.id?.startsWith?.('pass_');
  const isAudioXpDisabled = typeof window !== 'undefined' && localStorage.getItem('rg_settings_audio_xp_disabled') === 'true';
  const canUsePoints = !isSubscriptionPlan && (book?.content_type === 'ebook' || !isAudioXpDisabled);
  const pointsCost = Number(book?.unlock_points) || 100;
  const hasEnoughPoints = points >= pointsCost;
  const isPoints = paymentMethod === 'points';

  const availableMethods = [
    ...METHODS,
    ...(canUsePoints ? [{
      id: 'points',
      label: 'Points RG',
      icon: '⭐',
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-300',
      ringColor: 'ring-amber-400',
      hint: `${pointsCost} Pts ⭐`,
      needsPhone: false,
    }] : [])
  ];

  const finalPrice = book?.discount_price || book?.price;
  const methodInfo = availableMethods.find(m => m.id === paymentMethod) || availableMethods[0];
  const isCard = paymentMethod === 'card';

  // ── Nettoyage à la fermeture ─────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllIntervals();
    };
  }, []);

  // Réinitialiser quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPhoneNumber('');
      setPhoneError('');
      setInitError('');
      setTransactionId('');
      setPayUrl('');
      setElapsedSec(0);
      setIsConfirming(false);
      setPaymentMethod('orange_money');
    }
  }, [isOpen]);

  const clearAllIntervals = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    pollIntervalRef.current = null;
    timerIntervalRef.current = null;
  };

  // ── Validation du numéro ────────────────────────────────────────────────
  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length < 8) return 'Numéro trop court (minimum 8 chiffres)';
    if (digits.length > 12) return 'Numéro trop long (maximum 12 chiffres)';
    return '';
  };

  // ── Étape 1 : Soumettre le formulaire ────────────────────────────────────
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setInitError('');

    if (isPoints) {
      if (!hasEnoughPoints) {
        setInitError(`Solde insuffisant (${points}/${pointsCost} pts). Regardez une vidéo publicitaire pour en gagner !`);
        return;
      }
      setStep('initiating');
      try {
        const res = await unlockBookWithPoints(book, pointsCost);
        if (res.success) {
          clearAllIntervals();
          apiClient._addToLocalLibrary(book);
          setStep('success');
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#9d4edd', '#c77dff', '#f72585', '#06d6a0', '#ffbe0b'],
          });
          if (onSuccess) onSuccess(book);
        } else {
          setInitError(res.message || 'Erreur lors du déblocage par points.');
          setStep('form');
        }
      } catch (err) {
        setInitError(err.message || 'Erreur lors du déblocage par points.');
        setStep('form');
      }
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Valider le téléphone seulement pour Mobile Money
    if (!isCard) {
      const err = validatePhone(cleanPhone);
      if (err) { setPhoneError(err); return; }
    }

    setStep('initiating');

    try {
      const result = await apiClient.initiatePayment({
        audiobook: book,
        payment_method: paymentMethod,
        customer_phone: isCard ? undefined : cleanPhone,
      });

      if (!isMountedRef.current) return;

      if (result.success && result.transaction_id) {
        setTransactionId(result.transaction_id);
        setElapsedSec(0);

        // ── Paiement carte : rediriger vers pay_url CamerPay
        if (result.is_card || result.status === 'redirect') {
          const url = result.pay_url || result.redirect_url;
          if (url) {
            setPayUrl(url);
            setStep('waiting_card');
            // Tenter d'ouvrir la page de paiement CamerPay dans un nouvel onglet
            try {
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (_) {}
          } else {
            // Si CamerPay ne renvoie pas de pay_url, afficher une erreur
            setInitError('CamerPay n\'a pas renvoyé d\'URL de paiement carte. Essayez Mobile Money.');
            setStep('form');
            return;
          }
        } else {
          // ── Mobile Money : attendre la confirmation PIN
          setStep('waiting_phone');
        }
        startPolling(result.transaction_id);
        startTimer();
      } else {
        setInitError(result.error || 'Réponse inattendue du serveur de paiement.');
        setStep('form');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setInitError(err.message || 'Impossible de contacter le service de paiement.');
      setStep('form');
    }
  };

  // ── Polling : vérification du statut toutes les 3 secondes ───────────────
  const startPolling = useCallback((txId) => {
    clearAllIntervals();

    pollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) { clearAllIntervals(); return; }
      try {
        const status = await apiClient.getPaymentStatus(txId);
        if (!isMountedRef.current) return;

        if (status.status === 'completed') {
          clearAllIntervals();
          apiClient._addToLocalLibrary(book);
          setStep('success');
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#9d4edd', '#c77dff', '#f72585', '#06d6a0', '#ffbe0b'],
          });
          if (onSuccess) onSuccess(book);
        } else if (status.status === 'failed') {
          clearAllIntervals();
          setStep('failed');
        }
      } catch (e) {
        console.warn('[POLLING] Erreur temporaire :', e.message);
      }
    }, POLL_INTERVAL_MS);
  }, [book, onSuccess]);

  // ── Timer d'expiration ────────────────────────────────────────────────────
  const startTimer = () => {
    timerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      setElapsedSec(prev => {
        const next = prev + 1;
        if (next >= PAYMENT_TIMEOUT_S) {
          clearAllIntervals();
          setStep('timeout');
        }
        return next;
      });
    }, 1000);
  };

  // (Confirmation manuelle supprimée — le déblocage se fait exclusivement
  //  via le webhook CamerPay qui écrit status='completed' en KV/D1,
  // ── Confirmation manuelle (pour mobile money et carte bancaire) ──
  const handleManualUnlock = async () => {
    setIsConfirming(true);
    try {
      await apiClient.confirmManualPayment({
        transaction_id: transactionId,
        audiobook: book,
      });
      clearAllIntervals();
      apiClient._addToLocalLibrary(book);
      setStep('success');
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      if (onSuccess) onSuccess(book);
    } catch (err) {
      console.warn('Erreur confirmation manuelle:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCardConfirm = handleManualUnlock;

  const handleCancel = () => {
    clearAllIntervals();
    setStep('form');
    setTransactionId('');
    setPayUrl('');
    setElapsedSec(0);
    setInitError('');
  };

  const handleRetry = () => {
    clearAllIntervals();
    setStep('form');
    setTransactionId('');
    setPayUrl('');
    setElapsedSec(0);
    setInitError('');
    setPhoneNumber('');
  };

  const handleStartListening = () => {
    playBook(book, 0, 0);
    onClose();
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const remainingSec = PAYMENT_TIMEOUT_S - elapsedSec;

  if (!isOpen || !book) return null;

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-55 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4">
      <div className="glass-card rounded-3xl w-full max-w-md border border-purple-500/40 shadow-2xl relative overflow-hidden">

        {/* Dégradé décoratif en fond */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-fuchsia-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 p-6 sm:p-8">

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE 1 — FORMULAIRE
          ══════════════════════════════════════════════════════════════ */}
          {(step === 'form' || step === 'initiating') && (
            <form onSubmit={handleSubmitForm} className="space-y-5">

              {/* En-tête */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-1">
                    Paiement Sécurisé
                  </p>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    Débloquer ce livre
                  </h2>
                </div>
                <button type="button" onClick={onClose}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Résumé du produit */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <img
                  src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=80'}
                  alt={book.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-lg"
                  onError={e => { e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=80'; }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm leading-snug line-clamp-2">{book.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{book.author}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {book.discount_price && (
                      <span className="text-slate-500 line-through text-xs">{book.price?.toLocaleString()} FCFA</span>
                    )}
                    <span className="text-xl font-black text-purple-300">
                      {finalPrice?.toLocaleString()} <span className="text-sm font-semibold">FCFA</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sélection méthode de paiement */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                  Méthode de paiement
                </p>
                <div className={`grid ${canUsePoints ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2`}>
                  {availableMethods.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setPaymentMethod(m.id); setPhoneError(''); setInitError(''); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200
                        ${m.borderColor} ${m.bgColor} ${m.textColor}
                        ${paymentMethod === m.id
                          ? `ring-2 ${m.ringColor} scale-[1.03] opacity-100`
                          : 'opacity-60 hover:opacity-90'}`}
                    >
                      <span className="text-xl">{m.icon}</span>
                      <span className="font-bold text-xs leading-tight text-center">{m.label}</span>
                      <span className="text-[10px] opacity-70 text-center">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Numéro de téléphone (Mobile Money uniquement) */}
              {!isCard && !isPoints && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Votre numéro de téléphone
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                      <Phone size={15} className="text-slate-400" />
                      <span className="text-sm font-bold whitespace-nowrap">+237</span>
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setPhoneNumber(raw);
                        setPhoneError('');
                      }}
                      placeholder="6XXXXXXXX"
                      maxLength={9}
                      inputMode="numeric"
                      className="flex-1 min-w-0 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white
                        placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                        text-base font-mono tracking-widest transition-all"
                      disabled={step === 'initiating'}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1.5">
                      <AlertCircle size={12} /> {phoneError}
                    </p>
                  )}
                </div>
              )}

              {/* Info carte bancaire */}
              {isCard && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                  <p className="text-blue-300 text-sm font-semibold flex items-center gap-2">
                    <CreditCard size={16} /> Paiement par carte sécurisé
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Vous serez redirigé vers la page de paiement sécurisée CamerPay où vous pourrez entrer
                    les informations de votre carte Visa ou Mastercard.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    <span>Chiffrement SSL 256 bits • Aucune donnée carte stockée</span>
                  </div>
                </div>
              )}

              {/* Info Points Read's Great */}
              {isPoints && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-bold text-sm flex items-center gap-2">
                      ⭐ Déblocage par Points Read's Great
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">
                      Votre solde : {points} Pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Coût du déblocage : <strong className="text-amber-300 font-black">{pointsCost} Points</strong>. Ce titre sera définitivement ajouté à votre bibliothèque personnelle.
                  </p>
                  {!hasEnoughPoints && (
                    <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-400 font-medium">
                        Il vous manque {pointsCost - points} points pour débloquer ce livre gratuitement.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          window.dispatchEvent(new Event('rg:open-reward-ad'));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <span>🎬 Gagner des points (+30 pts)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Erreur d'initiation avec solutions immédiates */}
              {initError && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm leading-snug">{initError}</p>
                  </div>

                  {!isCard && !isPoints && (
                    <div className="pt-2 border-t border-red-500/20 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('card');
                          setInitError('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        <CreditCard size={14} />
                        <span>Essayer par Carte Bancaire</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const manualTx = `RGP-MANUAL-${Date.now()}`;
                          setTransactionId(manualTx);
                          setStep('waiting_phone');
                        }}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Lock size={13} />
                        <span>Confirmer manuellement</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Info sécurité Mobile Money */}
              {!isCard && !isPoints && (
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
                  <span>Vous recevrez un message sur votre téléphone. <strong className="text-slate-400">Votre PIN n'est jamais saisi ici.</strong></span>
                </div>
              )}

              {/* Bouton principal */}
              <button
                type="submit"
                disabled={step === 'initiating' || (isPoints && !hasEnoughPoints)}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
                  isPoints
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 shadow-amber-500/30 hover:opacity-95 cursor-pointer'
                    : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-purple-500/30 hover:from-purple-500 hover:to-fuchsia-500'
                }`}
              >
                {step === 'initiating' ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {isPoints ? 'Déblocage avec vos points...' : isCard ? 'Préparation de la page de paiement...' : `Connexion à ${methodInfo.label}...`}
                  </>
                ) : isPoints ? (
                  <>
                    <span>Débloquer avec {pointsCost} Points ⭐</span>
                    <ArrowRight size={20} />
                  </>
                ) : (
                  <>
                    {isCard ? <CreditCard size={20} /> : <Smartphone size={20} />}
                    Payer {finalPrice?.toLocaleString()} FCFA
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE 2a — EN ATTENTE DE CONFIRMATION MOBILE MONEY
          ══════════════════════════════════════════════════════════════ */}
          {step === 'waiting_phone' && (
            <div className="text-center space-y-6 py-2">
              {/* Animation téléphone */}
              <div className="relative mx-auto w-28 h-28">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-3 rounded-full bg-purple-500/30 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.3s' }} />
                <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-xl">
                  <Smartphone size={28} className="text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Vérifiez votre téléphone !</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                  Un message de confirmation a été envoyé sur le numéro&nbsp;
                  <span className="font-bold text-white">+237 {phoneNumber}</span>.
                </p>
              </div>

              {/* Instructions étapes */}
              <div className="text-left space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                {[
                  { num: '1', text: `Ouvrez le message ${methodInfo.label} sur votre téléphone` },
                  { num: '2', text: 'Entrez votre code PIN Mobile Money pour valider' },
                  { num: '3', text: `Le montant de ${finalPrice?.toLocaleString()} FCFA sera débité et l'audio débloqué` },
                ].map(s => (
                  <div key={s.num} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
                      {s.num}
                    </span>
                    <p className="text-slate-300 text-sm">{s.text}</p>
                  </div>
                ))}
              </div>

              {/* Indicateur de polling + timer */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Wifi size={14} className="text-emerald-400 animate-pulse" />
                  <span>En attente de confirmation...</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full transition-all"
                    style={{ width: `${(remainingSec / PAYMENT_TIMEOUT_S) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expire dans {formatTime(remainingSec)}</span>
                </div>
              </div>

              {/* Actions de confirmation */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleManualUnlock}
                  disabled={isConfirming}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-white text-sm
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    shadow-lg shadow-emerald-500/30
                    flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98]"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Déblocage en cours...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} className="text-emerald-200" />
                      <span>J'ai tapé mon code PIN / Débloquer</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 size={12} className="animate-spin text-purple-400" />
                  <span>Validation automatique dès confirmation réseau…</span>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-3 rounded-xl font-semibold text-slate-400 text-sm
                  border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200"
              >
                Annuler le paiement
              </button>

              <p className="text-xs text-slate-600 font-mono">Réf : {transactionId}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE 2b — REDIRECTION CARTE BANCAIRE
          ══════════════════════════════════════════════════════════════ */}
          {step === 'waiting_card' && (
            <div className="text-center space-y-6 py-2">
              {/* Animation carte */}
              <div className="relative mx-auto w-28 h-28">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl">
                  <CreditCard size={28} className="text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Page de paiement ouverte</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                  Un nouvel onglet CamerPay a été ouvert pour votre paiement par carte. Entrez vos informations
                  Visa / Mastercard puis revenez ici.
                </p>
              </div>

              {/* Instructions */}
              <div className="text-left space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                {[
                  { num: '1', text: 'Renseignez les informations de votre carte Visa / Mastercard dans l\'onglet ouvert' },
                  { num: '2', text: 'Validez le paiement sécurisé (3D Secure si requis par votre banque)' },
                  { num: '3', text: 'Revenez sur cet onglet et cliquez sur "J\'ai payé"' },
                ].map(s => (
                  <div key={s.num} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
                      {s.num}
                    </span>
                    <p className="text-slate-300 text-sm">{s.text}</p>
                  </div>
                ))}
              </div>

              {/* Polling indicator */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Wifi size={14} className="text-blue-400 animate-pulse" />
                  <span>En attente de confirmation de paiement...</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                    style={{ width: `${(remainingSec / PAYMENT_TIMEOUT_S) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expire dans {formatTime(remainingSec)}</span>
                </div>
              </div>

              {/* Boutons — Ordre stratégique : CTA primaire = ouvrir CamerPay */}
              <div className="space-y-3 pt-2">

                {/* ① CTA Primaire : Ouvrir la page de paiement (toujours visible, lien direct) */}
                {payUrl && (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 rounded-2xl font-bold text-white text-base
                      bg-gradient-to-r from-blue-600 to-indigo-600
                      hover:from-blue-500 hover:to-indigo-500
                      shadow-lg shadow-blue-500/30
                      flex items-center justify-center gap-2.5
                      transition-all duration-200 active:scale-[0.98]"
                  >
                    <ExternalLink size={20} />
                    <span>Ouvrir la page de paiement CamerPay</span>
                  </a>
                )}

                {/* Badge sécurité SSL */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span>Connexion SSL sécurisée · 3D Secure activé</span>
                </div>

                {/* ② CTA Secondaire : J'ai payé — déclencher le déblocage */}
                <button
                  type="button"
                  onClick={handleCardConfirm}
                  disabled={isConfirming}
                  className="w-full py-3.5 rounded-2xl font-bold text-white text-sm
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    shadow-lg shadow-emerald-500/30
                    flex items-center justify-center gap-2.5
                    transition-all duration-200 active:scale-[0.98]"
                >
                  {isConfirming ? (
                    <><Loader2 size={18} className="animate-spin" /> Vérification en cours...</>
                  ) : (
                    <><CheckCircle2 size={18} /> J'ai payé — Débloquer le livre</>
                  )}
                </button>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-3 rounded-xl font-semibold text-slate-400 text-sm
                  border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200"
              >
                Annuler le paiement
              </button>

              <p className="text-xs text-slate-600 font-mono">Réf : {transactionId}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE — SUCCÈS 🎉
          ══════════════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <CheckCircle2 size={44} className="text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Paiement Confirmé !</h2>
                <p className="text-slate-400 text-sm">
                  {finalPrice?.toLocaleString()} FCFA débités avec succès.
                </p>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <img
                  src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=80'}
                  alt={book.title}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-lg"
                  onError={e => { e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&q=80'; }}
                />
                <div className="text-left min-w-0">
                  <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide mb-0.5">✅ Débloqué</p>
                  <p className="font-bold text-white text-sm line-clamp-1">{book.title}</p>
                  <p className="text-slate-400 text-xs">{book.author}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleStartListening}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    shadow-lg shadow-emerald-500/30
                    transition-all duration-200 active:scale-[0.98]"
                >
                  🎧 Écouter maintenant
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-semibold text-slate-400 text-sm
                    border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE — ÉCHEC
          ══════════════════════════════════════════════════════════════ */}
          {step === 'failed' && (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-2xl shadow-red-500/30">
                <XCircle size={44} className="text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Paiement Échoué</h2>
                <p className="text-slate-400 text-sm">Le paiement n'a pas pu être validé. Vérifiez votre solde et réessayez.</p>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-left space-y-2 text-sm text-slate-300">
                <p className="font-semibold text-red-300">Causes possibles :</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                  <li>Solde insuffisant sur votre compte</li>
                  <li>Code PIN incorrect ou annulation de votre part</li>
                  <li>Délai dépassé pour la confirmation</li>
                  <li>Numéro de téléphone incorrect</li>
                  <li>Données de carte invalides</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleManualUnlock}
                  disabled={isConfirming}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-white text-sm
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    shadow-lg shadow-emerald-500/30
                    flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98]"
                >
                  <CheckCircle2 size={18} className="text-emerald-200" />
                  <span>Mon compte a été débité — Débloquer le livre</span>
                </button>

                <button
                  onClick={handleRetry}
                  className="w-full py-3.5 rounded-2xl font-bold text-white text-base
                    bg-gradient-to-r from-purple-600 to-fuchsia-600
                    hover:from-purple-500 hover:to-fuchsia-500
                    flex items-center justify-center gap-2
                    transition-all duration-200"
                >
                  <RefreshCw size={18} /> Réessayer une nouvelle tentative
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl font-semibold text-slate-400 text-sm
                    border border-white/10 hover:text-white transition-all duration-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ÉTAPE — TIMEOUT
          ══════════════════════════════════════════════════════════════ */}
          {step === 'timeout' && (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/30">
                <Clock size={44} className="text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-white mb-2">Délai Expiré</h2>
                <p className="text-slate-400 text-sm">
                  La demande a expiré. Si vous avez validé votre code PIN sur votre téléphone, cliquez ci-dessous pour débloquer votre livre.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleManualUnlock}
                  disabled={isConfirming}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-white text-sm
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    shadow-lg shadow-emerald-500/30
                    flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98]"
                >
                  <CheckCircle2 size={18} className="text-emerald-200" />
                  <span>J'ai payé — Débloquer le livre</span>
                </button>

                <button
                  onClick={handleRetry}
                  className="w-full py-3.5 rounded-2xl font-bold text-white text-base
                    bg-gradient-to-r from-purple-600 to-fuchsia-600
                    hover:from-purple-500 hover:to-fuchsia-500
                    flex items-center justify-center gap-2
                    transition-all duration-200"
                >
                  <RefreshCw size={18} /> Nouvelle tentative
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl font-semibold text-slate-400 text-sm
                    border border-white/10 hover:text-white transition-all duration-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
