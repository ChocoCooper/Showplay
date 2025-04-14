(function () {
    // Trusted domains for video embeds (allowlist)
    const allowDomains = [
        'vidfast.pro',
        '111movies.com',
        'vidsrc.cc',
        'vidsrc.vip',
        '2embed.cc'
    ];

    // Known ad/tracker/redirect domains to block (expanded list)
    const blockDomains = [
        'doubleclick.net',
        'adnxs.com',
        'popads.net',
        'adservice.google.com',
        'pagead2.googlesyndication.com',
        'tpc.googlesyndication.com',
        'googletagservices.com',
        'googletagmanager.com',
        'adsafeprotected.com',
        'servedby.flashtalking.com',
        'pixel.quantserve.com',
        'ads.pubmatic.com',
        'adroll.com',
        'outbrain.com',
        'taboola.com',
        'criteo.com',
        'rubiconproject.com',
        'openx.net',
        'yieldmo.com',
        'sharethrough.com',
        'media.net',
        'revcontent.com',
        'mgid.com',
        'bidswitch.net',
        'smartadserver.com'
    ];

    // Ad and redirect-blocking selectors (expanded and refined)
    const blockSelectors = [
        '[id*="ad-"]:not(.media-details, .header, .preview-section, .video-page)', // Exclude Streamzy classes
        '[class*="ad-"]:not(.media-details, .header, .preview-section, .video-page)',
        '[id*="ads-"]:not(.media-details, .header, .preview-section, .video-page)',
        '[class*="ads-"]:not(.media-details, .header, .preview-section, .video-page)',
        '.banner-ad',
        '.adsbygoogle',
        '.ad-container',
        '.ad-slot',
        '.ad-unit',
        '[id*="advert"]:not(.media-details, .header, .preview-section, .video-page)',
        '[class*="advert"]:not(.media-details, .header, .preview-section, .video-page)',
        '.sponsored',
        '.promoted',
        '[data-ad-slot]',
        '[data-ad-client]',
        '[data-ad-format]',
        'ins.adsbygoogle',
        'div[id*="div-gpt-ad"]',
        'div[class*="ad_"]',
        'iframe:not([id="videoFrame"]):not([src*="vidfast.pro"]):not([src*="111movies.com"]):not([src*="vidsrc.cc"]):not([src*="vidsrc.vip"]):not([src*="2embed.cc"])',
        'script[src*="ads"]:not([src*="streamzy"])',
        'script[src*="advert"]',
        '.doubleclick',
        '[id*="popunder"]',
        '[class*="popunder"]',
        '[id*="popup"]',
        '[class*="popup"]',
        '[id*="redirect"]:not(.media-details, .header, .preview-section, .video-page)',
        '[class*="redirect"]:not(.media-details, .header, .preview-section, .video-page)',
        'a[href*="doubleclick.net"]',
        'a[href*="adnxs.com"]',
        'a[href*="popads.net"]',
        'script[src*="popads"]',
        'script[src*="ad"]',
        '[style*="display: none"][style*="position: absolute"]', // Hidden ad layers
        '.ad-overlay',
        '.ad-frame'
    ];

    // Block ad and redirect elements
    function blockAds() {
        try {
            const elements = document.querySelectorAll(blockSelectors.join(','));
            elements.forEach((el) => {
                el.style.display = 'none';
                el.remove(); // Remove from DOM
                console.debug('Blocked element:', el.tagName, el.id || el.className);
            });
        } catch (e) {
            console.warn('Error blocking elements:', e);
        }
    }

    // Block ad and redirect resources (scripts, iframes, images, etc.)
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
        const element = originalCreateElement.call(document, tagName);
        const tagLower = tagName.toLowerCase();
        if (['script', 'iframe', 'img', 'link', 'object', 'embed'].includes(tagLower)) {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function (name, value) {
                if (name === 'src' && typeof value === 'string') {
                    const isAllowed = allowDomains.some(domain => value.includes(domain));
                    const isBlocked = !isAllowed && (
                        blockDomains.some(domain => value.includes(domain)) ||
                        /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(value)
                    );
                    if (isBlocked) {
                        console.debug('Blocked resource:', tagLower, value);
                        return;
                    }
                }
                originalSetAttribute.call(element, name, value);
            };

            // Block dynamic src changes
            Object.defineProperty(element, 'src', {
                set(value) {
                    if (typeof value === 'string') {
                        const isAllowed = allowDomains.some(domain => value.includes(domain));
                        const isBlocked = !isAllowed && (
                            blockDomains.some(domain => value.includes(domain)) ||
                            /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(value)
                        );
                        if (isBlocked) {
                            console.debug('Blocked dynamic src:', tagLower, value);
                            return;
                        }
                    }
                    this.setAttribute('src', value);
                }
            });
        }
        return element;
    };

    // Block window.open attempts (pop-ups/redirects)
    const originalOpen = window.open;
    window.open = function (url) {
        if (url && typeof url === 'string') {
            const isBlocked = blockDomains.some(domain => url.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(url);
            if (isBlocked) {
                console.debug('Blocked window.open:', url);
                return null;
            }
        }
        return originalOpen.apply(window, arguments);
    };

    // Block click-based redirects and clickjacking
    function blockRedirects(e) {
        let target = e.target;
        while (target && target.tagName !== 'A' && target !== document.body) {
            target = target.parentElement;
        }
        if (target && target.tagName === 'A' && target.href) {
            const href = target.href;
            const isBlocked = blockDomains.some(domain => href.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(href);
            if (isBlocked) {
                e.preventDefault();
                e.stopPropagation();
                console.debug('Blocked redirect:', href);
                return;
            }
        }

        // Block clickjacking (hidden overlay clicks)
        const computedStyle = window.getComputedStyle(e.target);
        if (computedStyle.opacity === '0' || computedStyle.visibility === 'hidden') {
            e.preventDefault();
            e.stopPropagation();
            console.debug('Blocked potential clickjacking on hidden element:', e.target);
        }
    }

    // Block inline scripts containing ad-related keywords
    function blockInlineScripts() {
        try {
            const scripts = document.getElementsByTagName('script');
            Array.from(scripts).forEach(script => {
                if (!script.src && script.textContent) {
                    const content = script.textContent.toLowerCase();
                    if (/adsbygoogle|doubleclick|popads|adnxs|googletag|adframe|adserver|sponsor|banner/i.test(content)) {
                        script.textContent = '';
                        script.remove();
                        console.debug('Blocked inline ad script');
                    }
                }
            });
        } catch (e) {
            console.warn('Error blocking inline scripts:', e);
        }
    }

    // Block XHR/fetch requests to ad domains
    const originalFetch = window.fetch;
    window.fetch = function (url, options) {
        if (url && typeof url === 'string') {
            const isBlocked = blockDomains.some(domain => url.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(url);
            if (isBlocked) {
                console.debug('Blocked fetch:', url);
                return Promise.reject(new Error('Blocked ad request'));
            }
        }
        return originalFetch.apply(window, arguments);
    };

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (url && typeof url === 'string') {
            const isBlocked = blockDomains.some(domain => url.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(url);
            if (isBlocked) {
                console.debug('Blocked XHR:', url);
                return;
            }
        }
        return originalXhrOpen.apply(this, arguments);
    };

    // Block CSS-based ads (e.g., background images)
    function blockCssAds() {
        try {
            const elements = document.querySelectorAll('[style*="url("]');
            elements.forEach(el => {
                const style = el.getAttribute('style').toLowerCase();
                if (blockDomains.some(domain => style.includes(domain)) ||
                    /ads|advert|doubleclick|popunder|popup|popads|adframe|adserver|sponsor|banner/i.test(style)) {
                    el.style.display = 'none';
                    el.remove();
                    console.debug('Blocked CSS ad:', el);
                }
            });
        } catch (e) {
            console.warn('Error blocking CSS ads:', e);
        }
    }

    // Throttled MutationObserver to monitor DOM changes
    let mutationTimeout;
    function observeDOM() {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            blockAds();
            blockInlineScripts();
            blockCssAds();
        }, 50); // Reduced to 50ms for faster response
    }

    // Initialize blocking
    function init() {
        // Run initial blocking
        blockAds();
        blockInlineScripts();
        blockCssAds();

        // Add event listeners
        document.addEventListener('click', blockRedirects, { capture: true });
        document.addEventListener('auxclick', blockRedirects, { capture: true }); // Middle-click
        document.addEventListener('contextmenu', blockRedirects, { capture: true }); // Right-click

        // Observe DOM changes
        const observer = new MutationObserver(observeDOM);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'href', 'style']
        });

        // Clean up on unload
        window.addEventListener('unload', () => {
            observer.disconnect();
            document.removeEventListener('click', blockRedirects, { capture: true });
            document.removeEventListener('auxclick', blockRedirects, { capture: true });
            document.removeEventListener('contextmenu', blockRedirects, { capture: true });
        });

        console.debug('Adblock initialized');
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
