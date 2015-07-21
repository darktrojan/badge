Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function TabBadgeAboutHandler() {
}

TabBadgeAboutHandler.prototype = {
	newChannel: function(aURI) {
		if (aURI.spec != "about:tabbadge")
			return;

		let channel = Services.io.newChannel("chrome://tabbadge/content/settings.xhtml", null, null);
		channel.originalURI = aURI;
		return channel;
	},
	getURIFlags: function(aURI) {
		return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
	},
	classDescription: "About Tab Badge Page",
	classID: Components.ID("ce098b5e-3bdb-4fb7-8db2-7335b39eb1d3"),
	contractID: "@mozilla.org/network/protocol/about;1?what=tabbadge",
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule])
};

let NSGetFactory = XPCOMUtils.generateNSGetFactory([TabBadgeAboutHandler]);
