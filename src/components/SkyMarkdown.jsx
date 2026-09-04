import React from 'react';
import { Quote, Sparkles, Terminal } from 'lucide-react';

/**
 * Format inline markdown: bold, italic, code, links
 */
const formatInline = (text) => {
  if (!text) return null;

  // Split by inline code first: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold (**text** or __text__) and italic (*text* or _text_)
    const formattedElements = [];
    let keyIdx = 0;

    // Regex for bold, italic, and links
    const combinedRegex = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|\[[^\]]+\]\([^)]+\))/g;
    const tokens = part.split(combinedRegex);

    for (let t of tokens) {
      if (!t) continue;
      
      // Bold: **text** or __text__
      if ((t.startsWith('**') && t.endsWith('**') && t.length >= 4) ||
          (t.startsWith('__') && t.endsWith('__') && t.length >= 4)) {
        formattedElements.push(
          <strong key={`${pIdx}-${keyIdx++}`} className="font-bold text-white tracking-wide">
            {t.slice(2, -2)}
          </strong>
        );
      }
      // Italic: *text* or _text_
      else if ((t.startsWith('*') && t.endsWith('*') && t.length >= 2) ||
               (t.startsWith('_') && t.endsWith('_') && t.length >= 2)) {
        formattedElements.push(
          <em key={`${pIdx}-${keyIdx++}`} className="italic text-cyan-200/90 font-medium">
            {t.slice(1, -1)}
          </em>
        );
      }
      // Link: [title](url)
      else if (t.startsWith('[') && t.includes('](') && t.endsWith(')')) {
        const titleMatch = t.match(/\[(.*?)\]/);
        const urlMatch = t.match(/\((.*?)\)/);
        if (titleMatch && urlMatch) {
          const rawUrl = urlMatch[1];
          const isAudio = rawUrl.startsWith('rg:audio:');
          const isEbook = rawUrl.startsWith('rg:ebook:');
          const isInternalBook = rawUrl.startsWith('rg:book:') || rawUrl.startsWith('book:') || rawUrl.includes('book=');
          
          if (isAudio) {
            const cleanId = rawUrl.replace('rg:audio:', '');
            formattedElements.push(
              <button
                key={`${pIdx}-${keyIdx++}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('rg:play-audio', {
                    detail: { bookId: cleanId, bookTitle: titleMatch[1] }
                  }));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 mx-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
              >
                <span>🎧 {titleMatch[1]}</span>
                <span className="text-[10px] text-emerald-200 font-bold">▶ Écouter</span>
              </button>
            );
          } else if (isEbook) {
            const cleanId = rawUrl.replace('rg:ebook:', '');
            formattedElements.push(
              <button
                key={`${pIdx}-${keyIdx++}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('rg:open-pdf-book', {
                    detail: { bookId: cleanId, bookTitle: titleMatch[1] }
                  }));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 mx-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-amber-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-400/40"
              >
                <span>📖 {titleMatch[1]}</span>
                <span className="text-[10px] text-amber-200 font-bold">📄 Lire</span>
              </button>
            );
          } else if (isInternalBook) {
            const cleanId = rawUrl.replace(/^(rg:book:|book:)/, '').replace(/.*[?&]book=/, '');
            formattedElements.push(
              <button
                key={`${pIdx}-${keyIdx++}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('rg:open-book-detail', {
                    detail: { bookId: cleanId, bookTitle: titleMatch[1] }
                  }));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 my-1 mx-1 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-purple-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-purple-400/40"
              >
                <span>ℹ️ {titleMatch[1]}</span>
                <span className="text-[10px] text-amber-300 font-bold">→ Fiche</span>
              </button>
            );
          } else {
            formattedElements.push(
              <a
                key={`${pIdx}-${keyIdx++}`}
                href={rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors font-medium"
              >
                {titleMatch[1]}
              </a>
            );
          }
        } else {
          formattedElements.push(t);
        }
      }
      // Plain text
      else {
        formattedElements.push(t);
      }
    }

    return <React.Fragment key={pIdx}>{formattedElements}</React.Fragment>;
  });
};

/**
 * SkyMarkdown - Formatteur de texte riche ultra-élégant pour l'Agent SKY
 */
export const SkyMarkdown = ({ content = '' }) => {
  if (!content) return null;

  // Split into raw blocks by newlines
  const lines = content.split('\n');
  const blocks = [];
  let currentList = null;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines = [];

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  const flushCodeBlock = () => {
    if (inCodeBlock) {
      blocks.push({
        type: 'code_block',
        lang: codeBlockLang,
        content: codeBlockLines.join('\n'),
      });
      inCodeBlock = false;
      codeBlockLang = '';
      codeBlockLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Code Block Fence ```
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim() || 'text';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 2. Empty Line
    if (!line) {
      flushList();
      continue;
    }

    // 3. Headings
    if (line.startsWith('### ')) {
      flushList();
      blocks.push({ type: 'h3', text: line.slice(4) });
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push({ type: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      blocks.push({ type: 'h1', text: line.slice(2) });
      continue;
    }

    // 4. Horizontal Rule
    if (line === '---' || line === '***' || line === '___') {
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }

    // 5. Blockquote
    if (line.startsWith('> ') || line === '>') {
      flushList();
      blocks.push({ type: 'quote', text: line.replace(/^>\s?/, '') });
      continue;
    }

    // 6. Unordered List Items (- , * , • )
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // 7. Ordered List Items (1. , 2. )
    const numberMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numberMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push({
        num: numberMatch[1],
        text: numberMatch[2]
      });
      continue;
    }

    // 8. Key takeaway or Callout Box (lines starting with emojis or labels)
    const calloutMatch = line.match(/^(💡|⚡|🎯|⚠️|🔑|✨|🔥|📌)\s*(.*)$/);
    if (calloutMatch) {
      flushList();
      blocks.push({
        type: 'callout',
        icon: calloutMatch[1],
        text: calloutMatch[2],
      });
      continue;
    }

    // 9. Standard Paragraph
    flushList();
    blocks.push({ type: 'p', text: line });
  }

  flushList();
  flushCodeBlock();

  return (
    <div className="space-y-3 leading-relaxed text-slate-200">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h2
                key={idx}
                className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-200 pt-2 pb-1 border-b border-cyan-500/20 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>{formatInline(block.text)}</span>
              </h2>
            );

          case 'h2':
            return (
              <h3
                key={idx}
                className="text-sm sm:text-base font-bold text-cyan-200 pt-1.5 flex items-center gap-2"
              >
                <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
                <span>{formatInline(block.text)}</span>
              </h3>
            );

          case 'h3':
            return (
              <h4
                key={idx}
                className="text-xs sm:text-sm font-bold text-indigo-200 pt-1 text-slate-100"
              >
                {formatInline(block.text)}
              </h4>
            );

          case 'quote':
            return (
              <div
                key={idx}
                className="my-2 p-3 sm:p-3.5 rounded-2xl bg-cyan-950/30 border-l-4 border-cyan-400/80 border-y border-r border-cyan-500/20 text-cyan-100 flex items-start gap-2.5 shadow-inner"
              >
                <Quote className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5 opacity-80" />
                <div className="text-xs sm:text-sm italic leading-relaxed">
                  {formatInline(block.text)}
                </div>
              </div>
            );

          case 'callout':
            return (
              <div
                key={idx}
                className="my-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-cyan-950/40 border border-cyan-500/30 shadow-md flex items-start gap-3"
              >
                <span className="text-lg flex-shrink-0 leading-none select-none">
                  {block.icon}
                </span>
                <div className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed">
                  {formatInline(block.text)}
                </div>
              </div>
            );

          case 'ul':
            return (
              <ul key={idx} className="space-y-2 my-2 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
                    <span className="flex-1 leading-relaxed">{formatInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={idx} className="space-y-2.5 my-2 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-200">
                    <span className="w-5 h-5 rounded-lg bg-gradient-to-br from-cyan-500/25 to-indigo-500/25 text-cyan-300 border border-cyan-500/40 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      {item.num}
                    </span>
                    <span className="flex-1 leading-relaxed">{formatInline(item.text)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'code_block':
            return (
              <div key={idx} className="my-2.5 rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-cyan-500/20 text-[10px] font-mono text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    {block.lang}
                  </span>
                </div>
                <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                  {block.content}
                </pre>
              </div>
            );

          case 'hr':
            return <hr key={idx} className="border-t border-cyan-500/20 my-3" />;

          case 'p':
          default:
            return (
              <p key={idx} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {formatInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
};
