import React, { useState, useEffect, useRef } from 'react';
import {
  X, Send, Sparkles, Bot, User, CornerDownLeft,
  Loader2, Lightbulb, Zap, HelpCircle, BookOpen, Volume2
} from 'lucide-react';
import { apiClient } from '../services/api';

const QUICK_PROMPTS = [
  { id: 'takeaways', label: '💡 3 Leçons Clés', prompt: 'Donne-moi les 3 leçons les plus importantes de ce livre et comment les appliquer concrètement.' },
  { id: 'summary', label: '⚡ Résumé en 1 min', prompt: 'Fais-moi un résumé percutant de ce livre audio en moins d\'une minute de lecture.' },
  { id: 'mistake', label: '⚠️ Piège à éviter', prompt: 'Quelle est la principale erreur que ce livre nous enseigne d\'éviter absolument ?' },
  { id: 'action', label: '🎯 Plan d\'action', prompt: 'Donne-moi un plan d\'action en 3 étapes pour commencer dès aujourd\'hui.' },
];

export const BookChatModal = ({ book, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && book) {
      // Message d'accueil personnalisé
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Bonjour ! Je suis votre tuteur IA dédié à **${book.title}** de *${book.author || 'l\'auteur'}*.\n\nPosez-moi n'importe quelle question sur les leçons, la mise en pratique ou les concepts de ce livre !`,
          timestamp: new Date()
        }
      ]);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, book?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen || !book) return null;

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputValue.trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await apiClient.chatWithBook({
        book_id: book.id,
        book_title: book.title,
        author: book.author,
        synopsis: book.synopsis,
        description: book.description,
        key_takeaways: book.key_takeaways,
        messages: messages.filter(m => m.id !== 'welcome'),
        user_message: query,
      });

      if (res.success && res.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: res.reply,
            timestamp: new Date(),
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "Je n'ai pas pu formuler ma réponse. Veuillez vérifier votre connexion et réessayer.",
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
          content: "Une erreur est survenue lors de l'échange avec le tuteur IA.",
          timestamp: new Date(),
          isError: true,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl h-[88vh] max-h-[750px] bg-slate-900/95 border border-purple-500/30 rounded-3xl flex flex-col shadow-2xl overflow-hidden shadow-purple-950/40">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-purple-500/40 shadow-sm">
              <img
                src={book.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'}
                alt={book.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-0.5">
                <Sparkles className="w-3 h-3 text-purple-300" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[320px]">
                  {book.title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400 animate-pulse" />
                  DeepSeek IA
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Tuteur interactif pour {book.author || 'ce livre audio'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-purple-900/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-md'
                    : msg.isError
                    ? 'bg-red-950/40 border border-red-500/30 text-red-200 rounded-tl-none'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-line">
                  {msg.content}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 shadow-md border border-slate-600">
                  <User className="w-4 h-4 text-slate-200" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/50 rounded-2xl px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>DeepSeek réfléchit et analyse le livre...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 bg-slate-950/40 border-t border-purple-500/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-purple-900/30 hover:bg-purple-800/50 border border-purple-500/30 text-purple-200 hover:text-white transition-all disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-purple-500/20 bg-slate-950/80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez une question sur ce livre..."
              disabled={isLoading}
              className="flex-1 bg-slate-800/90 border border-purple-500/30 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-medium shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center"
              title="Envoyer"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
