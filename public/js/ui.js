import { state, saveState } from './state.js';
import { fetchMediaDetails, fetchSeasons, fetchEpisodes } from './api.js';

export const selectors = {
    videoPage: $('#videoPage'),
    videoFrame: $('#videoFrame'),
    videoBackArrow: $('#videoBackArrow'),
    videoMediaTitle: $('#videoMediaTitle'),
    videoLoadingSpinner: $('#videoLoadingSpinner'),
    selectorContainer: $('#selectorContainer'),
    seasonSelector: $('#seasonSelector'),
    episodeSelector: $('#episodeSelector'),
    seasonGrid: $('#seasonGrid'),
    episodeGrid: $('#episodeGrid'),
    serverGrid: $('#serverGrid'),
    mediaDetails: $('#mediaDetails'),
    mediaPoster: $('#mediaPoster'),
    mediaDetailsTitle: $('#mediaDetailsTitle'),
    mediaYearGenre: $('#mediaYearGenre'),
    mediaPlot: $('#mediaPlot'),
    homepage: $('#homepage'),
    mainTitle: $('#mainTitle'),
    searchIcon: $('#searchIcon'),
    searchContainer: $('#searchContainer'),
    searchBox: $('#searchBox'),
    searchResults: $('#searchResults'),
    backArrow: $('#backArrow'),
    mediaTitle: $('#mediaTitle'),
    previewSection: $('#previewSection'),
    previewTitle: $('#previewTitle'),
    previewGenres: $('#previewGenres'),
    previewPlayBtn: $('#previewPlayBtn'),
    previewLoadingSpinner: $('#previewLoadingSpinner'),
    footer: $('#footer'),
    recentlyWatchedSection: $('#recentlyWatchedSection'),
    recentlyWatchedSlider: $('#recentlyWatchedSlider'),
    moviesSlider: $('#moviesSliderContainer'),
    tvSlider: $('#tvSliderContainer'),
    animeSlider: $('#animeSliderContainer'),
    kdramaSlider: $('#kdramaSliderContainer')
};

export const handleError = (error, message, element) => {
    console.error(message, error);
    if (element) {
        element.empty().html(`<div class="search-no-results">Error: ${message}</div>`);
    }
};

export const initializeServers = () => {
    selectors.serverGrid.empty();
    state.servers.forEach((server, i) => {
        const btn = $(`<button class="server-btn${i === 0 ? ' active' : ''}">${server.name}</button>`).data('url', server.url);
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

export const getServerUrl = () => $('.server-btn.active').data('url') || state.servers[0].url;

export const renderMediaItem = (item, mediaType, container, isRecent = false) => {
    const title = item.title || item.name;
    const imageUrl = `https://image.tmdb.org/t/p/w300${item.poster_path || item.poster}?format=webp`;
    const poster = $(`
        <div class="poster-item">
            <img src="${imageUrl}" alt="${title}" class="poster-img" loading="lazy" role="button" aria-label="Play ${title}" />
            ${isRecent && mediaType === 'tv' ? `<span class="episode-badge">S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}</span>` : ''}
            ${isRecent ? `<span class="delete-badge" role="button" aria-label="Remove ${title} from recently watched"><i class="fas fa-trash"></i></span>` : ''}
        </div>
    `);
    poster.find('.poster-img').on('click', e => {
        e.stopPropagation();
        navigateToMedia(item.id, mediaType, title, imageUrl, item.release_date || item.first_air_date || item.year, item.season, item.episode);
    });
    if (isRecent) {
        poster.find('.delete-badge').on('click', e => {
            e.stopPropagation();
            state.recentlyWatched = state.recentlyWatched.filter(w => !(w.id === item.id && w.season === item.season && w.episode === item.episode));
            saveState();
            loadRecentlyWatched();
        });
    }
    container.append(poster);
};

export const loadRecentlyWatched = () => {
    selectors.recentlyWatchedSlider.empty();
    if (!state.recentlyWatched.length) {
        selectors.recentlyWatchedSection.removeClass('active').hide();
        return;
    }
    state.recentlyWatched.forEach(item => renderMediaItem(item, item.type, selectors.recentlyWatchedSlider, true));
    selectors.recentlyWatchedSection.addClass('active').show();
};

export const renderPreviewContent = (trendingMovies) => {
    if (!trendingMovies.length) {
        selectors.previewSection.find('.preview-background').remove();
        selectors.previewTitle.empty();
        selectors.previewGenres.empty();
        selectors.previewLoadingSpinner.show();
        return;
    }
    selectors.previewLoadingSpinner.hide();
    selectors.previewSection.find('.preview-background').remove();
    selectors.previewSection.prepend(
        trendingMovies.map((m, i) => 
            `<img class="preview-background${i === state.previewIndex ? ' active' : ''}" 
                  src="https://image.tmdb.org/t/p/w780${m.backdrop_path}?format=webp" 
                  alt="${m.title}" 
                  data-id="${m.id}" 
                  data-title="${m.title}" 
                  data-poster="https://image.tmdb.org/t/p/w500${m.poster_path}?format=webp" 
                  data-year="${m.release_date}"
                  loading="${i === state.previewIndex ? 'eager' : 'lazy'}">`
        ).join('')
    );

    if (trendingMovies.length) {
        ['0', '1'].forEach(i => {
            new Image().src = `https://image.tmdb.org/t/p/w780${trendingMovies[i].backdrop_path}?format=webp`;
            new Image().src = `https://image.tmdb.org/t/p/w500${trendingMovies[i].logo_path}?format=webp`;
        });
    }

    updatePreviewContent(state.previewIndex);
};

export const updatePreviewContent = (index) => {
    if (!state.trendingMovies.length) return;
    $('.preview-background').removeClass('active').eq(index).addClass('active');
    const movie = state.trendingMovies[index];
    selectors.previewTitle.html(`<img src="https://image.tmdb.org/t/p/w500${movie.logo_path}?format=webp" alt="${movie.title}">`);
    selectors.previewGenres.text(movie.genres || '');
    selectors.previewPlayBtn.off('click').on('click', e => {
        e.stopPropagation();
        e.preventDefault();
        navigateToMedia(movie.id, 'movie', movie.title, `https://image.tmdb.org/t/p/w500${movie.poster_path}?format=webp`, movie.release_date);
    });

    const nextIndices = [(index + 1) % state.trendingMovies.length, (index + 2) % state.trendingMovies.length];
    nextIndices.forEach(i => {
        new Image().src = `https://image.tmdb.org/t/p/w780${state.trendingMovies[i].backdrop_path}?format=webp`;
        new Image().src = `https://image.tmdb.org/t/p/w500${state.trendingMovies[i].logo_path}?format=webp`;
    });
};

export const embedVideo = () => {
    selectors.videoLoadingSpinner.show();
    const server = getServerUrl();
    let url;
    if (state.mediaType === 'movie') {
        const { title, poster, year } = selectors.videoPage.data();
        if (title && year) selectors.videoMediaTitle.text(`${title}\n(${year.split('-')[0]})`);
        url = server === 'https://vidsrc.cc/v2' ? `${server}/embed/movie/${state.mediaId}` : `${server}/movie/${state.mediaId}`;
    } else if (state.season && state.episode) {
        url = server === 'https://vidsrc.cc/v2' ? `${server}/embed/tv/${state.mediaId}/${state.season}/${state.episode}` : `${server}/tv/${state.mediaId}/${state.season}/${state.episode}`;
    } else {
        selectors.videoLoadingSpinner.hide();
        selectors.videoPage.addClass('active');
        return;
    }

    if (!state.servers.some(s => url.startsWith(s.url))) {
        handleError(new Error('Invalid embed URL'), 'Invalid video source', selectors.videoFrame);
        selectors.videoFrame.attr('src', '');
        selectors.videoLoadingSpinner.hide();
        return;
    }

    selectors.videoFrame.attr('src', url).on('load', () => selectors.videoLoadingSpinner.hide());
    selectors.videoPage.addClass('active');
    selectors.selectorContainer.addClass('active').show();
    selectors.mediaDetails.addClass('active').show();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const applyMediaDetails = (data) => {
    const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}?format=webp` : '';
    const title = data.title || data.name || 'Unknown Title';
    const year = (data.release_date || data.first_air_date || '').split('-')[0];
    const genres = data.genres?.map(g => g.name).join(', ') || 'N/A';
    const plot = data.overview || 'No plot summary available.';

    selectors.mediaPoster.attr('src', poster).attr('alt', `${title} poster`);
    selectors.mediaDetailsTitle.text(title);
    selectors.mediaYearGenre.text(`${year} | ${genres}`);
    selectors.mediaPlot.text(plot);
    selectors.videoMediaTitle.text(`${title}\n(${year})`);
};

export const loadSeasons = async () => {
    try {
        const data = await fetchSeasons(state.mediaId);
        const seasons = data.seasons.filter(s => s.season_number > 0);
        selectors.videoPage.data({
            title: data.name || '',
            poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}?format=webp` : '',
            year: data.first_air_date || ''
        });
        selectors.videoMediaTitle.text(`${data.name}\n(${data.first_air_date?.split('-')[0] || ''})`);

        selectors.seasonGrid.empty();
        seasons.forEach(s => {
            const btn = $(`<button class="season-btn" data-value="${s.season_number}" aria-label="Select Season ${s.season_number}">Season ${s.season_number}</button>`);
            btn.on('click', () => {
                $('.season-btn').removeClass('active');
                btn.addClass('active');
                state.season = s.season_number;
                loadEpisodes(s.season_number);
            });
            selectors.seasonGrid.append(btn);
        });

        const targetSeason = state.season || (state.lastPlayedEpisodes[state.mediaId]?.season) || 1;
        const seasonBtn = $(`.season-btn[data-value="${targetSeason}"]`);
        if (seasonBtn.length) {
            seasonBtn.addClass('active');
            loadEpisodes(targetSeason);
        } else if (seasons.length) {
            $(`.season-btn[data-value="${seasons[0].season_number}"]`).addClass('active');
            loadEpisodes(seasons[0].season_number);
        }
    } catch (error) {
        handleError(error, 'Error fetching seasons', selectors.seasonGrid);
        selectors.videoMediaTitle.text('Loading...');
        throw error;
    }
};

export const loadEpisodes = async (season) => {
    try {
        const data = await fetchEpisodes(state.mediaId, season);
        selectors.episodeGrid.empty();
        data.episodes.forEach(e => {
            const btn = $(`<button class="episode-btn" data-value="${e.episode_number}" title="${e.name || `Episode ${e.episode_number}`}" aria-label="Select Episode ${e.episode_number}">${e.episode_number}</button>`);
            btn.on('click', () => {
                $('.episode-btn').removeClass('active');
                btn.addClass('active');
                state.season = season;
                state.episode = e.episode_number;
                state.selectedEpisodes = { [season]: e.episode_number };
                state.lastPlayedEpisodes[state.mediaId] = { season, episode: e.episode_number };
                saveState();
                embedVideo();
                navigateToMedia(
                    state.mediaId, 'tv',
                    selectors.videoPage.data('title'),
                    selectors.videoPage.data('poster'),
                    selectors.videoPage.data('year'),
                    season, e.episode_number
                );
            });
            if (state.selectedEpisodes[season] === e.episode_number || 
                (state.lastPlayedEpisodes[state.mediaId]?.season === season && 
                 state.lastPlayedEpisodes[state.mediaId]?.episode === e.episode_number)) {
                btn.addClass('active');
            }
            selectors.episodeGrid.append(btn);
        });

        if (!state.episode && state.lastPlayedEpisodes[state.mediaId]?.season === season) {
            state.episode = state.lastPlayedEpisodes[state.mediaId].episode;
            $(`.episode-btn[data-value="${state.episode}"]`).addClass('active');
            embedVideo();
        } else if (!state.episode && data.episodes.length) {
            state.episode = data.episodes[0].episode_number;
            $(`.episode-btn[data-value="${state.episode}"]`).addClass('active');
            embedVideo();
        }
    } catch (error) {
        handleError(error, 'Error fetching episodes', selectors.episodeGrid);
        throw error;
    }
};

export const navigateToMedia = (id, type, title, poster, year, season, episode) => {
    if (!id || isNaN(id)) {
        handleError(new Error('Invalid media ID'), 'Invalid media ID', selectors.videoPage);
        return;
    }
    stopPreviewSlideshow();
    state.mediaId = id;
    state.mediaType = type;
    state.season = season;
    state.episode = episode;
    if (type === 'tv' && season && episode) {
        state.selectedEpisodes[season] = episode;
        state.lastPlayedEpisodes[id] = { season, episode };
        saveState();
    }

    const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}${season && episode ? `?season=${season}&episode=${episode}` : ''}`;
    window.history.pushState({ id, type, title, poster, year, season, episode }, '', path);

    selectors.videoPage.data({ title, poster, year });

    handleMediaClick(title, poster, year);

    const item = { id, type, title, poster: poster || '', year, season, episode, timestamp: Date.now() };
    const index = state.recentlyWatched.findIndex(w => w.id === id && w.season === season && w.episode === episode);
    if (index !== -1) {
        state.recentlyWatched.splice(index, 1);
    }
    state.recentlyWatched.unshift(item);
    state.recentlyWatched = state.recentlyWatched.slice(0, 10);
    saveState();

    selectors.searchContainer.removeClass('active');
    selectors.searchBox.val('');
    selectors.searchResults.empty();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const handleMediaClick = async (title, poster, year) => {
    selectors.videoFrame.attr('src', '');
    selectors.videoPage.data({ title, poster, year });

    selectors.videoPage.addClass('active').show();
    selectors.homepage.hide();
    selectors.mainTitle.hide();
    selectors.searchIcon.hide();
    selectors.backArrow.hide();
    selectors.mediaTitle.hide();
    selectors.videoBackArrow.show();
    selectors.videoMediaTitle.show();
    selectors.footer.hide();

    selectors.videoMediaTitle.text(title && year ? `${title}\n(${year.split('-')[0]})` : title || 'Loading...');

    selectors.seasonSelector.toggle(state.mediaType === 'tv');
    selectors.episodeSelector.toggle(state.mediaType === 'tv');

    try {
        await fetchMediaDetails(state.mediaType, state.mediaId).then(data => {
            state.cachedMedia[`${state.mediaType}-${state.mediaId}`] = data;
            applyMediaDetails(data);
        });
        if (state.mediaType === 'movie') {
            embedVideo();
        } else {
            await loadSeasons();
            if (state.season && state.episode) {
                embedVideo();
                $(`.season-btn[data-value="${state.season}"]`).addClass('active');
                await loadEpisodes(state.season);
                $(`.episode-btn[data-value="${state.episode}"]`).addClass('active');
            }
        }
        selectors.selectorContainer.addClass('active').show();
        selectors.mediaDetails.addClass('active').show();
    } catch (error) {
        handleError(error, 'Error loading media', selectors.videoPage);
        selectors.videoFrame.attr('src', '');
        selectors.videoMediaTitle.text('Error loading media');
        selectors.mediaDetails.hide();
    }
    $('body').css('overflow-y', 'auto');
};

export const startPreviewSlideshow = () => {
    if (state.previewInterval || selectors.videoPage.is(':visible') || !state.trendingMovies.length) return;
    state.previewInterval = setInterval(() => {
        state.previewIndex = (state.previewIndex + 1) % state.trendingMovies.length;
        saveState();
        updatePreviewContent(state.previewIndex);
    }, 6000);
};

export const stopPreviewSlideshow = () => {
    if (state.previewInterval) {
        clearInterval(state.previewInterval);
        state.previewInterval = null;
    }
};

export const setupPreviewTouch = () => {
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
                if (Math.abs(diff) > 30) {
                    stopPreviewSlideshow();
                    state.previewIndex = diff > 0 
                        ? (state.previewIndex + 1) % state.trendingMovies.length 
                        : (state.previewIndex - 1 + state.trendingMovies.length) % state.trendingMovies.length;
                    saveState();
                    updatePreviewContent(state.previewIndex);
                    startPreviewSlideshow();
                }
                touchStartX = touchEndX = 0;
            }
        }
    });
};
