const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/Services.jsm');

const XULNS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const XHTMLNS = 'http://www.w3.org/1999/xhtml';

const ADDON_ID = 'badge@darktrojan.net';

const BADGE_ANONID = 'badge';
const BADGE_SMALL_ANONID = 'badge-small';
const BADGE_LAYER_ANONID = 'badge-layer';

const STYLE_LARGE = 1;
const STYLE_SMALL = 2;

const MODE_BLACKLIST = 1;
const MODE_WHITELIST = 2;

const TITLE_REGEXP = /[\(\[]([0-9]{1,3})(\+?)( unread)?[\)\]]/;

let prefs;
let forecolor;
let backcolor;
let smallBadge;
let whitelistMode;
let blacklist;
let whitelist;
let resProt;
let piData;
let animating;

let syncedPrefs = ['animating', 'blacklist', 'backcolor', 'forecolor', 'mode', 'style', 'whitelist'];
let mutationOptions = { childList: true, characterData: true, subtree: true };

function install(params, aReason) {
}
function uninstall(params, aReason) {
  if (aReason == ADDON_UNINSTALL) {
    Services.prefs.deleteBranch('extensions.tabbadge.');
    Services.prefs.deleteBranch('services.sync.prefs.sync.extensions.tabbadge.');
  }
}
function startup(params, aReason) {
  let syncDefaultPrefs = Services.prefs.getDefaultBranch('services.sync.prefs.sync.extensions.tabbadge.');
  syncedPrefs.forEach(function(name) {
    syncDefaultPrefs.setBoolPref(name, false);
  });

  let defaultPrefs = Services.prefs.getDefaultBranch('extensions.tabbadge.');
  defaultPrefs.setCharPref('forecolor', '#FFFFFF');
  defaultPrefs.setCharPref('backcolor', '#CC0000');
  defaultPrefs.setIntPref('style', STYLE_LARGE);
  defaultPrefs.setIntPref('mode', MODE_BLACKLIST);
  defaultPrefs.setBoolPref('animating', true);

  syncedPrefs.forEach(function(name) {
    syncDefaultPrefs.setBoolPref(name, true);
  });

  prefs = Services.prefs.getBranch('extensions.tabbadge.').QueryInterface(Ci.nsIPrefBranch2);
  prefs.setCharPref('version', params.version);
  try {
    forecolor = prefs.getCharPref('forecolor');
    backcolor = prefs.getCharPref('backcolor');
    smallBadge = prefs.getIntPref('style') == STYLE_SMALL;
    whitelistMode = prefs.getIntPref('mode') == MODE_WHITELIST;
    animating = prefs.getBoolPref('animating');

    blacklist = getArrayPref('blacklist');
    whitelist = getArrayPref('whitelist');
  } catch (e) {
    Cu.reportError("Tab Badge couldn't start, please try reinstalling it.");
    return;
  }
  prefs.addObserver('', obs, false);

  let resourceURI;
  if ('resourceURI' in params) {
    resourceURI = Services.io.newURI(params.resourceURI.spec + 'resources/', null, null);
  } else if (params.installPath.isDirectory()) {
    let resourceDir = params.installPath.clone();
    resourceDir.append('resources');
    resourceURI = Services.io.newFileURI(resourceDir);
  } else {
    let jarURI = 'jar:' + Services.io.newFileURI(params.installPath).spec + '!/resources/';
    resourceURI = Services.io.newURI(jarURI, null, null);
  }
  resProt = Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler);
  resProt.setSubstitution('tabbadge_' + params.version, resourceURI);

  piData = 'href="resource://tabbadge_' + params.version + '/badge.css" type="text/css"';

  let windowEnum = Services.wm.getEnumerator('navigator:browser');
  while (windowEnum.hasMoreElements()) {
    paint(windowEnum.getNext());
  }
  Services.ww.registerNotification(obs);

  Services.obs.addObserver(obs, 'addon-options-displayed', false);
}
function shutdown(params, aReason) {
  if (aReason == APP_SHUTDOWN) {
    return;
  }

  Services.obs.removeObserver(obs, 'addon-options-displayed');

  let windowEnum = Services.wm.getEnumerator('navigator:browser');
  while (windowEnum.hasMoreElements()) {
    unpaint(windowEnum.getNext());
  }
  Services.ww.unregisterNotification(obs);

  prefs.removeObserver('', obs);

  resProt.setSubstitution('tabbadge_' + params.version, null);
}

function paint(win) {
  if (win.location == 'chrome://browser/content/browser.xul') {
    let document = win.document;
    let pi = document.createProcessingInstruction('xml-stylesheet', piData);
    document.insertBefore(pi, document.getElementById('main-window'));

    let tabContextMenu = document.getElementById('tabContextMenu');
    tabContextMenu.addEventListener('popupshowing', popupShowing, false);
    let sibling = document.getElementById('context_openTabInWindow').nextSibling;

    let menuSeparator = document.createElementNS(XULNS, 'menuseparator');
    menuSeparator.setAttribute('id', 'tabBadgeSeparator');
    tabContextMenu.insertBefore(menuSeparator, sibling);

    let menuItem = document.createElementNS(XULNS, 'menuitem');
    menuItem.setAttribute('id', 'tabBadgeBlacklist');
    menuItem.addEventListener('command', function() {
      let tab = document.popupNode;
      let uri = tab.linkedBrowser.currentURI;
      try {
        let list = whitelistMode ? whitelist : blacklist;
        let listName = whitelistMode ? 'whitelist' : 'blacklist';
        let blacklistString = uri.schemeIs('file') ? uri.spec : uri.host;
        let index = list.indexOf(blacklistString);
        if (index > -1) {
          list.splice(index, 1);
        } else {
          list.push(blacklistString);
        }
        Services.prefs.setCharPref('extensions.tabbadge.' + listName, list.join(' '));
      } catch (e) {
        Services.console.logStringMessage('Tab Badge can\'t ' + listName + ' ' + uri.spec);
      }
    }, false);
    tabContextMenu.insertBefore(menuItem, sibling);

    let content = document.getElementById('content');
    content.addEventListener('DOMTitleChanged', titleChanged, false);

    let tabbrowserTabs = document.getElementById('tabbrowser-tabs');
    tabbrowserTabs.addEventListener('TabMove', updateOnRearrange, false);
    enumerateWindowTabs(win, updateBadge);

    win.addEventListener('SSWindowStateReady', updateOnSessionRestore, false);
  }
}
function unpaint(win) {
  if (win.location == 'chrome://browser/content/browser.xul') {
    let document = win.document;

    let content = document.getElementById('content');
    content.removeEventListener('DOMTitleChanged', titleChanged, false);

    let tabbrowserTabs = document.getElementById('tabbrowser-tabs');
    tabbrowserTabs.removeEventListener('TabMove', updateOnRearrange, false);
    enumerateWindowTabs(win, removeBadge);

    win.removeEventListener('SSWindowStateReady', updateOnSessionRestore, false);

    let tabContextMenu = document.getElementById('tabContextMenu');
    tabContextMenu.removeEventListener('popupshowing', popupShowing, false);

    let menuSeparator = document.getElementById('tabBadgeSeparator');
    if (menuSeparator)
      tabContextMenu.removeChild(menuSeparator);

    let menuItem = document.getElementById('tabBadgeBlacklist');
    if (menuItem)
      tabContextMenu.removeChild(menuItem);

    for (let i = 0; i < document.childNodes.length; i++) {
      let node = document.childNodes[i];
      if (node.nodeType == document.PROCESSING_INSTRUCTION_NODE && node.data == piData) {
        document.removeChild(node);
        break;
      }
    }
  }
}
let obs = {
  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
    case 'domwindowopened':
      aSubject.addEventListener('load', function() {
        paint(aSubject);
      }, false);
      break;
    case 'nsPref:changed':
      switch (aData) {
      case 'forecolor':
      case 'backcolor':
        forecolor = prefs.getCharPref('forecolor');
        backcolor = prefs.getCharPref('backcolor');
        enumerateTabs(function(tab) {
          if (smallBadge) {
            updateBadge(tab);
          } else {
            let tabBadge = tab.ownerDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_ANONID);
            if (tabBadge) {
              tabBadge.style.color = forecolor;
              tabBadge.style.backgroundColor = backcolor;
            }
          }
        });
        break;
      case 'blacklist':
        blacklist = getArrayPref('blacklist');
        if (!whitelistMode)
          enumerateTabs(updateBadge);
        break;
      case 'whitelist':
        whitelist = getArrayPref('whitelist');
        if (whitelistMode)
          enumerateTabs(updateBadge);
        break;
      case 'style':
        smallBadge = prefs.getIntPref('style') == STYLE_SMALL;
        enumerateTabs(updateBadge);
        break;
      case 'mode':
        whitelistMode = prefs.getIntPref('mode') == MODE_WHITELIST;
        enumerateTabs(updateBadge);
        break;
      case 'animating':
        animating = prefs.getBoolPref('animating');
        break;
      }
      break;
    case 'addon-options-displayed':
      if (aData == ADDON_ID) {
        function disableControl(aControl, aDisabled) {
          if (aDisabled) {
            aControl.setAttribute('disabled', 'true');
          } else {
            aControl.removeAttribute('disabled');
          }
        }

        let controls = {};
        for (aName of ['style', 'mode']) {
          controls[aName] = aSubject.getElementById('tabbadge-' + aName).firstElementChild;
        }
        for (aName of ['animating', 'blacklist', 'whitelist']) {
          controls[aName] = aSubject.getElementById('tabbadge-' + aName);
        }

        controls.style.addEventListener('command', function() {
          disableControl(controls.animating, controls.style.value != 1);
        });
        controls.mode.addEventListener('command', function() {
          disableControl(controls.blacklist, controls.mode.value != 1);
          disableControl(controls.whitelist, controls.mode.value != 2);
        });

        disableControl(controls.animating, controls.style.value != 1);
        disableControl(controls.blacklist, controls.mode.value != 1);
        disableControl(controls.whitelist, controls.mode.value != 2);
      }
      break;
    }
  }
};

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

function popupShowing(event) {
  let document = event.target.ownerDocument;
  let window = document.defaultView;
  let menuSeparator = document.getElementById('tabBadgeSeparator');
  let menuItem = document.getElementById('tabBadgeBlacklist');

  let tab = document.popupNode;
  let uri = tab.linkedBrowser.currentURI;
  let shouldShow = false;

  try {
    let hostString = uri.schemeIs('file') ? 'this file' : uri.host;
    let blacklisted = isBlacklisted(uri);
    if (whitelistMode) {
      if (blacklisted) {
        menuItem.setAttribute('label', 'Whitelist Tab Badge for ' + hostString);
      } else {
        menuItem.setAttribute('label', 'Un-Whitelist Tab Badge for ' + hostString);
      }
      shouldShow = true;
    } else {
      if (blacklisted) {
        menuItem.setAttribute('label', 'Un-Blacklist Tab Badge for ' + hostString);
        shouldShow = true;
      } else {
        menuItem.setAttribute('label', 'Blacklist Tab Badge for ' + hostString);

        let tabBadge = tab.ownerDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_ANONID);
        let tabBadgeLayer = tab.ownerDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_LAYER_ANONID);
        if (!!tabBadge || !!tabBadgeLayer) {
          shouldShow = true;
        }
      }
    }
  } catch (e) {
  }

  if (shouldShow) {
    menuSeparator.removeAttribute('collapsed');
    menuItem.removeAttribute('collapsed');
  } else {
    menuSeparator.setAttribute('collapsed', 'true');
    menuItem.setAttribute('collapsed', 'true');
  }
}

function enumerateTabs(callback) {
  let windowEnum = Services.wm.getEnumerator('navigator:browser');
  while (windowEnum.hasMoreElements()) {
    let window = windowEnum.getNext();
    enumerateWindowTabs(window, callback);
  }
}

function enumerateWindowTabs(window, callback) {
  let tabs = window.gBrowser.tabs;
  for (let i = 0; i < tabs.length; i++) {
    callback(tabs[i]);
  }
}

function titleChanged(event) {
  if (!event.isTrusted)
    return;

  let contentWin = event.target.defaultView;
  if (contentWin != contentWin.top)
    return;

  let tab = this._getTabForContentWindow(contentWin);
  contentWin.setTimeout(function() {
    updateBadge(tab);
  }, 100);
}

function isBlacklisted(uri) {
  let list = whitelistMode ? whitelist : blacklist;
  let inList;

  try {
    if (uri.schemeIs('file')) {
      inList = list.some(function(listItem) {
        return uri.spec.indexOf(listItem) == 0;
      });
    } else {
      let host = uri.host;
      if (!host)
        return false;
      inList = list.indexOf(host) >= 0;
    }

    if ((whitelistMode && !inList) || (!whitelistMode && inList))
      return true;
  } catch (e) {
  }
  return false;
}

function updateBadge(tab) {
  let uri = tab.linkedBrowser.currentURI;
  if (isBlacklisted(uri)) {
    removeBadge(tab);
    return;
  }

  let match = TITLE_REGEXP.exec(tab.label);
  if (match) {
    tab.removeAttribute('titlechanged');
  }
  let badgeValue = match ? parseInt(match[1], 10) : 0;

  if (uri.schemeIs('https')) {
    if (uri.host == 'mail.google.com' && !/#contact/.test(uri.path)) {
      getElement(tab.linkedBrowser.contentWindow, '.n3', function(target) {
        addObserver(tab, target, function(target) {
          let innerTarget = target.querySelector('.n0');
          match = TITLE_REGEXP.exec(innerTarget.textContent);
          badgeValue = match ? parseInt(match[1], 10) : 0;
          return badgeValue;
        });
      });
      return;
    } else if (uri.host == 'plus.google.com') {
      getElement(tab.linkedBrowser.contentWindow, '#gbi1', function(target) {
        addObserver(tab, target, function(target) {
          return parseInt(target.textContent, 10);
        });
      });
      return;
    }
  }

  updateBadgeWithValue(tab, badgeValue, match);
}

function updateBadgeWithValue(tab, badgeValue, match) {
  if (!badgeValue) {
    removeBadge(tab);
    return;
  }

  let chromeDocument = tab.ownerDocument;
  let chromeWindow = chromeDocument.defaultView;
  let tabBrowserTabs = chromeDocument.getElementById('tabbrowser-tabs');
  let tabBadge = chromeDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_ANONID);
  let tabBadgeLayer = chromeDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_LAYER_ANONID);
  let tabBadgeSmall = chromeDocument.getAnonymousElementByAttribute(tab, 'anonid', BADGE_SMALL_ANONID);

  if (smallBadge) {
    removeBadge(tab, false, true);
    if (!tabBadgeLayer) {
      tabBadgeLayer = chromeDocument.createElementNS(XULNS, 'hbox');
      tabBadgeLayer.setAttribute('anonid', BADGE_LAYER_ANONID);
      tabBadgeLayer.setAttribute('left', '0');

      tabBadgeSmall = chromeDocument.createElementNS(XULNS, 'image');
      tabBadgeSmall.setAttribute('anonid', BADGE_SMALL_ANONID);
      tabBadgeSmall.setAttribute('class', 'tab-badge-small tab-icon-image');
      tabBadgeSmall.setAttribute('fadein', 'true');
      tabBadgeLayer.appendChild(tabBadgeSmall);
      chromeDocument.getAnonymousElementByAttribute(tab, 'class', 'tab-stack').appendChild(tabBadgeLayer);

      tabBadgeLayer.setAttribute('top', tabBadgeLayer.clientHeight - 16);
    }
    if (tab.hasAttribute('pinned')) {
      tabBadgeSmall.setAttribute('pinned', 'true');
    } else {
      tabBadgeSmall.removeAttribute('pinned');
    }
    tabBadgeSmall.setAttribute('src', drawNumber(tab.ownerDocument, badgeValue));

  } else {
    removeBadge(tab, true, false);
    if (match && match[2]) {
      badgeValue += '+';
    }
    if (tabBadge) {
      if (tabBadge.getAttribute('value') == badgeValue) {
        return;
      }
    } else {
      tabBadge = chromeDocument.createElementNS(XULNS, 'label');
      tabBadge.setAttribute('anonid', BADGE_ANONID);
      tabBadge.className = 'tab-badge tab-text';
      if (Services.appinfo.OS == 'WINNT') {
        tabBadge.classList.add('winstripe');
      }
      tabBadge.style.color = forecolor;
      tabBadge.style.backgroundColor = backcolor;
      tabBadge.style.animation = 'none';

      let closeButton = chromeDocument.getAnonymousElementByAttribute(tab, 'anonid', 'close-button');
      if (!closeButton) {
        // look for the Tab Mix Plus close button
        let tmpCloseButton = chromeDocument.getAnonymousElementByAttribute(tab, 'anonid', 'tmp-close-button');
        if (tmpCloseButton) {
          // Tab Mix Plus has two close buttons, which is just annoying
          closeButton = tmpCloseButton.parentNode.lastChild;
        }
      }
      if (!closeButton) {
        Cu.reportError("Tab Badge couldn't find the appropriate place to add a badge. " +
          'This is probably due to a conflict with another add-on.');
        return;
      }
      closeButton.parentNode.insertBefore(tabBadge, closeButton);

      chromeWindow.setTimeout(function() {
        tabBadge.style.borderBottomLeftRadius =
          tabBadge.style.borderBottomRightRadius =
          tabBadge.style.borderTopLeftRadius =
          tabBadge.style.borderTopRightRadius = Math.ceil(tabBadge.clientHeight / 2) + 'px';
        tabBadge.style.minWidth = tabBadge.clientHeight + 'px';
      }, 0);

      tabBadge.addEventListener('animationend', function() {
        tabBadge.style.animation = 'none';
      }, false);

      tab.addEventListener('TabAttrModified', fixBinding, false);
      tab.addEventListener('TabPinned', fixBinding, false);
      tab.addEventListener('TabUnpinned', fixBinding, false);
    }

    let oldValue = parseInt(tabBadge.getAttribute('value')) || 0;

    tabBadge.style.width = '';
    tabBadge.setAttribute('value', badgeValue);
    chromeWindow.setTimeout(function() {
      if (tabBadge.clientWidth <= parseInt(tabBadge.style.minWidth)) {
        tabBadge.style.width = tabBadge.clientWidth + 'px';
      }
    }, 0);
    if (tab.pinned) {
      tabBrowserTabs._positionPinnedTabs();
    }
    if (animating && parseInt(badgeValue) > oldValue) {
      tabBadge.style.animation = null;
    }
  }
}

function removeBadge(tab, keepBadge, keepSmallBadge) {
  let document = tab.ownerDocument;
  if (!keepBadge) {
    let tabBadge = document.getAnonymousElementByAttribute(tab, 'anonid', BADGE_ANONID);
    if (tabBadge) {
      tabBadge.parentNode.removeChild(tabBadge);
      tab.removeEventListener('TabAttrModified', fixBinding, false);
      tab.removeEventListener('TabPinned', fixBinding, false);
      tab.removeEventListener('TabUnpinned', fixBinding, false);
      if (tab.pinned) {
        let tabBrowserTabs = document.getElementById('tabbrowser-tabs');
        tabBrowserTabs._positionPinnedTabs();
      }
    }
  }
  if (!keepSmallBadge) {
    let tabBadgeLayer = document.getAnonymousElementByAttribute(tab, 'anonid', BADGE_LAYER_ANONID);
    if (tabBadgeLayer) {
      tabBadgeLayer.parentNode.removeChild(tabBadgeLayer);
    }
  }
}

// this function fixes a 'bug' in xbl which occurs because we break the binding
function fixBinding(event) {
  let tab = event.target;
  let closeButton = tab.ownerDocument.getAnonymousElementByAttribute(tab, 'anonid', 'close-button');

  switch (event.type) {
  case 'TabPinned':
    closeButton.setAttribute('pinned', 'true');
    break;
  case 'TabUnpinned':
    closeButton.removeAttribute('pinned');
    break;
  case 'TabAttrModified':
    if (tab.selected)
      closeButton.setAttribute('selected', 'true');
    else
      closeButton.removeAttribute('selected');
    break;
  }
}

function updateOnRearrange(event) {
  updateBadge(event.target);
}

function updateOnSessionRestore(event) {
  let win = event.target;
  enumerateWindowTabs(win, updateBadge);
}

function getElement(window, selector, callback) {
  if (window.document.readyState == 'complete') {
    let target = window.document.querySelector(selector);
    if (target) {
      callback(target);
    }
  } else {
    window.addEventListener('DOMContentLoaded', function pageLoadListener(event) {
      window.removeEventListener('DOMContentLoaded', pageLoadListener, false);
      let target = window.document.querySelector(selector);
      if (target) {
        callback(target);
      }
    }, false);
  }
}

function addObserver(tab, target, test) {
  let badgeValue = test(target);
  updateBadgeWithValue(tab, badgeValue);

  let contentWindow = target.ownerDocument.defaultView;
  if (!('tb_observer' in target)) {
    target.tb_badgeValue = badgeValue;
    let M = contentWindow.MozMutationObserver || contentWindow.MutationObserver;
    target.tb_observer = new M(function(records, observer) {
      let newBadgeValue = test(target);
      if (target.tb_badgeValue != newBadgeValue) {
        target.tb_badgeValue = newBadgeValue;
        updateBadgeWithValue(tab, newBadgeValue);
      }
    });
    target.tb_observer.observe(target, mutationOptions);
  }
}

function drawNumber(document, number) {
  number = new String(number);
  let c = document.createElementNS(XHTMLNS, 'canvas');
  c.width = c.height = 16;
  let cx = c.getContext('2d');
  cx.save();
  cx.translate(15, 0);
  for (let i = number.length - 1; i >= 0; i--) {
    drawDigit(cx, number.substring(i, i + 1));
  }
  cx.restore();
  return c.toDataURL();
}
function drawDigit(cx, digit) {
  cx.fillStyle = backcolor;
  if (digit == 1) {
    cx.translate(-2, 0);
    cx.fillRect(0, 9, 3, 7);
    cx.fillStyle = forecolor;
    cx.fillRect(1, 10, 1, 5);
    return;
  }

  cx.translate(-5, 0);
  if (digit == 0 || digit == 2 || digit == 3 || digit == 5 || digit == 8)
    cx.fillRect(0, 9, 6, 7);
  else if (digit == 4 || digit == 9) {
    cx.fillRect(0, 9, 6, 5);
    cx.fillRect(3, 11, 3, 5);
  } else if (digit == 6) {
    cx.fillRect(0, 9, 3, 5);
    cx.fillRect(0, 11, 6, 5);
  } else if (digit == 7) {
    cx.fillRect(0, 9, 6, 3);
    cx.fillRect(3, 11, 3, 5);
  }

  cx.fillStyle = forecolor;
  if (digit == 0 || digit == 2 || digit == 3 || digit == 5 || digit == 7 || digit == 8 || digit == 9)
    cx.fillRect(1, 10, 4, 1);
  if (digit == 2 || digit == 3 || digit == 4 || digit == 5 || digit == 6 || digit == 8 || digit == 9)
    cx.fillRect(1, 12, 4, 1);
  if (digit == 0 || digit == 2 || digit == 3 || digit == 5 || digit == 6 || digit == 8)
    cx.fillRect(1, 14, 4, 1);
  if (digit == 0 || digit == 4 || digit == 5 || digit == 6 || digit == 8 || digit == 9)
    cx.fillRect(1, 10, 1, 3);
  if (digit == 0 || digit == 2 || digit == 3 || digit == 4 || digit == 7 || digit == 8 || digit == 9)
    cx.fillRect(4, 10, 1, 3);
  if (digit == 0 || digit == 2 || digit == 6 || digit == 8)
    cx.fillRect(1, 12, 1, 3);
  if (digit == 0 || digit == 3 || digit == 4 || digit == 5 || digit == 6 || digit == 7 || digit == 8 || digit == 9)
    cx.fillRect(4, 12, 1, 3);
}
