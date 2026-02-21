$(document).ready(function() {
    // --- DOM Selectors (Original) ---
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
        sidebarNavItems: $('.sidebar-nav li'),
        
        // --- Live TV Selectors ---
        livetvSection: $('#livetvSection'),
        liveTvPlayer: $('#liveTvPlayer'),
        livetvChannelTitle: $('#livetvChannelTitle'),
        livetvPlaylist: $('#livetvPlaylist'),
        livetvSearch: $('#livetvSearch'),
        livetvGroup: $('#livetvGroup')
    };

    // --- Application State (Original) ---
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
            library: false,
            livetv: false
        }
    };

    // --- Live TV Global Variables (Integrated Shaka) ---
    let shakaInstance = null;
    let liveTvChannels = [];
    
    const WORKER_URL = 'https://iptv.s16.workers.dev/'; 
    const PLAYLIST_URL = 'https://raw.githubusercontent.com/Arunjunan20/My-IPTV/refs/heads/main/jiostar.m3u';
    const fallbackLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-family='sans-serif' font-size='14'%3ETV%3C/text%3E%3C/svg%3E";

    // --- Configuration (Original) ---
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [
            { name: 'Server 1', url: 'https://vidfast.pro', moviePattern: 'https://vidfast.pro/movie/{tmdb_id}', tvPattern: 'https://vidfast.pro/tv/{tmdb_id}/{season}/{episode}' },
            { name: 'Server 2', url: 'https://111movies.com', moviePattern: 'https://111movies.com/movie/{tmdb_id}', tvPattern: 'https://111movies.com/tv/{tmdb_id}/{season}/{episode}' },
            { name: 'Server 3', url: 'https://vidsrc.cc/v2', moviePattern: 'https://vidsrc.cc/v2/embed/movie/{tmdb_id}', tvPattern: 'https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}' }
        ]
    };

    // --- Original Utilities (Retry, Image, Cache, Observation) ---
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

    const getImageUrl = (path, type = 'poster') => {
        if (!path) return null;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const size = type === 'backdrop' ? (isMobile ? 'w1280' : 'original') : (isMobile ? 'w185' : 'w500');
        return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}`;
    };

    const loadImage = (src, retries = 3, delay = 500) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const img = new Image();
            img.src = src;
            if (img.complete) { resolve(img); return; }
            const tryLoad = () => {
                img.onload = () => resolve(img);
                img.onerror = () => {
                    if (attempt < retries - 1) {
                        attempt++;
                        setTimeout(tryLoad, delay * Math.pow(2, attempt));
                    } else { reject(new Error(`Failed to load image after ${retries} attempts: ${src}`)); }
                };
                img.src = src;
            };
            tryLoad();
        });
    };

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
            const cacheEntry = { data, timestamp: Date.now(), expires: Date.now() + 24 * 60 * 60 * 1000 };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        },
        clear(id, type) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            localStorage.removeItem(cacheKey);
        }
    };

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

    // --- Original VOD logic ---
    const initializeServers = () => {
        selectors.serverGrid.empty();
        config.servers.forEach((server, i) => {
            const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}" aria-label="Select ${server.name}">${server.name}</button>`).data('server', server);
            btn.on('click', () => {
                $('.server-btn').removeClass('active');
                btn.addClass('active');
                if (state.mediaId && (state.mediaType === 'movie' || (state.season && state.episode))) { embedVideo(); }
            });
            selectors.serverGrid.append(btn);
        });
    };

    const getActiveServer = () => $('.server-btn.active').data('server') || config.servers[0];

    const embedVideo = () => {
        if (!state.mediaId) { selectors.videoFrame.attr('src', ''); return; }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) { selectors.videoFrame.attr('src', ''); return; }
        const server = getActiveServer();
        let src = state.mediaType === 'movie' ? server.moviePattern.replace('{tmdb_id}', state.mediaId) : server.tvPattern.replace('{tmdb_id}', state.mediaId).replace('{season}', state.season).replace('{episode}', state.episode);
        selectors.videoFrame.attr('src', src);
    };

    // --- Original TMDB Fetch (Preserved specific discovery logic) ---
    const fetchMedia = async (type, isPreview = false) => {
        let url, mediaType;
        if (type === 'movie') { url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${config.apiKey}`; mediaType = 'movie'; }
        else if (type === 'tv') { url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${config.apiKey}`; mediaType = 'tv'; }
        else if (type === 'anime') { url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_genres=16&sort_by=first_air_date.desc&with_original_language=ja&vote_average.gte=6&vote_count.gte=25&without_keywords=10121,9706,264386,280003,158718,281741`; mediaType = 'tv'; }
        else if (type === 'kdrama') { url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=ko&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=25`; mediaType = 'tv'; }
        else if (type === 'cdrama') { url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=zh&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=10&without_genres=16,10759,10765,10768&without_keywords=15060,248451,289844,12995,195013,184656,234890`; mediaType = 'tv'; }
        else if (type === 'trending') { url = `https://api.themoviedb.org/3/trending/all/day?api_key=${config.apiKey}`; mediaType = 'multi'; }
        if (!url) return [];

        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(`${url}&page=${page}`);
                if (!data?.results) return items;
                let validItems = data.results.filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average).map(item => ({ ...item, type: isPreview ? item.media_type : mediaType }));
                if (isPreview) {
                    validItems = validItems.filter(m => m.backdrop_path);
                    validItems = await Promise.all(validItems.map(async m => {
                        const mType = m.media_type === 'movie' ? 'movie' : 'tv';
                        const details = await fetchWithRetry(`https://api.themoviedb.org/3/${mType}/${m.id}?api_key=${config.apiKey}`);
                        const logo = await fetchWithRetry(`https://api.themoviedb.org/3/${mType}/${m.id}/images?api_key=${config.apiKey}&include_image_language=en,null`);
                        const logoUrl = logo.logos?.find(l => l.file_path && l.iso_639_1 === 'en')?.file_path || logo.logos?.[0]?.file_path;
                        return logoUrl ? { ...m, logo_path: `https://image.tmdb.org/t/p/original${logoUrl}`, genres: details.genres } : null;
                    }));
                    validItems = validItems.filter(m => m);
                }
                items = items.concat(validItems);
                page++;
            }
            return items.slice(0, desiredCount);
        } catch (error) { return []; }
    };

    // --- Original Render logic (Preserved Item logic) ---
    const renderItem = async (item, container, renderType = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = (item.vote_average || item.rating || 0).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath, 'poster');
        if (!imageUrl) return;
        const createElement = (html) => $(html);
        const attachClickHandler = (element, clickHandler) => { element.on('click', clickHandler); return element; };

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
                            <button class="preview-btn play-btn"><i class="fa-solid fa-play"></i> Watch</button>
                            <button class="preview-btn secondary add-btn"><i class="${isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus'}"></i></button>
                        </div>
                    </div>
                </div>
            `);
            try { await loadImage(backdropUrl); } catch (error) { previewItem.remove(); return; }
            attachClickHandler(previewItem.find('.play-btn'), e => {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home', item.vote_average);
                if (item.media_type === 'movie') addToHistory({ id: item.id, type: 'movie', title, poster: posterPath, year, season: null, episode: null, rating: item.vote_average });
            });
            attachClickHandler(previewItem.find('.add-btn'), () => {
                toggleWatchlist({ id: item.id, type: item.media_type, title, poster: posterPath, rating: item.vote_average });
                const isInWatchlist = state.watchlist.some(w => w.id === item.id);
                previewItem.find('.add-btn i').attr('class', isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus');
            });
            container.append(previewItem);
        } else {
            const poster = createElement(`
                <div class="poster-item">
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete"><i class="fas fa-trash"></i></span>` : ''}
                    <img class="poster-img loaded" src="${imageUrl}" alt="${title}" role="button">
                </div>
            `);
            try { await loadImage(imageUrl); } catch (error) { poster.remove(); return; }
            attachClickHandler(poster.find('.poster-img'), () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : container.closest('.library-section').length ? 'library' : 'home';
                const mType = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer, #cdramaSliderContainer').length ? 'tv' : 'movie');
                navigateToMedia(item.id, mType, title, imageUrl, year, item.season, item.episode, section, item.rating);
                if (!isLibrary && mType === 'movie') addToHistory({ id: item.id, type: mType, title, poster: posterPath, year, season: item.season || null, episode: item.episode || null, rating: item.vote_average });
            });
            if (isLibrary) {
                attachClickHandler(poster.find('.delete-badge'), () => {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(i => !(i.id === item.id && i.type === item.type && i.season === item.season && i.episode === item.episode));
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    state.renderedSections.library = false;
                    loadLibrary();
                });
            }
            container.append(poster);
        }
    };

    // --- History & Watchlist (Original) ---
    const addToHistory = item => {
        const key = `${item.id}_${item.type}_${item.season || ''}_${item.episode || ''}`;
        state.history = state.history.filter(h => `${h.id}_${h.type}_${h.season || ''}_${h.episode || ''}` !== key);
        state.history.unshift({ ...item, rating: item.rating || 'N/A', timestamp: Date.now() });
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    const toggleWatchlist = item => {
        const isInWatchlist = state.watchlist.some(w => w.id === item.id);
        if (!isInWatchlist) state.watchlist.push({ ...item, timestamp: Date.now() });
        else state.watchlist = state.watchlist.filter(w => w.id !== item.id);
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
        loadLibrary();
    };

    const loadLibrary = async () => {
        state.renderedSections.library = false;
        selectors.watchlistSlider.empty().show();
        if (!state.watchlist.length) selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        else {
            const items = state.watchlist.map(i => ({ ...i, imageUrl: getImageUrl(i.poster, 'poster') }));
            const loaded = (await Promise.all(items.map(i => i.imageUrl ? loadImage(i.imageUrl).then(() => i).catch(() => null) : Promise.resolve(null)))).filter(i => i);
            for (const i of loaded) await renderItem(i, selectors.watchlistSlider, 'slider', true);
        }
        selectors.historySlider.empty().show();
        if (!state.history.length) selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        else {
            const hMap = new Map();
            for (const i of state.history) { const k = `${i.id}_${i.type}`; if (!hMap.has(k) || hMap.get(k).timestamp < i.timestamp) hMap.set(k, i); }
            const unique = Array.from(hMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            const items = unique.map(i => ({ ...i, imageUrl: getImageUrl(i.poster, 'poster') }));
            const loaded = (await Promise.all(items.map(i => i.imageUrl ? loadImage(i.imageUrl).then(() => i).catch(() => null) : Promise.resolve(null)))).filter(i => i);
            for (const i of loaded) await renderItem(i, selectors.historySlider, 'slider', true);
        }
        state.renderedSections.library = true;
    };

    const loadSeasonEpisodeAccordion = async () => {
        if (state.mediaType !== 'tv') { selectors.seasonEpisodeSelector.hide(); return; }
        selectors.seasonEpisodeSelector.show(); selectors.seasonEpisodeAccordion.empty();
        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`);
            const seasons = data.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
            if (!seasons.length) { selectors.seasonEpisodeAccordion.html('<p class="empty-message">No seasons available.</p>'); return; }
            for (const season of seasons) {
                const details = $(`<details><summary>Season ${season.season_number}</summary><div class="episode-list"></div></details>`);
                selectors.seasonEpisodeAccordion.append(details);
                const epList = details.find('.episode-list');
                const epData = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season.season_number}?api_key=${config.apiKey}`);
                const episodes = epData.episodes?.filter(e => e.episode_number > 0) || [];
                episodes.forEach(ep => {
                    const btn = $(`<button class="episode-btn"><span>Episode ${ep.episode_number}: ${ep.name || 'Untitled'}</span></button>`);
                    btn.on('click', () => {
                        $('.episode-btn').removeClass('active'); btn.addClass('active');
                        state.season = season.season_number; state.episode = ep.episode_number; embedVideo();
                    });
                    epList.append(btn);
                });
            }
        } catch (e) { selectors.seasonEpisodeAccordion.html('<p class="empty-message">Error loading episodes.</p>'); }
    };

    // --- UPDATED PLAYBACK LOGIC FOR SHAKA (DRM SUPPORT) ---
    async function playLiveTvStream(channel) {
        selectors.livetvChannelTitle.text("Playing: " + channel.name);
        $('.livetv-channel-item').removeClass('active');
        $(`.livetv-channel-item[data-url="${channel.rawUrl}"]`).addClass('active');

        const videoEl = selectors.liveTvPlayer[0];
        if (shakaInstance) { await shakaInstance.destroy(); shakaInstance = null; }

        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
            selectors.livetvChannelTitle.text("DRM not supported in this browser."); return;
        }

        shakaInstance = new shaka.Player(videoEl);

        // CONFIG: Apply DRM keys immediately before loading
        if (channel.clearKey) {
            shakaInstance.configure({
                drm: {
                    clearKeys: channel.clearKey
                }
            });
        }

        // FILTER: Routing protected domains through Cloudflare
        shakaInstance.getNetworkingEngine().registerRequestFilter((type, request) => {
            const uri = request.uris[0];
            const needsProxy = uri.includes('jio.com') || uri.includes('hotstar.com') || channel.cookie;
            if (needsProxy && !uri.includes(WORKER_URL)) {
                let proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(uri)}`;
                if (channel.cookie) proxyUrl += `&Cookie=${encodeURIComponent(channel.cookie)}`;
                if (channel.userAgent) proxyUrl += `&User-agent=${encodeURIComponent(channel.userAgent)}`;
                request.uris[0] = proxyUrl;
            }
        });

        try {
            await shakaInstance.load(channel.rawUrl);
            videoEl.play();
        } catch (e) {
            console.error('Shaka Playback Error', e);
            selectors.livetvChannelTitle.text("Error: Stream offline or geo-blocked.");
        }
    }

    const renderLiveTvPlaylist = (channelsToRender) => {
        selectors.livetvPlaylist.empty();
        if (channelsToRender.length === 0) {
            selectors.livetvPlaylist.html('<p style="text-align:center; padding:20px;">No channels found.</p>'); return;
        }
        channelsToRender.forEach((channel) => {
            const div = $(`<div class="livetv-channel-item" data-url="${channel.rawUrl}"></div>`);
            div.on('click', () => playLiveTvStream(channel));
            const img = $(`<img src="${channel.logo}" class="livetv-channel-logo">`);
            img.on('error', function() { $(this).attr('src', fallbackLogo); });
            const span = $(`<span class="livetv-channel-name">${channel.name}</span>`);
            div.append(img).append(span);
            selectors.livetvPlaylist.append(div);
        });
    };

    // --- M3U Parser (Logic for ClearKey Extraction) ---
    const loadLiveTv = async () => {
        if (state.renderedSections.livetv) return;
        try {
            const response = await fetch(PLAYLIST_URL);
            const text = await response.text();
            const lines = text.split('\n');
            let current = {}; const groups = new Set();
            for (let line of lines) {
                line = line.trim(); if (!line) continue;
                if (line.startsWith('#EXTINF:')) {
                    current.name = line.split(',').pop().trim();
                    current.logo = line.match(/tvg-logo="([^"]+)"/)?.[1] || fallbackLogo;
                    current.group = line.match(/group-title="([^"]+)"/)?.[1] || 'Other';
                    groups.add(current.group);
                } 
                else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    const keyData = line.split('=')[1].trim();
                    if (keyData.includes('keyid=') && keyData.includes('key=')) {
                        const kid = keyData.match(/keyid=([a-fA-0-9]+)/);
                        const key = keyData.match(/key=([a-fA-0-9]+)/);
                        if (kid && key) current.clearKey = { [kid[1]]: key[1] };
                    } else if (keyData.includes(':') && !keyData.startsWith('http')) {
                        const p = keyData.split(':');
                        current.clearKey = { [p[0].trim()]: p[1].trim() };
                    }
                }
                else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) { current.userAgent = line.split('=')[1].trim(); }
                else if (line.startsWith('#EXTHTTP:')) {
                    try { const params = JSON.parse(line.substring(9)); if (params.cookie) current.cookie = params.cookie; } catch(e){}
                }
                else if (line.startsWith('http')) {
                    current.rawUrl = line; liveTvChannels.push({...current}); current = {};
                }
            }
            Array.from(groups).sort().forEach(g => selectors.livetvGroup.append(`<option value="${g}">${g}</option>`));
            renderLiveTvPlaylist(liveTvChannels);
            state.renderedSections.livetv = true;
        } catch (e) { selectors.livetvPlaylist.html('<p>Error loading playlist.</p>'); }
    };

    // --- Navigation (Preserved Sidebar/Section logic) ---
    const navigateToSection = section => {
        selectors.sidebarNavItems.removeClass('active');
        selectors.sidebarNavItems.filter(`[data-section="${section}"]`).addClass('active');
        if (section !== 'livetv' && shakaInstance) { shakaInstance.destroy(); shakaInstance = null; }
        if (section === 'home') { loadHomepage(); } 
        else if (section === 'search') { loadSearchSection(); window.history.replaceState({ section: 'search' }, '', '/search'); } 
        else if (section === 'library') {
            selectors.homepage.show(); selectors.videoPage.hide();
            selectors.previewSection.hide(); selectors.moviesSlider.parent().hide();
            selectors.tvSlider.parent().hide(); selectors.animeSlider.parent().hide();
            selectors.kdramaSlider.parent().hide(); selectors.cdramaSlider.parent().hide();
            selectors.searchSection.hide(); selectors.livetvSection.hide();
            selectors.librarySection.show(); stopPreviewSlideshow();
            loadLibrary(); window.history.replaceState({ section: 'library' }, '', '/library');
        } 
        else if (section === 'livetv') {
            selectors.homepage.hide(); selectors.videoPage.hide();
            selectors.previewSection.hide(); selectors.moviesSlider.parent().hide();
            selectors.tvSlider.parent().hide(); selectors.animeSlider.parent().hide();
            selectors.kdramaSlider.parent().hide(); selectors.cdramaSlider.parent().hide();
            selectors.searchSection.hide(); selectors.librarySection.hide();
            selectors.livetvSection.show(); stopPreviewSlideshow();
            loadLiveTv(); window.history.replaceState({ section: 'livetv' }, '', '/livetv');
        }
    };

    // --- Original UI Handlers (Swiping, Search, Slideshow) ---
    const setupPreviewTouch = () => {
        let startX = 0; let isSwiping = false;
        selectors.previewSection.on('touchstart', e => { startX = e.originalEvent.touches[0].clientX; isSwiping = true; stopPreviewSlideshow(); });
        selectors.previewSection.on('touchmove', e => {
            if (!isSwiping) return;
            const diff = startX - e.originalEvent.touches[0].clientX;
            const count = selectors.previewItemsContainer.children().length;
            if (count <= 0) return;
            selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100 + (diff / selectors.previewSection.width()) * 100}%)`);
        });
        selectors.previewSection.on('touchend', e => {
            isSwiping = false; const diff = startX - e.originalEvent.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) state.previewIndex = Math.min(state.previewIndex + 1, selectors.previewItemsContainer.children().length - 1);
                else state.previewIndex = Math.max(state.previewIndex - 1, 0);
            }
            selectors.previewItemsContainer.css('transition', 'transform 0.5s ease').css('transform', `translateX(${-state.previewIndex * 100}%)`);
            setTimeout(() => { selectors.previewItemsContainer.css('transition', ''); startPreviewSlideshow(); }, 500);
        });
    };

    const startPreviewSlideshow = () => {
        if (state.previewInterval || !selectors.previewSection.is(':visible')) return;
        state.previewInterval = setInterval(() => {
            const count = selectors.previewItemsContainer.children().length;
            if (count > 0) { state.previewIndex = (state.previewIndex + 1) % count; selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`); }
        }, 6000);
    };
    const stopPreviewSlideshow = () => { clearInterval(state.previewInterval); state.previewInterval = null; };

    const loadHomepage = async () => {
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.show();
        selectors.moviesSlider.parent().show(); selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show(); selectors.kdramaSlider.parent().show();
        selectors.cdramaSlider.parent().show(); selectors.librarySection.hide();
        selectors.searchSection.hide(); selectors.livetvSection.hide();
        window.history.replaceState({ section: 'home' }, '', '/home');

        const loadSec = async (container, type, isP = false) => {
            if (state.renderedSections[type] && !isP) { container.show(); return; }
            container.empty().show(); const items = await fetchMedia(type, isP);
            for (const item of items) await renderItem(item, container, isP ? 'preview' : 'slider');
            if (!isP) state.renderedSections[type] = true;
        };

        if (!state.renderedSections.preview) {
            observeElement(selectors.previewItemsContainer, () => {
                loadSec(selectors.previewItemsContainer, 'trending', true);
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
                startPreviewSlideshow();
            });
        } else { selectors.previewItemsContainer.show(); startPreviewSlideshow(); }

        observeElement(selectors.moviesSlider, () => loadSec(selectors.moviesSlider, 'movie'));
        observeElement(selectors.tvSlider, () => loadSec(selectors.tvSlider, 'tv'));
        observeElement(selectors.animeSlider, () => loadSec(selectors.animeSlider, 'anime'));
        observeElement(selectors.kdramaSlider, () => loadSec(selectors.kdramaSlider, 'kdrama'));
        observeElement(selectors.cdramaSlider, () => loadSec(selectors.cdramaSlider, 'cdrama'));
    };

    const loadSearchSection = () => {
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.hide();
        $('.media-slider-section').hide(); selectors.librarySection.hide(); selectors.searchSection.show();
        selectors.livetvSection.hide(); selectors.searchInput.focus(); stopPreviewSlideshow();
        if (!state.renderedSections.search) {
            selectors.searchResults.empty(); selectors.searchTrending.empty();
            observeElement(selectors.searchTrending, () => {
                const filter = selectors.searchFilter.val();
                fetchMedia(filter === 'movie' ? 'movie' : 'tv').then(items => items.forEach(i => renderItem(i, selectors.searchTrending)));
            });
            state.renderedSections.search = true;
        }
    };

    // --- EVENT LISTENERS ---
    selectors.backBtn.on('click', () => { 
        if (shakaInstance) { shakaInstance.destroy(); shakaInstance = null; }
        selectors.videoPage.hide(); resetVideoPlayerState(); navigateToSection(state.previousSection); 
    });
    selectors.sidebarNavItems.on('click', function() { navigateToSection($(this).data('section')); });
    selectors.searchInput.on('input', () => { 
        clearTimeout(searchTimeout); 
        searchTimeout = setTimeout(performSearch, 500); 
    });
    selectors.searchFilter.on('change', () => performSearch());

    const handleInitialLoad = async () => {
        const path = window.location.pathname;
        if (path.match(/^\/livetv$/)) navigateToSection('livetv');
        else if (path.match(/^\/home$/) || path === '/') loadHomepage();
        else loadHomepage();
    };

    initializeServers(); setupPreviewTouch(); handleInitialLoad();
});
