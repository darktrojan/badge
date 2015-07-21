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

let backcolorRule, forecolorRule;
for (let r of document.styleSheets[0].cssRules) {
	if (r.selectorText == '.background') {
		backcolorRule = r;
	} else if (r.selectorText == '.foreground') {
		forecolorRule = r;
	}
}
document.getElementById('backcolor').value = backcolorRule.style.fill = prefs.getCharPref('backcolor');
document.getElementById('forecolor').value = forecolorRule.style.fill = prefs.getCharPref('forecolor');

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

setTimeout(function() {
	document.documentElement.dataset.complete = true;
}, 50);

function getU(element) {
	if (element.localName != 'use') {
		element = element.querySelector('use');
	}
	return element.getAttributeNS(XLINKNS, 'href').replace('chrome://tabbadge/content/icons.svg', '');
}

function setU(element, id) {
	if (element.localName != 'use') {
		element = element.querySelector('use');
	}
	element.setAttributeNS(XLINKNS, 'href', 'chrome://tabbadge/content/icons.svg' + id);
}

function select(which) {
	for (let w of [animated_check, unanimated_check, icon_check]) {
		setU(w, w == which ? '#full' : '#empty');
	}

	if (which == icon_check) {
		prefs.setIntPref('style', 2);
	} else {
		prefs.setIntPref('style', 1);
		prefs.setBoolPref('animating', which == animated_check);
	}
}

function setcolour(which) {
	let rule = window[which.id + 'Rule'];
	rule.style.fill = which.value;

	prefs.setCharPref(which.id, which.value);
}

function selectmode(which) {
	let parent = which.parentNode;
	let other;
	if (which.dataset.mode == 1) {
		other = document.querySelector('[data-mode="2"]');
	} else {
		other = document.querySelector('[data-mode="1"]');
	}

	setU(which, '#full');
	which.nextElementSibling.style.height = which.nextElementSibling.scrollHeight + 'px';
	setU(other, '#empty');
	other.nextElementSibling.style.height = null;

	prefs.setIntPref('mode', parseInt(which.dataset.mode, 10));
}

function showhide(which) {
	let list = which.parentNode.parentNode;
	let listName = list.dataset.list;

	if (getU(which) == '#empty') {
		setU(which, '#' + listName + 'ed');
		which.parentNode.style.color = null;
	} else {
		setU(which, '#empty');
		which.parentNode.style.color = '#484537';
	}

	let domains = [];
	for (let i of list.children) {
		if (i == list.lastElementChild) {
			break;
		}
		if (getU(i) != '#empty') {
			domains.push(i.textContent.trim());
		}
	}

	prefs.setCharPref(listName, domains.join(' '));
}

function add(which) {
	let list = which.parentNode.parentNode;
	let listName = list.dataset.list;

	let newDomain = prompt('foo');
	if (newDomain) {
		let listitem = template.content.cloneNode(true).firstElementChild;
		listitem.querySelector('span').textContent = newDomain;
		list.insertBefore(listitem, list.lastElementChild);
		list.style.height = list.scrollHeight + 'px';

		showhide(listitem.querySelector('svg'));
	}
}
