const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'api.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add import at top if not present
if (!code.includes("import { getUserId } from '../utils/userId'")) {
  code = "import { getUserId } from '../utils/userId';\n" + code;
}

// 2. Replace const CURRENT_USER_ID = 'user-demo'; with export { getUserId };
code = code.replace(/const CURRENT_USER_ID = 'user-demo';/, 'export { getUserId };');

// 3. Replace all remaining CURRENT_USER_ID with getUserId()
code = code.replace(/userId = CURRENT_USER_ID/g, 'userId = getUserId()');
code = code.replace(/CURRENT_USER_ID/g, 'getUserId()');

// 4. Add ads and referral methods before the closing brace of apiClient
const methodsToAdd = `
  // ── Publicités & Offres Sponsorisées (D1/KV + Cache) ─────────────
  async getAds({ placement = null } = {}) {
    try {
      const url = placement ? \`\${API_BASE}/ads?placement=\${encodeURIComponent(placement)}\` : \`\${API_BASE}/ads\`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.ads)) {
          localStorage.setItem('rg_cached_ads', JSON.stringify(data.ads));
          return data.ads;
        }
      }
    } catch (_) {}
    try {
      const local = JSON.parse(localStorage.getItem('rg_admin_ads') || localStorage.getItem('rg_cached_ads') || '[]');
      if (placement) return local.filter(a => a.active && Array.isArray(a.placements) && a.placements.includes(placement));
      return local.filter(a => a.active);
    } catch (_) { return []; }
  },

  async getAdminAds() {
    try {
      const res = await fetch(\`\${API_BASE}/admin/ads\`, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.ads)) {
          localStorage.setItem('rg_admin_ads', JSON.stringify(data.ads));
          return data.ads;
        }
      }
    } catch (_) {}
    try {
      return JSON.parse(localStorage.getItem('rg_admin_ads') || '[]');
    } catch (_) { return []; }
  },

  async saveAdminAds(ads) {
    try {
      localStorage.setItem('rg_admin_ads', JSON.stringify(ads));
      window.dispatchEvent(new CustomEvent('rg:ads-updated', { detail: ads }));
      const res = await fetch(\`\${API_BASE}/admin/ads\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Erreur sauvegarde pubs serveur (non bloquant):', e);
    }
    return { success: true };
  },

  // ── Parrainage & Affiliation ──────────────────────────────────────
  async registerReferral(referrerCode) {
    if (!referrerCode) return { success: false };
    try {
      const res = await fetch(\`\${API_BASE}/referral/register\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ referrerCode, userId: getUserId() }),
      });
      if (res.ok) return await res.json();
    } catch (_) {}
    return { success: true };
  },

  async getReferralStats(code) {
    try {
      const url = code ? \`\${API_BASE}/referral/stats?code=\${encodeURIComponent(code)}\` : \`\${API_BASE}/referral/stats\`;
      const res = await fetch(url, {
        headers: { 'X-User-Id': getUserId() },
      });
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  },
`;

if (!code.includes('getAdminAds()')) {
  const matchIndex = code.lastIndexOf('};');
  if (matchIndex !== -1) {
    code = code.slice(0, matchIndex) + methodsToAdd + code.slice(matchIndex);
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('src/services/api.js successfully updated.');
