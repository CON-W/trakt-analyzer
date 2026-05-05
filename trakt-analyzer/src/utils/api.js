import axios from 'axios';

// API 基础路径 - 自动适配 Vite base 路径
// 开发环境: /api
// 生产环境(子路径): /trakt/api
export const API_BASE = `${import.meta.env.BASE_URL}api`;


const api = axios.create({

  baseURL: API_BASE,
  timeout: 30000,
});


// Request interceptor to add session ID
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('trakt_session_id');
  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const sessionId = localStorage.getItem('trakt_session_id');
      if (sessionId) {
        try {
          const refreshResponse = await axios.post(`${API_BASE}/auth/refresh`, { sessionId });

          if (refreshResponse.data.accessToken) {
            error.config.headers['X-Session-Id'] = sessionId;
            return axios(error.config);
          }
        } catch (refreshError) {
          localStorage.removeItem('trakt_session_id');
          localStorage.removeItem('trakt_access_token');
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch enriched history via SSE with progress callbacks
 * Two-phase: result (fast raw data) -> enriched_result (slow with posters)
 * @param {string} type - 'movies' or 'shows'
 * @param {object} callbacks - { onProgress, onResult, onError }
 * @returns {AbortController} - to abort the request
 */
export function fetchEnrichedHistory(type, { onProgress, onResult, onItem, onError }) {
  const sessionId = localStorage.getItem('trakt_session_id');
  if (!sessionId) {
    onError?.('Not authenticated');
    return null;
  }

  const controller = new AbortController();

  fetch(`${API_BASE}/history/enriched/${type}`, {

    headers: { 'X-Session-Id': sessionId },
    signal: controller.signal,
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'progress') {
                  onProgress?.(data);
                } else if (data.type === 'result') {
                  // Phase 1: raw data (fast)
                  onResult?.(data);
                } else if (data.type === 'enriched_item') {
                  // Phase 2: each enriched item as it's ready (show one by one)
                  onItem?.(data);
                } else if (data.type === 'enriched_result') {
                  // Phase 2: all enriched data complete
                  onResult?.(data);
                } else if (data.type === 'error') {
                  onError?.(data.message);
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
          processChunk();
        }).catch(err => {
          if (err.name !== 'AbortError') {
            onError?.(err.message);
          }
        });
      }
      processChunk();
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        onError?.(err.message);
      }
    });

  return controller;
}

/**
 * Fetch analysis via SSE with progress callbacks
 * Two-phase: raw_result (fast) -> enriched_result (slow with posters)
 */
export function fetchAnalysis(type, { onProgress, onResult, onRawResult, onError }) {
  const sessionId = localStorage.getItem('trakt_session_id');
  if (!sessionId) {
    onError?.('Not authenticated');
    return null;
  }

  const controller = new AbortController();

  fetch(`${API_BASE}/analyze/${type}`, {

    headers: { 'X-Session-Id': sessionId },
    signal: controller.signal,
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'progress') {
                  onProgress?.(data);
                } else if (data.type === 'raw_result') {
                  // Phase 1: fast raw analysis ready
                  onRawResult?.(data);
                } else if (data.type === 'enriched_result') {
                  // Phase 2: enriched with posters
                  onResult?.(data);
                } else if (data.type === 'error') {
                  onError?.(data.message);
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
          processChunk();
        }).catch(err => {
          if (err.name !== 'AbortError') {
            onError?.(err.message);
          }
        });
      }
      processChunk();
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        onError?.(err.message);
      }
    });

  return controller;
}

/**
 * Fetch combined analysis (movies + shows merged) via SSE
 */
export function fetchCombinedAnalysis({ onProgress, onResult, onRawResult, onError }) {
  const sessionId = localStorage.getItem('trakt_session_id');
  if (!sessionId) {
    onError?.('Not authenticated');
    return null;
  }

  const controller = new AbortController();

  fetch(`${API_BASE}/analyze/combined`, {

    headers: { 'X-Session-Id': sessionId },
    signal: controller.signal,
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'progress') {
                  onProgress?.(data);
                } else if (data.type === 'raw_result') {
                  onRawResult?.(data);
                } else if (data.type === 'enriched_result') {
                  onResult?.(data);
                } else if (data.type === 'error') {
                  onError?.(data.message);
                }
              } catch (e) {}
            }
          }
          processChunk();
        }).catch(err => {
          if (err.name !== 'AbortError') {
            onError?.(err.message);
          }
        });
      }
      processChunk();
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        onError?.(err.message);
      }
    });

  return controller;
}

export const traktApi = {
  // Auth
  getAuthUrl: () => api.get('/auth/url'),
  handleCallback: (code, state) => api.post('/auth/callback', { code, state }),
  logout: (sessionId) => api.post('/auth/logout', { sessionId }),

  // User
  getProfile: () => api.get('/user/profile'),
  getStats: () => api.get('/user/stats'),

  // History (basic paginated)
  getMovieHistory: (page = 1) => api.get(`/history/movies?page=${page}`),
  getShowHistory: (page = 1) => api.get(`/history/shows?page=${page}`),

  // Ratings
  getRatings: (type = 'movies') => api.get(`/ratings?type=${type}`),

  // Watchlist
  getWatchlist: (type) => api.get(`/watchlist/${type}`),

  // Collection
  getCollection: (type) => api.get(`/collection/${type}`),

  // Health
  health: () => api.get('/health'),
};

export default api;
