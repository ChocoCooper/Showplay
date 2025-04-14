(function () {
    // Trusted domains for video embeds (allowlist)
    const allowDomains = [
        'vidfast.pro',
        '111movies.com',
        'vidsrc.cc',
        'vidsrc.vip',
        '2embed.cc'
    ];

    // Known ad/tracker/redirect domains to block
    const blockDomains = [
        'doubleclick.net',
        'adnxs.com',
        'popads.net',
        'adservice.google.com',
        'pagead2.googlesyndication.com',
        'tpc.googlesyndication.com',
        'googletagservices.com',
        'adsafeprotected.com',
        'servedby.flashtalking.com',
        'pixel.quantserve.com',
        'ads.pubmatic.com',
        'adroll.com',
        'outbrain.com',
        'taboola.com',
        'criteo.com'
    ];

    // Ad and redirect-blocking selectors (inspired by EasyList)
    const blockSelectors = [
        '[id*="ad-"]:not(.media-details)', // Avoid false positives on legitimate classes
        '[class*="ad-"]:not(.media-details)',
        '.banner-ad',
        '.adsbygoogle',
        '[id*="advert"]:not(.media-details)',
        '[class*="advert"]:not(.media-details)',
        '.sponsored',
        '[data-ad-slot]',
        'iframe[src*="ads"]:not([src*="vidfast.pro"]):not([src*="111movies.com"]):not([src*="vidsrc.cc"]):not([src*="vidsrc.vip"]):not([src*="2embed.cc"])',
        'script[src*="ads"]',
        '.doubleclick',
        '[id*="popunder"]',
        '[class*="popunder"]',
        '[id*="redirect"]:not(.media-details)',
        '[class*="redirect"]:not(.media-details)',
        'a[href*="doubleclick.net"]',
        'a[href*="adnxs.com"]',
        'script[src*="popads"]'
    ];

    // Block ad and redirect elements
    function blockAds() {
        const elements = document.querySelectorAll(blockSelectors.join(','));
        elements.forEach((el) => {
            try {
                el.style.display = 'none';
                el.remove(); // Remove from DOM for efficiency
            } catch (e) {
                console.warn('Error removing element:', e);
            }
        });
    }

    // Block ad and redirect resources (scripts, iframes, images)
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
        const element = originalCreateElement.call(document, tagName);
        const tagLower = tagName.toLowerCase();
        if (tagLower === 'script' || tagLower === 'iframe' || tagLower === 'img') {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function (name, value) {
                if (name === 'src' && typeof value === 'string') {
                    // Check if the resource is from an allowed domain
                    const isAllowed = allowDomains.some(domain => value.includes(domain));
                    // Check if the resource matches blocked domains or patterns
                    const isBlocked = !isAllowed && (
                        blockDomains.some(domain => value.includes(domain)) ||
                        /ads|advert|doubleclick|popunder|popads/i.test(value)
                    );
                    if (isBlocked) {
                        // Prevent loading of blocked resources
                        console.log('Blocked resource:', value);
                        return;
                    }
                }
                originalSetAttribute.call(element, name, value);
            };
        }
        return element;
    };

    // Block window.open attempts (pop-ups/redirects)
    const originalOpen = window.open;
    window.open = function (url) {
        if (url && typeof url === 'string') {
            const isBlocked = blockDomains.some(domain => url.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popads/i.test(url);
            if (isBlocked) {
                console.log('Blocked window.open:', url);
                return null;
            }
        }
        return originalOpen.apply(window, arguments);
    };

    // Block click-based redirects
    function blockRedirects(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
            const href = target.href;
            const isBlocked = blockDomains.some(domain => href.includes(domain)) ||
                             /ads|advert|doubleclick|popunder|popads/i.test(href);
            if (isBlocked) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Blocked redirect:', href);
            }
        }
    }

    // Block inline scripts containing ad-related keywords
    function blockInlineScripts() {
        const scripts = document.getElementsByTagName('script');
        Array.from(scripts).forEach(script => {
            if (!script.src && script.textContent) {
                const content = script.textContent.toLowerCase();
                if (/adsbygoogle|doubleclick|popads|adnxs/i.test(content)) {
                    try {
                        script.textContent = '';
                        script.remove();
                        console.log('Blocked inline ad script');
                    } catch (e) {
                        console.warn('Error removing inline script:', e);
                    }
                }
            }
        });
    }

    // Throttled MutationObserver to monitor DOM changes
    let mutationTimeout;
    function observeDOM() {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            blockAds();
            blockInlineScripts();
        }, 100);
    }

    // Initialize blocking
    function init() {
        // Run initial blocking
        blockAds();
        blockInlineScripts();

        // Add event listener for click-based redirects
        document.addEventListener('click', blockRedirects, true);

        // Observe DOM changes
        const observer = new MutationObserver(observeDOM);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Clean up on unload
        window.addEventListener('unload', () => {
            observer.disconnect();
            document.removeEventListener('click', blockRedirects, true);
        });
    }

    // Run initialization after DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
