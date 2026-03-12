$(document).ready(function() {

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
        mediaDetailsTitle: $('#mediaDetailsTitle'),
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
        if (!url) throw new Error('Hexa: no stream URL.');
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

    // ── Artplayer + HLS.js ─────────────────────────────────────────────────────
    var currentArt = null;

    function loadScript(src) {
        return new Promise(function(res, rej) {
            if (window.Artplayer) { res(); return; }
            var s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    }
    async function loadArtplayer() {
        if (window.Artplayer) return;
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/artplayer/5.2.1/artplayer.js'); }
        catch(e) { await loadScript('https://cdn.jsdelivr.net/npm/artplayer@5.2.1/dist/artplayer.js'); }
    }

    // ── Subtitle system ──────────────────────────────────────────────────────────
    function injectSubtitleSetting(art, hls) {
        if (!art || !art.video) return;
        var video    = art.video;
        var enabled  = true;
        
        // Mobile Layout overrides
        var isMobile = window.matchMedia('(max-width: 767px)').matches;
        var fontSize = isMobile ? '18px' : '22px';
        var initialBottom = isMobile ? '8px' : '62px';
        
        var fontWeight= '500'; // Default set to Medium
        var edgeStyle= 'dropshadow';
        var bgOpacity= 0;
        var bgColor  = '0,0,0';
        var subColor = '#ffffff';
        var cues     = [];
        var pollTimer= null;
        var lastText = '';
        var loaded   = false;

        var availableSubs = [];
        var currentSubIdx = 0;

        // ── Overlay ───────────────────────────────────────────────────────────
        var box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:0;right:0;bottom:' + initialBottom + ';'
            + 'text-align:center;z-index:9999;pointer-events:none;padding:0 10px;';
        art.template.$player.appendChild(box);

        // ── Render one cue ────────────────────────────────────────────────────
        function show(text) {
            text = (text||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')
                .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\\N/g,'\n').trim();
            if (text === lastText) return;
            lastText = text;
            box.innerHTML = '';
            if (!text || !enabled) return;
            var shadow =
                edgeStyle==='dropshadow' ? '2px 2px 5px rgba(0,0,0,1),1px 1px 3px rgba(0,0,0,.9)' :
                edgeStyle==='outline'    ? '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000' :
                edgeStyle==='raised'     ? '0 1px 0 #000,0 2px 0 rgba(0,0,0,.6)' :
                edgeStyle==='depressed'  ? '0 -1px 0 #000,0 -2px 0 rgba(0,0,0,.6)' : 'none';
            var bg = bgColor === 'none' ? 'transparent' : 'rgba('+bgColor+','+bgOpacity+')';
            var sp = document.createElement('span');
            sp.textContent = text;
            sp.style.cssText = 'display:inline-block;background:'+bg+';'
                + 'color:'+subColor+';font-size:'+fontSize+';font-family:Arial,sans-serif;font-weight:'+fontWeight+';'
                + 'line-height:1.65;padding:3px 12px;border-radius:3px;'
                + 'white-space:pre-line;max-width:98%;word-break:break-word;'
                + 'text-shadow:'+shadow+';';
            box.appendChild(sp);
        }

        // ── Poll loop ─────────────────────────────────────────────────────────
        function startPoll() {
            if (pollTimer) return;
            pollTimer = setInterval(function() {
                if (!enabled||!cues.length) { show(''); return; }
                var t = video.currentTime;
                var txt = '';
                for (var i=0; i<cues.length; i++) {
                    if (cues[i].start <= t && cues[i].end > t) { txt = cues[i].text; break; }
                    if (cues[i].start > t+1) break;
                }
                show(txt);
            }, 150);
        }
        function stopPoll() {
            clearInterval(pollTimer); pollTimer = null; show('');
        }

        function toSec(ts) {
            ts = ts.trim().replace(',','.');
            var p = ts.split(':');
            if (p.length===3) return +p[0]*3600 + +p[1]*60 + +p[2];
            if (p.length===2) return +p[0]*60 + +p[1];
            return +p[0];
        }

        function parseSubtitle(txt) {
            var result = [];
            var lines  = txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
            for (var i=0; i<lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf(' --> ') === -1) continue;
                var arrow = line.split(' --> ');
                var start = toSec(arrow[0]);
                var end   = toSec(arrow[1].split(' ')[0]);
                var textLines = [];
                while (++i < lines.length) {
                    var l = lines[i].trim();
                    if (!l) break;
                    l = l.replace(/<[^>]+>/g,'').replace(/\{[^}]+\}/g,'').trim();
                    if (l) textLines.push(l);
                }
                var text = textLines.join('\n');
                if (text && end > start) result.push({start:start, end:end, text:text});
            }
            result.sort(function(a,b){return a.start-b.start;});
            return result;
        }

        function setStatus(msg, color) {
            box.innerHTML = '';
            if (!msg) return;
            var sp = document.createElement('span');
            sp.textContent = msg;
            sp.style.cssText = 'display:inline-block;background:rgba(0,0,0,.75);'
                + 'color:'+(color||'#aaa')+';font-size:13px;font-family:Arial,sans-serif;'
                + 'padding:3px 10px;border-radius:3px;';
            box.appendChild(sp);
        }

        async function fetchVTT(url) {
            var res = await fetch(NETLIFY_PROXY, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({url:url, method:'GET', headers:{}})
            });
            if (!res.ok) throw new Error('proxy '+res.status);
            var env = await res.json();
            if (!env || !env.text) throw new Error('empty proxy response');
            return env.text;
        }

        async function loadSubtitles() {
            try {
                var url = 'https://sub.wyzie.ru/search?id=' + state.mediaId
                        + '&language=en&source=all&format=srt';
                if (state.mediaType === 'tv' && state.season && state.episode)
                    url += '&season=' + state.season + '&episode=' + state.episode;

                var r = await fetch(url);
                if (!r.ok) throw new Error('wyzie HTTP ' + r.status);
                var results = await r.json();

                if (!Array.isArray(results) || !results.length)
                    throw new Error('no results from wyzie');

                var enResults = results.filter(function(x){ return x.language && x.language.toLowerCase().startsWith('en'); });
                availableSubs = enResults.length ? enResults : results;
                availableSubs = availableSubs.slice(0, 5); 

                if (availableSubs.length === 0) throw new Error('no valid english results');

                await fetchAndSetSub(0);
                updateSubtitleMenu();

            } catch(err) {
                console.warn('[Subtitle] Failed:', err.message);
                setStatus('No subtitles found', '#f66');
                setTimeout(function(){ setStatus(''); }, 3000);
            }
        }

        async function fetchAndSetSub(index) {
            var pick = availableSubs[index];
            var subText = await fetchVTT(pick.url);
            var parsed  = parseSubtitle(subText);
            if (!parsed.length) throw new Error('0 cues parsed');

            cues = parsed;
            loaded = true;
            currentSubIdx = index;
            setStatus('');
            startPoll();
        }

        function updateSubtitleMenu() {
            var newSelector = [{html:'Off', value:'off'}];

            if (availableSubs.length === 0) {
                newSelector.push({html:'English', value:'on', default:true});
                newSelector.push({html:'↺ Reload', value:'reload'});
            } else {
                for (var i = 0; i < availableSubs.length; i++) {
                    newSelector.push({
                        html: 'English ' + (i + 1),
                        value: String(i),
                        default: i === currentSubIdx
                    });
                }
                newSelector.push({html:'↺ Reload', value:'reload'});
            }

            try { art.setting.remove('subs'); } catch (e) {}

            art.setting.add({
                name: 'subs',
                html: 'Subtitles',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H5v-2h7v2zm7 0h-5v-2h5v2zm-7-4H5V9h7v2zm7 0h-5V9h5v2z"/></svg>',
                width: 180,
                selector: newSelector,
                onSelect: function(item) {
                    if (item.value === 'off') { enabled=false; stopPoll(); show(''); return item.html; }
                    if (item.value === 'reload') { cues=[]; loaded=false; loadSubtitles(); return item.html; }
                    if (item.value === 'on') { enabled=true; if(loaded) startPoll(); else loadSubtitles(); return item.html; }

                    enabled = true;
                    var idx = parseInt(item.value);
                    if (!isNaN(idx)) {
                        setStatus('Loading...', '#aaa');
                        fetchAndSetSub(idx).then(function() {
                            // Do nothing else here
                        }).catch(function(e){ 
                            setStatus('Failed to load', '#f66'); 
                            setTimeout(function(){ setStatus(''); }, 2000); 
                        });
                        return item.html;
                    }
                    return item.html;
                }
            });
        }

        updateSubtitleMenu();

        if (state.mediaId) {
            setTimeout(loadSubtitles, 500);
        }

        art.setting.add({
            html: 'Sub Font Size',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"/></svg>',
            width: 180,
            selector: [
                {html:'Small (14px)',  value:'14px'},
                {html:'Medium (18px)', value:'18px', default: isMobile},
                {html:'Large (22px)',  value:'22px', default: !isMobile},
                {html:'XL (28px)',     value:'28px'},
                {html:'XXL (34px)',    value:'34px'}
            ],
            onSelect: function(item) { fontSize=item.value; lastText=''; return item.html.split(' ')[0]; }
        });

        art.setting.add({
            html: 'Char Edge',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 6.11c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.61z"/></svg>',
            width: 180,
            selector: [
                {html:'None',        value:'none'},
                {html:'Drop Shadow', value:'dropshadow', default:true},
                {html:'Outline',     value:'outline'},
                {html:'Raised',      value:'raised'},
                {html:'Depressed',   value:'depressed'}
            ],
            onSelect: function(item) { edgeStyle=item.value; lastText=''; return item.html; }
        });

        art.setting.add({
            html: 'Sub Position',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M4 15h16v-2H4v2zm0 4h16v-2H4v2zm0-8h16V9H4v2zm0-6v2h16V5H4z"/></svg>',
            width: 180,
            selector: [
                {html:'Very Low',  value:'8px', default: isMobile},
                {html:'Low',       value:'62px',  default: !isMobile},
                {html:'Mid',       value:'110px'},
                {html:'High',      value:'160px'},
                {html:'Very High', value:'220px'}
            ],
            onSelect: function(item) {
                box.style.bottom = item.value;
                return item.html;
            }
        });

        art.on('destroy', stopPoll);
        art.on('seek',    function() { lastText=''; });
    }

    // ── Quality setting injector ────────────────────────────────
    function injectQualitySetting(art, hls, levels, defaultLevelIdx) {
        var sorted = levels.map(function(lv,i){ return {idx:i, h:lv.height||0, bw:lv.bitrate||0}; })
            .sort(function(a,b){ return b.h - a.h; });
        var default360 = sorted[sorted.length-1];
        var defaultIdx = (defaultLevelIdx !== undefined && defaultLevelIdx >= 0) ? defaultLevelIdx : default360.idx;
        var options = [{default:false, html:'Auto', value:-1}]
            .concat(sorted.map(function(lv){
                var isDefault = lv.idx === defaultIdx;
                return { html: lv.h ? lv.h+'p' : Math.round(lv.bw/1000)+'k', value: lv.idx, default: isDefault };
            }));
        
        hls.currentLevel = defaultIdx;
        hls.loadLevel = defaultIdx;

        art.setting.add({
            html: 'Quality',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H8v-2h4v2zm4-4H8v-2h8v2zm0-4H8V7h8v2z"/></svg>',
            width: 150,
            selector: options,
            onSelect: function(item) {
                var idx = item.value;
                var video = art.video;
                if (idx === -1) {
                    hls.currentLevel = -1;
                    hls.loadLevel    = -1;
                } else {
                    hls.loadLevel    = idx;
                    hls.currentLevel = idx;
                    if (video && !video.paused && video.currentTime > 0.5) {
                        var t = video.currentTime;
                        video.currentTime = t + 0.05;
                    }
                }
                return item.html;
            }
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function(ev, data) {
            var lv = levels[data.level];
        });
    }

    // ── Embed Video ───────────────────────────────────────────────────────────
    const embedVideo = async function() {
        if (!state.mediaId) return;
        if (state.mediaType === 'tv' && (!state.season || !state.episode)) return;

        var wrapper = selectors.videoFrame.parent();

        if (currentArt) {
            try { currentArt.destroy(true); } catch(e) {}
            currentArt = null;
        }
        wrapper.find('*').not(selectors.videoFrame).remove();
        selectors.videoFrame.hide();

        var spinDiv = document.createElement('div');
        spinDiv.id = 'sp-loading';
        spinDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
            + 'background:#000;border-radius:12px;aspect-ratio:16/9;min-height:200px;gap:14px;color:#aaa;font-size:14px;';
        spinDiv.innerHTML = '<div style="width:46px;height:46px;border:4px solid rgba(255,255,255,.1);'
            + 'border-top-color:#2af598;border-radius:50%;animation:sp-spin .8s linear infinite;"></div>'
            + '<p>Loading stream\u2026</p>';
        wrapper.css('position','relative').append(spinDiv);

        var params = {
            tmdbId: state.mediaId, mediaType: state.mediaType,
            title: selectors.videoPage.data('title') || '',
            year:  selectors.videoPage.data('year')  || '',
            season: state.season, episode: state.episode
        };

        try {
            var results = await Promise.all([ resolveStream('hexa', params), loadArtplayer() ]);
            var stream  = results[0];

            wrapper.find('#sp-loading').remove();

            var artWrap = document.createElement('div');
            artWrap.className = 'sp-art-wrap';
            wrapper.append(artWrap);

            var streamHdrs = stream.headers || {};

            // ── ProxyLoader ───────────────────────────────────────────────────
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
                destroy(){ this._aborted = true; }
                abort()  { this._aborted = true; this.stats.aborted = true; }
                load(context, cfg, callbacks) {
                    var origUrl = context.url, self = this;
                    self.stats.loading.start = performance.now();

                    var urlNoQ = origUrl.split('?')[0].toLowerCase();
                    var isBinarySegment = context.responseType==='arraybuffer'
                        || context.type==='initSegment'
                        || urlNoQ.endsWith('.ts')  || urlNoQ.endsWith('.m4s')
                        || urlNoQ.endsWith('.mp4') || urlNoQ.endsWith('.m4a')
                        || urlNoQ.endsWith('.aac') || urlNoQ.endsWith('.mp3');

                    var hasRestrictedHeaders = streamHdrs.Referer || streamHdrs.referer || streamHdrs.Origin || streamHdrs.origin;

                    var mustProxy = context.type==='key' || urlNoQ.endsWith('.key')
                        || urlNoQ.endsWith('.m3u8') || urlNoQ.endsWith('.txt') || hasRestrictedHeaders;

                    function succeed(data) {
                        if (self._aborted) return;
                        var now = performance.now();
                        var len = data ? (data.byteLength !== undefined ? data.byteLength : data.length) : 0;
                        self.stats.loaded=len; self.stats.total=len;
                        self.stats.loading.first=now; self.stats.loading.end=now;
                        callbacks.onSuccess({data:data, url:origUrl}, self.stats, context, null);
                    }
                    function fail(msg) {
                        if (self._aborted) return;
                        callbacks.onError({code:0, text:msg}, context, null, {});
                    }

                    if (isBinarySegment && !mustProxy) {
                        fetch(origUrl, {
                            method: 'GET',
                            headers: streamHdrs,
                            mode: 'cors'
                        })
                        .then(function(r) {
                            if (!r.ok) throw new Error('direct ' + r.status);
                            return r.arrayBuffer();
                        })
                        .then(function(buf) {
                            succeed(buf);
                        })
                        .catch(function() {
                            if (!self._aborted) proxyFetch(0);
                        });
                        return;
                    }

                    function proxyFetch(attempt) {
                        if (self._aborted) return;
                        fetch(NETLIFY_PROXY, {
                            method: 'POST',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({url:origUrl, method:'GET', headers:streamHdrs})
                        })
                        .then(function(r) {
                            if ((r.status===502||r.status===503) && attempt < 2) {
                                return new Promise(function(res){setTimeout(res,400*(attempt+1));})
                                    .then(function(){ proxyFetch(attempt+1); });
                            }
                            if (!r.ok) throw new Error('proxy '+r.status);
                            return r.json();
                        })
                        .then(function(env) {
                            if (self._aborted) return;
                            if (!env) throw new Error('null proxy response');
                            var isB = isBinarySegment || context.type==='key' || urlNoQ.endsWith('.key');
                            var data;
                            if (isB && env.base64) {
                                try {
                                    var bin=atob(env.base64), bytes=new Uint8Array(bin.length);
                                    for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
                                    data=bytes.buffer;
                                } catch(e){ data=env.text||''; }
                            } else { data=env.text||''; }
                            succeed(data);
                        })
                        .catch(function(err){ fail(err.message); });
                    }
                    proxyFetch(0);
                }
            }

            // ── HLS instance ──────────────────────────────────────────────────
            var hls = new Hls({
                maxBufferLength:          90,
                maxMaxBufferLength:       180,
                maxBufferSize:            120 * 1000 * 1000,
                maxBufferHole:            0.5,
                highBufferWatchdogPeriod: 3,
                nudgeOffset:              0.2,
                nudgeMaxRetry:            5,
                startFragPrefetch:        true,
                testBandwidth:            true,
                progressive:              true,
                lowLatencyMode:           false,
                backBufferLength:         30,
                startLevel:              -1,
                abrEwmaDefaultEstimate:   8000000,
                abrEwmaFastLive:          3,
                abrEwmaSlowLive:          9,
                abrBandWidthFactor:       0.85,
                abrBandWidthUpFactor:     0.7,
                loader:                   ProxyLoader
            });

            var qualityInjected = false;
            var hlsLevels = [];

            hls.on(Hls.Events.MANIFEST_PARSED, function(ev, data) {
                hlsLevels = data.levels;
                var lowestIdx = hlsLevels.reduce(function(best, lv, i) {
                    return (lv.height || 99999) < (hlsLevels[best].height || 99999) ? i : best;
                }, 0);
                hls.currentLevel = lowestIdx;
                hls.loadLevel    = lowestIdx;

                if (currentArt && !qualityInjected && hlsLevels.length > 1) {
                    qualityInjected = true;
                    injectQualitySetting(currentArt, hls, hlsLevels, lowestIdx);
                }
            });

            hls.on(Hls.Events.ERROR, function(ev, d) {
                if (d.fatal) {
                    var errorMsg = d.details === 'manifestParsingError' ? 'MediaNotFound' : d.details;
                    wrapper.find('.sp-art-wrap').html(
                        '<div style="height:100%;display:flex;align-items:center;justify-content:center;'
                        +'flex-direction:column;gap:12px;color:#ff6b6b;">'
                        +'<i class="fas fa-exclamation-triangle" style="font-size:28px"></i>'
                        +'<p>'+errorMsg+'</p></div>'
                    );
                }
            });

            // ── Artplayer ─────────────────────────────────────────────────────
            var art = new Artplayer({
                container:      artWrap,
                url:            stream.url,
                type:           'm3u8',
                volume:         1,
                autoplay:       true,
                pip:            true,
                autoSize:       false,
                screenshot:     false,
                setting:        true,
                fullscreen:     true,
                fullscreenWeb:  true,
                miniProgressBar:false,
                mutex:          true,
                playsInline:    true,
                autoPlayback:   true,
                theme:          '#2af598',
                lang:           'en',
                hotkey:         true,
                moreVideoAttr: { crossOrigin:'anonymous', playsInline:true },
                subtitle: {
                    style: {
                        color:      '#fff',
                        fontSize:   '20px',
                        textShadow: '1px 1px 3px rgba(0,0,0,.9)'
                    }
                },
                customType: {
                    m3u8: function(videoEl, url) {
                        hls.loadSource(url);
                        hls.attachMedia(videoEl);
                    }
                }
            });

            art.on('ready', function() {
                if (!qualityInjected && hlsLevels.length > 1) {
                    qualityInjected = true;
                    injectQualitySetting(art, hls, hlsLevels, hls.currentLevel);
                }
                injectSubtitleSetting(art, hls);
            });

            currentArt = art;

        } catch(err) {
            wrapper.find('#sp-loading').remove();
            wrapper.append('<div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;'
                +'background:#0a0a0a;border-radius:12px;color:#ff6b6b;font-size:14px;gap:10px;flex-direction:column;">'
                +'<i class="fas fa-exclamation-triangle" style="font-size:28px"></i>'
                +'<p>'+err.message+'</p></div>');
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
            cdrama:   ['https://api.themoviedb.org/3/discover/tv?api_key=' + config.apiKey + '&with_original_language=zh&sort_by=first_air_date.desc&vote_average.gte=6&vote_count.gte=25&without_genres=16,10759,10765,10768&without_keywords=15060,248451,289844,12995,195013,184656,234890,293198', 'tv'],
            trending: ['https://api.themoviedb.org/3/trending/all/day?api_key=' + config.apiKey, 'multi'],
        };
        if (!map[type]) return [];
        const url = map[type][0], mediaType = map[type][1];
        try {
            let items = [], page = 1, maxPages = isPreview ? 5 : 2, desiredCount = isPreview ? 10 : 12;
            while (items.length < desiredCount && page <= maxPages) {
                const data = await fetchWithRetry(url + '&page=' + page);
                if (!data || !data.results) return items;
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
        } catch(e) { return []; }
    };

    // ── Render Item ───────────────────────────────────────────────────────────
    const renderItem = async function(item, container, renderType, isLibrary) {
        renderType = renderType || 'slider'; isLibrary = isLibrary || false;
        const title = item.title || item.name || 'Unknown';
        const posterPath = item.poster_path || item.poster || '';
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
                + '<div class="preview-meta"><span class="media-type">' + mtype + ' \u2022 ' + genres.join(', ') + '</span></div>'
                + '<p class="preview-description">' + (item.overview || 'No description available.') + '</p>'
                + '<div class="preview-buttons">'
                + '<button class="preview-btn play-btn"><i class="fa-solid fa-play"></i>  Watch</button>'
                + '<button class="preview-btn secondary add-btn"><i class="' + (inWL ? 'fa-solid fa-check' : 'fas fa-plus') + '"></i></button>'
                + '</div></div></div>');
            try { await loadImage(bdUrl); } catch(e) { el.remove(); return; }
            el.find('.play-btn').on('click', function(e) {
                e.preventDefault();
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                navigateToMedia(item.id, item.media_type, title, imageUrl, year, null, null, 'home');
                if (item.media_type === 'movie') addToHistory({ id: item.id, type: 'movie', title: title, poster: posterPath, year: year, season: null, episode: null });
            });
            el.find('.add-btn').on('click', function() {
                toggleWatchlist({ id: item.id, type: item.media_type, title: title, poster: posterPath });
                const inWL2 = state.watchlist.some(function(w){ return w.id === item.id; });
                el.find('.add-btn i').attr('class', inWL2 ? 'fa-solid fa-check' : 'fas fa-plus');
            });
            container.append(el);
        } else {
            const seLabel = isLibrary && item.season && item.episode ? '<span class="absolute bottom-2 left-2 !bg-[#2af598] !text-black text-[10px] font-bold px-2 py-1 rounded-md z-20 shadow-lg">S' + item.season + ' E' + item.episode + '</span>' : '';
            const delBadge = isLibrary ? '<span class="delete-badge absolute top-2 left-2 !bg-[#2af598] hover:bg-green-400 !text-black w-7 h-7 flex items-center justify-center rounded-full z-30 transition-colors backdrop-blur-sm" aria-label="Delete"><i class="fas fa-trash text-xs"></i></span>' : '';
            const year2 = (item.year || item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
            const poster = $('<div class="poster-item group relative flex-shrink-0 w-[90px] md:w-[160px] h-[135px] md:h-[240px] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)] bg-[#1a1a1a]">'
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
                navigateToMedia(item.id, mt, title, imageUrl, yr, item.season, item.episode, sec);
                if (!isLibrary && mt === 'movie') addToHistory({ id: item.id, type: mt, title: title, poster: posterPath, year: yr, season: item.season || null, episode: item.episode || null });
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
        state.history.unshift(Object.assign({}, item, { timestamp: Date.now() }));
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
                        embedVideo().catch(function(e){});
                        selectors.downloadBtn.attr('href', 'https://dl.vidsrc.vip/tv/' + state.mediaId + '/' + state.season + '/' + state.episode);
                        addToHistory({ id: state.mediaId, type: state.mediaType, title: selectors.videoPage.data('title'), poster: selectors.videoPage.data('poster'), year: selectors.videoPage.data('year'), season: state.season, episode: state.episode });
                    });
                    epList.append(btn);
                });
            }
            selectors.seasonEpisodeAccordion.find('summary').on('click', function() {
                selectors.seasonEpisodeAccordion.find('details').not($(this).parent()).removeAttr('open');
            });
        } catch(e) { selectors.seasonEpisodeAccordion.html('<p class="empty-message">Failed to load seasons/episodes.</p>'); }
    };

    const resetVideoPlayerState = function() {
        state.mediaId = null; state.mediaType = 'movie'; state.season = null; state.episode = null;
        const wrapper = selectors.videoFrame.parent();
        wrapper.find('video.hls-player').each(function(){ this.pause(); this.src = ''; }).remove();
        wrapper.find('.stream-loading, .stream-error').remove();
        selectors.videoFrame.attr('src', '').hide();
        selectors.videoMediaTitle.text('');
        selectors.mediaPoster.attr('src', '').attr('alt', '').removeClass('loaded');
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

    const navigateToMedia = async function(id, type, title, poster, year, season, episode, section) {
        season = season || null; episode = episode || null; section = section || null;
        const params = new URLSearchParams({ id: id, type: type, title: title, poster: poster, year: year, section: section || 'home' });
        if (season) params.set('season', season);
        if (episode) params.set('episode', episode);
        window.location.href = 'watch.html?' + params.toString();
    };

    const renderVideoPage = async function(id, type, title, poster, year, season, episode, section) {
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
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 ' + genres.join(', '));
            selectors.mediaPlot.text(data.overview || 'No description available.');
        };

        const cached = mediaCache.get(id, type);
        if (cached) { updateUI(cached); }
        else {
            selectors.mediaPoster.attr('src', poster || '').addClass('opacity-0');
            loadImage(poster).then(function(){ selectors.mediaPoster.removeClass('opacity-0'); }).catch(function(){});
            selectors.mediaDetailsTitle.text(title);
            selectors.mediaYearGenre.text(type.toUpperCase() + ' \u2022 ' + (year || 'N/A') + ' \u2022 N/A');
            selectors.mediaPlot.text('No description available.');
        }

        try {
            const data = await fetchWithRetry('https://api.themoviedb.org/3/' + type + '/' + id + '?api_key=' + config.apiKey);
            mediaCache.set(id, type, data); updateUI(data);
        } catch(e) {}

        if (type === 'movie') {
            embedVideo().catch(function(e){});
        } else {
            await loadSeasonEpisodeAccordion();
            if (season && episode) {
                $('.episode-btn[data-season="' + season + '"][data-episode="' + episode + '"]').addClass('active');
                   embedVideo().catch(function(e){});
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
        toggleWatchlist({ id: d.id, type: d.type, title: d.title, poster: d.poster, year: d.year });
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
        } catch(e) { selectors.searchResults.html('<p class="text-center" style="color:#ccc;">Failed to load results.</p>'); }
    };

    selectors.searchInput.on('input', function() { clearTimeout(searchTimeout); searchTimeout = setTimeout(performSearch, 500); });
    selectors.searchFilter.on('change', function() { performSearch(); });

    $(window).on('popstate', function(e) {
        const s = e.originalEvent.state;
        if (s && s.id && s.type) navigateToMedia(s.id, s.type, s.title || 'Unknown', s.poster || '', s.year, s.season, s.episode, s.section);
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
                    params.get('section') || 'home'
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
