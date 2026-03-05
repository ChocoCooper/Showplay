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

    // Application State
    const state = {
        mediaType: 'movie',
        mediaId: null,
        season: null,
        episode: null,
        previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
        previewInterval: null,
        watchlist: JSON.parse(localStorage.getItem('watchlist')) || [],
        history: JSON.parse(localStorage.getItem('history')) || [],
        previousSection: 'home',
        lastBreakpoint: window.matchMedia("(max-width: 767px)").matches ? 'mobile' : 'desktop',
        renderedSections: {
            preview: false,
            movies: false,
            tv: false,
            anime: false,
            kdrama: false,
            cdrama: false,
            search: false,
            library: false
        }
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09', // Note: Should be moved to server-side for security
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

    // ─── Stream Scrapers ───────────────────────────────────────────────────────

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    async function resolveVideasy({ title, year, tmdbId, mediaType = 'movie', season, episode, server = 'myflixerzupcloud' }) {
        const qs = new URLSearchParams({ title, mediaType, year: String(year), tmdbId: String(tmdbId) });
        if (mediaType === 'tv') { qs.set('seasonId', String(season)); qs.set('episodeId', String(episode)); }
        const apiUrl = `https://api.videasy.net/${server}/sources-with-title?${qs}`;
        const encrypted = await fetch(apiUrl, { headers: { 'User-Agent': UA } }).then(r => r.text());
        const decrypted = await fetch('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encrypted, id: String(tmdbId) }),
        }).then(r => r.json());
        const data = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        const stream = (data.sources || [])[0];
        return { url: stream.url, headers: { origin: 'https://videasy.net', referer: 'https://videasy.net/' }, type: 'hls' };
    }

    async function resolveVidlink({ tmdbId, mediaType = 'movie', season, episode }) {
        const encryptedId = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`).then(r => r.json());
        const path = mediaType === 'tv'
            ? `https://vidlink.pro/api/b/tv/${encryptedId}/${season}/${episode}`
            : `https://vidlink.pro/api/b/movie/${encryptedId}`;
        const data = await fetch(path, { headers: { 'User-Agent': UA, Referer: 'https://vidlink.pro/' } }).then(r => r.json());
        return { url: data.stream.playlist, headers: { origin: 'https://vidlink.pro', referer: 'https://vidlink.pro/' }, type: 'hls' };
    }

    function randomHex(bytes) {
        const array = new Uint8Array(bytes);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    async function resolveHexa({ tmdbId, mediaType = 'movie', season, episode }) {
        const key = randomHex(32);
        const apiUrl = mediaType === 'tv'
            ? `https://themoviedb.hexa.su/api/tmdb/tv/${tmdbId}/season/${season}/episode/${episode}/images`
            : `https://themoviedb.hexa.su/api/tmdb/movie/${tmdbId}/images`;
        const encrypted = await fetch(apiUrl, { headers: { 'X-Api-Key': key } }).then(r => r.text());
        const decrypted = await fetch('https://enc-dec.app/api/dec-hexa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encrypted, key }),
        }).then(r => r.json());
        const data = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        return { url: data.sources[0].url, headers: {}, type: 'hls' };
    }

    async function resolveSmashy({ imdbId, tmdbId, mediaType = 'movie', season, episode }) {
        const token = await fetch('https://enc-dec.app/api/enc-vidstack').then(r => r.json());
        const server = 'videosmashyi';
        const path = mediaType === 'tv'
            ? `https://api.smashystream.top/api/v1/${server}/${imdbId}/${tmdbId}/${season}/${episode}?token=${token.token}&user_id=${token.user_id}`
            : `https://api.smashystream.top/api/v1/${server}/${imdbId}?token=${token.token}&user_id=${token.user_id}`;
        const data = await fetch(path).then(r => r.json());
        const [host, id] = data.data.split('/#');
        const encrypted = await fetch(`${host}/api/v1/video?id=${id}`).then(r => r.text());
        const decrypted = await fetch('https://enc-dec.app/api/dec-vidstack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encrypted, type: '1' }),
        }).then(r => r.json());
        const streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        return { url: streamData.source, headers: { referer: 'https://smashyplayer.top/' }, type: 'hls' };
    }

    async function resolveXPass({ tmdbId, mediaType = 'movie', season, episode }) {
        const apiUrl = mediaType === 'tv'
            ? `https://play.xpass.top/meg/tv/${tmdbId}/${season}/${episode}/playlist.json`
            : `https://play.xpass.top/feb/${tmdbId}/0/0/0/playlist.json`;
        const data = await fetch(apiUrl, { headers: { 'User-Agent': UA } }).then(r => r.json());
        const file = data?.playlist?.[0]?.sources?.find(s => s?.type === 'hls')?.file || data?.playlist?.[0]?.sources?.[0]?.file;
        if (!file) throw new Error('Missing playlist source');
        return { url: file, headers: { origin: 'https://play.xpass.top', referer: 'https://play.xpass.top/' }, type: 'hls' };
    }

    async function resolveYFlix({ tmdbId, mediaType = 'movie', season, episode }) {
        const findUrl = `https://enc-dec.app/db/flix/find?tmdb_id=${encodeURIComponent(String(tmdbId))}&type=${encodeURIComponent(String(mediaType))}`;
        const find = await fetch(findUrl).then(r => r.json());
        const contentId = find?.[0]?.info?.flix_id;
        if (!contentId) throw new Error('flix_id not found');
        const encrypt = async text => await fetch(`https://enc-dec.app/api/enc-movies-flix?text=${encodeURIComponent(String(text))}`).then(r => r.json());
        const decrypt = async text => await fetch('https://enc-dec.app/api/dec-movies-flix', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
        }).then(r => r.json());
        const encId = await encrypt(contentId);
        const episodesResp = await fetch(`https://solarmovie.fi/ajax/episodes/list?id=${encodeURIComponent(String(contentId))}&_=${encodeURIComponent(encId)}`).then(r => r.json());
        const episodesHtml = episodesResp?.result;
        if (!episodesHtml) throw new Error('Missing episodes html');
        const episodes = await fetch('https://enc-dec.app/api/parse-html', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: episodesHtml }),
        }).then(r => r.json());
        const episodesObj = typeof episodes === 'string' ? JSON.parse(episodes) : episodes;
        let eid = null;
        if (mediaType === 'tv') {
            eid = episodesObj?.[String(season)]?.[String(episode)]?.eid;
            if (!eid) throw new Error('Episode eid not found');
        }
        const encEid = eid ? await encrypt(eid) : null;
        const serversResp = await fetch(eid
            ? `https://solarmovie.fi/ajax/links/list?eid=${encodeURIComponent(String(eid))}&_=${encodeURIComponent(encEid)}`
            : `https://solarmovie.fi/ajax/links/list?eid=${encodeURIComponent(String(contentId))}&_=${encodeURIComponent(encId)}`
        ).then(r => r.json());
        const serversHtml = serversResp?.result;
        if (!serversHtml) throw new Error('Missing servers html');
        const serversParsed = await fetch('https://enc-dec.app/api/parse-html', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: serversHtml }),
        }).then(r => r.json());
        const serversObj = typeof serversParsed === 'string' ? JSON.parse(serversParsed) : serversParsed;
        const lid = serversObj?.default?.['1']?.lid || Object.values(serversObj || {}).flatMap(v => (v && typeof v === 'object' ? Object.values(v) : [])).find(x => x?.lid)?.lid;
        if (!lid) throw new Error('lid not found');
        const encLid = await encrypt(lid);
        const embedResp = await fetch(`https://solarmovie.fi/ajax/links/view?id=${encodeURIComponent(String(lid))}&_=${encodeURIComponent(encLid)}`).then(r => r.json());
        const encryptedEmbed = embedResp?.result;
        if (!encryptedEmbed) throw new Error('Missing encrypted embed');
        const embedDecrypted = await decrypt(encryptedEmbed);
        const embedData = typeof embedDecrypted === 'string' ? JSON.parse(embedDecrypted) : embedDecrypted;
        const embedUrl = embedData?.url;
        if (!embedUrl) throw new Error('Missing embed url');
        const mediaUrl = embedUrl.replace('/e/', '/media/');
        const resp = await fetch(mediaUrl).then(r => r.json());
        const encrypted = resp?.result;
        if (!encrypted) throw new Error('Missing encrypted result');
        const decrypted = await fetch('https://enc-dec.app/api/dec-rapid', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: encrypted, agent: UA }),
        }).then(r => r.json());
        const streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        const file = streamData?.sources?.[0]?.file;
        if (!file) throw new Error('Missing sources[0].file');
        return { url: file, headers: { origin: 'https://rapidshare.cc', referer: 'https://rapidshare.cc/' }, type: 'hls' };
    }

    async function resolveMadPlay({ tmdbId, mediaType = 'movie', season, episode }) {
        const url = mediaType === 'tv'
            ? `https://cdn.madplay.site/api/hls/unknown/${tmdbId}/season_${season}/episode_${episode}/master.m3u8`
            : `https://cdn.madplay.site/api/hls/unknown/${tmdbId}/master.m3u8`;
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return { url, headers: {}, type: 'hls' };
        const apiUrl = mediaType === 'tv'
            ? `https://api.madplay.site/api/rogflix?id=${tmdbId}&season=${season}&episode=${episode}&type=series`
            : `https://api.madplay.site/api/rogflix?id=${tmdbId}&type=movie`;
        const data = await fetch(apiUrl, { headers: { 'User-Agent': UA } }).then(r => r.json());
        if (Array.isArray(data) && data.length > 0) {
            const englishItem = data.find(item => item?.title === 'English');
            if (englishItem?.file) return { url: englishItem.file, headers: {}, type: 'hls' };
        }
        throw new Error('MadPlay: no sources found');
    }

    async function resolveVixsrc({ tmdbId, mediaType = 'movie', season, episode }) {
        const pageUrl = mediaType === 'tv'
            ? `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`
            : `https://vixsrc.to/movie/${tmdbId}`;
        const html = await fetch(pageUrl, { headers: { 'User-Agent': UA, Referer: 'https://vixsrc.to/' } }).then(r => r.text());
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const scripts = Array.from(doc.querySelectorAll('script'));
        const scriptTag = scripts.find(s => s.textContent && s.textContent.includes('window.masterPlaylist'));
        if (!scriptTag?.textContent) throw new Error('Script tag with window.masterPlaylist not found');
        const scriptContent = scriptTag.textContent;
        let videoId = null;
        const videoIdMatch = scriptContent.match(/window\.video\s*=\s*\{[^}]*id:\s*['"]([^'"]+)['"]/s);
        if (videoIdMatch) {
            videoId = videoIdMatch[1];
        } else {
            const masterPlaylistUrlMatch = scriptContent.match(/window\.masterPlaylist\s*=\s*\{[^}]*url:\s*['"]([^'"]+)['"]/s);
            if (masterPlaylistUrlMatch?.[1]) {
                const urlMatch = masterPlaylistUrlMatch[1].match(/\/playlist\/(\d+)/);
                if (urlMatch) videoId = urlMatch[1];
            }
        }
        if (!videoId) throw new Error('video_id not found');
        const tokenMatch = scriptContent.match(/masterPlaylist\s*=\s*\{[^}]*params:\s*\{[^}]*['"]token['"]:\s*['"]([^'"]+)['"]/s);
        if (!tokenMatch) throw new Error('token not found');
        const token = tokenMatch[1];
        const expiresMatch = scriptContent.match(/masterPlaylist\s*=\s*\{[^}]*params:\s*\{[^}]*['"]expires['"]:\s*['"]([^'"]+)['"]/s);
        if (!expiresMatch) throw new Error('expires not found');
        const expires = expiresMatch[1];
        const playlistUrl = `https://vixsrc.to/playlist/${videoId}?token=${encodeURIComponent(token)}&expires=${encodeURIComponent(expires)}&h=1&lang=en`;
        return { url: playlistUrl, headers: { 'User-Agent': UA, 'Referer': pageUrl, 'Origin': 'https://vixsrc.to' }, type: 'hls' };
    }

    // Resolve stream from a named resolver
    const resolveStream = async (resolverName, params) => {
        switch (resolverName) {
            case 'videasy': return resolveVideasy(params);
            case 'vidlink': return resolveVidlink(params);
            case 'hexa': return resolveHexa(params);
            case 'smashy': return resolveSmashy(params);
            case 'xpass': return resolveXPass(params);
            case 'yflix': return resolveYFlix(params);
            case 'madplay': return resolveMadPlay(params);
            case 'vixsrc': return resolveVixsrc(params);
            default: throw new Error(`Unknown resolver: ${resolverName}`);
        }
    };

    // Utility: Fetch with Retry
    const fetchWithRetry = async (url, retries = 3, delay = 500) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return await res.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    };

    // Utility: Get Image URL
    const getImageUrl = (path, type = 'poster') => {
        if (!path) return null;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const size = type === 'backdrop' ? (isMobile ? 'w1280' : 'original') : (isMobile ? 'w185' : 'w500');
        return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}`;
    };

    // Utility: Load Image with Retry
    const loadImage = (src, retries = 3, delay = 500) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const img = new Image();
            img.src = src;
            if (img.complete) {
                resolve(img);
                return;
            }
            const tryLoad = () => {
                img.onload = () => resolve(img);
                img.onerror = () => {
                    if (attempt < retries - 1) {
                        attempt++;
                        setTimeout(tryLoad, delay * Math.pow(2, attempt));
                    } else {
                        reject(new Error(`Failed to load image after ${retries} attempts: ${src}`));
                    }
                };
                img.src = src;
            };
            tryLoad();
        });
    };

    // Utility: Media Cache
    const mediaCache = {
        get(id, type) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;
            const cacheEntry = JSON.parse(cached);
            if (cacheEntry.expires < Date.now()) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            return cacheEntry.data;
        },
        set(id, type, data) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            const cacheEntry = {
                data,
                timestamp: Date.now(),
                expires: Date.now() + 24 * 60 * 60 * 1000
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        },
        clear(id, type) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            localStorage.removeItem(cacheKey);
        }
    };

    // Lazy Loading with IntersectionObserver
    const observeElement = (element, callback) => {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(entry.target);
                }
            });
        }, { root: null, rootMargin: '100px', threshold: 0.1 });
        observer.observe(element[0]);
    };

    // Initialize Servers
    const initializeServers = () => {
        selectors.serverGrid.empty();
        
        // Create Select Dropdown
        const select = $('<select class="server-select" id="serverSelect"></select>');
        select.append('<option value="" disabled selected>Select Server</option>');

        config.servers.forEach((server, i) => {
            const option = $(`<option value="${i}">${server.name}</option>`);
            select.append(option);
        });

        select.on('change', () => {
            if (state.mediaId && (state.mediaType === 'movie' || (state.season && state.episode))) {
                embedVideo().catch(e => console.error('embedVideo error:', e));
            }
        });
        selectors.serverGrid.append(select);
    };

    // Embed Video — uses stream scraper resolvers + HLS.js
    const embedVideo = async () => {
        if (!state.mediaId) {
            console.error('Cannot embed video: mediaId is not set');
            return;
        }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) {
            console.error('Cannot embed TV video: season or episode is not set');
            return;
        }

        const serverIndex = parseInt($('#serverSelect').val()) || 0;
        const server = config.servers[serverIndex] || config.servers[0];

        // Show loading state
        const wrapper = selectors.videoFrame.parent();
        selectors.videoFrame.hide();
        wrapper.find('.stream-loading').remove();
        wrapper.find('.stream-error').remove();
        const loadingEl = $('<div class="stream-loading"><div class="stream-spinner"></div><p>Loading stream…</p></div>');
        wrapper.append(loadingEl);

        const params = {
            tmdbId: state.mediaId,
            mediaType: state.mediaType,
            title: selectors.videoPage.data('title') || '',
            year: selectors.videoPage.data('year') || '',
            season: state.season,
            episode: state.episode,
        };

        // For smashy we also need imdbId — fetch it
        if (server.resolver === 'smashy') {
            try {
                const ext = await fetchWithRetry(`https://api.themoviedb.org/3/${state.mediaType}/${state.mediaId}/external_ids?api_key=${config.apiKey}`);
                params.imdbId = ext.imdb_id || '';
            } catch(e) { params.imdbId = ''; }
        }

        try {
            const stream = await resolveStream(server.resolver, params);
            loadingEl.remove();

            // Use a <video> element with HLS.js
            wrapper.find('video.hls-player').remove();
            const video = $('<video class="hls-player" controls playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;background:#000;border-radius:8px;"></video>');
            wrapper.append(video);

            if (stream.type === 'hls') {
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    const hls = new Hls({
                        xhrSetup: (xhr) => {
                            if (stream.headers?.referer) xhr.setRequestHeader('Referer', stream.headers.referer);
                        }
                    });
                    hls.loadSource(stream.url);
                    hls.attachMedia(video[0]);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => video[0].play().catch(() => {}));
                } else if (video[0].canPlayType('application/vnd.apple.mpegurl')) {
                    video[0].src = stream.url;
                    video[0].play().catch(() => {});
                } else {
                    throw new Error('HLS not supported in this browser');
                }
            } else {
                video[0].src = stream.url;
                video[0].play().catch(() => {});
            }
        } catch (err) {
            console.error('Stream resolve failed:', err);
            loadingEl.remove();
            wrapper.find('video.hls-player').remove();
            const errorEl = $(`<div class="stream-error"><i class="fas fa-exclamation-triangle"></i><p>Failed to load stream. Try another server.</p></div>`);
            wrapper.append(errorEl);
        }
    };

    // Fetch Media
    const fetchMedia = async (type, isPreview = false) => {
        let url, mediaType;
        if (type === 'movie') {
            url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${config.apiKey}`;
            mediaType = 'movie';
        } else if (type === 'tv') {
            url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${config.apiKey}`;
            mediaType = 'tv';
        } else if (type === 'anime') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_genres=16&sort_by=first_air_date.desc&with_original_language=ja&vote_average.gte=6&vote_count.gte=25&without_keywords=10121,9706,264386,280003,158718,281741`;
            mediaType = 'tv';
        } else if (type === 'kdrama') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=ko&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=25`;
            mediaType = 'tv';
        } else if (type === 'cdrama') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=zh&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=10&without_genres=16,10759,10765,10768&without_keywords=15060,248451,289844,12995,195013,184656,234890`;
            mediaType = 'tv';
        } else if (type === 'trending') {
            url = `https://api.themoviedb.org/3/trending/all/day?api_key=${config.apiKey}`;
            mediaType = 'multi';
        }
        if (!url) return [];

        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(`${url}&page=${page}`);
                if (!data?.results) {
                    console.error(`No results for ${type} on page ${page}`);
                    return items;
                }
                let validItems = data.results
                    .filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average)
                    .map(item => ({ ...item, type: isPreview ? item.media_type : mediaType }));
                
                if (isPreview) {
                    validItems = validItems.filter(m => m.backdrop_path);
                    validItems = await Promise.all(validItems.map(async m => {
                        const mediaType = m.media_type === 'movie' ? 'movie' : 'tv';
                        const details = await fetchWithRetry(`https://api.themoviedb.org/3/${mediaType}/${m.id}?api_key=${config.apiKey}`);
                        const logo = await fetchWithRetry(`https://api.themoviedb.org/3/${mediaType}/${m.id}/images?api_key=${config.apiKey}&include_image_language=en,null`);
                        const logoUrl = logo.logos?.find(l => l.file_path && l.iso_639_1 === 'en')?.file_path || logo.logos?.[0]?.file_path;
                        return logoUrl ? { ...m, logo_path: `https://image.tmdb.org/t/p/original${logoUrl}`, genres: details.genres } : null;
                    }));
                    validItems = validItems.filter(m => m);
                }
                items = items.concat(validItems);
                page++;
            }
            return items.slice(0, desiredCount);
        } catch (error) {
            console.error(`Failed to load ${type} content`, error);
            return [];
        }
    };

    // Render Item
    const renderItem = async (item, container, renderType = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = (item.vote_average || item.rating || 0).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath, 'poster');
        if (!imageUrl) return;

        const createElement = (html) => $(html);
        const attachClickHandler = (element, clickHandler) => {
            element.on('click', clickHandler);
            return element;
        };

        if (renderType === 'preview') {
            const backdropUrl = getImageUrl(item.backdrop_path, 'backdrop');
            if (!backdropUrl) return;

            const mediaType = item.media_type === 'movie' ? 'MOVIE' : 'TV';
            const genres = item.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            const isInWatchlist = state.watchlist.some(w => w.id === item.id);
            const previewItem = createElement(`
                <div class="preview-item" data-index="${container.children().length}">
                    <img class="preview-background loaded" src="${backdropUrl}" alt="${title}">
                    <div class="preview-background-overlay"></div>
                    <div class="preview-overlay"></div>
                    <div class="preview-content">
                        <img class="preview-title" src="${item.logo_path}" alt="${title}">
                        <div class="preview-meta">
                            <span class="media-type">${mediaType} • ${genres.join(', ')}</span>
                            <span class="rating"><i class="fas fa-star"></i>${rating}</span>
                        </div>
                        <p class="preview-description">${item.overview || 'No description available.'}</p>
                        <div class="preview-buttons">
                            <button class="preview-btn play-btn"><i class="fa-solid fa-play"></i>  Watch</button>
                            <button class="preview-btn secondary add-btn"><i class="${isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus'}"></i></button>
                        </div>
                    </div>
                </div>
            `);

            try {
                await loadImage(backdropUrl);
            } catch (error) {
                previewItem.remove();
                return;
            }

            attachClickHandler(previewItem.find('.play-btn'), e => {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home', item.vote_average);
                if (item.media_type === 'movie') {
                    addToHistory({ id: item.id, type: 'movie', title, poster: posterPath, year, season: null, episode: null, rating: item.vote_average });
                }
            });

            attachClickHandler(previewItem.find('.add-btn'), () => {
                toggleWatchlist({ id: item.id, type: item.media_type, title, poster: posterPath, rating: item.vote_average });
                const isInWatchlist = state.watchlist.some(w => w.id === item.id);
                previewItem.find('.add-btn i').attr('class', isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus');
            });

            container.append(previewItem);
        } else {
            const poster = createElement(`
                <div class="poster-item group relative flex-shrink-0 w-[90px] md:w-[160px] h-[135px] md:h-[240px] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)] bg-[#1a1a1a]">
                    <span class="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 z-20"><i class="fas fa-star text-yellow-400"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="absolute bottom-2 left-2 !bg-[#2af598] !text-black text-[10px] font-bold px-2 py-1 rounded-md z-20 shadow-lg">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge absolute top-2 left-2 !bg-[#2af598] hover:bg-green-400 !text-black w-7 h-7 flex items-center justify-center rounded-full z-30 transition-colors backdrop-blur-sm" aria-label="Delete"><i class="fas fa-trash text-xs"></i></span>` : ''}
                    <img class="poster-img w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:brightness-75" src="${imageUrl}" alt="${title}" role="button" aria-label="Play ${title}">
                    
                    <!-- Hover Overlay -->
                    <div class="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-black/50 to-transparent z-10">
                        <h4 class="text-white font-bold text-sm leading-tight line-clamp-2 mb-1 drop-shadow-md">${title}</h4>
                        <p class="text-primary text-xs font-medium">${(item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A'}</p>
                        <button class="mt-3 w-full bg-white/20 hover:bg-primary hover:text-black text-white text-xs font-bold py-2 rounded-lg backdrop-blur-sm transition-colors duration-200"><i class="fa-solid fa-play mr-1"></i> Play</button>
                    </div>
                </div>
            `);

            try {
                await loadImage(imageUrl);
                poster.find('.poster-img').removeClass('opacity-0');
            } catch (error) {
                poster.remove();
                return;
            }

            attachClickHandler(poster, () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : 
                               container.closest('.library-section').length ? 'library' : 'home';
                const mediaType = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer, #cdramaSliderContainer').length ? 'tv' : 'movie');
                navigateToMedia(item.id, mediaType, title, imageUrl, year, item.season, item.episode, section, item.rating);
                if (!isLibrary && mediaType === 'movie') {
                    addToHistory({ id: item.id, type: mediaType, title, poster: posterPath, year, season: item.season || null, episode: item.episode || null, rating: item.vote_average });
                }
            });

            if (isLibrary) {
                attachClickHandler(poster.find('.delete-badge'), () => {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(i => 
                        !(i.id === item.id && i.type === item.type && i.season === item.season && i.episode === item.episode)
                    );
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    state.renderedSections.library = false;
                    loadLibrary();
                });
            }

            container.append(poster);
        }
    };

    // Add to History
    const addToHistory = item => {
        const key = `${item.id}_${item.type}_${item.season || ''}_${item.episode || ''}`;
        state.history = state.history.filter(h => `${h.id}_${h.type}_${h.season || ''}_${h.episode || ''}` !== key);
        state.history.unshift({ ...item, rating: item.rating || 'N/A', timestamp: Date.now() });
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    // Show Toast Notification
    let toastTimeout;
    const showToast = (message) => {
        clearTimeout(toastTimeout);
        selectors.toast.text(message).addClass('show');
        toastTimeout = setTimeout(() => {
            selectors.toast.removeClass('show');
        }, 3000);
    };

    // Toggle Watchlist
    const toggleWatchlist = item => {
        const isInWatchlist = state.watchlist.some(w => w.id === item.id);
        if (!isInWatchlist) {
            state.watchlist.push({ ...item, timestamp: Date.now() });
        } else {
            state.watchlist = state.watchlist.filter(w => w.id !== item.id);
        }
        showToast(isInWatchlist ? 'Removed from Watchlist' : 'Added to Watchlist');
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
        loadLibrary();
    };

    // Load Library
    const loadLibrary = async () => {
        state.renderedSections.library = false;

        selectors.watchlistSlider.empty().show();
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            const watchlistItems = state.watchlist.map(item => ({ ...item, imageUrl: getImageUrl(item.poster, 'poster') }));
            const loadPromises = watchlistItems.map(item => 
                item.imageUrl ? loadImage(item.imageUrl).then(() => item).catch(() => null) : Promise.resolve(null)
            );
            const loadedItems = (await Promise.all(loadPromises)).filter(item => item);
            for (const item of loadedItems) {
                await renderItem(item, selectors.watchlistSlider, 'slider', true);
            }
        }

        selectors.historySlider.empty().show();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            const historyMap = new Map();
            for (const item of state.history) {
                const key = `${item.id}_${item.type}`;
                if (!historyMap.has(key) || historyMap.get(key).timestamp < item.timestamp) {
                    historyMap.set(key, item);
                }
            }
            const uniqueHistory = Array.from(historyMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            const historyItems = uniqueHistory.map(item => ({ ...item, imageUrl: getImageUrl(item.poster, 'poster') }));
            const loadPromises = historyItems.map(item => 
                item.imageUrl ? loadImage(item.imageUrl).then(() => item).catch(() => null) : Promise.resolve(null)
            );
            const loadedItems = (await Promise.all(loadPromises)).filter(item => item);
            for (const item of loadedItems) {
                await renderItem(item, selectors.historySlider, 'slider', true);
            }
        }

        state.renderedSections.library = true;
    };

    // Load Season and Episode Accordion
    const loadSeasonEpisodeAccordion = async () => {
        if (state.mediaType !== 'tv') {
            selectors.seasonEpisodeSelector.hide();
            selectors.downloadBtn.attr('href', '#');
            return;
        }

        selectors.seasonEpisodeSelector.show();
        selectors.seasonEpisodeAccordion.empty();
        selectors.downloadBtn.attr('href', '#');

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`);
            const seasons = data.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
            if (!seasons.length) {
                selectors.seasonEpisodeAccordion.html('<p class="empty-message">No seasons available.</p>');
                return;
            }

            for (const season of seasons) {
                const details = $(`
                    <details>
                        <summary>Season ${season.season_number}</summary>
                        <div class="episode-list"></div>
                    </details>
                `);
                selectors.seasonEpisodeAccordion.append(details);

                const episodeList = details.find('.episode-list');
                const epData = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season.season_number}?api_key=${config.apiKey}`);
                const episodes = epData.episodes?.filter(e => e.episode_number > 0) || [];

                if (!episodes.length) {
                    episodeList.html('<p class="empty-message">No episodes available.</p>');
                    continue;
                }

                episodes.forEach(ep => {
                    const btn = $(`
                        <button class="episode-btn" data-season="${season.season_number}" data-episode="${ep.episode_number}">
                            <span>Episode ${ep.episode_number}: ${ep.name || 'Untitled'}</span>
                        </button>
                    `);
                    btn.on('click', () => {
                        $('.episode-btn').removeClass('active');
                        btn.addClass('active');
                        if (!$('#serverSelect').val()) {
                            $('#serverSelect').val(0);
                        }
                        state.season = season.season_number;
                        state.episode = ep.episode_number;
                        embedVideo().catch(e => console.error('embedVideo error:', e));
                        selectors.downloadBtn.attr('href', `https://dl.vidsrc.vip/tv/${state.mediaId}/${state.season}/${state.episode}`);
                        addToHistory({ 
                            id: state.mediaId, 
                            type: state.mediaType, 
                            title: selectors.videoPage.data('title'), 
                            poster: selectors.videoPage.data('poster'), 
                            year: selectors.videoPage.data('year'), 
                            season: state.season, 
                            episode: state.episode,
                            rating: data.vote_average
                        });
                        window.history.replaceState(
                            { id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode, section: state.previousSection, rating: data.vote_average },
                            '',
                            `/tv/${state.mediaId}/${state.season}/${state.episode}`
                        );
                    });
                    episodeList.append(btn);
                });
            }

            selectors.seasonEpisodeAccordion.find('summary').on('click', function() {
                const parentDetails = $(this).parent('details');
                selectors.seasonEpisodeAccordion.find('details').not(parentDetails).removeAttr('open');
            });
        } catch (error) {
            console.error('Failed to load seasons/episodes', error);
            selectors.seasonEpisodeAccordion.html('<p class="empty-message">Failed to load seasons/episodes.</p>');
        }
    };

    // Reset Video Player State
    const resetVideoPlayerState = () => {
        state.mediaId = null;
        state.mediaType = 'movie';
        state.season = null;
        state.episode = null;
        // Clean up video player
        const wrapper = selectors.videoFrame.parent();
        wrapper.find('video.hls-player').each(function() { this.pause(); this.src = ''; }).remove();
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

    // Load Homepage
    const loadHomepage = async () => {
        if (!selectors.moviesSlider.length) return; // Exit if not on homepage
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.show();
        selectors.moviesSlider.parent().show();
        selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show();
        selectors.kdramaSlider.parent().show();
        selectors.cdramaSlider.parent().show();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        // Initialize arrow visibility
        ['moviesSliderContainer', 'tvSliderContainer', 'animeSliderContainer', 'kdramaSliderContainer', 'cdramaSliderContainer'].forEach(id => {
            updateSliderArrows(id);
        });

        const loadSection = async (container, type, isPreview = false) => {
            if (state.renderedSections[type] && !isPreview) {
                container.show();
                return;
            }
            container.empty().show();
            const items = await fetchMedia(type, isPreview);
            for (const item of items) {
                await renderItem(item, container, isPreview ? 'preview' : 'slider');
            }
            if (!isPreview) updateSliderArrows(container.attr('id'));
            if (!isPreview) state.renderedSections[type] = true;
        };

        if (!state.renderedSections.preview) {
            observeElement(selectors.previewItemsContainer, () => {
                loadSection(selectors.previewItemsContainer, 'trending', true);
                state.previewIndex = Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1);
                state.previewIndex = Math.max(state.previewIndex, 0);
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
                startPreviewSlideshow();
            });
        } else {
            selectors.previewItemsContainer.show();
            state.previewIndex = Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1);
            state.previewIndex = Math.max(state.previewIndex, 0);
            selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            startPreviewSlideshow();
        }

        observeElement(selectors.moviesSlider, () => loadSection(selectors.moviesSlider, 'movie'));
        observeElement(selectors.tvSlider, () => loadSection(selectors.tvSlider, 'tv'));
        observeElement(selectors.animeSlider, () => loadSection(selectors.animeSlider, 'anime'));
        observeElement(selectors.kdramaSlider, () => loadSection(selectors.kdramaSlider, 'kdrama'));
        observeElement(selectors.cdramaSlider, () => loadSection(selectors.cdramaSlider, 'cdrama'));
    };

    // Load Search Section
    const loadSearchSection = () => {
        if (!selectors.searchSection.length) return;
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.cdramaSlider.parent().hide();
        selectors.librarySection.hide();
        selectors.searchSection.show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();

        if (!state.renderedSections.search) {
            selectors.searchResults.empty();
            selectors.searchTrending.empty();
            observeElement(selectors.searchTrending, () => {
                const filter = selectors.searchFilter.val();
                const trending = filter === 'movie' ? fetchMedia('movie') : fetchMedia('tv');
                trending.then(items => items.forEach(item => renderItem(item, selectors.searchTrending)));
            });
            state.renderedSections.search = true;
        } else {
            selectors.searchResults.show();
            selectors.searchTrending.show();
        }
    };

    // Navigate to Media
    const navigateToMedia = async (id, type, title, poster, year, season = null, episode = null, section = null, rating = 'N/A') => {
        // Redirect to watch.html with query parameters
        const params = new URLSearchParams({
            id, type, title, poster, year, rating, section: section || 'home'
        });
        if (season) params.set('season', season);
        if (episode) params.set('episode', episode);
        window.location.href = `watch.html?${params.toString()}`;
    };

    // Render Video Page (Logic extracted from old navigateToMedia)
    const renderVideoPage = async (id, type, title, poster, year, season, episode, section, rating) => {
        stopPreviewSlideshow();
        resetVideoPlayerState();

        state.mediaId = id;
        state.mediaType = type;
        state.season = season;
        state.episode = episode;
        state.previousSection = section || state.previousSection;
        
        selectors.videoPage.data({ id, type, title, poster, year });

        const isInWatchlist = state.watchlist.some(w => w.id === id);
        if (isInWatchlist) {
            selectors.watchlistBtn.html('<i class="fa-solid fa-check"></i> <span>Watchlist</span>').addClass('active');
        } else {
            selectors.watchlistBtn.html('<i class="fas fa-plus"></i> <span>Watchlist</span>').removeClass('active');
        }
        
        selectors.downloadBtn.attr('href', type === 'movie' ? `https://dl.vidsrc.vip/movie/${id}` : '#');

        selectors.videoPage.show();
        selectors.homepage.hide();
        selectors.videoMediaTitle.show().text(`${title}\n(${year || 'N/A'})`);
        selectors.selectorContainer.show();
        selectors.mediaDetails.show();

        mediaCache.clear(id, type);

        const cachedData = mediaCache.get(id, type);
        const updateUI = (data) => {
            const genres = data.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            const posterUrl = getImageUrl(data.poster_path) || poster;
            selectors.mediaPoster.attr('src', posterUrl).attr('alt', `${title} Poster`).addClass('opacity-0');
            loadImage(posterUrl).then(() => {
                selectors.mediaPoster.removeClass('opacity-0');
            }).catch(() => {
                selectors.mediaPoster.attr('src', '').attr('alt', 'Poster unavailable');
            });
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average?.toFixed(1) || rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year || 'N/A'} • ${genres.join(', ')}`);
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        if (cachedData) {
            updateUI(cachedData);
        } else {
            selectors.mediaPoster.attr('src', poster || '').attr('alt', `${title} Poster`).addClass('opacity-0');
            loadImage(poster).then(() => {
                selectors.mediaPoster.removeClass('opacity-0');
            }).catch(() => {
                selectors.mediaPoster.attr('src', '').attr('alt', 'Poster unavailable');
            });
            selectors.mediaRatingBadge.find('.rating-value').text(rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year || 'N/A'} • N/A`);
            selectors.mediaPlot.text('No description available.');
        }

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`);
            mediaCache.set(id, type, data);
            updateUI(data);
        } catch (error) {
            console.error(`Failed to fetch media details for ${title} (ID: ${id}, Type: ${type})`, error);
            if (!cachedData) {
                selectors.mediaDetailsTitle.text('Error loading details');
                selectors.mediaYearGenre.text('');
                selectors.mediaPlot.html('Failed to load media details. <button class="retry-button">Retry</button>');
                $('.retry-button').on('click', () => navigateToMedia(id, type, title, poster, year, season, episode, section, rating));
            }
        }

        if (type === 'movie') {
            // Auto-select first server if none selected
            if (!$('#serverSelect').val()) $('#serverSelect').val(0);
            embedVideo().catch(e => console.error('embedVideo error:', e));
        } else {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                $(`.episode-btn[data-season="${season}"][data-episode="${episode}"]`).addClass('active');
                if (!$('#serverSelect').val()) $('#serverSelect').val(0);
                embedVideo().catch(e => console.error('embedVideo error:', e));
                selectors.downloadBtn.attr('href', `https://dl.vidsrc.vip/tv/${id}/${season}/${episode}`);
            }
        }
    };

    // Navigate to Section
    const navigateToSection = section => {
        if (section === 'home') {
            window.location.href = 'index.html';
        } else if (section === 'search') {
            window.location.href = 'search.html';
        } else if (section === 'library') {
            window.location.href = 'library.html';
        }
    };

    // Update Slider Arrows Visibility
    const updateSliderArrows = (id) => {
        const container = $(`#${id}`);
        if (!container.length) return;
        
        const scrollLeft = container.scrollLeft();
        const maxScroll = container[0].scrollWidth - container[0].clientWidth;
        const wrapper = container.parent();
        
        // Left Arrow
        if (scrollLeft <= 10) wrapper.find('.slider-arrow.left').addClass('hidden-arrow');
        else wrapper.find('.slider-arrow.left').removeClass('hidden-arrow');

        // Right Arrow
        if (scrollLeft >= maxScroll - 10) wrapper.find('.slider-arrow.right').addClass('hidden-arrow');
        else wrapper.find('.slider-arrow.right').removeClass('hidden-arrow');
    };

    // Slider Navigation
    window.scrollSlider = (id, direction) => {
        const container = $(`#${id}`);
        const scrollAmount = container.width() * 0.8;
        if (direction === 'left') {
            container.animate({ scrollLeft: '-=' + scrollAmount }, 300, () => updateSliderArrows(id));
        } else {
            container.animate({ scrollLeft: '+=' + scrollAmount }, 300, () => updateSliderArrows(id));
        }
    };

    window.navigatePreview = (direction) => {
        stopPreviewSlideshow();
        const total = selectors.previewItemsContainer.children().length;
        if (direction === 'left') {
            state.previewIndex = (state.previewIndex - 1 + total) % total;
        } else {
            state.previewIndex = (state.previewIndex + 1) % total;
        }
        selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
        startPreviewSlideshow();
    };

    // Setup Preview Touch
    const setupPreviewTouch = () => {
        let startX = 0;
        let isSwiping = false;
        selectors.previewSection.on('touchstart', e => {
            startX = e.originalEvent.touches[0].clientX;
            isSwiping = true;
            stopPreviewSlideshow();
        });
        selectors.previewSection.on('touchmove', e => {
            if (!isSwiping) return;
            const currentX = e.originalEvent.touches[0].clientX;
            const diff = startX - currentX;
            const totalItems = selectors.previewItemsContainer.children().length;
            if (totalItems <= 0) {
                isSwiping = false;
                return;
            }
            const translateX = -state.previewIndex * 100 + (diff / selectors.previewSection.width()) * 100;
            selectors.previewItemsContainer.css('transform', `translateX(${translateX}%)`);
        });
        selectors.previewSection.on('touchend', e => {
            if (!isSwiping) return;
            isSwiping = false;
            const endX = e.originalEvent.changedTouches[0].clientX;
            const diff = startX - endX;
            const totalItems = selectors.previewItemsContainer.children().length;
            if (Math.abs(diff) > 50 && totalItems > 0) {
                if (diff > 0) {
                    state.previewIndex = Math.min(state.previewIndex + 1, totalItems - 1);
                } else {
                    state.previewIndex = Math.max(state.previewIndex - 1, 0);
                }
            }
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transition', 'transform 0.5s ease');
            selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            setTimeout(() => {
                selectors.previewItemsContainer.css('transition', '');
                startPreviewSlideshow();
            }, 500);
        });
    };

    // Start Preview Slideshow
    const startPreviewSlideshow = () => {
        if (state.previewInterval || selectors.videoPage.is(':visible') || !selectors.previewSection.is(':visible') || selectors.previewItemsContainer.children().length === 0) return;
        state.previewIndex = Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1);
        state.previewIndex = Math.max(state.previewIndex, 0);
        selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
        state.previewInterval = setInterval(() => {
            if (!selectors.previewSection.is(':visible')) {
                stopPreviewSlideshow();
                return;
            }
            state.previewIndex = (state.previewIndex + 1) % selectors.previewItemsContainer.children().length;
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
        }, 10000);
    };

    // Stop Preview Slideshow
    const stopPreviewSlideshow = () => {
        if (state.previewInterval) {
            clearInterval(state.previewInterval);
            state.previewInterval = null;
        }
    };

    // Resume Preview Slideshow
    const resumePreviewSlideshow = () => {
        if (!selectors.videoPage.is(':visible')) {
            startPreviewSlideshow();
        }
    };

    // Event Handlers
    selectors.watchlistBtn.on('click', () => {
        const { id, type, title, poster, year } = selectors.videoPage.data();
        const rating = selectors.mediaRatingBadge.find('.rating-value').text() || '0';
        toggleWatchlist({ id, type, title, poster, rating: parseFloat(rating), year });
        const isInWatchlist = state.watchlist.some(w => w.id === id);
        if (isInWatchlist) {
            selectors.watchlistBtn.html('<i class="fa-solid fa-check"></i> <span>Watchlist</span>').addClass('active');
        } else {
            selectors.watchlistBtn.html('<i class="fas fa-plus"></i> <span>Watchlist</span>').removeClass('active');
        }
    });

    selectors.backBtn.on('click', () => {
        resetVideoPlayerState();
        navigateToSection(state.previousSection);
        resumePreviewSlideshow();
    });

    selectors.sidebarNavItems.on('click', function() { 
        navigateToSection($(this).data('section')); 
    });

    let searchTimeout = null;
    const performSearch = async () => {
        const query = selectors.searchInput.val().trim();
        if (query.length < 3) {
            selectors.searchResults.empty();
            selectors.searchTrending.show();
            return;
        }
        selectors.searchTrending.hide();
        const filter = selectors.searchFilter.val();
        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/search/multi?api_key=${config.apiKey}&query=${encodeURIComponent(query)}&page=1`);
            const results = data.results?.filter(item => 
                (item.media_type === filter || filter === 'all') &&
                item.id && (item.title || item.name) && item.poster_path && item.vote_average
            ).slice(0, 20) || [];
            selectors.searchResults.empty();
            if (!results.length) {
                selectors.searchResults.html('<p class="text-center" style="color: #ccc;">No results found.</p>');
            } else {
                results.forEach(item => renderItem(item, selectors.searchResults));
            }
        } catch (error) {
            console.error('Search failed', error);
            selectors.searchResults.html('<p class="text-center" style="color: #ccc;">Failed to load search results.</p>');
        }
    };

    selectors.searchInput.on('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 500);
    });

    selectors.searchFilter.on('change', () => {
        performSearch();
    });

    $(window).on('popstate', event => {
        const s = event.originalEvent.state;
        if (s && s.id && s.type) {
            navigateToMedia(s.id, s.type, s.title || 'Unknown', s.poster || '', s.year, s.season, s.episode, s.section, s.rating || 'N/A');
        } else if (s && s.section) {
            navigateToSection(s.section);
        } else {
            loadHomepage();
        }
    });

    let resizeTimeout;
    $(window).on('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isMobile = window.matchMedia("(max-width: 767px)").matches;
            const currentBreakpoint = isMobile ? 'mobile' : 'desktop';
            if (currentBreakpoint !== state.lastBreakpoint) {
                state.lastBreakpoint = currentBreakpoint;
                $('.poster-img.loaded, .preview-background.loaded').each(function() {
                    const src = $(this).attr('src');
                    if (src) {
                        const path = src.split('/').pop();
                        const type = $(this).hasClass('preview-background') ? 'backdrop' : 'poster';
                        $(this).attr('src', getImageUrl(path, type));
                    }
                });
            }
            // Update arrows on resize
            ['moviesSliderContainer', 'tvSliderContainer', 'animeSliderContainer', 'kdramaSliderContainer', 'cdramaSliderContainer'].forEach(id => {
                updateSliderArrows(id);
            });

            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            }
        }, 200);
    });

    const handleInitialLoad = async () => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        
        if (path.includes('watch.html')) {
            const id = params.get('id');
            const type = params.get('type');
            const title = params.get('title') || 'Unknown';
            const poster = params.get('poster') || '';
            const year = params.get('year') || 'N/A';
            const rating = params.get('rating') || 'N/A';
            const season = params.get('season') ? parseInt(params.get('season')) : null;
            const episode = params.get('episode') ? parseInt(params.get('episode')) : null;
            const section = params.get('section') || 'home';

            if (id && type) {
                renderVideoPage(id, type, title, poster, year, season, episode, section, rating);
            }
        } else if (path.includes('search.html')) {
            loadSearchSection();
        } else if (path.includes('library.html')) {
            selectors.homepage.show();
            selectors.librarySection.show();
            loadLibrary();
        } else {
            loadHomepage();
        }
    };

    // Keyboard Navigation
    $(document).on('keydown', (e) => {
        if (selectors.previewSection.is(':visible')) {
            if (e.key === 'ArrowLeft') navigatePreview('left');
            if (e.key === 'ArrowRight') navigatePreview('right');
        }
    });

    // Initialize
    initializeServers();
    setupPreviewTouch();
    handleInitialLoad();

    // Attach scroll listeners to sliders for arrow visibility
    $('.poster-slider').on('scroll', function() {
        updateSliderArrows($(this).attr('id'));
    });
});
