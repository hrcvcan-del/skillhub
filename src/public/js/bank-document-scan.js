document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.bank-scan-widget').forEach(function (widget) {
    var fileInput = widget.querySelector('.bank-scan-file');
    var button = widget.querySelector('.bank-scan-button');
    var status = widget.querySelector('.bank-scan-status');
    var form = widget.closest('form');
    if (!fileInput || !button || !status || !form) return;

    var csrfInput = form.querySelector('input[name="_csrf"]');

    function setField(fieldName, value) {
      if (!fieldName || !value) return false;
      var el = form.querySelector('[name="' + fieldName + '"]');
      if (!el) return false;
      el.value = value;
      return true;
    }

    button.addEventListener('click', function () {
      var file = fileInput.files[0];
      if (!file) {
        status.textContent = 'Choose a photo first.';
        return;
      }

      var body = new FormData();
      body.append('photo', file);

      button.disabled = true;
      status.textContent = 'Reading photo… this can take a few seconds.';

      var url = '/utils/scan-bank-document' + (csrfInput ? '?_csrf=' + encodeURIComponent(csrfInput.value) : '');

      fetch(url, { method: 'POST', body: body })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          button.disabled = false;
          if (!result.ok) {
            status.textContent = result.data.error || 'Could not read this photo.';
            return;
          }

          var data = result.data;
          var filled = [];
          if (setField(widget.dataset.targetName, data.name)) filled.push('name');
          if (setField(widget.dataset.targetAccount, data.accountNumber)) filled.push('account number');
          if (setField(widget.dataset.targetIfsc, data.ifscCode)) filled.push('IFSC');
          if (setField(widget.dataset.targetBank, data.bankName)) filled.push('bank name');

          status.textContent = filled.length > 0
            ? 'Filled in: ' + filled.join(', ') + '. Please double-check before saving.'
            : "Couldn't confidently read any fields from that photo — try a clearer shot, or enter the details manually.";
        })
        .catch(function () {
          button.disabled = false;
          status.textContent = 'Scan failed — check your connection and try again.';
        });
    });
  });
});
