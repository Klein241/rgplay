import {
  UploadCloud, Wand2, Plus, Trash2, CheckCircle2,
  Loader2, Save, Mic, ChevronRight, Play, Pause,
  Sparkles, Check, Download, Clock, BookOpen, Music, Database, X, Image as ImageIcon,
  FileAudio
} from 'lucide-react';
import { DropZone } from '../components/DropZone';
import { formatSize, formatDuration, CONTENT_TYPE_CONFIG } from '../utils/adminHelpers';

export const PublishAudioRubric = ({
  editingBook,
  contentType,
  setContentType,
  handleSelectContentType,
  activeTypeConfig,
  step,
  setStep,
  title,
  setTitle,
  author,
  setAuthor,
  narrator,
  setNarrator,
  categoryId,
  setCategoryId,
  price,
  setPrice,
  discountPrice,
  setDiscountPrice,
  unlockPoints = 100,
  setUnlockPoints = () => {},
  description,
  setDescription,
  synopsis,
  setSynopsis,
  categories = [],
  isAiGenerating,
  aiSuccessMessage,
  handleDeepSeekEnrich,
  companionEbookId,
  setCompanionEbookId,
  ebooksList = [],
  audioMatchResult,
  isMatchingEbook,
  handleDeepSeekMatchEbook,
  coverData,
  setCoverData,
  previewData,
  setPreviewData,
  chapters = [],
  setChapters = () => {},
  setActiveChapterAiModalIndex = () => {},
  activePlayingChapterIdx,
  setActivePlayingChapterIdx = () => {},
  chapterAudioPreviewRef,
  publishMode,
  setPublishMode,
  scheduledAt,
  setScheduledAt,
  isSubmitting,
  handlePublish,
  publishedBook,
  publishResult,
  setActiveRubric,
  resetPublishForm,
  downloadAudioMp3,
  setEditingBook = () => {},
  pdfUrl = '',
  setPdfUrl = () => {},
  pageCount = 180,
  setPageCount = () => {},
  setChapterTtsAudioUrl = () => {},
  setChapterTtsText = () => {},
}) => {
  // Gestion des chapitres / pistes / épisodes / modules
  const addChapter = () => {
    const cfg = CONTENT_TYPE_CONFIG[contentType] || CONTENT_TYPE_CONFIG.audiobook;
    setChapters(prev => [
      ...prev,
      {
        title: cfg.defaultItemTitle(prev.length + 1),
        duration_seconds: cfg.defaultItemDuration,
        uploadData: null,
      }
    ]);
  };

  const removeChapter = (i) => setChapters(prev => prev.filter((_, idx) => idx !== i));

  const updateChapter = (i, field, value) =>
    setChapters(prev => {
      const n = [...prev];
      if (n[i]) {
        n[i] = { ...n[i], [field]: value };
      }
      return n;
    });

  const setChapterUpload = (i, data) =>
    setChapters(prev => {
      const n = [...prev];
      if (n[i]) {
        n[i] = {
          ...n[i],
          uploadData: data,
          duration_seconds: data?.duration_seconds || n[i].duration_seconds || (CONTENT_TYPE_CONFIG[contentType]?.defaultItemDuration || 1800),
        };
      }
      return n;
    });

  return (
          <div className="space-y-6 animate-fadeIn">
            {/* Titre */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
                  {editingBook ? `Modifier : ${editingBook.title}` : 'Publier un Livre Audio'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {editingBook ? 'Modifiez les informations et publiez la mise à jour.' : 'Complétez les informations pour mettre votre livre en vente'}
                </p>
              </div>
              {editingBook && (
                <button
                  onClick={() => { setEditingBook(null); resetPublishForm(); }}
                  className="rg-btn-ghost px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Annuler l'édition
                </button>
              )}
            </div>

            {/* Stepper Propre et Stylisé */}
            <div
              className="p-2 sm:p-3 rounded-3xl flex items-center justify-between gap-2 backdrop-blur-xl"
              style={{
                background: 'rgba(14, 10, 34, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.18)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.40)',
              }}
            >
              {[
                { n: 1, label: '1. Informations & Prix' },
                { n: 2, label: '2. Pochette & Extrait' },
                { n: 3, label: '3. Chapitres Audio' },
                { n: 4, label: '4. Validation' },
              ].map((s) => (
                <button
                  key={s.n}
                  onClick={() => step > s.n && setStep(s.n)}
                  className={`flex-1 py-3 px-2 sm:px-4 rounded-2xl text-xs font-black transition-all duration-300 text-center font-['Outfit'] tracking-wide cursor-pointer ${step === s.n
                      ? 'text-white shadow-xl shadow-emerald-500/25 scale-[1.02]'
                      : step > s.n
                        ? 'text-emerald-400 bg-white/6 hover:bg-emerald-500/10'
                        : 'text-slate-500 bg-transparent opacity-60'
                    }`}
                  style={
                    step === s.n
                      ? {
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                      }
                      : { border: '1px solid transparent' }
                  }
                >
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden font-black">Étape {s.n}</span>
                </button>
              ))}
            </div>

            {/* ÉTAPE 1 : Informations */}
            {step === 1 && (
              <div className="card-lg space-y-5">
                {/* Sélecteur Type de Contenu */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Type de Contenu *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {[
                      { id: 'audiobook', label: 'Livre Audio', icon: '📚', color: 'border-purple-500 bg-purple-500/10 text-purple-300' },
                      { id: 'ebook', label: 'E-Book / PDF', icon: '📖', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' },
                      { id: 'hybrid', label: 'Pack Hybride', icon: '🔥', color: 'border-pink-500 bg-pink-500/10 text-pink-300' },
                      { id: 'podcast', label: 'Podcast', icon: '🎙️', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
                      { id: 'music', label: 'Musique & Lofi', icon: '🎵', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
                      { id: 'masterclass', label: 'Masterclass', icon: '🎓', color: 'border-indigo-500 bg-indigo-500/10 text-indigo-300' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectContentType(t.id)}
                        className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${contentType === t.id
                            ? `${t.color} border-2 shadow-lg scale-[1.02]`
                            : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        <span className="text-lg">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.titleLabel}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={activeTypeConfig.titlePlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.creatorLabel}
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      placeholder={activeTypeConfig.creatorPlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.performerLabel}
                    </label>
                    <input
                      type="text"
                      value={narrator}
                      onChange={e => setNarrator(e.target.value)}
                      placeholder={activeTypeConfig.performerPlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Catégorie *</label>
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="rg-input cursor-pointer"
                      style={{ background: '#16112e' }}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Prix de Vente (FCFA) *</label>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder={activeTypeConfig.pricePlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Prix Promotionnel (optionnel)</label>
                    <input
                      type="number"
                      value={discountPrice}
                      onChange={e => setDiscountPrice(e.target.value)}
                      placeholder={activeTypeConfig.discountPricePlaceholder}
                      className="rg-input"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      ⭐ Coût de Déblocage en Points (Read's Great)
                    </label>
                    <input
                      type="number"
                      value={unlockPoints}
                      onChange={e => setUnlockPoints(e.target.value)}
                      placeholder="100"
                      className="rg-input font-mono text-amber-300"
                    />
                  </div>

                  {/* Champs Spécifiques E-Book / PDF */}
                  {(contentType === 'ebook' || contentType === 'hybrid') && (
                    <>
                      <div className="sm:col-span-2 p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3">
                        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                          <BookOpen className="w-4 h-4" />
                          <span>Configuration du Document E-Book & Liseuse PDF Read's Great</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                              URL Publique du PDF (Cloudflare R2, Supabase ou URL CDN) *
                            </label>
                            <input
                              type="text"
                              value={pdfUrl}
                              onChange={e => setPdfUrl(e.target.value)}
                              placeholder="https://.../mon_livre.pdf"
                              className="rg-input text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                              Nombre de Pages Estimé
                            </label>
                            <input
                              type="number"
                              value={pageCount}
                              onChange={e => setPageCount(e.target.value)}
                              placeholder="180"
                              className="rg-input text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Assistant IA DeepSeek */}
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-slate-900/80 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white">Assistant IA DeepSeek</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/40">
                            DeepSeek-V3
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Générez instantanément l'accroche, le synopsis, la catégorie et les mots-clés en 1 clic.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeepSeekEnrich}
                      disabled={isAiGenerating || !title.trim()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all self-stretch sm:self-auto justify-center cursor-pointer"
                    >
                      {isAiGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                          <span>Génération IA en cours...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          <span>✨ Auto-générer avec l'IA</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiSuccessMessage && (
                    <div className="sm:col-span-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{aiSuccessMessage}</span>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.descriptionLabel}
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={activeTypeConfig.descriptionPlaceholder}
                      className="rg-input resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      {activeTypeConfig.synopsisLabel}
                    </label>
                    <textarea
                      rows={4}
                      value={synopsis}
                      onChange={e => setSynopsis(e.target.value)}
                      placeholder={activeTypeConfig.synopsisPlaceholder}
                      className="rg-input resize-none"
                    />
                  </div>

                  {/* ── ASSOCIATION E-BOOK READ'S GREAT & DEEPSEEK IA (OPTIONNEL) ── */}
                  <div className="sm:col-span-2 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-black/40 border border-indigo-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 flex-shrink-0">
                          <BookOpen className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <span>Association E-Book Read's Great</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                              Optionnel
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Par défaut, ce livre audio est autonome. Vous pouvez lui relier un e-book de la bibliothèque Read's Great ou laisser DeepSeek IA trouver la correspondance.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDeepSeekMatchEbook}
                        disabled={isMatchingEbook}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                      >
                        {isMatchingEbook ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{isMatchingEbook ? 'Analyse DeepSeek...' : '🧠 Associer par DeepSeek IA'}</span>
                      </button>
                    </div>

                    {/* Résultat d'analyse DeepSeek pour E-Book */}
                    {audioMatchResult && (
                      <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                        audioMatchResult.matched
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base">{audioMatchResult.matched ? '🎯' : '💡'}</span>
                          <div className="flex-1">
                            <p className="font-bold">
                              {audioMatchResult.matched
                                ? `E-Book correspondant trouvé : « ${audioMatchResult.companion?.title} » (${Math.round((audioMatchResult.confidence || 0.9) * 100)}% de certitude)`
                                : 'Aucun e-book identique trouvé — Recommandations IA du même genre :'}
                            </p>
                            <p className="text-[11px] opacity-80 mt-0.5">{audioMatchResult.reason}</p>
                          </div>
                        </div>

                        {/* Recommandations */}
                        {!audioMatchResult.matched && audioMatchResult.recommendations?.length > 0 && (
                          <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {audioMatchResult.recommendations.map(rec => (
                              <button
                                key={rec.id}
                                type="button"
                                onClick={() => setCompanionEbookId(rec.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  companionEbookId === rec.id
                                    ? 'bg-amber-500/30 border-amber-400 text-white'
                                    : 'bg-black/30 border-white/10 hover:border-amber-400/50 text-slate-300'
                                }`}
                              >
                                <div className="font-bold truncate text-[11px]">📖 {rec.title}</div>
                                <div className="text-[10px] text-slate-400 truncate">{rec.author} • {rec.reason}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sélecteur Manuel d'E-Book */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Sélectionner l'e-book lié de la bibliothèque Read's Great :
                      </label>
                      <select
                        value={companionEbookId}
                        onChange={(e) => setCompanionEbookId(e.target.value)}
                        className="rg-input w-full px-4 py-3 rounded-2xl text-xs sm:text-sm"
                        style={{ background: '#16112e' }}
                      >
                        <option value="">🚫 Aucun e-book lié (Livre Audio RG Play 100% autonome)</option>
                        {ebooksList.filter(b => (b.content_type === 'ebook' || b.pdf_url) && b.id !== editingBook?.id).map((b) => (
                          <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                            📖 {b.title} — Par {b.author} ({b.page_count || 180} pages)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setStep(2)}
                    disabled={!title.trim() || !author.trim() || !price}
                    className="btn-gradient px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <span>Suivant : Médias & Extraits</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : Médias */}
            {step === 2 && (
              <div className="card-lg space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <DropZone
                    label={activeTypeConfig.coverLabel}
                    accept="image/jpeg,image/png,image/webp"
                    type="cover"
                    icon={ImageIcon}
                    value={coverData?.public_url || ''}
                    onUploaded={setCoverData}
                  />
                  <DropZone
                    label={activeTypeConfig.previewLabel}
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/*"
                    type="preview"
                    icon={Mic}
                    value={previewData?.public_url || ''}
                    onDurationDetected={(dur) => {
                      if (chapters[0]?.duration_seconds === activeTypeConfig.defaultItemDuration) {
                        updateChapter(0, 'duration_seconds', dur);
                      }
                    }}
                    onUploaded={setPreviewData}
                  />
                </div>

                <div className="flex justify-between pt-3">
                  <button onClick={() => setStep(1)} className="rg-btn-ghost px-6 py-3 rounded-2xl text-sm">
                    ← Retour
                  </button>
                  <button onClick={() => setStep(3)} className="btn-gradient px-8 py-3 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <span>Suivant : {activeTypeConfig.itemPlural}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Chapitres / Épisodes / Pistes / Modules */}
            {step === 3 && (
              <div className="card-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">
                    {activeTypeConfig.itemPlural} Audio ({chapters.length})
                  </h2>
                  <button onClick={addChapter} className="rg-btn-ghost px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un {activeTypeConfig.itemSingular.toLowerCase()}
                  </button>
                </div>

                <div className="space-y-4">
                  {chapters.map((chap, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2.5">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-2 font-['Outfit']">
                          <Music className="w-4 h-4 text-purple-400" /> {activeTypeConfig.itemSingular} {i + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Bouton Générer avec l'IA pour ce chapitre */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChapterAiModalIndex(i);
                              setChapterTtsAudioUrl(null);
                              setChapterTtsText(chap.title ? `Voici la narration complète pour ${chap.title}. ` : '');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/40 to-pink-600/40 hover:from-purple-600/70 hover:to-pink-600/70 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                            title="Générer l'audio de ce chapitre via l'IA vocale"
                          >
                            <Wand2 className="w-3.5 h-3.5 text-pink-300" />
                            <span>🎙️ Générer avec l'IA</span>
                          </button>

                          {/* Bouton Télécharger MP3 si audio disponible */}
                          {chap.uploadData?.public_url && (
                            <button
                              type="button"
                              onClick={() => downloadAudioMp3(chap.uploadData.public_url, `${title || 'Oeuvre'}_Chapitre_${i + 1}.mp3`)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                              title="Télécharger ce chapitre en fichier MP3 sur votre appareil"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-300" />
                              <span>📥 Télécharger MP3</span>
                            </button>
                          )}

                          {/* Bouton Écouter le Master */}
                          {chap.uploadData?.public_url && (
                            <button
                              type="button"
                              onClick={() => {
                                if (activePlayingChapterIdx === i) {
                                  chapterAudioPreviewRef.current?.pause();
                                  setActivePlayingChapterIdx(null);
                                } else {
                                  setActivePlayingChapterIdx(i);
                                  if (chapterAudioPreviewRef.current) {
                                    chapterAudioPreviewRef.current.src = chap.uploadData.public_url;
                                    chapterAudioPreviewRef.current.play().catch(() => {});
                                  }
                                }
                              }}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title={activePlayingChapterIdx === i ? "Pause" : "Écouter"}
                            >
                              {activePlayingChapterIdx === i ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-purple-400" />}
                            </button>
                          )}

                          {chapters.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeChapter(i)}
                              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Supprimer ce chapitre"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                            Titre du {activeTypeConfig.itemSingular.toLowerCase()}
                          </label>
                          <input
                            type="text"
                            value={chap.title}
                            onChange={e => updateChapter(i, 'title', e.target.value)}
                            className="rg-input py-2 text-xs"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-300">Durée (secondes)</label>
                            {Number(chap.duration_seconds) > 0 && (
                              <span className="text-[10px] text-emerald-400 font-bold">
                                ≈ {formatDuration(chap.duration_seconds)}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={chap.duration_seconds}
                            onChange={e => updateChapter(i, 'duration_seconds', Number(e.target.value))}
                            className="rg-input py-2 text-xs"
                          />
                        </div>
                      </div>

                      <DropZone
                        label={activeTypeConfig.trackDropLabel(i + 1)}
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/*"
                        type="audio"
                        icon={FileAudio}
                        value={chap.uploadData?.public_url || ''}
                        onDurationDetected={(dur) => updateChapter(i, 'duration_seconds', dur)}
                        onUploaded={(data) => {
                          setChapterUpload(i, data);
                          if (data?.duration_seconds) {
                            updateChapter(i, 'duration_seconds', data.duration_seconds);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* ── PROGRAMMATION DE LA PUBLICATION ── */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#1d0d38] border border-purple-500/30 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-bold text-white font-['Outfit']">Planification & Mise en ligne</p>
                      <p className="text-xs text-slate-400">Publiez immédiatement ou programmez une diffusion automatique à une date et heure précises</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPublishMode('immediate')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        publishMode === 'immediate'
                          ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/40'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      ⚡ Immédiate
                    </button>
                    <button
                      type="button"
                      onClick={() => setPublishMode('scheduled')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        publishMode === 'scheduled'
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-900/40'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      📅 Programmer la date/heure
                    </button>
                  </div>

                  {publishMode === 'scheduled' && (
                    <div className="pt-2 animate-fadeIn space-y-2 border-t border-purple-500/20">
                      <label className="block text-xs font-bold text-amber-300">
                        Date &amp; Heure de mise en ligne automatique :
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="w-full bg-[#130724] border border-purple-500/40 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        💡 Le contenu sera automatiquement visible par les auditeurs dès que cette date et heure seront atteintes.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-3">
                  <button onClick={() => setStep(2)} className="rg-btn-ghost px-6 py-3 rounded-2xl text-sm">
                    ← Retour
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={isSubmitting}
                    className="btn-gradient px-8 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-xl"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                    ) : publishMode === 'scheduled' ? (
                      <><Clock className="w-4 h-4 text-amber-300" /> Programmer la Publication</>
                    ) : (
                      <><Save className="w-4 h-4" /> Mettre en Ligne Immédiatement</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 4 : Succès */}
            {step === 4 && publishedBook && (
              <div className="card-lg text-center p-8 space-y-6 max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white font-['Outfit']">
                    {activeTypeConfig.publishSuccessTitle}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    {activeTypeConfig.publishSuccessSubtitle(publishedBook.title)}
                  </p>
                </div>

                {/* Carte récapitulative & statut BD */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left flex items-center gap-4">
                  <img src={publishedBook.cover_url} alt={publishedBook.title} className="w-20 h-20 rounded-xl object-cover border border-white/15 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Database className="w-2.5 h-2.5" />
                        {publishResult?.stored_in?.includes('cloudflare_d1') ? 'Cloudflare D1 SQL' : 'Base Serveur Partagée (data/db.json)'}
                      </span>
                      <span className="text-[10px] text-purple-300 font-semibold">{publishedBook.category_name}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white truncate mt-1">{publishedBook.title}</h3>
                    <p className="text-xs text-slate-400">
                      Par {publishedBook.author} • {publishedBook.chapters?.length || 1} {publishedBook.chapters?.length > 1 ? activeTypeConfig.itemPlural.toLowerCase() : activeTypeConfig.itemSingular.toLowerCase()}
                    </p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">{publishedBook.discount_price || publishedBook.price} FCFA</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Synchronisé : tous les utilisateurs, mobiles et visiteurs voient désormais ce contenu en direct.</span>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setActiveRubric('catalog')} className="rg-btn-ghost px-6 py-2.5 rounded-2xl text-sm">
                    Voir dans le Catalogue
                  </button>
                  <button onClick={() => resetPublishForm(contentType)} className="btn-gradient px-6 py-2.5 rounded-2xl text-sm font-bold">
                    {activeTypeConfig.anotherButtonText}
                  </button>
                </div>
              </div>
            )}
          </div>
  );
};
