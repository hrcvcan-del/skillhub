(function () {
  var roleSelect = document.getElementById('roleSelect');
  var field = document.getElementById('trainingPartnerField');
  if (!roleSelect || !field) return;
  function toggle() {
    field.style.display = roleSelect.value === 'training_partner' ? '' : 'none';
  }
  roleSelect.addEventListener('change', toggle);
  toggle();
})();
