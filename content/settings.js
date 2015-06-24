Components.utils.import("resource://gre/modules/Services.jsm");

const lists = ["black", "white", "alert", "shake"];

for (let e of document.querySelectorAll("[id]")) {
	this[e.id] = e;
}

let prefs = Services.prefs.getBranch("extensions.tabbadge.");

for (let l of lists) {
	for (let d of getArrayPref(l + "list")) {
		let item = document.createElement("listitem");
		item.classList.add(l + "listed");
		let siteCell = document.createElement("listcell");
		siteCell.setAttribute("label", d);
		item.appendChild(siteCell);
		let widthCell = document.createElement("listcell");
		widthCell.setAttribute("label", l + "listed");
		widthCell.setAttribute("style", "text-align: center");
		item.appendChild(widthCell);
		domainsList.appendChild(item);
	}
}

function getArrayPref(name) {
	let arr = [];
	if (prefs.prefHasUserValue(name)) {
		arr = prefs.getCharPref(name).split(/\s+/);
		for (let i = 0; i < arr.length; i++) {
			if (!arr[i]) {
				arr.splice(i, 1);
				i--;
			}
		}
	}
	return arr;
}

function selectionChanged() {
	removeSelectedButton.disabled = domainsList.selectedItems.length === 0;
}

function removeSelected() {
	for (let i of domainsList.selectedItems) {
		i.remove();
	}

	saveLists();

	removeSelectedButton.blur();
}

function saveLists() {
	let newList = [];
	for (let l of lists) {
		for (let i = 0; i < domainsList.itemCount; i++) {
			let item = domainsList.getItemAtIndex(i);
			if (item.classList.contains(l + "listed")) {
				newList.push(item.firstElementChild.getAttribute("label"));
			}
		}
		prefs.setCharPref(l + "list", newList.join(" "));
	}
}
