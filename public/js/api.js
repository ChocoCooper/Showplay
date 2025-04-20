export const fetchWithRetry = async (url, params = {}, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`/.netlify/functions/tmdb-proxy${url}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                params
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
};

export const fetchTrending = async (type, page = 1) => {
    let url;
    if (type === 'movie') url = `/3/trending/movie/week?page=${page}`;
    else if (type === 'tv') url = `/3/trending/tv/week?page=${page}`;
    else if (type === 'anime') url = `/3/discover/tv?with_genres=16&sort_by=popularity.desc&with_original_language=ja&vote_average.gte=8&vote_count.gte=1000&first_air_date.gte=1990-01-01&page=${page}`;
    else url = `/3/discover/tv?with_original_language=ko&sort_by=popularity.desc&sort_by=first_air_date.desc&vote_average.gte=7&vote_count.gte=100&first_air_date.gte=2020-01-01&page=${page}`;
    return await fetchWithRetry(url);
};

export const fetchMovieDetails = async (movieId) => {
    const data = await fetchWithRetry(`/3/movie/${movieId}?append_to_response=images`);
    const logo = (data.images?.logos || []).find(l => l.file_path && l.iso_639_1 === 'en') || data.images?.logos[0];
    return {
        logo: logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : '',
        genres: data.genres?.map(g => g.name).join(', ') || ''
    };
};

export const fetchMediaDetails = async (mediaType, mediaId) => {
    return await fetchWithRetry(`/3/${mediaType}/${mediaId}`);
};

export const fetchSeasons = async (mediaId) => {
    return await fetchWithRetry(`/3/tv/${mediaId}`);
};

export const fetchEpisodes = async (mediaId, season) => {
    return await fetchWithRetry(`/3/tv/${mediaId}/season/${season}`);
};

export const searchMedia = async (query) => {
    return await fetchWithRetry(`/3/search/multi?query=${encodeURIComponent(query)}&page=1&include_adult=false`);
};
