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
        lastBreakpoint: window.matchMedia("(max-width: 767px)").matches ? 'mobile' : 'desktop',
        renderedSections: {
            preview: false,
            movies: false,
            tv: false,
            anime: false,
            kdrama: false,
            search: false,
            library: false
        }
    };

    // Configuration
    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09', // Note: Should be moved to server-side for security
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

    // Embed Video with Ad Blocking
    // Embed Video with Ad Blocking
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

    // Add ad-blocking parameters to the URL if supported
    const adBlockUrl = `${src}${src.includes('?') ? '&' : '?'}noads=1&adblock=1&autoplay=1`;
    
    // Set the iframe src with our ad-blocking modifications
    selectors.videoFrame.attr('src', adBlockUrl);

    // Create a container div for the iframe to implement our own sandbox-like restrictions
    const videoWrapper = selectors.videoFrame.parent();
    videoWrapper.css({
        'position': 'relative',
        'overflow': 'hidden'
    });

    // Add overlay that can intercept clicks (helps prevent ad interactions)
    const overlay = $(`<div class="video-overlay"></div>`).css({
        'position': 'absolute',
        'top': 0,
        'left': 0,
        'width': '100%',
        'height': '100%',
        'z-index': 10,
        'pointer-events': 'none'
    });
    videoWrapper.append(overlay);

    // Periodically check for and remove ads
    const adCheckInterval = setInterval(() => {
        try {
            const iframe = selectors.videoFrame[0];
            if (iframe.contentWindow) {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                
                // Block common ad elements
                const adSelectors = [
                    '.ad', '.ads', '.ad-container', '.ad-wrapper',
                    '[id*="ad"]', '[id*="Ad"]', '[class*="ad"]',
                    'iframe', 'div[style*="ad"]'
                ];
                
                adSelectors.forEach(selector => {
                    iframeDoc.querySelectorAll(selector).forEach(el => {
                        // Don't remove the video element itself
                        if (!el.classList.contains('video-js') && 
                            !el.classList.contains('vjs-tech') &&
                            !el.classList.contains('vjs-poster')) {
                            el.remove();
                        }
                    });
                });

                // Block ad network scripts
                iframeDoc.querySelectorAll('script').forEach(script => {
                    if (script.src && (
                        script.src.includes('doubleclick') ||
                        script.src.includes('adservice') ||
                        script.src.includes('adsense') ||
                        script.src.includes('advertising') ||
                        script.src.includes('googletag') ||
                        script.src.includes('pubads')
                    )) {
                        script.remove();
                    }
                });
            }
        } catch (e) {
            // CORS restrictions may prevent access
            console.log("Could not access iframe content due to CORS");
        }
    }, 1000);

    // Clear interval when navigating away
    selectors.videoFrame.on('load', () => {
        clearInterval(adCheckInterval);
    });

    // Alternative approach: Use a proxy service if available
    // This would require server-side implementation
    // selectors.videoFrame.attr('src', `/proxy?url=${encodeURIComponent(src)}`);
};

        // Fallback: Inject a script to block ads from inside the iframe
        const adBlockScript = `
            // Block common ad classes and IDs
            const adSelectors = [
                '.ad', '.ads', '.ad-container', '.ad-wrapper',
                '[id*="ad"]', '[id*="Ad"]', '[class*="ad"]',
                'iframe[src*="ad"]', 'iframe[src*="doubleclick"]'
            ];
            
            function blockAds() {
                adSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
                
                // Block ad network scripts
                document.querySelectorAll('script').forEach(script => {
                    if (script.src && (
                        script.src.includes('doubleclick') ||
                        script.src.includes('adservice') ||
                        script.src.includes('adsense') ||
                        script.src.includes('advertising')
                    )) {
                        script.remove();
                    }
                });
            }
            
            // Run initially and then periodically
            blockAds();
            setInterval(blockAds, 1000);
            
            // Also block on new elements added
            new MutationObserver(blockAds).observe(document, {
                childList: true,
                subtree: true
            });
        `;

        // Try to inject the script
        try {
            const iframe = selectors.videoFrame[0];
            if (iframe.contentWindow) {
                const script = iframe.contentWindow.document.createElement('script');
                script.textContent = adBlockScript;
                iframe.contentWindow.document.head.appendChild(script);
            }
        } catch (e) {
            console.log("Could not inject adblock script due to CORS");
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
                            <button class="preview-btn play-btn"><i class="fa-solid fa-play"></i> Watch</button>
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
                <div class="poster-item">
                    <span class="rating-badge"><i class="fas fa-star"></i>${rating}</span>
                    ${isLibrary && item.season && item.episode ? `<span class="episode-info">S${item.season} E${item.episode}</span>` : ''}
                    ${isLibrary ? `<span class="delete-badge" aria-label="Delete ${title} from ${container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history'}"><i class="fas fa-trash"></i></span>` : ''}
                    <img class="poster-img loaded" src="${imageUrl}" alt="${title}" role="button" aria-label="Play ${title}">
                </div>
            `);

            try {
                await loadImage(imageUrl);
            } catch (error) {
                poster.remove();
                return;
            }

            attachClickHandler(poster.find('.poster-img'), () => {
                const year = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const section = container.closest('.search-section').length ? 'search' : 
                               container.closest('.library-section').length ? 'library' : 'home';
                const mediaType = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer').length ? 'tv' : 'movie');
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
                        state.season = season.season_number;
                        state.episode = ep.episode_number;
                        embedVideo();
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
        selectors.videoFrame.attr('src', '');
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', '').attr('alt', '').removeClass('loaded');
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
            { id, type, title, poster, year, season, episode, section: state.previousSection, rating },
            '',
            url
        );

        selectors.videoPage.data({ id, type, title, poster, year });

        selectors.watchlistBtn.html(`Add to Watchlist <i class="${state.watchlist.some(w => w.id === id) ? 'fa-solid fa-check' : 'fas fa-plus'}"></i>`);
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
            selectors.mediaPoster.attr('src', posterUrl).attr('alt', `${title} Poster`).removeClass('loaded');
            loadImage(posterUrl).then(() => {
                selectors.mediaPoster.addClass('loaded');
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
            selectors.mediaPoster.attr('src', poster || '').attr('alt', `${title} Poster`).removeClass('loaded');
            loadImage(poster).then(() => {
                selectors.mediaPoster.addClass('loaded');
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
            embedVideo();
        } else {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                $(`.episode-btn[data-season="${season}"][data-episode="${episode}"]`).addClass('active');
                embedVideo();
                selectors.downloadBtn.attr('href', `https://dl.vidsrc.vip/tv/${id}/${season}/${episode}`);
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
            window.history.replaceState({ section: 'search' }, '', '/search');
        } else if (section === 'library') {
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
        }
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
        const { id, type, title, poster, year } = selectors.videoPage.data();
        const rating = selectors.mediaRatingBadge.find('.rating-value').text() || '0';
        toggleWatchlist({ id, type, title, poster, rating: parseFloat(rating), year });
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
            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', `translateX(${-state.previewIndex * 100}%)`);
            }
        }, 200);
    });

    const handleInitialLoad = async () => {
        const path = window.location.pathname;
        const movieMatch = path.match(/^\/movie\/(\d+)$/);
        const tvMatch = path.match(/^\/tv\/(\d+)(?:\/(\d+)\/(\d+))?$/);
        
        if (movieMatch) {
            const id = movieMatch[1];
            const stateData = history.state || {};
            let title = stateData.title || 'Unknown';
            let year = stateData.year || 'N/A';
            let poster = stateData.poster || '';
            let rating = stateData.rating || 'N/A';
            if (!stateData.title) {
                try {
                    const data = await fetchWithRetry(`https://api.themoviedb.org/3/movie/${id}?api_key=${config.apiKey}`);
                    title = data.title || 'Unknown';
                    year = data.release_date?.split('-')[0] || 'N/A';
                    poster = getImageUrl(data.poster_path) || '';
                    rating = data.vote_average?.toFixed(1) || 'N/A';
                } catch (error) {
                    console.error('Failed to fetch movie details for initial load', error);
                }
            }
            navigateToMedia(id, 'movie', title, poster, year, null, null, 'home', rating);
        } else if (tvMatch) {
            const id = tvMatch[1];
            const season = tvMatch[2] ? parseInt(tvMatch[2]) : null;
            const episode = tvMatch[3] ? parseInt(tvMatch[3]) : null;
            const stateData = history.state || {};
            let title = stateData.title || 'Unknown';
            let year = stateData.year || 'N/A';
            let poster = stateData.poster || '';
            let rating = stateData.rating || 'N/A';
            if (!stateData.title) {
                try {
                    const data = await fetchWithRetry(`https://api.themoviedb.org/3/tv/${id}?api_key=${config.apiKey}`);
                    title = data.name || 'Unknown';
                    year = data.first_air_date?.split('-')[0] || 'N/A';
                    poster = getImageUrl(data.poster_path) || '';
                    rating = data.vote_average?.toFixed(1) || 'N/A';
                } catch (error) {
                    console.error('Failed to fetch TV details for initial load', error);
                }
            }
            navigateToMedia(id, 'tv', title, poster, year, season, episode, 'home', rating);
        } else {
            window.history.replaceState({ section: 'home' }, '', '/home');
            loadHomepage();
        }
    };

    // Initialize
    initializeServers();
    setupPreviewTouch();
    handleInitialLoad();
});
