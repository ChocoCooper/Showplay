$(document).ready(function() {

    // ── Custom Player Styles ──────────────────────────────────────────────────
    if (!document.getElementById('sp-player-style')) {
        var s = document.createElement('style');
        s.id = 'sp-player-style';
        s.textContent = '\
.sp-player-wrap{position:relative;width:100%;background:#000;border-radius:10px;overflow:hidden;user-select:none;aspect-ratio:16/9;min-height:200px}\
.sp-player-wrap video{width:100%;display:block;background:#000}\
.sp-overlay-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.75);z-index:20;gap:12px;color:#fff;font-size:14px}\
.sp-spinner{width:44px;height:44px;border:4px solid rgba(255,255,255,.15);border-top-color:#2af598;border-radius:50%;animation:sp-spin .8s linear infinite}\
@keyframes sp-spin{to{transform:rotate(360deg)}}\
.sp-overlay-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.85);z-index:20;color:#ff6b6b;font-size:14px;gap:10px;padding:20px;text-align:center}\
.sp-overlay-error i{font-size:32px}\
.sp-big-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:10;cursor:pointer;opacity:0;transition:opacity .2s}\
.sp-player-wrap:hover .sp-big-play,.sp-big-play.always{opacity:1}\
.sp-big-play-btn{width:64px;height:64px;background:rgba(0,0,0,.55);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.7);transition:transform .15s,background .15s}\
.sp-big-play-btn:hover{transform:scale(1.1);background:rgba(42,245,152,.25);border-color:#2af598}\
.sp-big-play-btn i{color:#fff;font-size:24px;margin-left:3px}\
.sp-controls{position:absolute;bottom:0;left:0;right:0;z-index:15;padding:6px 12px 10px;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,transparent 100%);opacity:0;transition:opacity .3s}\
.sp-player-wrap:hover .sp-controls,.sp-controls.pinned{opacity:1}\
.sp-progress{position:relative;height:4px;background:rgba(255,255,255,.2);border-radius:2px;cursor:pointer;margin-bottom:8px;transition:height .15s}\
.sp-player-wrap:hover .sp-progress{height:6px}\
.sp-progress-fill{height:100%;background:#2af598;border-radius:2px;pointer-events:none;transition:width .1s linear}\
.sp-progress-buf{position:absolute;top:0;left:0;height:100%;background:rgba(255,255,255,.15);border-radius:2px;pointer-events:none}\
.sp-progress-thumb{position:absolute;top:50%;width:14px;height:14px;background:#2af598;border-radius:50%;transform:translate(-50%,-50%) scale(0);transition:transform .15s;pointer-events:none;box-shadow:0 0 8px rgba(42,245,152,.8)}\
.sp-player-wrap:hover .sp-progress-thumb{transform:translate(-50%,-50%) scale(1)}\
.sp-bottom{display:flex;align-items:center;gap:6px}\
.sp-btn{background:none;border:none;color:#fff;cursor:pointer;padding:4px 5px;font-size:16px;opacity:.85;transition:opacity .15s,color .15s;flex-shrink:0}\
.sp-btn:hover{opacity:1;color:#2af598}\
.sp-time{color:rgba(255,255,255,.75);font-size:12px;white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums}\
.sp-spacer{flex:1}\
.sp-volume-wrap{display:flex;align-items:center;gap:4px}\
.sp-volume-slider{width:60px;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.3);border-radius:2px;outline:none;cursor:pointer}\
.sp-volume-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#2af598;border-radius:50%;cursor:pointer}\
.sp-quality-wrap{position:relative}\
.sp-quality-btn{font-size:11px;font-weight:700;padding:3px 7px;border:1px solid rgba(255,255,255,.35);border-radius:4px;letter-spacing:.3px;color:#fff;background:rgba(0,0,0,.4)}\
.sp-quality-btn.active{color:#2af598;border-color:#2af598;background:rgba(42,245,152,.1)}\
.sp-quality-menu{position:absolute;bottom:calc(100% + 8px);right:0;background:#181818;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;min-width:110px;z-index:50;display:none;box-shadow:0 8px 30px rgba(0,0,0,.9)}\
.sp-quality-menu.open{display:block}\
.sp-quality-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:#ccc;padding:9px 16px;font-size:13px;cursor:pointer;transition:background .15s,color .15s}\
.sp-quality-menu button:hover{background:rgba(42,245,152,.1);color:#2af598}\
.sp-quality-menu button.selected{color:#2af598;font-weight:700;background:rgba(42,245,152,.05)}\
.sp-quality-menu button.selected::before{content:"\\2713  "}\
';
        document.head.appendChild(s);
    }

    // ── DOM Selectors ─────────────────────────────────────────────────────────
    const selectors = {
        videoPage: $('#videoPage'), videoFrame: $('#videoFrame'),
        videoMediaTitle: $('#videoMediaTitle'), watchlistBtn: $('#watchlistBtn'),
        downloadBtn: $('#downloadBtn'), backBtn: $('.back-btn'),
        selectorContainer: $('#selectorContainer'),
        seasonEpisodeSelector: $('#seasonEpisodeSelector'),
        seasonEpisodeAccordion: $('#seasonEpisodeAccordion'),
        serverGrid: $('#serverGrid'), mediaDetails: $('#mediaDetails'),
        mediaPoster: $('#mediaPoster'), mediaDetailsPoster: $('.media-details-poster'),
        mediaRatingBadge: $('#mediaRatingBadge'), mediaDetailsTitle: $('#mediaDetailsTitle'),
        mediaYearGenre: $('#mediaYearGenre'), mediaPlot: $('#mediaPlot'),
        homepage: $('#homepage'), previewSection: $('#previewSection'),
        previewItemsContainer: $('#previewItemsContainer'),
        moviesSlider: $('#moviesSliderContainer'), tvSlider: $('#tvSliderContainer'),
        animeSlider: $('#animeSliderContainer'), kdramaSlider: $('#kdramaSliderContainer'),
        cdramaSlider: $('#cdramaSliderContainer'), librarySection: $('#librarySection'),
        watchlistSlider: $('#watchlistSlider'), historySlider: $('#historySlider'),
        searchSection: $('#searchSection'), searchInput: $('#searchInput'),
        searchFilter: $('#searchFilter'), searchResults: $('#searchResults'),
        searchTrending: $('#searchTrending'), toast: $('#toastNotification'),
        sidebarNavItems: $('.sidebar-nav li')
    };

    const state = {
        mediaType: 'movie', mediaId: null, season: null, episode: null,
        previewIndex: parseInt(localStorage.getItem('previewIndex')) || 0,
        previewInterval: null,
        watchlist: JSON.parse(localStorage.getItem('watchlist')) || [],
        history: JSON.parse(localStorage.getItem('history')) || [],
        previousSection: 'home',
        lastBreakpoint: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
        renderedSections: { preview:false, movies:false, tv:false, anime:false, kdrama:false, cdrama:false, search:false, library:false }
    };

    const config = {
        apiKey: 'ea118e768e75a1fe3b53dc99c9e4de09',
        servers: [{ name: 'Hexa', resolver: 'hexa' }]
    };

    // ── Proxy ─────────────────────────────────────────────────────────────────
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const NETLIFY_PROXY = '/.netlify/functions/proxy';

    const pFetch = async function(url, opts, responseType) {
        opts = opts || {}; responseType = responseType || 'json';
        var payload = { url: url, method: opts.method || 'GET', headers: opts.headers || {} };
        if (opts.body !== undefined) payload.body = opts.body;
        for (var i = 0; i < 2; i++) {
            var proxyUrl = i === 0 ? NETLIFY_PROXY : '/api/proxy';
            try {
                var r = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (r.status === 404) continue;
                if (r.ok) {
                    var env = await r.json();
                    console.log('[pFetch] OK ' + proxyUrl + ' -> ' + env.status + ' ' + url);
                    if (responseType === 'text') return env.text;
                    if (env.json !== null && env.json !== undefined) return env.json;
                    try { return JSON.parse(env.text); } catch(e) { return env.text; }
                }
            } catch(e) { console.warn('[pFetch] ' + proxyUrl + ': ' + e.message); }
        }
        for (var p of [['corsproxy.io','https://corsproxy.io/?url='],['allorigins','https://api.allorigins.win/raw?url=']]) {
            try {
                var r = await fetch(p[1] + encodeURIComponent(url));
                if (r.ok) return responseType === 'text' ? r.text() : r.json();
            } catch(e) {}
        }
        throw new Error('pFetch: all proxies failed for ' + url);
    };

    // ── Hexa Resolver ─────────────────────────────────────────────────────────
    async function resolveHexa(p) {
        var arr = new Uint8Array(32); crypto.getRandomValues(arr);
        var key = Array.from(arr, function(b){ return b.toString(16).padStart(2,'0'); }).join('');
        var apiUrl = p.mediaType === 'tv'
            ? 'https://themoviedb.hexa.su/api/tmdb/tv/' + p.tmdbId + '/season/' + p.season + '/episode/' + p.episode + '/images'
            : 'https://themoviedb.hexa.su/api/tmdb/movie/' + p.tmdbId + '/images';
        var encrypted = await pFetch(apiUrl, { headers: { 'X-Api-Key': key } }, 'text');
        var dec = await pFetch('https://enc-dec.app/api/dec-hexa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encrypted, key: key })
        });
        var d = typeof dec === 'string' ? JSON.parse(dec) : dec;
        var sources = (d && (d.result && d.result.sources || d.sources || (d.data && d.data.sources))) || [];
        var url = sources[0] && (sources[0].url || sources[0].file);
        if (!url) throw new Error('Hexa: no stream URL. Got: ' + JSON.stringify(d).slice(0,200));
        return { url: url, type: 'hls', headers: { Referer: 'https://hexa.watch/', Origin: 'https://hexa.watch' } };
    }

    const resolveStream = async function(name, params) {
        if (name === 'hexa') return resolveHexa(params);
        throw new Error('Unknown resolver: ' + name);
    };

    // ── Utilities ─────────────────────────────────────────────────────────────
    const fetchWithRetry = async function(url, retries, delay) {
        retries = retries || 3; delay = delay || 500;
        for (var i = 0; i < retries; i++) {
            try { var res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status); return await res.json(); }
            catch(e) { if (i === retries - 1) throw e; await new Promise(function(r){ setTimeout(r, delay * Math.pow(2, i)); }); }
        }
    };

    const getImageUrl = function(path, type) {
        type = type || 'poster'; if (!path) return null;
        var mobile = window.matchMedia('(max-width: 767px)').matches;
        var size = type === 'backdrop' ? (mobile ? 'w1280' : 'original') : (mobile ? 'w185' : 'w500');
        return 'https://image.tmdb.org/t/p/' + size + (path.startsWith('/') ? path : '/' + path);
    };

    const loadImage = function(src, retries, delay) {
        retries = retries || 3; delay = delay || 500;
        return new Promise(function(resolve, reject) {
            var attempt = 0, img = new Image(); img.src = src;
            if (img.complete) { resolve(img); return; }
            var tryLoad = function() {
                img.onload = function(){ resolve(img); };
                img.onerror = function() { if (attempt < retries-1) { attempt++; setTimeout(tryLoad, delay * Math.pow(2,attempt)); } else reject(new Error('Failed: '+src)); };
                img.src = src;
            };
            tryLoad();
        });
    };

    const mediaCache = {
        get: function(id,type){ var c=localStorage.getItem('mediaDetails_'+type+'_'+id); if(!c) return null; var e=JSON.parse(c); if(e.expires<Date.now()){localStorage.removeItem('mediaDetails_'+type+'_'+id);return null;} return e.data; },
        set: function(id,type,data){ localStorage.setItem('mediaDetails_'+type+'_'+id, JSON.stringify({data:data,timestamp:Date.now(),expires:Date.now()+86400000})); },
        clear: function(id,type){ localStorage.removeItem('mediaDetails_'+type+'_'+id); }
    };

    const observeElement = function(element, callback) {
        var obs = new IntersectionObserver(function(entries, obs){ entries.forEach(function(e){ if(e.isIntersecting){callback();obs.unobserve(e.target);} }); }, {root:null,rootMargin:'100px',threshold:0.1});
        obs.observe(element[0]);
    };

    const initializeServers = function() { selectors.serverGrid.empty().hide(); };


    // ── Custom Player Builder ─────────────────────────────────────────────────
    function buildPlayer(wrapper, videoEl, hlsInstance, levels) {
        var vid = videoEl[0];
        var hls = hlsInstance;
        var currentQuality = -1;

        function fmtTime(s) {
            if (isNaN(s) || s < 0) return '0:00';
            var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
            if (h > 0) return h+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
            return m+':'+String(sec).padStart(2,'0');
        }

        // Wrap video in player shell
        var wrap = $('<div class="sp-player-wrap"></div>');
        videoEl.css({width:'100%',display:'block'});
        wrap.append(videoEl);

        // Big play/pause centre overlay
        var bigPlay = $('<div class="sp-big-play always"><div class="sp-big-play-btn"><i class="fa-solid fa-play"></i></div></div>');
        wrap.append(bigPlay);

        // Controls
        var ctrl = $('<div class="sp-controls"></div>');
        var progRow = $('<div class="sp-progress"><div class="sp-progress-buf"></div><div class="sp-progress-fill" style="width:0%"></div><div class="sp-progress-thumb" style="left:0%"></div></div>');
        ctrl.append(progRow);

        var bottom = $('<div class="sp-bottom"></div>');
        var btnPlay   = $('<button class="sp-btn sp-play-btn" title="Play/Pause (Space)"><i class="fa-solid fa-play"></i></button>');
        var timeEl    = $('<span class="sp-time">0:00 / 0:00</span>');
        var spacer    = $('<span class="sp-spacer"></span>');
        var volWrap   = $('<div class="sp-volume-wrap"></div>');
        var btnVol    = $('<button class="sp-btn sp-vol-btn" title="Mute (M)"><i class="fa-solid fa-volume-high"></i></button>');
        var volSlider = $('<input type="range" class="sp-volume-slider" min="0" max="1" step="0.05" value="1" title="Volume">');
        volWrap.append(btnVol, volSlider);
        var qualWrap  = $('<div class="sp-quality-wrap"></div>');
        var qualBtn   = $('<button class="sp-btn sp-quality-btn active" title="Quality">AUTO</button>');
        var qualMenu  = $('<div class="sp-quality-menu"></div>');
        qualWrap.append(qualBtn, qualMenu);
        var btnFS     = $('<button class="sp-btn sp-fs-btn" title="Fullscreen (F)"><i class="fa-solid fa-expand"></i></button>');

        bottom.append(btnPlay, timeEl, spacer, volWrap);
        if (levels && levels.length > 1) bottom.append(qualWrap);
        bottom.append(btnFS);
        ctrl.append(bottom);
        wrap.append(ctrl);

        // ── Quality menu ──────────────────────────────────────────────────────
        if (levels && levels.length > 1) {
            var autoBtn = $('<button class="selected">Auto</button>');
            autoBtn.on('click', function() {
                currentQuality = -1;
                hls.loadLevel = -1;  // re-enable ABR
                qualBtn.text('AUTO').addClass('active');
                qualMenu.find('button').removeClass('selected');
                autoBtn.addClass('selected');
                qualMenu.removeClass('open');
                console.log('[Quality] Auto (ABR)');
            });
            qualMenu.append(autoBtn);

            var sortedLevels = levels.map(function(lv, i){ return { idx:i, h:lv.height||0, bw:lv.bitrate||0 }; })
                .sort(function(a,b){ return b.h - a.h; });

            sortedLevels.forEach(function(lv) {
                var label = lv.h ? lv.h+'p' : Math.round(lv.bw/1000)+'kbps';
                var qBtn = $('<button>'+label+'</button>');
                qBtn.on('click', function() {
                    currentQuality = lv.idx;

                    // HLS.js quality switch:
                    // loadLevel pins a specific level and disables ABR.
                    // nextLevel switches at the next segment boundary (no buffer flush = seamless).
                    hls.loadLevel = lv.idx;  // pin this level, disable ABR
                    hls.nextLevel = lv.idx;  // switch at next segment (no seek/flush needed)

                    qualBtn.text(label).addClass('active');
                    qualMenu.find('button').removeClass('selected');
                    qBtn.addClass('selected');
                    qualMenu.removeClass('open');
                    console.log('[Quality] -> level', lv.idx, label);
                });
                qualMenu.append(qBtn);
            });

            // Update display when HLS switches level (auto mode)
            if (hls) {
                hls.on(Hls.Events.LEVEL_SWITCHED, function(ev, data) {
                    var lv = levels[data.level];
                    var label = lv && lv.height ? lv.height+'p' : '';
                    if (currentQuality === -1 && label) qualBtn.text('AUTO '+label);
                    // Sync menu selection
                    qualMenu.find('button').removeClass('selected');
                    if (currentQuality === -1) qualMenu.find('button').first().addClass('selected');
                    else qualMenu.find('button').eq(
                        sortedLevels.findIndex(function(s){ return s.idx === currentQuality; }) + 1
                    ).addClass('selected');
                });
            }
        }

        // Place in DOM — do NOT remove video since it's already inside wrap
        wrapper.find('.sp-player-wrap, .sp-overlay-loading, .sp-overlay-error').remove();
        wrapper.css('position','relative').append(wrap);
        // Show controls immediately, then auto-hide after 3s
        ctrl.addClass('pinned');
        setTimeout(function(){ if(!isSeeking) ctrl.removeClass('pinned'); }, 3000);

        // ── Playback controls ─────────────────────────────────────────────────
        function togglePlay() { if (vid.paused) vid.play().catch(function(){}); else vid.pause(); }

        bigPlay.on('click', function(e){ e.stopPropagation(); togglePlay(); });
        btnPlay.on('click', function(e){ e.stopPropagation(); togglePlay(); });

        vid.addEventListener('play', function() {
            btnPlay.find('i').attr('class','fa-solid fa-pause');
            bigPlay.find('i').attr('class','fa-solid fa-pause');
            bigPlay.removeClass('always');
        });
        vid.addEventListener('pause', function() {
            btnPlay.find('i').attr('class','fa-solid fa-play');
            bigPlay.find('i').attr('class','fa-solid fa-play');
            bigPlay.addClass('always');
        });
        vid.addEventListener('ended', function() {
            bigPlay.addClass('always');
            btnPlay.find('i').attr('class','fa-solid fa-rotate-right');
        });

        // ── Progress bar ──────────────────────────────────────────────────────
        var isSeeking = false;
        function setProgress(pct) {
            progRow.find('.sp-progress-fill').css('width', pct+'%');
            progRow.find('.sp-progress-thumb').css('left', pct+'%');
        }
        vid.addEventListener('timeupdate', function() {
            if (isSeeking || !vid.duration) return;
            setProgress((vid.currentTime/vid.duration)*100);
            timeEl.text(fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration));
        });
        vid.addEventListener('durationchange', function() {
            timeEl.text(fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration));
        });
        vid.addEventListener('progress', function() {
            if (!vid.duration) return;
            var buf = vid.buffered;
            if (buf.length) progRow.find('.sp-progress-buf').css('width',(buf.end(buf.length-1)/vid.duration*100)+'%');
        });

        function seekFromEvent(clientX) {
            var rect = progRow[0].getBoundingClientRect();
            var pct = Math.max(0, Math.min(1, (clientX-rect.left)/rect.width));
            if (vid.duration) { vid.currentTime = pct*vid.duration; setProgress(pct*100); }
        }
        progRow.on('mousedown', function(e){ isSeeking=true; ctrl.addClass('pinned'); seekFromEvent(e.clientX); e.preventDefault(); });
        progRow.on('touchstart', function(e){ isSeeking=true; ctrl.addClass('pinned'); seekFromEvent(e.originalEvent.touches[0].clientX); });
        $(document).on('mousemove.spprog', function(e){ if(isSeeking) seekFromEvent(e.clientX); });
        $(document).on('touchmove.spprog', function(e){ if(isSeeking) seekFromEvent(e.originalEvent.touches[0].clientX); });
        $(document).on('mouseup.spprog touchend.spprog', function(){ if(isSeeking){ isSeeking=false; ctrl.removeClass('pinned'); } });

        // ── Volume ────────────────────────────────────────────────────────────
        function updateVolIcon() {
            var ic = vid.muted||vid.volume===0 ? 'fa-volume-xmark' : vid.volume<0.4 ? 'fa-volume-low' : 'fa-volume-high';
            btnVol.find('i').attr('class','fa-solid '+ic);
        }
        volSlider.on('input', function(){ vid.volume=parseFloat(this.value); vid.muted=(vid.volume===0); updateVolIcon(); });
        btnVol.on('click', function(){ vid.muted=!vid.muted; volSlider.val(vid.muted?0:vid.volume); updateVolIcon(); });

        // ── Quality menu toggle ───────────────────────────────────────────────
        qualBtn.on('click', function(e){ e.stopPropagation(); qualMenu.toggleClass('open'); });
        $(document).on('click.spqual', function(){ qualMenu.removeClass('open'); });

        // ── Fullscreen ────────────────────────────────────────────────────────
        btnFS.on('click', function() {
            var el = wrap[0];
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                (el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen).call(el);
            } else {
                (document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen).call(document);
            }
        });
        function onFSChange() {
            var isFS = !!(document.fullscreenElement||document.webkitFullscreenElement);
            btnFS.find('i').attr('class', isFS ? 'fa-solid fa-compress' : 'fa-solid fa-expand');
            ctrl.addClass('pinned');
            clearTimeout(ctrl._fsPinTimer);
            ctrl._fsPinTimer = setTimeout(function(){ if(!isSeeking) ctrl.removeClass('pinned'); }, 3000);
        }
        document.addEventListener('fullscreenchange', onFSChange);
        document.addEventListener('webkitfullscreenchange', onFSChange);

        // ── Mobile double-tap seek ────────────────────────────────────────────
        var lastTap = 0;
        wrap.on('touchend', function(e) {
            var now = Date.now();
            if (now - lastTap < 280) {
                var x = e.originalEvent.changedTouches[0].clientX;
                var mid = wrap[0].getBoundingClientRect().width / 2;
                vid.currentTime = Math.max(0, Math.min(vid.duration||0, vid.currentTime + (x<mid?-10:10)));
                e.preventDefault();
            }
            lastTap = now;
        });

        // ── Keyboard shortcuts ────────────────────────────────────────────────
        $(document).off('keydown.sp').on('keydown.sp', function(e) {
            if ($(e.target).is('input,textarea,select,details')) return;
            if (e.key===' '||e.key==='k'){ e.preventDefault(); togglePlay(); }
            if (e.key==='ArrowRight') vid.currentTime=Math.min(vid.duration||0,vid.currentTime+10);
            if (e.key==='ArrowLeft')  vid.currentTime=Math.max(0,vid.currentTime-10);
            if (e.key==='ArrowUp')   { vid.volume=Math.min(1,vid.volume+0.1); volSlider.val(vid.volume); updateVolIcon(); e.preventDefault(); }
            if (e.key==='ArrowDown') { vid.volume=Math.max(0,vid.volume-0.1); volSlider.val(vid.volume); updateVolIcon(); e.preventDefault(); }
            if (e.key==='f') btnFS.trigger('click');
            if (e.key==='m') btnVol.trigger('click');
        });

        return wrap;
    }

    // ── Embed Video ───────────────────────────────────────────────────────────
    const embedVideo = async function() {
        if (!state.mediaId) { console.error('[embedVideo] mediaId not set'); return; }
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) { console.error('[embedVideo] season/episode not set'); return; }

        var server = config.servers[0];
        var wrapper = selectors.videoFrame.parent();

        wrapper.find('.sp-player-wrap, .sp-overlay-loading, .sp-overlay-error').remove();
        wrapper.find('video').each(function(){ this.pause(); this.src=''; }).remove();
        selectors.videoFrame.hide();

        var loadingEl = $('<div class="sp-overlay-loading"><div class="sp-spinner"></div><p>Loading stream\u2026</p></div>');
        wrapper.css('position','relative').append(loadingEl);

        var params = {
            tmdbId: state.mediaId, mediaType: state.mediaType,
            title: selectors.videoPage.data('title') || '',
            year:  selectors.videoPage.data('year')  || '',
            season: state.season, episode: state.episode
        };

        try {
            var stream = await resolveStream(server.resolver, params);
            console.log('[embedVideo] stream:', stream.url);
            loadingEl.remove();

            var videoEl = $('<video class="hls-player" playsinline></video>');
            wrapper.append(videoEl);

            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                var streamHdrs = stream.headers || {};

                class ProxyLoader {
                    constructor(cfg) {
                        this.config = cfg; this._aborted = false;
                        var now = performance.now();
                        this.stats = {
                            aborted:false, loaded:0, retry:0, total:0, chunkCount:0, bwEstimate:0,
                            loading:  {start:now, first:0, end:0},
                            parsing:  {start:0, end:0},
                            buffering:{start:0, first:0, end:0}
                        };
                    }
                    destroy(){ this._aborted=true; }
                    abort()  { this._aborted=true; this.stats.aborted=true; }
                    load(context, cfg, callbacks) {
                        var origUrl = context.url, self = this;
                        self.stats.loading.start = performance.now();
                        fetch(NETLIFY_PROXY, {
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({url:origUrl, method:'GET', headers:streamHdrs})
                        })
                        .then(function(r){ if(!r.ok) throw new Error('Proxy HTTP '+r.status); return r.json(); })
                        .then(function(env) {
                            if(self._aborted) return;
                            var now = performance.now();
                            var urlNoQ = origUrl.split('?')[0].toLowerCase();
                            var isBinary = context.responseType==='arraybuffer'
                                || context.type==='key' || context.type==='initSegment'
                                || urlNoQ.endsWith('.ts') || urlNoQ.endsWith('.m4s')
                                || urlNoQ.endsWith('.mp4') || urlNoQ.endsWith('.m4a')
                                || urlNoQ.endsWith('.aac') || urlNoQ.endsWith('.mp3')
                                || urlNoQ.endsWith('.key');
                            var data;
                            if (isBinary && env.base64) {
                                try {
                                    var bin = atob(env.base64), bytes = new Uint8Array(bin.length);
                                    for (var i=0; i<bin.length; i++) bytes[i]=bin.charCodeAt(i);
                                    data = bytes.buffer;
                                } catch(e){ data=env.text||''; }
                            } else { data=env.text||''; }
                            var len=(data&&data.byteLength!==undefined)?data.byteLength:(data?data.length:0);
                            self.stats.loaded=len; self.stats.total=len;
                            self.stats.loading.first=now; self.stats.loading.end=now;
                            callbacks.onSuccess({data:data,url:origUrl}, self.stats, context, null);
                        })
                        .catch(function(err){
                            if(self._aborted) return;
                            console.error('[ProxyLoader]',err.message);
                            callbacks.onError({code:0,text:err.message}, context, null, {});
                        });
                    }
                }

                var hls = new Hls({
                    maxBufferLength: 30, maxMaxBufferLength: 120,
                    startLevel: -1, abrEwmaDefaultEstimate: 2000000,
                    loader: ProxyLoader
                });

                hls.on(Hls.Events.ERROR, function(ev, data) {
                    console.error('[HLS.js]', data.type, data.details, 'fatal:', data.fatal);
                    if (data.fatal) {
                        wrapper.find('.sp-player-wrap').remove();
                        wrapper.append($('<div class="sp-overlay-error"><i class="fas fa-exclamation-triangle"></i><p>' + data.details + '</p></div>'));
                    }
                });

                hls.loadSource(stream.url);
                hls.attachMedia(videoEl[0]);

                hls.on(Hls.Events.MANIFEST_PARSED, function(ev, data) {
                    console.log('[HLS.js] Manifest parsed, levels:', data.levels.length);
                    var playerWrap = buildPlayer(wrapper, videoEl, hls, data.levels);
                    videoEl[0].play().catch(function(e){
                        console.warn('[HLS] autoplay blocked:', e.message);
                        // Show play button and controls prominently
                        playerWrap.find('.sp-big-play').addClass('always');
                        playerWrap.find('.sp-controls').addClass('pinned');
                    });
                });

            } else if (videoEl[0].canPlayType('application/vnd.apple.mpegurl')) {
                videoEl[0].src = stream.url;
                var wrap2 = buildPlayer(wrapper, videoEl, null, []);
                videoEl[0].play().catch(function(){
                    wrap2.find('.sp-big-play').addClass('always');
                    wrap2.find('.sp-controls').addClass('pinned');
                });
            } else {
                videoEl[0].src = stream.url;
                var wrap3 = buildPlayer(wrapper, videoEl, null, []);
                videoEl[0].play().catch(function(){
                    wrap3.find('.sp-big-play').addClass('always');
                    wrap3.find('.sp-controls').addClass('pinned');
                });
            }
        } catch(err) {
            console.error('[embedVideo]', err.message);
            loadingEl.remove();
            wrapper.append($('<div class="sp-overlay-error"><i class="fas fa-exclamation-triangle"></i><p>' + err.message + '</p></div>'));
        }
    };

    // ── Media Fetching ────────────────────────────────────────────────────────
    const fetchMedia = async function(type, isPreview) {
        isPreview = isPreview || false;
        const map = {
            movie:    ['https://api.themoviedb.org/3/trending/movie/week?api_key=' + config.apiKey, 'movie'],
            tv:       ['https://api.themoviedb.org/3/trending/tv/week?api_key=' + config.apiKey, 'tv'],
            anime:    ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_genres=16&sort_by=first_air_date.desc&with_original_language=ja&vote_average.gte=6&vote_count.gte=25&without_keywords=10121,9706,264386,280003,158718,281741', 'tv'],
            kdrama:   ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_original_language=ko&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=25', 'tv'],
            cdrama:   ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_original_language=zh&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=10&without_genres=16,10759,10765,10768&without_keywords=15060,248451,289844,12995,195013,184656,234890', 'tv'],
            trending: ['https://api.themoviedb.org/3/trending/all/day?api_key=' + config.apiKey, 'multi'],
        };
        if (!map[type]) return [];
        const url = map[type][0], mediaType = map[type][1];
        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(url + '&page=' + page);
                if (!data || !data.results) { console.error('No results for', type); return items; }
                let valid = data.results.filter(function(i){ return i.id && (i.title || i.name) && i.poster_path && i.vote_average; })
                    .map(function(i){ return Object.assign({}, i, { type: isPreview ? i.media_type : mediaType }); });
                if (isPreview) {
                    valid = valid.filter(function(m){ return m.backdrop_path; });
                    valid = await Promise.all(valid.map(async function(m) {
                        const mt = m.media_type === 'movie' ? 'movie' : 'tv';
                        const details = await fetchWithRetry('https://api.themoviedb.org/3/' + mt + '/' + m.id + '?api_key=' + config.apiKey);
                        const logo = await fetchWithRetry('https://api.themoviedb.org/3/' + mt + '/' + m.id + '/images?api_key=' + config.apiKey + '&include_image_language=en,null');
                        const lp = logo.logos && (logo.logos.find(function(l){ return l.file_path && l.iso_639_1 === 'en'; }) || logo.logos[0]);
                        const logoUrl = lp && lp.file_path;
                        return logoUrl ? Object.assign({}, m, { logo_path: 'https://image.tmdb.org/t/p/original' + logoUrl, genres: details.genres }) : null;
                    }));
                    valid = valid.filter(Boolean);
                }
                items = items.concat(valid);
                page++;
            }
            return items.slice(0, desiredCount);
        } catch(e) { console.error('Failed to load', type, e); return []; }
    };

    // ── Render Item ───────────────────────────────────────────────────────────
    const renderItem = async function(item, container, renderType, isLibrary) {
        renderType = renderType || 'slider'; isLibrary = isLibrary || false;
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
        const rating = ((item.vote_average || item.rating || 0)).toFixed(1) || 'N/A';
        const imageUrl = getImageUrl(posterPath, 'poster');
        if (!imageUrl) return;

        if (renderType === 'preview') {
            const bdUrl = getImageUrl(item.backdrop_path, 'backdrop');
            if (!bdUrl) return;
            const mtype = item.media_type === 'movie' ? 'MOVIE' : 'TV';
            const genres = item.genres ? item.genres.slice(0,2).map(function(g){ return g.name.split(' ')[0]; }) : ['N/A'];
            const inWL = state.watchlist.some(function(w){ return w.id === item.id; });
            const el = $('<div class="preview-item" data-index="' + container.children().length + '">'
                + '<img class="preview-background loaded" src="' + bdUrl + '" alt="' + title + '">'
                + '<div class="preview-background-overlay"></div>'
                + '<div class="preview-overlay"></div>'
                + '<div class="preview-content">'
                + '<img class="preview-title" src="' + item.logo_path + '" alt="' + title + '">'
                + '<div class="preview-meta"><span class="media-type">' + mtype + ' \u2022 ' + genres.join(', ') + '</span><span class="rating"><i class="fas fa-star"></i>' + rating + '</span></div>'
                + '<p class="preview-description">' + (item.overview || 'No description available.') + '</p>'
                + '<div class="preview-buttons">'
                + '<button class="preview-btn play-btn"><i class="fa-solid fa-play"></i>  Watch</button>'
                + '<button class="preview-btn secondary add-btn"><i class="' + (inWL ? 'fa-solid fa-check' : 'fas fa-plus') + '"></i></button>'
                + '</div></div></div>');
            try { await loadImage(bdUrl); } catch(e) { el.remove(); return; }
            el.find('.play-btn').on('click', function(e) {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home', item.vote_average);
                if (item.media_type === 'movie') addToHistory({ id: item.id, type: 'movie', title: title, poster: posterPath, year: year, season: null, episode: null, rating: item.vote_average });
            });
            el.find('.add-btn').on('click', function() {
                toggleWatchlist({ id: item.id, type: item.media_type, title: title, poster: posterPath, rating: item.vote_average });
                const inWL2 = state.watchlist.some(function(w){ return w.id === item.id; });
                el.find('.add-btn i').attr('class', inWL2 ? 'fa-solid fa-check' : 'fas fa-plus');
            });
            container.append(el);
        } else {
            const seLabel = isLibrary && item.season && item.episode ? '<span class="absolute bottom-2 left-2 !bg-[#2af598] !text-black text-[10px] font-bold px-2 py-1 rounded-md z-20 shadow-lg">S' + item.season + ' E' + item.episode + '</span>' : '';
            const delBadge = isLibrary ? '<span class="delete-badge absolute top-2 left-2 !bg-[#2af598] hover:bg-green-400 !text-black w-7 h-7 flex items-center justify-center rounded-full z-30 transition-colors backdrop-blur-sm" aria-label="Delete"><i class="fas fa-trash text-xs"></i></span>' : '';
            const year2 = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
            const poster = $('<div class="poster-item group relative flex-shrink-0 w-[90px] md:w-[160px] h-[135px] md:h-[240px] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)] bg-[#1a1a1a]">'
                + '<span class="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 z-20"><i class="fas fa-star text-yellow-400"></i>' + rating + '</span>'
                + seLabel + delBadge
                + '<img class="poster-img w-full h-full object-cover transition-all duration-500 opacity-0 group-hover:brightness-75" src="' + imageUrl + '" alt="' + title + '" role="button" aria-label="Play ' + title + '">'
                + '<div class="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black via-black/50 to-transparent z-10">'
                + '<h4 class="text-white font-bold text-sm leading-tight line-clamp-2 mb-1 drop-shadow-md">' + title + '</h4>'
                + '<p class="text-primary text-xs font-medium">' + year2 + '</p>'
                + '<button class="mt-3 w-full bg-white/20 hover:bg-primary hover:text-black text-white text-xs font-bold py-2 rounded-lg backdrop-blur-sm transition-colors duration-200"><i class="fa-solid fa-play mr-1"></i> Play</button>'
                + '</div></div>');
            try { await loadImage(imageUrl); poster.find('.poster-img').removeClass('opacity-0'); } catch(e) { poster.remove(); return; }
            poster.on('click', function() {
                const yr = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                const sec = container.closest('.search-section').length ? 'search' : container.closest('.library-section').length ? 'library' : 'home';
                const mt = item.media_type || item.type || (container.closest('#animeSliderContainer, #kdramaSliderContainer, #cdramaSliderContainer').length ? 'tv' : 'movie');
                navigateToMedia(item.id, mt, title, imageUrl, yr, item.season, item.episode, sec, item.rating);
                if (!isLibrary && mt === 'movie') addToHistory({ id: item.id, type: mt, title: title, poster: posterPath, year: yr, season: item.season || null, episode: item.episode || null, rating: item.vote_average });
            });
            if (isLibrary) {
                poster.find('.delete-badge').on('click', function() {
                    const listType = container.attr('id') === 'watchlistSlider' ? 'watchlist' : 'history';
                    state[listType] = state[listType].filter(function(i){ return !(i.id === item.id && i.type === item.type && i.season === item.season && i.episode === item.episode); });
                    localStorage.setItem(listType, JSON.stringify(state[listType]));
                    state.renderedSections.library = false;
                    loadLibrary();
                });
            }
            container.append(poster);
        }
    };

    // ── Library ───────────────────────────────────────────────────────────────
    const addToHistory = function(item) {
        const key = item.id + '_' + item.type + '_' + (item.season || '') + '_' + (item.episode || '');
        state.history = state.history.filter(function(h){ return h.id + '_' + h.type + '_' + (h.season || '') + '_' + (h.episode || '') !== key; });
        state.history.unshift(Object.assign({}, item, { rating: item.rating || 'N/A', timestamp: Date.now() }));
        state.history = state.history.slice(0, 20);
        localStorage.setItem('history', JSON.stringify(state.history));
    };

    let toastTimeout;
    const showToast = function(msg) {
        clearTimeout(toastTimeout);
        selectors.toast.text(msg).addClass('show');
        toastTimeout = setTimeout(function(){ selectors.toast.removeClass('show'); }, 3000);
    };

    const toggleWatchlist = function(item) {
        const inWL = state.watchlist.some(function(w){ return w.id === item.id; });
        if (!inWL) state.watchlist.push(Object.assign({}, item, { timestamp: Date.now() }));
        else state.watchlist = state.watchlist.filter(function(w){ return w.id !== item.id; });
        showToast(inWL ? 'Removed from Watchlist' : 'Added to Watchlist');
        localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
        loadLibrary();
    };

    const loadLibrary = async function() {
        state.renderedSections.library = false;
        selectors.watchlistSlider.empty().show();
        if (!state.watchlist.length) {
            selectors.watchlistSlider.html('<div class="empty-message-container"><p class="empty-message">Your watchlist is empty.</p></div>');
        } else {
            const items = (await Promise.all(state.watchlist.map(function(i) {
                const url = getImageUrl(i.poster, 'poster');
                return url ? loadImage(url).then(function(){ return Object.assign({}, i, { imageUrl: url }); }).catch(function(){ return null; }) : Promise.resolve(null);
            }))).filter(Boolean);
            for (const i of items) await renderItem(i, selectors.watchlistSlider, 'slider', true);
        }
        selectors.historySlider.empty().show();
        if (!state.history.length) {
            selectors.historySlider.html('<div class="empty-message-container"><p class="empty-message">Your history is empty.</p></div>');
        } else {
            const hmap = new Map();
            state.history.forEach(function(i) {
                const k = i.id + '_' + i.type;
                if (!hmap.has(k) || hmap.get(k).timestamp < i.timestamp) hmap.set(k, i);
            });
            const unique = Array.from(hmap.values()).sort(function(a,b){ return b.timestamp - a.timestamp; });
            const items = (await Promise.all(unique.map(function(i) {
                const url = getImageUrl(i.poster, 'poster');
                return url ? loadImage(url).then(function(){ return Object.assign({}, i, { imageUrl: url }); }).catch(function(){ return null; }) : Promise.resolve(null);
            }))).filter(Boolean);
            for (const i of items) await renderItem(i, selectors.historySlider, 'slider', true);
        }
        state.renderedSections.library = true;
    };

    // ── Season/Episode ────────────────────────────────────────────────────────
    const loadSeasonEpisodeAccordion = async function() {
        if (state.mediaType !== 'tv') { selectors.seasonEpisodeSelector.hide(); selectors.downloadBtn.attr('href', '#'); return; }
        selectors.seasonEpisodeSelector.show();
        selectors.seasonEpisodeAccordion.empty();
        selectors.downloadBtn.attr('href', '#');
        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/tv/' + state.mediaId + '?api_key=' + config.apiKey);
            const seasons = (data.seasons || []).filter(function(s){ return s.season_number > 0 && s.episode_count > 0; });
            if (!seasons.length) { selectors.seasonEpisodeAccordion.html('<p class="empty-message">No seasons available.</p>'); return; }
            for (const season of seasons) {
                const details = $('<details><summary>Season ' + season.season_number + '</summary><div class="episode-list"></div></details>');
                selectors.seasonEpisodeAccordion.append(details);
                const epList = details.find('.episode-list');
                const epData = await fetchWithRetry('https://api.themoviedb.org/3/tv/' + state.mediaId + '/season/' + season.season_number + '?api_key=' + config.apiKey);
                const eps = (epData.episodes || []).filter(function(e){ return e.episode_number > 0; });
                if (!eps.length) { epList.html('<p class="empty-message">No episodes available.</p>'); continue; }
                eps.forEach(function(ep) {
                    const btn = $('<button class="episode-btn" data-season="' + season.season_number + '" data-episode="' + ep.episode_number + '"><span>Episode ' + ep.episode_number + ': ' + (ep.name || 'Untitled') + '</span></button>');
                    btn.on('click', function() {
                        $('.episode-btn').removeClass('active');
                        btn.addClass('active');
                        state.season = season.season_number;
                        state.episode = ep.episode_number;
                        embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
                        selectors.downloadBtn.attr('href', 'https://dl.vidsrc.vip/tv/' + state.mediaId + '/' + state.season + '/' + state.episode);
                        addToHistory({ id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode, rating: data.vote_average });
                    });
                    epList.append(btn);
                });
            }
            selectors.seasonEpisodeAccordion.find('summary').on('click', function() {
                selectors.seasonEpisodeAccordion.find('details').not($(this).parent()).removeAttr('open');
            });
        } catch(e) { console.error('Failed to load seasons/episodes', e); selectors.seasonEpisodeAccordion.html('<p class="empty-message">Failed to load seasons/episodes.</p>'); }
    };

    const resetVideoPlayerState = function() {
        state.mediaId = null; state.mediaType = 'movie'; state.season = null; state.episode = null;
        const wrapper = selectors.videoFrame.parent();
        wrapper.find('video.hls-player').each(function(){ this.pause(); this.src = ''; }).remove();
        wrapper.find('.stream-loading, .stream-error').remove();
        selectors.videoFrame.attr('src', '').hide();
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', '').attr('alt', '').removeClass('loaded');
        selectors.mediaRatingBadge.find('.rating-value').text('');
        selectors.mediaDetailsTitle.text('');
        selectors.mediaYearGenre.text('');
        selectors.mediaPlot.text('');
        selectors.seasonEpisodeSelector.hide();
        selectors.seasonEpisodeAccordion.empty();
        selectors.watchlistBtn.html('<i class="fas fa-plus"></i> <span>Watchlist</span>').removeClass('active');
        selectors.downloadBtn.attr('href', '#');
    };

    // ── Page Navigation ───────────────────────────────────────────────────────
    const loadHomepage = async function() {
        if (!selectors.moviesSlider.length) return;
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.show();
        selectors.moviesSlider.parent().show(); selectors.tvSlider.parent().show();
        selectors.animeSlider.parent().show(); selectors.kdramaSlider.parent().show(); selectors.cdramaSlider.parent().show();
        selectors.librarySection.hide(); selectors.searchSection.hide();
        ['moviesSliderContainer','tvSliderContainer','animeSliderContainer','kdramaSliderContainer','cdramaSliderContainer'].forEach(updateSliderArrows);

        const loadSection = async function(container, type, isPreview) {
            isPreview = isPreview || false;
            if (state.renderedSections[type] && !isPreview) { container.show(); return; }
            container.empty().show();
            const items = await fetchMedia(type, isPreview);
            for (const item of items) await renderItem(item, container, isPreview ? 'preview' : 'slider');
            if (!isPreview) { updateSliderArrows(container.attr('id')); state.renderedSections[type] = true; }
        };

        if (!state.renderedSections.preview) {
            observeElement(selectors.previewItemsContainer, function() {
                loadSection(selectors.previewItemsContainer, 'trending', true);
                state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
                selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
                startPreviewSlideshow();
            });
        } else {
            selectors.previewItemsContainer.show();
            state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
            startPreviewSlideshow();
        }
        observeElement(selectors.moviesSlider, function(){ loadSection(selectors.moviesSlider, 'movie'); });
        observeElement(selectors.tvSlider,     function(){ loadSection(selectors.tvSlider, 'tv'); });
        observeElement(selectors.animeSlider,  function(){ loadSection(selectors.animeSlider, 'anime'); });
        observeElement(selectors.kdramaSlider, function(){ loadSection(selectors.kdramaSlider, 'kdrama'); });
        observeElement(selectors.cdramaSlider, function(){ loadSection(selectors.cdramaSlider, 'cdrama'); });
    };

    const loadSearchSection = function() {
        if (!selectors.searchSection.length) return;
        selectors.homepage.show(); selectors.videoPage.hide(); selectors.previewSection.hide();
        selectors.moviesSlider.parent().hide(); selectors.tvSlider.parent().hide();
        selectors.animeSlider.parent().hide(); selectors.kdramaSlider.parent().hide(); selectors.cdramaSlider.parent().hide();
        selectors.librarySection.hide(); selectors.searchSection.show();
        selectors.searchInput.focus();
        stopPreviewSlideshow();
        if (!state.renderedSections.search) {
            selectors.searchResults.empty(); selectors.searchTrending.empty();
            observeElement(selectors.searchTrending, function() {
                const filter = selectors.searchFilter.val();
                (filter === 'movie' ? fetchMedia('movie') : fetchMedia('tv')).then(function(items){ items.forEach(function(i){ renderItem(i, selectors.searchTrending); }); });
            });
            state.renderedSections.search = true;
        } else { selectors.searchResults.show(); selectors.searchTrending.show(); }
    };

    const navigateToMedia = async function(id, type, title, poster, year, season, episode, section, rating) {
        season = season || null; episode = episode || null; section = section || null; rating = rating || 'N/A';
        const params = new URLSearchParams({ id: id, type: type, title: title, poster: poster, year: year, rating: rating, section: section || 'home' });
        if (season) params.set('season', season);
        if (episode) params.set('episode', episode);
        window.location.href = 'watch.html?' + params.toString();
    };

    const renderVideoPage = async function(id, type, title, poster, year, season, episode, section, rating) {
        stopPreviewSlideshow();
        resetVideoPlayerState();
        state.mediaId = id; state.mediaType = type; state.season = season; state.episode = episode;
        state.previousSection = section || state.previousSection;
        selectors.videoPage.data({ id: id, type: type, title: title, poster: poster, year: year });
        const inWL = state.watchlist.some(function(w){ return w.id === id; });
        selectors.watchlistBtn.html(inWL ? '<i class="fa-solid fa-check"></i> <span>Watchlist</span>' : '<i class="fas fa-plus"></i> <span>Watchlist</span>').toggleClass('active', inWL);
        selectors.downloadBtn.attr('href', type === 'movie' ? 'https://dl.vidsrc.vip/movie/' + id : '#');
        selectors.videoPage.show(); selectors.homepage.hide();
        selectors.videoMediaTitle.show().text(title + '\n(' + (year || 'N/A') + ')');
        selectors.selectorContainer.show(); selectors.mediaDetails.show();
        mediaCache.clear(id, type);

        const updateUI = function(data) {
            const genres = data.genres ? data.genres.slice(0,2).map(function(g){ return g.name.split(' ')[0]; }) : ['N/A'];
            const posterUrl = getImageUrl(data.poster_path) || poster;
            selectors.mediaPoster.attr('src', posterUrl).attr('alt', title + ' Poster').addClass('opacity-0');
            loadImage(posterUrl).then(function(){ selectors.mediaPoster.removeClass('opacity-0'); }).catch(function(){ selectors.mediaPoster.attr('src', ''); });
            selectors.mediaRatingBadge.find('.rating-value').text(data.vote_average ? data.vote_average.toFixed(1) : rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 ' + genres.join(', '));
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        const cached = mediaCache.get(id, type);
        if (cached) { updateUI(cached); }
        else {
            selectors.mediaPoster.attr('src', poster || '').addClass('opacity-0');
            loadImage(poster).then(function(){ selectors.mediaPoster.removeClass('opacity-0'); }).catch(function(){});
            selectors.mediaRatingBadge.find('.rating-value').text(rating || 'N/A');
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 N/A');
            selectors.mediaPlot.text('No description available.');
        }

        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/' + type + '/' + id + '?api_key=' + config.apiKey);
            mediaCache.set(id, type, data); updateUI(data);
        } catch(e) { console.error('Failed to fetch media details', e); }

        if (type === 'movie') {
            embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
        } else {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                $('.episode-btn[data-season="' + season + '"][data-episode="' + episode + '"]').addClass('active');
                   embedVideo().catch(function(e){ console.error('embedVideo error:', e); });
                selectors.downloadBtn.attr('href', 'https://dl.vidsrc.vip/tv/' + id + '/' + season + '/' + episode);
            }
        }
    };

    const navigateToSection = function(section) {
        if (section === 'home') window.location.href = 'index.html';
        else if (section === 'search') window.location.href = 'search.html';
        else if (section === 'library') window.location.href = 'library.html';
    };

    // ── Slider Controls ───────────────────────────────────────────────────────
    const updateSliderArrows = function(id) {
        const c = $('#' + id);
        if (!c.length) return;
        const sl = c.scrollLeft(), max = c[0].scrollWidth - c[0].clientWidth, w = c.parent();
        w.find('.slider-arrow.left').toggleClass('hidden-arrow', sl <= 10);
        w.find('.slider-arrow.right').toggleClass('hidden-arrow', sl >= max - 10);
    };

    window.scrollSlider = function(id, dir) {
        const c = $('#' + id), amt = c.width() * 0.8;
        c.animate({ scrollLeft: (dir === 'left' ? '-=' : '+=') + amt }, 300, function(){ updateSliderArrows(id); });
    };

    window.navigatePreview = function(dir) {
        stopPreviewSlideshow();
        const total = selectors.previewItemsContainer.children().length;
        state.previewIndex = dir === 'left' ? (state.previewIndex - 1 + total) % total : (state.previewIndex + 1) % total;
        selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        startPreviewSlideshow();
    };

    // ── Preview Slideshow ─────────────────────────────────────────────────────
    const setupPreviewTouch = function() {
        let startX = 0, isSwiping = false;
        selectors.previewSection.on('touchstart', function(e) { startX = e.originalEvent.touches[0].clientX; isSwiping = true; stopPreviewSlideshow(); });
        selectors.previewSection.on('touchmove', function(e) {
            if (!isSwiping) return;
            const diff = startX - e.originalEvent.touches[0].clientX;
            const total = selectors.previewItemsContainer.children().length;
            if (!total) { isSwiping = false; return; }
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100 + (diff / selectors.previewSection.width()) * 100) + '%)');
        });
        selectors.previewSection.on('touchend', function(e) {
            if (!isSwiping) return; isSwiping = false;
            const diff = startX - e.originalEvent.changedTouches[0].clientX;
            const total = selectors.previewItemsContainer.children().length;
            if (Math.abs(diff) > 50 && total > 0) {
                state.previewIndex = diff > 0 ? Math.min(state.previewIndex + 1, total - 1) : Math.max(state.previewIndex - 1, 0);
            }
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css({ transition: 'transform 0.5s ease', transform: 'translateX(' + (-state.previewIndex * 100) + '%)' });
            setTimeout(function() { selectors.previewItemsContainer.css('transition', ''); startPreviewSlideshow(); }, 500);
        });
    };

    const startPreviewSlideshow = function() {
        if (state.previewInterval || selectors.videoPage.is(':visible') || !selectors.previewSection.is(':visible') || !selectors.previewItemsContainer.children().length) return;
        state.previewIndex = Math.max(0, Math.min(state.previewIndex, selectors.previewItemsContainer.children().length - 1));
        selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        state.previewInterval = setInterval(function() {
            if (!selectors.previewSection.is(':visible')) { stopPreviewSlideshow(); return; }
            state.previewIndex = (state.previewIndex + 1) % selectors.previewItemsContainer.children().length;
            localStorage.setItem('previewIndex', state.previewIndex);
            selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
        }, 10000);
    };

    const stopPreviewSlideshow = function() { if (state.previewInterval) { clearInterval(state.previewInterval); state.previewInterval = null; } };
    const resumePreviewSlideshow = function() { if (!selectors.videoPage.is(':visible')) startPreviewSlideshow(); };

    // ── Event Handlers ────────────────────────────────────────────────────────
    selectors.watchlistBtn.on('click', function() {
        const d = selectors.videoPage.data();
        const rating = selectors.mediaRatingBadge.find('.rating-value').text() || '0';
        toggleWatchlist({ id: d.id, type: d.type, title: d.title, poster: d.poster, rating: parseFloat(rating), year: d.year });
        const inWL = state.watchlist.some(function(w){ return w.id === d.id; });
        selectors.watchlistBtn.html(inWL ? '<i class="fa-solid fa-check"></i> <span>Watchlist</span>' : '<i class="fas fa-plus"></i> <span>Watchlist</span>').toggleClass('active', inWL);
    });

    selectors.backBtn.on('click', function() { resetVideoPlayerState(); navigateToSection(state.previousSection); resumePreviewSlideshow(); });
    selectors.sidebarNavItems.on('click', function() { navigateToSection($(this).data('section')); });

    let searchTimeout = null;
    const performSearch = async function() {
        const query = selectors.searchInput.val().trim();
        if (query.length < 3) { selectors.searchResults.empty(); selectors.searchTrending.show(); return; }
        selectors.searchTrending.hide();
        const filter = selectors.searchFilter.val();
        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/search/multi?api_key=' + config.apiKey + '&query=' + encodeURIComponent(query) + '&page=1');
            const results = (data.results || []).filter(function(i){ return (i.media_type === filter || filter === 'all') && i.id && (i.title || i.name) && i.poster_path && i.vote_average; }).slice(0,20);
            selectors.searchResults.empty();
            if (!results.length) selectors.searchResults.html('<p class="text-center" style="color:#ccc;">No results found.</p>');
            else results.forEach(function(i){ renderItem(i, selectors.searchResults); });
        } catch(e) { console.error('Search failed', e); selectors.searchResults.html('<p class="text-center" style="color:#ccc;">Failed to load results.</p>'); }
    };

    selectors.searchInput.on('input', function() { clearTimeout(searchTimeout); searchTimeout = setTimeout(performSearch, 500); });
    selectors.searchFilter.on('change', function() { performSearch(); });

    $(window).on('popstate', function(e) {
        const s = e.originalEvent.state;
        if (s && s.id && s.type) navigateToMedia(s.id, s.type, s.title || 'Unknown', s.poster || '', s.year, s.season, s.episode, s.section, s.rating || 'N/A');
        else if (s && s.section) navigateToSection(s.section);
        else loadHomepage();
    });

    let resizeTimeout;
    $(window).on('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const mobile = window.matchMedia('(max-width: 767px)').matches;
            const bp = mobile ? 'mobile' : 'desktop';
            if (bp !== state.lastBreakpoint) {
                state.lastBreakpoint = bp;
                $('.poster-img.loaded, .preview-background.loaded').each(function() {
                    const src = $(this).attr('src');
                    if (src) $(this).attr('src', getImageUrl(src.split('/').pop(), $(this).hasClass('preview-background') ? 'backdrop' : 'poster'));
                });
            }
            ['moviesSliderContainer','tvSliderContainer','animeSliderContainer','kdramaSliderContainer','cdramaSliderContainer'].forEach(updateSliderArrows);
            if (selectors.previewItemsContainer.children().length) {
                selectors.previewItemsContainer.css('transform', 'translateX(' + (-state.previewIndex * 100) + '%)');
            }
        }, 200);
    });

    // ── Initial Load ──────────────────────────────────────────────────────────
    const handleInitialLoad = async function() {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        if (path.includes('watch.html')) {
            const id = params.get('id'), type = params.get('type');
            if (id && type) {
                renderVideoPage(id, type,
                    params.get('title') || 'Unknown',
                    params.get('poster') || '',
                    params.get('year') || 'N/A',
                    params.get('season') ? parseInt(params.get('season')) : null,
                    params.get('episode') ? parseInt(params.get('episode')) : null,
                    params.get('section') || 'home',
                    params.get('rating') || 'N/A'
                );
            }
        } else if (path.includes('search.html')) {
            loadSearchSection();
        } else if (path.includes('library.html')) {
            selectors.homepage.show(); selectors.librarySection.show(); loadLibrary();
        } else {
            loadHomepage();
        }
    };

    $(document).on('keydown', function(e) {
        if (selectors.previewSection.is(':visible')) {
            if (e.key === 'ArrowLeft') navigatePreview('left');
            if (e.key === 'ArrowRight') navigatePreview('right');
        }
    });

    setupPreviewTouch();
    handleInitialLoad();
    $('.poster-slider').on('scroll', function() { updateSliderArrows($(this).attr('id')); });
});
