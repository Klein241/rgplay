import crypto from 'node:crypto';

/**
 * Moteur Firebase Cloud Messaging (FCM) v1 HTTP API — Cloudflare Pages Functions
 * ─────────────────────────────────────────────────────────────────────────────
 * Permet l'envoi direct de notifications push sécurisées vers tous les appareils
 * abonnés via le protocole officiel Google OAuth2 & FCM HTTP v1.
 */

export const FIREBASE_SERVICE_ACCOUNT = {
  projectId: "rg-play-a6d69",
  clientEmail: "firebase-adminsdk-fbsvc@rg-play-a6d69.iam.gserviceaccount.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFxpudf3mJuFF5
AOqaR9m8s7jRZMhMTuGTvOdCFMIWmgJM1jrPGRXDZAvzHIaeFpyoqQXU9N5Gu4Ez
COTqgNX9nB+uoj5TSjof7QFqo7v2Awalt+ZfL6uU30pej/FM/ycukjllo0ldurEA
KbV9v21oqK/iXAXa1fMhA7sOAKFqiwXzNMweE3SKgnYtmYblGQz+JZr9FE5ULv82
CrBi9kf7e78McnaGHQ250LMk8kXM43S0w0w6v4i/J/pBMgfQrf7aLaba6A/DRWrb
6ZpiKNX23MWCIX96NeQNNEhkXfMwZ+igP15CIvzvMcAMKZ5Flu52cu88KadoSxSp
RpUXQCgbAgMBAAECggEAQ919e6OI+I2jg2KhnjRGjn6bTlsHckvlExWQw3etDCVn
4abngjYo5iXYBeHFfczjj+qEAknOVjY0ROdp6eAwzfg7VOj+ewUvAdKJmGa78lSi
fM4ogoQwnAKtGdrJ4fJyJwRtJqfL3ppX72bgjNhZuj6cMBAEwE2HQs5tawYjXZPg
zeirkYmpRFhmOo4v4w2JM+ZZHRRp1mJNDCLpdnuNDMHKF3yfMUfTVLlHJ+kQNL7B
iFm7UpE46/rUNjkszkUgmvJVmjimeDCVV99rKZEGTmADYMC8ol+MWvDWLpTb28Dx
N/uHFg8yjiYBwy2G29E+FfFNBlyZdp2Mt0zn8NIUuQKBgQD46mbxBTBZ15Oa+rk4
T8zqwIvZ8YVM/7dw2cfISU2D65tlCyquYsfdRt6O/01fT9SNbaipsrQmRIz7EVIU
UaWgf+53zo6beF5HVxfvhRxcVIjbOU8nIc2BEeC/jVoSvBtBhK7T57bjDJhVQql3
BJ7diqhdv3S3T27bmxMmcISiswKBgQDLZ5nvfodU+57/3aXuuwd587QSo004Z/W4
pT33DE/TUXb8muqq6Wg6H99x7F7rGd4gk2wfVQLkhGMFgRqPLFfPdvxCUe3E2yqm
FtPl8csPjS9QZGzybrTGDxpmHAcZWSVoe08p5iWhMTyIoIoETV7K8x4v161o3Pzy
apDmcx54+QKBgB++lR5L0RzEF3j+XLzHwJR3td43pQ5q1lQ4EfiDELWwSIMcZ3cR
9fdMYHnQKWfsYGkhAQ+TUNJIj8o9LUCWIQ9VAW6aEynUsgFbJBxR14oW5dU/e867
yt+ZDhafykr1Xmx+pWU0+ef+5TaKZ95b4n7SfiJmllYCdVrgbhLK6r9tAoGBALMS
bXpkeX5+25dFKo2HSOi7feAetqAfHjxF9cymoSxYfxmaxVhcjq8FWnFweIwgROeH
Alx/OkG2r3qsE5bSoif7B9DXUi3KCb0ZQcoh2fTCBlKPZz7z6eCocURODo3pZr6a
OLKZdK15rGJYe8mX2AlyijPyfC9ixqog2ZqY5M35AoGBAL8qeVIn0VGDXtFB+Vjz
X1rkMmkcCLx2k0pAx/4fI3VcRtjZxy8RNvzVgWNYRqr+QZeqdTcp1ph+WWHZJOQf
pZ/AzRpsKqqkCsKMzBqHdJ6PUy3Kfv6VC7gcY4Vc7RslfGaGkuwowlLwtUID4NEo
mDDfcakbtW/GxVIBJ2Mnq2ru
-----END PRIVATE KEY-----`
};

let cachedAccessToken = null;
let tokenExpiresAt = 0;

function base64Url(data) {
  return Buffer.from(data).toString('base64url');
}

/**
 * Obtient un token d'accès Google OAuth2 valide pour l'API FCM v1 (avec mise en cache 55min)
 */
export async function getGoogleAccessToken(serviceAccount = FIREBASE_SERVICE_ACCOUNT) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 300) {
    return cachedAccessToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.clientEmail,
    sub: serviceAccount.clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    iat: now,
    exp: now + 3600,
  };

  const tokenData = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(tokenData);
  const signature = sign.sign(serviceAccount.privateKey, 'base64url');

  const jwt = `${tokenData}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth error: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);
  return cachedAccessToken;
}

/**
 * Envoie une notification Push via Firebase Cloud Messaging HTTP v1
 */
export async function sendFcmMessage(token, { title, body, url, icon, bookId }, serviceAccount = FIREBASE_SERVICE_ACCOUNT) {
  if (!token) return { ok: false, error: 'Token manquant' };

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.projectId;

    const message = {
      token,
      notification: {
        title: title || '🎧 RG Play',
        body: body || 'Nouveau contenu audio disponible !',
      },
      data: {
        url: url || '/',
        bookId: bookId ? String(bookId) : '',
        title: title || '🎧 RG Play',
        body: body || '',
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: icon || '/icon-192.png',
          badge: '/icon-192.png',
          click_action: url || '/',
        },
        fcm_options: {
          link: url || '/',
        },
      },
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const resData = await res.json().catch(() => ({}));
    const isUnregistered = res.status === 404 || (resData.error?.details?.some(d => d.errorCode === 'UNREGISTERED'));

    return {
      status: res.status,
      ok: res.ok,
      data: resData,
      isUnregistered,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
