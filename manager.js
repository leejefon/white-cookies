if (!chrome.cookies) {
  chrome.cookies = chrome.experimental.cookies;
}

// Compares cookies for "key" (name, domain, etc.) equality, but not "value" equality.
function cookieMatch(c1, c2) {
  return (c1.name == c2.name) && (c1.domain == c2.domain) &&
         (c1.hostOnly == c2.hostOnly) && (c1.path == c2.path) &&
         (c1.secure == c2.secure) && (c1.httpOnly == c2.httpOnly) &&
         (c1.session == c2.session) && (c1.storeId == c2.storeId);
}

// Returns an array of sorted keys from an associative array.
function sortedKeys(array) {
  var keys = [];
  for (let i in array) {
    keys.push(i);
  }
  keys.sort();
  return keys;
}

function select(selector) {
  return document.querySelector(selector);
}

// An object used for caching data about the browser's cookies, which we update as notifications come in.
function CookieCache() {
  this.cookies_ = {};

  this.reset = function() {
    this.cookies_ = {};
  }

  this.add = function(cookie) {
    var domain = cookie.domain;
    if (!this.cookies_[domain]) {
      this.cookies_[domain] = [];
    }
    this.cookies_[domain].push(cookie);
  };

  this.remove = function(cookie) {
    var domain = cookie.domain;
    if (this.cookies_[domain]) {
      var i = 0;
      while (i < this.cookies_[domain].length) {
        if (cookieMatch(this.cookies_[domain][i], cookie)) {
          this.cookies_[domain].splice(i, 1);
        } else {
          i++;
        }
      }
      if (this.cookies_[domain].length == 0) {
        delete this.cookies_[domain];
      }
    }
  };

  // Returns a sorted list of cookie domains that match |filter|. If |filter| is
  //  null, returns all domains.
  this.getDomains = function(filter) {
    const result = [];
    sortedKeys(this.cookies_).forEach((domain) => {
      if (!filter || domain.indexOf(filter) !== -1) {
        result.push(domain);
      }
    });
    return result;
  }

  this.getCookies = function(domain) {
    return this.cookies_[domain];
  };
}

var cache = new CookieCache();

function removeAllForFilter() {
  const filter = select("#filter").value;
  cache.getDomains(filter).forEach(function(domain) {
    removeCookiesForDomain(domain);
  });
}

function removeAll() {
  const all_cookies = [];
  cache.getDomains().forEach(function(domain) {
    if (!whitelistKeywords.find((w) => domain.includes(w))) {
      cache.getCookies(domain).forEach(function(cookie) {
        all_cookies.push(cookie);
      });
    }
  });
  const count = all_cookies.length;
  for (let i = 0; i < count; i++) {
    removeCookie(all_cookies[i]);
  }
  // cache.reset();
  // chrome.cookies.getAll({}, function(cookies) {
  //   for (var i in cookies) {
  //     cache.add(cookies[i]);
  //     removeCookie(cookies[i]);
  //   }
  // });
}

function removeCookie(cookie) {
  const url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
  chrome.cookies.remove({ url, name: cookie.name });
}

function removeCookiesForDomain(domain) {
  cache.getCookies(domain).forEach((cookie) => {
    removeCookie(cookie);
  });
}

function resetTable() {
  const table = select("#cookies");
  while (table.rows.length > 1) {
    table.deleteRow(table.rows.length - 1);
  }
}

let reload_scheduled = false;

function scheduleReloadCookieTable() {
  if (!reload_scheduled) {
    reload_scheduled = true;
    setTimeout(reloadCookieTable, 250);
  }
}

function reloadCookieTable() {
  reload_scheduled = false;

  const filter = select("#filter").value;
  const domains = cache.getDomains(filter);

  select("#filter_count").innerText = domains.length;
  select("#total_count").innerText = cache.getDomains().length;

  select("#delete_all_button").innerHTML = "";
  if (domains.length) {
    const button = document.createElement("button");
    button.innerText = "Delete all " + domains.length;
    button.className = "btn btn-danger";
    button.onclick = removeAllForFilter;
    select("#delete_all_button").appendChild(button);
  }

  resetTable();
  const table = select("#cookies");

  domains.forEach(function(domain) {
    const cookies = cache.getCookies(domain);
    const row = table.insertRow(-1);
    row.insertCell(-1).innerText = domain;
    let cell = row.insertCell(-1);
    cell.innerText = cookies.length;
    cell.setAttribute("class", "cookie_count");

    const button = document.createElement("button");
    button.innerText = "Delete";
    button.className = "btn btn-danger btn-sm";
    button.onclick = (function(dom) {
      return function() {
        removeCookiesForDomain(dom);
      };
    }(domain));
    cell = row.insertCell(-1);
    cell.appendChild(button);
    cell.setAttribute("class", "button");
  });
}

function focusFilter() {
  select("#filter").focus();
}

function resetFilter() {
  var filter = select("#filter");
  filter.focus();
  if (filter.value.length > 0) {
    filter.value = "";
    reloadCookieTable();
  }
}

var ESCAPE_KEY = 27;
window.onkeydown = function(event) {
  if (event.keyCode == ESCAPE_KEY) {
    resetFilter();
  }
}

function listener(info) {
  cache.remove(info.cookie);
  if (!info.removed) {
    cache.add(info.cookie);
  }
  scheduleReloadCookieTable();
}

function startListening() {
  chrome.cookies.onChanged.addListener(listener);
}

function stopListening() {
  chrome.cookies.onChanged.removeListener(listener);
}

function onload() {
  focusFilter();
  chrome.cookies.getAll({}, function(cookies) {
    startListening();
    start = new Date();
    for (let i in cookies) {
      cache.add(cookies[i]);
    }
    reloadCookieTable();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  onload();
  document.body.addEventListener('click', focusFilter);
  document.querySelector('#remove_button').addEventListener('click', removeAll);
  document.querySelector('#filter_div input').addEventListener('input', reloadCookieTable);
  document.querySelector('#filter_div button').addEventListener('click', resetFilter);
});
