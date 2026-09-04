import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Sparkles, Bot, User, Loader2, Maximize2, Minimize2,
  Copy, Check, Volume2, VolumeX, RotateCcw, Lightbulb, Zap, AlertTriangle,
  Target, Brain, Quote, ArrowDown, Mic, MicOff, MessageSquare, MoreVertical,
  Paperclip, FileText, Play, Pause, ThumbsUp, ThumbsDown, Search, Radio, Music,
  Camera, Image as ImageIcon, Gift, X, ExternalLink, BookOpen
} from 'lucide-react';
import { apiClient } from '../services/api';
import { SkyMarkdown } from './SkyMarkdown';
import { useAudio } from '../context/AudioContext';
import { useXp } from '../context/XpContext';

const QUICK_PROMPTS = [
  '💡 Donne-moi les 3 leçons majeures et comment les appliquer',
  '⚡ Fais-moi un résumé percutant en moins de 60 secondes',
  '🎯 Propose-moi un plan d\'action en 3 étapes concrètes',
  '⚠️ Quels sont les pièges et erreurs à éviter absolument ?',
  '🧠 Pose-moi une question quiz pour tester ma rétention',
];

export const BookChatModal = ({ book, isOpen, onClose }) => {
  const { currentBook, isPlaying, togglePlay } = useAudio();
  const { points = 0, spendPoints } = useXp();

  const getTodayKey = () => `rg_sky_free_questions_${new Date().toISOString().slice(0, 10)}`;
  const [dailyFreeCount, setDailyFreeCount] = useState(() => {
    try {
      return Number(localStorage.getItem(getTodayKey()) || '0');
    } catch { return 0; }
  });

  const FREE_DAILY_LIMIT = 2;
  const SKY_POINT_COST = 25;
  const hasFreeLeft = dailyFreeCount < FREE_DAILY_LIMIT;

  const activeBook = book || currentBook || {
    id: 'rg-default',
    title: 'Assistant & Tuteur Interactif',
    author: 'Agent SKY',
    description: 'Posez toutes vos questions sur vos livres audio et recevez des analyses structurées.'
  };

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('chat'); // 'hero' (middle screen) | 'chat' (right screen) | 'audio_select' (left screen)
  const [selectedAudioId, setSelectedAudioId] = useState(activeBook?.id || null);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [likedMap, setLikedMap] = useState({});
  const [audioSearch, setAudioSearch] = useState('');
  const [audioFilter, setAudioFilter] = useState('recent'); // 'recent' | 'chapters' | 'all'
  const [selectedImage, setSelectedImage] = useState(null); // { dataUrl, name }

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechSynthRef = useRef(window.speechSynthesis || null);
  const speechRecognitionRef = useRef(null);

  // Compression légère de l'image (max 800px, JPEG 0.72) pour économiser tokens et data
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      setSelectedImage({
        dataUrl: compressedDataUrl,
        name: file.name
      });
    } catch (err) {
      console.error("Erreur chargement image", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Réception de la récompense sponsorisée (déblocage de 2 questions)
  useEffect(() => {
    const handleRewardCompleted = () => {
      setDailyFreeCount(prev => {
        const newCount = Math.max(0, prev - 2);
        try { localStorage.setItem(getTodayKey(), String(newCount)); } catch {}
        return newCount;
      });
      setMessages(prev => [
        ...prev,
        {
          id: `reward-unlocked-${Date.now()}`,
          role: 'assistant',
          content: "🎉 **Félicitations ! Vos 2 questions gratuites supplémentaires sont activées.**\n\nPosez votre question ou envoyez la photo d'une couverture de livre à analyser !",
          timestamp: new Date()
        }
      ]);
    };

    window.addEventListener('rg:ad-reward-completed', handleRewardCompleted);
    return () => window.removeEventListener('rg:ad-reward-completed', handleRewardCompleted);
  }, []);

  // Initialize or reset
  useEffect(() => {
    if (isOpen && activeBook) {
      if (messages.length === 0) {
        setViewMode('hero');
      }
      setTimeout(() => textareaRef.current?.focus(), 250);
    } else {
      if (speechSynthRef.current) speechSynthRef.current.cancel();
      setSpeakingId(null);
    }
  }, [isOpen, activeBook?.id]);

  // Speech Recognition (Voice Input)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      speechRecognitionRef.current = recognition;
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current && viewMode === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, viewMode]);

  if (!isOpen) return null;

  // Send message
  const handleSendMessage = async (textToSend) => {
    const imageToSend = selectedImage?.dataUrl || null;
    let query = (typeof textToSend === 'string' ? textToSend : inputValue).trim();

    if (!query && imageToSend) {
      query = "Voici la photo d'une couverture de livre. Peux-tu l'identifier, me donner son résumé et me dire s'il est disponible sur RG Play ?";
    }

    if ((!query && !imageToSend) || isLoading) return;

    // Vérification du quota journalier (2 réponses gratuites puis 25 points Sky / XP)
    if (!hasFreeLeft && (points || 0) < SKY_POINT_COST) {
      setMessages(prev => [
        ...prev,
        {
          id: `quota-ad-${Date.now()}`,
          role: 'assistant',
          isRewardCard: true,
          content: "🎁 **Vos 2 questions gratuites du jour sont terminées !**\n\nPour continuer sans frais, regardez une courte pub sponsorisée (10s) pour débloquer immédiatement **2 nouvelles questions gratuites** avec l'Agent SKY.",
          timestamp: new Date()
        }
      ]);
      setViewMode('chat');
      return;
    }

    if (speechSynthRef.current) speechSynthRef.current.cancel();
    setSpeakingId(null);

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      image: imageToSend,
      timestamp: new Date(),
      attachedAudio: {
        title: `${activeBook.title}.mp3`,
        duration: activeBook.duration_seconds || 1800,
        author: activeBook.author
      }
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedImage(null);
    setIsLoading(true);
    setViewMode('chat'); // Switch to active chat flow

    try {
      const res = await apiClient.chatWithBook({
        book_id: activeBook.id,
        book_title: activeBook.title,
        author: activeBook.author,
        synopsis: activeBook.synopsis,
        description: activeBook.description,
        key_takeaways: activeBook.key_takeaways,
        messages: messages.filter(m => m.id !== 'welcome' && !m.isRewardCard),
        user_message: query,
        image_base64: imageToSend
      });

      if (res.success && res.reply) {
        // Appliquer la déduction de points ou comptabiliser la réponse gratuite
        if (hasFreeLeft) {
          const nextCount = dailyFreeCount + 1;
          setDailyFreeCount(nextCount);
          try { localStorage.setItem(getTodayKey(), String(nextCount)); } catch {}
        } else {
          spendPoints?.(SKY_POINT_COST, 'Question posée à l’Agent SKY');
        }

        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: res.reply,
            matchedBook: res.matched_book || null,
            timestamp: new Date(),
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "⚠️ **Agent SKY** n'a pas pu formuler sa réponse. Veuillez vérifier votre connexion et réessayer.",
            timestamp: new Date(),
            isError: true,
          }
        ]);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "⚠️ Une erreur est survenue lors de l'échange avec l'**Agent SKY**.",
          timestamp: new Date(),
          isError: true,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSpeak = (id, text) => {
    if (!speechSynthRef.current) return;
    if (speakingId === id) {
      speechSynthRef.current.cancel();
      setSpeakingId(null);
      return;
    }
    speechSynthRef.current.cancel();
    const cleanText = text.replace(/\*\*|__|\*|_|`|#|>|-|\+/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    speechSynthRef.current.speak(utterance);
  };

  const handleToggleVoice = () => {
    if (!speechRecognitionRef.current) {
      alert("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      speechRecognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleRetry = (msgIndex) => {
    const prevUserMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (prevUserMsg) {
      handleSendMessage(prevUserMsg.content);
    }
  };

  const coverUrl = activeBook.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-2xl animate-fadeIn select-none">
      
      {/* Input de fichier caché pour capture photo/caméra */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* ── FOND LIQUID LAVENDER & AMBER GLOW (Agrandie & Spacieuse) ── */}
      <div className="relative w-full max-w-xl sm:max-w-3xl h-full sm:h-[94vh] sm:max-h-[920px] sm:rounded-[2.5rem] bg-gradient-to-b from-[#2b1f48] via-[#1a1233] to-[#120a22] border border-purple-500/25 flex flex-col overflow-hidden shadow-2xl shadow-purple-950/80">
        
        {/* Ambient warm amber glow bottom & top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* ══════════════════════════════════════════════════════════════════════
            MODE 1 : SÉLECTION AUDIO / ATTACHMENT DRAWER (Left Screen)
            ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'audio_select' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 z-10 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
              <button
                onClick={() => setViewMode('hero')}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-white">Audio & Livres</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleVoice}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                >
                  <Mic className="w-5 h-5 text-purple-300" />
                </button>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-bold border border-white/10">
                  📁 {activeBook.chapters?.length || 1} +
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 my-2 overflow-x-auto no-scrollbar">
              {['Récents', 'Chapitres', 'Extraits', 'Tout'].map((cat, idx) => (
                <button
                  key={cat}
                  onClick={() => setAudioFilter(idx === 0 ? 'recent' : idx === 1 ? 'chapters' : 'all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    idx === 0
                      ? 'bg-white text-slate-900 font-extrabold shadow-md'
                      : 'bg-white/10 text-slate-300 hover:bg-white/15'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative my-2">
              <input
                type="text"
                value={audioSearch}
                onChange={(e) => setAudioSearch(e.target.value)}
                placeholder="Rechercher une piste audio..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            {/* Audio Track List Box */}
            <div className="flex-1 overflow-y-auto my-2 rounded-3xl bg-black/35 border border-white/10 p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-purple-900/40">
              {(activeBook.chapters || [{ id: activeBook.id, title: activeBook.title, duration_seconds: activeBook.duration_seconds }]).map((ch, idx) => (
                <div
                  key={ch.id || idx}
                  onClick={() => setSelectedAudioId(ch.id || idx)}
                  className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all ${
                    selectedAudioId === (ch.id || idx)
                      ? 'bg-purple-600/30 border border-purple-400/50 shadow-md'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/15">
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">
                        {ch.title || `Chapitre ${idx + 1}`}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {Math.round((ch.duration_seconds || 1800) / 60)}:00 • Audio HD
                      </p>
                    </div>
                  </div>

                  {/* Radio Selection Dot */}
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedAudioId === (ch.id || idx)
                      ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold'
                      : 'border-white/30'
                  }`}>
                    {selectedAudioId === (ch.id || idx) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Action Button */}
            <button
              onClick={() => setViewMode('hero')}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#818cf8] via-[#f59e0b] to-[#ea580c] hover:opacity-95 text-white font-black text-sm shadow-xl shadow-amber-900/40 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer mt-2"
            >
              Sélectionner pour l'analyse (1)
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MODE 2 : AGENT SKY 3D AVATAR HERO / WAITING STATE (Middle Screen)
            ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'hero' && (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 z-10 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-base font-black text-white tracking-wide">Agent SKY</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMessages([])}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                  title="Nouvelle discussion"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </button>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-bold border border-white/10">
                  💬 {messages.length} +
                </span>
              </div>
            </div>

            {/* 3D Robot Assistant Hero Graphic */}
            <div className="flex-1 flex flex-col items-center justify-center my-2 relative">
              <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full flex items-center justify-center animate-[bounce_6s_ease-in-out_infinite]">
                <img
                  src="/agent_sky_3d.jpg"
                  alt="Agent SKY 3D Robot"
                  className="w-full h-full object-cover rounded-3xl drop-shadow-[0_20px_35px_rgba(168,85,247,0.55)] border border-white/15"
                />
              </div>

              <div className="text-center mt-3">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  Bonjour, je suis l'Agent SKY !
                </h2>
                <p className="text-xs text-[#c4b0e8] mt-1 max-w-xs mx-auto">
                  Votre mentor IA dédié à <strong className="text-white font-bold">{activeBook.title}</strong> ou scannez une couverture de livre.
                </p>
              </div>
            </div>

            {/* Attached Audio Capsule Card */}
            <div
              onClick={() => setViewMode('audio_select')}
              className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/15 backdrop-blur-xl mb-3 cursor-pointer hover:border-purple-400 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/20">
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {activeBook.title}.mp3
                  </h4>
                  <p className="text-[10px] text-amber-300 flex items-center gap-1 font-medium">
                    <Sparkles className="w-2.5 h-2.5 animate-spin" />
                    Prêt pour l'analyse IA • Cliquez pour changer
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-purple-300">Modifier</span>
            </div>

            {/* Selected Image Preview if present */}
            {selectedImage && (
              <div className="mb-2 flex items-center gap-2 p-2 rounded-xl bg-purple-950/80 border border-purple-400/40 text-xs text-white">
                <img src={selectedImage.dataUrl} alt="Aperçu" className="w-9 h-9 object-cover rounded-lg border border-white/20" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-amber-300 truncate">Couverture prête à scanner</p>
                  <p className="text-[9px] text-slate-300 truncate">{selectedImage.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Floating Bottom Input Bar */}
            <div className="flex items-center gap-2 p-1.5 rounded-full bg-black/50 border border-white/15 backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Scanner une photo de couverture"
              >
                <Camera className="w-4 h-4 text-amber-300" />
              </button>

              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2.5 rounded-full transition-all ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-white'
                }`}
                title="Dictée vocale"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder={selectedImage ? "Posez une question sur ce livre..." : "Posez une question ou envoyez une photo..."}
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none px-2"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputValue.trim() && !selectedImage) || isLoading}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 hover:opacity-90 disabled:opacity-40 text-white flex items-center justify-center transition-all flex-shrink-0 cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MODE 3 : ACTIVE DISCUSSION FLOW (@Reference Right Screen)
            ══════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'chat' && (
          <div className="flex-1 flex flex-col justify-between z-10 animate-fadeIn h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/40 backdrop-blur-md flex-shrink-0">
              <button
                onClick={() => setViewMode('hero')}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-center min-w-0 px-2">
                <h3 className="text-sm font-black text-white truncate">Discussion avec SKY</h3>
                <p className="text-[10px] text-purple-300 truncate">{activeBook.title}</p>
              </div>
              <button
                onClick={() => setMessages([])}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                title="Effacer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-900/40">
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className="space-y-2 animate-fadeIn">
                  
                  {/* USER MESSAGE */}
                  {msg.role === 'user' && (
                    <div className="flex flex-col items-end space-y-1.5">
                      
                      {/* Attached Audio Capsule */}
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-800/60 via-amber-700/60 to-orange-700/80 border border-amber-400/40 text-white shadow-md max-w-[90%]">
                        <FileText className="w-4 h-4 text-amber-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">
                            {msg.attachedAudio?.title || `${activeBook.title}.mp3`}
                          </p>
                          <p className="text-[9px] text-amber-200/80">
                            {Math.round((msg.attachedAudio?.duration || 1800) / 60)}:00 • Audio HD ✓
                          </p>
                        </div>
                      </div>

                      {/* Attached Scanned Book Image */}
                      {msg.image && (
                        <div className="relative rounded-2xl overflow-hidden border border-white/25 max-w-[75%] shadow-md bg-black/40">
                          <img src={msg.image} alt="Couverture envoyée" className="w-full max-h-48 object-contain" />
                          <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] text-amber-300 font-bold flex items-center gap-1">
                            <Camera className="w-2.5 h-2.5" />
                            <span>Couverture scannée</span>
                          </div>
                        </div>
                      )}

                      {/* Text prompt */}
                      <div className="p-3 rounded-2xl bg-[#34185d] text-white text-xs font-medium max-w-[85%] rounded-tr-none shadow-md">
                        {msg.content}
                      </div>
                    </div>
                  )}

                  {/* ASSISTANT MESSAGE BUBBLE */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-start gap-2.5 max-w-[96%]">
                      {/* Mini 3D Robot Avatar */}
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-md mt-1">
                        <img src="/agent_sky_3d.jpg" alt="Agent SKY" className="w-full h-full object-cover" />
                      </div>

                      {/* Bubble Container */}
                      <div className="flex-1 rounded-3xl p-4 sm:p-5 bg-white/10 backdrop-blur-xl border border-white/15 text-slate-100 text-xs leading-relaxed shadow-lg">
                        <SkyMarkdown content={msg.content} />

                        {/* Quota Ad Prompt Card inside chat */}
                        {msg.isRewardCard && (
                          <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-slate-900/90 border border-amber-400/50 shadow-xl text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto shadow-inner">
                              <Gift className="w-6 h-6 animate-bounce text-amber-400" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide">Débloquez 2 questions gratuites</h4>
                              <p className="text-[11px] text-slate-200 mt-1">
                                Regardez une courte vidéo sponsorisée (10s) pour continuer gratuitement votre échange avec l'Agent SKY.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
                              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                            >
                              <Play className="w-4 h-4 fill-slate-950" />
                              <span>Regarder la pub (+2 questions offertes)</span>
                            </button>
                          </div>
                        )}

                        {/* Matched book interactive capsule */}
                        {msg.matchedBook && (
                          <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-purple-950/70 via-slate-900/90 to-amber-950/60 border border-amber-400/40 shadow-xl flex flex-col sm:flex-row items-center gap-3.5">
                            <div className="w-16 h-22 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md bg-black/50">
                              <img
                                src={msg.matchedBook.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80'}
                                alt={msg.matchedBook.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 text-center sm:text-left">
                              <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ✨ Disponible sur RG Play
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-slate-300">
                                  {msg.matchedBook.content_type === 'audio' ? '🎧 Livre Audio' : '📖 E-book PDF'}
                                </span>
                              </div>
                              <h4 className="text-xs sm:text-sm font-black text-white truncate">{msg.matchedBook.title}</h4>
                              <p className="text-[10px] text-slate-300 truncate">{msg.matchedBook.author || 'Auteur vérifié'}</p>

                              {/* Action buttons */}
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                                {msg.matchedBook.content_type === 'audio' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('rg:trigger-play-book', { detail: msg.matchedBook }));
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-[11px] shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                                    <span>Écouter l'audio</span>
                                  </button>
                                )}
                                {msg.matchedBook.pdf_url && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('rg:open-pdf-book', { detail: msg.matchedBook }));
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/60 hover:bg-purple-600 text-white font-bold text-[11px] border border-purple-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-purple-200" />
                                    <span>Lire le PDF</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bottom action tools on message */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleRetry(idx)}
                            className="flex items-center gap-1 text-[10px] hover:text-white transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Relancer</span>
                          </button>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setLikedMap(prev => ({ ...prev, [msg.id]: 'up' }))}
                              className={`p-1 rounded hover:text-white ${likedMap[msg.id] === 'up' ? 'text-emerald-400' : ''}`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setLikedMap(prev => ({ ...prev, [msg.id]: 'down' }))}
                              className={`p-1 rounded hover:text-white ${likedMap[msg.id] === 'down' ? 'text-rose-400' : ''}`}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="p-1 rounded hover:text-white"
                              title="Copier"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            {speechSynthRef.current && (
                              <button
                                type="button"
                                onClick={() => handleToggleSpeak(msg.id, msg.content)}
                                className={`p-1 rounded hover:text-white ${speakingId === msg.id ? 'text-amber-400' : ''}`}
                                title="Écouter"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 text-xs text-amber-200">
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/20">
                    <img src="/agent_sky_3d.jpg" alt="Agent SKY" className="w-full h-full object-cover animate-spin" />
                  </div>
                  <span>Agent SKY réfléchit et analyse...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Area with Toolbar */}
            <div className="p-3 bg-slate-950/80 border-t border-white/10 backdrop-blur-xl flex-shrink-0 space-y-2">
              
              {/* Suggested quick prompt floating above input */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(qp)}
                    disabled={isLoading}
                    className="flex-shrink-0 text-[10.5px] px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 whitespace-nowrap transition-all"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Quota & Points Sky Status Badge */}
              <div className="flex items-center justify-between text-[11px] px-1 pt-0.5">
                <div className="flex items-center gap-1.5 font-bold">
                  {hasFreeLeft ? (
                    <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      ⭐ {FREE_DAILY_LIMIT - dailyFreeCount} question{FREE_DAILY_LIMIT - dailyFreeCount > 1 ? 's' : ''} gratuite{FREE_DAILY_LIMIT - dailyFreeCount > 1 ? 's' : ''} aujourd'hui
                    </span>
                  ) : (
                    <span className="text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      ⚡ 25 Sky Points / réponse (Solde : {points} pts)
                    </span>
                  )}
                </div>

                {!hasFreeLeft && (points || 0) < SKY_POINT_COST && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event('rg:open-reward-ad'))}
                    className="text-amber-300 font-bold hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <span>🎁 +2 Questions (Pub)</span>
                  </button>
                )}
              </div>

              {/* Selected Image Preview Chip */}
              {selectedImage && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-950/80 border border-purple-400/40 text-xs text-white">
                  <img src={selectedImage.dataUrl} alt="Aperçu" className="w-10 h-10 object-cover rounded-lg border border-white/20" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-amber-300 truncate">Couverture prête à envoyer</p>
                    <p className="text-[9px] text-slate-300 truncate">{selectedImage.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Text Input Row */}
              <div className="flex items-center gap-2">
                <input
                  ref={textareaRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder={selectedImage ? "Posez une question sur ce livre..." : "Posez une question ou envoyez une photo..."}
                  disabled={isLoading}
                  className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />

                {/* Circular Gradient Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!inputValue.trim() && !selectedImage) || isLoading}
                  className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 via-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-amber-900/40 transition-all cursor-pointer flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Toolbar Icons */}
              <div className="flex items-center justify-between text-slate-400 pt-1 px-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Scanner couverture avec photo"
                  >
                    <Camera className="w-4 h-4 text-amber-300" />
                    <span className="text-[10px] hidden sm:inline text-amber-300">Scanner livre</span>
                  </button>
                  <button onClick={() => setViewMode('audio_select')} className="hover:text-white transition-colors" title="Attacher un audio">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button onClick={handleToggleVoice} className={`hover:text-white transition-colors ${isListening ? 'text-rose-400' : ''}`} title="Dictée vocale">
                    <Mic className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleSendMessage("Partage les 3 leçons clés de ce livre.")} className="hover:text-white transition-colors" title="Idées de prompt">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-500">Agent SKY v3.0 (Vision & Audio)</span>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
