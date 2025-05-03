// Fallback for jQuery if CDN fails
if (typeof jQuery === 'undefined') {
    document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" integrity="sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ==" crossorigin="anonymous">\<\/script>');
}

// Main script, executed after jQuery is loaded
(function() {
    // Ensure jQuery is available before proceeding
    if (!window.jQuery) {
        console.error('jQuery failed to load. Please check your network connection or CDN availability.');
        document.body.insertAdjacentHTML('beforeend', '<div style="text-align: center; color: #ccc; font-size: 1rem; margin: 20px;">Failed to load required resources. Please check your connection.</div>');
        return;
    }

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
            previewMovies: [],
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
            previousSection: null
        };

        const config = {
            apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
            servers: [
                { name: 'Server 1', url: 'https://vidfast.pro' },
                { name: 'Server 2', url: 'https://111movies.com' },
                { name: 'Server 3', url: 'https://vidsrc.cc/v2' }
            ],
            fallbackImage: 'https://via.placeholder.com/500x750.png?text=No+Image'
        };

        const handleError = (error, message, element) => {
            console.error(message, error);
            if (element) {
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
            state.history = state.history.filter(h => h.id !== item.id || h.season !== historyItem.season || h.episode !== historyItem.episode);
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
            const poster = $(`
                <div class="poster-item">
                    <div class="poster-img-placeholder"></div>
                    <img src="${imageUrl}" alt="${title}" class="poster-img" role="button" aria-label="Play ${title}" />
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
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
                if (!isLibrary) {
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
                        state.history = state.history.filter(h => !(h.id === item.id && h.season === item.season && h.episode === item.episode));
                        localStorage.setItem('history', JSON.stringify(state.history));
                    }
                    loadLibrary();
                });
            }

            container.append(poster);
        };

        const loadLibrary = async () => {
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

            selectors.librarySection.addClass('active').show();
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

        const loadSearchSection = async () => {
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
        };

        const fetchMovieLogo = async movieId => {
            const url = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${config.apiKey}&include_image_language=en,null`;
            try {
                const data = await fetchWithRetry(url);
                await sleep(250);
                const logos = data.logos || [];
                const logo = logos.find(l => l.file_path && l.iso_639_1 === 'en') || logos[0];
                return logo ? `https://image.tmdb.org/t/p/original${logo.file_path}` : null;
            } catch (error) {
                console.error(`Error fetching logo for movie ${movieId}`, error);
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
                };
            })));
        };

        const loadTrendingMoviesForPreview = async () => {
            const baseUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${config.apiKey}`;
            try {
                let movies = [], page = 1, maxPages = 5, desiredCount = 5;
                while (movies.length < desiredCount && page <= maxPages) {
                    const data = await fetchWithRetry(`${baseUrl}&page=${page}`);
                    if (!data.results) throw new Error('No results in preview API response');
                    const validMovies = data.results.filter(m =>
                        m.id && m.title && m.backdrop_path && m.poster_path && m.release_date && m.vote_average && m.original_language === 'en'
                    );
                    const moviesWithLogos = await Promise.all(validMovies.map(async m => {
                        const logoUrl = await fetchMovieLogo(m.id);
                        if (!logoUrl) return null;
                        return { ...m, logo_path: logoUrl };
                    }));
                    movies = movies.concat(moviesWithLogos.filter(m => m !== null));
                    page++;
                }
                movies = movies.slice(0, desiredCount);
                if (!movies.length) throw new Error('No movies with logos found');
                state.previewMovies = movies;
                return movies;
            } catch (error) {
                handleError(error, 'Failed to load preview movies', selectors.previewSection);
                return [];
            }
        };

        const renderPreviewContent = async (movies) => {
            selectors.previewItemsContainer.empty();
            const isDesktop = window.matchMedia("(min-width: 768px)").matches;
            const backdropSize = isDesktop ? 'original' : 'w780';

            for (const [i, movie] of movies.entries()) {
                const releaseDate = new Date(movie.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/${backdropSize}${movie.backdrop_path}` : config.fallbackImage;
                const isInWatchlist = state.watchlist.some(w => w.id === movie.id);
                const previewItem = $(`
                    <div class="preview-item" data-index="${i}">
                        <div class="preview-img-placeholder"></div>
                        <img class="preview-background" 
                             src="${backdropUrl}" 
                             alt="${movie.title}" 
                             data-id="${movie.id}" 
                             data-title="${movie.title}" 
                             data-poster="https://image.tmdb.org/t/p/w500${movie.poster_path || ''}" 
                             data-year="${movie.release_date}">
                        <div class="preview-background-overlay"></div>
                        <div class="preview-overlay"></div>
                        <div class="preview-content">
                            <img class="preview-title" src="${movie.logo_path}" alt="${movie.title}">
                            <div class="preview-meta">
                                <span class="release-date">MOVIE • ${releaseDate}</span>
                                <span class="rating"><i class="fas fa-star"></i><span class="rating-value">${movie.vote_average.toFixed(1)}</span></span>
                            </div>
                            <p class="preview-description">${movie.overview || 'No description available.'}</p>
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
                    console.warn(`Error loading backdrop for ${movie.title}`, error);
                    backgroundImg.attr('src', config.fallbackImage).addClass('loaded');
                    previewItem.find('.preview-img-placeholder').remove();
                    selectors.previewSection.find('.preview-placeholder').remove();
                }

                previewItem.find('.play-btn').on('click', e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const year = movie.release_date;
                    navigateToMedia(movie.id, 'movie', movie.title, `https://image.tmdb.org/t/p/w500${movie.poster_path || ''}`, year, null, null, 'home');
                    addToHistory(movie, 'movie', 'home');
                });

                previewItem.find('.add-btn').on('click', e => {
                    e.stopPropagation();
                    const item = { id: movie.id, type: 'movie', title: movie.title, poster: movie.poster_path || '', timestamp: Date.now() };
                    const isInWatchlist = state.watchlist.some(w => w.id === item.id);
                    if (!isInWatchlist) {
                        state.watchlist.push(item);
                        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
                        $(e.currentTarget).html('<i class="fa-solid fa-check"></i>');
                        alert(`${movie.title} added to watchlist!`);
                    } else {
                        alert(`${movie.title} is already in your watchlist.`);
                    }
                });

                selectors.previewItemsContainer.append(previewItem);
            }

            updatePreviewContent(state.previewIndex);
        };

        const updatePreviewContent = (index, direction = null) => {
            if (!state.previewMovies.length) return;

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
                if (state.previewMovies[i]) {
                    preloadImages([
                        `https://image.tmdb.org/t/p/${backdropSize}${state.previewMovies[i].backdrop_path || ''}`,
                        state.previewMovies[i].logo_path
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
                                ? (state.previewIndex + 1) % state.previewMovies.length
                                : (state.previewIndex - 1 + state.previewMovies.length) % state.previewMovies.length;
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
            if (state.previewInterval || selectors.videoPage.is(':visible') || !state.previewMovies.length) return;
            state.previewInterval = setInterval(() => {
                state.previewIndex = (state.previewIndex + 1) % state.previewMovies.length;
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
                const [previewMovies, movieItems, tvItems, animeItems, kdramaItems] = await Promise.all([
                    loadTrendingMoviesForPreview(),
                    fetchTrending('movie', 'moviesSliderContainer'),
                    fetchTrending('tv', 'tvSliderContainer'),
                    fetchTrending('anime', 'animeSliderContainer'),
                    fetchTrending('kdrama', 'kdramaSliderContainer')
                ]);

                if (!previewMovies.length || !movieItems.length || !tvItems.length || !animeItems.length || !kdramaItems.length) {
                    throw new Error('Insufficient content loaded');
                }

                state.trendingMovies = movieItems;
                state.trendingTV = tvItems;
                state.trendingAnime = animeItems;
                state.trendingKdrama = kdramaItems;
                localStorage.setItem('trendingMovies', JSON.stringify(state.trendingMovies));
                localStorage.setItem('trendingTV', JSON.stringify(state.trendingTV));
                localStorage.setItem('trendingAnime', JSON.stringify(state.trendingAnime));
                localStorage.setItem('trendingKdrama', JSON.stringify(state.trendingKdrama));

                const isMobile = window.matchMedia("(max-width: 767px)").matches;
                const backdropSize = isMobile ? 'w780' : 'original';
                const posterSize = isMobile ? 'w185' : 'w500';
                const preloadUrls = [
                    ...previewMovies.slice(0, 2).flatMap(m => [
                        `https://image.tmdb.org/t/p/${backdropSize}${m.backdrop_path || ''}`,
                        m.logo_path
                    ]),
                    ...movieItems.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                    ...tvItems.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                    ...animeItems.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`),
                    ...kdramaItems.slice(0, 2).map(m => `https://image.tmdb.org/t/p/${posterSize}${m.poster_path || ''}`)
                ].filter(url => url && !url.includes('null'));

                await preloadImages(preloadUrls);

                await renderPreviewContent(previewMovies);
                selectors.moviesSlider.empty();
                for (const item of movieItems) await renderMediaItem(item, 'movie', selectors.moviesSlider);
                selectors.tvSlider.empty();
                for (const item of tvItems) await renderMediaItem(item, 'tv', selectors.tvSlider);
                selectors.animeSlider.empty();
                for (const item of animeItems) await renderMediaItem(item, 'tv', selectors.animeSlider);
                selectors.kdramaSlider.empty();
                for (const item of kdramaItems) await renderMediaItem(item, 'tv', selectors.kdramaSlider);

                return true;
            } catch (error) {
                handleError(error, 'Failed to load initial content', selectors.previewSection);
                $('.retry-button').on('click', loadInitialContent);
                return false;
            }
        };

        const loadHomepage = async () => {
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
            } catch (error) {
                handleError(error, 'Failed to load homepage', selectors.previewSection);
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
            window.history.pushState({ id, type, title, poster, year, season, episode, section: state.previousSection }, '', path);

            selectors.videoPage.data({ id, type, title, poster, year });

            const isInWatchlist = state.watchlist.some(w => w.id === id);
            selectors.watchlistBtn.html(`Add to Watchlist <i class="${isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);

            let downloadUrl = type === 'movie'
                ? `https://dl.vidsrc.vip/movie/${id}`
                : `https://dl.vidsrc.vip/tv/${id}${season && episode ? `/${season}/${episode}` : '/1/1'}`;
            selectors.downloadBtn.attr('href', downloadUrl);

            handleMediaClick(title, poster, year);
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
            window.history.pushState({}, '', '/');
        };

        const handleMediaClick = async (title, poster, year) => {
            selectors.videoFrame.attr('src', '');
            selectors.videoPage.data({ title, poster, year });

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
                    if (state.currentPlayingSeason && state.currentPlayingEpisode) {
                        embedVideo();
                        await loadEpisodes(state.currentPlayingSeason);
                        $(`.episode-btn[data-value="${state.currentPlayingEpisode}"]`).addClass('active');
                    } else {
                        await loadEpisodes(state.season);
                    }
                }
                selectors.selectorContainer.addClass('active').show();
                selectors.mediaDetails.addClass('active').show();
            } catch (error) {
                handleError(error, 'Failed to load media details', selectors.mediaDetails);
                selectors.videoFrame.attr('src', '');
                selectors.videoMediaTitle.text('Error loading media');
            }
        };

        const fetchMediaDetails = async () => {
            const key = `${state.mediaType}-${state.mediaId}`;
            if (state.cachedMedia && state.cachedMedia[key]) return applyMediaDetails(state.cachedMedia[key]);

            try {
                const res = await fetchWithRetry(`https://api.themoviedb.org/3/${state.mediaType}/${state.mediaId}?api_key=${config.apiKey}`);
                state.cachedMedia = state.cachedMedia || {};
                state.cachedMedia[key] = res;
                applyMediaDetails(res);
            } catch (error) {
                throw new Error(`Error fetching ${state.mediaType} ${state.mediaId} details: ${error.message}`);
            }
        };

        const applyMediaDetails = data => {
            const title = data.title || data.name || 'Unknown';
            const year = (data.release_date || data.first_air_date || '').split('-')[0] || 'N/A';
            const genres = data.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            const plot = data.overview || 'No description available.';
            const isMobile = window.matchMedia("(max-width: 767px)").matches;
            const poster = data.poster_path ? `https://image.tmdb.org/t/p/${isMobile ? 'w185' : 'w500'}${data.poster_path}` : config.fallbackImage;
            const mediaType = state.mediaType === 'movie' ? 'MOVIE' : 'TV';
            const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';

            selectors.mediaPoster.attr('src', poster).attr('alt', `${title} Poster`);
            selectors.mediaRatingBadge.find('.rating-value').text(rating);
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${mediaType} • ${year} • ${genres.join(', ')}`);
            selectors.mediaPlot.text(plot);
        };

        const loadSeasons = async () => {
            selectors.seasonGrid.empty();
            try {
                if (!state.seasonCache[state.mediaId]) {
                    const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`);
                    state.seasonCache[state.mediaId] = { seasons: data.seasons };
                }
                const seasons = state.seasonCache[state.mediaId].seasons;
                seasons.filter(s => s.season_number > 0 && s.episode_count > 0).forEach(season => {
                    const btn = $(`<button class="season-btn" data-value="${season.season_number}" aria-label="Select Season ${season.season_number}">Season ${season.season_number}</button>`);
                    if (season.season_number === (state.currentPlayingSeason || 1)) {
                        btn.addClass('active');
                    }
                    btn.on('click', async () => {
                        $('.season-btn').removeClass('active');
                        btn.addClass('active');
                        state.season = season.season_number;
                        state.currentPlayingSeason = state.season;
                        await loadEpisodes(state.season);
                    });
                    selectors.seasonGrid.append(btn);
                });
            } catch (error) {
                handleError(error, `Failed to load seasons for TV ${state.mediaId}`, selectors.seasonGrid);
            }
        };

        const loadEpisodes = async season => {
            selectors.episodeGrid.empty();
            try {
                if (!state.seasonCache[state.mediaId]) state.seasonCache[state.mediaId] = {};
                if (!state.seasonCache[state.mediaId][season]) {
                    const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season}?api_key=${config.apiKey}`);
                    state.seasonCache[state.mediaId][season] = data.episodes;
                }
                const episodes = state.seasonCache[state.mediaId][season];
                episodes.filter(e => e.episode_number > 0).forEach(episode => {
                    const btn = $(`<button class="episode-btn" data-value="${episode.episode_number}" aria-label="Select Episode ${episode.episode_number}">${episode.episode_number}</button>`);
                    if (season === state.currentPlayingSeason && episode.episode_number === state.currentPlayingEpisode) {
                        btn.addClass('active');
                    }
                    btn.on('click', () => {
                        $('.episode-btn').removeClass('active');
                        btn.addClass('active');
                        state.currentPlayingSeason = season;
                        state.currentPlayingEpisode = episode.episode_number;
                        state.selectedEpisodes[season] = state.currentPlayingEpisode;
                        selectors.videoMediaTitle.text(`${selectors.videoPage.data('title')}\n(${selectors.videoPage.data('year') || 'N/A'})`);
                        embedVideo();
                        const historyItem = {
                            id: state.mediaId,
                            type: state.mediaType,
                            title: selectors.videoPage.data('title'),
                            poster: selectors.videoPage.data('poster').replace('https://image.tmdb.org/t/p/w500', '').replace('https://image.tmdb.org/t/p/w185', ''),
                            year: selectors.videoPage.data('year').split('-')[0] || 'N/A',
                            timestamp: Date.now(),
                            season: state.currentPlayingSeason,
                            episode: state.currentPlayingEpisode
                        };
                        addToHistory(historyItem, state.mediaType, state.previousSection);
                    });
                    selectors.episodeGrid.append(btn);
                });
            } catch (error) {
                handleError(error, `Failed to load episodes for season ${season}`, selectors.episodeGrid);
            }
        };

        const embedVideo = () => {
            let url;
            const serverUrl = getServerUrl();
            if (state.mediaType === 'movie') {
                if (serverUrl === 'https://vidfast.pro') {
                    url = `https://vidfast.pro/movie/${state.mediaId}`;
                } else if (serverUrl === 'https://111movies.com') {
                    url = `https://111movies.com/movie/${state.mediaId}`;
                } else if (serverUrl === 'https://vidsrc.cc/v2') {
                    url = `https://vidsrc.cc/v2/embed/movie/${state.mediaId}`;
                }
            } else if (state.currentPlayingSeason && state.currentPlayingEpisode) {
                if (serverUrl === 'https://vidfast.pro') {
                    url = `https://vidfast.pro/tv/${state.mediaId}/${state.currentPlayingSeason}/${state.currentPlayingEpisode}`;
                } else if (serverUrl === 'https://111movies.com') {
                    url = `https://111movies.com/tv/${state.mediaId}/${state.currentPlayingSeason}/${state.currentPlayingEpisode}`;
                } else if (serverUrl === 'https://vidsrc.cc/v2') {
                    url = `https://vidsrc.cc/v2/embed/tv/${state.mediaId}/${state.currentPlayingSeason}/${state.currentPlayingEpisode}`;
                }
            } else {
                selectors.videoFrame.attr('src', '');
                return;
            }
            selectors.videoFrame.attr('src', url);
        };

        selectors.watchlistBtn.on('click', () => {
            const item = {
                id: state.mediaId,
                type: state.mediaType,
                title: selectors.videoPage.data('title'),
                poster: selectors.videoPage.data('poster').replace('https://image.tmdb.org/t/p/w500', '').replace('https://image.tmdb.org/t/p/w185', ''),
                year: selectors.videoPage.data('year') || 'N/A',
                timestamp: Date.now()
            };
            const isInWatchlist = state.watchlist.some(w => w.id === item.id);
            if (!isInWatchlist) {
                state.watchlist.push(item);
                localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
                selectors.watchlistBtn.html('Added to Watchlist <i class="fa-solid fa-check"></i>');
                alert(`${item.title} added to watchlist!`);
            } else {
                state.watchlist = state.watchlist.filter(w => w.id !== item.id);
                localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
                selectors.watchlistBtn.html('Add to Watchlist <i class="fas fa-plus"></i>');
                alert(`${item.title} removed from watchlist.`);
            }
        });

        selectors.backBtn.on('click', navigateBack);

        selectors.sidebarNavItems.on('click', function() {
            selectors.sidebarNavItems.removeClass('active');
            $(this).addClass('active');
            const section = $(this).data('section');
            stopPreviewSlideshow();
            selectors.searchSection.removeClass('active').hide();
            selectors.librarySection.removeClass('active').hide();
            selectors.previewSection.show();

            if (section === 'home') {
                loadHomepage();
            } else if (section === 'search') {
                loadSearchSection();
            } else if (section === 'library') {
                selectors.homepage.show();
                selectors.videoPage.hide();
                selectors.videoMediaTitle.hide();
                selectors.previewSection.hide();
                selectors.moviesSlider.parent().hide();
                selectors.tvSlider.parent().hide();
                selectors.animeSlider.parent().hide();
                selectors.kdramaSlider.parent().hide();
                loadLibrary();
            }
            window.history.pushState({}, '', '/');
        });

        let searchTimeout;
        selectors.searchInput.on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val().trim();
            if (query.length < 2) {
                selectors.searchResults.empty();
                loadSearchSection();
                return;
            }
            searchTimeout = setTimeout(async () => {
                selectors.searchTrending.empty();
                const filter = selectors.searchFilter.val();
                const results = await fetchSearchResults(query, filter);
                renderSearchResults(results);
            }, 500);
        });

        selectors.searchFilter.on('change', () => {
            const query = selectors.searchInput.val().trim();
            if (query.length >= 2) {
                selectors.searchInput.trigger('input');
            } else {
                loadSearchSection();
            }
        });

        window.addEventListener('popstate', e => {
            const state = e.state || {};
            if (state.id && state.type) {
                navigateToMedia(state.id, state.type, state.title, state.poster, state.year, state.season, state.episode, state.section);
            } else {
                navigateBack();
            }
        });

        initializeServers();
        loadHomepage();

        window.addEventListener('resize', () => {
            if (state.previewMovies.length) {
                renderPreviewContent(state.previewMovies);
                setupPreviewTouch();
            }
        });
    });
})();