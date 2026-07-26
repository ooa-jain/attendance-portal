// Small helpers shared by the simpler pages.
// The dashboards load their own bundles from /static/js/.

function getLocation(callback) {
  if (!navigator.geolocation) {
    callback('This browser cannot report your location.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (position) { callback(null, position.coords.latitude, position.coords.longitude); },
    function (error)    { callback(error.message); },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Flash messages fade out on their own.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.oa-flash').forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity .4s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 400);
    }, 5000);
  });
});
