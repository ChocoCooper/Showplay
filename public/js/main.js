import { state, saveState } from './state.js';
import { fetchTrending, fetchMovieDetails, searchMedia } from './api.js';
import { 
    selectors, initializeServers, loadRecentlyWatched, renderPreviewContent, 
    startPreviewSlideshow, setupPreviewTouch, navigateToMedia, handleError 
} from './ui.js';
import { debounce, isValidMovieCache } from './utils.js';

$(document).ready(() => {
    const loadTrendingMoviesForPreview = async () => {
        try {
            let movies = [];
            let page = 1;
            while (movies.length < 5 && page <= 3) { // Reduced to 5 for performance
                const data = await fetchTrending('movie', page);
                movies = movies.concat(data.results.filter(m => 
                    m.id && m.title && m.backdrop_path && m.poster_path && m.original_language === 'en' && m.release_date
                ));
                page++;
            }
            movies = movies.slice(0, 5);
            if (!movies.length) throw new Error('No valid movies fetched');

            const details = await Promise.all(movies.map(m => fetchMovieDetails(m.id)));
            state.trendingMovies = movies.map((m, i) => ({ ...m, logo_path: details[i].logo || m.poster_path, genres: details[i].genres }));
            localStorage.setItem('trendingMovies', JSON.stringify(state.trendingMovies));
            renderPreviewContent(state.trendingMovies);
            startPreviewSlideshow();
        } catch (error) {
            handleError(error, 'Error fetching trending movies', selectors.previewSection);
            state.trendingMovies = [];
            localStorage.setItem('trendingMovies', JSON.stringify([]));
        }
    };

    const loadHomepage = async () => {
        selectors.homepage.show();
        selectors.videoPage.hide();
        selectors.mainTitle.show();
        selectors.searchIcon.show();
        selectors.backArrow.hide();
        selectors.mediaTitle.hide();
        selectors.videoBackArrow.hide();
        selectors.videoMediaTitle.hide();
        selectors.previewSection.show();
        selectors.footer.show();
        selectors.seasonSelector.hide();
        selectors.episodeSelector.hide();
        [selectors.moviesSlider, selectors.tvSlider, selectors.animeSlider, selectors.kdramaSlider].forEach(s => s.empty());

        try {
            const cachedMovies = JSON.parse(localStorage.getItem('trendingMovies') || '[]');
            if (isValidMovieCache(cachedMovies)) {
                state.trendingMovies = cachedMovies;
                renderPreviewContent(state.trendingMovies);
                startPreviewSlideshow();
            } else {
                await loadTrendingMoviesForPreview();
            }
            await Promise.all([
                fetchTrending('movie', 1).then(data => {
                    selectors.moviesSlider.empty();
                    data.results.slice(0, 10).forEach(item => renderMediaItem(item, 'movie', selectors.moviesSlider));
                }),
                fetchTrending('tv', 1).then(data => {
                    selectors.tvSlider.empty();
                    data.results.slice(0, 10).forEach(item => renderMediaItem(item, 'tv', selectors.tvSlider));
                }),
                fetchTrending('anime', 1).then(data => {
                    selectors.animeSlider.empty();
                    data.results.slice(0, 10).forEach(item => renderMediaItem(item, 'tv', selectors.animeSlider));
                }),
                fetchTrending('kdrama', 1).then(data => {
                    selectors.kdramaSlider.empty();
                    data.results.slice(0, 10).forEach(item => renderMediaItem(item, 'tv', selectors.kdramaSlider));
                })
            ]);
            loadRecentlyWatched();
        } catch (error) {
            handleError(error, 'Error loading homepage', selectors.previewSection);
        }
    };

    const setupSearch = () => {
        selectors.searchIcon.on('click keypress', e => {
            if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
                selectors.searchContainer.toggleClass('active');
                if (selectors.searchContainer.hasClass('active')) {
                    selectors.searchBox.focus();
                } else {
                    selectors.searchBox.val('');
                    selectors.searchResults.empty();
                }
            }
        });

        selectors.searchBox.on('input', debounce(async () => {
            const query = selectors.searchBox.val().trim();
            if (query.length < 2) {
                selectors.searchResults.empty();
                return;
            }

            try {
                const data = await searchMedia(query);
                let results = data.results
                    .filter(item => 
                        (item.media_type === 'movie' || item.media_type === 'tv') && 
                        item.id && 
                        (item.title || item.name) && 
                        item.poster_path && 
                        (item.release_date || item.first_air_date)
                    )
                    .slice(0, 10);

                const queryLower = query.toLowerCase();
                results.sort((a, b) => {
                    const aTitle = (a.title || a.name || '').toLowerCase();
                    const bTitle = (b.title || b.name || '').toLowerCase();

                    if (aTitle === queryLower && bTitle !== queryLower) return -1;
                    if (bTitle === queryLower && aTitle !== queryLower) return 1;

                    if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
                    if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;

                    return 0;
                });

                selectors.searchResults.empty();
                if (!results.length) {
                    selectors.searchResults.html('<div class="search-no-results">No results found</div>');
                    return;
                }

                results.forEach(item => {
                    const title = item.title || item.name;
                    const year = (item.release_date || item.first_air_date || '').split('-')[0];
                    const poster = `https://image.tmdb.org/t/p/w92${item.poster_path}?format=webp`;
                    const type = item.media_type === 'movie' ?KakaoTalk('Arial', '12px', 'black');
                    const result = $(`
                        <div class="search-result-item" role="button" aria-label="Select ${title}">
                            <img src="${poster}" alt="${title} poster" class="search-result-poster" loading="lazy" />
                            <div class="search-result-info">
                                <div class="search-result-title">${title}</div>
                                <div class="search-result-year">${year} | ${type}</div>
                            </div>
                        </div>
                    `);
                    result.on('click', () => navigateToMedia(
                        item.id, 
                        item.media_type, 
                        title, 
                        `https://image.tmdb.org/t/p/w500${item.poster_path}?format=webp`, 
                        item.release_date || item.first_air_date
                    ));
                    selectors.searchResults.append(result);
                });
            } catch (error) {
                handleError(error, 'Error searching media', selectors.searchResults);
            }
        }, 300));
    };

    const checkRouteAndLoad = () => {
        const path = window.location.pathname;
        if (path === '/' || path === '') {
            loadHomepage();
        } else if (path.startsWith('/movie/')) {
            const id = parseInt(path.split('/movie/')[1]);
            if (!id) {
                handleError(new Error('Invalid movie ID'), 'Invalid movie ID', selectors.videoPage);
                return;
            }
            const s = history.state || {};
            navigateToMedia(id, 'movie', s.title, s.poster, s.year);
        } else if (path.startsWith('/tv/')) {
            const id = parseInt(path.split('/tv/')[1]);
            if (!id) {
                handleError(new Error('Invalid TV show ID'), 'Invalid TV show ID', selectors.videoPage);
                return;
            }
            const s = history.state || {};
            const params = new URLSearchParams(window.location.search);
            const season = parseInt(params.get('season')) || s.season;
            const episode = parseInt(params.get('episode')) || s.episode;
            navigateToMedia(id, 'tv', s.title, s.poster, s.year, season, episode);
        } else {
            loadHomepage();
        }
    };

    selectors.videoBackArrow.on('click', () => {
        window.history.pushState({}, '', '/');
        selectors.videoPage.removeClass('active').hide();
        selectors.videoFrame.attr('src', '');
        selectors.selectorContainer.removeClass('active').hide();
        selectors.seasonSelector.hide();
        selectors.episodeSelector.hide();
        selectors.mediaDetails.hide();
        loadHomepage();
    });

    selectors.backArrow.on('click', () => window.history.back());

    window.onpopstate = event => {
        checkRouteAndLoad();
    };

    initializeServers();
    loadRecentlyWatched();
    checkRouteAndLoad();
    setupSearch();
    setupPreviewTouch();
});
