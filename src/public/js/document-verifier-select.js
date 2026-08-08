document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.document-verifier-select').forEach(function (select) {
    select.addEventListener('change', function () {
      select.closest('form').requestSubmit();
    });
  });
});
