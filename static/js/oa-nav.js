/* ──────────────────────────────────────────────────────────────
 *  Navigation highlight
 *
 *  Both dashboards mark the current item with an `.on` class, but they
 *  do it from different code (admin: switchTab, intern: goTab). Rather
 *  than hook either one, this watches for the class itself and slides a
 *  single highlight to whatever is active. Nothing here needs to know
 *  what a tab is, so neither page's logic had to change.
 * ────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /**
   * Keeps one indicator element in step with the `.on` child of a container.
   *
   * @param {Element} container  the nav or tab strip
   * @param {string}  itemSel    selector for the items
   * @param {string}  indClass   class for the indicator element
   * @param {string}  axis       'y' for a vertical rail, 'x' for a tab strip
   */
  function follow(container, itemSel, indClass, axis) {
    if (!container || container.querySelector('.' + indClass)) return;

    var ind = document.createElement('span');
    ind.className = indClass + ' no-anim';
    ind.setAttribute('aria-hidden', 'true');
    container.appendChild(ind);

    var raf = 0;

    function place(animate) {
      var active = container.querySelector(itemSel + '.on');

      // Nothing selected, or it's hidden (the Shifts item starts hidden).
      if (!active || !active.offsetParent) {
        ind.classList.remove('is-on');
        return;
      }
      if (!animate) ind.classList.add('no-anim');

      if (axis === 'y') {
        ind.style.transform = 'translate3d(0,' + active.offsetTop + 'px,0)';
        ind.style.height = active.offsetHeight + 'px';
      } else {
        ind.style.transform = 'translate3d(' + active.offsetLeft + 'px,0,0)';
        ind.style.width = active.offsetWidth + 'px';
      }
      ind.classList.add('is-on');

      // Mark it for assistive tech too, now that we know which one it is.
      Array.prototype.forEach.call(container.querySelectorAll(itemSel), function (el) {
        if (el === active) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      });

      if (!animate) {
        // Drop the no-anim guard once the browser has taken this position,
        // so the *next* move animates instead of jumping.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { ind.classList.remove('no-anim'); });
        });
      }
    }

    function schedule(animate) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { place(animate); });
    }

    // React to the `.on` class landing on a different item.
    new MutationObserver(function () { schedule(!reduceMotion); })
      .observe(container, { attributes: true, attributeFilter: ['class', 'style'], subtree: true });

    window.addEventListener('resize', function () { schedule(false); });
    if (container.scrollWidth > container.clientWidth) {
      container.addEventListener('scroll', function () { schedule(false); }, { passive: true });
    }

    // Web fonts and icon fonts change item heights after first paint.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { schedule(false); });
    }

    place(false);
  }

  function init() {
    follow(document.querySelector('.oa-rail-nav'), '.oa-navitem', 'oa-nav-highlight', 'y');

    var strip = document.querySelector('.ad-tabs');
    if (strip) {
      strip.classList.remove('no-js-underline');
      follow(strip, '.ad-tab', 'ad-tab-underline', 'x');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
