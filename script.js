// JavaScript for URL Routing and Dynamic Rendering
const routes = {
    '/': renderHomePage,
    '/search/:query': renderSearchResults,
    '/:mediaType/:id': renderVideoPage,
};

function renderHomePage() {
    // Render the home page with trending content
    fetchTrending('movie');
}

function renderSearchResults(query) {
    // Render search results based on the query
    searchQueryInput.value = decodeURIComponent(query);
    search();
}

function renderVideoPage(mediaType, id) {
    // Render the video page based on the media type and ID
    handleSeriesClick(id, mediaType);
}

function handleRoute() {
    const path = window.location.pathname;
    const route = Object.keys(routes).find((route) => {
        const routeParts = route.split('/');
        const pathParts = path.split('/');
        if (routeParts.length !== pathParts.length) return false;
        return routeParts.every((part, index) => part === pathParts[index] || part.startsWith(':'));
    });

    if (route) {
        const routeParts = route.split('/');
        const pathParts = path.split('/');
        const params = routeParts.map((part, index) => part.startsWith(':') ? pathParts[index] : null).filter(Boolean);
        routes[route](...params);
    } else {
        // Default to home page
        renderHomePage();
    }
}

// Add event listener for URL changes
window.addEventListener('popstate', handleRoute);

// Initial route handling
handleRoute();

// Modify search function to update URL
function search() {
    const query = searchQueryInput.value.trim();
    if (query) {
        history.pushState(null, '', `/search/${encodeURIComponent(query)}`);
        renderSearchResults(query);
    }
}

// Modify handleSeriesClick to update URL
function handleSeriesClick(mediaId, mediaType) {
    history.pushState(null, '', `/${mediaType}/${mediaId}`);
    renderVideoPage(mediaType, mediaId);
}

const resultsContainer = document.getElementById('resultsContainer');
const videoFrame = document.getElementById('videoFrame');
const videoContainer = document.getElementById('videoContainer');
const searchQueryInput = document.getElementById('searchQuery');
const searchButton = document.getElementById('searchButton');
const imageContainer = document.getElementById('imageGallery');
const closeButton = document.getElementById('closeButton');
const moviesToggle = document.getElementById('moviesToggle');
const seriesToggle = document.getElementById('seriesToggle');
const animeToggle = document.getElementById('animeToggle');
const dramaToggle = document.getElementById('dramaToggle');
const showsToggle = document.getElementById('showsToggle');
const filterDropdown = document.getElementById('filterDropdown');
const dropdownMenu = document.getElementById('dropdownMenu');
const selectorContainer = document.getElementById('selectorContainer');
const seasonSelect = document.getElementById('season-select');
const episodeSelect = document.getElementById('episode-select');
const serverSelect = document.getElementById('server-select');
const toggleContainer = document.querySelector('.mydict');
const loadingSpinner = document.getElementById('loadingSpinner');
const paginationContainer = document.getElementById('paginationContainer');
const prevPageButton = document.getElementById('prevPage');
const nextPageButton = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const homeButton = document.getElementById('homeButton');
const noResultsMessage = document.getElementById('noResultsMessage');

let currentMediaType = 'movie'; // Default to movies
let currentMediaId = null;
let currentPage = 1;
let totalPages = 1;
const resultsPerPage = 12; // Limit results to 12 per page

// Show the image gallery initially
imageContainer.style.display = 'flex';

// Hide the video frame initially
videoContainer.style.display = 'none';

// Hide toggle container when searching or video is playing
function hideToggle() {
    toggleContainer.style.display = 'none';
}

// Show toggle container when displaying the image gallery
function showToggle() {
    toggleContainer.style.display = 'block';
}

// Hide selectors when Movies toggle is selected
function hideSelectors() {
    selectorContainer.style.display = 'none'; // Hide selectors
    seasonSelect.style.display = 'none'; // Hide season selector
    episodeSelect.style.display = 'none'; // Hide episode selector
}

// Show selectors when Series or Anime toggle is selected
function showSelectors() {
    selectorContainer.style.display = 'flex'; // Show the selector container
    if (currentMediaType === 'tv' || currentMediaType === 'anime' || currentMediaType === 'drama' || currentMediaType === 'shows') {
        seasonSelect.style.display = 'block'; // Show season selector
        episodeSelect.style.display = 'block'; // Show episode selector
    } else {
        seasonSelect.style.display = 'none'; // Hide season selector
        episodeSelect.style.display = 'none'; // Hide episode selector
    }
}

// Clear the search bar text
function clearSearchText() {
    searchQueryInput.value = '';
}

// Reset dropdowns to default states
function resetDropdowns() {
    seasonSelect.innerHTML = '<option value="">Select Season</option>'; // Reset season dropdown
    episodeSelect.innerHTML = '<option value="">Select Episode</option>'; // Reset episode dropdown
    serverSelect.value = 'https://vidsrc.cc/v2'; // Set default server to Server 1
}

// Handle clicking on a series
function handleSeriesClick(mediaId, mediaType) {
    currentMediaId = mediaId;
    currentMediaType = mediaType;
    resetDropdowns(); // Reset dropdowns when a new series is selected
    videoFrame.src = ''; // Clear the iframe source
    videoContainer.style.display = 'block'; // Show the video container

    // Set the server to Server 1 by default
    serverSelect.value = 'https://vidsrc.cc/v2';

    if (mediaType === 'movie') {
        embedVideo(mediaId, 'movie'); // Embed the movie directly
    } else if (mediaType === 'tv' || mediaType === 'anime' || currentMediaType === 'drama' || currentMediaType === 'shows') {
        fetchSeasons(mediaId); // Fetch seasons for the selected series
    }

    showSelectors(); // Show selectors for series
    imageContainer.style.display = 'none'; // Hide gallery on selection
    homeButton.style.display = 'block'; // Show home button
    paginationContainer.style.display = 'none'; // Hide pagination on video page
    hideToggle(); // Hide toggle when video is embedded
}

// Add event listener for home button
homeButton.addEventListener('click', () => {
    videoContainer.style.display = 'none';
    videoFrame.src = ''; // Stop the video
    hideSelectors(); // Hide selectors
    imageContainer.style.display = 'flex'; // Show image gallery again
    showToggle(); // Show toggle buttons
    resetDropdowns(); // Reset dropdowns
    homeButton.style.display = 'none'; // Hide home button
    paginationContainer.style.display = 'none'; // Hide pagination on gallery page
});

// Add event listener for Enter key
searchQueryInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        hideToggle(); // Hide toggle when searching
        search();
    }
});

// Add event listener for search button
searchButton.addEventListener('click', () => {
    hideToggle(); // Hide toggle when searching
    search();
});

// Add event listener for close button
closeButton.addEventListener('click', () => {
    videoContainer.style.display = 'none';
    videoFrame.src = ''; // Stop the video
    hideSelectors(); // Hide selectors
    imageContainer.style.display = 'flex'; // Show image gallery again
    showToggle(); // Show toggle buttons
    resetDropdowns(); // Reset dropdowns when closing the video container
    homeButton.style.display = 'none'; // Hide home button
    paginationContainer.style.display = 'none'; // Hide pagination on gallery page
});

// Add event listeners for toggle switches
moviesToggle.addEventListener('change', () => {
    if (moviesToggle.checked) {
        currentMediaType = 'movie';
        hideSelectors(); // Hide selectors for movies
        fetchTrending('movie'); // Fetch trending movies
    }
});

seriesToggle.addEventListener('change', () => {
    if (seriesToggle.checked) {
        currentMediaType = 'tv';
        fetchTrending('tv'); // Fetch trending series
    }
});

animeToggle.addEventListener('change', () => {
    if (animeToggle.checked) {
        currentMediaType = 'anime';
        fetchTrending('anime'); // Fetch trending anime
    }
});

dramaToggle.addEventListener('change', () => {
    if (dramaToggle.checked) {
        currentMediaType = 'drama';
        fetchTrending('drama'); // Fetch trending Korean and Chinese dramas
    }
});

showsToggle.addEventListener('change', () => {
    if (showsToggle.checked) {
        currentMediaType = 'shows';
        fetchTrending('shows'); // Fetch trending English reality shows
    }
});

// Add event listener for filter dropdown
filterDropdown.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent the click from propagating to the document
    dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (event) => {
    if (!filterDropdown.contains(event.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// Handle dropdown item selection
dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all items
        dropdownMenu.querySelectorAll('.dropdown-item').forEach(i => {
            i.classList.remove('active');
        });

        // Add active class to the selected item
        item.classList.add('active');

        // Get the selected value
        const selectedValue = item.getAttribute('data-value');

        // Close the dropdown
        dropdownMenu.classList.remove('show');

        // Reset to the first page when filter changes
        currentPage = 1;

        // Trigger search if there's a query
        const query = searchQueryInput.value.trim();
        if (query) {
            search();
        }
    });
});

// Add event listener for season selection
seasonSelect.addEventListener('change', async () => {
    const seasonNumber = seasonSelect.value;
    if (seasonNumber && currentMediaId) {
        await fetchEpisodes(currentMediaId, seasonNumber);
    }
});

// Add event listener for episode selection
episodeSelect.addEventListener('change', () => {
    const episodeNumber = episodeSelect.value;
    if (episodeNumber && currentMediaId) {
        const seasonNumber = seasonSelect.value;
        embedVideo(currentMediaId, currentMediaType, seasonNumber, episodeNumber);
    }
});

// Add event listener for server selection
serverSelect.addEventListener('change', () => {
    if (currentMediaId) {
        if (currentMediaType === 'movie') {
            embedVideo(currentMediaId, 'movie');
        } else if (currentMediaType === 'tv' || currentMediaType === 'anime' || currentMediaType === 'drama' || currentMediaType === 'shows') {
            embedVideo(currentMediaId, 'tv', seasonSelect.value, episodeSelect.value);
        }
    }
});

// Add event listeners for pagination buttons
prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        search();
    }
});

nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        search();
    }
});

// Function to fetch trending content
async function fetchTrending(mediaType) {
    const apiKey = 'ea118e768e75a1fe3b53dc99c9e4de09'; // Replace with your TMDb API key
    let url;

    if (mediaType === 'movie') {
        url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${apiKey}`;
    } else if (mediaType === 'tv') {
        url = `https://api.themoviedb.org/3/trending/tv/day?api_key=${apiKey}`;
    } else if (mediaType === 'anime') {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&sort_by=popularity.desc&with_original_language=ja`;
    } else if (mediaType === 'drama') {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=18&sort_by=popularity.desc&with_original_language=ko|zh`;
    } else if (mediaType === 'shows') {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=10764&sort_by=popularity.desc&with_original_language=en`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        const trendingContent = data.results || [];

        // Clear previous images
        imageContainer.innerHTML = '';

        // Display only the first 12 items
        const limitedContent = trendingContent.slice(0, 12);

        limitedContent.forEach(item => {
            const imageUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
            if (imageUrl) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'gallery-item';
                itemDiv.tabIndex = 0; // Make the item focusable
                itemDiv.innerHTML = `
                    <img src="${imageUrl}" alt="${item.title || item.name}" />
                    <p>${item.title || item.name}</p>
                    <p class="release-date">(${new Date(item.release_date || item.first_air_date).getFullYear()})</p>
                `;
                itemDiv.onclick = () => {
                    if (mediaType === 'movie') {
                        handleSeriesClick(item.id, 'movie');
                    } else if (mediaType === 'tv' || mediaType === 'anime' || mediaType === 'drama' || mediaType === 'shows') {
                        handleSeriesClick(item.id, mediaType);
                    }
                };
                itemDiv.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        if (mediaType === 'movie') {
                            handleSeriesClick(item.id, 'movie');
                        } else if (mediaType === 'tv' || mediaType === 'anime' || mediaType === 'drama' || mediaType === 'shows') {
                            handleSeriesClick(item.id, mediaType);
                        }
                    }
                });
                imageContainer.appendChild(itemDiv);
            }
        });
    } catch (error) {
        console.error('Error fetching trending content:', error);
    }
}

// Function to fetch additional details for a movie or TV show
async function fetchDetails(mediaType, mediaId) {
    const apiKey = 'ea118e768e75a1fe3b53dc99c9e4de09'; // Replace with your TMDb API key
    const url = `https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching details:', error);
        return null;
    }
}

// Function to check if the title is in English or has an English translation
function hasEnglishTitle(item) {
    // Check if the original title is in English
    if (/^[A-Za-z0-9\s.,!?\-'"()]+$/.test(item.title || item.name)) {
        return true;
    }

    // Check for an English translation in the translations
    if (item.translations) {
        const englishTranslation = item.translations.translations.find(
            translation => translation.iso_639_1 === 'en'
        );
        if (englishTranslation && englishTranslation.data.title) {
            return true;
        }
    }

    return false;
}

// Function to handle search
async function search() {
    const query = searchQueryInput.value.trim();
    resultsContainer.innerHTML = '';
    noResultsMessage.style.display = 'none'; // Hide "No results" message initially

    // Hide the video frame when searching
    videoContainer.style.display = 'none';
    hideSelectors(); // Hide selectors during search

    if (!query) {
        imageContainer.style.display = 'flex'; // Show gallery if no query
        showToggle(); // Show toggle when displaying gallery
        return;
    }

    const apiKey = 'ea118e768e75a1fe3b53dc99c9e4de09'; // Replace with your TMDb API key
    const selectedFilter = dropdownMenu.querySelector('.dropdown-item.active')?.getAttribute('data-value') || 'all';

    // Show loading spinner
    loadingSpinner.style.display = 'block';

    // Define URLs based on the selected filter
    let movieUrl, seriesUrl, animeUrl, dramaUrl, showsUrl;
    if (selectedFilter === 'all') {
        movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${currentPage}`;
        seriesUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${currentPage}`;
        animeUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&with_genres=16&with_original_language=ja&page=${currentPage}`;
        dramaUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&with_genres=18&with_original_language=ko|zh&page=${currentPage}`;
        showsUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&with_genres=10764&with_original_language=en&page=${currentPage}`;
    } else if (selectedFilter === 'movie') {
        movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${currentPage}`;
    } else if (selectedFilter === 'tv') {
        seriesUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${currentPage}`;
    }

    try {
        console.log('Fetching search results...');
        // Fetch results based on the selected filter
        const [movieResponse, seriesResponse, animeResponse, dramaResponse, showsResponse] = await Promise.all([
            movieUrl ? fetch(movieUrl) : Promise.resolve(null),
            seriesUrl ? fetch(seriesUrl) : Promise.resolve(null),
            animeUrl ? fetch(animeUrl) : Promise.resolve(null),
            dramaUrl ? fetch(dramaUrl) : Promise.resolve(null),
            showsUrl ? fetch(showsUrl) : Promise.resolve(null),
        ]);

        // Process responses
        const movieData = movieResponse ? await movieResponse.json() : { results: [] };
        const seriesData = seriesResponse ? await seriesResponse.json() : { results: [] };
        const animeData = animeResponse ? await animeResponse.json() : { results: [] };
        const dramaData = dramaResponse ? await dramaResponse.json() : { results: [] };
        const showsData = showsResponse ? await showsResponse.json() : { results: [] };

        console.log('Movie Data:', movieData);
        console.log('Series Data:', seriesData);
        console.log('Anime Data:', animeData);
        console.log('Drama Data:', dramaData);
        console.log('Shows Data:', showsData);

        // Combine results from movies, series, anime, drama, and shows
        const combinedResults = [
            ...movieData.results.map(result => ({ ...result, mediaType: 'movie' })),
            ...seriesData.results.map(result => ({ ...result, mediaType: 'tv' })),
            ...animeData.results.map(result => ({ ...result, mediaType: 'anime' })),
            ...dramaData.results.map(result => ({ ...result, mediaType: 'drama' })),
            ...showsData.results.map(result => ({ ...result, mediaType: 'shows' })),
        ];

        // Use a Set to track unique media IDs
        const uniqueResults = [];
        const seenIds = new Set();

        combinedResults.forEach(result => {
            if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                uniqueResults.push(result);
            }
        });

        // Filter out results without titles, names, posters, or valid years
        const filteredResults = uniqueResults.filter(result => {
            const hasTitle = result.title || result.name;
            const hasPoster = result.poster_path;
            const year = new Date(result.release_date || result.first_air_date).getFullYear();
            return hasTitle && hasPoster && !isNaN(year);
        });

        if (filteredResults.length === 0) {
            resultsContainer.innerHTML = '';
            imageContainer.style.display = 'none'; // Hide gallery on search
            noResultsMessage.style.display = 'block'; // Show "No results" message
            return;
        }

        imageContainer.style.display = 'none'; // Hide gallery when searching

        // Calculate total pages
        totalPages = Math.ceil(filteredResults.length / resultsPerPage);

        // Ensure the current page is within valid bounds
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        // Get the results for the current page
        const startIndex = (currentPage - 1) * resultsPerPage;
        const endIndex = startIndex + resultsPerPage;
        let paginatedResults = filteredResults.slice(startIndex, endIndex);

        // If the current page has fewer than 12 results, fetch additional results from the next page
        if (paginatedResults.length < resultsPerPage && currentPage < totalPages) {
            const nextPage = currentPage + 1;
            const nextPageUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${nextPage}`;
            const nextPageResponse = await fetch(nextPageUrl);
            const nextPageData = await nextPageResponse.json();

            // Combine the current page results with additional results from the next page
            const additionalResults = nextPageData.results
                .filter(result => {
                    const hasTitle = result.title || result.name;
                    const hasPoster = result.poster_path;
                    const year = new Date(result.release_date || result.first_air_date).getFullYear();
                    return hasTitle && hasPoster && !isNaN(year);
                })
                .slice(0, resultsPerPage - paginatedResults.length);

            paginatedResults = [...paginatedResults, ...additionalResults];
        }

        // Display the paginated results
        paginatedResults.forEach(result => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.tabIndex = 0; // Make the item focusable
            const imageUrl = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null;
            if (imageUrl) {
                item.innerHTML = `
                    <img src="${imageUrl}" alt="${result.title || result.name}" />
                    <p>${result.title || result.name}</p>
                    <p class="release-date">(${new Date(result.release_date || result.first_air_date).getFullYear()})</p>
                `;
                item.onclick = () => {
                    clearSearchText(); // Clear the search bar text
                    if (result.mediaType === 'movie') {
                        handleSeriesClick(result.id, 'movie');
                    } else if (result.mediaType === 'tv' || result.mediaType === 'anime' || result.mediaType === 'drama' || result.mediaType === 'shows') {
                        handleSeriesClick(result.id, result.mediaType);
                    }
                    resultsContainer.innerHTML = ''; // Clear search results
                    videoContainer.scrollIntoView({ behavior: 'smooth' });
                };
                item.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        clearSearchText(); // Clear the search bar text
                        if (result.mediaType === 'movie') {
                            handleSeriesClick(result.id, 'movie');
                        } else if (result.mediaType === 'tv' || result.mediaType === 'anime' || result.mediaType === 'drama' || result.mediaType === 'shows') {
                            handleSeriesClick(result.id, result.mediaType);
                        }
                        resultsContainer.innerHTML = ''; // Clear search results
                        videoContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                });
                resultsContainer.appendChild(item);
            }
        });

        // Update pagination
        updatePagination();

        // Show pagination buttons
        paginationContainer.style.display = 'flex';
    } catch (error) {
        console.error('Error fetching data:', error);
        resultsContainer.innerHTML = '';
    } finally {
        loadingSpinner.style.display = 'none'; // Hide loading spinner
    }
}

// Function to update pagination buttons
function updatePagination() {
    paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none'; // Show pagination only if there are multiple pages
    pageInfo.textContent = `Page ${currentPage}`;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages;
}

// Function to embed video
function embedVideo(mediaId, mediaType, seasonNumber = null, episodeNumber = null) {
    hideToggle(); // Hide toggle when video is embedded
    const selectedServer = serverSelect.value; // Get the selected server URL
    let embedUrl;

    if (mediaType === 'movie') {
        switch (selectedServer) {
            case 'https://www.2embed.stream':
                embedUrl = `${selectedServer}/embed/movie/${mediaId}`;
                break;
            case 'https://www.2embed.cc':
                embedUrl = `${selectedServer}/embed/${mediaId}`;
                break;
            case 'https://vidsrc.cc/v2':
            case 'https://vidsrc.cc/v3':
                embedUrl = `${selectedServer}/embed/movie/${mediaId}`;
                break;
            case 'https://vidlink.pro':
                embedUrl = `${selectedServer}/movie/${mediaId}`;
                break;
            case 'https://embed.su':
                embedUrl = `${selectedServer}/embed/movie/${mediaId}`;
                break;
            case 'https://player.smashy.stream':
                embedUrl = `${selectedServer}/movie/${mediaId}`;
                break;
            default:
                embedUrl = `${selectedServer}/embed/${mediaType}/${mediaId}`;
                break;
        }
    } else if (mediaType === 'tv' && seasonNumber && episodeNumber) {
        switch (selectedServer) {
            case 'https://www.2embed.stream':
                embedUrl = `${selectedServer}/embed/tv/${mediaId}/${seasonNumber}/${episodeNumber}`;
                break;
            case 'https://www.2embed.cc':
                embedUrl = `${selectedServer}/embedtv/${mediaId}&s=${seasonNumber}&e=${episodeNumber}`;
                break;
            case 'https://vidsrc.cc/v2':
            case 'https://vidsrc.cc/v3':
                embedUrl = `${selectedServer}/embed/tv/${mediaId}/${seasonNumber}/${episodeNumber}`;
                break;
            case 'https://vidlink.pro':
                embedUrl = `${selectedServer}/tv/${mediaId}/${seasonNumber}/${episodeNumber}`;
                break;
            case 'https://embed.su':
                embedUrl = `${selectedServer}/embed/tv/${mediaId}/${seasonNumber}/${episodeNumber}`;
                break;
            case 'https://player.smashy.stream':
                embedUrl = `${selectedServer}/tv/${mediaId}?s=${seasonNumber}&e=${episodeNumber}`;
                break;
            default:
                embedUrl = `${selectedServer}/embed/${mediaType}/${mediaId}/${seasonNumber}/${episodeNumber}`;
                break;
        }
    } else {
        videoFrame.src = ''; // Clear the iframe source
        videoContainer.style.display = 'block'; // Show the video container (blank black screen)
        return;
    }

    videoFrame.src = embedUrl;
    videoContainer.style.display = 'block'; // Show the video frame
    resultsContainer.innerHTML = ''; // Clear search results when a video is embedded
}

async function fetchSeasons(mediaId) {
    const apiKey = 'ea118e768e75a1fe3b53dc99c9e4de09'; // Replace with your TMDb API key
    const url = `https://api.themoviedb.org/3/tv/${mediaId}?api_key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const seasons = data.seasons || [];

        // Populate season selector, omitting Season 0
        seasonSelect.innerHTML = '<option value="">Select Season</option>';
        seasons.forEach(season => {
            if (season.season_number > 0) { // Ignore Season 0
                const option = document.createElement('option');
                option.value = season.season_number;
                option.textContent = `Season ${season.season_number}`;
                seasonSelect.appendChild(option);
            }
        });

        // Show the selector container
        showSelectors(); // Show selectors
    } catch (error) {
        console.error('Error fetching seasons:', error);
    }
}

async function fetchEpisodes(mediaId, seasonNumber) {
    const apiKey = 'ea118e768e75a1fe3b53dc99c9e4de09'; // Replace with your TMDb API key
    const url = `https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNumber}?api_key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const episodes = data.episodes || [];

        // Populate episode selector, simplifying episode names
        episodeSelect.innerHTML = '<option value="">Select Episode</option>';
        episodes.forEach(episode => {
            const option = document.createElement('option');
            option.value = episode.episode_number;
            option.textContent = `Episode ${episode.episode_number}`; // Simplified to just "Episode X"
            episodeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching episodes:', error);
    }
}

// Initial fetch for trending movies
fetchTrending('movie');
