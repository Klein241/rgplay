import crypto from 'node:crypto';

/**
 * Gestionnaire Web Push Notification VAPID (RFC 8291 & RFC 8292)
 * Permet l'envoi direct de notifications push sécurisées vers Google FCM, Apple Push et Mozilla.
 */

export const DEFAULT_VAPID_KEYS = {
  publicKey: 'BBr2HgFOQCrVt45uP7DfTjfYcS2zaxXwcnQ8IAx1w5u1L8JDJ29UuX6-WB2pfIvk_hMTwmpvlodg_q3V6C5GZWc',
  privateKey: 'QY-ywvf9PAMZ4TFqyqzil4u66ONGtPZWdXRnjfNrMfg',
  subject: 'mailto:admin@readsgreat.com',
};

/**
 * Crée l'en-tête Authorization VAPID signé en ES256 (P-256 / SHA-256)
 */
export function createVapidAuthHeader(audience, subject, publicKeyBase64Url, privateKeyBase64Url) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 43200, // 12 heures
    sub: subject || DEFAULT_VAPID_KEYS.subject,
  };

  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const tokenData = `${b64u(header)}.${b64u(payload)}`;

  const d = Buffer.from(privateKeyBase64Url, 'base64url');
  const x = Buffer.from(publicKeyBase64Url, 'base64url').subarray(1, 33);
  const y = Buffer.from(publicKeyBase64Url, 'base64url').subarray(33, 65);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: x.toString('base64url'),
    y: y.toString('base64url'),
    d: d.toString('base64url'),
  };

  const privateKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const signature = crypto.sign('SHA256', Buffer.from(tokenData), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${tokenData}.${signature.toString('base64url')}`;
  return `vapid t=${jwt}, k=${publicKeyBase64Url}`;
}

/**
 * Chiffre la charge utile en aes128gcm selon la norme Web Push RFC 8291
 */
export function encryptPayload(payloadString, subscriberP256dhBase64Url, subscriberAuthBase64Url) {
  const userPublicKey = Buffer.from(subscriberP256dhBase64Url, 'base64url');
  const userAuth = Buffer.from(subscriberAuthBase64Url, 'base64url');

  const localEcdh = crypto.createECDH('prime256v1');
  localEcdh.generateKeys();
  const localPublicKey = localEcdh.getPublicKey();

  const sharedSecret = localEcdh.computeSecret(userPublicKey);

  // Helper HKDF (HMAC-SHA256)
  const hkdf = (salt, ikm, info, length) => {
    const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    let prev = Buffer.alloc(0);
    let output = Buffer.alloc(0);
    let counter = 1;
    while (output.length < length) {
      const hmac = crypto.createHmac('sha256', prk);
      hmac.update(prev);
      hmac.update(info);
      hmac.update(Buffer.from([counter++]));
      prev = hmac.digest();
      output = Buffer.concat([output, prev]);
    }
    return output.subarray(0, length);
  };

  const salt = crypto.randomBytes(16);

  // authInfo = 'WebPush: info\0' + userPublicKey + localPublicKey
  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    userPublicKey,
    localPublicKey,
  ]);
  const prk = hkdf(userAuth, sharedSecret, authInfo, 32);

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');

  const cek = hkdf(salt, prk, cekInfo, 16);
  const nonce = hkdf(salt, prk, nonceInfo, 12);

  // Padding RFC 8291 : charge utile + délimiteur 0x02
  const record = Buffer.concat([
    Buffer.from(payloadString, 'utf8'),
    Buffer.from([2]),
  ]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  // En-tête RFC 8291 : 16 bytes salt + 4 bytes record size (4096) + 1 byte key len (65) + 65 bytes pub key
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  const header = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([localPublicKey.length]),
    localPublicKey,
  ]);

  return Buffer.concat([header, ciphertext]);
}

/**
 * Envoie une notification push vers un abonné
 */
export async function sendWebPushNotification(subscription, payloadObj, vapidConfig = DEFAULT_VAPID_KEYS) {
  if (!subscription || !subscription.endpoint) {
    throw new Error('Souscription invalide : endpoint manquant');
  }

  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const authHeader = createVapidAuthHeader(
    audience,
    vapidConfig.subject,
    vapidConfig.publicKey,
    vapidConfig.privateKey
  );

  let bodyBuffer = null;
  const headers = {
    'TTL': '86400',
    'Urgency': 'high',
    'Authorization': authHeader,
  };

  if (payloadObj && subscription.keys?.p256dh && subscription.keys?.auth) {
    const payloadStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    bodyBuffer = encryptPayload(payloadStr, subscription.keys.p256dh, subscription.keys.auth);
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Encoding'] = 'aes128gcm';
  }

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers,
    body: bodyBuffer,
  });

  return {
    status: res.status,
    ok: res.ok || res.status === 201 || res.status === 200,
    isExpired: res.status === 404 || res.status === 410,
  };
}

/**
 * Diffusion générale (Broadcast) de notifications push à tous les abonnés D1
 */
export async function handlePushBroadcast(request, env, corsHeaders) {
  const body = await request.json().catch(() => ({}));
  const { title, message, body: customBody, url = '/', bookId = null } = body;

  const notifTitle = title || '✨ Nouveauté sur RG Play !';
  const notifMessage = message || customBody || 'Un nouveau contenu audio d\'excellence est disponible.';

  const payload = {
    title: notifTitle,
    body: notifMessage,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `rg-push-${Date.now()}`,
    data: { url, bookId },
  };

  const vapidConfig = {
    publicKey: (env && env.VAPID_PUBLIC_KEY) || DEFAULT_VAPID_KEYS.publicKey,
    privateKey: (env && env.VAPID_PRIVATE_KEY) || DEFAULT_VAPID_KEYS.privateKey,
    subject: (env && env.VAPID_SUBJECT) || DEFAULT_VAPID_KEYS.subject,
  };

  let subscribers = [];

  // 1. Lire les souscriptions dans D1
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare(
        'SELECT endpoint, auth, p256dh, user_id, device FROM push_subscriptions'
      ).all();
      subscribers = results || [];
    } catch (_) {}
  }

  // 2. Fallback KV si D1 vide
  if (subscribers.length === 0 && env.KV_BINDING) {
    try {
      const keys = await env.KV_BINDING.list({ prefix: 'push_' });
      for (const k of (keys.keys || []).slice(0, 100)) {
        const item = await env.KV_BINDING.get(k.name, { type: 'json' });
        if (item?.subscription?.endpoint) {
          subscribers.push({
            endpoint: item.subscription.endpoint,
            auth: item.subscription.keys?.auth || '',
            p256dh: item.subscription.keys?.p256dh || '',
            user_id: item.userId || 'anon',
            device: item.device || 'mobile',
          });
        }
      }
    } catch (_) {}
  }

  let sent = 0;
  let failed = 0;
  let purged = 0;
  const deadEndpoints = [];

  // 3. Envoi simultané par lots de 15 pour préserver les quotas I/O Workers
  const BATCH_SIZE = 15;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sub) => {
        try {
          const subscriptionObj = {
            endpoint: sub.endpoint,
            keys: { auth: sub.auth, p256dh: sub.p256dh },
          };
          const result = await sendWebPushNotification(subscriptionObj, payload, vapidConfig);
          if (result.ok) {
            sent++;
          } else if (result.isExpired) {
            deadEndpoints.push(sub.endpoint);
            purged++;
          } else {
            failed++;
          }
        } catch (_) {
          failed++;
        }
      })
    );
  }

  // 4. Nettoyage des abonnements expirés (404/410)
  if (deadEndpoints.length > 0 && env.DB) {
    for (const ep of deadEndpoints) {
      env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run().catch(() => {});
      if (env.KV_BINDING) env.KV_BINDING.delete(`push_${ep}`).catch(() => {});
    }
  }

  // 5. Enregistrer la notification dans l'historique D1
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO notifications_history (id, title, body, icon, url, book_id, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        `notif_${Date.now()}`,
        notifTitle,
        notifMessage,
        '/icon-192.png',
        url,
        bookId
      ).run();
    } catch (_) {}
  }

  return new Response(JSON.stringify({
    success: true,
    broadcasted: true,
    totalSubscribers: subscribers.length,
    sent,
    failed,
    purged,
    message: `${sent} notification(s) push envoyée(s) avec succès (${purged} expirée(s) purgée(s)).`,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
