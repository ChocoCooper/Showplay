$(document).ready(function() {
    // DOM Selectors
    const selectors = {
        videoPage: $('#videoPage'),
        videoFrame: $('#videoFrame'),
        videoMediaTitle: $('#videoMediaTitle'),
        watchlistBtn: $('#watchlistBtn'),
        downloadBtn: $('#downloadBtn'),
        backBtn: $('.back-btn'),
        selectorContainer: $('#selectorContainer'),
        seasonEpisodeSelector: $('#seasonEpisodeSelector'),
        seasonEpisodeAccordion: $('#seasonEpisodeAccordion'),
        serverGrid: $('#serverGrid'),
        mediaDetails: $('#mediaDetails'),
        mediaPoster: $('#mediaPoster'),
        mediaDetailsPoster: $('.media-details-poster'),
        mediaRatingBadge: $('#mediaRatingBadge'),
        mediaDetailsTitle: $('#mediaDetailsTitle'),
        mediaYearGenre: $('#mediaYearGenre'),
        mediaPlot: $('#mediaPlot'),
        homepage: $('#homepage'),
        previewSection: $('#previewSection'),
        previewItemsContainer: $('#previewItemsContainer'),
        moviesSlider: $('#moviesSliderContainer'),
        tvSlider: $('#tvSliderContainer'),
        animeSlider: $('#animeSliderContainer'),
        kdramaSlider: $('#kdramaSliderContainer'),
        cdramaSlider: $('#cdramaSliderContainer'),
        librarySection: $('#librarySection'),
        watchlistSlider: $('#watchlistSlider'),
        historySlider: $('#historySlider'),
        searchSection: $('#searchSection'),
        searchInput: $('#searchInput'),
        searchFilter: $('#searchFilter'),
        searchResults: $('#searchResults'),
        searchTrending: $('#searchTrending'),
        toast: $('#toastNotification'),
        sidebarNavItems: $('.sidebar-nav li')
    };

    const state = {
        mediaType: 'movie', mediaId: null, season: null, episode: null,
        previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
        previewInterval: null,
        watchlist: JSON.parse(localStorage.getItem('watchlist')) || [],
        history: JSON.parse(localStorage.getItem('history')) || [],
        previousSection: 'home',
        lastBreakpoint: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
        renderedSections: { preview: false, movies: false, tv: false, anime: false, kdrama: false, cdrama: false, search: false, library: false }
    };

    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [
            { name: 'Server 1', resolver: 'videasy' },
            { name: 'Server 2', resolver: 'vidlink' },
            { name: 'Server 3', resolver: 'hexa' },
            { name: 'Server 4', resolver: 'smashy' },
            { name: 'Server 5', resolver: 'xpass' },
            { name: 'Server 6', resolver: 'yflix' },
            { name: 'Server 7', resolver: 'madplay' },
            { name: 'Server 8', resolver: 'vixsrc' }
        ]
    };

    // ── Proxy-aware fetch ─────────────────────────────────────────────────────
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const NETLIFY_PROXY = '/.netlify/functions/proxy';

    const pFetch = async (url, opts, responseType) => {
        opts = opts || {};
        responseType = responseType || 'json';
        const payload = { url, method: opts.method || 'GET', headers: opts.headers || {} };
        if (opts.body !== undefined) payload.body = opts.body;

        for (const proxyUrl of [NETLIFY_PROXY, '/api/proxy']) {
            try {
                const r = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (r.status === 404) { console.warn('[pFetch] 404 at ' + proxyUrl); continue; }
                if (r.ok) {
                    const env = await r.json();
                    console.log('[pFetch] OK via ' + proxyUrl + ' -> upstream ' + env.status + ' for ' + url);
                    if (responseType === 'text') return env.text;
                    if (env.json !== null && env.json !== undefined) return env.json;
                    try { return JSON.parse(env.text); } catch(e) { return env.text; }
                }
                console.warn('[pFetch] HTTP ' + r.status + ' at ' + proxyUrl);
            } catch(e) { console.warn('[pFetch] error at ' + proxyUrl + ': ' + e.message); }
        }

        if (!opts.method || opts.method === 'GET') {
            for (const p of [['corsproxy.io','https://corsproxy.io/?url='],['allorigins','https://api.allorigins.win/raw?url=']]) {
                try {
                    console.log('[pFetch] trying ' + p[0] + ' for ' + url);
                    const r = await fetch(p[1] + encodeURIComponent(url));
                    if (r.ok) return responseType === 'text' ? r.text() : r.json();
                    console.warn('[pFetch] ' + p[0] + ' returned ' + r.status);
                } catch(e) { console.warn('[pFetch] ' + p[0] + ' error: ' + e.message); }
            }
        }
        throw new Error('pFetch: all proxies failed for ' + url);
    };

    // ── Stream Resolvers ──────────────────────────────────────────────────────

    async function resolveVideasy(p) {
        throw new Error('Videasy: API blocks proxy IPs. Use Server 2+.');
    }

    async function resolveVidlink(p) {
        const raw = await pFetch('https://enc-dec.app/api/enc-vidlink?text=' + p.tmdbId);
        console.log('[Vidlink] enc:', JSON.stringify(raw).slice(0,100));
        const encId = (raw && typeof raw === 'object')
            ? (raw.result || raw.encrypted || raw.data || Object.values(raw).find(function(v){ return typeof v === 'string' && v.length > 5; }))
            : raw;
        const path = p.mediaType === 'tv'
            ? 'https://vidlink.pro/api/b/tv/' + encId + '/' + p.season + '/' + p.episode
            : 'https://vidlink.pro/api/b/movie/' + encId;
        const data = await pFetch(path, { headers: { 'User-Agent': UA, Referer: 'https://vidlink.pro/' } });
        console.log('[Vidlink] response:', JSON.stringify(data).slice(0,200));
        const url = data && ((data.stream && (data.stream.playlist || data.stream.url)) || data.playlist || data.url);
        if (!url) throw new Error('Vidlink: no playlist. Got: ' + JSON.stringify(data).slice(0,150));
        return { url: url, type: 'hls' };
    }

    async function resolveHexa(p) {
        const arr = new Uint8Array(32); crypto.getRandomValues(arr);
        const key = Array.from(arr, function(b){ return b.toString(16).padStart(2,'0'); }).join('');
        const apiUrl = p.mediaType === 'tv'
            ? 'https://themoviedb.hexa.su/api/tmdb/tv/' + p.tmdbId + '/season/' + p.season + '/episode/' + p.episode + '/images'
            : 'https://themoviedb.hexa.su/api/tmdb/movie/' + p.tmdbId + '/images';
        const encrypted = await pFetch(apiUrl, { headers: { 'X-Api-Key': key } }, 'text');
        const dec = await pFetch('https://enc-dec.app/api/dec-hexa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: encrypted, key: key }) });
        console.log('[Hexa] dec:', JSON.stringify(dec).slice(0,250));
        const d = typeof dec === 'string' ? JSON.parse(dec) : dec;
        const sources = (d && (d.result && d.result.sources || d.sources || (d.data && d.data.sources))) || [];
        const url = sources[0] && (sources[0].url || sources[0].file);
        if (!url) throw new Error('Hexa: no url. Got: ' + JSON.stringify(d).slice(0,200));
        return { url: url, type: 'hls' };
    }

    async function resolveSmashy(p) {
        const raw = await pFetch('https://enc-dec.app/api/enc-vidstack');
        console.log('[Smashy] token raw:', JSON.stringify(raw).slice(0,200));
        const td = (raw && (raw.result || raw.data)) || raw;
        const token = td && td.token;
        const user_id = (td && td.user_id && td.user_id !== 'none') ? td.user_id : '1';
        if (!token) throw new Error('Smashy: no token. Got: ' + JSON.stringify(raw).slice(0,150));
        const path = p.mediaType === 'tv'
            ? 'https://api.smashystream.top/api/v1/videosmashyi/' + p.imdbId + '/' + p.tmdbId + '/' + p.season + '/' + p.episode + '?token=' + token + '&user_id=' + user_id
            : 'https://api.smashystream.top/api/v1/videosmashyi/' + p.imdbId + '?token=' + token + '&user_id=' + user_id;
        const data = await pFetch(path);
        console.log('[Smashy] api:', JSON.stringify(data).slice(0,200));
        const inner = (data && (data.result || data)) || {};
        if (!inner.data) throw new Error('Smashy: no data. Got: ' + JSON.stringify(data).slice(0,150));
        const parts = inner.data.split('/#');
        const enc2 = await pFetch(parts[0] + '/api/v1/video?id=' + parts[1], {}, 'text');
        const dec2 = await pFetch('https://enc-dec.app/api/dec-vidstack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: enc2, type: '1' }) });
        const sd = typeof dec2 === 'string' ? JSON.parse(dec2) : dec2;
        const si = (sd && (sd.result || sd)) || {};
        const url = si.source || si.url || (si.sources && si.sources[0] && si.sources[0].file);
        if (!url) throw new Error('Smashy: no source. Got: ' + JSON.stringify(sd).slice(0,150));
        return { url: url, type: 'hls' };
    }

    async function resolveXPass(p) {
        throw new Error('XPass: API endpoints unavailable (404).');
    }

    async function resolveYFlix(p) {
        throw new Error('YFlix: Cloudflare protection blocks server-side access.');
    }

    async function resolveMadPlay(p) {
        const apiUrl = p.mediaType === 'tv'
            ? 'https://api.madplay.site/api/rogflix?id=' + p.tmdbId + '&season=' + p.season + '&episode=' + p.episode + '&type=series'
            : 'https://api.madplay.site/api/rogflix?id=' + p.tmdbId + '&type=movie';
        try {
            const data = await pFetch(apiUrl, { headers: { 'User-Agent': UA } });
            console.log('[MadPlay] rogflix:', JSON.stringify(data).slice(0,200));
            if (Array.isArray(data) && data.length > 0) {
                const item = data.find(function(i){ return i && i.title === 'English'; }) || data[0];
                if (item && item.file && item.file.indexOf('raw.githubusercontent') === -1 && item.file.indexOf('github') === -1) {
                    return { url: item.file, type: 'hls' };
                }
            }
        } catch(e) { console.warn('[MadPlay] rogflix failed:', e.message); }
        const cdnUrl = p.mediaType === 'tv'
            ? 'https://cdn.madplay.site/api/hls/unknown/' + p.tmdbId + '/season_' + p.season + '/episode_' + p.episode + '/master.m3u8'
            : 'https://cdn.madplay.site/api/hls/unknown/' + p.tmdbId + '/master.m3u8';
        console.log('[MadPlay] CDN:', cdnUrl);
        return { url: cdnUrl, type: 'hls' };
    }

    async function resolveVixsrc(p) {
        const pageUrl = p.mediaType === 'tv'
            ? 'https://vixsrc.to/tv/' + p.tmdbId + '/' + p.season + '/' + p.episode
            : 'https://vixsrc.to/movie/' + p.tmdbId;
        const html = await pFetch(pageUrl, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9', Referer: 'https://vixsrc.to/' } }, 'text');
        console.log('[Vixsrc] html len:', html && html.length, 'first 400:', html && html.slice(0,400));
        if (!html || html.length < 500) throw new Error('Vixsrc: page too short');

        const tokenM   = html.match(/"token"\s*:\s*"([a-f0-9A-F]{10,})"/) || html.match(/'token'\s*:\s*'([a-f0-9A-F]{10,})'/);
        const expiresM = html.match(/"expires"\s*:\s*"?(\d{9,10})"?/)      || html.match(/'expires'\s*:\s*'?(\d{9,10})'?/);
        const vidM     = html.match(/\/playlist\/(\d+)/)
                      || html.match(/video_id["'\s:]+(\d+)/i)
                      || html.match(/videoId["'\s:]+(\d+)/i)
                      || html.match(/"id"\s*:\s*(\d{4,})/);

        console.log('[Vixsrc] token:', tokenM && tokenM[1] && tokenM[1].slice(0,20), 'expires:', expiresM && expiresM[1], 'videoId:', vidM && vidM[1]);
        if (!tokenM || !expiresM || !vidM) {
            console.log('[Vixsrc] html[400-1000]:', html && html.slice(400,1000));
            throw new Error('Vixsrc: missing token:' + !!tokenM + ' expires:' + !!expiresM + ' videoId:' + !!vidM);
        }
        const playlistUrl = 'https://vixsrc.to/playlist/' + vidM[1] + '?token=' + encodeURIComponent(tokenM[1]) + '&expires=' + encodeURIComponent(expiresM[1]) + '&h=1&lang=en';
        console.log('[Vixsrc] playlistUrl:', playlistUrl);
        return { url: playlistUrl, type: 'hls' };
    }

    const resolveStream = async function(name, params) {
        switch (name) {
            case 'videasy': return resolveVideasy(params);
            case 'vidlink': return resolveVidlink(params);
            case 'hexa':    return resolveHexa(params);
            case 'smashy':  return resolveSmashy(params);
            case 'xpass':   return resolveXPass(params);
            case 'yflix':   return resolveYFlix(params);
            case 'madplay': return resolveMadPlay(params);
            case 'vixsrc':  return resolveVixsrc(params);
            default: throw new Error('Unknown resolver: ' + name);
        }
    };

    // ── Utilities ─────────────────────────────────────────────────────────────
    const fetchWithRetry = async function(url, retries, delay) {
        retries = retries || 3; delay = delay || 500;
        for (let i = 0; i < retries; i++) {
            try { const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status); return await res.json(); }
            catch(e) { if (i === retries - 1) throw e; await new Promise(function(r){ setTimeout(r, delay * Math.pow(2, i)); }); }
        }
    };

    const getImageUrl = function(path, type) {
        type = type || 'poster';
        if (!path) return null;
        const mobile = window.matchMedia('(max-width: 767px)').matches;
        const size = type === 'backdrop' ? (mobile ? 'w1280' : 'original') : (mobile ? 'w185' : 'w500');
        return 'https://image.tmdb.org/t/p/' + size + (path.startsWith('/') ? path : '/' + path);
    };

    const loadImage = function(src, retries, delay) {
        retries = retries || 3; delay = delay || 500;
        return new Promise(function(resolve, reject) {
            let attempt = 0;
            const img = new Image();
            img.src = src;
            if (img.complete) { resolve(img); return; }
            const tryLoad = function() {
                img.onload = function(){ resolve(img); };
                img.onerror = function() {
                    if (attempt < retries - 1) { attempt++; setTimeout(tryLoad, delay * Math.pow(2, attempt)); }
                    else reject(new Error('Failed to load: ' + src));
                };
                img.src = src;
            };
            tryLoad();
        });
    };

    const mediaCache = {
        get: function(id, type) {
            const c = localStorage.getItem('mediaDetails_' + type + '_' + id);
            if (!c) return null;
            const e = JSON.parse(c);
            if (e.expires < Date.now()) { localStorage.removeItem('mediaDetails_' + type + '_' + id); return null; }
            return e.data;
        },
        set: function(id, type, data) {
            localStorage.setItem('mediaDetails_' + type + '_' + id, JSON.stringify({ data: data, timestamp: Date.now(), expires: Date.now() + 86400000 }));
        },
        clear: function(id, type) { localStorage.removeItem('mediaDetails_' + type + '_' + id); }
    };

    const observeElement = function(element, callback) {
        const obs = new IntersectionObserver(function(entries, obs) {
            entries.forEach(function(e) { if (e.isIntersecting) { callback(); obs.unobserve(e.target); } });
        }, { root: null, rootMargin: '100px', threshold: 0.1 });
        obs.observe(element[0]);
    };

    // ── Server Selector ───────────────────────────────────────────────────────
    const initializeServers = function() {
        selectors.serverGrid.empty();
        const select = $('<select class="server-select" id="serverSelect"></select>');
        select.append('<option value="" disabled selected>Select Server</option>');
        config.servers.forEach(function(s, i) { select.append($('<option>').val(i).text(s.name)); });
        select.on('change', function() {
            if (state.mediaId && (state.mediaType === 'movie' || (state.season && state.episode))) {
                embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
            }
        });
        selectors.serverGrid.append(select);
    };

    // ── Video Player ──────────────────────────────────────────────────────────
    const embedVideo = async function() {
        if (!state.mediaId) { console.error('[embedVideo] mediaId not set'); return; }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) { console.error('[embedVideo] season/episode not set'); return; }

        const serverIndex = parseInt($('#serverSelect').val());
        const server = config.servers[isNaN(serverIndex) ? 0 : serverIndex] || config.servers[0];
        console.log('[embedVideo] Starting - resolver:', server.resolver, 'mediaId:', state.mediaId, 'type:', state.mediaType);

        const wrapper = selectors.videoFrame.parent();
        selectors.videoFrame.hide();
        wrapper.find('.stream-loading, .stream-error').remove();
        wrapper.find('video.hls-player').each(function() { this.pause(); this.src = ''; }).remove();
        const loadingEl = $('<div class="stream-loading"><div class="stream-spinner"></div><p>Loading stream...</p></div>');
        wrapper.append(loadingEl);

        const params = {
            tmdbId: state.mediaId, mediaType: state.mediaType,
            title: selectors.videoPage.data('title') || '',
            year: selectors.videoPage.data('year') || '',
            season: state.season, episode: state.episode,
        };

        if (server.resolver === 'smashy') {
            try {
                const ext = await fetchWithRetry('https://api.themoviedb.org/3/' + state.mediaType + '/' + state.mediaId + '/external_ids?api_key=' + config.apiKey);
                params.imdbId = ext.imdb_id || '';
                console.log('[embedVideo] imdbId:', params.imdbId);
            } catch(e) { console.warn('[embedVideo] Could not fetch imdbId:', e.message); params.imdbId = ''; }
        }

        try {
            console.log('[embedVideo] Resolving stream with params:', params);
            const stream = await resolveStream(server.resolver, params);
            console.log('[embedVideo] Stream resolved:', stream.url);
            loadingEl.remove();

            const video = $('<video class="hls-player" controls playsinline></video>');
            wrapper.append(video);

            if (stream.type === 'hls' && typeof Hls !== 'undefined' && Hls.isSupported()) {
                console.log('[embedVideo] Using HLS.js with POST proxy loader');

                class ProxyLoader {
                    constructor(cfg) { this.config = cfg; this._aborted = false; }
                    destroy() { this._aborted = true; }
                    abort()   { this._aborted = true; }
                    load(context, cfg, callbacks) {
                        const origUrl = context.url;
                        const self = this;
                        console.log('[ProxyLoader] fetching:', origUrl.slice(0,80));
                        fetch(NETLIFY_PROXY, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: origUrl, method: 'GET' })
                        })
                        .then(function(r) { if (!r.ok) throw new Error('Proxy HTTP ' + r.status); return r.json(); })
                        .then(function(env) {
                            if (self._aborted) return;
                            const text = env.text || '';
                            const now = performance.now();
                            callbacks.onSuccess({ data: text, url: origUrl }, { trequest: now, tfirst: now, tload: now, loaded: text.length, total: text.length, retry: 0 }, context, null);
                        })
                        .catch(function(err) {
                            if (self._aborted) return;
                            console.error('[ProxyLoader] error:', err.message);
                            callbacks.onError({ code: 0, text: err.message }, context, null, {});
                        });
                    }
                }

                const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, loader: ProxyLoader });
                hls.on(Hls.Events.ERROR, function(event, data) {
                    console.error('[HLS.js] Error:', data.type, data.details, data.fatal);
                    if (data.fatal) {
                        loadingEl.remove();
                        wrapper.find('video.hls-player').remove();
                        wrapper.append($('<div class="stream-error"><i class="fas fa-exclamation-triangle"></i><p>HLS error: ' + data.details + '. Try another server.</p></div>'));
                    }
                });
                hls.loadSource(stream.url);
                hls.attachMedia(video[0]);
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    console.log('[HLS.js] Manifest parsed, playing');
                    video[0].play().catch(function(e){ console.warn('[HLS.js] Autoplay blocked:', e.message); });
                });
            } else if (video[0].canPlayType('application/vnd.apple.mpegurl')) {
                console.log('[embedVideo] Using native HLS');
                video[0].src = stream.url;
                video[0].play().catch(function(e){ console.warn('[embedVideo] Autoplay blocked:', e.message); });
            } else {
                video[0].src = stream.url;
                video[0].play().catch(function(e){ console.warn('[embedVideo] Autoplay blocked:', e.message); });
            }
        } catch(err) {
            console.error('[embedVideo] Stream resolve failed:', err.message, err);
            loadingEl.remove();
            wrapper.find('video.hls-player').remove();
            wrapper.append($('<div class="stream-error"><i class="fas fa-exclamation-triangle"></i><p>' + err.message + '</p></div>'));
        }
    };

    // ── Media Fetching ────────────────────────────────────────────────────────
    const fetchMedia = async function(type, isPreview) {
        isPreview = isPreview || false;
        const map = {
            movie:    ['https://api.themoviedb.org/3/trending/movie/week?api_key=' + config.apiKey, 'movie'],
            tv:       ['https://api.themoviedb.org/3/trending/tv/week?api_key=' + config.apiKey, 'tv'],
            anime:    ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_genres=16&sort_by=first_air_date.desc&with_original_language=ja&vote_average.gte=6&vote_count.gte=25&without_keywords=10121,9706,264386,280003,158718,281741', 'tv'],
            kdrama:   ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_original_language=ko&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=25', 'tv'],
            cdrama:   ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_original_language=zh&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=10&without_genres=16,10759,10765,10768&without_keywords=15060,248451,289844,12995,195013,184656,234890', 'tv'],
            trending: ['https://api.themoviedb.org/3/trending/all/day?api_key=' + config.apiKey, 'multi'],
        };
        if (!map[type]) return [];
        const url = map[type][0], mediaType = map[type][1];
        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(url + '&page=' + page);
                if (!data || !data.results) { console.error('No results for', type); return items; }
                let valid = data.results.filter(function(i){ return i.id && (i.title || i.name) && i.poster_path && i.vote_average; })
                    .map(function(i){ return Object.assign({}, i, { type: isPreview ? i.media_type : mediaType }); });
                if (isPreview) {
                    valid = valid.filter(function(m){ return m.backdrop_path; });
                    valid = await Promise.all(valid.map(async function(m) {
                        const mt = m.media_type === 'movie' ? 'movie' : 'tv';
                        const details = await fetchWithRetry('https://api.themoviedb.org/3/' + mt + '/' + m.id + '?api_key=' + config.apiKey);
                        const logo = await fetchWithRetry('https://api.themoviedb.org/3/' + mt + '/' + m.id + '/images?api_key=' + config.apiKey + '&include_image_language=en,null');
                        const lp = logo.logos && (logo.logos.find(function(l){ return l.file_path && l.iso_639_1 === 'en'; }) || logo.logos[0]);
                        const logoUrl = lp && lp.file_path;
                        return logoUrl ? Object.assign({}, m, { logo_path: 'https://image.tmdb.org/t/p/original' + logoUrl, genres: details.genres }) : null;
                    }));
                    valid = valid.filter(Boolean);
                }
                items = items.concat(valid);
                page++;
            }
            return items.slice(0, desiredCount);
        } catch(e) { console.error('Failed to load', type, e); return []; }
    };

    // ── Render Item ───────────────────────────────────────────────────────────
    const renderItem = async function(item, container, renderType, isLibrary) {
        renderType = renderType || 'slider'; isLibrary = isLibrary || false;
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = ((item.vote_average || item.rating || 0)).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath, 'poster');
        if (!imageUrl) return;

        if (renderType === 'preview') {
            const bdUrl = getImageUrl(item.backdrop_path, 'backdrop');
            if (!bdUrl) return;
            const mtype = item.media_type === 'movie' ? 'MOVIE' : 'TV';
            const genres = item.genres ? item.genres.slice(0,2).map(function(g){ return g.name.split(' ')[0]; }) : ['N/A'];
            const inWL = state.watchlist.some(function(w){ return w.id === item.id; });
            const el = $('<div class="preview-item" data-index="' + container.children().length + '">'
                + '<img class="preview-background loaded" src="' + bdUrl + '" alt="' + title + '">'
                + '<div class="preview-background-overlay"></div>'
                + '<div class="preview-overlay"></div>'
                + '<div class="preview-content">'
                + '<img class="preview-title" src="' + item.logo_path + '" alt="' + title + '">'
                + '<div class="preview-meta"><span class="media-type">' + mtype + ' \u2022 ' + genres.join(', ') + '</span><span class="rating"><i class="fas fa-star"></i>' + rating + '</span></div>'
                + '<p class="preview-description">' + (item.overview || 'No description available.') + '</p>'
                + '<div class="preview-buttons">'
                + '<button class="preview-btn play-btn"><i class="fa-solid fa-play"></i>  Watch</button>'
                + '<button class="preview-btn secondary add-btn"><i class="' + (inWL ? 'fa-solid fa-check' : 'fas fa-plus') + '"></i></button>'
                + '</div></div></div>');
            try { await loadImage(bdUrl); } catch(e) { el.remove(); return; }
            el.find('.play-btn').on('click', function(e) {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home', item.vote_average);
                if (item.media_type === 'movie') addToHistory({ id: item.id, type: 'movie', title: title, poster: posterPath, year: year, season: null, episode: null, rating: item.vote_average });
            });
            el.find('.add-btn').on('click', function() {
                toggleWatchlist({ id: item.id, type: item.media_type, title: title, poster: posterPath, rating: item.vote_average });
                const inWL2 = state.watchlist.some(function(w){ return w.id === item.id; });
                el.find('.add-btn i').attr('class', inWL2 ? 'fa-solid fa-check' : 'fas fa-plus');
            });
            container.append(el);
        } else {
            const seLabel = isLibrary && item.season && item.episode ? '<span class="absolute bottom-2 left-2 !bg-[#2af598] !text-black text-[10px] font-bold px-2 py-1 rounded-md z-20 shadow-lg">S' + item.season + ' E' + item.episode + '</span>' : '';
            const delBadge = isLibrary ? '<span class="delete-badge absolute top-2 left-2 !bg-[#2af598] hover:bg-green-400 !text-black w-7 h-7 flex items-center justify-center rounded-full z-30 transition-colors backdrop-blur-sm" aria-label="Delete"><i class="fas fa-trash text-xs"></i></span>' : '';
            const year2 = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
            const poster = $('<div class="poster-item group relative flex-shrink-0 w-[90px] md:w-[160px] h-[135px] md:h-[240px] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)] bg-[#1a1a1a]">'
                + '<span class="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 z-20"><i class="fas fa-star text-yellow-400"></i>' + rating + '</span>'
                + seLabel + delBadge
                + '<img class="poster-img w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:brightness-75" src="' + imageUrl + '" alt="' + title + '" role="button" aria-label="Play ' + title + '">'
                + '<div class="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-black/50 to-transparent z-10">'
                + '<h4 class="text-white font-bold text-sm leading-tight line-clamp-2 mb-1 drop-shadow-md">' + title + '</h4>'
                + '<p class="text-primary text-xs font-medium">' + year2 + '</p>'
                + '<button class="mt-3 w-full bg-white/20 hover:bg-primary hover:text-black text-white text-xs font-bold py-2 rounded-lg backdrop-blur-sm transition-colors duration-200"><i class="fa-solid fa-play mr-1"></i> Play</button>'
                + '</div></div>');
            try { await loadImage(imageUrl); poster.find('.poster-img').removeClass('opacity-0'); } catch(e) { poster.remove(); return; }
            poster.on('click', function() {
                const yr = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const sec = container.closest('.search-section').length ? 'search' : container.closest('.library-section').length ? 'library' : 'home';
                const mt = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer, #cdramaSliderContainer').length ? 'tv' : 'movie');
                navigateToMedia(item.id, mt, title, imageUrl, yr, item.season, item.episode, sec, item.rating);
                if (!isLibrary && mt === 'movie') addToHistory({ id: item.id, type: mt, title: title, poster: posterPath, year: yr, season: item.season || null, episode: item.episode || null, rating: item.vote_average });
            });
            if (isLibrary) {
                poster.find('.delete-badge').on('click', function() {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(function(i){ return !(i.id === item.id && i.type === item.type && i.season === item.season && i.episode === item.episode); });
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    state.renderedSections.library = false;
                    loadLibrary();
                });
            }
            container.append(poster);
        }
    };

    // ── Library ───────────────────────────────────────────────────────────────
    const addToHistory = function(item) {
        const key = item.id + '_' + item.type + '_' + (item.season || '') + '_' + (item.episode || '');
        state.history = state.history.filter(function(h){ return h.id + '_' + h.type + '_' + (h.season || '') + '_' + (h.episode || '') !== key; });
        state.history.unshift(Object.assign({}, item, { rating: item.rating || 'N/A', timestamp: Date.now() }));
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    let toastTimeout;
    const showToast = function(msg) {
        clearTimeout(toastTimeout);
        selectors.toast.text(msg).addClass('show');
        toastTimeout = setTimeout(function(){ selectors.toast.removeClass('show'); }, 3000);
    };

    const toggleWatchlist = function(item) {
        const inWL = state.watchlist.some(function(w){ return w.id === item.id; });
        if (!inWL) state.watchlist.push(Object.assign({}, item, { timestamp: Date.now() }));
        else state.watchlist = state.watchlist.filter(function(w){ return w.id !== item.id; });
        showToast(inWL ? 'Removed from Watchlist' : 'Added to Watchlist');
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
        loadLibrary();
    };

    const loadLibrary = async function() {
        state.renderedSections.library = false;
        selectors.watchlistSlider.empty().show();
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            const items = (await Promise.all(state.watchlist.map(function(i) {
                const url = getImageUrl(i.poster, 'poster');
                return url ? loadImage(url).then(function(){ return Object.assign({}, i, { imageUrl: url }); }).catch(function(){ return null; }) : Promise.resolve(null);
            }))).filter(Boolean);
            for (const i of items) await renderItem(i, selectors.watchlistSlider, 'slider', true);
        }
        selectors.historySlider.empty().show();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            const hmap = new Map();
            state.history.forEach(function(i) {
                const k = i.id + '_' + i.type;
                if (!hmap.has(k) || hmap.get(k).timestamp < i.timestamp) hmap.set(k, i);
            });
            const unique = Array.from(hmap.values()).sort(function(a,b){ return b.timestamp - a.timestamp; });
            const items = (await Promise.all(unique.map(function(i) {
                const url = getImageUrl(i.poster, 'poster');
                return url ? loadImage(url).then(function(){ return Object.assign({}, i, { imageUrl: url }); }).catch(function(){ return null; }) : Promise.resolve(null);
            }))).filter(Boolean);
            for (const i of items) await renderItem(i, selectors.historySlider, 'slider', true);
        }
        state.renderedSections.library = true;
    };

    // ── Season/Episode ────────────────────────────────────────────────────────
    const loadSeasonEpisodeAccordion = async function() {
        if (state.mediaType !== 'tv') { selectors.seasonEpisodeSelector.hide(); selectors.downloadBtn.attr('href', '#'); return; }
        selectors.seasonEpisodeSelector.show();
        selectors.seasonEpisodeAccordion.empty();
        selectors.downloadBtn.attr('href', '#');
        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/tv/' + state.mediaId + '?api_key=' + config.apiKey);
            const seasons = (data.seasons || []).filter(function(s){ return s.season_number > 0 && s.episode_count > 0; });
            if (!seasons.length) { selectors.seasonEpisodeAccordion.html('<p class="empty-message">No seasons available.</p>'); return; }
            for (const season of seasons) {
                const details = $('<details><summary>Season ' + season.season_number + '</summary><div class="episode-list"></div></details>');
                selectors.seasonEpisodeAccordion.append(details);
                const epList = details.find('.episode-list');
                const epData = await fetchWithRetry('https://api.themoviedb.org/3/tv/' + state.mediaId + '/season/' + season.season_number + '?api_key=' + config.apiKey);
                const eps = (epData.episodes || []).filter(function(e){ return e.episode_number > 0; });
                if (!eps.length) { epList.html('<p class="empty-message">No episodes available.</p>'); continue; }
                eps.forEach(function(ep) {
                    const btn = $('<button class="episode-btn" data-season="' + season.season_number + '" data-episode="' + ep.episode_number + '"><span>Episode ' + ep.episode_number + ': ' + (ep.name || 'Untitled') + '</span></button>');
                    btn.on('click', function() {
                        $('.episode-btn').removeClass('active');
                        btn.addClass('active');
                        if (!$('#serverSelect').val()) $('#serverSelect').val(0);
                        state.season = season.season_number;
                        state.episode = ep.episode_number;
                        embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
                        selectors.downloadBtn.attr('href', 'https://dl.vidsrc.vip/tv/' + state.mediaId + '/' + state.season + '/' + state.episode);
                        addToHistory({ id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode, rating: data.vote_average });
                    });
                    epList.append(btn);
                });
            }
            selectors.seasonEpisodeAccordion.find('summary').on('click', function() {
                selectors.seasonEpisodeAccordion.find('details').not($(this).parent()).removeAttr('open');
            });
        } catch(e) { console.error('Failed to load seasons/episodes', e); selectors.seasonEpisodeAccordion.html('<p class="empty-message">Failed to load seasons/episodes.</p>'); }
    };

    const resetVideoPlayerState = function() {
        state.mediaId = null; state.mediaType = 'movie'; state.season = null; state.episode = null;
        const wrapper = selectors.videoFrame.parent();
        wrapper.find('video.hls-player').each(function(){ this.pause(); this.src = ''; }).remove();
        wrapper.find('.stream-loading, .stream-error').remove();
        selectors.videoFrame.attr('src', '').hide();
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', '').attr('alt', '').removeClass('loaded');
        selectors.mediaRatingBadge.find('.rating-value').text('');
        selectors.mediaDetailsTitle.text('');
        selectors.mediaYearGenre.text('');
        selectors.mediaPlot.text('');
        selectors.seasonEpisodeSelector.hide();
        selectors.seasonEpisodeAccordion.empty();
        selectors.watchlistBtn.html('<i class="fas fa-plus"></i> <span>Watchlist</span>').removeClass('active');
        selectors.downloadBtn.attr('href', '#');
    };

    // ── Page Navigation ───────────────────────────────────────────────────────
    const loadHomepage = async function() {
        if (!selectors.moviesSlider.length) return;
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.show();
        selectors.moviesSlider.parent().show(); selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show(); selectors.kdramaSlider.parent().show(); selectors.cdramaSlider.parent().show();
        selectors.librarySection.hide(); selectors.searchSection.hide();
        ['moviesSliderContainer','tvSliderContainer','animeSliderContainer','kdramaSliderContainer','cdramaSliderContainer'].forEach(updateSliderArrows);

        const loadSection = async function(container, type, isPreview) {
            isPreview = isPreview || false;
            if (state.renderedSections[type] && !isPreview) { container.show(); return; }
            container.empty().show();
            const items = await fetchMedia(type, isPreview);
            for (const item of items) await renderItem(item, container, isPreview ? 'preview' : 'slider');
            if (!isPreview) { updateSliderArrows(container.attr('id')); state.renderedSections[type] = true; }
        };

        if (!state.renderedSections.preview) {
            observeElement(selectors.previewItemsContainer, function() {
                loadSection(selectors.previewItemsContainer, 'trending', true);
                state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
                selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
                startPreviewSlideshow();
            });
        } else {
            selectors.previewItemsContainer.show();
            state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
            startPreviewSlideshow();
        }
        observeElement(selectors.moviesSlider, function(){ loadSection(selectors.moviesSlider, 'movie'); });
        observeElement(selectors.tvSlider,     function(){ loadSection(selectors.tvSlider, 'tv'); });
        observeElement(selectors.animeSlider,  function(){ loadSection(selectors.animeSlider, 'anime'); });
        observeElement(selectors.kdramaSlider, function(){ loadSection(selectors.kdramaSlider, 'kdrama'); });
        observeElement(selectors.cdramaSlider, function(){ loadSection(selectors.cdramaSlider, 'cdrama'); });
    };

    const loadSearchSection = function() {
        if (!selectors.searchSection.length) return;
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide(); selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide(); selectors.kdramaSlider.parent().hide(); selectors.cdramaSlider.parent().hide();
        selectors.librarySection.hide(); selectors.searchSection.show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();
        if (!state.renderedSections.search) {
            selectors.searchResults.empty(); selectors.searchTrending.empty();
            observeElement(selectors.searchTrending, function() {
                const filter = selectors.searchFilter.val();
                (filter === 'movie' ? fetchMedia('movie') : fetchMedia('tv')).then(function(items){ items.forEach(function(i){ renderItem(i, selectors.searchTrending); }); });
            });
            state.renderedSections.search = true;
        } else { selectors.searchResults.show(); selectors.searchTrending.show(); }
    };

    const navigateToMedia = async function(id, type, title, poster, year, season, episode, section, rating) {
        season = season || null; episode = episode || null; section = section || null; rating = rating || 'N/A';
        const params = new URLSearchParams({ id: id, type: type, title: title, poster: poster, year: year, rating: rating, section: section || 'home' });
        if (season) params.set('season', season);
        if (episode) params.set('episode', episode);
        window.location.href = 'watch.html?' + params.toString();
    };

    const renderVideoPage = async function(id, type, title, poster, year, season, episode, section, rating) {
        stopPreviewSlideshow();
        resetVideoPlayerState();
        state.mediaId = id; state.mediaType = type; state.season = season; state.episode = episode;
        state.previousSection = section || state.previousSection;
        selectors.videoPage.data({ id: id, type: type, title: title, poster: poster, year: year });
        const inWL = state.watchlist.some(function(w){ return w.id === id; });
        selectors.watchlistBtn.html(inWL ? '<i class="fa-solid fa-check"></i> <span>Watchlist</span>' : '<i class="fas fa-plus"></i> <span>Watchlist</span>').toggleClass('active', inWL);
        selectors.downloadBtn.attr('href', type === 'movie' ? 'https://dl.vidsrc.vip/movie/' + id : '#');
        selectors.videoPage.show(); selectors.homepage.hide();
        selectors.videoMediaTitle.show().text(title + '\n(' + (year || 'N/A') + ')');
        selectors.selectorContainer.show(); selectors.mediaDetails.show();
        mediaCache.clear(id, type);

        const updateUI = function(data) {
            const genres = data.genres ? data.genres.slice(0,2).map(function(g){ return g.name.split(' ')[0]; }) : ['N/A'];
            const posterUrl = getImageUrl(data.poster_path) || poster;
            selectors.mediaPoster.attr('src', posterUrl).attr('alt', title + ' Poster').addClass('opacity-0');
            loadImage(posterUrl).then(function(){ selectors.mediaPoster.removeClass('opacity-0'); }).catch(function(){ selectors.mediaPoster.attr('src', ''); });
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average ? data.vote_average.toFixed(1) : rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 ' + genres.join(', '));
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        const cached = mediaCache.get(id, type);
        if (cached) { updateUI(cached); }
        else {
            selectors.mediaPoster.attr('src', poster || '').addClass('opacity-0');
            loadImage(poster).then(function(){ selectors.mediaPoster.removeClass('opacity-0'); }).catch(function(){});
            selectors.mediaRatingBadge.find('.rating-value').text(rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 N/A');
            selectors.mediaPlot.text('No description available.');
        }

        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/' + type + '/' + id + '?api_key=' + config.apiKey);
            mediaCache.set(id, type, data); updateUI(data);
        } catch(e) { console.error('Failed to fetch media details', e); }

        if (type === 'movie') {
            if (!$('#serverSelect').val()) $('#serverSelect').val(0);
            embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
        } else {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                $('.episode-btn[data-season="' + season + '"][data-episode="' + episode + '"]').addClass('active');
                if (!$('#serverSelect').val()) $('#serverSelect').val(0);
                embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
                selectors.downloadBtn.attr('href', 'https://dl.vidsrc.vip/tv/' + id + '/' + season + '/' + episode);
            }
        }
    };

    const navigateToSection = function(section) {
        if (section === 'home') window.location.href = 'index.html';
        else if (section === 'search') window.location.href = 'search.html';
        else if (section === 'library') window.location.href = 'library.html';
    };

    // ── Slider Controls ───────────────────────────────────────────────────────
    const updateSliderArrows = function(id) {
        const c = $('#' + id);
        if (!c.length) return;
        const sl = c.scrollLeft(), max = c[0].scrollWidth - c[0].clientWidth, w = c.parent();
        w.find('.slider-arrow.left').toggleClass('hidden-arrow', sl <= 10);
        w.find('.slider-arrow.right').toggleClass('hidden-arrow', sl >= max - 10);
    };

    window.scrollSlider = function(id, dir) {
        const c = $('#' + id), amt = c.width() * 0.8;
        c.animate({ scrollLeft: (dir === 'left' ? '-=' : '+=') + amt }, 300, function(){ updateSliderArrows(id); });
    };

    window.navigatePreview = function(dir) {
        stopPreviewSlideshow();
        const total = selectors.previewItemsContainer.children().length;
        state.previewIndex = dir === 'left' ? (state.previewIndex - 1 + total) % total : (state.previewIndex + 1) % total;
        selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        startPreviewSlideshow();
    };

    // ── Preview Slideshow ─────────────────────────────────────────────────────
    const setupPreviewTouch = function() {
        let startX = 0, isSwiping = false;
        selectors.previewSection.on('touchstart', function(e) { startX = e.originalEvent.touches[0].clientX; isSwiping = true; stopPreviewSlideshow(); });
        selectors.previewSection.on('touchmove', function(e) {
            if (!isSwiping) return;
            const diff = startX - e.originalEvent.touches[0].clientX;
            const total = selectors.previewItemsContainer.children().length;
            if (!total) { isSwiping = false; return; }
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100 + (diff / selectors.previewSection.width()) * 100) + '%)');
        });
        selectors.previewSection.on('touchend', function(e) {
            if (!isSwiping) return; isSwiping = false;
            const diff = startX - e.originalEvent.changedTouches[0].clientX;
            const total = selectors.previewItemsContainer.children().length;
            if (Math.abs(diff) > 50 && total > 0) {
                state.previewIndex = diff > 0 ? Math.min(state.previewIndex + 1, total - 1) : Math.max(state.previewIndex - 1, 0);
            }
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css({ transition: 'transform 0.5s ease', transform: 'translateX(' + (-state.previewIndex * 100) + '%)' });
            setTimeout(function() { selectors.previewItemsContainer.css('transition', ''); startPreviewSlideshow(); }, 500);
        });
    };

    const startPreviewSlideshow = function() {
        if (state.previewInterval || selectors.videoPage.is(':visible') || !selectors.previewSection.is(':visible') || !selectors.previewItemsContainer.children().length) return;
        state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
        selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        state.previewInterval = setInterval(function() {
            if (!selectors.previewSection.is(':visible')) { stopPreviewSlideshow(); return; }
            state.previewIndex = (state.previewIndex + 1) % selectors.previewItemsContainer.children().length;
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        }, 10000);
    };

    const stopPreviewSlideshow = function() { if (state.previewInterval) { clearInterval(state.previewInterval); state.previewInterval = null; } };
    const resumePreviewSlideshow = function() { if (!selectors.videoPage.is(':visible')) startPreviewSlideshow(); };

    // ── Event Handlers ────────────────────────────────────────────────────────
    selectors.watchlistBtn.on('click', function() {
        const d = selectors.videoPage.data();
        const rating = selectors.mediaRatingBadge.find('.rating-value').text() || '0';
        toggleWatchlist({ id: d.id, type: d.type, title: d.title, poster: d.poster, rating: parseFloat(rating), year: d.year });
        const inWL = state.watchlist.some(function(w){ return w.id === d.id; });
        selectors.watchlistBtn.html(inWL ? '<i class="fa-solid fa-check"></i> <span>Watchlist</span>' : '<i class="fas fa-plus"></i> <span>Watchlist</span>').toggleClass('active', inWL);
    });

    selectors.backBtn.on('click', function() { resetVideoPlayerState(); navigateToSection(state.previousSection); resumePreviewSlideshow(); });
    selectors.sidebarNavItems.on('click', function() { navigateToSection($(this).data('section')); });

    let searchTimeout = null;
    const performSearch = async function() {
        const query = selectors.searchInput.val().trim();
        if (query.length < 3) { selectors.searchResults.empty(); selectors.searchTrending.show(); return; }
        selectors.searchTrending.hide();
        const filter = selectors.searchFilter.val();
        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/search/multi?api_key=' + config.apiKey + '&query=' + encodeURIComponent(query) + '&page=1');
            const results = (data.results || []).filter(function(i){ return (i.media_type === filter || filter === 'all') && i.id && (i.title || i.name) && i.poster_path && i.vote_average; }).slice(0,20);
            selectors.searchResults.empty();
            if (!results.length) selectors.searchResults.html('<p class="text-center" style="color:#ccc;">No results found.</p>');
            else results.forEach(function(i){ renderItem(i, selectors.searchResults); });
        } catch(e) { console.error('Search failed', e); selectors.searchResults.html('<p class="text-center" style="color:#ccc;">Failed to load results.</p>'); }
    };

    selectors.searchInput.on('input', function() { clearTimeout(searchTimeout); searchTimeout = setTimeout(performSearch, 500); });
    selectors.searchFilter.on('change', function() { performSearch(); });

    $(window).on('popstate', function(e) {
        const s = e.originalEvent.state;
        if (s && s.id && s.type) navigateToMedia(s.id, s.type, s.title || 'Unknown', s.poster || '', s.year, s.season, s.episode, s.section, s.rating || 'N/A');
        else if (s && s.section) navigateToSection(s.section);
        else loadHomepage();
    });

    let resizeTimeout;
    $(window).on('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const mobile = window.matchMedia('(max-width: 767px)').matches;
            const bp = mobile ? 'mobile' : 'desktop';
            if (bp !== state.lastBreakpoint) {
                state.lastBreakpoint = bp;
                $('.poster-img.loaded, .preview-background.loaded').each(function() {
                    const src = $(this).attr('src');
                    if (src) $(this).attr('src', getImageUrl(src.split('/').pop(), $(this).hasClass('preview-background') ? 'backdrop' : 'poster'));
                });
            }
            ['moviesSliderContainer','tvSliderContainer','animeSliderContainer','kdramaSliderContainer','cdramaSliderContainer'].forEach(updateSliderArrows);
            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
            }
        }, 200);
    });

    // ── Initial Load ──────────────────────────────────────────────────────────
    const handleInitialLoad = async function() {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        if (path.includes('watch.html')) {
            const id = params.get('id'), type = params.get('type');
            if (id && type) {
                renderVideoPage(id, type,
                    params.get('title') || 'Unknown',
                    params.get('poster') || '',
                    params.get('year') || 'N/A',
                    params.get('season') ? parseInt(params.get('season')) : null,
                    params.get('episode') ? parseInt(params.get('episode')) : null,
                    params.get('section') || 'home',
                    params.get('rating') || 'N/A'
                );
            }
        } else if (path.includes('search.html')) {
            loadSearchSection();
        } else if (path.includes('library.html')) {
            selectors.homepage.show(); selectors.librarySection.show(); loadLibrary();
        } else {
            loadHomepage();
        }
    };

    $(document).on('keydown', function(e) {
        if (selectors.previewSection.is(':visible')) {
            if (e.key === 'ArrowLeft') navigatePreview('left');
            if (e.key === 'ArrowRight') navigatePreview('right');
        }
    });

    initializeServers();
    setupPreviewTouch();
    handleInitialLoad();
    $('.poster-slider').on('scroll', function() { updateSliderArrows($(this).attr('id')); });
});
