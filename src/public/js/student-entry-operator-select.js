document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.student-entry-operator-select').forEach(function (select) {
    select.addEventListener('change', function () {
      select.closest('form').requestSubmit();
    });
  });
});
