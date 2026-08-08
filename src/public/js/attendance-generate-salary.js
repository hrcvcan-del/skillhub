document.addEventListener('DOMContentLoaded', function () {
  var selectAll = document.getElementById('selectAll');
  if (!selectAll) return;

  var checkboxes = Array.prototype.slice.call(document.querySelectorAll('.trainer-checkbox:not(:disabled)'));

  selectAll.addEventListener('change', function () {
    checkboxes.forEach(function (cb) {
      cb.checked = selectAll.checked;
    });
  });
});
