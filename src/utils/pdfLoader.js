/**
 * pdfLoader.js - Chargeur universel et résilient de PDF.js
 * Utilisé pour la liseuse PDF mobile, l'import en masse et la génération de métadonnées.
 */

let pdfjsLoadingPromise = null;

export function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window non défini'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    // Vérifier si le script est déjà présent dans le DOM
    const existing = document.querySelector('script[data-pdfjs="true"]');
    if (existing && window.pdfjsLib) {
      return resolve(window.pdfjsLib);
    }

    const script = document.createElement('script');
    script.setAttribute('data-pdfjs', 'true');
    // Priorité absolue au bundle local en cache pour le fonctionnement hors-ligne
    script.src = '/vendor/pdfjs/pdf.min.js';

    const setupWorker = (lib, workerUrl) => {
      try {
        const blob = new Blob([`importScripts("${workerUrl}");`], { type: 'application/javascript' });
        lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch {
        lib.GlobalWorkerOptions.workerSrc = workerUrl;
      }
    };

    script.onload = () => {
      if (window.pdfjsLib) {
        setupWorker(window.pdfjsLib, '/vendor/pdfjs/pdf.worker.min.js');
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js non initialisé'));
      }
    };

    script.onerror = () => {
      pdfjsLoadingPromise = null;
      // Repli sur CDN cdnjs puis jsdelivr si le fichier local n'est pas trouvé
      const cdnScript = document.createElement('script');
      cdnScript.setAttribute('data-pdfjs-cdn', 'true');
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      cdnScript.crossOrigin = 'anonymous';
      cdnScript.onload = () => {
        if (window.pdfjsLib) {
          setupWorker(window.pdfjsLib, 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js CDN non initialisé'));
        }
      };
      cdnScript.onerror = () => {
        const fallbackScript = document.createElement('script');
        fallbackScript.setAttribute('data-pdfjs-fallback', 'true');
        fallbackScript.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
        fallbackScript.onload = () => {
          if (window.pdfjsLib) {
            setupWorker(window.pdfjsLib, 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
            resolve(window.pdfjsLib);
          } else {
            reject(new Error('PDF.js fallback échoué'));
          }
        };
        fallbackScript.onerror = (err) => reject(new Error('Échec chargement PDF.js local et CDNs: ' + err));
        document.head.appendChild(fallbackScript);
      };
      document.head.appendChild(cdnScript);
    };

    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}
