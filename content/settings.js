Components.utils.import('resource://gre/modules/Services.jsm');

const XLINKNS = document.lookupNamespaceURI('xlink');

let prefs = Services.prefs.getBranch('extensions.tabbadge.');

let animated_check = document.getElementById('animated_check');
let unanimated_check = document.getElementById('unanimated_check');
let icon_check = document.getElementById('icon_check');
if (prefs.getIntPref('style') == 1) {
	if (prefs.getBoolPref('animating')) {
		select(animated_check);
	} else {
		select(unanimated_check);
	}
} else {
	select(icon_check);
}

let backgroundRule, foregroundRule;
for (let r of document.styleSheets[0].cssRules) {
	if (r.selectorText == '.background') {
		backgroundRule = r;
	} else if (r.selectorText == '.foreground') {
		foregroundRule = r;
	}
}
document.getElementById('backcolor').value = backgroundRule.style.fill = prefs.getCharPref('backcolor');
document.getElementById('forecolor').value = foregroundRule.style.fill = prefs.getCharPref('forecolor');

let template = document.getElementById('listitem');
for (let l of ['blacklist', 'whitelist', 'shakelist']) {
	if (!prefs.prefHasUserValue(l)) {
		continue;
	}

	let list = document.querySelector('[data-list="' + l + '"]');
	for (let d of prefs.getCharPref(l).split(/\s+/)) {
		if (d) {
			let listitem = template.content.cloneNode(true);
			setU(listitem, '#' + l + 'ed');
			listitem.querySelector('span').textContent = d;
			list.insertBefore(listitem, list.lastElementChild);
		}
	}
}

selectmode(document.querySelector('[data-mode="' + prefs.getIntPref('mode') + '"]'));

// let animated = document.getElementById('animated');
// let unanimated = document.getElementById('unanimated');
// let icon = document.getElementById('icon');
// let badgevalue = 3;

// animated.addEventListener('animationend', function() {
// 	this.classList.remove('playing');
// });
// let interval = setInterval(function() {
// 	animated.classList.add('playing');

// 	badgevalue = (badgevalue + 1) % 4;
// 	for (let c of [animated, unanimated, icon]) {
// 		c.querySelector('g > text').textContent = (badgevalue ? '[' + badgevalue + '] ' : '') + 'Tab Title';
// 		if (c == icon) {
// 			for (let i of c.querySelectorAll('g > g')) {
// 				i.style.display = (i.id == 'icon' + badgevalue) ? null : 'none';
// 			}
// 		} else {
// 			c.querySelector('g > g').style.display = badgevalue ? null : 'none';
// 			c.querySelector('g > g > text').textContent = badgevalue;
// 		}
// 	}
// }, 4000);

requestAnimationFrame(function() {
	document.documentElement.dataset.complete = true;
});

function u(id) {
	return 'chrome://tabbadge/content/icons.svg' + id;
}

function setU(element, id) {
	element.querySelector('use').setAttributeNS(XLINKNS, 'href', u(id));
}

function select(which) {
	for (let w of [animated_check, unanimated_check, icon_check]) {
		w.setAttributeNS(XLINKNS, 'href', w == which ? u('#full') : u('#empty'));
	}
}

function selectmode(which) {
	let parent = which.parentNode;
	let other;
	if (which == parent.firstElementChild) {
		other = parent.children[2];
	} else {
		other = parent.children[0];
	}

	which.querySelector('use').setAttributeNS(XLINKNS, 'href', u('#full'));
	which.nextElementSibling.style.height = which.nextElementSibling.scrollHeight + 'px';
	other.querySelector('use').setAttributeNS(XLINKNS, 'href', u('#empty'));
	other.nextElementSibling.style.height = null;
}

function showhide(which) {
	let list = which.parentNode.parentNode;
	let listName = list.dataset.list;
	let use = which.querySelector('use');

	if (use.getAttributeNS(XLINKNS, 'href') == u('#empty')) {
		use.setAttributeNS(XLINKNS, 'href', u('#' + listName + 'ed'));
		which.parentNode.style.color = null;
	} else {
		use.setAttributeNS(XLINKNS, 'href', u('#empty'));
		which.parentNode.style.color = '#484537';
	}

	let domains = [];
	for (let i of list.children) {
		if (i == list.lastElementChild) {
			break;
		}
		if (i.querySelector('use').getAttributeNS(XLINKNS, 'href') != u('#empty')) {
			domains.push(i.textContent.trim());
		}
	}
	console.log(listName, domains.join(' '));
}
