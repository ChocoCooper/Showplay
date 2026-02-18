const TMDB_CONFIG = {
    KEY: 'ea118e768e75a1fe3b53dc99c9e4de09',
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG: 'https://image.tmdb.org/t/p/w500',
    BACKDROP: 'https://image.tmdb.org/t/p/original'
};

const ShowPlay = {
    state: {
        watchlist: JSON.parse(localStorage.getItem('sp_watchlist')) || [],
        history: JSON.parse(localStorage.getItem('sp_history')) || [],
        activeMedia: null
    },

    init() {
        this.loadDiscovery();
        this.bindEvents();
        this.renderLibrary();
    },

    bindEvents() {
        // Navigation
        $('.nav-item[data-section]').on('click', (e) => {
            const section = $(e.currentTarget).data('section');
            this.navigate(section);
        });

        // Search
        $('#main-search').on('input', this.debounce((e) => {
            this.search(e.target.value);
        }, 500));

        // Close Player
        $('#close-player').on('click', () => {
            $('#player-layer').fadeOut();
            $('#main-iframe').attr('src', '');
        });

        // Watchlist Toggle
        $('#toggle-watchlist').on('click', () => this.toggleWatchlist());
    },

    async fetchTMDB(endpoint) {
        const res = await fetch(`${TMDB_CONFIG.BASE_URL}/${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_CONFIG.KEY}`);
        return await res.json();
    },

    async loadDiscovery() {
        // Hero Slider
        const trending = await this.fetchTMDB('trending/all/day');
        const hero = trending.results[0];
        $('#hero-container').html(`
            <div class="hero-slide" style="background-image: url(${TMDB_CONFIG.BACKDROP}${hero.backdrop_path})">
                <div class="hero-info">
                    <h1>${hero.title || hero.name}</h1>
                    <p>${hero.overview.slice(0, 180)}...</p>
                    <button class="nav-item active" onclick="ShowPlay.openPlayer(${hero.id}, '${hero.media_type}')">
                        <i class="fas fa-play"></i> Watch Now
                    </button>
                </div>
            </div>
        `);

        // Rows
        this.renderRow('trending/movie/week', '#trending-movies', 'movie');
        this.renderRow('trending/tv/week', '#popular-shows', 'tv');
        this.renderRow('discover/tv?with_genres=16', '#anime-shows', 'tv');
    },

    async renderRow(endpoint, containerId, type) {
        const data = await this.fetchTMDB(endpoint);
        const container = $(containerId);
        data.results.forEach(item => {
            const card = this.createCard(item, type);
            container.append(card);
        });
    },

    createCard(item, type) {
        const card = $(`
            <div class="media-card" tabindex="0">
                <img src="${TMDB_CONFIG.IMG}${item.poster_path}" loading="lazy">
            </div>
        `);
        card.on('click', () => this.openPlayer(item.id, type));
        return card;
    },

    async openPlayer(id, type) {
        const details = await this.fetchTMDB(`${type}/${id}`);
        this.state.activeMedia = { ...details, media_type: type };
        
        $('#now-playing-title').text(details.title || details.name);
        $('#player-desc').text(details.overview);
        $('#player-layer').fadeIn();
        
        if (type === 'tv') {
            this.loadEpisodes(id, 1);
            $('#tv-controls').show();
        } else {
            $('#tv-controls').hide();
            this.updateIframe(id, type);
        }

        // Save History
        this.addToHistory(details, type);
        this.updateWatchlistBtn();
    },

    async loadEpisodes(id, seasonNum) {
        const data = await this.fetchTMDB(`tv/${id}/season/${seasonNum}`);
        const container = $('#episode-list').empty();
        data.episodes.forEach(ep => {
            const btn = $(`<button class="ep-btn">Ep ${ep.episode_number}</button>`);
            btn.on('click', () => {
                $('.ep-btn').removeClass('active');
                btn.addClass('active');
                this.updateIframe(id, 'tv', seasonNum, ep.episode_number);
            });
            container.append(btn);
        });
        // Auto play first ep
        container.find('button:first').click();
    },

    updateIframe(id, type, s=1, e=1) {
        const baseUrl = $('#server-select').val();
        const src = type === 'movie' ? `${baseUrl}movie/${id}` : `${baseUrl}tv/${id}/${s}/${e}`;
        $('#main-iframe').attr('src', src);
    },

    navigate(view) {
        $('.main-view > div').hide();
        $('.nav-item').removeClass('active');
        $(`.nav-item[data-section="${view}"]`).addClass('active');
        $(`#${view}-view`).show();
        if(view === 'library') this.renderLibrary();
    },

    async search(query) {
        if(!query) return;
        const data = await this.fetchTMDB(`search/multi?query=${encodeURIComponent(query)}`);
        const container = $('#search-results').empty();
        data.results.forEach(item => {
            if(item.poster_path) container.append(this.createCard(item, item.media_type));
        });
    },

    addToHistory(item, type) {
        this.state.history = this.state.history.filter(i => i.id !== item.id);
        this.state.history.unshift({ ...item, media_type: type });
        localStorage.setItem('sp_history', JSON.stringify(this.state.history.slice(0, 20)));
    },

    toggleWatchlist() {
        const item = this.state.activeMedia;
        const index = this.state.watchlist.findIndex(i => i.id === item.id);
        if(index > -1) this.state.watchlist.splice(index, 1);
        else this.state.watchlist.push(item);
        
        localStorage.setItem('sp_watchlist', JSON.stringify(this.state.watchlist));
        this.updateWatchlistBtn();
    },

    updateWatchlistBtn() {
        const isIn = this.state.watchlist.some(i => i.id === this.state.activeMedia.id);
        $('#toggle-watchlist').html(isIn ? '<i class="fas fa-check"></i> Added' : '<i class="fas fa-plus"></i> Watchlist');
    },

    renderLibrary() {
        const wGrid = $('#watchlist-grid').empty();
        this.state.watchlist.forEach(item => wGrid.append(this.createCard(item, item.media_type)));
        
        const hGrid = $('#history-grid').empty();
        this.state.history.forEach(item => hGrid.append(this.createCard(item, item.media_type)));
    },

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
};

$(document).ready(() => ShowPlay.init());
