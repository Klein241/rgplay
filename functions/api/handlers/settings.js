/**
 * functions/api/handlers/settings.js
 * 
 * Gestionnaire modulaire RG Play pour les Paramètres Globaux de la Plateforme (Architecture AGENTS.md) :
 * - Gestion persistante dans Cloudflare D1 (table app_settings)
 * - Configuration du support client VIP WhatsApp (+24177624383 par défaut - Gabon)
 * - Message prédéfini personnalisable pour l'ouverture WhatsApp
 */

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

const DEFAULT_SETTINGS = {
  support_whatsapp: '+24177624383',
  support_whatsapp_message: "Bonjour RG Play, j'ai besoin d'une assistance avec mon compte et mes accès VIP.",
};

/**
 * Assure que la table app_settings existe dans Cloudflare D1
 */
async function ensureSettingsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (_) {}
}

/**
 * GET /api/settings
 * Récupère les paramètres de l'application depuis Cloudflare D1
 */
export async function handleGetSettings(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({
      success: true,
      settings: DEFAULT_SETTINGS,
      source: 'defaults_no_db'
    }, corsHeaders);
  }

  try {
    await ensureSettingsTable(env.DB);

    const { results } = await env.DB.prepare(`
      SELECT key, value FROM app_settings
    `).all().catch(() => ({ results: [] }));

    const settingsMap = { ...DEFAULT_SETTINGS };
    for (const r of (results || [])) {
      if (r.key && r.value !== undefined) {
        settingsMap[r.key] = r.value;
      }
    }

    return jsonResponse({
      success: true,
      settings: settingsMap,
      source: 'cloudflare_d1'
    }, corsHeaders);
  } catch (err) {
    console.error('[handleGetSettings] Erreur:', err);
    return jsonResponse({
      success: true,
      settings: DEFAULT_SETTINGS,
      error: err.message
    }, corsHeaders);
  }
}

/**
 * POST /api/settings
 * Met à jour un ou plusieurs paramètres dans Cloudflare D1
 */
export async function handleSaveSettings(request, env, corsHeaders) {
  const body = await request.json().catch(() => ({}));

  if (!env.DB) {
    return jsonResponse({
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...body },
      note: 'Simulé sans D1'
    }, corsHeaders);
  }

  try {
    await ensureSettingsTable(env.DB);

    const keysToSave = ['support_whatsapp', 'support_whatsapp_message'];
    for (const key of keysToSave) {
      if (body[key] !== undefined) {
        const val = String(body[key]).trim();
        await env.DB.prepare(`
          INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).bind(key, val).run();
      }
    }

    // Invalider le cache KV si présent
    if (env.KV_BINDING) {
      await env.KV_BINDING.delete('app_settings').catch(() => {});
    }

    // Relire la configuration complète
    const { results } = await env.DB.prepare(`
      SELECT key, value FROM app_settings
    `).all().catch(() => ({ results: [] }));

    const updatedMap = { ...DEFAULT_SETTINGS };
    for (const r of (results || [])) {
      if (r.key && r.value !== undefined) {
        updatedMap[r.key] = r.value;
      }
    }

    return jsonResponse({
      success: true,
      settings: updatedMap,
      message: 'Paramètres mis à jour avec succès'
    }, corsHeaders);
  } catch (err) {
    console.error('[handleSaveSettings] Erreur:', err);
    return jsonResponse({
      success: false,
      error: err.message
    }, corsHeaders, 500);
  }
}
