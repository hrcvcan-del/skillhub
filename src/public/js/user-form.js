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

(function () {
  var roleSelect = document.getElementById('roleSelect');
  var section = document.getElementById('payrollFields');
  if (!roleSelect || !section) return;
  var trackedRoles = ['data_entry_operator', 'center_coordinator'];
  function toggle() {
    section.style.display = trackedRoles.indexOf(roleSelect.value) !== -1 ? '' : 'none';
  }
  roleSelect.addEventListener('change', toggle);
  toggle();
})();
