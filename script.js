$(document).ready(() => {
    // DOM Selectors
    const selectors = {
        appContainer: $('.app-container'),
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
        previousSection: 'home'
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09', // TODO: Move to server-side proxy
        servers: [
            { 
                name: 'Server 1', 
                url: 'https://vidfast.pro', 
                moviePattern: 'https://vidfast.pro/movie/{tmdb_id}', 
                tvPattern: 'https://vidfast.pro/tv/{tmdb_id}/{season}/{episode}' 
            },
            { 
                name: 'Server 2', 
                url: 'https://111movies.com', 
                moviePattern: 'https://111movies.com/movie/{tmdb_id}', 
                tvPattern: 'https://111movies.com/tv/{tmdb_id}/{season}/{episode}' 
            },
            { 
                name: 'Server 3', 
                url: 'https://vidsrc.cc/v2', 
                moviePattern: 'https://vidsrc.cc/v2/embed/movie/{tmdb_id}', 
                tvPattern: 'https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}' 
            }
        ],
        placeholderPoster: 'https://via.placeholder.com/140x210?text=Poster',
        placeholderBackdrop: 'https://via.placeholder.com/1280x720?text=Loading...'
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
        if (!path) return type === 'poster' ? config.placeholderPoster : config.placeholderBackdrop;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const size = type === 'backdrop' ? (isMobile ? 'w1280' : 'original') : (isMobile ? 'w185' : 'w500');
        return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}?format=webp`;
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
                if (state.mediaId && (state.mediaType === 'movie' || (state.season && state.episode))) {
                    embedVideo();
                }
            });
            selectors.serverGrid.append(btn);
        });
    };

    // Get Active Server
    const getActiveServer = () => $('.server-btn.active').data('server') || config.servers[0];

    // Embed Video
    const embedVideo = () => {
        if (!state.mediaId) {
            console.error('Cannot embed video: mediaId is not set');
            selectors.videoFrame.attr('src', '');
            return;
        }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) {
            console.error('Cannot embed TV video: season or episode is not set');
            selectors.videoFrame.attr('src', '');
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
        selectors.videoFrame.attr('src', src);
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
                const data = await fetchWithRetry(`${url}&page=${page}`);
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

    // Render Item (Preview, Slider, or Library)
    const renderItem = async (item, container, renderType = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = (item.vote_average || item.rating || 0).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath);
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
                    <img class="preview-background" src="${backdropUrl}" alt="${title}" data-id="${item.id}" data-title="${title}" data-poster="${imageUrl}">
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

            try {
                await loadImage(backdropUrl);
                previewItem.find('.preview-background').addClass('loaded');
            } catch (error) {
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
                previewItem.find('.add-btn').children('i').removeClass('fa-solid fa-check fas fa-plus').addClass(isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus');
            });

            container.append(previewItem);
        } else {
            const poster = createElement(`
                <div class="poster-item">
                    <img src="${imageUrl}" alt="${title}" class="poster-img" role="button" aria-label="Play ${title}"/>
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                </div>
            `);

            try {
                await loadImage(imageUrl);
                poster.find('.poster-img').addClass('loaded');
            } catch (error) {
                poster.find('.poster-img').attr('src', config.placeholderPoster);
                return;
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
                    state[listType] = state[listType].filter(i => {
                        const key = `${i.id}_${i.type}_${i.season ?? ''}_${i.episode ?? ''}`;
                        const itemKey = `${item.id}_${item.type}_${item.season ?? ''}_${item.episode ?? ''}`;
                        return key !== itemKey;
                    });
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    loadLibrary();
                });
            }

            container.append(poster);
        }
    };

    // Add to History
    const addToHistory = item => {
        const key = `${item.id}_${item.type}_${item.season ?? ''}_${item.episode ?? ''}`;
        state.history = state.history.filter(h => {
            const hKey = `${h.id}_${h.type}_${h.season ?? ''}_${h.episode ?? ''}`;
            return hKey !== key;
        });
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
        if (!state.watchlist.length) {
            selectors.watchlistSlider.append('<div class="empty-message-container"><p class="message">Your watchlist is empty.</p></div>');
        } else {
            for (const item of state.watchlist) {
                await renderItem(item, selectors.watchlistSlider, 'slider', true);
            }
        }

        selectors.historySlider.empty();
        if (!state.history.length) {
            selectors.historySlider.append('<div class="empty-message-container"><p class="message">Your history is empty.</p></div>');
        } else {
            state.history.sort((a, b) => b.timestamp - a.timestamp);
            const seen = new Set();
            const uniqueHistory = [];
            for (const item of state.history) {
                const key = `${item.id}_${item.type}_${item.season ?? ''}_${item.episode ?? ''}`;
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
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`);
            const seasons = data.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
            if (!seasons.length) {
                selectors.seasonEpisodeAccordion.append('<p class="empty-message">No seasons available.</p>');
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
                    episodeList.append('<p class="empty-message">No episodes available.</p>');
                    continue;
                }

                episodes.forEach(ep => {
                    const btn = $(`
                        <button class="episode-btn" data-season="${season.season_number}" data-episode="${ep.episode_number}">
                            <span>Episode ${ep.episode_number}: ${ep.name || 'Untitled'}</span>
                        </button>
                    `);
                    btn.on('click', () => {
                        $('.btn-default').removeClass('active');
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

            if (state.season && state.episode) {
                $(`.episode-btn[data-season="${state.season}"][data-episode="${state.episode}"]`).addClass('active');
            }
        } catch (error) {
            console.error('Failed to load seasons/episodes', error);
            selectors.seasonEpisodeAccordion.append('<p class="empty-message">Failed to load seasons/episodes.</p>');
        }
    };

    // Reset Video Player State
    const resetVideoPlayerState = () => {
        state.mediaId = null;
        state.mediaType = 'movie';
        state.season = null;
        state.episode = null;
        selectors.videoFrame.attr('src', '');
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', config.placeholderPoster).attr('alt', '');
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
        selectors.appContainer.attr('data-section', 'home');
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.show();
        selectors.moviesSlider.parent().show();
        selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show();
        selectors.kdramaSlider.parent().show();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        window.history.replaceState({ section: 'home' }, '', '/home');

        try {
            const [previewItems, movies, tv, anime, kdrama] = await Promise.all([
                fetchMedia('trending', true),
                fetchMedia('movie'),
                fetchMedia('tv'),
                fetchMedia('anime'),
                fetchMedia('kdrama')
            ]);

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
        } catch (error) {
            console.error('Failed to load homepage', error);
            selectors.previewSection.html('<div class="error-message">Failed to load content. <button class="retry-button">Retry</button></div>');
            $('.retry-button').on('click', loadHomepage);
        }
    };

    // Load Search Section
    const loadSearchSection = () => {
        selectors.appContainer.attr('data-section', 'search');
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.librarySection.hide();
        selectors.searchSection.show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();

        window.history.replaceState({ section: 'search' }, '', '/search');

        selectors.searchResults.empty();
        selectors.searchTrending.empty();
        const filter = selectors.searchFilter.val();
        const trending = filter === 'movie' ? fetchMedia('movie') : fetchMedia('tv');
        trending.then(items => items.forEach(item => renderItem(item, selectors.searchTrending)));
    };

    // Load Library Section
    const loadLibrarySection = () => {
        selectors.appContainer.attr('data-section', 'library');
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.librarySection.show();
        selectors.searchSection.hide();
        stopPreviewSlideshow();
        loadLibrary();

        window.history.replaceState({ section: 'library' }, '', '/library');
    };

    // Navigate to Media
    const navigateToMedia = async (id, type, title, poster, year, season = null, episode = null, section = null) => {
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

        let mediaData;
        const cachedData = mediaCache.get(id, type);
        if (cachedData) {
            mediaData = cachedData;
            title = title !== 'Loading...' ? title : (mediaData.title || mediaData.name || 'Unknown');
            year = year !== 'N/A' ? year : (mediaData.release_date || mediaData.first_air_date || '').split('-')[0] || 'N/A';
            poster = poster || getImageUrl(mediaData.poster_path);
        } else {
            try {
                mediaData = await fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`);
                title = title !== 'Loading...' ? title : (mediaData.title || mediaData.name || 'Unknown');
                year = year !== 'N/A' ? year : (mediaData.release_date || mediaData.first_air_date || '').split('-')[0] || 'N/A';
                poster = poster || getImageUrl(mediaData.poster_path);
            } catch (error) {
                console.error(`Media not found: ID=${id}, Type=${type}`, error);
                selectors.mediaDetailsTitle.text('Media Not Found');
                selectors.mediaPlot.text('The requested media is not available. Please try another title.');
                loadHomepage();
                return;
            }
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

        selectors.appContainer.attr('data-section', 'video');
        selectors.videoPage.data({ id, type, title, poster, year });

        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
        selectors.downloadBtn.attr('href', type === 'movie' ? `https://dl.vidsrc.vip/movie/${id}` : `https://dl.vidsrc.vip/tv/${id}/${state.season || 1}/${state.episode || 1}`);

        selectors.videoPage.show();
        selectors.homepage.hide();
        selectors.videoMediaTitle.show().text(`${title}\n(${year})`);
        selectors.selectorContainer.show();
        selectors.mediaDetails.show();

        const updateUI = (data) => {
            const genres = data.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            selectors.mediaPoster.attr('src', getImageUrl(data.poster_path) || poster).attr('alt', `${title} Poster`).addClass('loaded');
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average?.toFixed(1) || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year} • ${genres.join(', ')}`);
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        if (cachedData) {
            updateUI(cachedData);
        } else {
            selectors.mediaPoster.attr('src', poster).attr('alt', `${title} Poster`);
            selectors.mediaRatingBadge.find('.rating-value').text('Loading...');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year} • Loading...`);
            selectors.mediaPlot.text('Loading media details...');
            try {
                mediaCache.set(id, type, mediaData);
                updateUI(mediaData);
            } catch (error) {
                console.error(`Failed to fetch media details for ${title} (ID: ${id}, Type: ${type})`, error);
                selectors.mediaDetailsTitle.text('Error loading details');
                selectors.mediaYearGenre.text('');
                selectors.mediaPlot.html('Failed to load media details. <button class="retry-button">Retry</button>');
                $('.retry-button').on('click', () => navigateToMedia(id, type, title, poster, year, season, episode, section));
            }
        }

        if (type === 'movie') {
            embedVideo();
        } else {
            loadSeasonEpisodeAccordion();
            if (season && episode) {
                embedVideo();
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
            loadLibrarySection();
        }
    };

    // Setup Preview Touch
    const setupPreviewTouch = () => {
        let startX = 0;
        selectors.previewSection.on('touchstart', e => startX = e.originalEvent.touches[0].clientX);
        selectors.previewSection.on('touchend', e => {
            const endX = e.originalEvent.changedTouches[0].clientX;
            if (Math.abs(startX - endX) > 50) {
                stopPreviewSlideshow();
                state.previewIndex += startX > endX ? 1 : -1;
                if (state.previewIndex < 0) state.previewIndex = selectors.previewItemsContainer.children().length - 1;
                if (state.previewIndex >= selectors.previewItemsContainer.children().length) state.previewIndex = 0;
                localStorage.setItem('previewIndex', state.previewIndex);
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
                startPreviewSlideshow();
            }
        });
    };

    // Start Preview Slideshow
    const startPreviewSlideshow = () => {
        if (state.previewInterval || selectors.videoPage.is(':visible')) return;
        state.previewInterval = setInterval(() => {
            state.previewIndex = (state.previewIndex + 1) % selectors.previewItemsContainer.children().length;
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
        }, 6000);
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
        const { id, type, title, poster } = selectors.videoPage.data();
        toggleWatchlist({ id, type: state.mediaType, title, poster, rating: selectors.mediaRatingBadge.find('.rating-value').text() || 0 });
        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
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
        if (query.length < 2) {
            selectors.searchResults.empty();
            loadSearchSection();
            return;
        }
        selectors.searchTrending.empty();
        const filter = selectors.searchFilter.val();
        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/search/multi?api_key=${config.apiKey}&query=${encodeURIComponent(query)}&page=1`);
            const results = data.results.filter(item => 
                (item.media_type === filter || filter === 'all') &&
                item.id && (item.title || item.name) && item.poster_path && item.vote_average
            ).slice(0, 20);
            selectors.searchResults.empty();
            if (!results.length) {
                selectors.searchResults.append('<p class="text-center" style="color: #ccc;">No results found.</p>');
            } else {
                results.forEach(item => renderItem(item, selectors.searchResults));
            }
        } catch (error) {
            console.error('Search failed', error);
            selectors.searchResults.append('<p class="text-center" style="color: #ccc;">Failed to load search results. Please try again.</p>');
        }
    };

    selectors.searchInput.on('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });

    selectors.searchFilter.on('change', () => {
        performSearch();
    });

    $(window).on('popstate', event => {
        const s = event.originalEvent.state;
        if (s && s.id && s.type) {
            navigateToMedia(s.id, s.type, s.title, s.poster, s.year, s.season, s.episode, s.section);
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
            $('.poster-img, .preview-background').each(function() {
                const src = $(this).attr('src');
                if (src && src !== config.placeholderPoster && src !== config.placeholderBackdrop) {
                    const type = $(this).hasClass('preview-background') ? 'backdrop' : 'poster';
                    $(this).attr('src', getImageUrl(src.split('/').pop(), type)).addClass('loaded');
                }
            });
            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            }
        }, 200);
    });

    // Handle Initial Load
    const handleInitialLoad = async () => {
        const path = window.location.pathname;
        const movieMatch = path.match(/^\/movie\/(\d+)$/);
        const tvMatch = path.match(/^\/tv\/(\d+)(?:\/(\d+)\/(\d+))?$/);

        if (movieMatch) {
            const id = movieMatch[1];
            const cachedData = mediaCache.get(id, 'movie');
            const title = cachedData ? (cachedData.title || 'Unknown') : 'Loading...';
            const year = cachedData ? (cachedData.release_date?.split('-')[0] || 'N/A') : 'N/A';
            const poster = cachedData ? getImageUrl(cachedData.poster_path) : config.placeholderPoster;
            navigateToMedia(id, 'movie', title, poster, year, null, null, 'home');
        } else if (tvMatch) {
            const id = tvMatch[1];
            const season = tvMatch[2] ? parseInt(tvMatch[2]) : null;
            const episode = tvMatch[3] ? parseInt(tvMatch[3]) : null;
            const cachedData = mediaCache.get(id, 'tv');
            const title = cachedData ? (cachedData.name || 'Unknown') : 'Loading...';
            const year = cachedData ? (cachedData.first_air_date?.split('-')[0] || 'N/A') : 'N/A';
            const poster = cachedData ? getImageUrl(cachedData.poster_path) : config.placeholderPoster;
            navigateToMedia(id, 'tv', title, poster, year, season, episode, 'home');
        } else if (path === '/search') {
            loadSearchSection();
        } else if (path === '/library') {
            loadLibrarySection();
        } else {
            loadHomepage();
        }
    };

    // Initialize
    initializeServers();
    handleInitialLoad();
});
