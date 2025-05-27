$(document).ready(() => {
    // Placeholder SVG for posters and preview content
    const placeholderSvg = 'data:image/svg+xml,%3Csvg width="100%" height="100%" viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="100" height="150" fill="%23ccc"%3E%3C/rect%3E%3Ctext x="50%" y="50%" font-family="Arial" font-size="12" fill="%23666" text-anchor="middle" dy=".3em"%3EPlaceholder%3C/text%3E%3C/svg%3E';
    const previewTitlePlaceholderSvg = 'data:image/svg+xml,%3Csvg width="400" height="100" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="400" height="100" fill="%23ccc"%3E%3C/rect%3E%3Ctext x="50%" y="50%" font-family="Arial" font-size="20" fill="%23666" text-anchor="middle" dy=".3em"%3EPreview Placeholder%3C/text%3E%3C/svg%3E';

    // DOM Selectors
    const selectors = {
        videoPage: $('#videoPage'),
        videoFrame: $('#videoFrame'),
        videoError: $('#videoError'),
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
        librarySection: $('#librarySection'),
        watchlistSlider: $('#watchlistSlider'),
        historySlider: $('#historySlider'),
        searchSection: $('#searchSection'),
        searchInput: $('#searchInput'),
        searchFilter: $('#searchFilter'),
        searchResults: $('#searchResults'),
        searchTrending: $('#searchTrending'),
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
        abortController: null,
        currentServerIndex: 0
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09', // Move to server-side in production
        servers: [
            { 
                name: 'Server 1', 
                url: 'https://vidsrc.me', 
                moviePattern: 'https://vidsrc.me/embed/movie/{tmdb_id}', 
                tvPattern: 'https://vidsrc.me/embed/tv/{tmdb_id}/{season}/{episode}' 
            },
            { 
                name: 'Server 2', 
                url: 'https://vidsrc.to', 
                moviePattern: 'https://vidsrc.to/embed/movie/{tmdb_id}', 
                tvPattern: 'https://vidsrc.to/embed/tv/{tmdb_id}/{season}/{episode' 
            },
            { 
                name: 'Server 3',
                url: 'https://vidsrc.pro', 
                moviePattern: 'https://vidsrc.pro/embed/movie/{tmdb_id}', 
                tvPattern: 'https://vidsrc.pro/embed/tv/{tmdb_id}/{season}/{episode}' 
            }
        ]
    };

    // Utility: Fetch with Retry and AbortController
    const fetchWithRetry = async (url, retries = 3, baseDelay = 500, signal = null) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, { signal });
                if (res.status === 429) {
                    const retryAfter = res.headers.get('Retry-After') ? parseInt(res.headers.get('Retry-After')) * 1000 : Math.pow(2, i) * baseDelay;
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return await res.json();
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * baseDelay));
            }
        }
    };

    // Utility: Get Image URL
    const getImageUrl = (path, type = 'poster') => {
        if (!path) return placeholderSvg;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const size = type === 'backdrop' ? (isMobile ? 'w780' : 'original') : (isMobile ? 'w185' : 'w500');
        return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}`;
    };

    // Utility: Get Image Srcset
    const getImageSrcset = (path, type = 'poster') => {
        if (!path) return '';
        const base = 'https://image.tmdb.org/t/p/';
        const sizes = type === 'backdrop' ? ['w780', 'original'] : ['w185', 'w342', 'w500'];
        return sizes.map(size => `${base}${size}${path.startsWith('/') ? path : '/' + path} ${size === 'original' ? '2000w' : `${parseInt(size.slice(1))}w`}`).join(', ');
    };

    // Utility: Load Image with Retry
    const loadImage = (src, retries = 3, delay = 500) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const tryLoad = () => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = () => {
                    if (attempt < retries - 1) {
                        attempt++;
                        setTimeout(tryLoad, delay * Math.pow(2, attempt));
                    } else {
                        reject(new Error(`Failed to load image after ${retries} attempts: ${src}`));
                    }
                };
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
                expires: Date.now() + 24 * 60 * 60 * 1000 // Cache for 24 hours
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        },
        clear(id, type) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            localStorage.removeItem(cacheKey);
        }
    };

    // Initialize Servers
    const initializeServers = () => {
        selectors.serverGrid.empty();
        config.servers.forEach((server, i) => {
            const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}" aria-label="Select ${server.name}">${server.name}</button>`).data('server', server);
            btn.on('click', () => {
                $('.server-btn').removeClass('active');
                btn.addClass('active');
                state.currentServerIndex = i;
                if (state.mediaId && (state.mediaType === 'movie' || (state.season && state.episode))) {
                    embedVideo();
                }
            });
            selectors.serverGrid.append(btn);
        });
    };

    // Get Active Server
    const getActiveServer = () => $('.server-btn.active').data('server') || config.servers[state.currentServerIndex];

    // Try Next Server
    const tryNextServer = () => {
        state.currentServerIndex = (state.currentServerIndex + 1) % config.servers.length;
        $('.server-btn').removeClass('active');
        $(`.server-btn:eq(${state.currentServerIndex})`).addClass('active');
        embedVideo();
    };

    // Embed Video
    const embedVideo = () => {
        selectors.videoError.hide();
        if (!state.mediaId) {
            console.error('Cannot embed video: mediaId is not set');
            selectors.videoFrame.attr('src', '');
            selectors.videoError.text('No media selected.').show();
            return;
        }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) {
            console.error('Cannot embed TV video: season or episode is not set');
            selectors.videoFrame.attr('src', '');
            selectors.videoError.text('Please select a season and episode.').show();
            return;
        }

        const server = getActiveServer();
        let src;
        if (state.mediaType === 'movie') {
            src = server.moviePattern.replace('{tmdb_id}', state.mediaId);
        } else {
            src = server.tvPattern
                .replace('{tmdb_id}', state.mediaId)
                .replace('{season}', state.season)
                .replace('{episode}', state.episode);
        }

        selectors.videoFrame.attr('src', src).off('error').on('error', () => {
            selectors.videoFrame.attr('src', '');
            if (state.currentServerIndex < config.servers.length - 1) {
                selectors.videoError.text(`Failed to load video from ${server.name}. Trying next server...`).show();
                tryNextServer();
            } else {
                selectors.videoError.text(`All servers failed to load video for ${selectors.videoMediaTitle.text()}. Please try again later.`).show();
            }
        });

        // Test server availability
        fetch(server.url, { method: 'HEAD' })
            .then(res => {
                if (!res.ok) throw new Error('Server unavailable');
            })
            .catch(() => {
                if (state.currentServerIndex < config.servers.length - 1) {
                    selectors.videoError.text(`Server ${server.name} is unavailable. Trying next server...`).show();
                    tryNextServer();
                } else {
                    selectors.videoError.text(`All servers are unavailable for ${selectors.videoMediaTitle.text()}. Please try again later.`).show();
                }
            });
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
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_genres=16&sort_by=popularity.desc&with_original_language=ja&vote_average.gte=8&vote_count.gte=1000`;
            mediaType = 'tv';
        } else if (type === 'kdrama') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=ko&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100`;
            mediaType = 'tv';
        } else if (type === 'trending') {
            url = `https://api.themoviedb.org/3/trending/all/day?api_key=${config.apiKey}`;
            mediaType = 'multi';
        }
        if (!url) return [];

        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(`${url}&page=${page}`, 3, 500, state.abortController?.signal);
                let validItems = data.results
                    .filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average)
                    .map(item => ({ ...item, type: isPreview ? item.media_type : mediaType }));
                
                if (isPreview) {
                    validItems = validItems.filter(m => m.backdrop_path);
                    validItems = await Promise.all(validItems.map(async m => {
                        const mediaType = m.media_type === 'movie' ? 'movie' : 'tv';
                        const details = await fetchWithRetry(`https://api.themoviedb.org/3/${mediaType}/${m.id}?api_key=${config.apiKey}`, 3, 500, state.abortController?.signal);
                        const logo = await fetchWithRetry(`https://api.themoviedb.org/3/${mediaType}/${m.id}/images?api_key=${config.apiKey}&include_image_language=en,null`, 3, 500, state.abortController?.signal);
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
            if (error.name === 'AbortError') return [];
            console.error(`Failed to load ${type} content`, error);
            return [];
        }
    };

    // Render Item (Preview, Slider, or Library)
    const renderItem = async (item, container, renderType = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = (item.vote_average || item.rating || 0).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath);
        const imageSrcset = getImageSrcset(posterPath);
        const imageSizes = renderType === 'preview' ? '(max-width: 767px) 70vw, 400px' : '(max-width: 767px) 105px, 140px';
        if (!imageUrl && renderType !== 'preview') return;

        const createElement = (html) => $(html);
        const attachClickHandler = (element, clickHandler) => {
            element.on('click', clickHandler);
            element.attr('tabindex', '0').on('keypress', function(e) {
                if (e.which === 13) clickHandler(e);
            });
            return element;
        };

        if (renderType === 'preview') {
            const backdropUrl = getImageUrl(item.backdrop_path, 'backdrop');
            const backdropSrcset = getImageSrcset(item.backdrop_path, 'backdrop');
            const logoUrl = item.logo_path || previewTitlePlaceholderSvg;
            if (!backdropUrl) return;

            const mediaType = item.media_type === 'movie' ? 'MOVIE' : 'TV';
            const genres = item.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            const isInWatchlist = state.watchlist.some(w => w.id === item.id);
            const previewItem = createElement(`
                <div class="preview-item" data-index="${container.children().length}">
                    <img class="preview-background poster-placeholder" src="${backdropUrl}" srcset="${backdropSrcset}" sizes="(max-width: 767px) 100vw, 780px" alt="${title}" data-id="${item.id}" data-title="${title}" data-poster="${imageUrl}" loading="lazy">
                    <div class="preview-background-overlay"></div>
                    <div class="preview-overlay"></div>
                    <div class="preview-content">
                        <img class="preview-title poster-placeholder" src="${logoUrl}" alt="${title}" loading="lazy">
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

            try {
                await loadImage(backdropUrl);
                previewItem.find('.preview-background').addClass('loaded').removeClass('poster-placeholder');
                if (item.logo_path) {
                    await loadImage(item.logo_path);
                    previewItem.find('.preview-title').addClass('loaded').removeClass('poster-placeholder');
                }
            } catch (error) {
                console.error(`Failed to load preview image for ${title}`, error);
                previewItem.remove();
                return;
            }

            attachClickHandler(previewItem.find('.play-btn'), e => {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home');
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
                <div class="poster-item">
                    <img src="${imageUrl}" srcset="${imageSrcset}" sizes="${imageSizes}" alt="${title}" class="poster-img poster-placeholder" role="button" aria-label="Play ${title}" loading="lazy">
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                </div>
            `);

            if (imageUrl !== placeholderSvg) {
                try {
                    await loadImage(imageUrl);
                    poster.find('.poster-img').addClass('loaded').removeClass('poster-placeholder');
                } catch (error) {
                    console.error(`Failed to load poster for ${title}`, error);
                }
            }

            attachClickHandler(poster.find('.poster-img'), () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : 
                               container.closest('.library-section').length ? 'library' : 'home';
                const mediaType = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer').length ? 'tv' : 'movie');
                navigateToMedia(item.id, mediaType, title, imageUrl, year, item.season, item.episode, section);
                if (!isLibrary && mediaType === 'movie') {
                    addToHistory({ id: item.id, type: mediaType, title, poster: posterPath, year, season: item.season || null, episode: item.episode || null, rating: item.vote_average });
                }
            });

            if (isLibrary) {
                attachClickHandler(poster.find('.delete-badge'), () => {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(i => i.id !== item.id);
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    loadLibrary();
                });
            }

            container.append(poster);
        }
    };

    // Add to History
    const addToHistory = item => {
        state.history = state.history.filter(h => 
            !(h.id === item.id && h.type === item.type && h.season === item.season && h.episode === item.episode)
        );
        state.history.unshift({ ...item, timestamp: Date.now() });
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    // Toggle Watchlist
    const toggleWatchlist = item => {
        const isInWatchlist = state.watchlist.some(w => w.id === item.id);
        if (!isInWatchlist) {
            state.watchlist.push({ ...item, timestamp: Date.now() });
        } else {
            state.watchlist = state.watchlist.filter(w => w.id !== item.id);
        }
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
        loadLibrary();
    };

    // Load Library
    const loadLibrary = async () => {
        selectors.watchlistSlider.empty();
        selectors.historySlider.empty();

        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            for (const item of state.watchlist) {
                await renderItem(item, selectors.watchlistSlider, 'slider', true);
            }
        }

        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            state.history.sort((a, b) => b.timestamp - a.timestamp);
            const uniqueHistory = [];
            const seen = new Set();
            for (const item of state.history) {
                const key = `${item.id}_${item.type}_${item.season || ''}_${item.episode || ''}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueHistory.push(item);
                }
            }
            for (const item of uniqueHistory) {
                await renderItem(item, selectors.historySlider, 'slider', true);
            }
        }
    };

    // Load Season and Episode Accordion
    const loadSeasonEpisodeAccordion = async () => {
        if (state.mediaType !== 'tv') {
            selectors.seasonEpisodeSelector.hide();
            return;
        }

        selectors.seasonEpisodeSelector.show();
        selectors.seasonEpisodeAccordion.empty();

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`, 3, 500, state.abortController?.signal);
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
                const epData = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season.season_number}?api_key=${config.apiKey}`, 3, 500, state.abortController?.signal);
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
                        state.season = season.season_number;
                        state.episode = ep.episode_number;
                        embedVideo();
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
                            { id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode, section: state.previousSection },
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
            if (error.name === 'AbortError') return;
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
        state.currentServerIndex = 0;
        selectors.videoFrame.attr('src', '');
        selectors.videoError.hide();
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', placeholderSvg).attr('alt', '').addClass('poster-placeholder').removeClass('loaded');
        selectors.mediaRatingBadge.find('.rating-value').text('');
        selectors.mediaDetailsTitle.text('');
        selectors.mediaYearGenre.text('');
        selectors.mediaPlot.text('');
        selectors.seasonEpisodeSelector.hide();
        selectors.seasonEpisodeAccordion.empty();
        selectors.watchlistBtn.html('Add to Watchlist <i class="fas fa-plus"></i>');
        selectors.downloadBtn.attr('href', '#');
    };

    // Load Homepage
    const loadHomepage = async () => {
        if (state.abortController) state.abortController.abort();
        state.abortController = new AbortController();
        selectors.homepage.hide();
        selectors.videoPage.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        try {
            const [previewItems, movies, tv, anime, kdrama] = await Promise.all([
                fetchMedia('trending', true),
                fetchMedia('movie'),
                fetchMedia('tv'),
                fetchMedia('anime'),
                fetchMedia('kdrama')
            ]);

            selectors.homepage.show();
            selectors.previewSection.show();
            selectors.moviesSlider.parent().show();
            selectors.tvSlider.parent().show();
            selectors.animeSlider.parent().show();
            selectors.kdramaSlider.parent().show();

            selectors.previewItemsContainer.empty();
            for (const item of previewItems) await renderItem(item, selectors.previewItemsContainer, 'preview');
            selectors.moviesSlider.empty();
            for (const item of movies) await renderItem(item, selectors.moviesSlider);
            selectors.tvSlider.empty();
            for (const item of tv) await renderItem(item, selectors.tvSlider);
            selectors.animeSlider.empty();
            for (const item of anime) await renderItem(item, selectors.animeSlider);
            selectors.kdramaSlider.empty();
            for (const item of kdrama) await renderItem(item, selectors.kdramaSlider);

            setupPreviewTouch();
            startPreviewSlideshow();
            window.history.replaceState({ section: 'home' }, '', '/home');
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Failed to load homepage', error);
            selectors.previewSection.html('<div class="error-message">Failed to load content. <button class="retry-button">Retry</button></div>');
            $('.retry-button').on('click', loadHomepage);
        }
    };

    // Load Search Section
    const loadSearchSection = async () => {
        if (state.abortController) state.abortController.abort();
        state.abortController = new AbortController();
        selectors.homepage.hide();
        selectors.videoPage.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        selectors.homepage.show();
        selectors.searchSection.show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();

        selectors.searchResults.empty();
        selectors.searchTrending.empty();
        try {
            const filter = selectors.searchFilter.val();
            const items = await fetchMedia(filter, false);
            items.forEach(item => renderItem(item, selectors.searchTrending));
            window.history.replaceState({ section: 'search' }, '', '/search');
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Failed to load search section', error);
            selectors.searchTrending.html('<div class="error-message">Failed to load trending content. <button class="retry-button">Retry</button></div>');
            $('.retry-button').on('click', loadSearchSection);
        }
    };

    // Navigate to Media
    const navigateToMedia = async (id, type, title, poster, year, season = null, episode = null, section = null) => {
        if (state.abortController) state.abortController.abort();
        state.abortController = new AbortController();
        selectors.videoPage.hide();
        selectors.homepage.hide();
        selectors.mediaDetails.hide();
        stopPreviewSlideshow();
        resetVideoPlayerState();

        if (!id || !type || !['movie', 'tv'].includes(type)) {
            console.error(`Invalid media parameters: ID=${id}, Type=${type}`);
            selectors.mediaDetailsTitle.text('Invalid Media');
            selectors.mediaYearGenre.text('');
            selectors.mediaPlot.text('The selected media is invalid. Please try another title.');
            loadHomepage();
            return;
        }

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`, 3, 500, state.abortController?.signal);
            title = data.title || data.name || title;
            year = (data.release_date || data.first_air_date || '').split('-')[0] || year;
            poster = getImageUrl(data.poster_path) || poster;
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(`Media not found: ID=${id}, Type=${type}`, error);
            loadHomepage();
            return;
        }

        state.mediaId = id;
        state.mediaType = type;
        state.season = season;
        state.episode = episode;
        state.previousSection = section || state.previousSection;

        let url = `/${type}/${id}`;
        if (type === 'tv' && season && episode) {
            url = `/${type}/${id}/${season}/${episode}`;
        }
        window.history.pushState(
            { id, type, title, poster, year, season, episode, section: state.previousSection },
            '',
            url
        );

        selectors.videoPage.data({ id, type, title, poster, year });

        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
        selectors.downloadBtn.attr('href', type === 'movie' ? `https://dl.vidsrc.vip/movie/${id}` : `https://dl.vidsrc.vip/tv/${id}/${state.season || 1}/${state.episode || 1}`);

        selectors.videoPage.show();
        selectors.videoMediaTitle.show().text(`${title}\n(${year || 'N/A'})`);
        selectors.selectorContainer.addClass('active');
        selectors.mediaDetails.addClass('active');

        const cachedData = mediaCache.get(id, type);
        const updateUI = (data) => {
            const genres = data.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            const posterUrl = getImageUrl(data.poster_path) || placeholderSvg;
            const posterSrcset = getImageSrcset(data.poster_path);
            selectors.mediaPoster
                .attr('src', posterUrl)
                .attr('srcset', posterSrcset)
                .attr('sizes', '(max-width: 767px) 105px, 200px')
                .attr('alt', `${title} Poster`)
                .toggleClass('poster-placeholder', posterUrl === placeholderSvg)
                .toggleClass('loaded', posterUrl !== placeholderSvg);
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average?.toFixed(1) || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year || 'N/A'} • ${genres.join(', ')}`);
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        if (cachedData) {
            console.log(`Using cached data for ${title} (ID: ${id}, Type: ${type})`);
            updateUI(cachedData);
        } else {
            selectors.mediaPoster
                .attr('src', poster || placeholderSvg)
                .attr('srcset', getImageSrcset(poster))
                .attr('sizes', '(max-width: 767px) 105px, 200px')
                .attr('alt', `${title} Poster`)
                .toggleClass('poster-placeholder', !poster)
                .toggleClass('loaded', !!poster);
            selectors.mediaRatingBadge.find('.rating-value').text('Loading...');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year || 'N/A'} • Loading...`);
            selectors.mediaPlot.text('Loading media details...');
        }

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`, 3, 500, state.abortController?.signal);
            mediaCache.set(id, type, data);
            updateUI(data);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(`Failed to fetch media details for ${title} (ID: ${id}, Type: ${type})`, error);
            if (!cachedData) {
                selectors.mediaDetailsTitle.text('Error loading details');
                selectors.mediaYearGenre.text('');
                selectors.mediaPlot.html('Failed to load media details. <button class="retry-button">Retry</button>');
                $('.retry-button').on('click', () => navigateToMedia(id, type, title, poster, year, season, episode, section));
            }
        }

        initializeServers();
        if (type === 'movie' || (type === 'tv' && season && episode)) {
            embedVideo();
        }
        if (type === 'tv') {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                selectors.seasonEpisodeAccordion.find(`.episode-btn[data-season="${season}"][data-episode="${episode}"]`).addClass('active');
            }
        }
    };

    // Navigate to Section
    const navigateToSection = section => {
        selectors.sidebarNavItems.removeClass('active');
        selectors.sidebarNavItems.filter(`[data-section="${section}"]`).addClass('active');
        if (section === 'home') {
            loadHomepage();
        } else if (section === 'search') {
            loadSearchSection();
        } else if (section === 'library') {
            selectors.homepage.hide();
            selectors.videoPage.hide();
            selectors.previewSection.hide();
            selectors.moviesSlider.parent().hide();
            selectors.tvSlider.parent().hide();
            selectors.animeSlider.parent().hide();
            selectors.kdramaSlider.parent().hide();
            selectors.searchSection.hide();
            selectors.librarySection.show();
            loadLibrary();
            stopPreviewSlideshow();
            window.history.replaceState({ section: 'library' }, '', '/library');
        }
    };

    // Setup Preview Touch
    const setupPreviewTouch = () => {
        let startX = 0, endX = 0;
        const container = selectors.previewItemsContainer;

        container.on('touchstart', e => {
            startX = e.originalEvent.touches[0].clientX;
            stopPreviewSlideshow();
        });

        container.on('touchmove', e => {
            endX = e.originalEvent.touches[0].clientX;
        });

        container.on('touchend', () => {
            if (Math.abs(startX - endX) > 50) {
                const items = container.find('.preview-item');
                const totalItems = items.length;
                if (startX > endX) {
                    state.previewIndex = (state.previewIndex + 1) % totalItems;
                } else {
                    state.previewIndex = (state.previewIndex - 1 + totalItems) % totalItems;
                }
                localStorage.setItem('previewIndex', state.previewIndex);
                container.css('transform', `translateX(-${state.previewIndex * 100}%)`);
            }
            startPreviewSlideshow();
        });
    };

    // Start Preview Slideshow
    const startPreviewSlideshow = () => {
        stopPreviewSlideshow();
        state.previewInterval = setInterval(() => {
            const items = selectors.previewItemsContainer.find('.preview-item');
            const totalItems = items.length;
            if (totalItems === 0) return;
            state.previewIndex = (state.previewIndex + 1) % totalItems;
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transform', `translateX(-${state.previewIndex * 100}%)`);
        }, 6000);
    };

    // Stop Preview Slideshow
    const stopPreviewSlideshow = () => {
        if (state.previewInterval) {
            clearInterval(state.previewInterval);
            state.previewInterval = null;
        }
    };

    // Event Listeners
    selectors.sidebarNavItems.on('click', function() {
        const section = $(this).data('section');
        navigateToSection(section);
    });

    selectors.backBtn.on('click', () => {
        if (state.previousSection === 'search') {
            navigateToSection('search');
        } else if (state.previousSection === 'library') {
            navigateToSection('library');
        } else {
            navigateToSection('home');
        }
    });

    selectors.watchlistBtn.on('click', () => {
        const id = state.mediaId;
        const type = state.mediaType;
        const title = selectors.videoMediaTitle.text().split('\n')[0];
        const poster = selectors.mediaPoster.attr('src');
        const rating = parseFloat(selectors.mediaRatingBadge.find('.rating-value').text()) || 0;
        toggleWatchlist({ id, type, title, poster, rating });
        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
    });

    // Debounced Search
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };

    selectors.searchInput.on('input', debounce(async () => {
        const query = selectors.searchInput.val().trim();
        if (query.length < 3) {
            selectors.searchResults.empty();
            return;
        }

        selectors.searchResults.empty();
        try {
            const type = selectors.searchFilter.val();
            const data = await fetchWithRetry(
                `https://api.themoviedb.org/3/search/${type}?api_key=${config.apiKey}&query=${encodeURIComponent(query)}`,
                3,
                500,
                state.abortController?.signal
            );
            const items = data.results
                .filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average)
                .slice(0, 12);
            if (items.length === 0) {
                selectors.searchResults.html('<div class="empty-message-container"><p class="empty-message">No results found.</p></div>');
            } else {
                for (const item of items) {
                    await renderItem({ ...item, type }, selectors.searchResults);
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Search failed', error);
            selectors.searchResults.html('<div class="error-message">Failed to load search results. <button class="retry-button">Retry</button></div>');
            $('.retry-button').on('click', () => selectors.searchInput.trigger('input'));
        }
    }, 300));

    selectors.searchFilter.on('change', loadSearchSection);

    window.onpopstate = async e => {
        const s = e.state;
        if (s && s.section) {
            navigateToSection(s.section);
        } else if (s && s.id && s.type) {
            await navigateToMedia(s.id, s.type, s.title, s.poster, s.year, s.season, s.episode, s.section);
        } else {
            navigateToSection('home');
        }
    };

    // Initial Load
    const handleInitialLoad = async () => {
        const path = window.location.pathname;
        const match = path.match(/^\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?$/);
        if (match) {
            const [, type, id, season, episode] = match;
            try {
                const data = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`, 3, 500);
                const title = data.title || data.name || 'Unknown';
                const year = (data.release_date || data.first_air_date || '').split('-')[0] || 'N/A';
                const poster = getImageUrl(data.poster_path);
                navigateToMedia(parseInt(id), type, title, poster, year, season ? parseInt(season) : null, episode ? parseInt(episode) : null, 'home');
            } catch (error) {
                console.error('Failed to load initial media', error);
                loadHomepage();
            }
        } else {
            const section = path === '/search' ? 'search' : path === '/library' ? 'library' : 'home';
            navigateToSection(section);
        }
    };

    handleInitialLoad();
});
