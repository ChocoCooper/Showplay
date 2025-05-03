$(document).ready(() => {
    // DOM Selectors
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
        seasonGrid: $('#seasonGrid'), // Now used for dropdown
        episodeGrid: $('#episodeGrid'), // Now used for dropdown
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
        sidebarNavItems: $('.sidebar-nav li'),
        notification: $('<div class="notification" style="position: fixed; bottom: 20px; right: 20px; background: #2af598; color: #000; padding: 10px 20px; border-radius: 5px; z-index: 1000; display: none;"></div>').appendTo('body')
    };

    // Application State
    const state = {
        mediaType: 'movie',
        mediaId: null,
        season: 1,
        episode: 1,
        previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
        previewInterval: null,
        watchlist: JSON.parse(localStorage.getItem('watchlist')) || [],
        history: JSON.parse(localStorage.getItem('history')) || [],
        previousSection: 'home'
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [
            { name: 'Server 1', url: 'https://vidfast.pro' },
            { name: 'Server 2', url: 'https://111movies.com' },
            { name: 'Server 3', url: 'https://vidsrc.cc/v2' }
        ],
        fallbackImage: 'https://via.placeholder.com/500x750.png?text=No+Image'
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
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const size = type === 'backdrop' ? (isMobile ? 'w780' : 'original') : (isMobile ? 'w185' : 'w500');
        return path ? `https://image.tmdb.org/t/p/${size}${path}` : config.fallbackImage;
    };

    // Utility: Load Image
    const loadImage = src => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    });

    // Utility: Show Notification
    const showNotification = message => {
        selectors.notification.text(message).fadeIn(300).delay(2000).fadeOut(300);
    };

    // Initialize Servers
    const initializeServers = () => {
        selectors.serverGrid.empty();
        config.servers.forEach((server, i) => {
            const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}" aria-label="Select ${server.name}">${server.name}</button>`).data('url', server.url);
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

    // Get Active Server URL
    const getServerUrl = () => $('.server-btn.active').data('url') || config.servers[0].url;

    // Fetch Media
    const fetchMedia = async (type, isPreview = false) => {
        let url;
        if (type === 'movie') {
            url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${config.apiKey}`;
        } else if (type === 'tv') {
            url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${config.apiKey}`;
        } else if (type === 'anime') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_genres=16&sort_by=popularity.desc&with_original_language=ja&vote_average.gte=8&vote_count.gte=1000`;
        } else if (type === 'kdrama') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${config.apiKey}&with_original_language=ko&sort_by=popularity.desc&vote_average.gte=7&vote_count.gte=100`;
        }
        if (!url) return [];

        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 5 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(`${url}&page=${page}`);
                let validItems = data.results.filter(item => item.id && (item.title || item.name) && item.poster_path && item.vote_average);
                if (isPreview) {
                    validItems = validItems.filter(m => m.backdrop_path && m.original_language === 'en');
                    validItems = await Promise.all(validItems.map(async m => {
                        const logo = await fetchWithRetry(`https://api.themoviedb.org/3/movie/${m.id}/images?api_key=${config.apiKey}&include_image_language=en,null`);
                        const logoUrl = logo.logos?.find(l => l.file_path && l.iso_639_1 === 'en')?.file_path || logo.logos?.[0]?.file_path;
                        return logoUrl ? { ...m, logo_path: `https://image.tmdb.org/t/p/original${logoUrl}` } : null;
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
    const renderItem = async (item, container, type = 'slider', isLibrary = false) => {
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = item.vote_average?.toFixed(1) || 'N/A';
        const isMobile = window.matchMedia("(max-width: 767px)").matches;

        if (type === 'preview') {
            const backdropUrl = getImageUrl(item.backdrop_path, 'backdrop');
            const releaseDate = new Date(item.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const isInWatchlist = state.watchlist.some(w => w.id === item.id);
            const previewItem = $(`
                <div class="preview-item" data-index="${container.children().length}">
                    <div class="preview-img-placeholder"></div>
                    <img class="preview-background" src="${backdropUrl}" alt="${title}" data-id="${item.id}" data-title="${title}" data-poster="${getImageUrl(posterPath)}" data-year="${item.release_date}">
                    <div class="preview-background-overlay"></div>
                    <div class="preview-overlay"></div>
                    <div class="preview-content">
                        <img class="preview-title" src="${item.logo_path}" alt="${title}">
                        <div class="preview-meta">
                            <span class="release-date">MOVIE • ${releaseDate}</span>
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
                previewItem.find('.preview-img-placeholder').remove();
                selectors.previewSection.find('.preview-placeholder').remove();
            } catch (error) {
                previewItem.find('.preview-background').attr('src', config.fallbackImage).addClass('loaded');
                previewItem.find('.preview-img-placeholder').remove();
            }

            previewItem.find('.play-btn').on('click', e => {
                e.preventDefault();
                const year = item.release_date.split('-')[0];
                navigateToMedia(item.id, 'movie', title, getImageUrl(posterPath), year, null, null, 'home');
                addToHistory({ id: item.id, type: 'movie', title, poster: posterPath, year, season: null, episode: null });
            });

            previewItem.find('.add-btn').on('click', () => {
                toggleWatchlist({ id: item.id, type: 'movie', title, poster: posterPath });
                const isInWatchlist = state.watchlist.some(w => w.id === item.id);
                previewItem.find('.add-btn i').attr('class', isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus');
            });

            container.append(previewItem);
        } else {
            const imageUrl = getImageUrl(posterPath);
            const poster = $(`
                <div class="poster-item">
                    <div class="poster-img-placeholder"></div>
                    <img src="${imageUrl}" alt="${title}" class="poster-img" role="button" aria-label="Play ${title}"/>
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                </div>
            `);

            try {
                await loadImage(imageUrl);
                poster.find('.poster-img').addClass('loaded');
                poster.find('.poster-img-placeholder').remove();
            } catch (error) {
                poster.find('.poster-img').attr('src', config.fallbackImage).addClass('loaded');
                poster.find('.poster-img-placeholder').remove();
            }

            poster.find('.poster-img').on('click', () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : 
                               container.closest('.library-section').length ? 'library' : 'home';
                navigateToMedia(item.id, item.media_type || item.type, title, imageUrl, year, item.season, item.episode, section);
                if (!isLibrary) {
                    addToHistory({ id: item.id, type: item.media_type || item.type, title, poster: posterPath, year, season: item.season || state.season, episode: item.episode || state.episode });
                }
            });

            if (isLibrary) {
                poster.find('.delete-badge').on('click', () => {
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
        state.history = state.history.filter(h => !(h.id === item.id && h.type === item.type));
        state.history.unshift({ ...item, timestamp: Date.now() });
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    // Toggle Watchlist
    const toggleWatchlist = item => {
        const isInWatchlist = state.watchlist.some(w => w.id === item.id);
        if (!isInWatchlist) {
            state.watchlist.push({ ...item, timestamp: Date.now() });
            showNotification(`${item.title} added to watchlist!`);
        } else {
            state.watchlist = state.watchlist.filter(w => w.id !== item.id);
            showNotification(`${item.title} removed from watchlist!`);
        }
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    };

    // Load Library
    const loadLibrary = async () => {
        selectors.watchlistSlider.empty();
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            for (const item of state.watchlist) {
                await renderItem(item, selectors.watchlistSlider, 'slider', true);
            }
        }

        selectors.historySlider.empty();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            state.history.sort((a, b) => b.timestamp - a.timestamp);
            for (const item of state.history) {
                await renderItem(item, selectors.historySlider, 'slider', true);
            }
        }
    };

    // Load Season and Episode Selector
    const loadSeasonEpisodeSelector = async () => {
        if (state.mediaType !== 'tv') {
            selectors.seasonSelector.hide();
            selectors.episodeSelector.hide();
            return;
        }

        selectors.seasonSelector.show();
        selectors.episodeSelector.show();
        selectors.seasonGrid.empty().append('<select class="season-dropdown" aria-label="Select Season"></select>');
        selectors.episodeGrid.empty().append('<select class="episode-dropdown" aria-label="Select Episode"></select>');

        try {
            const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}?api_key=${config.apiKey}`);
            const seasons = data.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
            if (!seasons.length) {
                selectors.seasonGrid.html('<p class="empty-message">No seasons available.</p>');
                return;
            }

            const seasonDropdown = selectors.seasonGrid.find('.season-dropdown');
            seasons.forEach(s => {
                seasonDropdown.append(`<option value="${s.season_number}" ${s.season_number === state.season ? 'selected' : ''}>Season ${s.season_number}</option>`);
            });

            const updateEpisodes = async season => {
                const episodeDropdown = selectors.episodeGrid.find('.episode-dropdown').empty();
                const epData = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season}?api_key=${config.apiKey}`);
                const episodes = epData.episodes?.filter(e => e.episode_number > 0) || [];
                if (!episodes.length) {
                    episodeDropdown.append('<option value="">No episodes</option>');
                    return;
                }
                episodes.forEach(e => {
                    episodeDropdown.append(`<option value="${e.episode_number}" ${e.episode_number === state.episode ? 'selected' : ''}>Episode ${e.episode_number}</option>`);
                });
                embedVideo();
            };

            seasonDropdown.on('change', () => {
                state.season = parseInt(seasonDropdown.val());
                state.episode = 1;
                updateEpisodes(state.season);
                addToHistory({ id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode });
            });

            selectors.episodeGrid.find('.episode-dropdown').on('change', () => {
                state.episode = parseInt(selectors.episodeGrid.find('.episode-dropdown').val());
                embedVideo();
                addToHistory({ id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode });
            });

            await updateEpisodes(state.season);
        } catch (error) {
            selectors.seasonGrid.html('<p class="empty-message">Failed to load seasons.</p>');
            console.error('Failed to load season/episode data', error);
        }
    };

    // Embed Video
    const embedVideo = () => {
        const serverUrl = getServerUrl();
        const src = state.mediaType === 'movie'
            ? `${serverUrl}/embed/movie?tmdb=${state.mediaId}`
            : `${serverUrl}/embed/tv?tmdb=${state.mediaId}&season=${state.season}&episode=${state.episode}`;
        selectors.videoFrame.attr('src', src);
    };

    // Load Homepage
    const loadHomepage = async () => {
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.previewSection.show();
        selectors.moviesSlider.parent().show();
        selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show();
        selectors.kdramaSlider.parent().show();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        try {
            const [previewMovies, movies, tv, anime, kdrama] = await Promise.all([
                fetchMedia('movie', true),
                fetchMedia('movie'),
                fetchMedia('tv'),
                fetchMedia('anime'),
                fetchMedia('kdrama')
            ]);

            selectors.previewItemsContainer.empty();
            for (const movie of previewMovies) await renderItem(movie, selectors.previewItemsContainer, 'preview');
            selectors.moviesSlider.empty();
            for (const item of movies) await renderItem(item, selectors.moviesSlider);
            selectors.tvSlider.empty();
            for (const item of tv) await renderItem(item, selectors.tvSlider);
            selectors.animeSlider.empty();
            for (const item of anime) await renderItem(item, selectors.animeSlider);
            selectors.kdramaSlider.empty();
            for (const item of kdrama) await renderItem(item, selectors.kdramaSlider);

            // Remove placeholders
            selectors.previewItemsContainer.find('.preview-img-placeholder').remove();
            selectors.moviesSlider.find('.poster-img-placeholder').remove();
            selectors.tvSlider.find('.poster-img-placeholder').remove();
            selectors.animeSlider.find('.poster-img-placeholder').remove();
            selectors.kdramaSlider.find('.poster-img-placeholder').remove();

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

        selectors.searchResults.empty();
        selectors.searchTrending.empty();
        const filter = selectors.searchFilter.val();
        const trending = filter === 'movie' ? fetchMedia('movie') : fetchMedia('tv');
        trending.then(items => items.forEach(item => renderItem(item, selectors.searchTrending)));
    };

    // Navigate to Media
    const navigateToMedia = (id, type, title, poster, year, season = null, episode = null, section = null) => {
        stopPreviewSlideshow();
        state.mediaId = id;
        state.mediaType = type;
        state.season = season || 1;
        state.episode = episode || 1;
        state.previousSection = section || state.previousSection;

        window.history.pushState({ id, type, title, poster, year, season, episode, section: state.previousSection }, '', `/movie/${id}`);
        selectors.videoPage.data({ id, type, title, poster, year });

        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
        selectors.downloadBtn.attr('href', type === 'movie' ? `https://dl.vidsrc.vip/movie/${id}` : `https://dl.vidsrc.vip/tv/${id}/${state.season}/${state.episode}`);

        selectors.videoFrame.attr('src', '');
        selectors.videoPage.show();
        selectors.homepage.hide();
        selectors.videoMediaTitle.show().text(`${title}\n(${year || 'N/A'})`);
        selectors.selectorContainer.show();
        selectors.mediaDetails.show();

        fetchWithRetry(`https://api.themoviedb.org/3/${type}/${id}?api_key=${config.apiKey}`).then(data => {
            const genres = data.genres?.slice(0, 2).map(g => g.name.split(' ')[0]) || ['N/A'];
            selectors.mediaPoster.attr('src', getImageUrl(data.poster_path)).attr('alt', `${title} Poster`);
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average?.toFixed(1) || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(`${type.toUpperCase()} • ${year || 'N/A'} • ${genres.join(', ')}`);
            selectors.mediaPlot.text(data.overview || 'No description available.');
        });

        if (type === 'movie') {
            embedVideo();
        } else {
            loadSeasonEpisodeSelector();
        }
    };

    // Navigate to Section
    const navigateToSection = section => {
        selectors.sidebarNavItems.removeClass('active');
        selectors.sidebarNavItems.filter(`[data-section="${section}"]`).addClass('active');
        if (section === 'home') loadHomepage();
        else if (section === 'search') loadSearchSection();
        else if (section === 'library') loadLibrary();
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

    // Event Handlers
    selectors.watchlistBtn.on('click', () => {
        const { id, type, title, poster } = selectors.videoPage.data();
        toggleWatchlist({ id, type, title, poster });
        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
    });

    selectors.backBtn.on('click', () => navigateToSection(state.previousSection));
    selectors.sidebarNavItems.on('click', function() { navigateToSection($(this).data('section')); });

    let searchTimeout;
    selectors.searchInput.on('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const query = selectors.searchInput.val().trim();
            if (query.length < 3) {
                selectors.searchResults.empty();
                loadSearchSection();
                return;
            }
            selectors.searchTrending.empty();
            const filter = selectors.searchFilter.val();
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
        }, 500);
    });

    selectors.searchFilter.on('change', () => {
        selectors.searchInput.val('');
        selectors.searchResults.empty();
        loadSearchSection();
    });

    $(window).on('popstate', event => {
        const s = event.originalEvent.state;
        if (s && s.id) navigateToMedia(s.id, s.type, s.title, s.poster, s.year, s.season, s.episode, s.section);
        else navigateToSection('home');
    });

    $(window).on('resize', () => {
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            $('.poster-img, .preview-background').each(function() {
                const src = $(this).attr('src');
                if (src && !src.includes('placeholder')) {
                    $(this).attr('src', getImageUrl(src.split('/').pop()));
                }
            });
            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            }
        }, 200);
    });

    // Initialize
    initializeServers();
    loadHomepage();
});
