/** Absolute backend URL, or a path prefix (e.g. /backend) resolved to same-origin on Netlify via proxy */
function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return 'http://localhost:3001';
}

const API_BASE = resolveApiBase();

function isBrowserNetworkError(err) {
  if (err?.name !== 'TypeError') return false;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('fetch') || msg.includes('load failed') || msg.includes('networkerror');
}

function wrapNetworkError(err) {
  if (!isBrowserNetworkError(err)) return null;
  if (import.meta.env.PROD) {
    return new Error(
      `Cannot reach the API at ${API_BASE}. Production should use same-origin /backend (see netlify.toml proxy) or a full https API URL in VITE_API_URL.`,
    );
  }
  return new Error(
    `Cannot reach the API at ${API_BASE}. Start the server in /server (e.g. npm run dev) or set VITE_API_URL in client/.env.`,
  );
}

async function fetchApi(path, options) {
  try {
    return await fetch(`${API_BASE}${path}`, options);
  } catch (err) {
    const wrapped = wrapNetworkError(err);
    throw wrapped || err;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { ...options.headers };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetchApi(path, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  if (res.headers.get('Content-Type')?.includes('application/pdf')) {
    return res.blob();
  }

  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),

  postRaw: async (path, body) => {
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchApi(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return res;
  },

  upload: async (path, buffer, filename, extraHeaders = {}) => {
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/octet-stream', 'X-Filename': filename, ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetchApi(path, {
      method: 'POST',
      headers,
      body: buffer,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  stream: async function* (path, body) {
    const token = localStorage.getItem('access_token');
    const res = await fetchApi(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter((l) => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data);
        } catch {
          // skip malformed chunks
        }
      }
    }
  },
};
