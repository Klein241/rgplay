import React, { useState } from 'react';
import {
  X, Star, Play, Headphones, CheckCircle2, ShieldCheck,
  Smartphone, Sparkles, Share2, Download, AlertCircle, ChevronDown, ChevronUp, EyeOff, Eye
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { downloadAudioMp3 } from '../utils/offlineAudioCache';
import { trackAction } from '../services/tracker';
import { BookChatModal } from './BookChatModal';

export const AudiobookDetailModal = ({ book, isOpen, onClose, onBuy, isPurchased }) => {
  const { playPreview, playBook, currentBook, isPlaying } = useAudio();
  const [activeTab, setActiveTab] = useState('synopsis');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [userRating, setUserRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [reviewsHidden, setReviewsHidden] = useState(false); // admin toggle

  // Admin check
  const isAdmin = (() => {
    try { return localStorage.getItem('rg_admin_logged_in') === 'true'; } catch (_) { return false; }
  })();

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
      setActiveTab('synopsis');

      // Inject dynamic OG meta tags for social share preview
      try {
        const ogImage = document.querySelector('meta[property="og:image"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        const ogUrl = document.querySelector('meta[property="og:url"]');

        const coverUrl = book.cover_url && !book.cover_url.includes('r2.cloudflarestorage.com')
          ? book.cover_url
          : `https://rg-play.pages.dev/api/r2/download?key=${encodeURIComponent(book.cover_r2_key || '')}`;

        if (ogImage) ogImage.setAttribute('content', coverUrl);
        if (ogTitle) ogTitle.setAttribute('content', `${book.title} — RG Play`);
        if (ogDesc) ogDesc.setAttribute('content', `🎧 Écoutez "${book.title}" par ${book.author}. ${book.description || ''}`);
        if (ogUrl) ogUrl.setAttribute('content', `${window.location.origin}/?book=${book.id}`);
      } catch (_) {}
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
    try { localStorage.setItem(`rg_reviews_${book.id}`, JSON.stringify(updated)); } catch (_) {}
    setReviewSubmitted(true);
    setUserReviewText('');
    window.dispatchEvent(new CustomEvent('rg:book-rated', { detail: { bookId: book.id, rating: userRating } }));
  };

  if (!isOpen || !book) return null;

  const handleDownloadMp3 = async () => {
    setIsDownloading(true);
    setDownloadStatus(null);
    trackAction('download_mp3', book.id);
    const res = await downloadAudioMp3(book, null, isPurchased);
    if (res === 'ok') {
      setDownloadStatus({ type: 'success', text: '✓ Fichier MP3 en cours de téléchargement' });
    } else if (res === 'not_purchased') {
      setDownloadStatus({ type: 'error', text: 'Veuillez acheter cet audio pour télécharger le MP3' });
    } else {
      setDownloadStatus({ type: 'warn', text: 'Ouverture du flux audio...' });
    }
    setIsDownloading(false);
    setTimeout(() => setDownloadStatus(null), 4000);
  };

  const fmtCount = (n) => {
    if (!n || n === 0) return null;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  };

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="glass-card rounded-3xl w-full max-w-2xl border border-purple-500/25 overflow-hidden shadow-2xl relative">

        {/* Boutons haut droite */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/?book=${book.id}`;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `${book.title} — RG Play`,
                    text: `🎧 Écoutez "${book.title}" par ${book.author} sur RG Play`,
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

        {/* Bannière de fond */}
        <div className="relative h-44 sm:h-56 overflow-hidden">
          <img
            src={coverSrc}
            alt={book.title}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
            className="w-full h-full object-cover filter blur-xl scale-110 opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#161128] via-[#161128]/75 to-transparent" />

          {/* Header : Cover + Titre */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 flex-shrink-0">
              <img
                src={coverSrc}
                alt={book.title}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_COVER; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                {book.category_name || 'Livre Audio'}
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-white mt-1.5 line-clamp-2 leading-tight font-['Outfit']">
                {book.title}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Par <span className="text-purple-300">{book.author}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Métadonnées clés */}
        <div className="px-5 py-3 bg-white/4 border-y border-white/6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">Lectures</span>
            <p className="font-bold text-purple-300 flex items-center justify-center gap-1">
              <Headphones className="w-3 h-3 text-purple-400" />
              {fmtCount(book.display_plays_count) || (book.rating_count ? `${book.rating_count * 8}` : '1.2k')}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">Durée</span>
            <p className="font-bold text-slate-200">{formattedDuration}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">Note</span>
            <p className="font-bold text-amber-400 flex items-center justify-center gap-1">
              <Star className="w-3 h-3 fill-amber-400" />
              {book.display_rating || book.rating || 4.9}
              <span className="text-slate-400 font-normal">({fmtCount(book.display_reviews_count) || book.rating_count || 120})</span>
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-medium block">Format</span>
            <p className="font-bold text-emerald-400 text-[10px]">Audio HD Stéréo</p>
          </div>
        </div>

        {/* Corps de la modale — aéré */}
        <div className="px-5 py-5 space-y-5">

          {/* Onglets */}
          <div className="flex gap-5 border-b border-white/10 pb-2">
            {[
              { id: 'synopsis', label: 'Synopsis' },
              { id: 'chapters', label: `Chapitres (${book.chapters?.length || 1})` },
              { id: 'reviews', label: `Avis (${reviews.length})`, icon: <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm font-bold pb-2 transition-all border-b-2 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Synopsis ── */}
          {activeTab === 'synopsis' && (
            <div className="space-y-4">
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 max-h-48 overflow-y-auto pr-1">
                <p className="font-semibold text-slate-100">{book.description}</p>
                {book.synopsis && (
                  <p className="text-slate-400">{book.synopsis}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-300 pt-1 border-t border-white/6">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Format Audio HD Stéréo • Téléchargeable pour écoute hors-ligne</span>
              </div>
            </div>
          )}

          {/* ── Chapitres ── */}
          {activeTab === 'chapters' && (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {(book.chapters?.length ? book.chapters : [{ id: 'ch0', title: 'Chapitre 1 : Introduction', duration_seconds: 1800 }]).map((chap, idx) => (
                <div
                  key={chap.id || idx}
                  className="p-3 rounded-xl bg-white/4 border border-white/6 flex items-center justify-between text-xs hover:bg-white/7 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{chap.title}</span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono flex-shrink-0 ml-2">
                    {Math.floor((chap.duration_seconds || 1800) / 60)} min
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Avis & Notes ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Bouton masquer/afficher avis (admin uniquement) */}
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setReviewsHidden(h => !h)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all"
                    style={reviewsHidden
                      ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }
                      : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)', color: '#94a3b8' }
                    }
                  >
                    {reviewsHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{reviewsHidden ? 'Afficher les commentaires' : 'Masquer les commentaires'}</span>
                  </button>
                </div>
              )}

              {/* Formulaire de dépôt d'avis */}
              {!reviewsHidden && (
                <div className="p-4 rounded-2xl bg-purple-500/8 border border-purple-500/20 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Donner votre note et votre avis</span>
                  </h4>

                  {/* Étoiles */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Votre note :</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-0.5 text-slate-500 hover:scale-125 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${(hoverRating || userRating) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-amber-300">{userRating}/5</span>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={2}
                    value={userReviewText}
                    onChange={(e) => setUserReviewText(e.target.value)}
                    placeholder="Qu'avez-vous pensé de la voix, de la clarté et de l'histoire ?"
                    className="rg-input text-xs py-2.5 resize-none w-full"
                  />

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Votre avis sera visible par toute la communauté</span>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!userRating || !userReviewText.trim()}
                      className="btn-gradient px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                    >
                      {reviewSubmitted ? '✓ Publié !' : 'Publier mon avis'}
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des avis */}
              {!reviewsHidden && (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-3.5 rounded-2xl bg-white/4 border border-white/6 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                            {(rev.author_name || 'U')[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-white">{rev.author_name}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                          ))}
                          <span className="text-[10px] text-slate-400 ml-1.5">{rev.date}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {reviewsHidden && (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                  <EyeOff className="w-5 h-5 mx-auto mb-1.5 text-slate-600" />
                  Les commentaires sont masqués (admin)
                </div>
              )}
            </div>
          )}

          {/* Statut téléchargement */}
          {downloadStatus && (
            <div className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 animate-fadeIn ${
              downloadStatus.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
              downloadStatus.type === 'error' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' :
              'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}>
              {downloadStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{downloadStatus.text}</span>
            </div>
          )}

          {/* ── Zone Actions ── */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

              {/* Bouton Extrait Gratuit — clignotant et bien visible */}
              <button
                onClick={() => { playPreview(book); trackAction('preview_click', book.id); }}
                className="sm:w-auto px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 border"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.20) 0%, rgba(5,150,105,0.25) 100%)',
                  borderColor: 'rgba(16,185,129,0.45)',
                  color: '#6ee7b7',
                  boxShadow: '0 0 12px rgba(16,185,129,0.25)',
                  animation: 'rgPulseBadge 2.5s ease-in-out infinite',
                }}
              >
                <Headphones className="w-4 h-4" />
                <span>Extrait Gratuit</span>
              </button>

              {/* Bouton Tuteur IA */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="sm:w-auto px-4 py-3 rounded-2xl bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/35 font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] shadow-sm"
                title="Poser une question à ce livre (IA)"
              >
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>Tuteur IA</span>
              </button>

              {/* Télécharger MP3 */}
              {(isPurchased || book.price === 0 || book.is_free_for_members) && (
                <button
                  onClick={handleDownloadMp3}
                  disabled={isDownloading}
                  className="sm:w-auto px-4 py-3 rounded-2xl bg-purple-500/12 hover:bg-purple-500/22 text-purple-200 border border-purple-500/25 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isDownloading ? (
                    <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-purple-400" />
                  )}
                  <span>Télécharger MP3</span>
                </button>
              )}

              {/* Bouton principal Écouter / Acheter */}
              {(isPurchased || book.price === 0 || book.is_free_for_members) ? (
                <button
                  onClick={() => { playBook(book, 0, 0); trackAction('play_full', book.id); onClose(); }}
                  className="flex-1 btn-gradient py-3 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{book.price === 0 ? 'Écouter Gratuitement' : 'Écouter le Livre Complet'}</span>
                </button>
              ) : (
                <button
                  onClick={() => { trackAction('buy_click', book.id); onBuy(book); }}
                  className="flex-1 btn-gradient py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-bold shadow-xl shadow-purple-600/30"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Acheter l'Audio Complet</span>
                  <span className="w-1 h-1 rounded-full bg-white/60" />
                  <span className="text-amber-300 font-extrabold">
                    {book.discount_price ? `${book.discount_price} FCFA` : `${book.price} FCFA`}
                  </span>
                </button>
              )}
            </div>

            {/* Mentions paiement sécurisé */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Paiement 100% sécurisé
              </span>
              <span>•</span>
              <span>Orange Money / MTN MoMo / Carte</span>
            </div>
          </div>
        </div>
      </div>

      <BookChatModal
        book={book}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};
