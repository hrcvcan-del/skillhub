(function () {
  var form = document.getElementById('bulkForm');
  var selectAll = document.getElementById('selectAllCheckbox');
  var checkboxes = document.querySelectorAll('.txn-checkbox');
  var countBadge = document.getElementById('selectedCount');
  var assignBtn = document.getElementById('bulkAssignBtn');
  var deleteBtn = document.getElementById('bulkDeleteBtn');
  var targetSelect = document.getElementById('bulkTargetSelect');
  var subFilters = document.querySelectorAll('.bulk-sub-filter');
  if (!form || checkboxes.length === 0) return;

  function checkedCount() {
    var n = 0;
    checkboxes.forEach(function (cb) { if (cb.checked) n += 1; });
    return n;
  }

  function updateToolbar() {
    var n = checkedCount();
    countBadge.textContent = n + ' selected';
    deleteBtn.disabled = n === 0;
    assignBtn.disabled = n === 0 || !targetSelect.value;
  }

  function toggleSubFilters() {
    subFilters.forEach(function (el) {
      el.style.display = el.getAttribute('data-for') === targetSelect.value ? '' : 'none';
    });
    updateToolbar();
  }

  checkboxes.forEach(function (cb) {
    cb.addEventListener('change', updateToolbar);
  });

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      checkboxes.forEach(function (cb) { cb.checked = selectAll.checked; });
      updateToolbar();
    });
  }

  targetSelect.addEventListener('change', toggleSubFilters);

  form.addEventListener('submit', function (e) {
    var n = checkedCount();
    if (n === 0) {
      e.preventDefault();
      return;
    }
    var submitter = e.submitter;
    var isDelete = submitter && submitter.id === 'bulkDeleteBtn';
    if (isDelete) {
      if (!window.confirm('Delete ' + n + ' selected transaction(s)? This cannot be undone.')) {
        e.preventDefault();
      }
      return;
    }
    if (!targetSelect.value) {
      e.preventDefault();
      window.alert('Choose what to assign the selected transactions to.');
    }
  });

  toggleSubFilters();
})();
