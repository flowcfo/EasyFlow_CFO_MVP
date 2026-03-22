const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function wrapNetworkError(err) {
  const msg = String(err?.message || '');
  if (err?.name !== 'TypeError' || !msg.toLowerCase().includes('fetch')) return null;
  if (import.meta.env.PROD) {
    return new Error(
      `Cannot reach the API at ${API_URL}. In Netlify, set VITE_API_URL to your backend HTTPS URL and redeploy. On the API, set FRONTEND_URL to your Netlify site URL (comma-separated for multiple origins).`,
    );
  }
  return new Error(
    `Cannot reach the API at ${API_URL}. Start the server in /server (e.g. npm run dev) or set VITE_API_URL in client/.env.`,
  );
}

async function fetchApi(path, options) {
  try {
    return await fetch(`${API_URL}${path}`, options);
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
