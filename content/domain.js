let values = window.arguments[0] || {};
let domain = document.getElementById('domain');
let acceptButton = document.documentElement.getButton('accept');
acceptButton.disabled = true;

domain.oninput = function() {
	acceptButton.disabled = !domain.value;
};

/* exported dialogAccept */
function dialogAccept() {
	values.cancelled = false;
	values.domain = domain.value;
}
