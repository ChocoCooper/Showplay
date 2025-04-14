// public/assets/adblock.js
(function () {
  // Ad and redirect-blocking selectors (inspired by EasyList and anti-redirect patterns)
  const blockSelectors = [
    '[id*="ad-"]',
    '[class*="ad-"]',
    '.banner-ad',
    '.adsbygoogle',
    '[id*="advert"]',
    '[class*="advert"]',
    '.sponsored',
    '[data-ad-slot]',
    'iframe[src*="ads"]',
    'script[src*="ads"]',
    '.doubleclick',
    '[id*="popunder"]',
    '[class*="popunder"]',
    '[id*="redirect"]',
    '[class*="redirect"]',
    'a[href*="doubleclick.net"]',
    'a[href*="adnxs.com"]',
    'script[src*="redirect"]',
    'script[src*="popads"]',
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
  ];

  // Hide ad and redirect elements
  function blockAds() {
    const elements = document.querySelectorAll(blockSelectors.join(','));
    elements.forEach((el) => {
      el.style.display = 'none';
      el.remove(); // Remove from DOM for performance
    });
  }

  // Block ad and redirect scripts
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName) {
    const element = originalCreateElement.call(document, tagName);
    if (tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'iframe') {
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function (name, value) {
        if (name === 'src') {
          const isBlocked = blockDomains.some(domain => value.includes(domain)) ||
                           /ads|advert|doubleclick|popunder|redirect|popads/i.test(value);
          if (isBlocked) {
            console.log('Blocked resource:', value);
            return;
          }
        }
        originalSetAttribute.call(element, name, value);
      };
    }
    return element;
  };

  // Block window.open attempts (common for pop-ups/redirects)
  const originalOpen = window.open;
  window.open = function (url) {
    if (url && blockDomains.some(domain => url.includes(domain))) {
      console.log('Blocked window.open:', url);
      return null;
    }
    return originalOpen.apply(window, arguments);
  };

  // Run blocker on DOM load and observe changes
  document.addEventListener('DOMContentLoaded', blockAds);
  const observer = new MutationObserver(blockAds);
  observer.observe(document.body, { childList: true, subtree: true });

  // Clean up on page unload
  window.addEventListener('unload', () => {
    observer.disconnect();
  });
})();
