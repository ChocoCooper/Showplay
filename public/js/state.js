export const state = {
    mediaType: 'movie',
    mediaId: null,
    season: null,
    episode: null,
    selectedEpisodes: {}, // { season: episode }
    lastPlayedEpisodes: JSON.parse(localStorage.getItem('lastPlayedEpisodes')) || {}, // { mediaId: { season: episode } }
    trendingMovies: [],
    previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
    previewInterval: null,
    recentlyWatched: JSON.parse(localStorage.getItem('recentlyWatched')) || [],
    cachedMedia: {},
    servers: [
        { name: 'Server 1', url: 'https://vidfast.pro' },
        { name: 'Server 2', url: 'https://111movies.com' },
        { name: 'Server 3', url: 'https://vidsrc.cc/v2' }
    ]
};

export const saveState = () => {
    localStorage.setItem('previewIndex', state.previewIndex);
    localStorage.setItem('recentlyWatched', JSON.stringify(state.recentlyWatched));
    localStorage.setItem('lastPlayedEpisodes', JSON.stringify(state.lastPlayedEpisodes));
};
