/* ===== HTML Slide Navigation System ===== */
(function() {
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  let current = 0;
  let isOverview = false;

  const currentEl = document.getElementById('current');
  const totalEl = document.getElementById('total');
  const progressEl = document.getElementById('progress');

  if (totalEl) totalEl.textContent = total;

  function goTo(index) {
    if (index < 0 || index >= total) return;
    slides[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    if (currentEl) currentEl.textContent = current + 1;
    if (progressEl) progressEl.style.width = ((current + 1) / total * 100) + '%';
    history.replaceState(null, '', '#' + (current + 1));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (isOverview && e.key === 'Escape') { toggleOverview(); return; }
    switch(e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': goTo(0); break;
      case 'End': goTo(total - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'o': case 'O': toggleOverview(); break;
      case 'g': case 'G':
        var n = prompt('Go to slide:');
        if (n) goTo(parseInt(n) - 1);
        break;
      default:
        if (e.key >= '1' && e.key <= '9') goTo(parseInt(e.key) - 1);
    }
  });

  // Touch
  var touchStartX = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
  });
  document.addEventListener('touchend', function(e) {
    var diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
  });

  // Mouse wheel
  var wheelCooldown = false;
  document.addEventListener('wheel', function(e) {
    if (wheelCooldown) return;
    wheelCooldown = true;
    setTimeout(function() { wheelCooldown = false; }, 500);
    e.deltaY > 0 ? next() : prev();
  });

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Overview
  function toggleOverview() {
    isOverview = !isOverview;
    document.querySelector('.slides-container').classList.toggle('overview');
  }

  // Scaling
  function updateScale() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var slideW = 1920;
    var slideH = 1080;
    var scale = Math.min(vw / slideW, vh / slideH);
    var offsetX = (vw - slideW * scale) / 2;
    var offsetY = (vh - slideH * scale) / 2;
    slides.forEach(function(s) {
      s.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
    });
  }

  // Init
  window.addEventListener('load', function() {
    var hash = parseInt(location.hash.slice(1));
    goTo(isNaN(hash) ? 0 : hash - 1);
    updateScale();
  });
  window.addEventListener('resize', updateScale);

  // Global
  window.prevSlide = prev;
  window.nextSlide = next;
  window.toggleFullscreen = toggleFullscreen;
  window.goToSlide = goTo;
})();
