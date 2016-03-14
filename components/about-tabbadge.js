/* globals Components, Services, XPCOMUtils */
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

function TabBadgeAboutHandler() {
}

TabBadgeAboutHandler.prototype = {
	newChannel: function(uri, loadInfo) {
		if (uri.spec != 'about:tabbadge')
			return;

		let newURI = Services.io.newURI('chrome://tabbadge/content/about-tabbadge.xhtml', null, null);
		let channel = Services.io.newChannelFromURIWithLoadInfo(newURI, loadInfo);
		channel.originalURI = uri;
		return channel;
	},
	getURIFlags: function() {
		return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
	},
	classDescription: 'About Tab Badge Page',
	classID: Components.ID('ce098b5e-3bdb-4fb7-8db2-7335b39eb1d3'),
	contractID: '@mozilla.org/network/protocol/about;1?what=tabbadge',
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([TabBadgeAboutHandler]);
