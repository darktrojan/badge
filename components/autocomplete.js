Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PlacesUtils.jsm");

const nsIAutoCompleteResult = Components.interfaces.nsIAutoCompleteResult;

function HostsAutoCompleteResult(searchString, results) {
  this._searchString = searchString;
  this._results = results;
}
HostsAutoCompleteResult.prototype = {
  get searchString() {
    return this._searchString;
  },
  get searchResult() {
    return this.matchCount > 0 ? nsIAutoCompleteResult.RESULT_SUCCESS : nsIAutoCompleteResult.RESULT_NOMATCH;
  },
  get defaultIndex() {
    return 0;
  },
  get errorDescription() {
    return "";
  },
  get matchCount() {
    return this._results.length;
  },
  get typeAheadResult() {
    return false;
  },
  getValueAt: function(index) {
    return this._results[index];
  },
  getLabelAt: function(index) {
    return this.getValueAt(index);
  },
  getCommentAt: function(index) {
    return null;
  },
  getStyleAt: function(index) {
    return null;
  },
  getImageAt: function(index) {
    return null;
  },
  getFinalCompleteValueAt: function(index) {
    return this.getValueAt(index);
  },
  removeValueAt: function(index, removeFromDb) {
    this._results.splice(index, 1);
  },
  QueryInterface: XPCOMUtils.generateQI([nsIAutoCompleteResult])
};

function HostsAutoCompleteSearch() {
  XPCOMUtils.defineLazyGetter(this, "_allHosts", function() {
    let hosts = new Set();
    let db = PlacesUtils.history.QueryInterface(Components.interfaces.nsPIPlacesDatabase).DBConnection;
    let stmt = db.createStatement(
      "SELECT host FROM moz_hosts WHERE frecency > 0 ORDER BY frecency DESC"
    );
    try {
      while (stmt.executeStep()) {
        hosts.add(stmt.row.host);
      }
    }
    finally {
      stmt.finalize();
    }
    return hosts;
  });
}
HostsAutoCompleteSearch.prototype = {
  startSearch: function(searchString, searchParam, result, listener) {
    let results = searchString.length ? [host for (host of this._allHosts) if (host.indexOf(searchString) >= 0)] : [];
    let newResult = new HostsAutoCompleteResult(searchString, results);
    listener.onSearchResult(this, newResult);
  },

  stopSearch: function() {
  },

  classID: Components.ID("ab61382f-056c-4c05-8e39-70227b2ae34c"),
  contractID: "@mozilla.org/autocomplete/search;1?name=hosts",
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAutoCompleteSearch])
};

let NSGetFactory = XPCOMUtils.generateNSGetFactory([HostsAutoCompleteSearch]);
