// public/assets/adblock.js
(function () {
  // Basic ad-blocking selectors (inspired by EasyList patterns)
  const adSelectors = [
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
  ];

  // Hide ad elements
  function blockAds() {
    const elements = document.querySelectorAll(adSelectors.join(','));
    elements.forEach((el) => {
      el.style.display = 'none';
      el.remove(); // Remove from DOM for performance
    });
  }

  // Block ad scripts by intercepting script loads
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName) {
    const element = originalCreateElement.call(document, tagName);
    if (tagName.toLowerCase() === 'script') {
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function (name, value) {
        if (name === 'src' && /ads|advert|doubleclick|popunder/i.test(value)) {
          console.log('Blocked ad script:', value);
          return;
        }
        originalSetAttribute.call(element, name, value);
      };
    }
    return element;
  };

  // Run ad blocker on DOM load and observe changes
  document.addEventListener('DOMContentLoaded', blockAds);
  const observer = new MutationObserver(blockAds);
  observer.observe(document.body, { childList: true, subtree: true });

  // Clean up on page unload
  window.addEventListener('unload', () => {
    observer.disconnect();
  });
})();
