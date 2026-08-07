(function () {
  var typeSelect = document.getElementById('typeSelect');
  var subFilters = document.querySelectorAll('.sub-filter');
  if (!typeSelect || subFilters.length === 0) return;

  function toggle() {
    subFilters.forEach(function (el) {
      el.style.display = el.getAttribute('data-for') === typeSelect.value ? '' : 'none';
    });
  }

  typeSelect.addEventListener('change', toggle);
  toggle();
})();
