$(document).ready(() => {
    const selectors = {
        videoPage: $('#videoPage'),
        videoFrame: $('#videoFrame'),
        videoMediaTitle: $('#videoMediaTitle'),
        watchlistBtn: $('#watchlistBtn'),
        downloadBtn: $('#downloadBtn'),
        backBtn: $('.back-btn'),
        selectorContainer: $('#selectorContainer'),
        seasonSelector: $('#seasonSelector'),
        episodeSelector: $('#episodeSelector'),
        seasonGrid: $('#seasonGrid'),
        episodeGrid: $('#episodeGrid'),
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

    const state = {
        mediaType: 'movie',
        mediaId: null,
        season: null,
        episode: null,
        selectedEpisodes: {},
        trendingMovies: [],
        trendingTV: [],
        trendingAnime: [],
        trendingKdrama: [],
        previewItems: [],
        previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
        previewInterval: null,
        watchlist: (() => {
            try {
                return JSON.parse(localStorage.getItem('watchlist')) || [];
            } catch (e) {
                console.error('Error parsing watchlist from localStorage', e);
                return [];
            }
        })(),
        history: (() => {
            try {
                return JSON.parse(localStorage.getItem('history')) || [];
            } catch (e) {
                console.error('Error parsing history from localStorage', e);
                return [];
            }
        })(),
        swipeDirection: null,
        currentPlayingSeason: null,
        currentPlayingEpisode: null,
        seasonCache: {},
        previousSection: null,
        currentSection: 'home',
        isHomepageLoaded: false,
        isSearchLoaded: false,
        isLibraryLoaded: false,
        previousVideoUrl: null
    };

    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [
            { name: 'Server 1', url: 'https://vidfast.pro' },
            { name: 'Server 2', url: 'https://111movies.com' },
            { name: 'Server 3', url: 'https://vidsrc.cc/v2' }
        ],
        fallbackImage: 'https://via.placeholder.com/500x750.png?text=No+Image',
        baseUrl: 'https://showplay.netlify.app'
    };

    const handleError = (error, message, element) => {
        console.error(message, error);
        if (element && !element.is(selectors.previewSection)) {
            element.html(`<div class="error-message">${message}. <button class="retry-button">Retry</button></div>`);
        }
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const initializeServers = () => {
        selectors.serverGrid.empty();
        config.servers.forEach((server, i) => {
            const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}" aria-label="Select ${server.name}">${server.name}</button>`).data('url', server.url);
            btn.on('click', () => {
                $('.server-btn').removeClass('active');
                btn.addClass('active');
                if (state.mediaId && (state.mediaType === 'movie' || (state.currentPlayingSeason && state.currentPlayingEpisode))) {
                    embedVideo();
                }
            });
            selectors.serverGrid.append(btn);
        });
    };

    const getServerUrl = () => $('.server-btn.active').data('url') || config.servers[0].url;

    const fetchMediaRating = async (id, mediaType) => {
        try {
            const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${config.apiKey}`;
            const data = await fetchWithRetry(url);
            return data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
        } catch (error) {
            console.error(`Error fetching rating for ${mediaType} ${id}`, error);
            return 'N/A';
        }
    };

    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        });
    };

    const addToHistory = (item, mediaType, section) => {
        const historyItem = {
            id: item.id,
            type: mediaType,
            title: item.title || item.name || 'Unknown',
            poster: item.poster_path || item.poster || '',
            year: (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A',
            timestamp: Date.now(),
            season: mediaType === 'tv' ? (state.currentPlayingSeason || item.season || null) : null,
            episode: mediaType === 'tv' ? (state.currentPlayingEpisode || item.episode || null) : null
        };
        // Remove existing entry with same id and type to keep only the most recent episode
        state.history = state.history.filter(h => !(h.id === historyItem.id && h.type === historyItem.type));
        state.history.unshift(historyItem);
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    const renderMediaItem = async (item, mediaType, container, isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        let rating = item.vote_average ? item.vote_average.toFixed(1) : item.rating || 'N/A';
        if (isLibrary && rating === 'N/A') {
            rating = await fetchMediaRating(item.id, mediaType);
        }
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const imageUrl = posterPath ? `https://image.tmdb.org/t/p/${isMobile ? 'w185' : 'w500'}${posterPath}` : config.fallbackImage;
        const episodeInfo = item.type === 'tv' && item.season && item.episode ? `S${item.season} E${item.episode}` : '';
        const poster = $(`
            <div class="poster-item">
                <div class="poster-img-placeholder"></div>
                <img src="${imageUrl}" alt="${title}" class="poster-img" role="button" aria-label="Play ${title}" />
                <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                ${episodeInfo ? `<span class="episode-info">${episodeInfo}</span>` : ''}
            </div>
        `);
        const img = poster.find('.poster-img');
        try {
            await loadImage(imageUrl);
            img.addClass('loaded');
            poster.find('.poster-img-placeholder').remove();
        } catch (error) {
            console.error(`Error loading image for ${title}`, error);
            img.attr('src', config.fallbackImage).addClass('loaded');
            poster.find('.poster-img-placeholder').remove();
        }

        img.on('click', e => {
            e.stopPropagation();
            const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
            const section = container.closest('.search-section').length ? 'search' : 
                           container.closest('.library-section').length ? 'library' : 'home';
            navigateToMedia(item.id, mediaType, title, imageUrl, year, item.season, item.episode, section);
            if (!isLibrary && (mediaType !== 'tv' || (item.season && item.episode))) {
                addToHistory(item, mediaType, section);
            }
        });

        if (isLibrary) {
            poster.find('.delete-badge').on('click', e => {
                e.stopPropagation();
                const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                if (listType === 'watchlist') {
                    state.watchlist = state.watchlist.filter(w => w.id !== item.id);
                    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
                } else {
                    state.history = state.history.filter(h => !(h.id === item.id && h.type === item.type));
                    localStorage.setItem('history', JSON.stringify(state.history));
                }
                loadLibrary(true);
            });
        }

        container.append(poster);
    };

    const loadLibrary = async (forceReload = false) => {
        if (state.isLibraryLoaded && !forceReload) {
            selectors.homepage.show();
            selectors.videoPage.hide();
            selectors.videoMediaTitle.hide();
            selectors.previewSection.hide();
            selectors.moviesSlider.parent().hide();
            selectors.tvSlider.parent().hide();
            selectors.animeSlider.parent().hide();
            selectors.kdramaSlider.parent().hide();
            selectors.searchSection.hide();
            selectors.librarySection.addClass('active').show();
            $('body').css('overflow-y', 'auto');
            window.history.pushState({ section: 'library' }, '', `${config.baseUrl}/library`);
            state.currentSection = 'library';
            return;
        }

        selectors.watchlistSlider.empty();
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            for (const item of state.watchlist) {
                await renderMediaItem(item, item.type, selectors.watchlistSlider, true);
            }
        }

        selectors.historySlider.empty();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            state.history.sort((a, b) => b.timestamp - a.timestamp);
            for (const item of state.history) {
                await renderMediaItem(item, item.type, selectors.historySlider, true);
            }
        }

        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.videoMediaTitle.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.searchSection.hide();
        selectors.librarySection.addClass('active').show();
        state.isLibraryLoaded = true;
        state.currentSection = 'library';
        $('body').css('overflow-y', 'auto');
        window.history.pushState({ section: 'library' }, '', `${config.baseUrl}/library`);
    };

    const fetchWithRetry = async (url, retries = 3, delay = 500) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                return await res.json();
            } catch (error) {
                console.warn(`Fetch attempt ${i + 1} failed for ${url}:`, error);
                if (i === retries - 1) {
                    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
                }
                await sleep(delay);
            }
        }
    };

    const fetchTrending = async (type, containerId) => {
        const container = $(`#${containerId}`);
        let url;
        if (type === 'movie') {
            url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${config.apiKey}`;
        } else if (type === 'tv') {
            url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${config.apiKey}`;
        } else if (type === 'anime') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_genres=16&sort_by=popularity.desc&with_original_language=ja&vote_average.gte=8&vote_count.gte=1000&first_air_date.gte=1990-01-01`;
        } else if (type === 'kdrama') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=ko&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100&first_air_date.gte=2020-01-01`;
        } else {
            return [];
        }

        try {
            let items = [], page = 1, maxPages = 2;
            while (items.length < 12 && page <= maxPages) {
                const data = await fetchWithRetry(`${url}&page=${page}`);
                let validItems = data.results.filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average);
                items = items.concat(validItems);
                page++;
            }
            return items.slice(0, 12);
        } catch (error) {
            handleError(error, `Failed to load ${type} content`, container);
            return [];
        }
    };

    const fetchSearchResults = async (query, filter) => {
        let url = `https://api.themoviedb.org/3/search/multi?api_key=${config.apiKey}&query=${encodeURIComponent(query)}&page=1`;
        try {
            const data = await fetchWithRetry(url);
            let results = data.results.filter(item => 
                (item.media_type === 'movie' || item.media_type === 'tv') &&
                item.id && (item.title || item.name) && item.poster_path && item.vote_average
            );

            if (filter === 'movie') {
                results = results.filter(item => item.media_type === 'movie');
            } else if (filter === 'tv') {
                results = results.filter(item => item.media_type === 'tv');
            }

            return results.slice(0, 20);
        } catch (error) {
            handleError(error, 'Failed to load search results', selectors.searchResults);
            return [];
        }
    };

    const renderSearchResults = items => {
        selectors.searchResults.empty();
        if (!items.length) {
            selectors.searchResults.html('<p class="text-center" style="color: #ccc;">No results found.</p>');
            return;
        }
        items.forEach(item => {
            const mediaType = item.media_type === 'movie' ? 'movie' : 'tv';
            renderMediaItem(item, mediaType, selectors.searchResults);
        });
    };

    const loadSearchSection = async (forceReload = false) => {
        if (state.isSearchLoaded && !forceReload) {
            selectors.homepage.show();
            selectors.videoPage.hide();
            selectors.videoMediaTitle.hide();
            selectors.previewSection.hide();
            selectors.moviesSlider.parent().hide();
            selectors.tvSlider.parent().hide();
            selectors.animeSlider.parent().hide();
            selectors.kdramaSlider.parent().hide();
            selectors.librarySection.hide();
            selectors.searchSection.addClass('active').show();
            selectors.searchInput.focus();
            stopPreviewSlideshow();
            $('body').css('overflow-y', 'auto');
            window.history.pushState({ section: 'search' }, '', `${config.baseUrl}/search`);
            state.currentSection = 'search';
            return;
        }

        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.videoMediaTitle.hide();
        selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide();
        selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide();
        selectors.kdramaSlider.parent().hide();
        selectors.librarySection.hide();
        selectors.searchSection.addClass('active').show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();
        $('body').css('overflow-y', 'auto');

        selectors.searchResults.empty();
        selectors.searchTrending.empty();
        const filter = selectors.searchFilter.val();
        if (filter === 'movie') {
            const trendingMovies = state.trendingMovies.slice(0, 12);
            trendingMovies.forEach(item => renderMediaItem(item, 'movie', selectors.searchTrending));
        } else if (filter === 'tv') {
            const trendingTV = state.trendingTV.slice(0, 12);
            trendingTV.forEach(item => renderMediaItem(item, 'tv', selectors.searchTrending));
        }
        state.isSearchLoaded = true;
        state.currentSection = 'search';
        window.history.pushState({ section: 'search' }, '', `${config.baseUrl}/search`);
    };

    const fetchMediaLogo = async (mediaId, mediaType) => {
        const url = `https://api.themoviedb.org/3/${mediaType}/${mediaId}/images?api_key=${config.apiKey}&include_image_language=en,null`;
        try {
            const data = await fetchWithRetry(url);
            await sleep(250);
            const logos = data.logos || [];
            const logo = logos.find(l => l.file_path && l.iso_639_1 === 'en') || logos[0];
            return logo ? `https://image.tmdb.org/t/p/original${logo.file_path}` : null;
        } catch (error) {
            console.error(`Error fetching logo for ${mediaType} ${mediaId}`, error);
            return null;
        }
    };

    const preloadImages = urls => {
        return Promise.all(urls.map(url => new Promise(resolve => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`Failed to preload image: ${url}`);
                resolve();
            }
        })));
    };

    const loadTrendingMoviesForPreview = async () => {
        if (state.previewItems.length >= 10) return state.previewItems;
        const baseUrl = `https://api.themoviedb.org/3/trending/all/day?api_key=${config.apiKey}`;
        try {
            let items = [], page = 1, maxPages = 5, desiredCount = 10;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(`${baseUrl}&page=${page}`);
                if (!data.results) throw new Error('No results in preview API response');
                const validItems = data.results.filter(m =>
                    m.id && (m.title || m.name) && m.backdrop_path && m.poster_path && 
                    (m.release_date || m.first_air_date) && m.vote_average && 
                    (m.media_type === 'movie' || m.media_type === 'tv')
                );
                const itemsWithLogos = await Promise.all(validItems.map(async m => {
                    const logoUrl = await fetchMediaLogo(m.id, m.media_type);
                    if (!logoUrl) return null;
                    return { ...m, logo_path: logoUrl };
                }));
                items = items.concat(itemsWithLogos.filter(m => m !== null));
                page++;
            }
            items = items.slice(0, desiredCount);
            state.previewItems = items;
            return items;
        } catch (error) {
            console.error('Failed to load preview items', error);
            return [];
        }
    };

    const renderPreviewContent = async (items) => {
        selectors.previewItemsContainer.empty();
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        const backdropSize = isDesktop ? 'original' : 'w780';

        for (const [i, item] of items.entries()) {
            const mediaType = item.media_type === 'movie' ? 'MOVIE' : 'TV';
            const releaseDate = new Date(item.release_date || item.first_air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const backdropUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/${backdropSize}${item.backdrop_path}` : config.fallbackImage;
            const isInWatchlist = state.watchlist.some(w => w.id === item.id);
            const previewItem = $(`
                <div class="preview-item" data-index="${i}">
                    <div class="preview-img-placeholder"></div>
                    <img class="preview-background" 
                         src="${backdropUrl}" 
                         alt="${item.title || item.name}" 
                         data-id="${item.id}" 
                         data-title="${item.title || item.name}" 
                         data-poster="https://image.tmdb.org/t/p/w500${item.poster_path || ''}" 
                         data-year="${item.release_date || item.first_air_date}">
                    <div class="preview-background-overlay"></div>
                    <div class="preview-overlay"></div>
                    <div class="preview-content">
                        <img class="preview-title" src="${item.logo_path}" alt="${item.title || item.name}">
                        <div class="preview-meta">
                            <span class="release-date">${mediaType} • ${releaseDate}</span>
                            <span class="rating"><i class="fas fa-star"></i><span class="rating-value">${item.vote_average.toFixed(1)}</span></span>
                        </div>
                        <p class="preview-description">${item.overview || 'No description available.'}</p>
                        <div class="preview-buttons">
                            <button class="preview-btn play-btn"><i class="fa-solid fa-play"></i> Watch</button>
                            <button class="preview-btn secondary add-btn"><i class="${isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus'}"></i></button>
                        </div>
                    </div>
                </div>
            `);

            const backgroundImg = previewItem.find('.preview-background');
            try {
                await loadImage(backdropUrl);
                backgroundImg.addClass('loaded');
                previewItem.find('.preview-img-placeholder').remove();
                selectors.previewSection.find('.preview-placeholder').remove();
            } catch (error) {
                console.warn(`Error loading backdrop for ${item.title || item.name}`, error);
                backgroundImg.attr('src', config.fallbackImage).addClass('loaded');
                previewItem.find('.preview-img-placeholder').remove();
                selectors.previewSection.find('.preview-placeholder').remove();
            }

            previewItem.find('.play-btn').on('click', e => {
                e.stopPropagation();
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const mediaType = item.media_type === 'movie' ? 'movie' : 'tv';
                navigateToMedia(item.id, mediaType, item.title || item.name, `https://image.tmdb.org/t/p/w500${item.poster_path || ''}`, year, null, null, 'home');
                if (mediaType === 'movie') {
                    addToHistory(item, mediaType, 'home');
                }
            });

            previewItem.find('.add-btn').on('click', e => {
                e.stopPropagation();
                const mediaType = item.media_type === 'movie' ? 'movie' : 'tv';
                const itemData = { 
                    id: item.id, 
                    type: mediaType, 
                    title: item.title || item.name, 
                    poster: item.poster_path || '', 
                    timestamp: Date.now() 
                };
                const isInWatchlist = state.watchlist.some(w => w.id === item.id);
                if (isInWatchlist) {
                    state.watchlist = state.watchlist.filter(w => w.id !== item.id);
                    $(e.currentTarget).html('<i class="fas fa-plus"></i>');
                } else {
                    state.watchlist.push(itemData);
                    $(e.currentTarget).html('<i class="fa-solid fa-check"></i>');
                }
                localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
            });

            selectors.previewItemsContainer.append(previewItem);
        }

        updatePreviewContent(state.previewIndex);
    };

    const updatePreviewContent = (index, direction = null) => {
        if (!state.previewItems.length) return;

        const $items = $('.preview-item');
        const totalItems = $items.length;
        state.previewIndex = index % totalItems;
        if (state.previewIndex < 0) state.previewIndex += totalItems;
        const translateX = -state.previewIndex * 100;
        selectors.previewItemsContainer.css('transform', `translateX(${translateX}%)`);

        const nextIndices = [(state.previewIndex + 1) % totalItems, (state.previewIndex + 2) % totalItems];
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        const backdropSize = isDesktop ? 'original' : 'w780';
        nextIndices.forEach(i => {
            if (state.previewItems[i]) {
                preloadImages([
                    `https://image.tmdb.org/t/p/${backdropSize}${state.previewItems[i].backdrop_path || ''}`,
                    state.previewItems[i].logo_path
                ]);
            }
        });
    };

    const setupPreviewTouch = () => {
        let touchStartX = 0, touchEndX = 0;
        selectors.previewSection.off('touchstart touchmove touchend');
        selectors.previewSection.on({
            touchstart: e => {
                if (!$(e.target).closest('.preview-btn').length) touchStartX = e.originalEvent.touches[0].clientX;
            },
            touchmove: e => {
                if (!$(e.target).closest('.preview-btn').length) touchEndX = e.originalEvent.touches[0].clientX;
            },
            touchend: e => {
                if (!$(e.target).closest('.preview-btn').length && touchStartX && touchEndX) {
                    const diff = touchStartX - touchEndX;
                    if (Math.abs(diff) > 50) {
                        stopPreviewSlideshow();
                        state.swipeDirection = diff > 0 ? 'left' : 'right';
                        state.previewIndex = diff > 0
                            ? (state.previewIndex + 1) % state.previewItems.length
                            : (state.previewIndex - 1 + state.previewItems.length) % state.previewItems.length;
                        localStorage.setItem('previewIndex', state.previewIndex);
                        updatePreviewContent(state.previewIndex, state.swipeDirection);
                        startPreviewSlideshow();
                    }
                    touchStartX = touchEndX = 0;
                }
            }
        });
    };

    const startPreviewSlideshow = () => {
        if (state.previewInterval || selectors.videoPage.is(':visible') || !state.previewItems.length) return;
        state.previewInterval = setInterval(() => {
            state.previewIndex = (state.previewIndex + 1) % state.previewItems.length;
            localStorage.setItem('previewIndex', state.previewIndex);
            updatePreviewContent(state.previewIndex);
        }, 6000);
    };

    const stopPreviewSlideshow = () => {
        if (state.previewInterval) {
            clearInterval(state.previewInterval);
            state.previewInterval = null;
        }
    };

    const loadInitialContent = async () => {
        try {
            const promises = [];
            if (!state.previewItems.length) promises.push(loadTrendingMoviesForPreview());
            if (!state.trendingMovies.length) promises.push(fetchTrending('movie', 'moviesSliderContainer'));
            if (!state.trendingTV.length) promises.push(fetchTrending('tv', 'tvSliderContainer'));
            if (!state.trendingAnime.length) promises.push(fetchTrending('anime', 'animeSliderContainer'));
            if (!state.trendingKdrama.length) promises.push(fetchTrending('kdrama', 'kdramaSliderContainer'));

            const [previewItems, movieItems, tvItems, animeItems, kdramaItems] = await Promise.all(promises);

            if (movieItems) state.trendingMovies = movieItems;
            if (tvItems) state.trendingTV = tvItems;
            if (animeItems) state.trendingAnime = animeItems;
            if (kdramaItems) state.trendingKdrama = kdramaItems;
            if (previewItems) state.previewItems = previewItems;

            localStorage.setItem('trendingMovies', JSON.stringify(state.trendingMovies));
            localStorage.setItem('trendingTV', JSON.stringify(state.trendingTV));
            localStorage.setItem('trendingAnime', JSON.stringify(state.trendingAnime));
            localStorage.setItem('trendingKdrama', JSON.stringify(state.trendingKdrama));

            const isMobile = window.matchMedia("(max-width: 767px)").matches;
            const backdropSize = isMobile ? 'w780' : 'original';
            const posterSize = isMobile ? 'w185' : 'w500';
            const preloadUrls = [
                ...state.previewItems.slice(0, 2).flatMap(m => [
                    `https://image.tmdb.org/t/p/${backdropSize}${m.backdrop_path || ''}`,
                    m.logo_path
                ]),
                ...state.trendingMovies.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                ...state.trendingTV.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                ...state.trendingAnime.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                ...state.trendingKdrama.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`)
            ].filter(url => url && !url.includes('null'));

            await preloadImages(preloadUrls);

            await renderPreviewContent(state.previewItems);
            selectors.moviesSlider.empty();
            for (const item of state.trendingMovies) await renderMediaItem(item, 'movie', selectors.moviesSlider);
            selectors.tvSlider.empty();
            for (const item of state.trendingTV) await renderMediaItem(item, 'tv', selectors.tvSlider);
            selectors.animeSlider.empty();
            for (const item of state.trendingAnime) await renderMediaItem(item, 'tv', selectors.animeSlider);
            selectors.kdramaSlider.empty();
            for (const item of state.trendingKdrama) await renderMediaItem(item, 'tv', selectors.kdramaSlider);

            return true;
        } catch (error) {
            console.error('Failed to load initial content', error);
            return false;
        }
    };

    const loadHomepage = async (forceReload = false) => {
        if (state.isHomepageLoaded && !forceReload) {
            selectors.homepage.show();
            selectors.videoPage.hide();
            selectors.videoMediaTitle.hide();
            selectors.previewSection.show();
            selectors.moviesSlider.parent().show();
            selectors.tvSlider.parent().show();
            selectors.animeSlider.parent().show();
            selectors.kdramaSlider.parent().show();
            selectors.librarySection.hide();
            selectors.searchSection.hide();
            setupPreviewTouch();
            startPreviewSlideshow();
            $('body').css('overflow-y', 'auto');
            window.history.pushState({ section: 'home' }, '', `${config.baseUrl}/home`);
            state.currentSection = 'home';
            return;
        }

        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.videoMediaTitle.hide();
        selectors.previewSection.show();
        selectors.moviesSlider.parent().show();
        selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show();
        selectors.kdramaSlider.parent().show();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        try {
            const loaded = await loadInitialContent();
            if (loaded) {
                setupPreviewTouch();
                startPreviewSlideshow();
            }
            state.isHomepageLoaded = true;
            state.currentSection = 'home';
            window.history.pushState({ section: 'home' }, '', `${config.baseUrl}/home`);
        } catch (error) {
            console.error('Failed to load homepage', error);
        }
        $('body').css('overflow-y', 'auto');
    };

    const navigateToMedia = (id, type, title, poster, year, season = null, episode = null, section = null) => {
        stopPreviewSlideshow();
        state.mediaId = id;
        state.mediaType = type;
        state.season = type === 'tv' ? (season || 1) : null;
        state.episode = episode;
        state.currentPlayingSeason = type === 'tv' ? (season || 1) : null;
        state.currentPlayingEpisode = episode;
        state.selectedEpisodes = {};
        state.previousSection = section || state.previousSection || 'home';

        const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}${season && episode ? `?season=${season}&episode=${episode}` : ''}`;
        window.history.pushState({ id, type, title, poster, year, season, episode, section: state.previousSection }, '', `${config.baseUrl}${path}`);

        selectors.videoPage.data({ id, type, title, poster, year });

        const isInWatchlist = state.watchlist.some(w => w.id === id);
        selectors.watchlistBtn.html(`Add to Watchlist <i class="${isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);

        let downloadUrl = type === 'movie'
            ? `https://dl.vidsrc.vip/movie/${id}`
            : `https://dl.vidsrc.vip/tv/${id}${season && episode ? `/${season}/${episode}` : '/1/1'}`;
        selectors.downloadBtn.attr('href', downloadUrl);

        handleMediaClick(title, poster, year);
        if (type === 'movie' || (type === 'tv' && season && episode)) {
            const item = { id, type, title, poster, year, season, episode };
            addToHistory(item, type, state.previousSection);
        }
        state.currentSection = 'video';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const navigateBack = () => {
        if (state.previousSection === 'search') {
            loadSearchSection();
        } else if (state.previousSection === 'library') {
            loadLibrary();
        } else {
            loadHomepage();
        }
    };

    const handleMediaClick = async (title, poster, year) => {
        selectors.videoPage.data({ id: state.mediaId, type: state.mediaType, title, poster, year });

        selectors.videoPage.addClass('active').show();
        selectors.homepage.hide();
        selectors.videoMediaTitle.show();

        const displayTitle = `${title}\n(${year ? year.split('-')[0] : 'N/A'})`;
        selectors.videoMediaTitle.text(displayTitle);
        selectors.seasonSelector.toggle(state.mediaType === 'tv');
        selectors.episodeSelector.toggle(state.mediaType === 'tv');

        try {
            await fetchMediaDetails();
            if (state.mediaType === 'movie') {
                embedVideo();
            } else {
                await loadSeasons();
                await loadEpisodes(state.currentPlayingSeason || 1);
                if (state.currentPlayingSeason && state.currentPlayingEpisode) {
                    embedVideo();
                }
            }
        } catch (error) {
            handleError(error, 'Failed to load media details', selectors.mediaDetails);
        }
    };

    const fetchMediaDetails = async () => {
        const url = `https://api.themoviedb.org/3/${state.mediaType}/${state.mediaId}?api_key=${config.apiKey}`;
        try {
            const data = await fetchWithRetry(url);
            if (!data.id || !(data.title || data.name)) {
                throw new Error('Invalid media data');
            }
            const posterUrl = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : config.fallbackImage;
            const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
            const year = (data.release_date || data.first_air_date || '').split('-')[0] || 'N/A';
            const genres = data.genres ? data.genres.map(g => g.name).join(', ') : 'N/A';
            selectors.mediaPoster.attr('src', posterUrl);
            selectors.mediaRatingBadge.find('.rating-value').text(rating);
            selectors.mediaDetailsTitle.text(data.title || data.name || 'Unknown');
            selectors.mediaYearGenre.text(`${year} • ${genres}`);
            selectors.mediaPlot.text(data.overview || 'No description available.');
            selectors.mediaDetails.addClass('active');
            return data;
        } catch (error) {
            console.error('Error fetching media details', error);
            throw error;
        }
    };

    const loadSeasons = async () => {
        selectors.seasonGrid.empty();
        const cacheKey = `${state.mediaId}_seasons`;
        if (state.seasonCache[cacheKey]) {
            renderSeasons(state.seasonCache[cacheKey]);
            return;
        }

        const url = `https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`;
        try {
            const data = await fetchWithRetry(url);
            const seasons = data.seasons.filter(s => s.season_number > 0 && s.episode_count > 0);
            state.seasonCache[cacheKey] = seasons;
            renderSeasons(seasons);
        } catch (error) {
            handleError(error, 'Failed to load seasons', selectors.seasonGrid);
        }
    };

    const renderSeasons = seasons => {
        selectors.seasonGrid.empty();
        seasons.forEach(s => {
            const btn = $(`<button class="season-btn" aria-label="Select Season ${s.season_number}">Season ${s.season_number}</button>`).data('season', s.season_number);
            if (s.season_number === state.currentPlayingSeason) {
                btn.addClass('active');
            }
            btn.on('click', async () => {
                $('.season-btn').removeClass('active');
                btn.addClass('active');
                state.currentPlayingSeason = s.season_number;
                if (!state.currentPlayingEpisode) {
                    state.currentPlayingEpisode = null;
                }
                await loadEpisodes(s.season_number);
            });
            selectors.seasonGrid.append(btn);
        });
    };

    const loadEpisodes = async seasonNumber => {
        selectors.episodeGrid.empty();
        const cacheKey = `${state.mediaId}_season_${seasonNumber}`;
        if (state.seasonCache[cacheKey]) {
            renderEpisodes(state.seasonCache[cacheKey], seasonNumber);
            return;
        }

        const url = `https://api.themoviedb.org/3/tv/${state.mediaId}/season/${seasonNumber}?api_key=${config.apiKey}`;
        try {
            const data = await fetchWithRetry(url);
            const episodes = data.episodes.filter(e => e.episode_number && e.air_date);
            state.seasonCache[cacheKey] = episodes;
            renderEpisodes(episodes, seasonNumber);
        } catch (error) {
            handleError(error, 'Failed to load episodes', selectors.episodeGrid);
        }
    };

    const renderEpisodes = (episodes, seasonNumber) => {
        selectors.episodeGrid.empty();
        episodes.forEach(e => {
            const btn = $(`<button class="episode-btn" aria-label="Select episode ${e.episode_number}">${e.episode_number}</button>`).data('episode', e.episode_number);
            if (e.episode_number === state.currentPlayingEpisode && state.currentPlayingSeason === seasonNumber) {
                btn.addClass('active');
            }
            btn.on('click', () => {
                $('.episode-btn').removeClass('active');
                btn.addClass('active');
                state.currentPlayingEpisode = e.episode_number;
                state.selectedEpisodes[seasonNumber] = e.episode_number;
                embedVideo();
                updateHistoryWithEpisode();
            });
            selectors.episodeGrid.append(btn);
        });
    };

    const updateHistoryWithEpisode = () => {
        if (state.currentPlayingSeason && state.currentPlayingEpisode) {
            const item = {
                id: state.mediaId,
                type: state.mediaType,
                title: selectors.videoMediaTitle.text().split('\n')[0],
                poster: selectors.videoPage.data('poster'),
                year: selectors.videoPage.data('year'),
                season: state.currentPlayingSeason,
                episode: state.currentPlayingEpisode
            };
            addToHistory(item, state.mediaType, state.previousSection);
        }
    };

    const embedVideo = () => {
        let videoUrl;
        const serverUrl = getServerUrl();
        if (state.mediaType === 'movie') {
            videoUrl = `${serverUrl}/embed/movie/${state.mediaId}`;
        } else if (state.currentPlayingSeason && state.currentPlayingEpisode) {
            videoUrl = `${serverUrl}/embed/tv/${state.mediaId}/${state.currentPlayingSeason}/${state.currentPlayingEpisode}`;
        } else {
            return;
        }
        if (videoUrl !== state.previousVideoUrl) {
            selectors.videoFrame.attr('src', videoUrl);
            state.previousVideoUrl = videoUrl;
        }
        selectors.selectorContainer.addClass('active');
    };

    selectors.watchlistBtn.on('click', () => {
        const item = {
            id: state.mediaId,
            type: state.mediaType,
            title: selectors.videoMediaTitle.text().split('\n')[0],
            poster: selectors.videoPage.data('poster'),
            year: selectors.videoPage.data('year'),
            timestamp: Date.now()
        };
        const isInWatchlist = state.watchlist.some(w => w.id === item.id);
        if (isInWatchlist) {
            state.watchlist = state.watchlist.filter(w => w.id !== item.id);
            selectors.watchlistBtn.html('Add to Watchlist <i class="fas fa-plus"></i>');
        } else {
            state.watchlist.push(item);
            selectors.watchlistBtn.html('Add to Watchlist <i class="fa-solid fa-check"></i>');
        }
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    });

    selectors.backBtn.on('click', () => {
        navigateBack();
    });

    selectors.sidebarNavItems.on('click', function() {
        const section = $(this).data('section');
        selectors.sidebarNavItems.removeClass('active');
        $(this).addClass('active');

        stopPreviewSlideshow();
        if (section === 'home') {
            loadHomepage();
        } else if (section === 'search') {
            loadSearchSection();
        } else if (section === 'library') {
            loadLibrary();
        }
    });

    let searchTimeout;
    selectors.searchInput.on('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const query = selectors.searchInput.val().trim();
            if (query.length < 3) {
                selectors.searchResults.empty();
                selectors.searchTrending.show();
                return;
            }
            selectors.searchTrending.hide();
            const filter = selectors.searchFilter.val();
            const results = await fetchSearchResults(query, filter);
            renderSearchResults(results);
        }, 500);
    });

    selectors.searchFilter.on('change', () => {
        selectors.searchTrending.empty();
        const filter = selectors.searchFilter.val();
        if (filter === 'movie') {
            const trendingMovies = state.trendingMovies.slice(0, 12);
            trendingMovies.forEach(item => renderMediaItem(item, 'movie', selectors.searchTrending));
        } else if (filter === 'tv') {
            const trendingTV = state.trendingTV.slice(0, 12);
            trendingTV.forEach(item => renderMediaItem(item, 'tv', selectors.searchTrending));
        }
        if (selectors.searchInput.val().trim().length >= 3) {
            selectors.searchInput.trigger('input');
        }
    });

    window.addEventListener('popstate', e => {
        const stateData = e.state || {};
        if (stateData.section === 'home') {
            loadHomepage();
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
        } else if (stateData.section === 'search') {
            loadSearchSection();
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="search"]').addClass('active');
        } else if (stateData.section === 'library') {
            loadLibrary();
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="library"]').addClass('active');
        } else if (stateData.id && stateData.type) {
            navigateToMedia(
                stateData.id,
                stateData.type,
                stateData.title,
                stateData.poster,
                stateData.year,
                stateData.season,
                stateData.episode,
                stateData.section
            );
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
        } else {
            loadHomepage();
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
        }
    });

    const initialize = async () => {
        initializeServers();
        const currentPath = window.location.pathname;
        if (currentPath === '/library') {
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="library"]').addClass('active');
            loadLibrary();
        } else if (currentPath === '/search') {
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="search"]').addClass('active');
            loadSearchSection();
        } else if (currentPath === '/' || currentPath === '/home') {
            selectors.sidebarNavItems.removeClass('active');
            selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
            loadHomepage();
        } else {
            const mediaMatch = currentPath.match(/^\/(movie|tv)\/(\d+)$/);
            if (mediaMatch) {
                const [, type, id] = mediaMatch;
                state.mediaId = parseInt(id);
                state.mediaType = type;
                try {
                    const data = await fetchMediaDetails();
                    const title = data.title || data.name || 'Unknown';
                    const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : config.fallbackImage;
                    const year = (data.release_date || data.first_air_date || '').split('-')[0] || 'N/A';
                    navigateToMedia(state.mediaId, state.mediaType, title, poster, year, null, null, 'home');
                    selectors.sidebarNavItems.removeClass('active');
                    selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
                } catch (error) {
                    loadHomepage();
                    selectors.sidebarNavItems.removeClass('active');
                    selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
                }
            } else {
                loadHomepage();
                selectors.sidebarNavItems.removeClass('active');
                selectors.sidebarNavItems.filter('[data-section="home"]').addClass('active');
            }
        }
    };

    initialize();
});
