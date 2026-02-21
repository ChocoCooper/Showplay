$(document).ready(function() {
    // --- DOM Selectors ---
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
        
        // Live TV Selectors
        livetvSection: $('#livetvSection'),
        liveTvPlayer: $('#liveTvPlayer'),
        livetvChannelTitle: $('#livetvChannelTitle'),
        livetvPlaylist: $('#livetvPlaylist'),
        livetvSearch: $('#livetvSearch'),
        livetvGroup: $('#livetvGroup')
    };

    // --- Application State ---
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
            preview: false, movies: false, tv: false, anime: false, kdrama: false, cdrama: false, search: false, library: false, livetv: false
        }
    };

    // --- Global Live TV / DRM Config ---
    let shakaInstance = null;
    let liveTvChannels = [];
    const WORKER_URL = 'https://iptv.s16.workers.dev/'; 
    const PLAYLIST_URL = 'https://raw.githubusercontent.com/Arunjunan20/My-IPTV/refs/heads/main/jiostar.m3u';
    const fallbackLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-family='sans-serif' font-size='14'%3ETV%3C/text%3E%3C/svg%3E";

    // --- Original Configuration ---
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [
            { name: 'Server 1', url: 'https://vidfast.pro', moviePattern: 'https://vidfast.pro/movie/{tmdb_id}', tvPattern: 'https://vidfast.pro/tv/{tmdb_id}/{season}/{episode}' },
            { name: 'Server 2', url: 'https://111movies.com', moviePattern: 'https://111movies.com/movie/{tmdb_id}', tvPattern: 'https://111movies.com/tv/{tmdb_id}/{season}/{episode}' },
            { name: 'Server 3', url: 'https://vidsrc.cc/v2', moviePattern: 'https://vidsrc.cc/v2/embed/movie/{tmdb_id}', tvPattern: 'https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}' }
        ]
    };

    // --- Restored Original Utilities ---
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
                    if (attempt < retries - 1) { attempt++; setTimeout(tryLoad, delay * Math.pow(2, attempt)); } 
                    else { reject(new Error(`Failed to load image after ${retries} attempts: ${src}`)); }
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
            if (cacheEntry.expires < Date.now()) { localStorage.removeItem(cacheKey); return null; }
            return cacheEntry.data;
        },
        set(id, type, data) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            const cacheEntry = { data, timestamp: Date.now(), expires: Date.now() + 24 * 60 * 60 * 1000 };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        },
        clear(id, type) { localStorage.removeItem(`mediaDetails_${type}_${id}`); }
    };

    const observeElement = (element, callback) => {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => { if (entry.isIntersecting) { callback(); observer.unobserve(entry.target); } });
        }, { root: null, rootMargin: '100px', threshold: 0.1 });
        if(element[0]) observer.observe(element[0]);
    };

    // --- VOD logic ---
    const initializeServers = () => {
        selectors.serverGrid.empty();
        config.servers.forEach((server, i) => {
            const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}" aria-label="Select ${server.name}">${server.name}</button>`).data('server', server);
            btn.on('click', () => {
                $('.server-btn').removeClass('active'); btn.addClass('active');
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

    // --- RESTORED EXACT ORIGINAL DISCOVERY URLS ---
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

    // --- CORE RENDERING LOGIC ---
    const renderItem = async (item, container, renderType = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = (item.vote_average || item.rating || 0).toFixed(1);
        const imageUrl = getImageUrl(posterPath, 'poster');
        if (!imageUrl) return;

        if (renderType === 'preview') {
            const backdropUrl = getImageUrl(item.backdrop_path, 'backdrop');
            const previewItem = $(`
                <div class="preview-item" data-index="${container.children().length}">
                    <img class="preview-background loaded" src="${backdropUrl}" alt="${title}">
                    <div class="preview-background-overlay"></div>
                    <div class="preview-overlay"></div>
                    <div class="preview-content">
                        <img class="preview-title" src="${item.logo_path}" alt="${title}">
                        <div class="preview-meta">
                            <span class="media-type">${(item.media_type || 'N/A').toUpperCase()}</span>
                            <span class="rating"><i class="fas fa-star"></i>${rating}</span>
                        </div>
                        <p class="preview-description">${item.overview || 'No description available.'}</p>
                        <div class="preview-buttons">
                            <button class="preview-btn play-btn"><i class="fa-solid fa-play"></i> Watch</button>
                        </div>
                    </div>
                </div>
            `);
            previewItem.find('.play-btn').on('click', () => {
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home', item.vote_average);
            });
            container.append(previewItem);
        } else {
            const poster = $(`
                <div class="poster-item">
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge"><i class="fas fa-trash"></i></span>` : ''}
                    <img class="poster-img loaded" src="${imageUrl}" alt="${title}" role="button">
                </div>
            `);
            poster.find('.poster-img').on('click', () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : container.closest('.library-section').length ? 'library' : 'home';
                const mType = item.media_type || item.type || (container.closest('.media-slider-section').data('type') === 'movie' ? 'movie' : 'tv');
                navigateToMedia(item.id, mType, title, imageUrl, year, item.season, item.episode, section, item.vote_average);
            });
            if (isLibrary) {
                poster.find('.delete-badge').on('click', () => {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(i => !(i.id === item.id && i.type === item.type));
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    loadLibrary();
                });
            }
            container.append(poster);
        }
    };

    // --- NAVIGATION & VIDEO PAGES ---
    const navigateToMedia = async (id, type, title, poster, year, season = null, episode = null, section = null, rating = 'N/A') => {
        stopPreviewSlideshow();
        if (shakaInstance) { await shakaInstance.destroy(); shakaInstance = null; }

        state.mediaId = id; state.mediaType = type; state.season = season; state.episode = episode;
        state.previousSection = section || state.previousSection;

        selectors.videoPage.show(); selectors.homepage.hide(); selectors.livetvSection.hide();
        selectors.videoMediaTitle.text(`${title} (${year})`);
        
        // Fetch Details
        const data = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`);
        selectors.mediaPoster.attr('src', getImageUrl(data.poster_path)).addClass('loaded');
        selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average?.toFixed(1) || rating);
        selectors.mediaDetailsTitle.text(title);
        selectors.mediaPlot.text(data.overview);
        selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year} • ${data.genres.map(g => g.name).join(', ')}`);

        if (type === 'tv') {
            await loadTVDetails(id);
            selectors.seasonEpisodeSelector.show();
        } else {
            selectors.seasonEpisodeSelector.hide();
            embedVideo();
        }
        
        addToHistory({ id, type, title, poster: data.poster_path, year, vote_average: data.vote_average });
    };

    const loadTVDetails = async (id) => {
        selectors.seasonEpisodeAccordion.empty();
        const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${id}?api_key=${config.apiKey}`);
        data.seasons.forEach(s => {
            if (s.season_number === 0) return;
            const details = $(`<details><summary>Season ${s.season_number}</summary><div class="episode-list" id="s${s.season_number}">Loading...</div></details>`);
            details.on('toggle', function() { if (this.open) loadEpisodes(id, s.season_number); });
            selectors.seasonEpisodeAccordion.append(details);
        });
    };

    const loadEpisodes = async (id, seasonNum) => {
        const container = $(`#s${seasonNum}`).empty();
        const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNum}?api_key=${config.apiKey}`);
        data.episodes.forEach(e => {
            const btn = $(`<button class="episode-btn">Ep ${e.episode_number}: ${e.name}</button>`);
            btn.on('click', () => { state.season = seasonNum; state.episode = e.episode_number; embedVideo(); });
            container.append(btn);
        });
    };

    const navigateToSection = (section) => {
        selectors.sidebarNavItems.removeClass('active');
        $(`[data-section="${section}"]`).addClass('active');
        if (section !== 'livetv' && shakaInstance) { shakaInstance.destroy(); shakaInstance = null; }

        $('#homepage, #videoPage, #searchSection, #librarySection, #livetvSection').hide();

        if (section === 'home') { $('#homepage').show(); loadHomepage(); }
        else if (section === 'search') { $('#homepage, #searchSection').show(); selectors.searchInput.focus(); }
        else if (section === 'library') { $('#homepage, #librarySection').show(); loadLibrary(); }
        else if (section === 'livetv') { selectors.livetvSection.show(); loadLiveTv(); }
    };

    // --- LIVE TV SHAKA ENGINE ---
    async function playLiveTvStream(channel) {
        selectors.livetvChannelTitle.text("Playing: " + channel.name);
        $('.livetv-channel-item').removeClass('active');
        $(`.livetv-channel-item[data-url="${channel.url}"]`).addClass('active');

        const videoEl = selectors.liveTvPlayer[0];
        if (shakaInstance) await shakaInstance.destroy();

        shaka.polyfill.installAll();
        shakaInstance = new shaka.Player(videoEl);

        if (channel.clearKey) shakaInstance.configure({ drm: { clearKeys: channel.clearKey } });

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

        try { await shakaInstance.load(channel.url); videoEl.play(); } 
        catch (e) { selectors.livetvChannelTitle.text("Error playing channel."); }
    }

    const loadLiveTv = async () => {
        if (state.renderedSections.livetv) return;
        try {
            const res = await fetch(PLAYLIST_URL);
            const text = await res.text();
            const lines = text.split('\n');
            let current = {};
            const groups = new Set();
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#EXTINF:')) {
                    current.name = line.split(',').pop();
                    current.logo = line.match(/tvg-logo="([^"]+)"/)?.[1] || fallbackLogo;
                    current.group = line.match(/group-title="([^"]+)"/)?.[1] || 'Other';
                    groups.add(current.group);
                } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                    const p = line.split('=')[1].split(':');
                    if (p.length === 2) current.clearKey = { [p[0].trim()]: p[1].trim() };
                } else if (line.startsWith('#EXTHTTP:')) {
                    try { current.cookie = JSON.parse(line.substring(9)).cookie; } catch(e){}
                } else if (line.startsWith('http')) {
                    current.url = line; liveTvChannels.push({...current}); current = {};
                }
            }
            Array.from(groups).sort().forEach(g => selectors.livetvGroup.append(`<option value="${g}">${g}</option>`));
            renderLiveTvList(liveTvChannels);
            state.renderedSections.livetv = true;
        } catch (e) { selectors.livetvPlaylist.text("Failed to load playlist."); }
    };

    const renderLiveTvList = (list) => {
        selectors.livetvPlaylist.empty();
        list.forEach(c => {
            const item = $(`<div class="livetv-channel-item" data-url="${c.url}"><img src="${c.logo}" onerror="this.src='${fallbackLogo}'"><span>${c.name}</span></div>`);
            item.on('click', () => playLiveTvStream(c));
            selectors.livetvPlaylist.append(item);
        });
    };

    // --- HOME PAGE INITIALIZATION ---
    const loadHomepage = async () => {
        if (!state.renderedSections.preview) {
            const items = await fetchMedia('trending', true);
            items.forEach(item => renderItem(item, selectors.previewItemsContainer, 'preview'));
            state.renderedSections.preview = true;
            startPreviewSlideshow();
        }
        observeElement(selectors.moviesSlider, async () => { if(!state.renderedSections.movies) { const items = await fetchMedia('movie'); items.forEach(item => renderItem(item, selectors.moviesSlider)); state.renderedSections.movies = true; } });
        observeElement(selectors.tvSlider, async () => { if(!state.renderedSections.tv) { const items = await fetchMedia('tv'); items.forEach(item => renderItem(item, selectors.tvSlider)); state.renderedSections.tv = true; } });
        observeElement(selectors.animeSlider, async () => { if(!state.renderedSections.anime) { const items = await fetchMedia('anime'); items.forEach(item => renderItem(item, selectors.animeSlider)); state.renderedSections.anime = true; } });
        observeElement(selectors.kdramaSlider, async () => { if(!state.renderedSections.kdrama) { const items = await fetchMedia('kdrama'); items.forEach(item => renderItem(item, selectors.kdramaSlider)); state.renderedSections.kdrama = true; } });
        observeElement(selectors.cdramaSlider, async () => { if(!state.renderedSections.cdrama) { const items = await fetchMedia('cdrama'); items.forEach(item => renderItem(item, selectors.cdramaSlider)); state.renderedSections.cdrama = true; } });
    };

    const startPreviewSlideshow = () => {
        state.previewInterval = setInterval(() => {
            const count = selectors.previewItemsContainer.children().length;
            if (count > 0) {
                state.previewIndex = (state.previewIndex + 1) % count;
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            }
        }, 5000);
    };
    const stopPreviewSlideshow = () => clearInterval(state.previewInterval);

    // --- LIBRARY, SEARCH, & INIT ---
    const loadLibrary = () => {
        selectors.watchlistSlider.empty();
        state.watchlist.forEach(i => renderItem(i, selectors.watchlistSlider, 'slider', true));
        selectors.historySlider.empty();
        state.history.forEach(i => renderItem(i, selectors.historySlider, 'slider', false));
    };

    const addToHistory = (item) => {
        state.history = state.history.filter(h => h.id !== item.id);
        state.history.unshift(item);
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    selectors.searchInput.on('input', async function() {
        const query = $(this).val();
        if (query.length < 3) return;
        const type = selectors.searchFilter.val();
        const data = await fetchWithRetry(`https://api.themoviedb.org/3/search/${type}?api_key=${config.apiKey}&query=${encodeURIComponent(query)}`);
        selectors.searchResults.empty();
        data.results.forEach(i => renderItem({...i, media_type: type}, selectors.searchResults));
    });

    selectors.backBtn.on('click', () => navigateToSection(state.previousSection));
    selectors.sidebarNavItems.on('click', function() { navigateToSection($(this).data('section')); });
    
    initializeServers();
    loadHomepage();
});
