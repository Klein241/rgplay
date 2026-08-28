import React, { useState } from 'react';
import { 
  X, Star, Play, Clock, Headphones, CheckCircle2, ShieldCheck, 
  Smartphone, CreditCard, Sparkles, BookOpen, Share2 
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export const AudiobookDetailModal = ({ book, isOpen, onClose, onBuy, isPurchased }) => {
  const { playPreview, playBook, currentBook, isPlaying } = useAudio();
  const [activeTab, setActiveTab] = useState('synopsis'); // 'synopsis', 'chapters', 'reviews'

  // État des avis & Partage
  const [userRating, setUserRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const getStoredReviews = () => {
    if (!book) return [];
    try {
      const stored = localStorage.getItem(`rg_reviews_${book.id}`);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [
      { id: 'rev-1', author_name: 'Christian N.', rating: 5, date: 'Il y a 3 jours', comment: 'Une narration absolument captivante et une clarté audio exceptionnelle !' },
      { id: 'rev-2', author_name: 'Aline M.', rating: 5, date: 'Il y a 1 semaine', comment: 'Très enrichissant, je recommande vivement cette version audio.' },
    ];
  };

  const [reviews, setReviews] = useState([]);

  React.useEffect(() => {
    if (book) {
      setReviews(getStoredReviews());
      setReviewSubmitted(false);
      setUserReviewText('');
      setUserRating(5);
    }
  }, [book?.id]);

  const handleSubmitReview = () => {
    if (!userRating || !userReviewText.trim() || !book) return;
    let userName = 'Utilisateur';
    try {
      const p = JSON.parse(localStorage.getItem('rg_user_profile') || '{}');
      if (p.name) userName = p.name;
    } catch (_) {}

    const newRev = {
      id: `rev-${Date.now()}`,
      author_name: userName,
      rating: userRating,
      date: "À l'instant",
      comment: userReviewText.trim(),
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);
    try {
      localStorage.setItem(`rg_reviews_${book.id}`, JSON.stringify(updated));
    } catch (_) {}

    setReviewSubmitted(true);
    setUserReviewText('');
    window.dispatchEvent(new CustomEvent('rg:book-rated', { detail: { bookId: book.id, rating: userRating } }));
  };

  if (!isOpen || !book) return null;

  const isCurrentPlaying = currentBook?.id === book.id && isPlaying;
  const formattedDuration = `${Math.floor(book.duration_seconds / 3600)}h ${Math.floor((book.duration_seconds % 3600) / 60)}m`;

  const DEFAULT_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80';
  const coverSrc = !book.cover_url
    ? DEFAULT_COVER
    : book.cover_url.includes('r2.cloudflarestorage.com') && book.cover_r2_key
      ? `/api/r2/download?key=${encodeURIComponent(book.cover_r2_key)}`
      : book.cover_url.includes('r2.cloudflarestorage.com')
        ? DEFAULT_COVER
        : book.cover_url;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-3xl border border-purple-500/30 overflow-hidden shadow-2xl relative">
        {/* Boutons d'Action Haut Droite : Partage & Fermeture */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/?book=${book.id}`;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: book.title,
                    text: `Écoutez "${book.title}" par ${book.author} sur RG Play`,
                    url,
                  });
                } catch (_) {}
              } else {
                navigator.clipboard.writeText(url);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2500);
              }
            }}
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white transition-all backdrop-blur-md flex items-center gap-1 text-xs"
            title="Partager ce livre audio"
          >
            <Share2 className="w-4 h-4 text-purple-300" />
            {shareCopied && <span className="text-[10px] text-emerald-400 font-bold pr-1">Copié !</span>}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white transition-all backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bannière de Fond Dégradée */}
        <div className="relative h-48 sm:h-64 overflow-hidden">
          <img
            src={coverSrc}
            alt={book.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover filter blur-lg scale-110 opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#161128] via-[#161128]/70 to-transparent" />

          {/* En-tête avec Couverture */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end gap-5">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 flex-shrink-0">
              <img
                src={coverSrc}
                alt={book.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                {book.category_name || 'Livre Audio'}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 line-clamp-2 leading-tight font-['Outfit']">
                {book.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Par <span className="text-purple-300">{book.author}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Métadonnées Clés (Durée, Narrateur, Note, Langue) */}
        <div className="px-6 py-3.5 bg-white/5 border-y border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Lu par</span>
            <p className="font-bold text-slate-200 truncate">{book.narrator}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Durée Totale</span>
            <p className="font-bold text-slate-200">{formattedDuration}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Note Avis</span>
            <p className="font-bold text-amber-400 flex items-center justify-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{book.rating} ({book.rating_count || 120})</span>
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Format & Audio</span>
            <p className="font-bold text-purple-300">Haute Fidélité</p>
          </div>
        </div>

        {/* Corps de la Modale */}
        <div className="p-6">
          {/* Navigation par onglets */}
          <div className="flex gap-4 border-b border-white/10 mb-4 pb-2">
            <button
              onClick={() => setActiveTab('synopsis')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 ${
                activeTab === 'synopsis'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Synopsis & Description
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'chapters'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Chapitres ({book.chapters?.length || 1})</span>
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`text-sm font-bold pb-2 transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'border-purple-500 text-purple-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Avis & Notes ({reviews.length})</span>
            </button>
          </div>

          {/* Contenu Synopsis */}
          {activeTab === 'synopsis' && (
            <div className="space-y-3 max-h-52 overflow-y-auto pr-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p className="font-semibold text-slate-100">{book.description}</p>
              <p>{book.synopsis || "Une écoute immersive indispensable pour comprendre les dynamiques modernes et enrichir votre quotidien."}</p>
              <div className="flex items-center gap-2 pt-2 text-xs text-purple-300">
                <Sparkles className="w-4 h-4" />
                <span>Format Audio HD Stéréo • Téléchargeable pour écoute hors-ligne</span>
              </div>
            </div>
          )}

          {/* Contenu Chapitres */}
          {activeTab === 'chapters' && (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
              {book.chapters?.map((chap, idx) => (
                <div
                  key={chap.id || idx}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{chap.title}</span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {Math.floor((chap.duration_seconds || 1800) / 60)} min
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Contenu Avis & Étoiles */}
          {activeTab === 'reviews' && (
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {/* Formulaire pour laisser un avis */}
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Donner votre note et votre avis</span>
                </h4>
                {/* Sélecteur d'étoiles */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Votre note :</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-slate-500 hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            (hoverRating || userRating) >= star
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-amber-300 ml-1">
                    {userRating}/5
                  </span>
                </div>
                {/* Commentaire */}
                <textarea
                  rows={2}
                  value={userReviewText}
                  onChange={(e) => setUserReviewText(e.target.value)}
                  placeholder="Qu'avez-vous pensé de la voix, de la clarté et de l'histoire ?"
                  className="rg-input text-xs py-2 resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">
                    Votre avis sera visible par toute la communauté
                  </span>
                  <button
                    onClick={handleSubmitReview}
                    disabled={!userRating || !userReviewText.trim()}
                    className="btn-gradient px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                  >
                    {reviewSubmitted ? '✓ Publié !' : 'Publier mon avis'}
                  </button>
                </div>
              </div>

              {/* Liste des avis existants */}
              <div className="space-y-2.5 pt-1">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-2xl bg-white/4 border border-white/6 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {(rev.author_name || 'U')[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-white">{rev.author_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
                          />
                        ))}
                        <span className="text-[10px] text-slate-400 ml-1.5">{rev.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions & Paiement CamerPay */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Bouton Extrait Gratuit */}
            <button
              onClick={() => playPreview(book)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-102"
            >
              <Headphones className="w-4 h-4 text-purple-400" />
              <span>Écouter l'Extrait Gratuit</span>
            </button>

            {/* Bouton Achat ou Lecture */}
            {isPurchased ? (
              <button
                onClick={() => {
                  playBook(book, 0, 0);
                  onClose();
                }}
                className="w-full sm:w-auto flex-1 btn-gradient py-3 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Écouter le Livre Complet</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onBuy(book);
                }}
                className="w-full sm:w-auto flex-1 btn-gradient py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-bold shadow-xl shadow-purple-600/30 group"
              >
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>Acheter via CamerPay</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-white/60"></span>
                <span className="text-amber-300 font-extrabold">
                  {book.discount_price ? `${book.discount_price} FCFA` : `${book.price} FCFA`}
                </span>
              </button>
            )}
          </div>

          {/* Mentions de paiement sécurisé */}
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paiement sécurisé CamerPay</span>
            </span>
            <span>•</span>
            <span>Orange Money / MTN MoMo / CB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
