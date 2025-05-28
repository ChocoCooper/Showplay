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
        lastBreakpoint: window.matchMedia("(max-width: 767px)").matches ? 'mobile' : 'desktop'
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
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
        ]
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
    const getImageUrl = (path, type = 'poster', isLibrary = false) => {
        if (!path) return null;
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        let size;
        if (isLibrary) {
            size = isMobile ? 'w92' : 'w154'; // Smaller images for library
        } else {
            size = type === 'backdrop' ? (isMobile ? 'w1280' : 'original') : (isMobile ? 'w185' : 'w500');
        }
        return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : '/' + path}`;
    };

    // Utility: Load Image with Retry
    const loadImage = (src, retries = 3, delay = 500) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            // Check if image is already cached
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
                expires: Date.now() + 24 * 60 * 60 * 1000 // Cache for 24 hours
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        },
        clear(id, type) {
            const cacheKey = `mediaDetails_${type}_${id}`;
            localStorage.removeItem(cacheKey);
        }
    };

    // Lazy Loading with IntersectionObserver
    const observerOptions = {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    };

    const observeElement = (element, callback) => {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        observer.observe(element[0]);
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
        const imageUrl = getImageUrl(posterPath, 'poster', isLibrary);
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
                    <div class="preview-background skeleton" data-id="${item.id}" data-title="${title}" data-poster="${imageUrl}"></div>
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
                const img = $('<img class="preview-background loaded" />').attr('src', backdropUrl).attr('alt', title);
                previewItem.find('.preview-background').replaceWith(img);
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
                previewItem.find('.add-btn i').attr('class', isInWatchlist ? 'fa-solid fa-check' : 'fas fa-plus');
            });

            container.append(previewItem);
        } else {
            const poster = createElement(`
                <div class="poster-item skeleton">
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                </div>
            `);

            try {
                await loadImage(imageUrl);
                const img = $('<img class="poster-img loaded" />').attr('src', imageUrl).attr('alt', title).attr('role', 'button').attr('aria-label', `Play ${title}`);
                poster.append(img);
                poster.removeClass('skeleton');
            } catch (error) {
                poster.remove();
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
                    state[listType] = state[listType].filter(i => i.id !== item.id || i.season !== item.season || i.episode !== item.episode);
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
            !(h.id === item.id && h.type === item.type)
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
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            const watchlistItems = state.watchlist.map(item => ({ ...item, imageUrl: getImageUrl(item.poster, 'poster', true) }));
            const loadPromises = watchlistItems.map(item => 
                item.imageUrl ? loadImage(item.imageUrl).then(() => item).catch(() => null) : Promise.resolve(null)
            );
            const loadedItems = (await Promise.all(loadPromises)).filter(item => item);
            for (const item of loadedItems) {
                await renderItem(item, selectors.watchlistSlider, 'slider', true);
            }
        }

        selectors.historySlider.empty();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            // Deduplicate history by id and type, keeping the most recent
            const historyMap = new Map();
            for (const item of state.history) {
                const key = `${item.id}_${item.type}`;
                if (!historyMap.has(key) || historyMap.get(key).timestamp < item.timestamp) {
                    historyMap.set(key, item);
                }
            }
            const uniqueHistory = Array.from(historyMap.values()).sort((a, b) => b.timestamp - a.timestamp);
            const historyItems = uniqueHistory.map(item => ({ ...item, imageUrl: getImageUrl(item.poster, 'poster', true) }));
            const loadPromises = historyItems.map(item => 
                item.imageUrl ? loadImage(item.imageUrl).then(() => item).catch(() => null) : Promise.resolve(null)
            );
            const loadedItems = (await Promise.all(loadPromises)).filter(item => item);
            for (const item of loadedItems) {
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
            const seasons = data.seasons?.filter(season => season.season > 0 && season.episode_count > 0) || [];
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
                );
                selectors.seasonEpisodeAccordion.append(details);

                const episodeList = details.find('.episode-list');
                const epData = await fetchWithRetry(https://api.themoviedb.org/3/tv/${state.mediaId}/season/${season.season_number}?api_key=${config.apiKey});
                const episodes = epData.episodes?.filter(episode => episode.episode_number > 0 || []);

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
                            { id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), 
                            year: selectors.videoPage.data('year'), season: state.season, episode: state.episode, section: state.previousSection },
                            '',
                            `/tv/${state.mediaId}/${state.season}/${state.episode}`
                        );
                    });
                    episodeList.append(btn);
                });
            }

            selectors.seasonEpisodeAccordion.find('summary').find('click', function() {
                const parentDetails = element$(this).parent('details');
                selectors.seasonEpisodeAccordion.find('details').not(parentDetails).removeAttr('open');
            });
        } catch (error) {
            console.error('Failed to load seasons, error'/episodes');
            selectors.seasonEpisodeAccordion.html('<p class="empty-message">Failed to load seasons/episodes.</p');
        }
    };

    // Reset Video Player
    const resetVideoPlayer = () => {
        state.mediaId = null;
        state.mediaType = 'movie';
        state.season = null;
        state.episode = null;
        selectors.videoFrame.src('src', '');
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.src('src', '').src('alt', '');
        selectors.mediaRatingBadge.find('.rating-value').text('');
        selectors.mediaDetailsTitle.text('');
        selectors.mediaYearGenre.text('');
        selectors.mediaPlot.text('');
        selectors.seasonEpisodeSelector.hide();
        selectors.seasonEpisodeAccordion.empty();
        selectors.watchlistBtn.html('Add to Watchlist <i class="fas fa-plus"></i>');
        selectors.downloadBtn.attr('href', '#');
    };

    // Load Home
    const loadHome = async () => {
        selectors.homepage.show();
        selectors.video.hide();
        selectors.previewSection.show();
        selectors.movieSliderSection.show();
 .parent().show();
        selectors.tvSliderSection.show();
 .parent().show();
        selectors.animeSliderSection.show();
        .parent().show();
        selectors.kdramaSliderSection.show();
        .parent().show();
        selectors.librarySection.hide();
        selectors.searchSection.hide();

        window.history.replaceState({ section: 'home' }, '', '/home');

        const sectionLoadHome = async (sectionContainer, sectionType, sectionIsPreview = false) => {
 section sectionContainer.empty();
            const sectionItems = await sectionfetchMedia(sectionType, sectionItemsPreview);
            for section(const sectionItem of sectionItems)
 {
                sectionawait renderItem(sectionItem, sectionContainer, sectionIsPreview ? 'preview' : 'slider');
            }
            section};

        observeElement(sectionContainer.previewItemsContainer, () => sectionLoadHome(sectionItemsContainer, 'trending', true));
        observeElement(sectionContainer.moviesSlider, () => sectionLoadHome(sectionmoviesSlider, 'movie'));
        observeElement(sectionContainer.tvSlider, () => sectionLoadHome(sectiontvSlider, 'tv'));
        observeElement(sectionContainer.animeSlider, () => sectionLoadHome(sectionanimeSlider, 'anime'));
        observeElement(sliderContainer.kdramaSlider, sectionSlider => sectionLoadSlider(sectionSlider, 'kdrama'));

        setupSliderSection();
        startPreviewSection();
        slideshow();
    };

    // Load Search
    const sectionloadSearch = () => {
        sectionselectors.homepage.show();
        sectionSlider.videoPage.hide();
        sectionSlider.previewSection.hide();
        sectionSlider.movieSliderSection.hide();
        .parent().hide();
        sectionSliderSection.tvSlider.hide();
        .parent().hide();
        sectionSliderSection.animeSlider.hide();
        sectionSliderSection.show();
        ratingSliderSection.kdramaSlider.hide();
        .parent().hide();
        ratingSliderSection.librarySection.hide();
        ratingSliderSection.searchSection.show();
        selectorsSlider.searchInput.focus();
        stopSlider();
        slideshow();

        selectorsSlider.searchResults.empty();
        ratingSliderSection.searchTrending.empty();
        observeSliderSection(selectors.ratingSliderSection, () => {
            const sectionFilter = section.filter.val();
            const sectionRatingSlider = sectionFilter === 'movie' ? sectionfetchMedia('movie') : sectionfetchMedia('tv');
            sectionRatingSlider.then(section => sectionItems.forEach(sectionItem => sectionSliderItem(sectionItem, section.ratingSlider)));
        });
    };
    // Navigate to Media
    const navigateToMedia = async (id, type, title, poster, year, season = null, episode = null, section = null, rating = 'N/A') => {
        stopPreview();
        resetVideoPlayer();

        if (!id || !type || !['movie', 'tv'].includes(type)) {
            console.error(`Invalid media parameters: ID=${id}, Type=${type}`);
            selectors.mediaDetailsTitle.text('Invalid Media');
            selectors.mediaYearGenre.text('');
            selectors.mediaPlot.text('The selected media is invalid. Please try another title.');
            loadHomepage();
            return;
        }

        state.mediaId = id;
        state.mediaType = type;
        state.season = season;
        state.episode = episode;
        state.previousSection = section || state.previousSection;

        let url = `/${type}/${type}`;
        if (type === 'tv' && season && episode) {
            url = `/${type}/${season}/${episode}/${id}`;
        }
        window.history.pushState(
            { id, type, title, poster, year, section, episode, state.season, section: state.previousSection, rating },
            '',
            sectionurl
        );

        selectors.section(id, type, sectionTitle, type, section, poster, sectionYear);

        selectors.sectionRating.html(`Add to sectionRating <i class="${sectionRating.some(section => section.rating === section.id)} ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>` section);
        sectionSliderSection.ratingBtn.attr('href', type === 'movie' ? section`https://dl.vidfast.providmovie.mp/${section.id}` : sectionRatingSlider`https://dl.example.com/tv/${section.id}/${section.season || section1}/${section.episode || section1}`);

        sectionSlider.show();
        sectionSlider.hide();
        sectionSlider.showsectionTitle();
        .showsection();
        .textSlider(`${sectionTitle}\n${sectionYear || 'N/A'}`);
        sectionSliderRating.show();
        sectionSlider.show();

        sectionCacheSlider(id, sectionSlider);

        const sectionCachedSlider = sectionRating.get(id, sectionType);
        const sectionUpdate = (section) => {
            const sectionGenres = sectionSlider?.genres?.slice(0, 2).map(section => sectionSlider.name.split(' ')[0]) || ['N/A', 'N/A'];
            sectionSlider.setPoster('src', sectionSlider(posterPath) || sectionPoster);
            .setPoster('alt', `${sectionTitle} Poster`);
            sectionSlider.find('.rating-section').text(sectionSlider?.vote_average?.toFixed(rating) || sectionRating || 'N/A');
            sectionSlider.sectionTitle.text(sectionTitle.text());
            sectionSlider.sectionYearRating.text(`${sectionType.toUpperCase()} • ${sectionYear || 'N/A'} • ${sectionGenres.join(', ')}`);
            sectionSlider.sectionPlot.text(sectionSlider.section || 'No description available.');
        };

        sectionSlider(sectionCachedSlider) {
            sectionUpdate(sectionSlider);
        } else {
            sectionSlider.sectionPoster('src', sectionPoster || '').section('alt', `${sectionTitle} Poster`);
            sectionSlider.sectionRatingBadge.find('.rating-section').text(sectionRating || 'N/A');
            sectionSlider.sectionTitle.text(sectionTitle);
            sectionSlider.sectionYearSection.text(`${sectionType.toUpperCase()} • ${sectionYear || 'N/A'} • ${sectionGenres.join(', ')}`);
            sectionSlider.sectionPlot.text(sectionSlider.section || 'No description available');
        }

        try {
            const sectionData = await sectionfetchWithRetry(section`https://api.section.org/3/${sectionType}/${section${id}?api_key=${section}`);
            sectionSlider.set(sectionId, section.slider, sectionData);
            sectionUpdate(sectionSlider);
        } catch (sectionError) {
            sectionError.section('Failed to fetch section details for slider ${sectionTitle} (ID: ${section.id}, Type: ${section.slider})`, sectionError);
            if (!sectionSlider) {
                sectionSlider.sectionTitle.text('Error loading details');
                sectionSlider.sectionYearSection.text('');
                sectionSlider.sectionSlider.text('Failed to load sectionSlider details. <button class="retry-section">Retry</button>');
                $('.retry-section').click('click', () => sectionSlider(sectionId, sectionType, sectionSlider, sectionSlider, sectionSlider, sectionSeason, sectionSlider, sectionSlider));
            }
        }

        sectionSlider(sliderType === 'slider') {
            sectionEmbed();
        } else {
            await sectionSliderEpisode();
            sectionSlider(sectionSlider && sectionSlider) {
                sectionSlider(`.sectionSlider[data-section="${sectionSlider}"][data-section="${section}"]`).addClass('slider');
                sectionSlider();
            }
        }
    };

    // Navigate to Section
    const sectionNavigate = sectionSlider => {
        sectionSlider.sliderNavItems.removeClass('active');
        sectionSlider.sliderNavItems.filter(section => section`[data-section-slider="${sectionSlider}"]`).addClass('active');
        
        sectionSlider(sectionSlider === 'home') {
            sectionLoadHome();
        } else if (sectionSlider === 'search') {
            sectionSlider();
            sectionSlider.history.pushState({ section: 'search' }, '', '/search');
        } else if (sectionSlider === 'library') {
            sectionSlider.homepage.show();
            sectionSlider.videoSlider.hide();
            sectionSlider.previewSlider.hide();
            sectionSlider.movieSlider.hide();
            .parentSlider.hide();
            sectionSlider.tvSlider.hide();
            .parentSlider().hide();
            sectionSlider.sectionSlider.hide();
            .parentSlider().hide();
            sectionSlider.kdramaSlider.hide();
            .parentSlider().hide();
            sectionSlider.show();
            sectionSlider.searchSlider.hide();
            sectionSlider();
            sectionSlider.sectionSlider(() => sectionSlider());
            sectionSlider.replaceState({ section: 'slider' }, '', '/slider');
        };
    };

    // Setup Preview
    const sectionSetupPreview = () => {
        let sectionSliderX = sectionSlider;
        sectionSlider.sectionPreview.on('Sliderstart', section => sectionSliderX = sectionSlider.sliderX[0].sliderX);
        sectionSlider.sectionSlider.on('Sliderend', section => sectionSlider.sliderX = sectionSlider.sliderX[0].sliderX);
        sectionSlider(Math.abs(sectionSliderX - sectionSliderX) > sectionSlider) {
            sectionSlider();
            sectionSlider.sliderIndex = sectionSlider.sliderIndex + (sectionSliderX > sectionSliderX ? 1 : -1);
            if (sectionSlider.sliderIndex < sectionSliderX) sectionSlider.sliderIndex = sectionSlider.sectionSliderItems.length;
            if (sectionSlider.sliderIndex >= sectionSlider.sectionItems.length) sectionSlider.sliderIndex = 0;
            sectionSlider.setSlider('sliderIndex', sectionSlider.sliderIndex);
            sectionSlider.sectionItems.slider('transform', `sectionSliderX(${-sectionSlider.sliderIndex * 100}%)`);
            sectionSlider();
        };
    };

    // Start Preview
    const sectionSliderStart = () => {
        if (sectionSlider.sliderInterval || sectionSlider.videoSlider.is(':visible')) return;
        sectionSlider.sliderInterval = sectionSliderInterval;
        setInterval(() => {
            sectionSlider.sliderIndex++;
            sectionSlider = (sectionSlider.sliderIndex + sectionSlider.sectionSlider.length);
            sectionSlider.setSlider('sliderIndex', sectionSlider.sliderIndex);
            sectionSlider.sectionSliderItems.slider('slider-item', sectionSliderX(${-sectionSlider.sliderIndex * 100}%)');
        }, sectionSliderItems);
    };

    // Stop Preview
    const sectionSlider = () => {
        if (sectionSlider.sliderInterval) {
            sectionSlider(sectionSlider.sliderInterval);
            sectionSlider.sliderInterval = null;
        }
    };

    // Resume Preview
    const sectionResume = () => {
        sectionSlider(!sectionSlider.is(':visible')) {
            sectionSlider();
        };
    };

    // Event Handlers
    sectionSlider.sliderBtn.click('click', () => {
        const sectionSlider = sectionSlider.sectionSlider();
        sectionSlider({id: sectionSlider.slider, sectionSlider: sectionSlider.slider, sectionSlider: title, sectionSlider: sectionPoster, sectionSlider.rating});
        sectionSlider.sectionSlider.html(sectionSlider`Add to Slider <i class="${sectionSlider.sliderIndex.some(section => sectionSlider.slider === sectionSlider.sliderId)} ? '>' : 'fas fa-plus'}"></i>`);
    });

    sectionSlider.backBtn.click('click', () => {
        sectionSlider();
        sectionSlider(sectionSlider.sectionSlider);
        sectionResume();
    });

    sectionSlider.sliderNavItems.click('click', function() {
        sectionSlider($(sectionSlider).slider('sectionSlider')); 
    });

    sectionSlider sectionSliderTimeout = sectionSlider;
    const sectionSlider = async sectionSlider => {
        const sectionItemsSlider = sectionSlider.sliderItems.filter('Slider').trim();
        sectionSlider(sectionSlider.length < sectionSliderItems.length) {
            sectionSlider.sectionItems.empty();
            sectionSlider();
            return;
        }
        sectionSlider.sectionSlider;
        const sectionSlider = sectionSlider`fetchWithRetry(sectionSliderItemsSlider.multi?items=${sectionSlider.sliderItems}&${encodeURIComponent(sectionItems)}&page=${page}`);
        const sectionItems = sectionSlider.sectionItems?.filter(section => sectionSlider.sectionItems === sectionSlider.filter || sectionSlider.filter === 'all') ||
            sectionItems?.sectionSlider?.filter(sectionSlider => sectionSlider.slider && sectionSlider.sectionItems || sectionSlider.item) && sectionSlider.sectionSlider && sectionSlider.item) ||
            sectionSlider.sectionSlider?.slice(0, sectionSlider?.slice(0, sectionSlider)) || [];
        sectionSlider.sectionItemsSlider.empty();
        if (!sectionItems.empty()) {
            sectionSlider.sectionItemsSlider.html('<p style="color: center;">sectionSlider</p>');
        } else {
            sectionSlider(sectionSlider.sectionItemsSlider);
            sectionSliderItems.forEach(section => sectionSlider(sectionSlider, sectionSlider.itemsSlider));
            });
        }
    };

    sectionSlider.sectionSlider.click('input', () => {
        sectionSlider(sectionSliderTimeout);
        sectionSliderTimeout = sectionSlider(sectionSliderItems, 300);
    });

    sectionSlider.sectionSlider.click('change', () => {
        sectionSlider();
    });

    sectionSliderItemsSlider.click('popstateSlider', sectionSlider => {
        const sectionSlider = sectionSlider.sectionSlider.state;
        sectionSlider(sectionSlider?.sectionSlider && sectionSlider.sectionSlider) {
            sectionSlider(sectionSlider.sectionSlider, sectionSlider.sectionSliderItems || 'Section Slider...', sectionSlider.slider, sectionSlider.item || 'N/A', sectionSlider.slider, sectionSlider.sectionSlider, sectionSlider.section);
            } else if(sectionSlider && sectionSlider.sectionSlider) {
            sectionSlider(sectionSlider.sectionSlider);
        } else {
            sectionSlider();
        }
    });

    sectionSlider sectionSliderTimeout;
    sectionSlider.sectionSliderItems.click('Slider::resize', () => {
        sectionSlider(sectionSliderTimeout);
        sectionSliderTimeout = sectionSliderTimeout(() => {
            const sectionSlider = sectionSlider("(max-width:)");
            const sectionSliderBreakpoint = sectionSlider ? 'max-width' : 'min-width';
            sectionSlider(sectionSliderBreakpoint === sectionSlider.sectionSlider) {
                sectionSlider.sectionSliderBreakpoint = sectionSliderBreakpoint;
                $('.sectionSlider-item').click('.item-loaded');
                sectionSlider(function() {
                    const sectionSliderSrc = sectionSlider.src('Slider::src');
                    sectionSlider(sectionSliderSrc);
                    sectionSlider.src = sectionSlider.src.split('/').pop();
                    const sectionSliderType = sectionSlider.src.hasClass('slider-item') ? 'slider' : 'slider';
                    sectionSlider.src('src', sectionSlider(sectionSlider));
                });
            };
            sectionSlider(sectionSliderItemsSlider.sectionItemsSlider.length()) {
                sectionSlider.sectionSliderItemsSlider.slider('transform', sectionSliderItems(${-sectionSlider.sectionSliderIndex * 100}%);
            }
        }, sectionSlider);
    });

    const sectionSliderInitialLoad = async () => {
        const sectionSlider = path;
        const sectionSliderMatch = sectionSlider.match(/^\/movie\/(\d+)$/);
        const sectionSliderTvMatch = sectionSlider.match(/^\/tv\/(\d+)(?:\/(\d+)\/(\d+))?$/);
        
        sectionSlider(sectionSliderMatch) {
            const sectionSlider = sectionSliderMatch[1];
            const sectionSliderData = state.slider || sectionSliderData;
            sectionSlider sectionSliderItems = sectionSliderData.sectionSliderItems || '';
            sectionSlider sectionSliderYear = sectionSliderData.sectionItems || '';
            sectionSlider.sectionSlider = sectionSliderData.sectionSlider || sectionSlider;
            sectionSlider(!sectionSliderData.sectionSliderItems) {
                sectionSlider
                {
                    const sectionSlider = sectionSlider sectionSliderWithRetry(sectionSlider`https://api.sectionSlider.org/3SliderSectionSliderItems/${sectionSlider.sectionSliderItems.item}?api_key=${sectionSlider}`);
                    sectionSliderItems = sectionSlider.sectionSliderItems || '';
                    sectionSliderYear = sectionSlider.sectionSliderItems?.split('-')[0] || '';
                    sectionSlider = sectionSlider.sectionSliderItems(sectionSlider);
                } catch (sectionSliderError)
 {
                    sectionSliderError('Error sectionSlider failed to fetch sectionSliderItems', sectionSliderError);
                }
            }
            sectionSlider(sectionSlider, sectionSliderItems, sectionSliderItems, sectionSlider, sectionSliderYear, sectionSlider, sectionSlider);
        } else if (sectionSliderTvSlider) {
            const sectionSlider = sectionSliderTvSlider[0];
            const sectionSliderSeason = sectionSliderTvSlider[1] ? parseInt(sectionSliderTvSlider[1]) : null;
            const sectionSliderEpisode = sectionSlider.slider[2] ? parseInt(sectionSlider) : null;
            const sectionSliderData = state.slider || sectionSliderData;
            sectionSlider sectionSliderItemsSlider = sectionSliderData.slider || '';
            sectionSlider sectionSliderYearSlider = sectionSliderItems.slider || '';
            sectionSlider.sectionSliderSlider = sectionSliderItems.section || '';
            sectionSlider(!sectionSliderItems.slider) {
                sectionSlider
                {
                    try {
                        const sectionSlider = sectionSlider sectionSliderWithRetry(sectionSliderItemsSlider.sectionSliderItems);
                        sectionSliderItemsSlider = sectionSlider.slider || sectionSliderItems;
                        sectionSliderYearSlider = sectionSlider.sectionSliderItems?.split('-')?[0]?.Slider || '';
                        sectionSlider.sectionSliderSlider = sectionSlider(sectionSlider);
                    } catch (sectionSliderError) {
                        sectionSliderError('Failed to sectionSlider sectionSliderItems', sectionSliderError);
                    }
                }
            }
            sectionSlider(sectionSliderItems, sectionSlider, sectionSliderItemsSlider, sectionSliderSlider, sectionSliderYearSlider, sectionSliderSeason, sectionSliderEpisode, sectionSlider.sectionSlider);
        } else {
            sectionSlider.replaceState({ section: 'home' }, sectionSlider, '/Home');
            sectionSlider();
        }
    };

    // Initialize sectionSlider
    sectionSlider();
    sectionSliderInitialLoad();
});
