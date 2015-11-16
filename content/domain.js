let values = window.arguments[0] || {};
let domain = document.getElementById('domain');
let alertlist = document.getElementById('alertlist');
let shakelist = document.getElementById('shakelist');
let soundlist = document.getElementById('soundlist');
if (!values.effects) {
	alertlist.hidden = shakelist.hidden = soundlist.hidden = true;
}
let acceptButton = document.documentElement.getButton('accept');
acceptButton.disabled = true;

domain.oninput = function() {
	acceptButton.disabled = !domain.value;
};

/* exported dialogAccept */
function dialogAccept() {
	values.cancelled = false;
	values.domain = domain.value;
	if (values.effects) {
		values.alertlist = alertlist.checked;
		values.shakelist = shakelist.checked;
		values.soundlist = soundlist.checked;
	}
}
