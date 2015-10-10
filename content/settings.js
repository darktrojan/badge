Components.utils.import('resource://gre/modules/Services.jsm');

const XLINKNS = document.lookupNamespaceURI('xlink');

let prefs = Services.prefs.getBranch('extensions.tabbadge.');

let appearance = document.getElementById('appearance');

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
for (let l of ['blacklist', 'whitelist']) if (prefs.prefHasUserValue(l)) {
	let list = document.querySelector('[data-list="' + l + '"]');
	for (let d of prefs.getCharPref(l).split(/\s+/)) if (d) {
		let listitem = template.content.cloneNode(true);
		setU(listitem, '#' + l + 'ed');
		listitem.querySelector('span').textContent = d;
		list.insertBefore(listitem, list.lastElementChild);
	}
}

selectmode(document.querySelector('[data-mode="' + prefs.getIntPref('mode') + '"]'));

let animated = document.getElementById('animated');
let unanimated = document.getElementById('unanimated');
let icon = document.getElementById('icon');
let over = false;
let running = false;
let animationtimer = document.getElementById('animationtimer');
let badgevalue = 3;

animationtimer.addEventListener('animationend', function() {
	animated.classList.add('playing');

	badgevalue = (badgevalue + 1) % 4;
	for (let c of [animated, unanimated, icon]) {
		c.querySelector('g > text').textContent = (badgevalue ? '[' + badgevalue + '] ' : '') + 'Tab Title';
		if (c == icon) {
			for (let i of c.querySelectorAll('g > g')) {
				i.style.display = (i.id == 'icon' + badgevalue) ? null : 'none';
			}
		} else {
			c.querySelector('g > g').style.display = badgevalue ? null : 'none';
			c.querySelector('g > g > text').textContent = badgevalue;
		}
	}

	if (over) {
		if (animationtimer.style.animationName == 'timer2') {
			animationtimer.style.animationName = 'timer1';
		} else {
			animationtimer.style.animationName = 'timer2';
		}
	} else {
		running = false;
	}
});
appearance.addEventListener('mouseenter', function() {
	if (over) {
		return;
	}

	over = true;
	if (!running) {
		running = true;
		if (animationtimer.style.animationName == 'timer1') {
			animationtimer.style.animationName = 'timer2';
		} else {
			animationtimer.style.animationName = 'timer1';
		}
	}
});
appearance.addEventListener('mouseleave', function() {
	over = false;
});
animated.addEventListener('animationend', function() {
	this.classList.remove('playing');
});

let effects = new Map();
for (let l of ['alertlist', 'shakelist', 'soundlist']) if (prefs.prefHasUserValue(l)) {
	for (let d of prefs.getCharPref(l).split(/\s+/)) if (d) {
		let effectList = effects.get(d) || [];
		effectList.push(l);
		effects.set(d, effectList);
	}
}

let template2 = document.getElementById('listitem2');
for (let [k, v] of effects) {
	let list = document.querySelector('#effects > ul');
	let listitem = template2.content.cloneNode(true);
	let icons = listitem.querySelectorAll('use');
	if (v.indexOf('alertlist') >= 0) {
		setU(icons[0], '#alertlisted');
	}
	if (v.indexOf('shakelist') >= 0) {
		setU(icons[1], '#shakelisted');
	}
	if (v.indexOf('soundlist') >= 0) {
		setU(icons[2], '#soundlisted');
	}
	listitem.querySelector('span').textContent = k;
	list.insertBefore(listitem, list.lastElementChild);
	console.log(k, v);
}

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

function showhideeffect(which) {
	let svg = which.parentNode;
	let listitem = svg.parentNode;
	let list = listitem.parentNode;
	let listName = which.getAttribute('data-list'); // SVG elements don't have a dataset

	if (getU(which) == '#empty') {
		setU(which, '#' + listName + 'ed');
	} else {
		setU(which, '#empty');
	}

	if (Array.some(svg.querySelectorAll('use'), u => getU(u) != '#empty')) {
		listitem.style.color = null;
	} else {
		listitem.style.color = '#484537';
	}

	let domains = [];
	for (let i of list.children) {
		if (i == list.lastElementChild) {
			break;
		}
		if (getU(i.querySelector('use[data-list="' + listName + '"]')) != '#empty') {
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

function addeffect(which) {
	let list = which.parentNode.parentNode;

	let newDomain = prompt('foo');
	if (newDomain) {
		let listitem = template2.content.cloneNode(true).firstElementChild;
		listitem.querySelector('span').textContent = newDomain;
		list.insertBefore(listitem, list.lastElementChild);
		list.style.height = list.scrollHeight + 'px';
	}
}
