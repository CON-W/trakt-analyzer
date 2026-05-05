import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Configuration
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID || '';
const TRAKT_CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET || '';
const TRAKT_REDIRECT_URI = process.env.TRAKT_REDIRECT_URI || 'http://localhost:5173/auth/callback';

const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_IMG_URL = 'https://walter.trakt.tv';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
// Use TMDB API - supports proxy/mirror for regions where api.themoviedb.org is blocked
// In China, you can use a proxy like: https://api.themoviedb.org/3 (via VPN)
// Or a mirror like: https://tmdb.mirror.example.com/3
const TMDB_API_URL = process.env.TMDB_API_URL || 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = process.env.TMDB_IMG_URL || 'https://image.tmdb.org/t/p';
const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE || 'zh-CN';

// In-memory token store
const tokenStore = new Map();
// Media info cache (TMDB + Douban)
const mediaCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
// Analysis cache
const analysisCache = new Map();
const ANALYSIS_CACHE_TTL = 60 * 60 * 1000; // 1 hour
// History cache
const historyCache = new Map();
const HISTORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// ============ Trakt Media Info (for posters) ============

async function fetchTraktMediaInfo(traktId, type) {
  try {
    const mediaType = type === 'movies' ? 'movies' : 'shows';
    const response = await axios.get(`${TRAKT_API_URL}/${mediaType}/${traktId}?extended=full,images`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID,
      },
      timeout: 3000,
    });
    return response.data;
  } catch (e) {
    return null;
  }
}

// Trakt images are returned as arrays of URLs from media.trakt.tv
// Example: ["media.trakt.tv/images/movies/000/000/550/posters/medium/fdb00dd209.jpg.webp"]
function getTraktPosterFromImages(images) {
  if (!images?.poster || !Array.isArray(images.poster) || images.poster.length === 0) return null;
  // Prefer medium size (good balance of quality and size)
  const url = images.poster[0];
  // Ensure it has https:// prefix
  return url.startsWith('http') ? url : `https://${url}`;
}

function getTraktFanartFromImages(images) {
  if (!images?.fanart || !Array.isArray(images.fanart) || images.fanart.length === 0) return null;
  const url = images.fanart[0];
  return url.startsWith('http') ? url : `https://${url}`;
}

// Build Trakt image URL directly from IDs
// Note: walter.trakt.tv returns 403 in some regions, so we use media.trakt.tv instead
function buildTraktImageUrl(traktId, type, imageType, size) {
  const typePath = type === 'movies' ? 'movies' : 'shows';
  // Pad traktId to 9 digits with leading zeros (e.g., 550 -> 000/000/550)
  const padded = String(traktId).padStart(9, '0');
  const parts = padded.match(/.{1,3}/g) || [];
  const path = parts.join('/');
  return `https://media.trakt.tv/images/${typePath}/${path}/${imageType}/${size}.jpg`;
}

// Try multiple sizes for Trakt poster
function getTraktPosterUrl(traktId, type) {
  if (!traktId) return null;
  return buildTraktImageUrl(traktId, type, 'posters', 'medium');
}

function getTraktFanartUrl(traktId, type) {
  if (!traktId) return null;
  return buildTraktImageUrl(traktId, type, 'fanarts', 'medium');
}

// ============ TMDB Integration ============
// Note: api.themoviedb.org may be inaccessible in some regions (e.g., China).
// If TMDB calls timeout, the enrich process will skip TMDB gracefully.

async function fetchTMDBMovie(tmdbId) {
  if (!TMDB_API_KEY) return null;
  try {
    const lang = TMDB_LANGUAGE;
    const [detailsRes, creditsRes] = await Promise.all([
      axios.get(`${TMDB_API_URL}/movie/${tmdbId}`, {
        params: { api_key: TMDB_API_KEY, language: lang },
        timeout: 4000,
      }),
      axios.get(`${TMDB_API_URL}/movie/${tmdbId}/credits`, {
        params: { api_key: TMDB_API_KEY, language: lang },
        timeout: 4000,
      }),
    ]);
    const d = detailsRes.data;
    const c = creditsRes.data;
    let overview = d.overview;
    if (!overview || overview === '') {
      try {
        const enRes = await axios.get(`${TMDB_API_URL}/movie/${tmdbId}`, {
          params: { api_key: TMDB_API_KEY, language: 'en-US' },
          timeout: 3000,
        });
        overview = enRes.data.overview;
      } catch (e) {}
    }
    return {
      title_cn: d.title,
      original_title: d.original_title,
      tagline: d.tagline || null,
      overview: overview,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
      release_date: d.release_date,
      runtime: d.runtime,
      genres: (d.genres || []).map(g => g.name),
      vote_average: d.vote_average,
      directors: c.crew?.filter(p => p.job === 'Director').map(p => p.name) || [],
      cast: c.cast?.slice(0, 20).map(p => ({ name: p.name, character: p.character })) || [],
    };
  } catch (e) {
    return null;
  }
}

async function fetchTMDBShow(tmdbId) {
  if (!TMDB_API_KEY) return null;
  try {
    const lang = TMDB_LANGUAGE;
    const [detailsRes, creditsRes] = await Promise.all([
      axios.get(`${TMDB_API_URL}/tv/${tmdbId}`, {
        params: { api_key: TMDB_API_KEY, language: lang },
        timeout: 4000,
      }),
      axios.get(`${TMDB_API_URL}/tv/${tmdbId}/credits`, {
        params: { api_key: TMDB_API_KEY, language: lang },
        timeout: 4000,
      }),
    ]);
    const d = detailsRes.data;
    const c = creditsRes.data;
    let overview = d.overview;
    if (!overview || overview === '') {
      try {
        const enRes = await axios.get(`${TMDB_API_URL}/tv/${tmdbId}`, {
          params: { api_key: TMDB_API_KEY, language: 'en-US' },
          timeout: 3000,
        });
        overview = enRes.data.overview;
      } catch (e) {}
    }
    return {
      title_cn: d.name,
      original_title: d.original_name,
      tagline: d.tagline || null,
      overview: overview,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
      first_air_date: d.first_air_date,
      last_air_date: d.last_air_date,
      number_of_seasons: d.number_of_seasons,
      number_of_episodes: d.number_of_episodes,
      genres: (d.genres || []).map(g => g.name),
      vote_average: d.vote_average,
      creators: d.created_by?.map(p => p.name) || [],
      writers: c.crew?.filter(p => p.department === 'Writing').map(p => p.name) || [],
      cast: c.cast?.slice(0, 20).map(p => ({ name: p.name, character: p.character })) || [],
      status: d.status, // "Ended", "Returning Series", "Canceled", etc.
      in_production: d.in_production,
      runtime: d.episode_run_time?.[0] || 45, // 使用 TMDB episode_run_time，默认 45 分钟
    };
  } catch (e) {
    return null;
  }
}

async function searchTMDBByIMDB(imdbId, type) {
  if (!TMDB_API_KEY || !imdbId) return null;
  try {
    const mediaType = type === 'movies' ? 'movie' : 'tv';
    const res = await axios.get(`${TMDB_API_URL}/find/${imdbId}`, {
      params: { api_key: TMDB_API_KEY, external_source: 'imdb_id', language: TMDB_LANGUAGE },
      timeout: 4000,
    });
    const results = res.data[`${mediaType}_results`];
    if (results && results.length > 0) {
      return results[0].id;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============ Douban Integration ============

async function fetchDoubanRating(title, year) {
  try {
    const searchUrl = `https://douban.uieee.xyz/v2/movie/search?q=${encodeURIComponent(title)}`;
    const res = await axios.get(searchUrl, { timeout: 5000 });
    const subjects = res.data.subjects || [];
    const match = subjects.find(s => s.year == year) || subjects[0];
    if (match) {
      return {
        rating: match.rating?.average || null,
        url: match.alt || `https://movie.douban.com/subject/${match.id}/`,
        id: match.id,
        title: match.title,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============ Media Info Enrichment ============

function getTraktPoster(images) {
  if (!images) return null;
  // Trakt v2 API returns images as arrays of URLs
  // Example: images.poster = ["media.trakt.tv/images/movies/000/000/550/posters/medium/fdb00dd209.jpg.webp"]
  if (Array.isArray(images.poster) && images.poster.length > 0) {
    const url = images.poster[0];
    return url.startsWith('http') ? url : `https://${url}`;
  }
  // Fallback for object format
  return images.poster?.full || images.poster?.medium || null;
}

function getTraktFanart(images) {
  if (!images) return null;
  if (Array.isArray(images.fanart) && images.fanart.length > 0) {
    const url = images.fanart[0];
    return url.startsWith('http') ? url : `https://${url}`;
  }
  return images.fanart?.full || images.fanart?.medium || null;
}

// Helper: run a promise with timeout
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]).catch(() => fallback);
}

async function enrichMediaItem(item, type) {
  const isMovie = type === 'movies';
  const ids = isMovie ? item.movie?.ids : item.show?.ids;
  const images = isMovie ? item.movie?.images : item.show?.images;
  if (!ids) return item;

  const cacheKey = `${type}_${ids.trakt}`;
  const cached = mediaCache.get(cacheKey);
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return { ...item, _enriched: cached.data };
  }

  let tmdbId = ids.tmdb;
  let enriched = {};

  // Method 1: Try to get poster from Trakt history images
  let traktPoster = getTraktPoster(images);
  let traktFanart = getTraktFanart(images);

  // Method 2: If no images in history, fetch directly from Trakt API (with timeout)
  if (!traktPoster && ids.trakt) {
    const mediaInfo = await withTimeout(fetchTraktMediaInfo(ids.trakt, type), 1500, null);
    if (mediaInfo) {
      const mediaImages = isMovie ? mediaInfo.images : mediaInfo.images;
      traktPoster = getTraktPoster(mediaImages);
      traktFanart = getTraktFanart(mediaImages);
    }
  }

  // Method 3: Build Trakt image URL directly from trakt ID
  // Note: walter.trakt.tv may return 403 in some regions, so this is best-effort
  if (!traktPoster && ids.trakt) {
    traktPoster = getTraktPosterUrl(ids.trakt, type);
    traktFanart = getTraktFanartUrl(ids.trakt, type);
  }

  if (traktPoster) enriched.poster = traktPoster;
  if (traktFanart) enriched.backdrop = traktFanart;

  // TMDB and Douban are optional enhancements - run in parallel with short timeout
  const title = isMovie ? item.movie?.title : item.show?.title;
  const year = isMovie ? item.movie?.year : item.show?.year;

  const enrichmentPromises = [];

  // Try to get TMDB ID from IMDB ID if not available
  if (!tmdbId && ids.imdb && TMDB_API_KEY) {
    enrichmentPromises.push(
      withTimeout(searchTMDBByIMDB(ids.imdb, type), 2000, null)
        .then(id => { if (id) tmdbId = id; })
    );
  }

  // Fetch TMDB data (for Chinese titles, overview, genres, ratings)
  if (tmdbId && TMDB_API_KEY) {
    enrichmentPromises.push(
      withTimeout(
        (isMovie ? fetchTMDBMovie(tmdbId) : fetchTMDBShow(tmdbId)),
        3000, null
      ).then(tmdbData => {
        if (tmdbData) {
          if (!enriched.poster && tmdbData.poster) enriched.poster = tmdbData.poster;
          if (!enriched.backdrop && tmdbData.backdrop) enriched.backdrop = tmdbData.backdrop;
          enriched.title_cn = tmdbData.title_cn;
          enriched.original_title = tmdbData.original_title;
          enriched.tagline = tmdbData.tagline;
          enriched.overview = tmdbData.overview;
          enriched.genres = tmdbData.genres;
          enriched.vote_average = tmdbData.vote_average;
          enriched.directors = tmdbData.directors;
          enriched.creators = tmdbData.creators;
          enriched.writers = tmdbData.writers;
          enriched.cast = tmdbData.cast;
          enriched.runtime = tmdbData.runtime;
          enriched.number_of_seasons = tmdbData.number_of_seasons;
          enriched.number_of_episodes = tmdbData.number_of_episodes;
          enriched.status = tmdbData.status;
          enriched.in_production = tmdbData.in_production;
        }
      })
    );
  }

  // Fetch Douban rating (with timeout)
  if (title) {
    enrichmentPromises.push(
      withTimeout(fetchDoubanRating(title, year), 2000, null)
        .then(douban => {
          if (douban) {
            enriched.douban_rating = douban.rating;
            enriched.douban_url = douban.url;
            enriched.douban_title = douban.title;
          }
        })
    );
  }

  // Wait for all optional enrichments (max ~3s)
  await Promise.all(enrichmentPromises);

  // Cache the result
  mediaCache.set(cacheKey, { data: enriched, timestamp: Date.now() });

  return { ...item, _enriched: enriched };
}

// ============ Middleware ============

app.use('/api', (req, res, next) => {
  if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
    return res.status(400).json({
      error: 'TRAKT_NOT_CONFIGURED',
      message: '请先在服务器环境变量中配置 TRAKT_CLIENT_ID 和 TRAKT_CLIENT_SECRET'
    });
  }
  next();
});

// ============ Auth Routes ============

app.get('/api/auth/url', (req, res) => {
  const state = generateState();
  tokenStore.set(state, { createdAt: Date.now() });
  const authUrl = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_CLIENT_ID}&redirect_uri=${TRAKT_REDIRECT_URI}&state=${state}`;
  res.json({ url: authUrl, state });
});

app.post('/api/auth/callback', async (req, res) => {
  const { code, state } = req.body;
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }
  const storedData = tokenStore.get(state);
  if (!storedData) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  tokenStore.delete(state);

  try {
    const response = await axios.post('https://trakt.tv/oauth/token', {
      code,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: TRAKT_REDIRECT_URI,
      grant_type: 'authorization_code',
    });
    const tokens = response.data;
    const sessionId = crypto.randomBytes(16).toString('hex');
    tokenStore.set(sessionId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      createdAt: Date.now(),
      expiresAt: Date.now() + (tokens.expires_in * 1000 || 7776000000),
    });
    res.json({ sessionId, accessToken: tokens.access_token, expiresIn: tokens.expires_in });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed', details: error.response?.data });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { sessionId } = req.body;
  const session = tokenStore.get(sessionId);
  if (!session?.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }
  try {
    const response = await axios.post('https://trakt.tv/oauth/token', {
      refresh_token: session.refreshToken,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: TRAKT_REDIRECT_URI,
      grant_type: 'refresh_token',
    });
    const tokens = response.data;
    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.expiresAt = Date.now() + (tokens.expires_in * 1000 || 7776000000);
    res.json({ accessToken: tokens.access_token });
  } catch (error) {
    console.error('Refresh error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) tokenStore.delete(sessionId);
  res.json({ success: true });
});

// ============ Trakt API Helper ============

async function traktApiCall(endpoint, sessionId, params = {}) {
  const session = tokenStore.get(sessionId);
  if (!session?.accessToken) throw new Error('Not authenticated');

  if (Date.now() > session.expiresAt - 86400000) {
    try {
      const refreshResponse = await axios.post('https://trakt.tv/oauth/token', {
        refresh_token: session.refreshToken,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: TRAKT_REDIRECT_URI,
        grant_type: 'refresh_token',
      });
      session.accessToken = refreshResponse.data.access_token;
      session.refreshToken = refreshResponse.data.refresh_token;
    } catch (e) {
      throw new Error('Token refresh failed');
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_CLIENT_ID,
    'Authorization': `Bearer ${session.accessToken}`,
  };

  const response = await axios.get(`${TRAKT_API_URL}${endpoint}`, {
    headers,
    params: { ...params, limit: 1000, extended: 'full,images' },
    timeout: 30000,
  });
  return response;
}

// ============ User Routes ============

app.get('/api/user/profile', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const response = await traktApiCall('/users/me', sessionId);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/user/stats', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const profile = await traktApiCall('/users/me', sessionId);
    const username = profile.data.ids.slug;
    const response = await traktApiCall(`/users/${username}/stats`, sessionId);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============ History Routes ============

app.get('/api/history/movies', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const page = req.query.page || 1;
  try {
    const response = await traktApiCall('/sync/history/movies', sessionId, { page, limit: 1000 });
    const totalPages = parseInt(response.headers['x-pagination-page-count'] || '1');
    const totalItems = parseInt(response.headers['x-pagination-item-count'] || '0');
    res.json({ data: response.data, pagination: { page: parseInt(page), totalPages, totalItems } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie history' });
  }
});

app.get('/api/history/shows', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const page = req.query.page || 1;
  try {
    const response = await traktApiCall('/sync/history/shows', sessionId, { page, limit: 1000 });
    const totalPages = parseInt(response.headers['x-pagination-page-count'] || '1');
    const totalItems = parseInt(response.headers['x-pagination-item-count'] || '0');
    res.json({ data: response.data, pagination: { page: parseInt(page), totalPages, totalItems } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch show history' });
  }
});

// ============ Enriched History with SSE Progress (dedup + one-by-one) ============

app.get('/api/history/enriched/:type', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const { type } = req.params;
  if (!['movies', 'shows'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use movies or shows.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (step, message, progress) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', step, message, progress })}\n\n`);
  };

  try {
    sendProgress('fetch', '正在获取观看记录...', 5);

    const firstResponse = await traktApiCall(`/sync/history/${type}`, sessionId, { page: 1, limit: 1000, extended: 'full,images' });
    const totalPages = parseInt(firstResponse.headers['x-pagination-page-count'] || '1');
    let allData = [...firstResponse.data];

    sendProgress('fetch', `已获取第 1 页，共 ${totalPages} 页...`, 10);

    const pagePromises = [];
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(
        traktApiCall(`/sync/history/${type}`, sessionId, { page, limit: 1000, extended: 'full,images' })
          .then(response => {
            sendProgress('fetch', `正在获取第 ${page}/${totalPages} 页...`, 10 + (page / totalPages) * 30);
            return response;
          })
      );
    }
    const remainingResponses = await Promise.all(pagePromises);
    remainingResponses.forEach(response => { allData = [...allData, ...response.data]; });

    // Deduplicate: for movies merge by movie id, for shows merge by show id
    const dedupMap = new Map();
    for (const item of allData) {
      const id = type === 'movies' ? item.movie?.ids?.trakt : item.show?.ids?.trakt;
      if (!id) continue;
      if (!dedupMap.has(id)) {
        dedupMap.set(id, { ...item, _watchCount: 1, _firstWatched: item.watched_at, _lastWatched: item.watched_at, _episodes: [] });
      } else {
        const existing = dedupMap.get(id);
        existing._watchCount = (existing._watchCount || 1) + 1;
        if (item.watched_at > existing._lastWatched) existing._lastWatched = item.watched_at;
        if (item.watched_at < existing._firstWatched) existing._firstWatched = item.watched_at;
        // For shows, collect episode info
        if (type === 'shows' && item.episode) {
          existing._episodes.push(item.episode);
        }
      }
    }
    const dedupedData = Array.from(dedupMap.values());

    // For shows, compute season/episode progress
    if (type === 'shows') {
      for (const item of dedupedData) {
        if (item._episodes && item._episodes.length > 0) {
          const seasons = [...new Set(item._episodes.map(e => e.season))].sort((a, b) => a - b);
          item._seasonRange = seasons.length > 0
            ? (seasons.length === 1 ? `S${seasons[0]}` : `S${seasons[0]}-S${seasons[seasons.length - 1]}`)
            : '';
          item._episodeCount = item._episodes.length;
        } else {
          item._seasonRange = '';
          item._episodeCount = 0;
        }
      }
    }

    // Phase 1: Send raw data immediately (fast!)
    sendProgress('raw_result', `基础数据已加载 (去重后 ${dedupedData.length} 条)，正在获取详细信息...`, 40);
    res.write(`data: ${JSON.stringify({ type: 'result', data: dedupedData, totalItems: dedupedData.length })}\n\n`);

    // Phase 2: Enrich with TMDB/Trakt media info (slow) - send each item as it's done
    sendProgress('enrich', `正在获取海报和详细信息 (0/${dedupedData.length})...`, 45);

    const enrichedData = [];
    for (let i = 0; i < dedupedData.length; i++) {
      const enriched = await enrichMediaItem(dedupedData[i], type);
      enrichedData.push(enriched);
      // Send each enriched item immediately so frontend can show it one by one
      res.write(`data: ${JSON.stringify({ type: 'enriched_item', index: i, item: enriched, total: dedupedData.length })}\n\n`);
      if (i % 3 === 0 || i === dedupedData.length - 1) {
        const pct = 45 + ((i + 1) / dedupedData.length) * 50;
        sendProgress('enrich', `正在获取海报和详细信息 (${i + 1}/${dedupedData.length})...`, Math.round(pct));
      }
    }

    sendProgress('complete', '分析完成！', 100);

    res.write(`data: ${JSON.stringify({ type: 'enriched_result', data: enrichedData, totalItems: enrichedData.length })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Enriched history error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: '获取数据失败: ' + error.message })}\n\n`);
    res.end();
  }
});

// ============ Analyze with SSE Progress (Two-phase: fast raw analysis, then enrich) ============

// Combined analysis: fetch both movies and shows, merge into one analysis
app.get('/api/analyze/combined', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (step, message, progress) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', step, message, progress })}\n\n`);
  };

  try {
    sendProgress('fetch', '正在获取电影和剧集观看记录...', 5);

    // Fetch both movies and shows
    const fetchAllPages = async (type) => {
      const firstResp = await traktApiCall(`/sync/history/${type}`, sessionId, { page: 1, limit: 1000, extended: 'full,images' });
      const totalPages = parseInt(firstResp.headers['x-pagination-page-count'] || '1');
      let allData = [...firstResp.data];
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          traktApiCall(`/sync/history/${type}`, sessionId, { page, limit: 1000, extended: 'full,images' })
            .then(resp => resp.data)
        );
      }
      const remaining = await Promise.all(pagePromises);
      remaining.forEach(d => { allData = [...allData, ...d]; });
      return allData;
    };

    const [movieData, showData] = await Promise.all([
      fetchAllPages('movies'),
      fetchAllPages('shows'),
    ]);

    sendProgress('fetch', `已获取 ${movieData.length} 条电影记录，${showData.length} 条剧集记录`, 20);

    // Deduplicate movies
    const movieDedup = new Map();
    for (const item of movieData) {
      const id = item.movie?.ids?.trakt;
      if (!id) continue;
      if (!movieDedup.has(id)) {
        movieDedup.set(id, { ...item, _watchCount: 1, _firstWatched: item.watched_at, _lastWatched: item.watched_at, _type: 'movies' });
      } else {
        const existing = movieDedup.get(id);
        existing._watchCount++;
        if (item.watched_at > existing._lastWatched) existing._lastWatched = item.watched_at;
      }
    }

    // Deduplicate shows
    const showDedup = new Map();
    for (const item of showData) {
      const id = item.show?.ids?.trakt;
      if (!id) continue;
      if (!showDedup.has(id)) {
        showDedup.set(id, { ...item, _watchCount: 1, _firstWatched: item.watched_at, _lastWatched: item.watched_at, _type: 'shows', _episodes: [] });
      } else {
        const existing = showDedup.get(id);
        existing._watchCount++;
        if (item.watched_at > existing._lastWatched) existing._lastWatched = item.watched_at;
      }
      // Collect episode info for shows
      if (item.episode) {
        const existing = showDedup.get(id);
        if (existing) existing._episodes.push(item.episode);
      }
    }

    // Compute season/episode progress for shows
    for (const item of showDedup.values()) {
      if (item._episodes && item._episodes.length > 0) {
        const seasons = [...new Set(item._episodes.map(e => e.season))].sort((a, b) => a - b);
        item._seasonRange = seasons.length > 0
          ? (seasons.length === 1 ? `S${seasons[0]}` : `S${seasons[0]}-S${seasons[seasons.length - 1]}`)
          : '';
        item._episodeCount = item._episodes.length;
      } else {
        item._seasonRange = '';
        item._episodeCount = 0;
      }
    }

    const dedupedMovies = Array.from(movieDedup.values());
    const dedupedShows = Array.from(showDedup.values());
    const allItems = [...dedupedMovies, ...dedupedShows];

    sendProgress('analyze', '正在快速分析...', 35);
    const rawAnalysis = analyzeCombinedData(dedupedMovies, dedupedShows, allItems);

    sendProgress('raw_result', `基础分析完成 (共 ${allItems.length} 部作品)，正在获取详细信息...`, 45);
    res.write(`data: ${JSON.stringify({ type: 'raw_result', data: rawAnalysis })}\n\n`);

    // Phase 2: Enrich all items
    sendProgress('enrich', `正在获取海报和详细信息 (0/${allItems.length})...`, 50);

    const enrichedAll = [];
    for (let i = 0; i < allItems.length; i++) {
      const enriched = await enrichMediaItem(allItems[i], allItems[i]._type);
      enrichedAll.push(enriched);
      if (i % 3 === 0 || i === allItems.length - 1) {
        const pct = 50 + ((i + 1) / allItems.length) * 45;
        sendProgress('enrich', `正在获取海报和详细信息 (${i + 1}/${allItems.length})...`, Math.round(pct));
      }
    }

    const enrichedAnalysis = analyzeCombinedData(
      enrichedAll.filter(i => i._type === 'movies'),
      enrichedAll.filter(i => i._type === 'shows'),
      enrichedAll
    );

    sendProgress('complete', '分析完成！', 100);
    res.write(`data: ${JSON.stringify({ type: 'enriched_result', data: enrichedAnalysis })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Combined analyze error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: '分析失败: ' + error.message })}\n\n`);
    res.end();
  }
});

app.get('/api/analyze/:type', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const { type } = req.params;
  if (!['movies', 'shows'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use movies or shows.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (step, message, progress) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', step, message, progress })}\n\n`);
  };

  try {
    sendProgress('fetch', '正在获取观看记录...', 5);

    const response = await traktApiCall(`/sync/history/${type}`, sessionId, { page: 1, limit: 1000, extended: 'full,images' });
    const totalPages = parseInt(response.headers['x-pagination-page-count'] || '1');
    let allData = [...response.data];

    sendProgress('fetch', `已获取第 1 页，共 ${totalPages} 页...`, 10);

    const pagePromises = [];
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(
        traktApiCall(`/sync/history/${type}`, sessionId, { page, limit: 1000, extended: 'full,images' })
          .then(resp => {
            sendProgress('fetch', `正在获取第 ${page}/${totalPages} 页...`, 10 + (page / totalPages) * 30);
            return resp;
          })
      );
    }
    const remainingResponses = await Promise.all(pagePromises);
    remainingResponses.forEach(resp => { allData = [...allData, ...resp.data]; });

    // Deduplicate: merge same movie/show entries, keep latest watch time
    const dedupMap = new Map();
    for (const item of allData) {
      const id = type === 'movies' ? item.movie?.ids?.trakt : item.show?.ids?.trakt;
      if (!id) continue;
      if (!dedupMap.has(id)) {
        dedupMap.set(id, { ...item, _watchCount: 1, _firstWatched: item.watched_at, _lastWatched: item.watched_at });
      } else {
        const existing = dedupMap.get(id);
        existing._watchCount = (existing._watchCount || 1) + 1;
        if (item.watched_at > existing._lastWatched) existing._lastWatched = item.watched_at;
        if (item.watched_at < existing._firstWatched) existing._firstWatched = item.watched_at;
      }
    }
    const dedupedData = Array.from(dedupMap.values());

    // Phase 1: Quick analysis with raw Trakt data (no enrich)
    sendProgress('analyze', '正在快速分析...', 40);
    const rawAnalysis = analyzeData(dedupedData, type);

    // Send raw analysis first (fast!)
    sendProgress('raw_result', `基础分析完成 (去重后 ${dedupedData.length} 部)，正在获取详细信息...`, 50);
    res.write(`data: ${JSON.stringify({ type: 'raw_result', data: rawAnalysis })}\n\n`);

    // Phase 2: Enrich with TMDB/Trakt media info (slow) - send each item as it's done
    sendProgress('enrich', `正在获取影视海报和详细信息 (0/${dedupedData.length})...`, 55);

    const enrichedData = [];
    for (let i = 0; i < dedupedData.length; i++) {
      const enriched = await enrichMediaItem(dedupedData[i], type);
      enrichedData.push(enriched);
      // Send each enriched item immediately so frontend can show it one by one
      res.write(`data: ${JSON.stringify({ type: 'enriched_item', index: i, item: enriched, total: dedupedData.length })}\n\n`);
      if (i % 3 === 0 || i === dedupedData.length - 1) {
        const pct = 55 + ((i + 1) / dedupedData.length) * 40;
        sendProgress('enrich', `正在获取影视海报和详细信息 (${i + 1}/${dedupedData.length})...`, Math.round(pct));
      }
    }

    // Re-analyze with enriched data
    const enrichedAnalysis = analyzeData(enrichedData, type);

    sendProgress('complete', '分析完成！', 100);
    res.write(`data: ${JSON.stringify({ type: 'enriched_result', data: enrichedAnalysis })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Analyze error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: '分析失败: ' + error.message })}\n\n`);
    res.end();
  }
});

// ============ Analysis Engine ============

function analyzeData(data, type) {
  const now = new Date();
  const analysis = {
    totalItems: data.length,
    uniqueItems: 0,
    byYear: {},
    byMonth: {},
    byDayOfWeek: {},
    byHour: {},
    topItems: [],
    recentActivity: [],
    longestStreak: { days: 0, start: null, end: null },
    totalRuntime: 0,
    averagePerMonth: 0,
    mostActiveDay: '',
    mostActiveHour: '',
    yearlyBreakdown: [],
    genreDistribution: [],
    ratingDistribution: { high: 0, medium: 0, low: 0 },
    averageRating: 0,
    topDirectors: [],
    topCast: [],
  };

  const uniqueIds = new Set();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const titleCount = {};
  const dates = [];
  const genreCount = {};
  const directorCount = {};
  const castCount = {};
  const castRoles = {};
  let totalRating = 0;
  let ratingCount = 0;

  data.forEach(item => {
    const watchedAt = new Date(item.watched_at || item.last_watched_at);
    const year = watchedAt.getFullYear();
    const month = watchedAt.getMonth();
    const dayOfWeek = watchedAt.getDay();
    const hour = watchedAt.getHours();

    const itemId = type === 'movies' ? item.movie?.ids?.trakt : item.show?.ids?.trakt;
    if (itemId) uniqueIds.add(itemId);

    if (!analysis.byYear[year]) analysis.byYear[year] = 0;
    analysis.byYear[year]++;

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!analysis.byMonth[monthKey]) analysis.byMonth[monthKey] = 0;
    analysis.byMonth[monthKey]++;

    if (!analysis.byDayOfWeek[dayOfWeek]) analysis.byDayOfWeek[dayOfWeek] = 0;
    analysis.byDayOfWeek[dayOfWeek]++;

    if (!analysis.byHour[hour]) analysis.byHour[hour] = 0;
    analysis.byHour[hour]++;

    dates.push(watchedAt);

    const title = type === 'movies' ? item.movie?.title : item.show?.title;
    if (title) {
      if (!titleCount[title]) titleCount[title] = { count: 0, item: item };
      titleCount[title].count++;
    }

    const enriched = item._enriched;
    if (enriched) {
      if (enriched.genres) {
        enriched.genres.forEach(g => {
          if (!genreCount[g]) genreCount[g] = 0;
          genreCount[g]++;
        });
      }
      const directors = enriched.directors || enriched.creators || [];
      directors.forEach(d => {
        if (!directorCount[d]) directorCount[d] = 0;
        directorCount[d]++;
      });
      if (enriched.cast) {
        enriched.cast.forEach(c => {
          const name = typeof c === 'string' ? c : c.name;
          const role = typeof c === 'object' ? c.character : null;
          if (name) {
            if (!castCount[name]) castCount[name] = 0;
            castCount[name]++;
            if (!castRoles[name]) castRoles[name] = [];
            const enrichedTitle = enriched.title_cn || title;
            if (!castRoles[name].find(r => r.title === enrichedTitle)) {
              castRoles[name].push({
                title: enrichedTitle,
                role: role,
                type: type,
              });
            }
          }
        });
      }
      if (enriched.vote_average) {
        totalRating += enriched.vote_average;
        ratingCount++;
        if (enriched.vote_average >= 7) analysis.ratingDistribution.high++;
        else if (enriched.vote_average >= 5) analysis.ratingDistribution.medium++;
        else analysis.ratingDistribution.low++;
      }
    }
  });

  analysis.uniqueItems = uniqueIds.size;

  analysis.topItems = Object.entries(titleCount)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([title, data]) => ({
      title,
      count: data.count,
      item: data.item,
      enriched: data.item._enriched || null,
    }));

  const maxDay = Object.entries(analysis.byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
  const maxHour = Object.entries(analysis.byHour).sort((a, b) => b[1] - a[1])[0];
  analysis.mostActiveDay = maxDay ? dayNames[parseInt(maxDay[0])] : '';
  analysis.mostActiveHour = maxHour ? `${maxHour[0]}:00` : '';

  if (dates.length > 0) {
    dates.sort((a, b) => a - b);
    let currentStreak = 1;
    let longestStreak = 1;
    let streakStart = dates[0];
    let longestStreakStart = dates[0];
    let longestStreakEnd = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          longestStreakEnd = dates[i];
          longestStreakStart = streakStart;
        }
      } else {
        currentStreak = 1;
        streakStart = dates[i];
      }
    }
    analysis.longestStreak = {
      days: longestStreak,
      start: longestStreakStart.toISOString().split('T')[0],
      end: longestStreakEnd.toISOString().split('T')[0],
    };
  }

  const monthsWithData = Object.keys(analysis.byMonth).length;
  analysis.averagePerMonth = monthsWithData > 0 ? Math.round(data.length / monthsWithData) : 0;

  analysis.yearlyBreakdown = Object.entries(analysis.byYear)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);

  analysis.recentActivity = data
    .sort((a, b) => new Date(b.watched_at || b.last_watched_at) - new Date(a.watched_at || a.last_watched_at))
    .slice(0, 15)
    .map(item => ({
      title: type === 'movies' ? item.movie?.title : item.show?.title,
      year: type === 'movies' ? item.movie?.year : item.show?.year,
      watchedAt: item.watched_at || item.last_watched_at,
      type: type,
      ids: type === 'movies' ? item.movie?.ids : item.show?.ids,
      enriched: item._enriched || null,
    }));

  analysis.genreDistribution = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  analysis.topDirectors = Object.entries(directorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  analysis.topCast = Object.entries(castCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      roles: (castRoles[name] || []).slice(0, 5),
    }));

  analysis.averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0;

  analysis.dayOfWeekData = dayNames.map((name, index) => ({
    day: name,
    count: analysis.byDayOfWeek[index] || 0,
  }));

  analysis.hourData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: analysis.byHour[i] || 0,
  }));

  analysis.monthData = Object.entries(analysis.byMonth)
    .map(([key, count]) => {
      const [year, month] = key.split('-');
      return {
        month: `${year}年${monthNames[parseInt(month) - 1]}`,
        count,
        timestamp: new Date(parseInt(year), parseInt(month) - 1).getTime(),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  return analysis;
}

// ============ Combined Analysis Engine ============

function analyzeCombinedData(movieData, showData, allItems) {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const analysis = {
    totalMovies: movieData.length,
    totalShows: showData.length,
    totalItems: allItems.length,
    totalEpisodes: 0, // 总剧集数（按集算）
    totalWatchMinutes: 0, // 总观看时长（分钟）
    uniqueMovies: 0,
    uniqueShows: 0,
    byYear: {},
    byMonth: {},
    byDayOfWeek: {},
    byHour: {},
    topItems: [],
    recentActivity: [],
    longestStreak: { days: 0, start: null, end: null },
    averagePerMonth: 0,
    mostActiveDay: '',
    mostActiveHour: '',
    yearlyBreakdown: [],
    genreDistribution: [],
    averageRating: 0,
    topDirectors: [],
    topCreators: [],
    topCast: [],
  };

  const movieIds = new Set();
  const showIds = new Set();
  const titleCount = {};
  const dates = [];
  const genreCount = {};
  const directorCount = {};
  const directorWorks = {}; // director name -> [{title, type}]
  const creatorCount = {};
  const creatorWorks = {}; // creator name -> [{title, type}]
  const castCount = {};
  const castRoles = {}; // actor name -> [{title, role, type}]
  let totalRating = 0;
  let ratingCount = 0;

  allItems.forEach(item => {
    const isMovie = item._type === 'movies';
    const watchedAt = new Date(item.watched_at || item.last_watched_at);
    const year = watchedAt.getFullYear();
    const month = watchedAt.getMonth();
    const dayOfWeek = watchedAt.getDay();
    const hour = watchedAt.getHours();

    const itemId = isMovie ? item.movie?.ids?.trakt : item.show?.ids?.trakt;
    if (itemId) {
      if (isMovie) movieIds.add(itemId);
      else showIds.add(itemId);
    }

    if (!analysis.byYear[year]) analysis.byYear[year] = 0;
    analysis.byYear[year]++;

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!analysis.byMonth[monthKey]) analysis.byMonth[monthKey] = 0;
    analysis.byMonth[monthKey]++;

    if (!analysis.byDayOfWeek[dayOfWeek]) analysis.byDayOfWeek[dayOfWeek] = 0;
    analysis.byDayOfWeek[dayOfWeek]++;

    if (!analysis.byHour[hour]) analysis.byHour[hour] = 0;
    analysis.byHour[hour]++;

    dates.push(watchedAt);

    const title = isMovie ? item.movie?.title : item.show?.title;
    if (title) {
      if (!titleCount[title]) titleCount[title] = { count: 0, item: item };
      titleCount[title].count++;
    }

    // Calculate total episodes (for shows, use _episodeCount)
    if (!isMovie && item._episodeCount) {
      analysis.totalEpisodes += item._episodeCount;
    }

    // Calculate total watch minutes
    const enriched = item._enriched;
    if (enriched) {
      if (isMovie && enriched.runtime) {
        // Movie: runtime per watch
        analysis.totalWatchMinutes += enriched.runtime * (item._watchCount || 1);
      } else if (!isMovie && enriched.runtime && item._episodeCount) {
        // Show: runtime per episode × episode count
        analysis.totalWatchMinutes += enriched.runtime * item._episodeCount;
      }
      if (enriched.genres) {
        enriched.genres.forEach(g => {
          if (!genreCount[g]) genreCount[g] = 0;
          genreCount[g]++;
        });
      }
      if (enriched.directors) {
        enriched.directors.forEach(d => {
          if (!directorCount[d]) directorCount[d] = 0;
          directorCount[d]++;
          if (!directorWorks[d]) directorWorks[d] = [];
          const enrichedTitle = enriched.title_cn || title;
          if (!directorWorks[d].find(w => w.title === enrichedTitle)) {
            directorWorks[d].push({ title: enrichedTitle, type: isMovie ? 'movies' : 'shows' });
          }
        });
      }
      if (enriched.creators) {
        enriched.creators.forEach(c => {
          if (!creatorCount[c]) creatorCount[c] = 0;
          creatorCount[c]++;
          if (!creatorWorks[c]) creatorWorks[c] = [];
          const enrichedTitle = enriched.title_cn || title;
          if (!creatorWorks[c].find(w => w.title === enrichedTitle)) {
            creatorWorks[c].push({ title: enrichedTitle, type: 'shows' });
          }
        });
      }
      if (enriched.cast) {
        enriched.cast.forEach(c => {
          const name = typeof c === 'string' ? c : c.name;
          const role = typeof c === 'object' ? c.character : null;
          if (name) {
            if (!castCount[name]) castCount[name] = 0;
            castCount[name]++;
            // 记录角色信息
            if (!castRoles[name]) castRoles[name] = [];
            const enrichedTitle = enriched.title_cn || title;
            if (!castRoles[name].find(r => r.title === enrichedTitle)) {
              castRoles[name].push({
                title: enrichedTitle,
                role: role,
                type: isMovie ? 'movies' : 'shows',
              });
            }
          }
        });
      }
      if (enriched.vote_average) {
        totalRating += enriched.vote_average;
        ratingCount++;
      }
    }
  });

  analysis.uniqueMovies = movieIds.size;
  analysis.uniqueShows = showIds.size;

  analysis.topItems = Object.entries(titleCount)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([title, data]) => ({
      title,
      count: data.count,
      item: data.item,
      enriched: data.item._enriched || null,
      type: data.item._type,
    }));

  const maxDay = Object.entries(analysis.byDayOfWeek).sort((a, b) => b[1] - a[1])[0];
  const maxHour = Object.entries(analysis.byHour).sort((a, b) => b[1] - a[1])[0];
  analysis.mostActiveDay = maxDay ? dayNames[parseInt(maxDay[0])] : '';
  analysis.mostActiveHour = maxHour ? `${maxHour[0]}:00` : '';

  if (dates.length > 0) {
    dates.sort((a, b) => a - b);
    let currentStreak = 1;
    let longestStreak = 1;
    let streakStart = dates[0];
    let longestStreakStart = dates[0];
    let longestStreakEnd = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
          longestStreakEnd = dates[i];
          longestStreakStart = streakStart;
        }
      } else {
        currentStreak = 1;
        streakStart = dates[i];
      }
    }
    analysis.longestStreak = {
      days: longestStreak,
      start: longestStreakStart.toISOString().split('T')[0],
      end: longestStreakEnd.toISOString().split('T')[0],
    };
  }

  const monthsWithData = Object.keys(analysis.byMonth).length;
  analysis.averagePerMonth = monthsWithData > 0 ? Math.round(allItems.length / monthsWithData) : 0;

  analysis.yearlyBreakdown = Object.entries(analysis.byYear)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year);

  analysis.recentActivity = allItems
    .sort((a, b) => new Date(b.watched_at || b.last_watched_at) - new Date(a.watched_at || a.last_watched_at))
    .slice(0, 15)
    .map(item => ({
      title: item._type === 'movies' ? item.movie?.title : item.show?.title,
      year: item._type === 'movies' ? item.movie?.year : item.show?.year,
      watchedAt: item.watched_at || item.last_watched_at,
      type: item._type,
      ids: item._type === 'movies' ? item.movie?.ids : item.show?.ids,
      enriched: item._enriched || null,
    }));

  analysis.genreDistribution = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  analysis.topDirectors = Object.entries(directorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      watchedCount: count,
      works: (directorWorks[name] || []).slice(0, 10).map(w => ({ ...w, watched: true })),
    }));

  analysis.topCreators = Object.entries(creatorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      watchedCount: count,
      works: (creatorWorks[name] || []).slice(0, 10).map(w => ({ ...w, watched: true })),
    }));

  analysis.topCast = Object.entries(castCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      watchedCount: count,
      roles: (castRoles[name] || []).slice(0, 10).map(r => ({ ...r, watched: true })),
    }));

  analysis.averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0;

  analysis.dayOfWeekData = dayNames.map((name, index) => ({
    day: name,
    count: analysis.byDayOfWeek[index] || 0,
  }));

  analysis.hourData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: analysis.byHour[i] || 0,
  }));

  analysis.monthData = Object.entries(analysis.byMonth)
    .map(([key, count]) => {
      const [year, month] = key.split('-');
      return {
        month: `${year}年${monthNames[parseInt(month) - 1]}`,
        count,
        timestamp: new Date(parseInt(year), parseInt(month) - 1).getTime(),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  return analysis;
}

// ============ TMDB Person Search (for avatars) ============

app.get('/api/person/:name', async (req, res) => {
  if (!TMDB_API_KEY) return res.json(null);
  try {
    const searchRes = await axios.get(`${TMDB_API_URL}/search/person`, {
      params: { api_key: TMDB_API_KEY, query: req.params.name, language: 'zh-CN', page: 1 },
      timeout: 4000,
    });
    const results = searchRes.data.results || [];
    if (results.length > 0) {
      const person = results[0];
      res.json({
        id: person.id,
        name: person.name,
        known_for_department: person.known_for_department,
        profile_path: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    res.json(null);
  }
});

// 获取人物的所有作品（TMDB combined_credits），与用户历史对比标记哪些看过
app.get('/api/person/:name/credits', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!TMDB_API_KEY) return res.json(null);
  try {
    // 1. 搜索人物获取 TMDB ID
    const searchRes = await axios.get(`${TMDB_API_URL}/search/person`, {
      params: { api_key: TMDB_API_KEY, query: req.params.name, language: 'zh-CN', page: 1 },
      timeout: 4000,
    });
    const results = searchRes.data.results || [];
    if (results.length === 0) return res.json(null);
    const person = results[0];

    // 2. 获取该人物的所有作品
    const creditsRes = await axios.get(`${TMDB_API_URL}/person/${person.id}/combined_credits`, {
      params: { api_key: TMDB_API_KEY, language: 'zh-CN' },
      timeout: 6000,
    });
    const credits = creditsRes.data;

    // 3. 获取用户历史（用于标记哪些看过）
    let watchedSet = new Set();
    if (sessionId) {
      try {
        const session = tokenStore.get(sessionId);
        if (session?.accessToken) {
          const [movieHistory, showHistory] = await Promise.all([
            traktApiCall('/sync/history/movies', sessionId, { page: 1, limit: 1000 }),
            traktApiCall('/sync/history/shows', sessionId, { page: 1, limit: 1000 }),
          ]);
          // 收集所有看过的 TMDB ID
          movieHistory.data.forEach(item => {
            if (item.movie?.ids?.tmdb) watchedSet.add(`movie_${item.movie.ids.tmdb}`);
          });
          showHistory.data.forEach(item => {
            if (item.show?.ids?.tmdb) watchedSet.add(`tv_${item.show.ids.tmdb}`);
          });
        }
      } catch (e) {
        // 如果获取历史失败，只返回未标记的作品
      }
    }

    // 4. 合并 cast 和 crew，去重
    const allCredits = [];
    const seen = new Set();

    // 处理 cast
    (credits.cast || []).forEach(c => {
      const key = `${c.media_type}_${c.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const isWatched = watchedSet.has(key);
      allCredits.push({
        id: c.id,
        title: c.title || c.name,
        original_title: c.original_title || c.original_name,
        media_type: c.media_type, // 'movie' or 'tv'
        year: (c.release_date || c.first_air_date || '').split('-')[0],
        character: c.character,
        poster: c.poster_path ? `https://image.tmdb.org/t/p/w185${c.poster_path}` : null,
        watched: isWatched,
        department: 'cast',
      });
    });

    // 处理 crew
    (credits.crew || []).forEach(c => {
      const key = `${c.media_type}_${c.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const isWatched = watchedSet.has(key);
      allCredits.push({
        id: c.id,
        title: c.title || c.name,
        original_title: c.original_title || c.original_name,
        media_type: c.media_type,
        year: (c.release_date || c.first_air_date || '').split('-')[0],
        job: c.job,
        department: c.department,
        poster: c.poster_path ? `https://image.tmdb.org/t/p/w185${c.poster_path}` : null,
        watched: isWatched,
      });
    });

    // 按年份排序（最新的在前）
    allCredits.sort((a, b) => (b.year || '0').localeCompare(a.year || '0'));

    res.json({
      person: {
        id: person.id,
        name: person.name,
        known_for_department: person.known_for_department,
        profile_path: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      },
      totalWorks: allCredits.length,
      watchedCount: allCredits.filter(c => c.watched).length,
      credits: allCredits,
    });
  } catch (error) {
    console.error('Person credits error:', error.message);
    res.json(null);
  }
});

// ============ TMDB Upcoming / Trending ============

app.get('/api/upcoming', async (req, res) => {
  if (!TMDB_API_KEY) return res.json({ movies: [], shows: [] });
  try {
    const [movieRes, showRes] = await Promise.allSettled([
      axios.get(`${TMDB_API_URL}/movie/upcoming`, {
        params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE, page: 1, region: 'US' },
        timeout: 5000,
      }),
      axios.get(`${TMDB_API_URL}/tv/on_the_air`, {
        params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE, page: 1 },
        timeout: 5000,
      }),
    ]);

    const movies = movieRes.status === 'fulfilled'
      ? (movieRes.value.data.results || []).slice(0, 10).map(m => ({
          id: m.id,
          title: m.title,
          original_title: m.original_title,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
          backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
          release_date: m.release_date,
          overview: m.overview,
          vote_average: m.vote_average,
          genre_ids: m.genre_ids || [],
          type: 'movies',
        }))
      : [];

    const shows = showRes.status === 'fulfilled'
      ? (showRes.value.data.results || []).slice(0, 10).map(s => ({
          id: s.id,
          title: s.name,
          original_title: s.original_name,
          poster: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
          backdrop: s.backdrop_path ? `https://image.tmdb.org/t/p/w780${s.backdrop_path}` : null,
          first_air_date: s.first_air_date,
          overview: s.overview,
          vote_average: s.vote_average,
          genre_ids: s.genre_ids || [],
          type: 'shows',
        }))
      : [];

    res.json({ movies, shows });
  } catch (error) {
    console.error('Upcoming fetch error:', error.message);
    res.json({ movies: [], shows: [] });
  }
});

// 根据用户观看记录，查询 TMDB 获取追剧的下一集/最新季信息
app.get('/api/upcoming/tracking', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  if (!TMDB_API_KEY) return res.json([]);

  try {
    // 获取用户观看过的剧集历史
    const showHistory = await traktApiCall('/sync/history/shows', sessionId, { page: 1, limit: 1000, extended: 'full' });
    const totalPages = parseInt(showHistory.headers['x-pagination-page-count'] || '1');
    let allData = [...showHistory.data];
    for (let page = 2; page <= totalPages; page++) {
      const resp = await traktApiCall('/sync/history/shows', sessionId, { page, limit: 1000, extended: 'full' });
      allData = [...allData, ...resp.data];
    }

    // 去重，收集每个 show 的最新观看信息
    const showMap = new Map();
    for (const item of allData) {
      const id = item.show?.ids?.trakt;
      if (!id) continue;
      if (!showMap.has(id)) {
        showMap.set(id, {
          show: item.show,
          lastWatched: item.watched_at,
          lastEpisode: item.episode,
          _episodes: [item.episode],
        });
      } else {
        const existing = showMap.get(id);
        if (item.watched_at > existing.lastWatched) {
          existing.lastWatched = item.watched_at;
          existing.lastEpisode = item.episode;
        }
        existing._episodes.push(item.episode);
      }
    }

    // 对每个 show 查询 TMDB 获取最新季/下一集信息
    const trackedShows = [];
    const entries = Array.from(showMap.entries());

    for (const [traktId, data] of entries.slice(0, 30)) { // 最多查 30 个
      const tmdbId = data.show.ids?.tmdb;
      if (!tmdbId) continue;

      try {
        // 获取剧集详情（包含最新季、状态等）
        const detailRes = await axios.get(`${TMDB_API_URL}/tv/${tmdbId}`, {
          params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE },
          timeout: 4000,
        });
        const detail = detailRes.data;

        // 只关注还在播出的剧
        if (detail.status === 'Ended' || detail.status === 'Canceled') continue;

        // 获取最新一季的详情（包含下一集信息）
        const lastSeason = detail.last_episode_to_air;
        const nextEpisode = detail.next_episode_to_air;

        // 获取海报
        const poster = detail.poster_path
          ? `https://image.tmdb.org/t/p/w342${detail.poster_path}`
          : null;

        // 计算用户看到哪了
        const watchedSeasons = [...new Set(data._episodes.map(e => e.season))];
        const latestWatchedSeason = Math.max(...watchedSeasons);
        const latestWatchedEpisode = data.lastEpisode;

        // 判断是否有新一季即将播出
        // 如果没有 next_episode 但有 last_episode，且用户已看完最新季，可能是在等新一季
        const latestSeasonNum = detail.seasons
          ?.filter(s => s.season_number > 0 && s.air_date)
          ?.sort((a, b) => b.season_number - a.season_number)?.[0]?.season_number;

        trackedShows.push({
          id: detail.id,
          title: detail.name,
          original_title: detail.original_name,
          poster,
          overview: detail.overview,
          vote_average: detail.vote_average,
          status: detail.status,
          in_production: detail.in_production,
          last_air_date: detail.last_air_date,
          // 最新季号
          latest_season_number: latestSeasonNum,
          // 下一集信息
          next_episode: nextEpisode ? {
            name: nextEpisode.name,
            episode_number: nextEpisode.episode_number,
            season_number: nextEpisode.season_number,
            air_date: nextEpisode.air_date,
            overview: nextEpisode.overview,
            still: nextEpisode.still_path ? `https://image.tmdb.org/t/p/w300${nextEpisode.still_path}` : null,
          } : null,
          // 最新播出的一集
          last_episode: lastSeason ? {
            name: lastSeason.name,
            episode_number: lastSeason.episode_number,
            season_number: lastSeason.season_number,
            air_date: lastSeason.air_date,
          } : null,
          // 用户进度
          user_progress: {
            watched_seasons: watchedSeasons.length,
            total_seasons: detail.number_of_seasons,
            watched_episodes: data._episodes.length,
            total_episodes: detail.number_of_episodes,
            latest_watched: {
              season: latestWatchedEpisode?.season,
              episode: latestWatchedEpisode?.number,
              title: latestWatchedEpisode?.title,
            },
          },
          type: 'shows',
        });
      } catch (e) {
        // 单个剧集查询失败跳过
      }
    }

    // 按下一集播出时间排序（即将播出的在前）
    trackedShows.sort((a, b) => {
      const da = a.next_episode?.air_date ? new Date(a.next_episode.air_date) : new Date('9999');
      const db = b.next_episode?.air_date ? new Date(b.next_episode.air_date) : new Date('9999');
      return da - db;
    });

    res.json(trackedShows);
  } catch (error) {
    console.error('Tracking upcoming error:', error.message);
    res.json([]);
  }
});

// ============ Playback (继续观看) ============
// 获取用户未看完的播放进度
app.get('/api/playback', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const response = await traktApiCall('/sync/playback', sessionId, { limit: 100 });
    const playbackData = response.data || [];

    // 过滤出有进度的内容（progress > 0 且 < 100）
    const inProgress = playbackData.filter(item => {
      const progress = item.progress || 0;
      return progress > 0 && progress < 100;
    });

    // 对每个项目获取海报信息
    const enrichedPlayback = [];
    for (const item of inProgress.slice(0, 20)) {
      const isMovie = item.type === 'movie';
      const ids = isMovie ? item.movie?.ids : item.show?.ids;
      const title = isMovie ? item.movie?.title : item.show?.title;
      const year = isMovie ? item.movie?.year : item.show?.year;

      let poster = null;
      let backdrop = null;

      // 尝试从 TMDB 获取海报
      if (ids?.tmdb && TMDB_API_KEY) {
        try {
          const mediaType = isMovie ? 'movie' : 'tv';
          const detailRes = await axios.get(`${TMDB_API_URL}/${mediaType}/${ids.tmdb}`, {
            params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE },
            timeout: 3000,
          });
          const d = detailRes.data;
          poster = d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null;
          backdrop = d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : null;
        } catch (e) {}
      }

      // 回退到 Trakt 图片
      if (!poster && ids?.trakt) {
        poster = getTraktPosterUrl(ids.trakt, isMovie ? 'movies' : 'shows');
      }

      enrichedPlayback.push({
        id: ids?.trakt || ids?.tmdb,
        title,
        year,
        type: isMovie ? 'movie' : 'show',
        poster,
        backdrop,
        progress: Math.round(item.progress || 0),
        paused_at: item.paused_at,
        expires_at: item.expires_at,
        // 剧集信息
        episode: item.episode ? {
          season: item.episode.season,
          number: item.episode.number,
          title: item.episode.title,
        } : null,
        // 电影信息
        movie: isMovie ? {
          title: item.movie?.title,
          year: item.movie?.year,
        } : null,
        show: !isMovie ? {
          title: item.show?.title,
          year: item.show?.year,
        } : null,
      });
    }

    res.json(enrichedPlayback);
  } catch (error) {
    console.error('Playback error:', error.message);
    res.json([]);
  }
});

// ============ 推荐内容 ============
// 根据用户观看记录，从 TMDB 获取推荐（基于已看的高分作品）
app.get('/api/recommendations', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  if (!TMDB_API_KEY) return res.json([]);

  try {
    // 1. 获取用户已看过的电影和剧集历史（用于过滤和作为推荐种子）
    const [movieHistory, showHistory] = await Promise.all([
      traktApiCall('/sync/history/movies', sessionId, { limit: 1000, extended: 'full' }),
      traktApiCall('/sync/history/shows', sessionId, { limit: 1000, extended: 'full' }),
    ]);

    // 构建已看过的 TMDB ID 集合
    const watchedMovieIds = new Set();
    const watchedShowIds = new Set();
    (movieHistory.data || []).forEach(item => {
      if (item.movie?.ids?.tmdb) watchedMovieIds.add(item.movie.ids.tmdb);
    });
    (showHistory.data || []).forEach(item => {
      if (item.show?.ids?.tmdb) watchedShowIds.add(item.show.ids.tmdb);
    });

    // 2. 从已看作品中随机选一些高分作品作为推荐种子
    const seedMovies = (movieHistory.data || [])
      .filter(item => item.movie?.ids?.tmdb && item.movie?.rating && item.movie.rating >= 7)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const seedShows = (showHistory.data || [])
      .filter(item => item.show?.ids?.tmdb && item.show?.rating && item.show.rating >= 7)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // 3. 获取推荐
    const allRecommendations = [];

    for (const seed of seedMovies) {
      try {
        const res = await axios.get(`${TMDB_API_URL}/movie/${seed.movie.ids.tmdb}/recommendations`, {
          params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE, page: 1 },
          timeout: 4000,
        });
        (res.data.results || []).forEach(item => {
          if (!watchedMovieIds.has(item.id) && !allRecommendations.some(r => r.id === item.id && r.media_type === 'movie')) {
            allRecommendations.push({ ...item, media_type: 'movie' });
          }
        });
      } catch (e) {}
    }

    for (const seed of seedShows) {
      try {
        const res = await axios.get(`${TMDB_API_URL}/tv/${seed.show.ids.tmdb}/recommendations`, {
          params: { api_key: TMDB_API_KEY, language: TMDB_LANGUAGE, page: 1 },
          timeout: 4000,
        });
        (res.data.results || []).forEach(item => {
          if (!watchedShowIds.has(item.id) && !allRecommendations.some(r => r.id === item.id && r.media_type === 'tv')) {
            allRecommendations.push({ ...item, media_type: 'tv' });
          }
        });
      } catch (e) {}
    }

    // 4. 按评分排序，去重，取前 10
    const sorted = allRecommendations
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        title: item.title || item.name,
        overview: item.overview,
        poster: item.poster_path ? `${TMDB_IMG_URL}/w342${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `${TMDB_IMG_URL}/w780${item.backdrop_path}` : null,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        rating: item.vote_average ? item.vote_average.toFixed(1) : null,
        type: item.media_type === 'movie' ? 'movie' : 'show',
        genres: item.genre_ids || [],
      }));

    res.json(sorted);
  } catch (error) {
    console.error('Recommendations error:', error.message);
    res.json([]);
  }
});

// ============ Other Routes ============

app.get('/api/ratings', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const type = req.query.type || 'movies';
  try {
    const response = await traktApiCall(`/sync/ratings/${type}`, sessionId, { limit: 1000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

app.get('/api/watchlist/:type', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const { type } = req.params;
  try {
    const response = await traktApiCall(`/sync/watchlist/${type}`, sessionId, { limit: 1000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

app.get('/api/collection/:type', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(401).json({ error: 'Not authenticated' });
  const { type } = req.params;
  try {
    const response = await traktApiCall(`/sync/collection/${type}`, sessionId, { limit: 1000 });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// ============ Health Check ============

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(TRAKT_CLIENT_ID && TRAKT_CLIENT_SECRET),
    tmdb_configured: !!TMDB_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ============ Production Static Files (serve frontend build) ============

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log('📁 检测到前端构建文件，启用生产模式静态文件服务');
  // Serve static files from dist directory
  app.use(express.static(distPath));

  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res) => {
    // Don't catch API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('⚠️  未检测到前端构建文件 (dist/ 目录不存在)');
  console.log('   开发模式：请确保前端开发服务器已启动 (http://localhost:5173)');
  console.log('   生产模式：请先执行 npm run build 构建前端');
}

app.listen(PORT, () => {

  console.log(`🚀 Trakt Analyzer Server running on http://localhost:${PORT}`);
  if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
    console.warn('⚠️  TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET not configured!');
  }
  if (!TMDB_API_KEY) {
    console.log('ℹ️  TMDB_API_KEY not configured - using Trakt images and basic info');
    console.log('   To enable Chinese titles and richer info, set TMDB_API_KEY in .env');
  }
});
