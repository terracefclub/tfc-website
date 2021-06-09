(self["webpackChunktfc_website_frontend"] = self["webpackChunktfc_website_frontend"] || []).push([["src_main_scripts_components_index_ts"],{

/***/ "./src/main/scripts/components/blog.ts":
/*!*********************************************!*\
  !*** ./src/main/scripts/components/blog.ts ***!
  \*********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "shareLoader": function() { return /* binding */ shareLoader; },
/* harmony export */   "searchLoader": function() { return /* binding */ searchLoader; },
/* harmony export */   "rankedSortAndPaginationLoader": function() { return /* binding */ rankedSortAndPaginationLoader; }
/* harmony export */ });
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! regenerator-runtime/runtime.js */ "./node_modules/regenerator-runtime/runtime.js");
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ "./node_modules/core-js/modules/web.dom-collections.for-each.js");
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.map.js */ "./node_modules/core-js/modules/es.array.map.js");
/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.from.js */ "./node_modules/core-js/modules/es.array.from.js");
/* harmony import */ var core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ "./node_modules/core-js/modules/es.string.iterator.js");
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "./node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_string_includes_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.string.includes.js */ "./node_modules/core-js/modules/es.string.includes.js");
/* harmony import */ var core_js_modules_es_string_includes_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_includes_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.array.slice.js */ "./node_modules/core-js/modules/es.array.slice.js");
/* harmony import */ var core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! core-js/modules/es.regexp.to-string.js */ "./node_modules/core-js/modules/es.regexp.to-string.js");
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var core_js_modules_es_array_filter_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! core-js/modules/es.array.filter.js */ "./node_modules/core-js/modules/es.array.filter.js");
/* harmony import */ var core_js_modules_es_array_filter_js__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_filter_js__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "./node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! core-js/modules/es.regexp.exec.js */ "./node_modules/core-js/modules/es.regexp.exec.js");
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! core-js/modules/es.array.concat.js */ "./node_modules/core-js/modules/es.array.concat.js");
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_13__);
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! core-js/modules/es.promise.js */ "./node_modules/core-js/modules/es.promise.js");
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_14___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_14__);
/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! core-js/modules/es.symbol.js */ "./node_modules/core-js/modules/es.symbol.js");
/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_15__);
/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! core-js/modules/es.symbol.description.js */ "./node_modules/core-js/modules/es.symbol.description.js");
/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_16__);
/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! core-js/modules/es.symbol.iterator.js */ "./node_modules/core-js/modules/es.symbol.iterator.js");
/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_17___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_17__);
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ "./node_modules/core-js/modules/es.array.iterator.js");
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_18___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_18__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "./node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_19___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_19__);
/* harmony import */ var core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! core-js/modules/es.function.name.js */ "./node_modules/core-js/modules/es.function.name.js");
/* harmony import */ var core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_20___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_20__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }























function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }


/**
 * 
 */

function shareLoader() {
  var shareBtns = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_21__.queryElementAll)(document, '.card-info-footer div:last-child', HTMLElement);
  /**
   * Copy the URL on an element to the browser clipboard
   * @param el - the element clicked with a URL stored as an attribute
   * @returns a success/failure message to display to user
   */

  function copyUrl(_x) {
    return _copyUrl.apply(this, arguments);
  }
  /**
   * Pass a message to a box to display an alert for 3 seconds
   * @param el - the element clicked with a URL
   * @param message - the message to display
   */


  function _copyUrl() {
    _copyUrl = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(el) {
      var permission, url;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _context2.prev = 0;
              _context2.next = 3;
              return navigator.permissions.query({
                name: "clipboard-write"
              });

            case 3:
              permission = _context2.sent;

              if (!(permission.state == "granted" || permission.state == "prompt")) {
                _context2.next = 12;
                break;
              }

              // write the url stored on the share button to the clipboard
              url = el.getAttribute('data-url');

              if (url) {
                _context2.next = 8;
                break;
              }

              throw {
                message: "Invalid Link",
                error: Error('\'data-url\' not defined on share button.')
              };

            case 8:
              _context2.next = 10;
              return navigator.clipboard.writeText(url);

            case 10:
              _context2.next = 13;
              break;

            case 12:
              throw {
                message: "Invalid Clipboard Permissions",
                error: Error("PermissionStatus value '".concat(permission.state, "' does not support") + 'writing to \'navigator.clipboard\'')
              };

            case 13:
              _context2.next = 22;
              break;

            case 15:
              _context2.prev = 15;
              _context2.t0 = _context2["catch"](0);

              if (!(!!_context2.t0 && _context2.t0.constructor === Object && 'error' in _context2.t0)) {
                _context2.next = 20;
                break;
              }

              console.error(_context2.t0.error);
              return _context2.abrupt("return", "Copy failed! - ".concat(_context2.t0.message));

            case 20:
              console.error(_context2.t0);
              return _context2.abrupt("return", 'Copy failed!');

            case 22:
              return _context2.abrupt("return", 'Copied!');

            case 23:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, null, [[0, 15]]);
    }));
    return _copyUrl.apply(this, arguments);
  }

  function displayAlert(el, message) {
    var _el$closest;

    var alert = (_el$closest = el.closest('.card')) === null || _el$closest === void 0 ? void 0 : _el$closest.querySelector('.copied-alert');
    var p = alert === null || alert === void 0 ? void 0 : alert.querySelector('p');
    if (p) p.textContent = message;
    alert === null || alert === void 0 ? void 0 : alert.classList.remove('invisible'); // only display the alert box for 3 seconds

    setTimeout(function () {
      return alert === null || alert === void 0 ? void 0 : alert.classList.add('invisible');
    }, 3000);
  }

  shareBtns.forEach(function (shareBtn) {
    return shareBtn.addEventListener('click', /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.t0 = displayAlert;
              _context.t1 = shareBtn;
              _context.next = 4;
              return copyUrl(shareBtn);

            case 4:
              _context.t2 = _context.sent;
              return _context.abrupt("return", (0, _context.t0)(_context.t1, _context.t2));

            case 6:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    })));
  });
}
/**
 * 
 */

function searchLoader() {
  var cardBadges = document.querySelectorAll('.card .blog-badge');
  var search = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_21__.queryElement)(document, '#blog-search', HTMLInputElement);
  var searchBadgeBox = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_21__.queryElement)(document, '#blog-search-spans', HTMLDivElement);
  var searchBadges = searchBadgeBox.querySelectorAll('.blog-badge');
  /**
   * Handle making a clicked `cardBadge` a `searchBadge` too
   * @param el - the badge on a card that was clicked to be included in search
   */

  function addSearchBadge(el) {
    var searchValues = Array.from(searchBadges).map(function (el) {
      return el.textContent;
    }); // add the badge to search box if not already there

    if (el.textContent && !searchValues.includes(el.textContent)) {
      var badge = el.cloneNode(true);
      badge.addEventListener('click', function () {
        var _badge$parentNode;

        return (_badge$parentNode = badge.parentNode) === null || _badge$parentNode === void 0 ? void 0 : _badge$parentNode.removeChild(badge);
      });
      searchBadgeBox.appendChild(badge);
    }
  }
  /**
   * Deletes the last badge in the search box only if the search input has
   * a truthy value
   */


  function removeLastSearchBadgeIfEmpty() {
    if (search.value === '') {
      var _last$parentNode;

      var last = searchBadges === null || searchBadges === void 0 ? void 0 : searchBadges[(searchBadges === null || searchBadges === void 0 ? void 0 : searchBadges.length) - 1];
      last === null || last === void 0 ? void 0 : (_last$parentNode = last.parentNode) === null || _last$parentNode === void 0 ? void 0 : _last$parentNode.removeChild(last);
    }
  }
  /**
   * Append a new badge to the search box with the contents of the search box
   */


  function addTypedBadge() {
    var value = search.value;
    var searchValues = Array.from(searchBadges).map(function (el) {
      return el.textContent;
    });
    var typedBadgeColor = 'rgb(156, 163, 175)';

    if (value !== '' && !searchValues.includes(value)) {
      var badge = document.createElement('span');
      badge.classList.add('blog-badge');
      badge.style.backgroundColor = typedBadgeColor;
      badge.textContent = value;
      searchBadgeBox.appendChild(badge); // reset search box

      search.value = '';
    }
  }

  Array.from(cardBadges).forEach(function (badge) {
    return badge.addEventListener('click', function () {
      return addSearchBadge(badge);
    });
  });
  document.addEventListener('keydown', function (event) {
    if (search.matches(':focus')) {
      switch (event.key) {
        case "Backspace":
          removeLastSearchBadgeIfEmpty();
          break;

        case "Enter":
          addTypedBadge();
          break;
      }
    }
  });
}
/**
 * Implement ranked sorting with pagination on the blog index page
 */

function rankedSortAndPaginationLoader() {
  var availableRanks = [0, 1, 2, 3];
  var rankingColors = ['rgb(239, 68, 68)', 'rgb(16, 185, 129)', 'rgb(139, 92, 246)', 'rgb(245, 158, 11)'];
  var orderCycle = {
    unordered: "asc",
    asc: "desc",
    desc: "unordered"
  };

  var isOrderCycleKey = function isOrderCycleKey(key) {
    return key in orderCycle;
  };

  var blogContainer = document.querySelector('#blog-list-container');
  var blogSorters = document.querySelectorAll('.blog-sorter');
  var rankBoxes = document.querySelectorAll('.rank-container');
  var rankers = document.querySelectorAll('.sorter-ranker');
  var cards = document.querySelectorAll('.card');
  var pageBtns = document.querySelectorAll('.page-button');
  var pageNumEl = document.getElementById('page-num');
  var pageSize = 8;
  var length = cards.length;
  var currPageIdx = 2;
  var sortCards = Array.prototype.sort.bind(cards);
  /**
   * Display the correct page of results and adjust the pagination controls
   * @param button - the pagination button clicked (first, prev, next, last, ..)
   * @param start - the index of the page's first item
   * @param end - the index of the page's last item
   */

  function paginateResults(button, start, end) {
    // short circuit disabled buttons
    if (button.classList.contains('disabled')) return; // shift button highlight to the clicked button

    pageBtns[currPageIdx].classList.remove('selected');
    button.classList.add('selected'); // display only the `cards` from index `start` to `end`

    cards.forEach(function (card) {
      return card.classList.add('hidden');
    });
    Array.from(cards).slice(start, end).forEach(function (card) {
      return card.classList.remove('hidden');
    }); // display the appropriate page number and shift button highlight back

    if (pageNumEl) {
      pageNumEl.textContent = (Math.floor(start / pageSize) + 1).toString();
    }

    button.classList.remove('selected');
    pageBtns[currPageIdx].classList.add('selected'); // disable the correct pagination buttons when on the first or last page

    Array.from(pageBtns).slice(0, currPageIdx).forEach(function (btn) {
      return btn.classList.toggle('disabled', start === 0);
    });
    Array.from(pageBtns).slice(currPageIdx + 1).forEach(function (btn) {
      return btn.classList.toggle('disabled', length - start < pageSize);
    });
  }
  /**
   * Calculate the indices of the cards to be displayed
   * @param btnIndex - the clicked pagination button
   * @returns the start and ending indices of the next page to be displayed
   */


  function getPageBounds(btnIndex) {
    var pageNumText = pageNumEl === null || pageNumEl === void 0 ? void 0 : pageNumEl.textContent;

    if (pageNumText) {
      var pageNum = parseInt(pageNumText);

      switch (btnIndex) {
        // the first page
        case 0:
          return [0, pageSize];
        // the previous page

        case 1:
          return [(pageNum - 2) * pageSize, (pageNum - 1) * pageSize];
        // the current page

        case 2:
          return [(pageNum - 1) * pageSize, pageNum * pageSize];
        // the next page

        case 3:
          return [pageNum * pageSize, Math.min((pageNum + 1) * pageSize, length)];
        // the last page

        case 4:
          return [length - length % pageSize, length];

        default:
          return [0, length];
      }
    }

    return [0, length];
  }
  /**
   * Sort the cards by their index when retrieved from server (the post number)
   */


  function defaultSort() {
    sortCards(function (a, b) {
      var vals = [a, b].map(function (card) {
        var _card$querySelector;

        return parseInt(((_card$querySelector = card.querySelector('.post-number')) === null || _card$querySelector === void 0 ? void 0 : _card$querySelector.textContent) || '0');
      });
      return vals[0] - vals[1];
    });
    cards.forEach(function (card) {
      var _card$parentNode;

      return (_card$parentNode = card.parentNode) === null || _card$parentNode === void 0 ? void 0 : _card$parentNode.removeChild(card);
    });
    blogContainer === null || blogContainer === void 0 ? void 0 : blogContainer.append.apply(blogContainer, _toConsumableArray(Array.from(cards)));
  }
  /**
   * Calculates the rank of a particular sorter
   * @param box - the rank box with a potentially selected rank inside
   * @returns the index of the selected `ranker` child (-1 if nothing)
   */


  function getSelectedRank(box) {
    var _rankerSelected$paren;

    var rankerSelected = box.querySelector('.sorter-ranker[data-selected]');
    var rankers = rankerSelected === null || rankerSelected === void 0 ? void 0 : (_rankerSelected$paren = rankerSelected.parentNode) === null || _rankerSelected$paren === void 0 ? void 0 : _rankerSelected$paren.childNodes;
    if (!rankers) return -1;
    return Array.from(rankers).indexOf(rankerSelected);
  }
  /**
   * Sort the cards by the ranked sorters
   */


  function rankedSort() {
    // reset to original sort
    defaultSort(); // get all active rank sorters in reversed ranking order

    var ranks = Array.from(rankBoxes).map(function (box) {
      var _box$closest, _box$closest$querySel;

      return {
        boxIdx: Array.from(rankBoxes).indexOf(box),
        rank: getSelectedRank(box),
        order: (_box$closest = box.closest('.blog-filter')) === null || _box$closest === void 0 ? void 0 : (_box$closest$querySel = _box$closest.querySelector('.blog-sorter')) === null || _box$closest$querySel === void 0 ? void 0 : _box$closest$querySel.getAttribute('data-sort')
      };
    }).filter(function (_ref2) {
      var rank = _ref2.rank;
      return rank !== -1;
    }).sort(function (a, b) {
      return b.rank - a.rank;
    }); // sort the cards for each active ranked sorter

    ranks.forEach(function (_ref3) {
      var boxIdx = _ref3.boxIdx,
          order = _ref3.order;
      sortCards(function (a, b) {
        // set values of comparison for sorting by extracting the corresponding
        // value in the card footer (date is the exception because it's displayed
        // separately and requires the use of `Date.parse`)
        var aVal, bVal;

        if (boxIdx === 3) {
          var _map = [a, b].map(function (card) {
            var _card$querySelector2;

            return Date.parse((_card$querySelector2 = card.querySelector('.card-info-header-date')) === null || _card$querySelector2 === void 0 ? void 0 : _card$querySelector2.textContent);
          });

          var _map2 = _slicedToArray(_map, 2);

          aVal = _map2[0];
          bVal = _map2[1];
        } else {
          var valueSelector = ".card-info-footer div:nth-child(".concat(boxIdx + 1, ") p");

          var _map3 = [a, b].map(function (card) {
            var _card$querySelector$g, _card$querySelector3;

            return parseInt((_card$querySelector$g = (_card$querySelector3 = card.querySelector(valueSelector)) === null || _card$querySelector3 === void 0 ? void 0 : _card$querySelector3.getAttribute('data-val')) !== null && _card$querySelector$g !== void 0 ? _card$querySelector$g : '0');
          });

          var _map4 = _slicedToArray(_map3, 2);

          aVal = _map4[0];
          bVal = _map4[1];
        } // ascending order reverses the subtraction order for comparison


        if (order === "asc") return aVal - bVal;
        return bVal - aVal;
      });
    });
    cards.forEach(function (card) {
      var _card$parentNode2;

      return (_card$parentNode2 = card.parentNode) === null || _card$parentNode2 === void 0 ? void 0 : _card$parentNode2.removeChild(card);
    });
    blogContainer === null || blogContainer === void 0 ? void 0 : blogContainer.append.apply(blogContainer, _toConsumableArray(Array.from(cards)));
  }
  /**
   * Adjust the display of ranking buttons and initiate a ranked sort
   * @param ranker - the ranker dot button that initiates sorting
   */


  function handleRankersDisplay(ranker) {
    var _ranker$parentNode;

    var groupRankers = (_ranker$parentNode = ranker.parentNode) === null || _ranker$parentNode === void 0 ? void 0 : _ranker$parentNode.childNodes;
    var oldRank = Array.from(groupRankers).map(function (ranker_) {
      return ranker_.hasAttribute('data-selected');
    }).indexOf(true);
    var newRank = Array.from(groupRankers).indexOf(ranker); // Find the index of the sorter with an already selected 'newRank' ranker 

    var otherSorterIdxWithNewRank = Array.from(rankBoxes).map(function (box) {
      return box.children[newRank].hasAttribute('data-selected');
    }).indexOf(true);

    if (otherSorterIdxWithNewRank !== -1) {
      // Unselect the other 'newRank' ranker
      var otherOldRanker = rankBoxes[otherSorterIdxWithNewRank].children[newRank];
      otherOldRanker.removeAttribute('data-selected');
      otherOldRanker.style.borderColor = '#fff'; // Select the other 'oldRank' ranker

      var otherNewRanker = rankBoxes[otherSorterIdxWithNewRank].children[oldRank];
      otherNewRanker.setAttribute('data-selected', 'true');
      otherNewRanker.style.borderColor = rankingColors[oldRank];
    } // Select the 'newRank' ranker


    ranker.setAttribute('data-selected', 'true');
    ranker.style.borderColor = rankingColors[newRank]; // Unselect the 'oldRank' ranker

    var oldRanker = groupRankers[oldRank];
    oldRanker.removeAttribute('data-selected');
    oldRanker.style.borderColor = '#fff';
    rankedSort();
  }
  /**
   * 
   * @param sorter - the `blogSorter` that was clicked to sort the blog post cards
   */


  function sortHandler(sorter) {
    var _sorter$getAttribute;

    // pressing 'ALL' to reset all sorting and ranking
    var isAllSorter = blogSorters[0] === sorter;

    if (isAllSorter) {
      // reset (NOTE: do we need to specify sorters that are not allSorter?)
      blogSorters.forEach(function (sorter_) {
        return sorter_.setAttribute('data-sort', 'unordered');
      }); // reset the rankers

      rankers.forEach(function (ranker_) {
        ranker_.removeAttribute('data-selected');
        ranker_.style.borderColor = '#fff';
      }); // reset the caret icons indicating sort order

      blogSorters.forEach(function (sorter_) {
        var caret = sorter_.getElementsByTagName('i')[0];
        caret.classList.replace('fa-caret-down', 'fa-caret-up');
        caret.style.visibility = 'hidden';
      }); // hide the boxes of rankers

      rankBoxes.forEach(function (box) {
        return box.style.visibility = 'hidden';
      }); // reset card order and go to first page

      defaultSort();
      paginateResults(pageBtns[0], 0, pageSize);
      return;
    }

    var icon = sorter.getElementsByClassName('i')[0];
    var container = icon.nextElementSibling; // .rank-container

    var oldOrder = (_sorter$getAttribute = sorter.getAttribute('data-sort')) !== null && _sorter$getAttribute !== void 0 ? _sorter$getAttribute : '';
    if (!isOrderCycleKey(oldOrder)) return;
    var order = orderCycle[oldOrder]; // ASCENDING ORDER

    if (order === "asc") {
      // Display caret icon and ranking container
      icon.style.visibility = 'visible';
      container.style.visibility = 'visible'; // Retrieve next available rank for the sorter and its corresponding 'sorter-ranker'

      var takenRanks = Array.from(rankBoxes).map(function (box) {
        return Array.from(box.children).map(function (ranker_) {
          return ranker_.hasAttribute('data-selected');
        }).indexOf(true);
      }).filter(function (idx) {
        return idx !== -1;
      });
      var rank = availableRanks.filter(function (idx) {
        return !takenRanks.includes(idx);
      })[0]; // Update ranker visually to reflect the priority of the sorter selected

      var ranker = container.children[rank];
      ranker.style.borderColor = rankingColors[rank];
      ranker.setAttribute('data-selected', 'true'); // DESCENDING ORDER
    } else if (order === "desc") {
      // Change the caret icon used
      icon.classList.replace('fa-caret-up', 'fa-caret-down'); // UNORDERED 
    } else {
      // Reset the caret icon to 'up' and hide it from view
      icon.classList.replace('fa-caret-down', 'fa-caret-up');
      icon.style.visibility = 'hidden'; // Hide rankers contaner

      container.style.visibility = 'hidden'; // Unselect rankers and set them to the default color

      container.childNodes.forEach(function (ranker_) {
        ranker_.removeAttribute('data-selected');
        ranker_.style.borderColor = '#fff';
      });
    }

    sorter.setAttribute('data-sort', order);
    rankedSort();
    var pageNum = parseInt(pageNumEl === null || pageNumEl === void 0 ? void 0 : pageNumEl.textContent);
    paginateResults(pageBtns[currPageIdx], (pageNum - 1) * pageSize, Math.min(pageNum * pageSize, length));
  }

  pageBtns.forEach(function (btn) {
    return btn.addEventListener('click', function () {
      var btnIndex = Array.from(pageBtns).indexOf(btn);
      paginateResults.apply(void 0, [btn].concat(_toConsumableArray(getPageBounds(btnIndex))));
    });
  });
  rankers.forEach(function (ranker) {
    return ranker.addEventListener('click', function () {
      return handleRankersDisplay(ranker);
    });
  });
  blogSorters.forEach(function (sorter) {
    return sorter.addEventListener('click', function () {
      return sortHandler(sorter);
    });
  });
}
/**
 * Load tags and sorting from sessionStorage
$(window).on('load', () => {
  const searchTags = sessionStorage.getItem('searchTags');
  const sorters = sessionStorage.getItem('sorters');

  if (searchTags) {
    const tags = JSON.parse(searchTags);
    const tmpBadge = $(document.createElement('span').attr('class', 'blog-badge rounded-md text-white p-1 cursor-pointer whitespace-nowrap'));
    tags.forEach(({ name, color }) => 
      tmpBadge.clone()
        .html(name)
        .css('background-color', color)
        .appendTo($('#blog-search-spans'))
    );
    tmpBadge.remove();
  }
});
 */

/**
$('.page-button').not('.disabled').on ...
  const searchTags = $('#blog-search-spans .blog-badge').map(function(){
    return {
      name: $(this).text(),
      color: $(this).css('background-color')
    };
  }).get();

  const sorters = $('.blog-filter').slice(1, 5).map(function(){
    return {
      name: $(this).text(),
      sort: $('.blog-sorter', this).attr('data-sort'),
      rank: $('.sorter-ranker', this).index($('[data-selected]', this))
    };
  }).get();

  sessionStorage.setItem('searchTags', JSON.stringify(searchTags));
  sessionStorage.setItem('sorters', JSON.stringify(sorters));
  */

/***/ }),

/***/ "./src/main/scripts/components/carousel.ts":
/*!*************************************************!*\
  !*** ./src/main/scripts/components/carousel.ts ***!
  \*************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": function() { return /* export default binding */ __WEBPACK_DEFAULT_EXPORT__; }
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ "./node_modules/core-js/modules/web.dom-collections.for-each.js");
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.regexp.to-string.js */ "./node_modules/core-js/modules/es.regexp.to-string.js");
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");




/**
 * Load a carousel with indexing and shifting capabilities for displaying items
 */

/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__() {
  var items = document.querySelectorAll('.carousel-item');
  if (items.length <= 0) return;
  var arrows = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_3__.queryElementAll)(document, '.carousel-arrow-container a', HTMLAnchorElement);
  var dots = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_3__.queryElementAll)(document, '.carousel-dot', HTMLDivElement);
  var index = 0;
  /**
   * Choose a carousel item by position relative to current
   * @param n - amount to increment the active carousel item index by
   */

  var shiftCarouselItem = function shiftCarouselItem(n) {
    return selectCarouselItem(index += n);
  };
  /**
   * Choose a specific carousel item by absolute index in item array
   * @param n - the index of the item to be shown
   */


  function selectCarouselItem(n) {
    index = n; // handles edge-case cycling

    if (n >= items.length) index = 0;
    if (n < 0) index = items.length - 1; // wipes 'items' and 'dots' to ground hidden/inactive state

    items.forEach(function (item) {
      return item.classList.remove('active');
    });
    dots.forEach(function (dot) {
      return dot.classList.remove('active');
    }); // item and dot at 'index' are shown/activated

    items[index].classList.add('active');
    dots[index].classList.add('active');
  } // arrows cause a carousel shift


  arrows.forEach(function (arrow) {
    return arrow.addEventListener('click', function () {
      var _arrow$getAttribute;

      var shift = (_arrow$getAttribute = arrow.getAttribute('data-shift')) !== null && _arrow$getAttribute !== void 0 ? _arrow$getAttribute : '0';
      shiftCarouselItem(parseInt(shift));
    });
  }); // dots allow selecting a specific item

  dots.forEach(function (dot) {
    return dot.addEventListener('click', function () {
      var _dot$getAttribute;

      var newIdx = (_dot$getAttribute = dot.getAttribute('data-index')) !== null && _dot$getAttribute !== void 0 ? _dot$getAttribute : index.toString();
      shiftCarouselItem(parseInt(newIdx));
    });
  });
}

/***/ }),

/***/ "./src/main/scripts/components/events.ts":
/*!***********************************************!*\
  !*** ./src/main/scripts/components/events.ts ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "eventLoader": function() { return /* binding */ eventLoader; },
/* harmony export */   "calendarLoader": function() { return /* binding */ calendarLoader; }
/* harmony export */ });
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! regenerator-runtime/runtime.js */ "./node_modules/regenerator-runtime/runtime.js");
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.url.js */ "./node_modules/core-js/modules/web.url.js");
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ "./node_modules/core-js/modules/es.string.iterator.js");
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ "./node_modules/core-js/modules/es.array.iterator.js");
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "./node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.array.map.js */ "./node_modules/core-js/modules/es.array.map.js");
/* harmony import */ var core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_map_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ "./node_modules/core-js/modules/web.dom-collections.for-each.js");
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/es.regexp.to-string.js */ "./node_modules/core-js/modules/es.regexp.to-string.js");
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! core-js/modules/es.promise.js */ "./node_modules/core-js/modules/es.promise.js");
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "./node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");












function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }


/**
 * Load in an event detail card with social links when clicking a calendar block
 * @param socialDomains - list of domains to display social link buttons for
 */

var eventLoader = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
    var _ref2,
        _ref2$socialDomains,
        socialDomains,
        eventBlocks,
        detailCard,
        socialBlock,
        socialParams,
        loadAjaxSocialView,
        _loadAjaxSocialView,
        _args2 = arguments;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _loadAjaxSocialView = function _loadAjaxSocialView3() {
              _loadAjaxSocialView = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(block) {
                var _block$getAttribute;

                var pk, detailUrl, socialsUrl, _yield$import, loadHtml;

                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        pk = (_block$getAttribute = block.getAttribute('data-value')) === null || _block$getAttribute === void 0 ? void 0 : _block$getAttribute.toString();

                        if (pk) {
                          _context.next = 3;
                          break;
                        }

                        return _context.abrupt("return");

                      case 3:
                        socialParams.append('pk', pk);
                        detailUrl = '/events/event?' + new URLSearchParams({
                          pk: pk
                        });
                        socialsUrl = '/events/socials?' + socialParams;
                        _context.next = 8;
                        return Promise.all(/*! import() */[__webpack_require__.e("vendors"), __webpack_require__.e("src_main_scripts_utilities_api_ts")]).then(__webpack_require__.bind(__webpack_require__, /*! ../utilities/api */ "./src/main/scripts/utilities/api.ts"));

                      case 8:
                        _yield$import = _context.sent;
                        loadHtml = _yield$import.loadHtml;

                        try {
                          Promise.all([loadHtml(detailCard, detailUrl), loadHtml(socialBlock, socialsUrl)]);
                        } catch (error) {
                          console.error(error);
                        }

                      case 11:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              }));
              return _loadAjaxSocialView.apply(this, arguments);
            };

            loadAjaxSocialView = function _loadAjaxSocialView2(_x) {
              return _loadAjaxSocialView.apply(this, arguments);
            };

            _ref2 = _args2.length > 0 && _args2[0] !== undefined ? _args2[0] : {}, _ref2$socialDomains = _ref2.socialDomains, socialDomains = _ref2$socialDomains === void 0 ? [] : _ref2$socialDomains;
            eventBlocks = document.querySelectorAll('.multi-day-event, .single-day-event, #highlights-section .event');

            if (!(eventBlocks.length <= 0)) {
              _context2.next = 6;
              break;
            }

            return _context2.abrupt("return");

          case 6:
            detailCard = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElement)(document, '#detail-card', HTMLDivElement);
            socialBlock = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElement)(document, '#detail-social-container', HTMLDivElement);
            socialParams = new URLSearchParams(socialDomains.map(function (name) {
              return [name];
            }));
            /**
             * Call server for `TemplateResponse` inside of `detailCard` and `socialBlock`
             * @param block - an event block on calendar to load async info for
             */

            eventBlocks.forEach(function (block) {
              return block.addEventListener('click', function () {
                return loadAjaxSocialView(block);
              });
            });

          case 10:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));

  return function eventLoader() {
    return _ref.apply(this, arguments);
  };
}();
/**
 * Load in a new calendar, triggering `eventLoader` as well for these changes,
 * when any form button is clicked to increment the year or month
 */

var calendarLoader = function calendarLoader() {
  var calendar = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElement)(document, '#calendar', HTMLDivElement);
  var calButtons = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElementAll)(calendar, '#calendar-form button', HTMLButtonElement);
  var calYear = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElement)(document, '#calendar-year', HTMLInputElement);
  /**
   * 
   * @param button - a form button to trigger calendar form input adjustments
   */

  function updateInputs(button) {
    var _button$getAttribute, _button$getAttribute2;

    // the amount to increment the input value by (stored on element)
    var shift = parseInt((_button$getAttribute = button.getAttribute('data-shift')) !== null && _button$getAttribute !== void 0 ? _button$getAttribute : '0'); // map id of button element to hidden input element

    var buttonIdToInputId = {
      'month-up': 'calendar-month',
      'month-down': 'calendar-month',
      'year-up': 'calendar-year',
      'year-down': 'calendar-year'
    };

    var isValidKey = function isValidKey(x) {
      return x in buttonIdToInputId;
    }; // update hidden input element value by value of `shift`


    var id = (_button$getAttribute2 = button.getAttribute('id')) !== null && _button$getAttribute2 !== void 0 ? _button$getAttribute2 : '';

    if (isValidKey(id)) {
      var input = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_11__.queryElement)(document, "#".concat(buttonIdToInputId[id]), HTMLInputElement);
      var newVal = parseInt(input.value) + shift; // handle increments of `#calendar-year` input when `#calendar-month`
      // is adjusted from January to December or December to January

      if (['month-up', 'month-down'].includes(id)) {
        if (newVal === 0) {
          newVal = 12;
          calYear.value = (parseInt(calYear.value) - 1).toString();
        } else if (newVal === 13) {
          newVal = 1;
          calYear.value = (parseInt(calYear.value) + 1).toString();
        }
      }

      input.value = newVal.toString();
    }
  }
  /**
   * Display the new calendar by serializing the calendar form and loading async
   * @param button - a form button to trigger calendar re-render
   */


  function renderCalendar(_x2) {
    return _renderCalendar.apply(this, arguments);
  }

  function _renderCalendar() {
    _renderCalendar = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(button) {
      var form, url, _yield$import2, loadHtml;

      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              form = button.closest('form');
              url = '/events/filter?' + form.serialize();
              _context3.next = 4;
              return Promise.all(/*! import() */[__webpack_require__.e("vendors"), __webpack_require__.e("src_main_scripts_utilities_api_ts")]).then(__webpack_require__.bind(__webpack_require__, /*! ../utilities/api */ "./src/main/scripts/utilities/api.ts"));

            case 4:
              _yield$import2 = _context3.sent;
              loadHtml = _yield$import2.loadHtml;
              _context3.prev = 6;
              _context3.next = 9;
              return loadHtml(calendar, url);

            case 9:
              _context3.next = 11;
              return eventLoader();

            case 11:
              _context3.next = 16;
              break;

            case 13:
              _context3.prev = 13;
              _context3.t0 = _context3["catch"](6);
              console.error(_context3.t0);

            case 16:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, null, [[6, 13]]);
    }));
    return _renderCalendar.apply(this, arguments);
  }

  calButtons.forEach(function (btn) {
    return btn.addEventListener('click', function () {
      updateInputs(btn);
      renderCalendar(btn);
    });
  });
};

/***/ }),

/***/ "./src/main/scripts/components/forms.ts":
/*!**********************************************!*\
  !*** ./src/main/scripts/components/forms.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": function() { return /* binding */ formsLoader; }
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ "./node_modules/core-js/modules/web.dom-collections.for-each.js");
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.concat.js */ "./node_modules/core-js/modules/es.array.concat.js");
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.symbol.js */ "./node_modules/core-js/modules/es.symbol.js");
/* harmony import */ var core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.symbol.description.js */ "./node_modules/core-js/modules/es.symbol.description.js");
/* harmony import */ var core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_description_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.symbol.iterator.js */ "./node_modules/core-js/modules/es.symbol.iterator.js");
/* harmony import */ var core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_symbol_iterator_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ "./node_modules/core-js/modules/es.string.iterator.js");
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ "./node_modules/core-js/modules/es.array.iterator.js");
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "./node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! core-js/modules/es.array.from.js */ "./node_modules/core-js/modules/es.array.from.js");
/* harmony import */ var core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_from_js__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! core-js/modules/es.array.slice.js */ "./node_modules/core-js/modules/es.array.slice.js");
/* harmony import */ var core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_slice_js__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! core-js/modules/es.function.name.js */ "./node_modules/core-js/modules/es.function.name.js");
/* harmony import */ var core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_function_name_js__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }














/**
 * Component loader for a standard form container. Currently only needs to
 * support "required" input annotations for clearer user experience.
 * 
 * @remarks
 * Could be accomplished in templating rather than as an external script here
 */

function formsLoader() {
  var formContainer = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_12__.queryElement)(document, '#form-container', HTMLDivElement);
  var inputs = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_12__.queryElementAll)(formContainer, 'input[required]', HTMLInputElement);
  var textareas = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_12__.queryElementAll)(formContainer, 'textarea[required]', HTMLTextAreaElement);
  [].concat(_toConsumableArray(inputs), _toConsumableArray(textareas)).forEach(function (input) {
    var label = input.previousElementSibling;
    if (label) label.innerHTML += '<span style="color:red">&nbsp;*</span>';
  });
}

/***/ }),

/***/ "./src/main/scripts/components/index.ts":
/*!**********************************************!*\
  !*** ./src/main/scripts/components/index.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "archiveLoader": function() { return /* reexport safe */ _pdf__WEBPACK_IMPORTED_MODULE_0__.default; },
/* harmony export */   "eventLoader": function() { return /* reexport safe */ _events__WEBPACK_IMPORTED_MODULE_1__.eventLoader; },
/* harmony export */   "calendarLoader": function() { return /* reexport safe */ _events__WEBPACK_IMPORTED_MODULE_1__.calendarLoader; },
/* harmony export */   "carouselLoader": function() { return /* reexport safe */ _carousel__WEBPACK_IMPORTED_MODULE_2__.default; },
/* harmony export */   "otherMenusBoxLoader": function() { return /* reexport safe */ _menus__WEBPACK_IMPORTED_MODULE_3__.default; },
/* harmony export */   "shareLoader": function() { return /* reexport safe */ _blog__WEBPACK_IMPORTED_MODULE_4__.shareLoader; },
/* harmony export */   "searchLoader": function() { return /* reexport safe */ _blog__WEBPACK_IMPORTED_MODULE_4__.searchLoader; },
/* harmony export */   "rankedSortAndPaginationLoader": function() { return /* reexport safe */ _blog__WEBPACK_IMPORTED_MODULE_4__.rankedSortAndPaginationLoader; },
/* harmony export */   "formsLoader": function() { return /* reexport safe */ _forms__WEBPACK_IMPORTED_MODULE_5__.default; }
/* harmony export */ });
/* harmony import */ var _pdf__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./pdf */ "./src/main/scripts/components/pdf.ts");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./events */ "./src/main/scripts/components/events.ts");
/* harmony import */ var _carousel__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./carousel */ "./src/main/scripts/components/carousel.ts");
/* harmony import */ var _menus__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./menus */ "./src/main/scripts/components/menus.ts");
/* harmony import */ var _blog__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./blog */ "./src/main/scripts/components/blog.ts");
/* harmony import */ var _forms__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./forms */ "./src/main/scripts/components/forms.ts");







/***/ }),

/***/ "./src/main/scripts/components/menus.ts":
/*!**********************************************!*\
  !*** ./src/main/scripts/components/menus.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": function() { return /* binding */ otherMenusBoxLoader; }
/* harmony export */ });
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! regenerator-runtime/runtime.js */ "./node_modules/regenerator-runtime/runtime.js");
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_match_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.match.js */ "./node_modules/core-js/modules/es.string.match.js");
/* harmony import */ var core_js_modules_es_string_match_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_match_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.regexp.exec.js */ "./node_modules/core-js/modules/es.regexp.exec.js");
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.promise.js */ "./node_modules/core-js/modules/es.promise.js");
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.string.iterator.js */ "./node_modules/core-js/modules/es.string.iterator.js");
/* harmony import */ var core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_iterator_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.array.iterator.js */ "./node_modules/core-js/modules/es.array.iterator.js");
/* harmony import */ var core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_iterator_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "./node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/web.url.js */ "./node_modules/core-js/modules/web.url.js");
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");










function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }


/**
 * A component loader for the "other menus" area of the 'menus' page to allow
 * for quickly navigating to nearby menus
 */

function otherMenusBoxLoader() {
  var menusForwardBtn = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_9__.queryElement)(document, '#menus-forward', HTMLButtonElement);
  var menusBackwardBtn = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_9__.queryElement)(document, '#menus-backward', HTMLButtonElement);
  var menusBox = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_9__.queryElement)(document, '#other-menus-box', HTMLDivElement);
  var url = '/menus/others/';
  /**
   * Load the next page of weekly menus by seeking either forward or backward
   * @param direction - whether seeking proceeds backwards or forwards
   */

  function seekMenus(_x) {
    return _seekMenus.apply(this, arguments);
  }

  function _seekMenus() {
    _seekMenus = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(direction) {
      var isForward, edgeSelector, furthestAttr, furthestMenu, isFurthest, href, startDate, _yield$import, loadHtml, params;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              isForward = direction === "forward";
              edgeSelector = isForward ? 'a:first-child' : 'a:last-child';
              furthestAttr = isForward ? 'data-isnewest' : 'data-isoldest';
              furthestMenu = menusBox.querySelector(edgeSelector);
              isFurthest = furthestMenu === null || furthestMenu === void 0 ? void 0 : furthestMenu.hasAttribute(furthestAttr);

              if (isFurthest) {
                _context.next = 7;
                break;
              }

              return _context.abrupt("return");

            case 7:
              href = furthestMenu === null || furthestMenu === void 0 ? void 0 : furthestMenu.getAttribute('href');
              startDate = href === null || href === void 0 ? void 0 : href.match(/\d{4}-\d{2}-\d{2}/);

              if (startDate) {
                _context.next = 11;
                break;
              }

              return _context.abrupt("return");

            case 11:
              _context.next = 13;
              return Promise.all(/*! import() */[__webpack_require__.e("vendors"), __webpack_require__.e("src_main_scripts_utilities_api_ts")]).then(__webpack_require__.bind(__webpack_require__, /*! ../utilities/api */ "./src/main/scripts/utilities/api.ts"));

            case 13:
              _yield$import = _context.sent;
              loadHtml = _yield$import.loadHtml;
              params = new URLSearchParams({
                start_date: startDate[0],
                direction: direction
              });
              _context.prev = 16;
              _context.next = 19;
              return loadHtml(menusBox, "".concat(url, "?").concat(params));

            case 19:
              console.log('Menus loaded!');
              _context.next = 25;
              break;

            case 22:
              _context.prev = 22;
              _context.t0 = _context["catch"](16);
              console.error(_context.t0);

            case 25:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, null, [[16, 22]]);
    }));
    return _seekMenus.apply(this, arguments);
  }

  menusForwardBtn.addEventListener('click', function () {
    return seekMenus("forward");
  });
  menusBackwardBtn.addEventListener('click', function () {
    return seekMenus("backward");
  });
}

/***/ }),

/***/ "./src/main/scripts/components/pdf.ts":
/*!********************************************!*\
  !*** ./src/main/scripts/components/pdf.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": function() { return /* export default binding */ __WEBPACK_DEFAULT_EXPORT__; }
/* harmony export */ });
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! regenerator-runtime/runtime.js */ "./node_modules/regenerator-runtime/runtime.js");
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.concat.js */ "./node_modules/core-js/modules/es.array.concat.js");
/* harmony import */ var core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_concat_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_fill_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.fill.js */ "./node_modules/core-js/modules/es.array.fill.js");
/* harmony import */ var core_js_modules_es_array_fill_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_fill_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "./node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.regexp.exec.js */ "./node_modules/core-js/modules/es.regexp.exec.js");
/* harmony import */ var core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_exec_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/web.dom-collections.for-each.js */ "./node_modules/core-js/modules/web.dom-collections.for-each.js");
/* harmony import */ var core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_for_each_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.promise.js */ "./node_modules/core-js/modules/es.promise.js");
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! core-js/modules/es.regexp.to-string.js */ "./node_modules/core-js/modules/es.regexp.to-string.js");
/* harmony import */ var core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_regexp_to_string_js__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var pdfjs_dist__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! pdfjs-dist */ "./node_modules/pdfjs-dist/build/pdf.js");
/* harmony import */ var pdfjs_dist__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(pdfjs_dist__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var _utilities_query__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../utilities/query */ "./src/main/scripts/utilities/query.ts");










function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }



pdfjs_dist__WEBPACK_IMPORTED_MODULE_9__.GlobalWorkerOptions.workerSrc = '/frontend/node_modules/pdfjs-dist/build/pdf.worker.entry';
var width = 160,
    height = 240;
var audioColor = 'rgb(96, 165, 250)';
/**
 * Generate a thumbnail of a PDF page in an `HTMLCanvasElement`
 * @param page - A PDF.js abstraction of a document page to render in a canvas
 * @returns a Promise of a canvas element display with the page scaled to fit
 */

function generateThumbnail(_x) {
  return _generateThumbnail.apply(this, arguments);
}
/**
 * Extract a PDF document linked on a media element on the public archive page
 * and render a canvas image of the first page of the document on the element
 * @param item - The element to append an `HTMLCanvasElement` to
 */


function _generateThumbnail() {
  _generateThumbnail = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(page) {
    var canvas, vp, scale, canvasContext, viewport;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            canvas = document.createElement('canvas');
            canvas.setAttribute('width', width.toString());
            canvas.setAttribute('height', height.toString());
            vp = page.getViewport({
              scale: 1
            });
            scale = Math.min(width / vp.width, height / vp.height);
            canvasContext = canvas.getContext('2d');
            viewport = page.getViewport({
              scale: scale,
              rotation: 0,
              dontFlip: false
            });
            _context2.next = 9;
            return page.render({
              canvasContext: canvasContext,
              viewport: viewport
            }).promise;

          case 9:
            return _context2.abrupt("return", canvas);

          case 10:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));
  return _generateThumbnail.apply(this, arguments);
}

function appendDocumentThumbnail(_x2) {
  return _appendDocumentThumbnail.apply(this, arguments);
}

function _appendDocumentThumbnail() {
  _appendDocumentThumbnail = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(item) {
    var _ref3,
        pageNum,
        url,
        doc,
        page,
        thumbnailCanvas,
        _args3 = arguments;

    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _ref3 = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : {
              pageNum: 1
            }, pageNum = _ref3.pageNum;
            url = item.getAttribute('data-url');

            if (!url) {
              _context3.next = 19;
              break;
            }

            _context3.prev = 3;
            _context3.next = 6;
            return (0,pdfjs_dist__WEBPACK_IMPORTED_MODULE_9__.getDocument)(url).promise;

          case 6:
            doc = _context3.sent;
            _context3.next = 9;
            return doc.getPage(pageNum);

          case 9:
            page = _context3.sent;
            _context3.next = 12;
            return generateThumbnail(page);

          case 12:
            thumbnailCanvas = _context3.sent;
            item.appendChild(thumbnailCanvas);
            _context3.next = 19;
            break;

          case 16:
            _context3.prev = 16;
            _context3.t0 = _context3["catch"](3);
            console.error(_context3.t0);

          case 19:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, null, [[3, 16]]);
  }));
  return _appendDocumentThumbnail.apply(this, arguments);
}

;
/**
 * Animate the display and track the audio source of a media archive audio post
 * @param item - The `HTMLElement` with an `HTMLAudioElement` inside
 */

function trackAudio(item) {
  var audio = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, 'audio', HTMLAudioElement);
  var playEl = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, '.play', HTMLElement);
  var pauseEl = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, '.pause', HTMLDivElement);
  var elapsedEl = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, '.elapsed', HTMLSpanElement);
  var durationEl = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, '.duration', HTMLSpanElement);
  var canvas = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, 'canvas', HTMLCanvasElement);
  var ctx = canvas.getContext('2d');
  var width = canvas.width;
  var height = canvas.height;
  var externalLink = (0,_utilities_query__WEBPACK_IMPORTED_MODULE_10__.queryElement)(item, '.title-box i', HTMLElement);
  /**
   * Convert a numbered timestamp to a digital clock string (more user friendly)
   * @param totalSeconds - a timestamp in seconds to convert
   * @returns a string representation of a timestamp like on a digital clock
   */

  function digitalize(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = Math.floor(totalSeconds % 60);
    return "".concat(minutes, ":").concat(seconds < 10 ? 0 : '').concat(seconds);
  }
  /**
   * Render the elapsed time and audio duration as a typical digitized string
   * @param isUpdate - whether the element is being updated vs first shown
   */


  var displayTime = function displayTime() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$isUpdate = _ref.isUpdate,
        isUpdate = _ref$isUpdate === void 0 ? false : _ref$isUpdate;

    elapsedEl.innerHTML = digitalize(audio.currentTime);
    if (isUpdate) durationEl.innerHTML = digitalize(audio.duration);
  };
  /**
   * Redraw the colored, circular time tracker sibling to the `HTMLAudioElement`
   */


  var drawAudioTracker = function drawAudioTracker() {
    var elapsed = audio.currentTime;
    var duration = audio.duration;
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.fillStyle = audioColor;
    ctx.moveTo(width / 2, height / 2);
    ctx.arc(width / 2, height / 2, width / 2, 0, elapsed / duration * Math.PI * 2);
    ctx.lineTo(width / 2, height / 2);
    ctx.fill();
  };
  /**
   * Control source tracking and button display when "Play" is pressed
   */


  var pressPlay = function pressPlay() {
    playEl.classList.add('hidden');
    pauseEl.classList.replace('hidden', 'flex');
    audio.play();
  };
  /**
   * Control source tracking and button display when "Pause" is pressed
   */


  var pressPause = function pressPause() {
    pauseEl.classList.replace('flex', 'hidden');
    playEl.classList.remove('hidden');
    audio.pause();
  };

  audio.addEventListener('loadedmetadata', function () {
    return displayTime();
  });
  audio.addEventListener('timeupdate', function () {
    displayTime({
      isUpdate: true
    });
    drawAudioTracker(); // fix audio button display when the source finishes playing

    if (audio.currentTime === audio.duration) {
      playEl.classList.remove('hidden');
      pauseEl.classList.replace('flex', 'hidden');
    }
  });
  playEl.addEventListener('click', pressPlay);
  pauseEl.addEventListener('click', pressPause);
  externalLink.addEventListener('click', function () {
    return window.open(audio.src, '_blank');
  });
}

;
/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__() {
  var docs = document.querySelectorAll('.archive-item.pdf');
  var audios = document.querySelectorAll('.archive-item.audio');
  var sliders = document.querySelectorAll('.slider');

  function addSliderHorizontalScrolling(slider) {
    slider.addEventListener("wheel", function (event) {
      var scrollSpeed = 2;
      var willScrollLeft = event.deltaX < 0 && slider.scrollLeft > 0;
      var willScrollRight = event.deltaX > 0 && slider.scrollLeft < slider.scrollWidth - slider.clientWidth;

      if (willScrollLeft || willScrollRight) {
        event.preventDefault();
        slider.scrollBy({
          left: event.deltaX * scrollSpeed,
          behavior: "smooth"
        });
      }
    });
  } // synchronizes async pdf calls


  docs === null || docs === void 0 ? void 0 : docs.forEach( /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(doc) {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return appendDocumentThumbnail(doc);

            case 2:
              return _context.abrupt("return", _context.sent);

            case 3:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));

    return function (_x3) {
      return _ref2.apply(this, arguments);
    };
  }());
  audios === null || audios === void 0 ? void 0 : audios.forEach(function (audio) {
    return trackAudio(audio);
  });
  sliders === null || sliders === void 0 ? void 0 : sliders.forEach(function (slider) {
    return addSliderHorizontalScrolling(slider);
  });
}
;
/* KEEP TO SEE WORKING LEGACY
(async () => {
  const pdfjs = await import('pdfjs-dist/build/pdf');
  const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
})();
*/

/***/ }),

/***/ "?4a14":
/*!************************!*\
  !*** canvas (ignored) ***!
  \************************/
/***/ (function() {

/* (ignored) */

/***/ }),

/***/ "?fe90":
/*!********************!*\
  !*** fs (ignored) ***!
  \********************/
/***/ (function() {

/* (ignored) */

/***/ }),

/***/ "?d446":
/*!**********************!*\
  !*** http (ignored) ***!
  \**********************/
/***/ (function() {

/* (ignored) */

/***/ }),

/***/ "?4c38":
/*!***********************!*\
  !*** https (ignored) ***!
  \***********************/
/***/ (function() {

/* (ignored) */

/***/ }),

/***/ "?9f5f":
/*!*********************!*\
  !*** url (ignored) ***!
  \*********************/
/***/ (function() {

/* (ignored) */

/***/ }),

/***/ "?afbb":
/*!**********************!*\
  !*** zlib (ignored) ***!
  \**********************/
/***/ (function() {

/* (ignored) */

/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvc3JjX21haW5fc2NyaXB0c19jb21wb25lbnRzX2luZGV4X3RzLmNodW5rLmpzIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL2NvbXBvbmVudHMvYmxvZy50cyIsIndlYnBhY2s6Ly90ZmNfd2Vic2l0ZV9mcm9udGVuZC8uL3NyYy9tYWluL3NjcmlwdHMvY29tcG9uZW50cy9jYXJvdXNlbC50cyIsIndlYnBhY2s6Ly90ZmNfd2Vic2l0ZV9mcm9udGVuZC8uL3NyYy9tYWluL3NjcmlwdHMvY29tcG9uZW50cy9ldmVudHMudHMiLCJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL2NvbXBvbmVudHMvZm9ybXMudHMiLCJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL2NvbXBvbmVudHMvaW5kZXgudHMiLCJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL2NvbXBvbmVudHMvbWVudXMudHMiLCJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL2NvbXBvbmVudHMvcGRmLnRzIiwid2VicGFjazovL3RmY193ZWJzaXRlX2Zyb250ZW5kL2lnbm9yZWR8L2NvZGUvd2Vic2l0ZS9mcm9udGVuZC9ub2RlX21vZHVsZXMvcGRmanMtZGlzdC9idWlsZHxjYW52YXMiLCJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvaWdub3JlZHwvY29kZS93ZWJzaXRlL2Zyb250ZW5kL25vZGVfbW9kdWxlcy9wZGZqcy1kaXN0L2J1aWxkfGZzIiwid2VicGFjazovL3RmY193ZWJzaXRlX2Zyb250ZW5kL2lnbm9yZWR8L2NvZGUvd2Vic2l0ZS9mcm9udGVuZC9ub2RlX21vZHVsZXMvcGRmanMtZGlzdC9idWlsZHxodHRwIiwid2VicGFjazovL3RmY193ZWJzaXRlX2Zyb250ZW5kL2lnbm9yZWR8L2NvZGUvd2Vic2l0ZS9mcm9udGVuZC9ub2RlX21vZHVsZXMvcGRmanMtZGlzdC9idWlsZHxodHRwcyIsIndlYnBhY2s6Ly90ZmNfd2Vic2l0ZV9mcm9udGVuZC9pZ25vcmVkfC9jb2RlL3dlYnNpdGUvZnJvbnRlbmQvbm9kZV9tb2R1bGVzL3BkZmpzLWRpc3QvYnVpbGR8dXJsIiwid2VicGFjazovL3RmY193ZWJzaXRlX2Zyb250ZW5kL2lnbm9yZWR8L2NvZGUvd2Vic2l0ZS9mcm9udGVuZC9ub2RlX21vZHVsZXMvcGRmanMtZGlzdC9idWlsZHx6bGliIl0sInNvdXJjZXNDb250ZW50IjpbImZ1bmN0aW9uIF9zbGljZWRUb0FycmF5KGFyciwgaSkgeyByZXR1cm4gX2FycmF5V2l0aEhvbGVzKGFycikgfHwgX2l0ZXJhYmxlVG9BcnJheUxpbWl0KGFyciwgaSkgfHwgX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5KGFyciwgaSkgfHwgX25vbkl0ZXJhYmxlUmVzdCgpOyB9XG5cbmZ1bmN0aW9uIF9ub25JdGVyYWJsZVJlc3QoKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxcbkluIG9yZGVyIHRvIGJlIGl0ZXJhYmxlLCBub24tYXJyYXkgb2JqZWN0cyBtdXN0IGhhdmUgYSBbU3ltYm9sLml0ZXJhdG9yXSgpIG1ldGhvZC5cIik7IH1cblxuZnVuY3Rpb24gX2l0ZXJhYmxlVG9BcnJheUxpbWl0KGFyciwgaSkgeyBpZiAodHlwZW9mIFN5bWJvbCA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkpIHJldHVybjsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbXCJyZXR1cm5cIl0gIT0gbnVsbCkgX2lbXCJyZXR1cm5cIl0oKTsgfSBmaW5hbGx5IHsgaWYgKF9kKSB0aHJvdyBfZTsgfSB9IHJldHVybiBfYXJyOyB9XG5cbmZ1bmN0aW9uIF9hcnJheVdpdGhIb2xlcyhhcnIpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgcmV0dXJuIGFycjsgfVxuXG5mdW5jdGlvbiBfdG9Db25zdW1hYmxlQXJyYXkoYXJyKSB7IHJldHVybiBfYXJyYXlXaXRob3V0SG9sZXMoYXJyKSB8fCBfaXRlcmFibGVUb0FycmF5KGFycikgfHwgX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5KGFycikgfHwgX25vbkl0ZXJhYmxlU3ByZWFkKCk7IH1cblxuZnVuY3Rpb24gX25vbkl0ZXJhYmxlU3ByZWFkKCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIHNwcmVhZCBub24taXRlcmFibGUgaW5zdGFuY2UuXFxuSW4gb3JkZXIgdG8gYmUgaXRlcmFibGUsIG5vbi1hcnJheSBvYmplY3RzIG11c3QgaGF2ZSBhIFtTeW1ib2wuaXRlcmF0b3JdKCkgbWV0aG9kLlwiKTsgfVxuXG5mdW5jdGlvbiBfdW5zdXBwb3J0ZWRJdGVyYWJsZVRvQXJyYXkobywgbWluTGVuKSB7IGlmICghbykgcmV0dXJuOyBpZiAodHlwZW9mIG8gPT09IFwic3RyaW5nXCIpIHJldHVybiBfYXJyYXlMaWtlVG9BcnJheShvLCBtaW5MZW4pOyB2YXIgbiA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKS5zbGljZSg4LCAtMSk7IGlmIChuID09PSBcIk9iamVjdFwiICYmIG8uY29uc3RydWN0b3IpIG4gPSBvLmNvbnN0cnVjdG9yLm5hbWU7IGlmIChuID09PSBcIk1hcFwiIHx8IG4gPT09IFwiU2V0XCIpIHJldHVybiBBcnJheS5mcm9tKG8pOyBpZiAobiA9PT0gXCJBcmd1bWVudHNcIiB8fCAvXig/OlVpfEkpbnQoPzo4fDE2fDMyKSg/OkNsYW1wZWQpP0FycmF5JC8udGVzdChuKSkgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KG8sIG1pbkxlbik7IH1cblxuZnVuY3Rpb24gX2l0ZXJhYmxlVG9BcnJheShpdGVyKSB7IGlmICh0eXBlb2YgU3ltYm9sICE9PSBcInVuZGVmaW5lZFwiICYmIFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoaXRlcikpIHJldHVybiBBcnJheS5mcm9tKGl0ZXIpOyB9XG5cbmZ1bmN0aW9uIF9hcnJheVdpdGhvdXRIb2xlcyhhcnIpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KGFycik7IH1cblxuZnVuY3Rpb24gX2FycmF5TGlrZVRvQXJyYXkoYXJyLCBsZW4pIHsgaWYgKGxlbiA9PSBudWxsIHx8IGxlbiA+IGFyci5sZW5ndGgpIGxlbiA9IGFyci5sZW5ndGg7IGZvciAodmFyIGkgPSAwLCBhcnIyID0gbmV3IEFycmF5KGxlbik7IGkgPCBsZW47IGkrKykgeyBhcnIyW2ldID0gYXJyW2ldOyB9IHJldHVybiBhcnIyOyB9XG5cbmltcG9ydCBcInJlZ2VuZXJhdG9yLXJ1bnRpbWUvcnVudGltZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi5kb20tY29sbGVjdGlvbnMuZm9yLWVhY2guanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5hcnJheS5tYXAuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5hcnJheS5mcm9tLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3RyaW5nLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuaW5jbHVkZXMuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zdHJpbmcuaW5jbHVkZXMuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5hcnJheS5zbGljZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLm9iamVjdC50by1zdHJpbmcuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5yZWdleHAudG8tc3RyaW5nLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuZmlsdGVyLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3RyaW5nLnJlcGxhY2UuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5yZWdleHAuZXhlYy5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLmFycmF5LmNvbmNhdC5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLnByb21pc2UuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zeW1ib2wuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zeW1ib2wuZGVzY3JpcHRpb24uanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zeW1ib2wuaXRlcmF0b3IuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5hcnJheS5pdGVyYXRvci5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi5kb20tY29sbGVjdGlvbnMuaXRlcmF0b3IuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5mdW5jdGlvbi5uYW1lLmpzXCI7XG5cbmZ1bmN0aW9uIGFzeW5jR2VuZXJhdG9yU3RlcChnZW4sIHJlc29sdmUsIHJlamVjdCwgX25leHQsIF90aHJvdywga2V5LCBhcmcpIHsgdHJ5IHsgdmFyIGluZm8gPSBnZW5ba2V5XShhcmcpOyB2YXIgdmFsdWUgPSBpbmZvLnZhbHVlOyB9IGNhdGNoIChlcnJvcikgeyByZWplY3QoZXJyb3IpOyByZXR1cm47IH0gaWYgKGluZm8uZG9uZSkgeyByZXNvbHZlKHZhbHVlKTsgfSBlbHNlIHsgUHJvbWlzZS5yZXNvbHZlKHZhbHVlKS50aGVuKF9uZXh0LCBfdGhyb3cpOyB9IH1cblxuZnVuY3Rpb24gX2FzeW5jVG9HZW5lcmF0b3IoZm4pIHsgcmV0dXJuIGZ1bmN0aW9uICgpIHsgdmFyIHNlbGYgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzOyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2YXIgZ2VuID0gZm4uYXBwbHkoc2VsZiwgYXJncyk7IGZ1bmN0aW9uIF9uZXh0KHZhbHVlKSB7IGFzeW5jR2VuZXJhdG9yU3RlcChnZW4sIHJlc29sdmUsIHJlamVjdCwgX25leHQsIF90aHJvdywgXCJuZXh0XCIsIHZhbHVlKTsgfSBmdW5jdGlvbiBfdGhyb3coZXJyKSB7IGFzeW5jR2VuZXJhdG9yU3RlcChnZW4sIHJlc29sdmUsIHJlamVjdCwgX25leHQsIF90aHJvdywgXCJ0aHJvd1wiLCBlcnIpOyB9IF9uZXh0KHVuZGVmaW5lZCk7IH0pOyB9OyB9XG5cbmltcG9ydCB7IHF1ZXJ5RWxlbWVudCwgcXVlcnlFbGVtZW50QWxsIH0gZnJvbSAnLi4vdXRpbGl0aWVzL3F1ZXJ5Jztcbi8qKlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHNoYXJlTG9hZGVyKCkge1xuICB2YXIgc2hhcmVCdG5zID0gcXVlcnlFbGVtZW50QWxsKGRvY3VtZW50LCAnLmNhcmQtaW5mby1mb290ZXIgZGl2Omxhc3QtY2hpbGQnLCBIVE1MRWxlbWVudCk7XG4gIC8qKlxuICAgKiBDb3B5IHRoZSBVUkwgb24gYW4gZWxlbWVudCB0byB0aGUgYnJvd3NlciBjbGlwYm9hcmRcbiAgICogQHBhcmFtIGVsIC0gdGhlIGVsZW1lbnQgY2xpY2tlZCB3aXRoIGEgVVJMIHN0b3JlZCBhcyBhbiBhdHRyaWJ1dGVcbiAgICogQHJldHVybnMgYSBzdWNjZXNzL2ZhaWx1cmUgbWVzc2FnZSB0byBkaXNwbGF5IHRvIHVzZXJcbiAgICovXG5cbiAgZnVuY3Rpb24gY29weVVybChfeCkge1xuICAgIHJldHVybiBfY29weVVybC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG4gIC8qKlxuICAgKiBQYXNzIGEgbWVzc2FnZSB0byBhIGJveCB0byBkaXNwbGF5IGFuIGFsZXJ0IGZvciAzIHNlY29uZHNcbiAgICogQHBhcmFtIGVsIC0gdGhlIGVsZW1lbnQgY2xpY2tlZCB3aXRoIGEgVVJMXG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gdGhlIG1lc3NhZ2UgdG8gZGlzcGxheVxuICAgKi9cblxuXG4gIGZ1bmN0aW9uIF9jb3B5VXJsKCkge1xuICAgIF9jb3B5VXJsID0gX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlMihlbCkge1xuICAgICAgdmFyIHBlcm1pc3Npb24sIHVybDtcbiAgICAgIHJldHVybiByZWdlbmVyYXRvclJ1bnRpbWUud3JhcChmdW5jdGlvbiBfY2FsbGVlMiQoX2NvbnRleHQyKSB7XG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgc3dpdGNoIChfY29udGV4dDIucHJldiA9IF9jb250ZXh0Mi5uZXh0KSB7XG4gICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgIF9jb250ZXh0Mi5wcmV2ID0gMDtcbiAgICAgICAgICAgICAgX2NvbnRleHQyLm5leHQgPSAzO1xuICAgICAgICAgICAgICByZXR1cm4gbmF2aWdhdG9yLnBlcm1pc3Npb25zLnF1ZXJ5KHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImNsaXBib2FyZC13cml0ZVwiXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgIHBlcm1pc3Npb24gPSBfY29udGV4dDIuc2VudDtcblxuICAgICAgICAgICAgICBpZiAoIShwZXJtaXNzaW9uLnN0YXRlID09IFwiZ3JhbnRlZFwiIHx8IHBlcm1pc3Npb24uc3RhdGUgPT0gXCJwcm9tcHRcIikpIHtcbiAgICAgICAgICAgICAgICBfY29udGV4dDIubmV4dCA9IDEyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gd3JpdGUgdGhlIHVybCBzdG9yZWQgb24gdGhlIHNoYXJlIGJ1dHRvbiB0byB0aGUgY2xpcGJvYXJkXG4gICAgICAgICAgICAgIHVybCA9IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS11cmwnKTtcblxuICAgICAgICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICAgICAgX2NvbnRleHQyLm5leHQgPSA4O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiSW52YWxpZCBMaW5rXCIsXG4gICAgICAgICAgICAgICAgZXJyb3I6IEVycm9yKCdcXCdkYXRhLXVybFxcJyBub3QgZGVmaW5lZCBvbiBzaGFyZSBidXR0b24uJylcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgICBfY29udGV4dDIubmV4dCA9IDEwO1xuICAgICAgICAgICAgICByZXR1cm4gbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodXJsKTtcblxuICAgICAgICAgICAgY2FzZSAxMDpcbiAgICAgICAgICAgICAgX2NvbnRleHQyLm5leHQgPSAxMztcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMTI6XG4gICAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIkludmFsaWQgQ2xpcGJvYXJkIFBlcm1pc3Npb25zXCIsXG4gICAgICAgICAgICAgICAgZXJyb3I6IEVycm9yKFwiUGVybWlzc2lvblN0YXR1cyB2YWx1ZSAnXCIuY29uY2F0KHBlcm1pc3Npb24uc3RhdGUsIFwiJyBkb2VzIG5vdCBzdXBwb3J0XCIpICsgJ3dyaXRpbmcgdG8gXFwnbmF2aWdhdG9yLmNsaXBib2FyZFxcJycpXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNhc2UgMTM6XG4gICAgICAgICAgICAgIF9jb250ZXh0Mi5uZXh0ID0gMjI7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDE1OlxuICAgICAgICAgICAgICBfY29udGV4dDIucHJldiA9IDE1O1xuICAgICAgICAgICAgICBfY29udGV4dDIudDAgPSBfY29udGV4dDJbXCJjYXRjaFwiXSgwKTtcblxuICAgICAgICAgICAgICBpZiAoISghIV9jb250ZXh0Mi50MCAmJiBfY29udGV4dDIudDAuY29uc3RydWN0b3IgPT09IE9iamVjdCAmJiAnZXJyb3InIGluIF9jb250ZXh0Mi50MCkpIHtcbiAgICAgICAgICAgICAgICBfY29udGV4dDIubmV4dCA9IDIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihfY29udGV4dDIudDAuZXJyb3IpO1xuICAgICAgICAgICAgICByZXR1cm4gX2NvbnRleHQyLmFicnVwdChcInJldHVyblwiLCBcIkNvcHkgZmFpbGVkISAtIFwiLmNvbmNhdChfY29udGV4dDIudDAubWVzc2FnZSkpO1xuXG4gICAgICAgICAgICBjYXNlIDIwOlxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKF9jb250ZXh0Mi50MCk7XG4gICAgICAgICAgICAgIHJldHVybiBfY29udGV4dDIuYWJydXB0KFwicmV0dXJuXCIsICdDb3B5IGZhaWxlZCEnKTtcblxuICAgICAgICAgICAgY2FzZSAyMjpcbiAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0Mi5hYnJ1cHQoXCJyZXR1cm5cIiwgJ0NvcGllZCEnKTtcblxuICAgICAgICAgICAgY2FzZSAyMzpcbiAgICAgICAgICAgIGNhc2UgXCJlbmRcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0Mi5zdG9wKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCBfY2FsbGVlMiwgbnVsbCwgW1swLCAxNV1dKTtcbiAgICB9KSk7XG4gICAgcmV0dXJuIF9jb3B5VXJsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBmdW5jdGlvbiBkaXNwbGF5QWxlcnQoZWwsIG1lc3NhZ2UpIHtcbiAgICB2YXIgX2VsJGNsb3Nlc3Q7XG5cbiAgICB2YXIgYWxlcnQgPSAoX2VsJGNsb3Nlc3QgPSBlbC5jbG9zZXN0KCcuY2FyZCcpKSA9PT0gbnVsbCB8fCBfZWwkY2xvc2VzdCA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2VsJGNsb3Nlc3QucXVlcnlTZWxlY3RvcignLmNvcGllZC1hbGVydCcpO1xuICAgIHZhciBwID0gYWxlcnQgPT09IG51bGwgfHwgYWxlcnQgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGFsZXJ0LnF1ZXJ5U2VsZWN0b3IoJ3AnKTtcbiAgICBpZiAocCkgcC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgYWxlcnQgPT09IG51bGwgfHwgYWxlcnQgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGFsZXJ0LmNsYXNzTGlzdC5yZW1vdmUoJ2ludmlzaWJsZScpOyAvLyBvbmx5IGRpc3BsYXkgdGhlIGFsZXJ0IGJveCBmb3IgMyBzZWNvbmRzXG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBhbGVydCA9PT0gbnVsbCB8fCBhbGVydCA9PT0gdm9pZCAwID8gdm9pZCAwIDogYWxlcnQuY2xhc3NMaXN0LmFkZCgnaW52aXNpYmxlJyk7XG4gICAgfSwgMzAwMCk7XG4gIH1cblxuICBzaGFyZUJ0bnMuZm9yRWFjaChmdW5jdGlvbiAoc2hhcmVCdG4pIHtcbiAgICByZXR1cm4gc2hhcmVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAvKiNfX1BVUkVfXyovX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlKCkge1xuICAgICAgcmV0dXJuIHJlZ2VuZXJhdG9yUnVudGltZS53cmFwKGZ1bmN0aW9uIF9jYWxsZWUkKF9jb250ZXh0KSB7XG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgc3dpdGNoIChfY29udGV4dC5wcmV2ID0gX2NvbnRleHQubmV4dCkge1xuICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICBfY29udGV4dC50MCA9IGRpc3BsYXlBbGVydDtcbiAgICAgICAgICAgICAgX2NvbnRleHQudDEgPSBzaGFyZUJ0bjtcbiAgICAgICAgICAgICAgX2NvbnRleHQubmV4dCA9IDQ7XG4gICAgICAgICAgICAgIHJldHVybiBjb3B5VXJsKHNoYXJlQnRuKTtcblxuICAgICAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgICBfY29udGV4dC50MiA9IF9jb250ZXh0LnNlbnQ7XG4gICAgICAgICAgICAgIHJldHVybiBfY29udGV4dC5hYnJ1cHQoXCJyZXR1cm5cIiwgKDAsIF9jb250ZXh0LnQwKShfY29udGV4dC50MSwgX2NvbnRleHQudDIpKTtcblxuICAgICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgY2FzZSBcImVuZFwiOlxuICAgICAgICAgICAgICByZXR1cm4gX2NvbnRleHQuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgX2NhbGxlZSk7XG4gICAgfSkpKTtcbiAgfSk7XG59XG4vKipcbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBzZWFyY2hMb2FkZXIoKSB7XG4gIHZhciBjYXJkQmFkZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNhcmQgLmJsb2ctYmFkZ2UnKTtcbiAgdmFyIHNlYXJjaCA9IHF1ZXJ5RWxlbWVudChkb2N1bWVudCwgJyNibG9nLXNlYXJjaCcsIEhUTUxJbnB1dEVsZW1lbnQpO1xuICB2YXIgc2VhcmNoQmFkZ2VCb3ggPSBxdWVyeUVsZW1lbnQoZG9jdW1lbnQsICcjYmxvZy1zZWFyY2gtc3BhbnMnLCBIVE1MRGl2RWxlbWVudCk7XG4gIHZhciBzZWFyY2hCYWRnZXMgPSBzZWFyY2hCYWRnZUJveC5xdWVyeVNlbGVjdG9yQWxsKCcuYmxvZy1iYWRnZScpO1xuICAvKipcbiAgICogSGFuZGxlIG1ha2luZyBhIGNsaWNrZWQgYGNhcmRCYWRnZWAgYSBgc2VhcmNoQmFkZ2VgIHRvb1xuICAgKiBAcGFyYW0gZWwgLSB0aGUgYmFkZ2Ugb24gYSBjYXJkIHRoYXQgd2FzIGNsaWNrZWQgdG8gYmUgaW5jbHVkZWQgaW4gc2VhcmNoXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFkZFNlYXJjaEJhZGdlKGVsKSB7XG4gICAgdmFyIHNlYXJjaFZhbHVlcyA9IEFycmF5LmZyb20oc2VhcmNoQmFkZ2VzKS5tYXAoZnVuY3Rpb24gKGVsKSB7XG4gICAgICByZXR1cm4gZWwudGV4dENvbnRlbnQ7XG4gICAgfSk7IC8vIGFkZCB0aGUgYmFkZ2UgdG8gc2VhcmNoIGJveCBpZiBub3QgYWxyZWFkeSB0aGVyZVxuXG4gICAgaWYgKGVsLnRleHRDb250ZW50ICYmICFzZWFyY2hWYWx1ZXMuaW5jbHVkZXMoZWwudGV4dENvbnRlbnQpKSB7XG4gICAgICB2YXIgYmFkZ2UgPSBlbC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICBiYWRnZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF9iYWRnZSRwYXJlbnROb2RlO1xuXG4gICAgICAgIHJldHVybiAoX2JhZGdlJHBhcmVudE5vZGUgPSBiYWRnZS5wYXJlbnROb2RlKSA9PT0gbnVsbCB8fCBfYmFkZ2UkcGFyZW50Tm9kZSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2JhZGdlJHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYmFkZ2UpO1xuICAgICAgfSk7XG4gICAgICBzZWFyY2hCYWRnZUJveC5hcHBlbmRDaGlsZChiYWRnZSk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBEZWxldGVzIHRoZSBsYXN0IGJhZGdlIGluIHRoZSBzZWFyY2ggYm94IG9ubHkgaWYgdGhlIHNlYXJjaCBpbnB1dCBoYXNcbiAgICogYSB0cnV0aHkgdmFsdWVcbiAgICovXG5cblxuICBmdW5jdGlvbiByZW1vdmVMYXN0U2VhcmNoQmFkZ2VJZkVtcHR5KCkge1xuICAgIGlmIChzZWFyY2gudmFsdWUgPT09ICcnKSB7XG4gICAgICB2YXIgX2xhc3QkcGFyZW50Tm9kZTtcblxuICAgICAgdmFyIGxhc3QgPSBzZWFyY2hCYWRnZXMgPT09IG51bGwgfHwgc2VhcmNoQmFkZ2VzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBzZWFyY2hCYWRnZXNbKHNlYXJjaEJhZGdlcyA9PT0gbnVsbCB8fCBzZWFyY2hCYWRnZXMgPT09IHZvaWQgMCA/IHZvaWQgMCA6IHNlYXJjaEJhZGdlcy5sZW5ndGgpIC0gMV07XG4gICAgICBsYXN0ID09PSBudWxsIHx8IGxhc3QgPT09IHZvaWQgMCA/IHZvaWQgMCA6IChfbGFzdCRwYXJlbnROb2RlID0gbGFzdC5wYXJlbnROb2RlKSA9PT0gbnVsbCB8fCBfbGFzdCRwYXJlbnROb2RlID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfbGFzdCRwYXJlbnROb2RlLnJlbW92ZUNoaWxkKGxhc3QpO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogQXBwZW5kIGEgbmV3IGJhZGdlIHRvIHRoZSBzZWFyY2ggYm94IHdpdGggdGhlIGNvbnRlbnRzIG9mIHRoZSBzZWFyY2ggYm94XG4gICAqL1xuXG5cbiAgZnVuY3Rpb24gYWRkVHlwZWRCYWRnZSgpIHtcbiAgICB2YXIgdmFsdWUgPSBzZWFyY2gudmFsdWU7XG4gICAgdmFyIHNlYXJjaFZhbHVlcyA9IEFycmF5LmZyb20oc2VhcmNoQmFkZ2VzKS5tYXAoZnVuY3Rpb24gKGVsKSB7XG4gICAgICByZXR1cm4gZWwudGV4dENvbnRlbnQ7XG4gICAgfSk7XG4gICAgdmFyIHR5cGVkQmFkZ2VDb2xvciA9ICdyZ2IoMTU2LCAxNjMsIDE3NSknO1xuXG4gICAgaWYgKHZhbHVlICE9PSAnJyAmJiAhc2VhcmNoVmFsdWVzLmluY2x1ZGVzKHZhbHVlKSkge1xuICAgICAgdmFyIGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgYmFkZ2UuY2xhc3NMaXN0LmFkZCgnYmxvZy1iYWRnZScpO1xuICAgICAgYmFkZ2Uuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdHlwZWRCYWRnZUNvbG9yO1xuICAgICAgYmFkZ2UudGV4dENvbnRlbnQgPSB2YWx1ZTtcbiAgICAgIHNlYXJjaEJhZGdlQm94LmFwcGVuZENoaWxkKGJhZGdlKTsgLy8gcmVzZXQgc2VhcmNoIGJveFxuXG4gICAgICBzZWFyY2gudmFsdWUgPSAnJztcbiAgICB9XG4gIH1cblxuICBBcnJheS5mcm9tKGNhcmRCYWRnZXMpLmZvckVhY2goZnVuY3Rpb24gKGJhZGdlKSB7XG4gICAgcmV0dXJuIGJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGFkZFNlYXJjaEJhZGdlKGJhZGdlKTtcbiAgICB9KTtcbiAgfSk7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBpZiAoc2VhcmNoLm1hdGNoZXMoJzpmb2N1cycpKSB7XG4gICAgICBzd2l0Y2ggKGV2ZW50LmtleSkge1xuICAgICAgICBjYXNlIFwiQmFja3NwYWNlXCI6XG4gICAgICAgICAgcmVtb3ZlTGFzdFNlYXJjaEJhZGdlSWZFbXB0eSgpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgXCJFbnRlclwiOlxuICAgICAgICAgIGFkZFR5cGVkQmFkZ2UoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuLyoqXG4gKiBJbXBsZW1lbnQgcmFua2VkIHNvcnRpbmcgd2l0aCBwYWdpbmF0aW9uIG9uIHRoZSBibG9nIGluZGV4IHBhZ2VcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFua2VkU29ydEFuZFBhZ2luYXRpb25Mb2FkZXIoKSB7XG4gIHZhciBhdmFpbGFibGVSYW5rcyA9IFswLCAxLCAyLCAzXTtcbiAgdmFyIHJhbmtpbmdDb2xvcnMgPSBbJ3JnYigyMzksIDY4LCA2OCknLCAncmdiKDE2LCAxODUsIDEyOSknLCAncmdiKDEzOSwgOTIsIDI0NiknLCAncmdiKDI0NSwgMTU4LCAxMSknXTtcbiAgdmFyIG9yZGVyQ3ljbGUgPSB7XG4gICAgdW5vcmRlcmVkOiBcImFzY1wiLFxuICAgIGFzYzogXCJkZXNjXCIsXG4gICAgZGVzYzogXCJ1bm9yZGVyZWRcIlxuICB9O1xuXG4gIHZhciBpc09yZGVyQ3ljbGVLZXkgPSBmdW5jdGlvbiBpc09yZGVyQ3ljbGVLZXkoa2V5KSB7XG4gICAgcmV0dXJuIGtleSBpbiBvcmRlckN5Y2xlO1xuICB9O1xuXG4gIHZhciBibG9nQ29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Jsb2ctbGlzdC1jb250YWluZXInKTtcbiAgdmFyIGJsb2dTb3J0ZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmJsb2ctc29ydGVyJyk7XG4gIHZhciByYW5rQm94ZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcucmFuay1jb250YWluZXInKTtcbiAgdmFyIHJhbmtlcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuc29ydGVyLXJhbmtlcicpO1xuICB2YXIgY2FyZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY2FyZCcpO1xuICB2YXIgcGFnZUJ0bnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcucGFnZS1idXR0b24nKTtcbiAgdmFyIHBhZ2VOdW1FbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYWdlLW51bScpO1xuICB2YXIgcGFnZVNpemUgPSA4O1xuICB2YXIgbGVuZ3RoID0gY2FyZHMubGVuZ3RoO1xuICB2YXIgY3VyclBhZ2VJZHggPSAyO1xuICB2YXIgc29ydENhcmRzID0gQXJyYXkucHJvdG90eXBlLnNvcnQuYmluZChjYXJkcyk7XG4gIC8qKlxuICAgKiBEaXNwbGF5IHRoZSBjb3JyZWN0IHBhZ2Ugb2YgcmVzdWx0cyBhbmQgYWRqdXN0IHRoZSBwYWdpbmF0aW9uIGNvbnRyb2xzXG4gICAqIEBwYXJhbSBidXR0b24gLSB0aGUgcGFnaW5hdGlvbiBidXR0b24gY2xpY2tlZCAoZmlyc3QsIHByZXYsIG5leHQsIGxhc3QsIC4uKVxuICAgKiBAcGFyYW0gc3RhcnQgLSB0aGUgaW5kZXggb2YgdGhlIHBhZ2UncyBmaXJzdCBpdGVtXG4gICAqIEBwYXJhbSBlbmQgLSB0aGUgaW5kZXggb2YgdGhlIHBhZ2UncyBsYXN0IGl0ZW1cbiAgICovXG5cbiAgZnVuY3Rpb24gcGFnaW5hdGVSZXN1bHRzKGJ1dHRvbiwgc3RhcnQsIGVuZCkge1xuICAgIC8vIHNob3J0IGNpcmN1aXQgZGlzYWJsZWQgYnV0dG9uc1xuICAgIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpKSByZXR1cm47IC8vIHNoaWZ0IGJ1dHRvbiBoaWdobGlnaHQgdG8gdGhlIGNsaWNrZWQgYnV0dG9uXG5cbiAgICBwYWdlQnRuc1tjdXJyUGFnZUlkeF0uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKTtcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTsgLy8gZGlzcGxheSBvbmx5IHRoZSBgY2FyZHNgIGZyb20gaW5kZXggYHN0YXJ0YCB0byBgZW5kYFxuXG4gICAgY2FyZHMuZm9yRWFjaChmdW5jdGlvbiAoY2FyZCkge1xuICAgICAgcmV0dXJuIGNhcmQuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgfSk7XG4gICAgQXJyYXkuZnJvbShjYXJkcykuc2xpY2Uoc3RhcnQsIGVuZCkuZm9yRWFjaChmdW5jdGlvbiAoY2FyZCkge1xuICAgICAgcmV0dXJuIGNhcmQuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG4gICAgfSk7IC8vIGRpc3BsYXkgdGhlIGFwcHJvcHJpYXRlIHBhZ2UgbnVtYmVyIGFuZCBzaGlmdCBidXR0b24gaGlnaGxpZ2h0IGJhY2tcblxuICAgIGlmIChwYWdlTnVtRWwpIHtcbiAgICAgIHBhZ2VOdW1FbC50ZXh0Q29udGVudCA9IChNYXRoLmZsb29yKHN0YXJ0IC8gcGFnZVNpemUpICsgMSkudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBidXR0b24uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKTtcbiAgICBwYWdlQnRuc1tjdXJyUGFnZUlkeF0uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTsgLy8gZGlzYWJsZSB0aGUgY29ycmVjdCBwYWdpbmF0aW9uIGJ1dHRvbnMgd2hlbiBvbiB0aGUgZmlyc3Qgb3IgbGFzdCBwYWdlXG5cbiAgICBBcnJheS5mcm9tKHBhZ2VCdG5zKS5zbGljZSgwLCBjdXJyUGFnZUlkeCkuZm9yRWFjaChmdW5jdGlvbiAoYnRuKSB7XG4gICAgICByZXR1cm4gYnRuLmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgc3RhcnQgPT09IDApO1xuICAgIH0pO1xuICAgIEFycmF5LmZyb20ocGFnZUJ0bnMpLnNsaWNlKGN1cnJQYWdlSWR4ICsgMSkuZm9yRWFjaChmdW5jdGlvbiAoYnRuKSB7XG4gICAgICByZXR1cm4gYnRuLmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgbGVuZ3RoIC0gc3RhcnQgPCBwYWdlU2l6ZSk7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSB0aGUgaW5kaWNlcyBvZiB0aGUgY2FyZHMgdG8gYmUgZGlzcGxheWVkXG4gICAqIEBwYXJhbSBidG5JbmRleCAtIHRoZSBjbGlja2VkIHBhZ2luYXRpb24gYnV0dG9uXG4gICAqIEByZXR1cm5zIHRoZSBzdGFydCBhbmQgZW5kaW5nIGluZGljZXMgb2YgdGhlIG5leHQgcGFnZSB0byBiZSBkaXNwbGF5ZWRcbiAgICovXG5cblxuICBmdW5jdGlvbiBnZXRQYWdlQm91bmRzKGJ0bkluZGV4KSB7XG4gICAgdmFyIHBhZ2VOdW1UZXh0ID0gcGFnZU51bUVsID09PSBudWxsIHx8IHBhZ2VOdW1FbCA9PT0gdm9pZCAwID8gdm9pZCAwIDogcGFnZU51bUVsLnRleHRDb250ZW50O1xuXG4gICAgaWYgKHBhZ2VOdW1UZXh0KSB7XG4gICAgICB2YXIgcGFnZU51bSA9IHBhcnNlSW50KHBhZ2VOdW1UZXh0KTtcblxuICAgICAgc3dpdGNoIChidG5JbmRleCkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgcGFnZVxuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgcmV0dXJuIFswLCBwYWdlU2l6ZV07XG4gICAgICAgIC8vIHRoZSBwcmV2aW91cyBwYWdlXG5cbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIHJldHVybiBbKHBhZ2VOdW0gLSAyKSAqIHBhZ2VTaXplLCAocGFnZU51bSAtIDEpICogcGFnZVNpemVdO1xuICAgICAgICAvLyB0aGUgY3VycmVudCBwYWdlXG5cbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHJldHVybiBbKHBhZ2VOdW0gLSAxKSAqIHBhZ2VTaXplLCBwYWdlTnVtICogcGFnZVNpemVdO1xuICAgICAgICAvLyB0aGUgbmV4dCBwYWdlXG5cbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHJldHVybiBbcGFnZU51bSAqIHBhZ2VTaXplLCBNYXRoLm1pbigocGFnZU51bSArIDEpICogcGFnZVNpemUsIGxlbmd0aCldO1xuICAgICAgICAvLyB0aGUgbGFzdCBwYWdlXG5cbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHJldHVybiBbbGVuZ3RoIC0gbGVuZ3RoICUgcGFnZVNpemUsIGxlbmd0aF07XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gWzAsIGxlbmd0aF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFswLCBsZW5ndGhdO1xuICB9XG4gIC8qKlxuICAgKiBTb3J0IHRoZSBjYXJkcyBieSB0aGVpciBpbmRleCB3aGVuIHJldHJpZXZlZCBmcm9tIHNlcnZlciAodGhlIHBvc3QgbnVtYmVyKVxuICAgKi9cblxuXG4gIGZ1bmN0aW9uIGRlZmF1bHRTb3J0KCkge1xuICAgIHNvcnRDYXJkcyhmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIHZhbHMgPSBbYSwgYl0ubWFwKGZ1bmN0aW9uIChjYXJkKSB7XG4gICAgICAgIHZhciBfY2FyZCRxdWVyeVNlbGVjdG9yO1xuXG4gICAgICAgIHJldHVybiBwYXJzZUludCgoKF9jYXJkJHF1ZXJ5U2VsZWN0b3IgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJy5wb3N0LW51bWJlcicpKSA9PT0gbnVsbCB8fCBfY2FyZCRxdWVyeVNlbGVjdG9yID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfY2FyZCRxdWVyeVNlbGVjdG9yLnRleHRDb250ZW50KSB8fCAnMCcpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdmFsc1swXSAtIHZhbHNbMV07XG4gICAgfSk7XG4gICAgY2FyZHMuZm9yRWFjaChmdW5jdGlvbiAoY2FyZCkge1xuICAgICAgdmFyIF9jYXJkJHBhcmVudE5vZGU7XG5cbiAgICAgIHJldHVybiAoX2NhcmQkcGFyZW50Tm9kZSA9IGNhcmQucGFyZW50Tm9kZSkgPT09IG51bGwgfHwgX2NhcmQkcGFyZW50Tm9kZSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2NhcmQkcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChjYXJkKTtcbiAgICB9KTtcbiAgICBibG9nQ29udGFpbmVyID09PSBudWxsIHx8IGJsb2dDb250YWluZXIgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGJsb2dDb250YWluZXIuYXBwZW5kLmFwcGx5KGJsb2dDb250YWluZXIsIF90b0NvbnN1bWFibGVBcnJheShBcnJheS5mcm9tKGNhcmRzKSkpO1xuICB9XG4gIC8qKlxuICAgKiBDYWxjdWxhdGVzIHRoZSByYW5rIG9mIGEgcGFydGljdWxhciBzb3J0ZXJcbiAgICogQHBhcmFtIGJveCAtIHRoZSByYW5rIGJveCB3aXRoIGEgcG90ZW50aWFsbHkgc2VsZWN0ZWQgcmFuayBpbnNpZGVcbiAgICogQHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBzZWxlY3RlZCBgcmFua2VyYCBjaGlsZCAoLTEgaWYgbm90aGluZylcbiAgICovXG5cblxuICBmdW5jdGlvbiBnZXRTZWxlY3RlZFJhbmsoYm94KSB7XG4gICAgdmFyIF9yYW5rZXJTZWxlY3RlZCRwYXJlbjtcblxuICAgIHZhciByYW5rZXJTZWxlY3RlZCA9IGJveC5xdWVyeVNlbGVjdG9yKCcuc29ydGVyLXJhbmtlcltkYXRhLXNlbGVjdGVkXScpO1xuICAgIHZhciByYW5rZXJzID0gcmFua2VyU2VsZWN0ZWQgPT09IG51bGwgfHwgcmFua2VyU2VsZWN0ZWQgPT09IHZvaWQgMCA/IHZvaWQgMCA6IChfcmFua2VyU2VsZWN0ZWQkcGFyZW4gPSByYW5rZXJTZWxlY3RlZC5wYXJlbnROb2RlKSA9PT0gbnVsbCB8fCBfcmFua2VyU2VsZWN0ZWQkcGFyZW4gPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9yYW5rZXJTZWxlY3RlZCRwYXJlbi5jaGlsZE5vZGVzO1xuICAgIGlmICghcmFua2VycykgcmV0dXJuIC0xO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHJhbmtlcnMpLmluZGV4T2YocmFua2VyU2VsZWN0ZWQpO1xuICB9XG4gIC8qKlxuICAgKiBTb3J0IHRoZSBjYXJkcyBieSB0aGUgcmFua2VkIHNvcnRlcnNcbiAgICovXG5cblxuICBmdW5jdGlvbiByYW5rZWRTb3J0KCkge1xuICAgIC8vIHJlc2V0IHRvIG9yaWdpbmFsIHNvcnRcbiAgICBkZWZhdWx0U29ydCgpOyAvLyBnZXQgYWxsIGFjdGl2ZSByYW5rIHNvcnRlcnMgaW4gcmV2ZXJzZWQgcmFua2luZyBvcmRlclxuXG4gICAgdmFyIHJhbmtzID0gQXJyYXkuZnJvbShyYW5rQm94ZXMpLm1hcChmdW5jdGlvbiAoYm94KSB7XG4gICAgICB2YXIgX2JveCRjbG9zZXN0LCBfYm94JGNsb3Nlc3QkcXVlcnlTZWw7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJveElkeDogQXJyYXkuZnJvbShyYW5rQm94ZXMpLmluZGV4T2YoYm94KSxcbiAgICAgICAgcmFuazogZ2V0U2VsZWN0ZWRSYW5rKGJveCksXG4gICAgICAgIG9yZGVyOiAoX2JveCRjbG9zZXN0ID0gYm94LmNsb3Nlc3QoJy5ibG9nLWZpbHRlcicpKSA9PT0gbnVsbCB8fCBfYm94JGNsb3Nlc3QgPT09IHZvaWQgMCA/IHZvaWQgMCA6IChfYm94JGNsb3Nlc3QkcXVlcnlTZWwgPSBfYm94JGNsb3Nlc3QucXVlcnlTZWxlY3RvcignLmJsb2ctc29ydGVyJykpID09PSBudWxsIHx8IF9ib3gkY2xvc2VzdCRxdWVyeVNlbCA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2JveCRjbG9zZXN0JHF1ZXJ5U2VsLmdldEF0dHJpYnV0ZSgnZGF0YS1zb3J0JylcbiAgICAgIH07XG4gICAgfSkuZmlsdGVyKGZ1bmN0aW9uIChfcmVmMikge1xuICAgICAgdmFyIHJhbmsgPSBfcmVmMi5yYW5rO1xuICAgICAgcmV0dXJuIHJhbmsgIT09IC0xO1xuICAgIH0pLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBiLnJhbmsgLSBhLnJhbms7XG4gICAgfSk7IC8vIHNvcnQgdGhlIGNhcmRzIGZvciBlYWNoIGFjdGl2ZSByYW5rZWQgc29ydGVyXG5cbiAgICByYW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChfcmVmMykge1xuICAgICAgdmFyIGJveElkeCA9IF9yZWYzLmJveElkeCxcbiAgICAgICAgICBvcmRlciA9IF9yZWYzLm9yZGVyO1xuICAgICAgc29ydENhcmRzKGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIC8vIHNldCB2YWx1ZXMgb2YgY29tcGFyaXNvbiBmb3Igc29ydGluZyBieSBleHRyYWN0aW5nIHRoZSBjb3JyZXNwb25kaW5nXG4gICAgICAgIC8vIHZhbHVlIGluIHRoZSBjYXJkIGZvb3RlciAoZGF0ZSBpcyB0aGUgZXhjZXB0aW9uIGJlY2F1c2UgaXQncyBkaXNwbGF5ZWRcbiAgICAgICAgLy8gc2VwYXJhdGVseSBhbmQgcmVxdWlyZXMgdGhlIHVzZSBvZiBgRGF0ZS5wYXJzZWApXG4gICAgICAgIHZhciBhVmFsLCBiVmFsO1xuXG4gICAgICAgIGlmIChib3hJZHggPT09IDMpIHtcbiAgICAgICAgICB2YXIgX21hcCA9IFthLCBiXS5tYXAoZnVuY3Rpb24gKGNhcmQpIHtcbiAgICAgICAgICAgIHZhciBfY2FyZCRxdWVyeVNlbGVjdG9yMjtcblxuICAgICAgICAgICAgcmV0dXJuIERhdGUucGFyc2UoKF9jYXJkJHF1ZXJ5U2VsZWN0b3IyID0gY2FyZC5xdWVyeVNlbGVjdG9yKCcuY2FyZC1pbmZvLWhlYWRlci1kYXRlJykpID09PSBudWxsIHx8IF9jYXJkJHF1ZXJ5U2VsZWN0b3IyID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfY2FyZCRxdWVyeVNlbGVjdG9yMi50ZXh0Q29udGVudCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB2YXIgX21hcDIgPSBfc2xpY2VkVG9BcnJheShfbWFwLCAyKTtcblxuICAgICAgICAgIGFWYWwgPSBfbWFwMlswXTtcbiAgICAgICAgICBiVmFsID0gX21hcDJbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHZhbHVlU2VsZWN0b3IgPSBcIi5jYXJkLWluZm8tZm9vdGVyIGRpdjpudGgtY2hpbGQoXCIuY29uY2F0KGJveElkeCArIDEsIFwiKSBwXCIpO1xuXG4gICAgICAgICAgdmFyIF9tYXAzID0gW2EsIGJdLm1hcChmdW5jdGlvbiAoY2FyZCkge1xuICAgICAgICAgICAgdmFyIF9jYXJkJHF1ZXJ5U2VsZWN0b3IkZywgX2NhcmQkcXVlcnlTZWxlY3RvcjM7XG5cbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludCgoX2NhcmQkcXVlcnlTZWxlY3RvciRnID0gKF9jYXJkJHF1ZXJ5U2VsZWN0b3IzID0gY2FyZC5xdWVyeVNlbGVjdG9yKHZhbHVlU2VsZWN0b3IpKSA9PT0gbnVsbCB8fCBfY2FyZCRxdWVyeVNlbGVjdG9yMyA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2NhcmQkcXVlcnlTZWxlY3RvcjMuZ2V0QXR0cmlidXRlKCdkYXRhLXZhbCcpKSAhPT0gbnVsbCAmJiBfY2FyZCRxdWVyeVNlbGVjdG9yJGcgIT09IHZvaWQgMCA/IF9jYXJkJHF1ZXJ5U2VsZWN0b3IkZyA6ICcwJyk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB2YXIgX21hcDQgPSBfc2xpY2VkVG9BcnJheShfbWFwMywgMik7XG5cbiAgICAgICAgICBhVmFsID0gX21hcDRbMF07XG4gICAgICAgICAgYlZhbCA9IF9tYXA0WzFdO1xuICAgICAgICB9IC8vIGFzY2VuZGluZyBvcmRlciByZXZlcnNlcyB0aGUgc3VidHJhY3Rpb24gb3JkZXIgZm9yIGNvbXBhcmlzb25cblxuXG4gICAgICAgIGlmIChvcmRlciA9PT0gXCJhc2NcIikgcmV0dXJuIGFWYWwgLSBiVmFsO1xuICAgICAgICByZXR1cm4gYlZhbCAtIGFWYWw7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjYXJkcy5mb3JFYWNoKGZ1bmN0aW9uIChjYXJkKSB7XG4gICAgICB2YXIgX2NhcmQkcGFyZW50Tm9kZTI7XG5cbiAgICAgIHJldHVybiAoX2NhcmQkcGFyZW50Tm9kZTIgPSBjYXJkLnBhcmVudE5vZGUpID09PSBudWxsIHx8IF9jYXJkJHBhcmVudE5vZGUyID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfY2FyZCRwYXJlbnROb2RlMi5yZW1vdmVDaGlsZChjYXJkKTtcbiAgICB9KTtcbiAgICBibG9nQ29udGFpbmVyID09PSBudWxsIHx8IGJsb2dDb250YWluZXIgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGJsb2dDb250YWluZXIuYXBwZW5kLmFwcGx5KGJsb2dDb250YWluZXIsIF90b0NvbnN1bWFibGVBcnJheShBcnJheS5mcm9tKGNhcmRzKSkpO1xuICB9XG4gIC8qKlxuICAgKiBBZGp1c3QgdGhlIGRpc3BsYXkgb2YgcmFua2luZyBidXR0b25zIGFuZCBpbml0aWF0ZSBhIHJhbmtlZCBzb3J0XG4gICAqIEBwYXJhbSByYW5rZXIgLSB0aGUgcmFua2VyIGRvdCBidXR0b24gdGhhdCBpbml0aWF0ZXMgc29ydGluZ1xuICAgKi9cblxuXG4gIGZ1bmN0aW9uIGhhbmRsZVJhbmtlcnNEaXNwbGF5KHJhbmtlcikge1xuICAgIHZhciBfcmFua2VyJHBhcmVudE5vZGU7XG5cbiAgICB2YXIgZ3JvdXBSYW5rZXJzID0gKF9yYW5rZXIkcGFyZW50Tm9kZSA9IHJhbmtlci5wYXJlbnROb2RlKSA9PT0gbnVsbCB8fCBfcmFua2VyJHBhcmVudE5vZGUgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9yYW5rZXIkcGFyZW50Tm9kZS5jaGlsZE5vZGVzO1xuICAgIHZhciBvbGRSYW5rID0gQXJyYXkuZnJvbShncm91cFJhbmtlcnMpLm1hcChmdW5jdGlvbiAocmFua2VyXykge1xuICAgICAgcmV0dXJuIHJhbmtlcl8uaGFzQXR0cmlidXRlKCdkYXRhLXNlbGVjdGVkJyk7XG4gICAgfSkuaW5kZXhPZih0cnVlKTtcbiAgICB2YXIgbmV3UmFuayA9IEFycmF5LmZyb20oZ3JvdXBSYW5rZXJzKS5pbmRleE9mKHJhbmtlcik7IC8vIEZpbmQgdGhlIGluZGV4IG9mIHRoZSBzb3J0ZXIgd2l0aCBhbiBhbHJlYWR5IHNlbGVjdGVkICduZXdSYW5rJyByYW5rZXIgXG5cbiAgICB2YXIgb3RoZXJTb3J0ZXJJZHhXaXRoTmV3UmFuayA9IEFycmF5LmZyb20ocmFua0JveGVzKS5tYXAoZnVuY3Rpb24gKGJveCkge1xuICAgICAgcmV0dXJuIGJveC5jaGlsZHJlbltuZXdSYW5rXS5oYXNBdHRyaWJ1dGUoJ2RhdGEtc2VsZWN0ZWQnKTtcbiAgICB9KS5pbmRleE9mKHRydWUpO1xuXG4gICAgaWYgKG90aGVyU29ydGVySWR4V2l0aE5ld1JhbmsgIT09IC0xKSB7XG4gICAgICAvLyBVbnNlbGVjdCB0aGUgb3RoZXIgJ25ld1JhbmsnIHJhbmtlclxuICAgICAgdmFyIG90aGVyT2xkUmFua2VyID0gcmFua0JveGVzW290aGVyU29ydGVySWR4V2l0aE5ld1JhbmtdLmNoaWxkcmVuW25ld1JhbmtdO1xuICAgICAgb3RoZXJPbGRSYW5rZXIucmVtb3ZlQXR0cmlidXRlKCdkYXRhLXNlbGVjdGVkJyk7XG4gICAgICBvdGhlck9sZFJhbmtlci5zdHlsZS5ib3JkZXJDb2xvciA9ICcjZmZmJzsgLy8gU2VsZWN0IHRoZSBvdGhlciAnb2xkUmFuaycgcmFua2VyXG5cbiAgICAgIHZhciBvdGhlck5ld1JhbmtlciA9IHJhbmtCb3hlc1tvdGhlclNvcnRlcklkeFdpdGhOZXdSYW5rXS5jaGlsZHJlbltvbGRSYW5rXTtcbiAgICAgIG90aGVyTmV3UmFua2VyLnNldEF0dHJpYnV0ZSgnZGF0YS1zZWxlY3RlZCcsICd0cnVlJyk7XG4gICAgICBvdGhlck5ld1Jhbmtlci5zdHlsZS5ib3JkZXJDb2xvciA9IHJhbmtpbmdDb2xvcnNbb2xkUmFua107XG4gICAgfSAvLyBTZWxlY3QgdGhlICduZXdSYW5rJyByYW5rZXJcblxuXG4gICAgcmFua2VyLnNldEF0dHJpYnV0ZSgnZGF0YS1zZWxlY3RlZCcsICd0cnVlJyk7XG4gICAgcmFua2VyLnN0eWxlLmJvcmRlckNvbG9yID0gcmFua2luZ0NvbG9yc1tuZXdSYW5rXTsgLy8gVW5zZWxlY3QgdGhlICdvbGRSYW5rJyByYW5rZXJcblxuICAgIHZhciBvbGRSYW5rZXIgPSBncm91cFJhbmtlcnNbb2xkUmFua107XG4gICAgb2xkUmFua2VyLnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS1zZWxlY3RlZCcpO1xuICAgIG9sZFJhbmtlci5zdHlsZS5ib3JkZXJDb2xvciA9ICcjZmZmJztcbiAgICByYW5rZWRTb3J0KCk7XG4gIH1cbiAgLyoqXG4gICAqIFxuICAgKiBAcGFyYW0gc29ydGVyIC0gdGhlIGBibG9nU29ydGVyYCB0aGF0IHdhcyBjbGlja2VkIHRvIHNvcnQgdGhlIGJsb2cgcG9zdCBjYXJkc1xuICAgKi9cblxuXG4gIGZ1bmN0aW9uIHNvcnRIYW5kbGVyKHNvcnRlcikge1xuICAgIHZhciBfc29ydGVyJGdldEF0dHJpYnV0ZTtcblxuICAgIC8vIHByZXNzaW5nICdBTEwnIHRvIHJlc2V0IGFsbCBzb3J0aW5nIGFuZCByYW5raW5nXG4gICAgdmFyIGlzQWxsU29ydGVyID0gYmxvZ1NvcnRlcnNbMF0gPT09IHNvcnRlcjtcblxuICAgIGlmIChpc0FsbFNvcnRlcikge1xuICAgICAgLy8gcmVzZXQgKE5PVEU6IGRvIHdlIG5lZWQgdG8gc3BlY2lmeSBzb3J0ZXJzIHRoYXQgYXJlIG5vdCBhbGxTb3J0ZXI/KVxuICAgICAgYmxvZ1NvcnRlcnMuZm9yRWFjaChmdW5jdGlvbiAoc29ydGVyXykge1xuICAgICAgICByZXR1cm4gc29ydGVyXy5zZXRBdHRyaWJ1dGUoJ2RhdGEtc29ydCcsICd1bm9yZGVyZWQnKTtcbiAgICAgIH0pOyAvLyByZXNldCB0aGUgcmFua2Vyc1xuXG4gICAgICByYW5rZXJzLmZvckVhY2goZnVuY3Rpb24gKHJhbmtlcl8pIHtcbiAgICAgICAgcmFua2VyXy5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtc2VsZWN0ZWQnKTtcbiAgICAgICAgcmFua2VyXy5zdHlsZS5ib3JkZXJDb2xvciA9ICcjZmZmJztcbiAgICAgIH0pOyAvLyByZXNldCB0aGUgY2FyZXQgaWNvbnMgaW5kaWNhdGluZyBzb3J0IG9yZGVyXG5cbiAgICAgIGJsb2dTb3J0ZXJzLmZvckVhY2goZnVuY3Rpb24gKHNvcnRlcl8pIHtcbiAgICAgICAgdmFyIGNhcmV0ID0gc29ydGVyXy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaScpWzBdO1xuICAgICAgICBjYXJldC5jbGFzc0xpc3QucmVwbGFjZSgnZmEtY2FyZXQtZG93bicsICdmYS1jYXJldC11cCcpO1xuICAgICAgICBjYXJldC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICB9KTsgLy8gaGlkZSB0aGUgYm94ZXMgb2YgcmFua2Vyc1xuXG4gICAgICByYW5rQm94ZXMuZm9yRWFjaChmdW5jdGlvbiAoYm94KSB7XG4gICAgICAgIHJldHVybiBib3guc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgfSk7IC8vIHJlc2V0IGNhcmQgb3JkZXIgYW5kIGdvIHRvIGZpcnN0IHBhZ2VcblxuICAgICAgZGVmYXVsdFNvcnQoKTtcbiAgICAgIHBhZ2luYXRlUmVzdWx0cyhwYWdlQnRuc1swXSwgMCwgcGFnZVNpemUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpY29uID0gc29ydGVyLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2knKVswXTtcbiAgICB2YXIgY29udGFpbmVyID0gaWNvbi5uZXh0RWxlbWVudFNpYmxpbmc7IC8vIC5yYW5rLWNvbnRhaW5lclxuXG4gICAgdmFyIG9sZE9yZGVyID0gKF9zb3J0ZXIkZ2V0QXR0cmlidXRlID0gc29ydGVyLmdldEF0dHJpYnV0ZSgnZGF0YS1zb3J0JykpICE9PSBudWxsICYmIF9zb3J0ZXIkZ2V0QXR0cmlidXRlICE9PSB2b2lkIDAgPyBfc29ydGVyJGdldEF0dHJpYnV0ZSA6ICcnO1xuICAgIGlmICghaXNPcmRlckN5Y2xlS2V5KG9sZE9yZGVyKSkgcmV0dXJuO1xuICAgIHZhciBvcmRlciA9IG9yZGVyQ3ljbGVbb2xkT3JkZXJdOyAvLyBBU0NFTkRJTkcgT1JERVJcblxuICAgIGlmIChvcmRlciA9PT0gXCJhc2NcIikge1xuICAgICAgLy8gRGlzcGxheSBjYXJldCBpY29uIGFuZCByYW5raW5nIGNvbnRhaW5lclxuICAgICAgaWNvbi5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7IC8vIFJldHJpZXZlIG5leHQgYXZhaWxhYmxlIHJhbmsgZm9yIHRoZSBzb3J0ZXIgYW5kIGl0cyBjb3JyZXNwb25kaW5nICdzb3J0ZXItcmFua2VyJ1xuXG4gICAgICB2YXIgdGFrZW5SYW5rcyA9IEFycmF5LmZyb20ocmFua0JveGVzKS5tYXAoZnVuY3Rpb24gKGJveCkge1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShib3guY2hpbGRyZW4pLm1hcChmdW5jdGlvbiAocmFua2VyXykge1xuICAgICAgICAgIHJldHVybiByYW5rZXJfLmhhc0F0dHJpYnV0ZSgnZGF0YS1zZWxlY3RlZCcpO1xuICAgICAgICB9KS5pbmRleE9mKHRydWUpO1xuICAgICAgfSkuZmlsdGVyKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgcmV0dXJuIGlkeCAhPT0gLTE7XG4gICAgICB9KTtcbiAgICAgIHZhciByYW5rID0gYXZhaWxhYmxlUmFua3MuZmlsdGVyKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgcmV0dXJuICF0YWtlblJhbmtzLmluY2x1ZGVzKGlkeCk7XG4gICAgICB9KVswXTsgLy8gVXBkYXRlIHJhbmtlciB2aXN1YWxseSB0byByZWZsZWN0IHRoZSBwcmlvcml0eSBvZiB0aGUgc29ydGVyIHNlbGVjdGVkXG5cbiAgICAgIHZhciByYW5rZXIgPSBjb250YWluZXIuY2hpbGRyZW5bcmFua107XG4gICAgICByYW5rZXIuc3R5bGUuYm9yZGVyQ29sb3IgPSByYW5raW5nQ29sb3JzW3JhbmtdO1xuICAgICAgcmFua2VyLnNldEF0dHJpYnV0ZSgnZGF0YS1zZWxlY3RlZCcsICd0cnVlJyk7IC8vIERFU0NFTkRJTkcgT1JERVJcbiAgICB9IGVsc2UgaWYgKG9yZGVyID09PSBcImRlc2NcIikge1xuICAgICAgLy8gQ2hhbmdlIHRoZSBjYXJldCBpY29uIHVzZWRcbiAgICAgIGljb24uY2xhc3NMaXN0LnJlcGxhY2UoJ2ZhLWNhcmV0LXVwJywgJ2ZhLWNhcmV0LWRvd24nKTsgLy8gVU5PUkRFUkVEIFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBSZXNldCB0aGUgY2FyZXQgaWNvbiB0byAndXAnIGFuZCBoaWRlIGl0IGZyb20gdmlld1xuICAgICAgaWNvbi5jbGFzc0xpc3QucmVwbGFjZSgnZmEtY2FyZXQtZG93bicsICdmYS1jYXJldC11cCcpO1xuICAgICAgaWNvbi5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7IC8vIEhpZGUgcmFua2VycyBjb250YW5lclxuXG4gICAgICBjb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nOyAvLyBVbnNlbGVjdCByYW5rZXJzIGFuZCBzZXQgdGhlbSB0byB0aGUgZGVmYXVsdCBjb2xvclxuXG4gICAgICBjb250YWluZXIuY2hpbGROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChyYW5rZXJfKSB7XG4gICAgICAgIHJhbmtlcl8ucmVtb3ZlQXR0cmlidXRlKCdkYXRhLXNlbGVjdGVkJyk7XG4gICAgICAgIHJhbmtlcl8uc3R5bGUuYm9yZGVyQ29sb3IgPSAnI2ZmZic7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzb3J0ZXIuc2V0QXR0cmlidXRlKCdkYXRhLXNvcnQnLCBvcmRlcik7XG4gICAgcmFua2VkU29ydCgpO1xuICAgIHZhciBwYWdlTnVtID0gcGFyc2VJbnQocGFnZU51bUVsID09PSBudWxsIHx8IHBhZ2VOdW1FbCA9PT0gdm9pZCAwID8gdm9pZCAwIDogcGFnZU51bUVsLnRleHRDb250ZW50KTtcbiAgICBwYWdpbmF0ZVJlc3VsdHMocGFnZUJ0bnNbY3VyclBhZ2VJZHhdLCAocGFnZU51bSAtIDEpICogcGFnZVNpemUsIE1hdGgubWluKHBhZ2VOdW0gKiBwYWdlU2l6ZSwgbGVuZ3RoKSk7XG4gIH1cblxuICBwYWdlQnRucy5mb3JFYWNoKGZ1bmN0aW9uIChidG4pIHtcbiAgICByZXR1cm4gYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGJ0bkluZGV4ID0gQXJyYXkuZnJvbShwYWdlQnRucykuaW5kZXhPZihidG4pO1xuICAgICAgcGFnaW5hdGVSZXN1bHRzLmFwcGx5KHZvaWQgMCwgW2J0bl0uY29uY2F0KF90b0NvbnN1bWFibGVBcnJheShnZXRQYWdlQm91bmRzKGJ0bkluZGV4KSkpKTtcbiAgICB9KTtcbiAgfSk7XG4gIHJhbmtlcnMuZm9yRWFjaChmdW5jdGlvbiAocmFua2VyKSB7XG4gICAgcmV0dXJuIHJhbmtlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBoYW5kbGVSYW5rZXJzRGlzcGxheShyYW5rZXIpO1xuICAgIH0pO1xuICB9KTtcbiAgYmxvZ1NvcnRlcnMuZm9yRWFjaChmdW5jdGlvbiAoc29ydGVyKSB7XG4gICAgcmV0dXJuIHNvcnRlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBzb3J0SGFuZGxlcihzb3J0ZXIpO1xuICAgIH0pO1xuICB9KTtcbn1cbi8qKlxuICogTG9hZCB0YWdzIGFuZCBzb3J0aW5nIGZyb20gc2Vzc2lvblN0b3JhZ2VcbiQod2luZG93KS5vbignbG9hZCcsICgpID0+IHtcbiAgY29uc3Qgc2VhcmNoVGFncyA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oJ3NlYXJjaFRhZ3MnKTtcbiAgY29uc3Qgc29ydGVycyA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oJ3NvcnRlcnMnKTtcblxuICBpZiAoc2VhcmNoVGFncykge1xuICAgIGNvbnN0IHRhZ3MgPSBKU09OLnBhcnNlKHNlYXJjaFRhZ3MpO1xuICAgIGNvbnN0IHRtcEJhZGdlID0gJChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJykuYXR0cignY2xhc3MnLCAnYmxvZy1iYWRnZSByb3VuZGVkLW1kIHRleHQtd2hpdGUgcC0xIGN1cnNvci1wb2ludGVyIHdoaXRlc3BhY2Utbm93cmFwJykpO1xuICAgIHRhZ3MuZm9yRWFjaCgoeyBuYW1lLCBjb2xvciB9KSA9PiBcbiAgICAgIHRtcEJhZGdlLmNsb25lKClcbiAgICAgICAgLmh0bWwobmFtZSlcbiAgICAgICAgLmNzcygnYmFja2dyb3VuZC1jb2xvcicsIGNvbG9yKVxuICAgICAgICAuYXBwZW5kVG8oJCgnI2Jsb2ctc2VhcmNoLXNwYW5zJykpXG4gICAgKTtcbiAgICB0bXBCYWRnZS5yZW1vdmUoKTtcbiAgfVxufSk7XG4gKi9cblxuLyoqXG4kKCcucGFnZS1idXR0b24nKS5ub3QoJy5kaXNhYmxlZCcpLm9uIC4uLlxuICBjb25zdCBzZWFyY2hUYWdzID0gJCgnI2Jsb2ctc2VhcmNoLXNwYW5zIC5ibG9nLWJhZGdlJykubWFwKGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICQodGhpcykudGV4dCgpLFxuICAgICAgY29sb3I6ICQodGhpcykuY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJylcbiAgICB9O1xuICB9KS5nZXQoKTtcblxuICBjb25zdCBzb3J0ZXJzID0gJCgnLmJsb2ctZmlsdGVyJykuc2xpY2UoMSwgNSkubWFwKGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICQodGhpcykudGV4dCgpLFxuICAgICAgc29ydDogJCgnLmJsb2ctc29ydGVyJywgdGhpcykuYXR0cignZGF0YS1zb3J0JyksXG4gICAgICByYW5rOiAkKCcuc29ydGVyLXJhbmtlcicsIHRoaXMpLmluZGV4KCQoJ1tkYXRhLXNlbGVjdGVkXScsIHRoaXMpKVxuICAgIH07XG4gIH0pLmdldCgpO1xuXG4gIHNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3NlYXJjaFRhZ3MnLCBKU09OLnN0cmluZ2lmeShzZWFyY2hUYWdzKSk7XG4gIHNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3NvcnRlcnMnLCBKU09OLnN0cmluZ2lmeShzb3J0ZXJzKSk7XG4gICovIiwiaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi5kb20tY29sbGVjdGlvbnMuZm9yLWVhY2guanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5vYmplY3QudG8tc3RyaW5nLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMucmVnZXhwLnRvLXN0cmluZy5qc1wiO1xuaW1wb3J0IHsgcXVlcnlFbGVtZW50QWxsIH0gZnJvbSAnLi4vdXRpbGl0aWVzL3F1ZXJ5Jztcbi8qKlxuICogTG9hZCBhIGNhcm91c2VsIHdpdGggaW5kZXhpbmcgYW5kIHNoaWZ0aW5nIGNhcGFiaWxpdGllcyBmb3IgZGlzcGxheWluZyBpdGVtc1xuICovXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGl0ZW1zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNhcm91c2VsLWl0ZW0nKTtcbiAgaWYgKGl0ZW1zLmxlbmd0aCA8PSAwKSByZXR1cm47XG4gIHZhciBhcnJvd3MgPSBxdWVyeUVsZW1lbnRBbGwoZG9jdW1lbnQsICcuY2Fyb3VzZWwtYXJyb3ctY29udGFpbmVyIGEnLCBIVE1MQW5jaG9yRWxlbWVudCk7XG4gIHZhciBkb3RzID0gcXVlcnlFbGVtZW50QWxsKGRvY3VtZW50LCAnLmNhcm91c2VsLWRvdCcsIEhUTUxEaXZFbGVtZW50KTtcbiAgdmFyIGluZGV4ID0gMDtcbiAgLyoqXG4gICAqIENob29zZSBhIGNhcm91c2VsIGl0ZW0gYnkgcG9zaXRpb24gcmVsYXRpdmUgdG8gY3VycmVudFxuICAgKiBAcGFyYW0gbiAtIGFtb3VudCB0byBpbmNyZW1lbnQgdGhlIGFjdGl2ZSBjYXJvdXNlbCBpdGVtIGluZGV4IGJ5XG4gICAqL1xuXG4gIHZhciBzaGlmdENhcm91c2VsSXRlbSA9IGZ1bmN0aW9uIHNoaWZ0Q2Fyb3VzZWxJdGVtKG4pIHtcbiAgICByZXR1cm4gc2VsZWN0Q2Fyb3VzZWxJdGVtKGluZGV4ICs9IG4pO1xuICB9O1xuICAvKipcbiAgICogQ2hvb3NlIGEgc3BlY2lmaWMgY2Fyb3VzZWwgaXRlbSBieSBhYnNvbHV0ZSBpbmRleCBpbiBpdGVtIGFycmF5XG4gICAqIEBwYXJhbSBuIC0gdGhlIGluZGV4IG9mIHRoZSBpdGVtIHRvIGJlIHNob3duXG4gICAqL1xuXG5cbiAgZnVuY3Rpb24gc2VsZWN0Q2Fyb3VzZWxJdGVtKG4pIHtcbiAgICBpbmRleCA9IG47IC8vIGhhbmRsZXMgZWRnZS1jYXNlIGN5Y2xpbmdcblxuICAgIGlmIChuID49IGl0ZW1zLmxlbmd0aCkgaW5kZXggPSAwO1xuICAgIGlmIChuIDwgMCkgaW5kZXggPSBpdGVtcy5sZW5ndGggLSAxOyAvLyB3aXBlcyAnaXRlbXMnIGFuZCAnZG90cycgdG8gZ3JvdW5kIGhpZGRlbi9pbmFjdGl2ZSBzdGF0ZVxuXG4gICAgaXRlbXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XG4gICAgfSk7XG4gICAgZG90cy5mb3JFYWNoKGZ1bmN0aW9uIChkb3QpIHtcbiAgICAgIHJldHVybiBkb3QuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XG4gICAgfSk7IC8vIGl0ZW0gYW5kIGRvdCBhdCAnaW5kZXgnIGFyZSBzaG93bi9hY3RpdmF0ZWRcblxuICAgIGl0ZW1zW2luZGV4XS5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbiAgICBkb3RzW2luZGV4XS5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbiAgfSAvLyBhcnJvd3MgY2F1c2UgYSBjYXJvdXNlbCBzaGlmdFxuXG5cbiAgYXJyb3dzLmZvckVhY2goZnVuY3Rpb24gKGFycm93KSB7XG4gICAgcmV0dXJuIGFycm93LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIF9hcnJvdyRnZXRBdHRyaWJ1dGU7XG5cbiAgICAgIHZhciBzaGlmdCA9IChfYXJyb3ckZ2V0QXR0cmlidXRlID0gYXJyb3cuZ2V0QXR0cmlidXRlKCdkYXRhLXNoaWZ0JykpICE9PSBudWxsICYmIF9hcnJvdyRnZXRBdHRyaWJ1dGUgIT09IHZvaWQgMCA/IF9hcnJvdyRnZXRBdHRyaWJ1dGUgOiAnMCc7XG4gICAgICBzaGlmdENhcm91c2VsSXRlbShwYXJzZUludChzaGlmdCkpO1xuICAgIH0pO1xuICB9KTsgLy8gZG90cyBhbGxvdyBzZWxlY3RpbmcgYSBzcGVjaWZpYyBpdGVtXG5cbiAgZG90cy5mb3JFYWNoKGZ1bmN0aW9uIChkb3QpIHtcbiAgICByZXR1cm4gZG90LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIF9kb3QkZ2V0QXR0cmlidXRlO1xuXG4gICAgICB2YXIgbmV3SWR4ID0gKF9kb3QkZ2V0QXR0cmlidXRlID0gZG90LmdldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcpKSAhPT0gbnVsbCAmJiBfZG90JGdldEF0dHJpYnV0ZSAhPT0gdm9pZCAwID8gX2RvdCRnZXRBdHRyaWJ1dGUgOiBpbmRleC50b1N0cmluZygpO1xuICAgICAgc2hpZnRDYXJvdXNlbEl0ZW0ocGFyc2VJbnQobmV3SWR4KSk7XG4gICAgfSk7XG4gIH0pO1xufSIsImltcG9ydCBcInJlZ2VuZXJhdG9yLXJ1bnRpbWUvcnVudGltZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi51cmwuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5vYmplY3QudG8tc3RyaW5nLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3RyaW5nLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuaXRlcmF0b3IuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy93ZWIuZG9tLWNvbGxlY3Rpb25zLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkubWFwLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvd2ViLmRvbS1jb2xsZWN0aW9ucy5mb3ItZWFjaC5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLnJlZ2V4cC50by1zdHJpbmcuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5wcm9taXNlLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuaW5jbHVkZXMuanNcIjtcblxuZnVuY3Rpb24gYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBrZXksIGFyZykgeyB0cnkgeyB2YXIgaW5mbyA9IGdlbltrZXldKGFyZyk7IHZhciB2YWx1ZSA9IGluZm8udmFsdWU7IH0gY2F0Y2ggKGVycm9yKSB7IHJlamVjdChlcnJvcik7IHJldHVybjsgfSBpZiAoaW5mby5kb25lKSB7IHJlc29sdmUodmFsdWUpOyB9IGVsc2UgeyBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4oX25leHQsIF90aHJvdyk7IH0gfVxuXG5mdW5jdGlvbiBfYXN5bmNUb0dlbmVyYXRvcihmbikgeyByZXR1cm4gZnVuY3Rpb24gKCkgeyB2YXIgc2VsZiA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHZhciBnZW4gPSBmbi5hcHBseShzZWxmLCBhcmdzKTsgZnVuY3Rpb24gX25leHQodmFsdWUpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcIm5leHRcIiwgdmFsdWUpOyB9IGZ1bmN0aW9uIF90aHJvdyhlcnIpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcInRocm93XCIsIGVycik7IH0gX25leHQodW5kZWZpbmVkKTsgfSk7IH07IH1cblxuaW1wb3J0IHsgcXVlcnlFbGVtZW50LCBxdWVyeUVsZW1lbnRBbGwgfSBmcm9tICcuLi91dGlsaXRpZXMvcXVlcnknO1xuLyoqXG4gKiBMb2FkIGluIGFuIGV2ZW50IGRldGFpbCBjYXJkIHdpdGggc29jaWFsIGxpbmtzIHdoZW4gY2xpY2tpbmcgYSBjYWxlbmRhciBibG9ja1xuICogQHBhcmFtIHNvY2lhbERvbWFpbnMgLSBsaXN0IG9mIGRvbWFpbnMgdG8gZGlzcGxheSBzb2NpYWwgbGluayBidXR0b25zIGZvclxuICovXG5cbmV4cG9ydCB2YXIgZXZlbnRMb2FkZXIgPSAvKiNfX1BVUkVfXyovZnVuY3Rpb24gKCkge1xuICB2YXIgX3JlZiA9IF9hc3luY1RvR2VuZXJhdG9yKCAvKiNfX1BVUkVfXyovcmVnZW5lcmF0b3JSdW50aW1lLm1hcmsoZnVuY3Rpb24gX2NhbGxlZTIoKSB7XG4gICAgdmFyIF9yZWYyLFxuICAgICAgICBfcmVmMiRzb2NpYWxEb21haW5zLFxuICAgICAgICBzb2NpYWxEb21haW5zLFxuICAgICAgICBldmVudEJsb2NrcyxcbiAgICAgICAgZGV0YWlsQ2FyZCxcbiAgICAgICAgc29jaWFsQmxvY2ssXG4gICAgICAgIHNvY2lhbFBhcmFtcyxcbiAgICAgICAgbG9hZEFqYXhTb2NpYWxWaWV3LFxuICAgICAgICBfbG9hZEFqYXhTb2NpYWxWaWV3LFxuICAgICAgICBfYXJnczIgPSBhcmd1bWVudHM7XG5cbiAgICByZXR1cm4gcmVnZW5lcmF0b3JSdW50aW1lLndyYXAoZnVuY3Rpb24gX2NhbGxlZTIkKF9jb250ZXh0Mikge1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgc3dpdGNoIChfY29udGV4dDIucHJldiA9IF9jb250ZXh0Mi5uZXh0KSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgX2xvYWRBamF4U29jaWFsVmlldyA9IGZ1bmN0aW9uIF9sb2FkQWpheFNvY2lhbFZpZXczKCkge1xuICAgICAgICAgICAgICBfbG9hZEFqYXhTb2NpYWxWaWV3ID0gX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlKGJsb2NrKSB7XG4gICAgICAgICAgICAgICAgdmFyIF9ibG9jayRnZXRBdHRyaWJ1dGU7XG5cbiAgICAgICAgICAgICAgICB2YXIgcGssIGRldGFpbFVybCwgc29jaWFsc1VybCwgX3lpZWxkJGltcG9ydCwgbG9hZEh0bWw7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVnZW5lcmF0b3JSdW50aW1lLndyYXAoZnVuY3Rpb24gX2NhbGxlZSQoX2NvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoX2NvbnRleHQucHJldiA9IF9jb250ZXh0Lm5leHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgICAgICAgICAgICBwayA9IChfYmxvY2skZ2V0QXR0cmlidXRlID0gYmxvY2suZ2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJykpID09PSBudWxsIHx8IF9ibG9jayRnZXRBdHRyaWJ1dGUgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9ibG9jayRnZXRBdHRyaWJ1dGUudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSAzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LmFicnVwdChcInJldHVyblwiKTtcblxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvY2lhbFBhcmFtcy5hcHBlbmQoJ3BrJywgcGspO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsVXJsID0gJy9ldmVudHMvZXZlbnQ/JyArIG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwazogcGtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc29jaWFsc1VybCA9ICcvZXZlbnRzL3NvY2lhbHM/JyArIHNvY2lhbFBhcmFtcztcbiAgICAgICAgICAgICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSA4O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGltcG9ydCgnLi4vdXRpbGl0aWVzL2FwaScpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSA4OlxuICAgICAgICAgICAgICAgICAgICAgICAgX3lpZWxkJGltcG9ydCA9IF9jb250ZXh0LnNlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkSHRtbCA9IF95aWVsZCRpbXBvcnQubG9hZEh0bWw7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKFtsb2FkSHRtbChkZXRhaWxDYXJkLCBkZXRhaWxVcmwpLCBsb2FkSHRtbChzb2NpYWxCbG9jaywgc29jaWFsc1VybCldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAxMTpcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZW5kXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX2NvbnRleHQuc3RvcCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgX2NhbGxlZSk7XG4gICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF9sb2FkQWpheFNvY2lhbFZpZXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxvYWRBamF4U29jaWFsVmlldyA9IGZ1bmN0aW9uIF9sb2FkQWpheFNvY2lhbFZpZXcyKF94KSB7XG4gICAgICAgICAgICAgIHJldHVybiBfbG9hZEFqYXhTb2NpYWxWaWV3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBfcmVmMiA9IF9hcmdzMi5sZW5ndGggPiAwICYmIF9hcmdzMlswXSAhPT0gdW5kZWZpbmVkID8gX2FyZ3MyWzBdIDoge30sIF9yZWYyJHNvY2lhbERvbWFpbnMgPSBfcmVmMi5zb2NpYWxEb21haW5zLCBzb2NpYWxEb21haW5zID0gX3JlZjIkc29jaWFsRG9tYWlucyA9PT0gdm9pZCAwID8gW10gOiBfcmVmMiRzb2NpYWxEb21haW5zO1xuICAgICAgICAgICAgZXZlbnRCbG9ja3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubXVsdGktZGF5LWV2ZW50LCAuc2luZ2xlLWRheS1ldmVudCwgI2hpZ2hsaWdodHMtc2VjdGlvbiAuZXZlbnQnKTtcblxuICAgICAgICAgICAgaWYgKCEoZXZlbnRCbG9ja3MubGVuZ3RoIDw9IDApKSB7XG4gICAgICAgICAgICAgIF9jb250ZXh0Mi5uZXh0ID0gNjtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBfY29udGV4dDIuYWJydXB0KFwicmV0dXJuXCIpO1xuXG4gICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgZGV0YWlsQ2FyZCA9IHF1ZXJ5RWxlbWVudChkb2N1bWVudCwgJyNkZXRhaWwtY2FyZCcsIEhUTUxEaXZFbGVtZW50KTtcbiAgICAgICAgICAgIHNvY2lhbEJsb2NrID0gcXVlcnlFbGVtZW50KGRvY3VtZW50LCAnI2RldGFpbC1zb2NpYWwtY29udGFpbmVyJywgSFRNTERpdkVsZW1lbnQpO1xuICAgICAgICAgICAgc29jaWFsUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhzb2NpYWxEb21haW5zLm1hcChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICByZXR1cm4gW25hbWVdO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBDYWxsIHNlcnZlciBmb3IgYFRlbXBsYXRlUmVzcG9uc2VgIGluc2lkZSBvZiBgZGV0YWlsQ2FyZGAgYW5kIGBzb2NpYWxCbG9ja2BcbiAgICAgICAgICAgICAqIEBwYXJhbSBibG9jayAtIGFuIGV2ZW50IGJsb2NrIG9uIGNhbGVuZGFyIHRvIGxvYWQgYXN5bmMgaW5mbyBmb3JcbiAgICAgICAgICAgICAqL1xuXG4gICAgICAgICAgICBldmVudEJsb2Nrcy5mb3JFYWNoKGZ1bmN0aW9uIChibG9jaykge1xuICAgICAgICAgICAgICByZXR1cm4gYmxvY2suYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRBamF4U29jaWFsVmlldyhibG9jayk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjYXNlIDEwOlxuICAgICAgICAgIGNhc2UgXCJlbmRcIjpcbiAgICAgICAgICAgIHJldHVybiBfY29udGV4dDIuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgX2NhbGxlZTIpO1xuICB9KSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGV2ZW50TG9hZGVyKCkge1xuICAgIHJldHVybiBfcmVmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH07XG59KCk7XG4vKipcbiAqIExvYWQgaW4gYSBuZXcgY2FsZW5kYXIsIHRyaWdnZXJpbmcgYGV2ZW50TG9hZGVyYCBhcyB3ZWxsIGZvciB0aGVzZSBjaGFuZ2VzLFxuICogd2hlbiBhbnkgZm9ybSBidXR0b24gaXMgY2xpY2tlZCB0byBpbmNyZW1lbnQgdGhlIHllYXIgb3IgbW9udGhcbiAqL1xuXG5leHBvcnQgdmFyIGNhbGVuZGFyTG9hZGVyID0gZnVuY3Rpb24gY2FsZW5kYXJMb2FkZXIoKSB7XG4gIHZhciBjYWxlbmRhciA9IHF1ZXJ5RWxlbWVudChkb2N1bWVudCwgJyNjYWxlbmRhcicsIEhUTUxEaXZFbGVtZW50KTtcbiAgdmFyIGNhbEJ1dHRvbnMgPSBxdWVyeUVsZW1lbnRBbGwoY2FsZW5kYXIsICcjY2FsZW5kYXItZm9ybSBidXR0b24nLCBIVE1MQnV0dG9uRWxlbWVudCk7XG4gIHZhciBjYWxZZWFyID0gcXVlcnlFbGVtZW50KGRvY3VtZW50LCAnI2NhbGVuZGFyLXllYXInLCBIVE1MSW5wdXRFbGVtZW50KTtcbiAgLyoqXG4gICAqIFxuICAgKiBAcGFyYW0gYnV0dG9uIC0gYSBmb3JtIGJ1dHRvbiB0byB0cmlnZ2VyIGNhbGVuZGFyIGZvcm0gaW5wdXQgYWRqdXN0bWVudHNcbiAgICovXG5cbiAgZnVuY3Rpb24gdXBkYXRlSW5wdXRzKGJ1dHRvbikge1xuICAgIHZhciBfYnV0dG9uJGdldEF0dHJpYnV0ZSwgX2J1dHRvbiRnZXRBdHRyaWJ1dGUyO1xuXG4gICAgLy8gdGhlIGFtb3VudCB0byBpbmNyZW1lbnQgdGhlIGlucHV0IHZhbHVlIGJ5IChzdG9yZWQgb24gZWxlbWVudClcbiAgICB2YXIgc2hpZnQgPSBwYXJzZUludCgoX2J1dHRvbiRnZXRBdHRyaWJ1dGUgPSBidXR0b24uZ2V0QXR0cmlidXRlKCdkYXRhLXNoaWZ0JykpICE9PSBudWxsICYmIF9idXR0b24kZ2V0QXR0cmlidXRlICE9PSB2b2lkIDAgPyBfYnV0dG9uJGdldEF0dHJpYnV0ZSA6ICcwJyk7IC8vIG1hcCBpZCBvZiBidXR0b24gZWxlbWVudCB0byBoaWRkZW4gaW5wdXQgZWxlbWVudFxuXG4gICAgdmFyIGJ1dHRvbklkVG9JbnB1dElkID0ge1xuICAgICAgJ21vbnRoLXVwJzogJ2NhbGVuZGFyLW1vbnRoJyxcbiAgICAgICdtb250aC1kb3duJzogJ2NhbGVuZGFyLW1vbnRoJyxcbiAgICAgICd5ZWFyLXVwJzogJ2NhbGVuZGFyLXllYXInLFxuICAgICAgJ3llYXItZG93bic6ICdjYWxlbmRhci15ZWFyJ1xuICAgIH07XG5cbiAgICB2YXIgaXNWYWxpZEtleSA9IGZ1bmN0aW9uIGlzVmFsaWRLZXkoeCkge1xuICAgICAgcmV0dXJuIHggaW4gYnV0dG9uSWRUb0lucHV0SWQ7XG4gICAgfTsgLy8gdXBkYXRlIGhpZGRlbiBpbnB1dCBlbGVtZW50IHZhbHVlIGJ5IHZhbHVlIG9mIGBzaGlmdGBcblxuXG4gICAgdmFyIGlkID0gKF9idXR0b24kZ2V0QXR0cmlidXRlMiA9IGJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2lkJykpICE9PSBudWxsICYmIF9idXR0b24kZ2V0QXR0cmlidXRlMiAhPT0gdm9pZCAwID8gX2J1dHRvbiRnZXRBdHRyaWJ1dGUyIDogJyc7XG5cbiAgICBpZiAoaXNWYWxpZEtleShpZCkpIHtcbiAgICAgIHZhciBpbnB1dCA9IHF1ZXJ5RWxlbWVudChkb2N1bWVudCwgXCIjXCIuY29uY2F0KGJ1dHRvbklkVG9JbnB1dElkW2lkXSksIEhUTUxJbnB1dEVsZW1lbnQpO1xuICAgICAgdmFyIG5ld1ZhbCA9IHBhcnNlSW50KGlucHV0LnZhbHVlKSArIHNoaWZ0OyAvLyBoYW5kbGUgaW5jcmVtZW50cyBvZiBgI2NhbGVuZGFyLXllYXJgIGlucHV0IHdoZW4gYCNjYWxlbmRhci1tb250aGBcbiAgICAgIC8vIGlzIGFkanVzdGVkIGZyb20gSmFudWFyeSB0byBEZWNlbWJlciBvciBEZWNlbWJlciB0byBKYW51YXJ5XG5cbiAgICAgIGlmIChbJ21vbnRoLXVwJywgJ21vbnRoLWRvd24nXS5pbmNsdWRlcyhpZCkpIHtcbiAgICAgICAgaWYgKG5ld1ZhbCA9PT0gMCkge1xuICAgICAgICAgIG5ld1ZhbCA9IDEyO1xuICAgICAgICAgIGNhbFllYXIudmFsdWUgPSAocGFyc2VJbnQoY2FsWWVhci52YWx1ZSkgLSAxKS50b1N0cmluZygpO1xuICAgICAgICB9IGVsc2UgaWYgKG5ld1ZhbCA9PT0gMTMpIHtcbiAgICAgICAgICBuZXdWYWwgPSAxO1xuICAgICAgICAgIGNhbFllYXIudmFsdWUgPSAocGFyc2VJbnQoY2FsWWVhci52YWx1ZSkgKyAxKS50b1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlucHV0LnZhbHVlID0gbmV3VmFsLnRvU3RyaW5nKCk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBEaXNwbGF5IHRoZSBuZXcgY2FsZW5kYXIgYnkgc2VyaWFsaXppbmcgdGhlIGNhbGVuZGFyIGZvcm0gYW5kIGxvYWRpbmcgYXN5bmNcbiAgICogQHBhcmFtIGJ1dHRvbiAtIGEgZm9ybSBidXR0b24gdG8gdHJpZ2dlciBjYWxlbmRhciByZS1yZW5kZXJcbiAgICovXG5cblxuICBmdW5jdGlvbiByZW5kZXJDYWxlbmRhcihfeDIpIHtcbiAgICByZXR1cm4gX3JlbmRlckNhbGVuZGFyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBmdW5jdGlvbiBfcmVuZGVyQ2FsZW5kYXIoKSB7XG4gICAgX3JlbmRlckNhbGVuZGFyID0gX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlMyhidXR0b24pIHtcbiAgICAgIHZhciBmb3JtLCB1cmwsIF95aWVsZCRpbXBvcnQyLCBsb2FkSHRtbDtcblxuICAgICAgcmV0dXJuIHJlZ2VuZXJhdG9yUnVudGltZS53cmFwKGZ1bmN0aW9uIF9jYWxsZWUzJChfY29udGV4dDMpIHtcbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICBzd2l0Y2ggKF9jb250ZXh0My5wcmV2ID0gX2NvbnRleHQzLm5leHQpIHtcbiAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgZm9ybSA9IGJ1dHRvbi5jbG9zZXN0KCdmb3JtJyk7XG4gICAgICAgICAgICAgIHVybCA9ICcvZXZlbnRzL2ZpbHRlcj8nICsgZm9ybS5zZXJpYWxpemUoKTtcbiAgICAgICAgICAgICAgX2NvbnRleHQzLm5leHQgPSA0O1xuICAgICAgICAgICAgICByZXR1cm4gaW1wb3J0KCcuLi91dGlsaXRpZXMvYXBpJyk7XG5cbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgX3lpZWxkJGltcG9ydDIgPSBfY29udGV4dDMuc2VudDtcbiAgICAgICAgICAgICAgbG9hZEh0bWwgPSBfeWllbGQkaW1wb3J0Mi5sb2FkSHRtbDtcbiAgICAgICAgICAgICAgX2NvbnRleHQzLnByZXYgPSA2O1xuICAgICAgICAgICAgICBfY29udGV4dDMubmV4dCA9IDk7XG4gICAgICAgICAgICAgIHJldHVybiBsb2FkSHRtbChjYWxlbmRhciwgdXJsKTtcblxuICAgICAgICAgICAgY2FzZSA5OlxuICAgICAgICAgICAgICBfY29udGV4dDMubmV4dCA9IDExO1xuICAgICAgICAgICAgICByZXR1cm4gZXZlbnRMb2FkZXIoKTtcblxuICAgICAgICAgICAgY2FzZSAxMTpcbiAgICAgICAgICAgICAgX2NvbnRleHQzLm5leHQgPSAxNjtcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMTM6XG4gICAgICAgICAgICAgIF9jb250ZXh0My5wcmV2ID0gMTM7XG4gICAgICAgICAgICAgIF9jb250ZXh0My50MCA9IF9jb250ZXh0M1tcImNhdGNoXCJdKDYpO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKF9jb250ZXh0My50MCk7XG5cbiAgICAgICAgICAgIGNhc2UgMTY6XG4gICAgICAgICAgICBjYXNlIFwiZW5kXCI6XG4gICAgICAgICAgICAgIHJldHVybiBfY29udGV4dDMuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgX2NhbGxlZTMsIG51bGwsIFtbNiwgMTNdXSk7XG4gICAgfSkpO1xuICAgIHJldHVybiBfcmVuZGVyQ2FsZW5kYXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIGNhbEJ1dHRvbnMuZm9yRWFjaChmdW5jdGlvbiAoYnRuKSB7XG4gICAgcmV0dXJuIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHVwZGF0ZUlucHV0cyhidG4pO1xuICAgICAgcmVuZGVyQ2FsZW5kYXIoYnRuKTtcbiAgICB9KTtcbiAgfSk7XG59OyIsImZ1bmN0aW9uIF90b0NvbnN1bWFibGVBcnJheShhcnIpIHsgcmV0dXJuIF9hcnJheVdpdGhvdXRIb2xlcyhhcnIpIHx8IF9pdGVyYWJsZVRvQXJyYXkoYXJyKSB8fCBfdW5zdXBwb3J0ZWRJdGVyYWJsZVRvQXJyYXkoYXJyKSB8fCBfbm9uSXRlcmFibGVTcHJlYWQoKTsgfVxuXG5mdW5jdGlvbiBfbm9uSXRlcmFibGVTcHJlYWQoKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gc3ByZWFkIG5vbi1pdGVyYWJsZSBpbnN0YW5jZS5cXG5JbiBvcmRlciB0byBiZSBpdGVyYWJsZSwgbm9uLWFycmF5IG9iamVjdHMgbXVzdCBoYXZlIGEgW1N5bWJvbC5pdGVyYXRvcl0oKSBtZXRob2QuXCIpOyB9XG5cbmZ1bmN0aW9uIF91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheShvLCBtaW5MZW4pIHsgaWYgKCFvKSByZXR1cm47IGlmICh0eXBlb2YgbyA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIF9hcnJheUxpa2VUb0FycmF5KG8sIG1pbkxlbik7IHZhciBuID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLnNsaWNlKDgsIC0xKTsgaWYgKG4gPT09IFwiT2JqZWN0XCIgJiYgby5jb25zdHJ1Y3RvcikgbiA9IG8uY29uc3RydWN0b3IubmFtZTsgaWYgKG4gPT09IFwiTWFwXCIgfHwgbiA9PT0gXCJTZXRcIikgcmV0dXJuIEFycmF5LmZyb20obyk7IGlmIChuID09PSBcIkFyZ3VtZW50c1wiIHx8IC9eKD86VWl8SSludCg/Ojh8MTZ8MzIpKD86Q2xhbXBlZCk/QXJyYXkkLy50ZXN0KG4pKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkobywgbWluTGVuKTsgfVxuXG5mdW5jdGlvbiBfaXRlcmFibGVUb0FycmF5KGl0ZXIpIHsgaWYgKHR5cGVvZiBTeW1ib2wgIT09IFwidW5kZWZpbmVkXCIgJiYgU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChpdGVyKSkgcmV0dXJuIEFycmF5LmZyb20oaXRlcik7IH1cblxuZnVuY3Rpb24gX2FycmF5V2l0aG91dEhvbGVzKGFycikgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSByZXR1cm4gX2FycmF5TGlrZVRvQXJyYXkoYXJyKTsgfVxuXG5mdW5jdGlvbiBfYXJyYXlMaWtlVG9BcnJheShhcnIsIGxlbikgeyBpZiAobGVuID09IG51bGwgfHwgbGVuID4gYXJyLmxlbmd0aCkgbGVuID0gYXJyLmxlbmd0aDsgZm9yICh2YXIgaSA9IDAsIGFycjIgPSBuZXcgQXJyYXkobGVuKTsgaSA8IGxlbjsgaSsrKSB7IGFycjJbaV0gPSBhcnJbaV07IH0gcmV0dXJuIGFycjI7IH1cblxuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi5kb20tY29sbGVjdGlvbnMuZm9yLWVhY2guanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5hcnJheS5jb25jYXQuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zeW1ib2wuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zeW1ib2wuZGVzY3JpcHRpb24uanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5vYmplY3QudG8tc3RyaW5nLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3ltYm9sLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3RyaW5nLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuaXRlcmF0b3IuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy93ZWIuZG9tLWNvbGxlY3Rpb25zLml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuYXJyYXkuZnJvbS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLmFycmF5LnNsaWNlLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuZnVuY3Rpb24ubmFtZS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlFbGVtZW50LCBxdWVyeUVsZW1lbnRBbGwgfSBmcm9tICcuLi91dGlsaXRpZXMvcXVlcnknO1xuLyoqXG4gKiBDb21wb25lbnQgbG9hZGVyIGZvciBhIHN0YW5kYXJkIGZvcm0gY29udGFpbmVyLiBDdXJyZW50bHkgb25seSBuZWVkcyB0b1xuICogc3VwcG9ydCBcInJlcXVpcmVkXCIgaW5wdXQgYW5ub3RhdGlvbnMgZm9yIGNsZWFyZXIgdXNlciBleHBlcmllbmNlLlxuICogXG4gKiBAcmVtYXJrc1xuICogQ291bGQgYmUgYWNjb21wbGlzaGVkIGluIHRlbXBsYXRpbmcgcmF0aGVyIHRoYW4gYXMgYW4gZXh0ZXJuYWwgc2NyaXB0IGhlcmVcbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmb3Jtc0xvYWRlcigpIHtcbiAgdmFyIGZvcm1Db250YWluZXIgPSBxdWVyeUVsZW1lbnQoZG9jdW1lbnQsICcjZm9ybS1jb250YWluZXInLCBIVE1MRGl2RWxlbWVudCk7XG4gIHZhciBpbnB1dHMgPSBxdWVyeUVsZW1lbnRBbGwoZm9ybUNvbnRhaW5lciwgJ2lucHV0W3JlcXVpcmVkXScsIEhUTUxJbnB1dEVsZW1lbnQpO1xuICB2YXIgdGV4dGFyZWFzID0gcXVlcnlFbGVtZW50QWxsKGZvcm1Db250YWluZXIsICd0ZXh0YXJlYVtyZXF1aXJlZF0nLCBIVE1MVGV4dEFyZWFFbGVtZW50KTtcbiAgW10uY29uY2F0KF90b0NvbnN1bWFibGVBcnJheShpbnB1dHMpLCBfdG9Db25zdW1hYmxlQXJyYXkodGV4dGFyZWFzKSkuZm9yRWFjaChmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgbGFiZWwgPSBpbnB1dC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICAgIGlmIChsYWJlbCkgbGFiZWwuaW5uZXJIVE1MICs9ICc8c3BhbiBzdHlsZT1cImNvbG9yOnJlZFwiPiZuYnNwOyo8L3NwYW4+JztcbiAgfSk7XG59IiwiZXhwb3J0IHsgZGVmYXVsdCBhcyBhcmNoaXZlTG9hZGVyIH0gZnJvbSAnLi9wZGYnO1xuZXhwb3J0IHsgZXZlbnRMb2FkZXIsIGNhbGVuZGFyTG9hZGVyIH0gZnJvbSAnLi9ldmVudHMnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBjYXJvdXNlbExvYWRlciB9IGZyb20gJy4vY2Fyb3VzZWwnO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBvdGhlck1lbnVzQm94TG9hZGVyIH0gZnJvbSAnLi9tZW51cyc7XG5leHBvcnQgeyBzaGFyZUxvYWRlciwgc2VhcmNoTG9hZGVyLCByYW5rZWRTb3J0QW5kUGFnaW5hdGlvbkxvYWRlciB9IGZyb20gJy4vYmxvZyc7XG5leHBvcnQgeyBkZWZhdWx0IGFzIGZvcm1zTG9hZGVyIH0gZnJvbSAnLi9mb3Jtcyc7IiwiaW1wb3J0IFwicmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMuc3RyaW5nLm1hdGNoLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMucmVnZXhwLmV4ZWMuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5wcm9taXNlLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMub2JqZWN0LnRvLXN0cmluZy5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLnN0cmluZy5pdGVyYXRvci5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLmFycmF5Lml0ZXJhdG9yLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvd2ViLmRvbS1jb2xsZWN0aW9ucy5pdGVyYXRvci5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL3dlYi51cmwuanNcIjtcblxuZnVuY3Rpb24gYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBrZXksIGFyZykgeyB0cnkgeyB2YXIgaW5mbyA9IGdlbltrZXldKGFyZyk7IHZhciB2YWx1ZSA9IGluZm8udmFsdWU7IH0gY2F0Y2ggKGVycm9yKSB7IHJlamVjdChlcnJvcik7IHJldHVybjsgfSBpZiAoaW5mby5kb25lKSB7IHJlc29sdmUodmFsdWUpOyB9IGVsc2UgeyBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4oX25leHQsIF90aHJvdyk7IH0gfVxuXG5mdW5jdGlvbiBfYXN5bmNUb0dlbmVyYXRvcihmbikgeyByZXR1cm4gZnVuY3Rpb24gKCkgeyB2YXIgc2VsZiA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHZhciBnZW4gPSBmbi5hcHBseShzZWxmLCBhcmdzKTsgZnVuY3Rpb24gX25leHQodmFsdWUpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcIm5leHRcIiwgdmFsdWUpOyB9IGZ1bmN0aW9uIF90aHJvdyhlcnIpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcInRocm93XCIsIGVycik7IH0gX25leHQodW5kZWZpbmVkKTsgfSk7IH07IH1cblxuaW1wb3J0IHsgcXVlcnlFbGVtZW50IH0gZnJvbSAnLi4vdXRpbGl0aWVzL3F1ZXJ5Jztcbi8qKlxuICogQSBjb21wb25lbnQgbG9hZGVyIGZvciB0aGUgXCJvdGhlciBtZW51c1wiIGFyZWEgb2YgdGhlICdtZW51cycgcGFnZSB0byBhbGxvd1xuICogZm9yIHF1aWNrbHkgbmF2aWdhdGluZyB0byBuZWFyYnkgbWVudXNcbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBvdGhlck1lbnVzQm94TG9hZGVyKCkge1xuICB2YXIgbWVudXNGb3J3YXJkQnRuID0gcXVlcnlFbGVtZW50KGRvY3VtZW50LCAnI21lbnVzLWZvcndhcmQnLCBIVE1MQnV0dG9uRWxlbWVudCk7XG4gIHZhciBtZW51c0JhY2t3YXJkQnRuID0gcXVlcnlFbGVtZW50KGRvY3VtZW50LCAnI21lbnVzLWJhY2t3YXJkJywgSFRNTEJ1dHRvbkVsZW1lbnQpO1xuICB2YXIgbWVudXNCb3ggPSBxdWVyeUVsZW1lbnQoZG9jdW1lbnQsICcjb3RoZXItbWVudXMtYm94JywgSFRNTERpdkVsZW1lbnQpO1xuICB2YXIgdXJsID0gJy9tZW51cy9vdGhlcnMvJztcbiAgLyoqXG4gICAqIExvYWQgdGhlIG5leHQgcGFnZSBvZiB3ZWVrbHkgbWVudXMgYnkgc2Vla2luZyBlaXRoZXIgZm9yd2FyZCBvciBiYWNrd2FyZFxuICAgKiBAcGFyYW0gZGlyZWN0aW9uIC0gd2hldGhlciBzZWVraW5nIHByb2NlZWRzIGJhY2t3YXJkcyBvciBmb3J3YXJkc1xuICAgKi9cblxuICBmdW5jdGlvbiBzZWVrTWVudXMoX3gpIHtcbiAgICByZXR1cm4gX3NlZWtNZW51cy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gX3NlZWtNZW51cygpIHtcbiAgICBfc2Vla01lbnVzID0gX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlKGRpcmVjdGlvbikge1xuICAgICAgdmFyIGlzRm9yd2FyZCwgZWRnZVNlbGVjdG9yLCBmdXJ0aGVzdEF0dHIsIGZ1cnRoZXN0TWVudSwgaXNGdXJ0aGVzdCwgaHJlZiwgc3RhcnREYXRlLCBfeWllbGQkaW1wb3J0LCBsb2FkSHRtbCwgcGFyYW1zO1xuXG4gICAgICByZXR1cm4gcmVnZW5lcmF0b3JSdW50aW1lLndyYXAoZnVuY3Rpb24gX2NhbGxlZSQoX2NvbnRleHQpIHtcbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICBzd2l0Y2ggKF9jb250ZXh0LnByZXYgPSBfY29udGV4dC5uZXh0KSB7XG4gICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICAgIGlzRm9yd2FyZCA9IGRpcmVjdGlvbiA9PT0gXCJmb3J3YXJkXCI7XG4gICAgICAgICAgICAgIGVkZ2VTZWxlY3RvciA9IGlzRm9yd2FyZCA/ICdhOmZpcnN0LWNoaWxkJyA6ICdhOmxhc3QtY2hpbGQnO1xuICAgICAgICAgICAgICBmdXJ0aGVzdEF0dHIgPSBpc0ZvcndhcmQgPyAnZGF0YS1pc25ld2VzdCcgOiAnZGF0YS1pc29sZGVzdCc7XG4gICAgICAgICAgICAgIGZ1cnRoZXN0TWVudSA9IG1lbnVzQm94LnF1ZXJ5U2VsZWN0b3IoZWRnZVNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgaXNGdXJ0aGVzdCA9IGZ1cnRoZXN0TWVudSA9PT0gbnVsbCB8fCBmdXJ0aGVzdE1lbnUgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGZ1cnRoZXN0TWVudS5oYXNBdHRyaWJ1dGUoZnVydGhlc3RBdHRyKTtcblxuICAgICAgICAgICAgICBpZiAoaXNGdXJ0aGVzdCkge1xuICAgICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSA3O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LmFicnVwdChcInJldHVyblwiKTtcblxuICAgICAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgICBocmVmID0gZnVydGhlc3RNZW51ID09PSBudWxsIHx8IGZ1cnRoZXN0TWVudSA9PT0gdm9pZCAwID8gdm9pZCAwIDogZnVydGhlc3RNZW51LmdldEF0dHJpYnV0ZSgnaHJlZicpO1xuICAgICAgICAgICAgICBzdGFydERhdGUgPSBocmVmID09PSBudWxsIHx8IGhyZWYgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGhyZWYubWF0Y2goL1xcZHs0fS1cXGR7Mn0tXFxkezJ9Lyk7XG5cbiAgICAgICAgICAgICAgaWYgKHN0YXJ0RGF0ZSkge1xuICAgICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSAxMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiBfY29udGV4dC5hYnJ1cHQoXCJyZXR1cm5cIik7XG5cbiAgICAgICAgICAgIGNhc2UgMTE6XG4gICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSAxMztcbiAgICAgICAgICAgICAgcmV0dXJuIGltcG9ydCgnLi4vdXRpbGl0aWVzL2FwaScpO1xuXG4gICAgICAgICAgICBjYXNlIDEzOlxuICAgICAgICAgICAgICBfeWllbGQkaW1wb3J0ID0gX2NvbnRleHQuc2VudDtcbiAgICAgICAgICAgICAgbG9hZEh0bWwgPSBfeWllbGQkaW1wb3J0LmxvYWRIdG1sO1xuICAgICAgICAgICAgICBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgICAgICAgICAgICBzdGFydF9kYXRlOiBzdGFydERhdGVbMF0sXG4gICAgICAgICAgICAgICAgZGlyZWN0aW9uOiBkaXJlY3Rpb25cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIF9jb250ZXh0LnByZXYgPSAxNjtcbiAgICAgICAgICAgICAgX2NvbnRleHQubmV4dCA9IDE5O1xuICAgICAgICAgICAgICByZXR1cm4gbG9hZEh0bWwobWVudXNCb3gsIFwiXCIuY29uY2F0KHVybCwgXCI/XCIpLmNvbmNhdChwYXJhbXMpKTtcblxuICAgICAgICAgICAgY2FzZSAxOTpcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ01lbnVzIGxvYWRlZCEnKTtcbiAgICAgICAgICAgICAgX2NvbnRleHQubmV4dCA9IDI1O1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAyMjpcbiAgICAgICAgICAgICAgX2NvbnRleHQucHJldiA9IDIyO1xuICAgICAgICAgICAgICBfY29udGV4dC50MCA9IF9jb250ZXh0W1wiY2F0Y2hcIl0oMTYpO1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKF9jb250ZXh0LnQwKTtcblxuICAgICAgICAgICAgY2FzZSAyNTpcbiAgICAgICAgICAgIGNhc2UgXCJlbmRcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LnN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sIF9jYWxsZWUsIG51bGwsIFtbMTYsIDIyXV0pO1xuICAgIH0pKTtcbiAgICByZXR1cm4gX3NlZWtNZW51cy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgbWVudXNGb3J3YXJkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBzZWVrTWVudXMoXCJmb3J3YXJkXCIpO1xuICB9KTtcbiAgbWVudXNCYWNrd2FyZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gc2Vla01lbnVzKFwiYmFja3dhcmRcIik7XG4gIH0pO1xufSIsImltcG9ydCBcInJlZ2VuZXJhdG9yLXJ1bnRpbWUvcnVudGltZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLmFycmF5LmNvbmNhdC5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLmFycmF5LmZpbGwuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5zdHJpbmcucmVwbGFjZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLnJlZ2V4cC5leGVjLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvd2ViLmRvbS1jb2xsZWN0aW9ucy5mb3ItZWFjaC5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLnByb21pc2UuanNcIjtcbmltcG9ydCBcImNvcmUtanMvbW9kdWxlcy9lcy5vYmplY3QudG8tc3RyaW5nLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMucmVnZXhwLnRvLXN0cmluZy5qc1wiO1xuXG5mdW5jdGlvbiBhc3luY0dlbmVyYXRvclN0ZXAoZ2VuLCByZXNvbHZlLCByZWplY3QsIF9uZXh0LCBfdGhyb3csIGtleSwgYXJnKSB7IHRyeSB7IHZhciBpbmZvID0gZ2VuW2tleV0oYXJnKTsgdmFyIHZhbHVlID0gaW5mby52YWx1ZTsgfSBjYXRjaCAoZXJyb3IpIHsgcmVqZWN0KGVycm9yKTsgcmV0dXJuOyB9IGlmIChpbmZvLmRvbmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0gZWxzZSB7IFByb21pc2UucmVzb2x2ZSh2YWx1ZSkudGhlbihfbmV4dCwgX3Rocm93KTsgfSB9XG5cbmZ1bmN0aW9uIF9hc3luY1RvR2VuZXJhdG9yKGZuKSB7IHJldHVybiBmdW5jdGlvbiAoKSB7IHZhciBzZWxmID0gdGhpcywgYXJncyA9IGFyZ3VtZW50czsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdmFyIGdlbiA9IGZuLmFwcGx5KHNlbGYsIGFyZ3MpOyBmdW5jdGlvbiBfbmV4dCh2YWx1ZSkgeyBhc3luY0dlbmVyYXRvclN0ZXAoZ2VuLCByZXNvbHZlLCByZWplY3QsIF9uZXh0LCBfdGhyb3csIFwibmV4dFwiLCB2YWx1ZSk7IH0gZnVuY3Rpb24gX3Rocm93KGVycikgeyBhc3luY0dlbmVyYXRvclN0ZXAoZ2VuLCByZXNvbHZlLCByZWplY3QsIF9uZXh0LCBfdGhyb3csIFwidGhyb3dcIiwgZXJyKTsgfSBfbmV4dCh1bmRlZmluZWQpOyB9KTsgfTsgfVxuXG5pbXBvcnQgeyBnZXREb2N1bWVudCwgR2xvYmFsV29ya2VyT3B0aW9ucyB9IGZyb20gJ3BkZmpzLWRpc3QnO1xuaW1wb3J0IHsgcXVlcnlFbGVtZW50IH0gZnJvbSAnLi4vdXRpbGl0aWVzL3F1ZXJ5Jztcbkdsb2JhbFdvcmtlck9wdGlvbnMud29ya2VyU3JjID0gJy9mcm9udGVuZC9ub2RlX21vZHVsZXMvcGRmanMtZGlzdC9idWlsZC9wZGYud29ya2VyLmVudHJ5JztcbnZhciB3aWR0aCA9IDE2MCxcbiAgICBoZWlnaHQgPSAyNDA7XG52YXIgYXVkaW9Db2xvciA9ICdyZ2IoOTYsIDE2NSwgMjUwKSc7XG4vKipcbiAqIEdlbmVyYXRlIGEgdGh1bWJuYWlsIG9mIGEgUERGIHBhZ2UgaW4gYW4gYEhUTUxDYW52YXNFbGVtZW50YFxuICogQHBhcmFtIHBhZ2UgLSBBIFBERi5qcyBhYnN0cmFjdGlvbiBvZiBhIGRvY3VtZW50IHBhZ2UgdG8gcmVuZGVyIGluIGEgY2FudmFzXG4gKiBAcmV0dXJucyBhIFByb21pc2Ugb2YgYSBjYW52YXMgZWxlbWVudCBkaXNwbGF5IHdpdGggdGhlIHBhZ2Ugc2NhbGVkIHRvIGZpdFxuICovXG5cbmZ1bmN0aW9uIGdlbmVyYXRlVGh1bWJuYWlsKF94KSB7XG4gIHJldHVybiBfZ2VuZXJhdGVUaHVtYm5haWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cbi8qKlxuICogRXh0cmFjdCBhIFBERiBkb2N1bWVudCBsaW5rZWQgb24gYSBtZWRpYSBlbGVtZW50IG9uIHRoZSBwdWJsaWMgYXJjaGl2ZSBwYWdlXG4gKiBhbmQgcmVuZGVyIGEgY2FudmFzIGltYWdlIG9mIHRoZSBmaXJzdCBwYWdlIG9mIHRoZSBkb2N1bWVudCBvbiB0aGUgZWxlbWVudFxuICogQHBhcmFtIGl0ZW0gLSBUaGUgZWxlbWVudCB0byBhcHBlbmQgYW4gYEhUTUxDYW52YXNFbGVtZW50YCB0b1xuICovXG5cblxuZnVuY3Rpb24gX2dlbmVyYXRlVGh1bWJuYWlsKCkge1xuICBfZ2VuZXJhdGVUaHVtYm5haWwgPSBfYXN5bmNUb0dlbmVyYXRvciggLyojX19QVVJFX18qL3JlZ2VuZXJhdG9yUnVudGltZS5tYXJrKGZ1bmN0aW9uIF9jYWxsZWUyKHBhZ2UpIHtcbiAgICB2YXIgY2FudmFzLCB2cCwgc2NhbGUsIGNhbnZhc0NvbnRleHQsIHZpZXdwb3J0O1xuICAgIHJldHVybiByZWdlbmVyYXRvclJ1bnRpbWUud3JhcChmdW5jdGlvbiBfY2FsbGVlMiQoX2NvbnRleHQyKSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBzd2l0Y2ggKF9jb250ZXh0Mi5wcmV2ID0gX2NvbnRleHQyLm5leHQpIHtcbiAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgICAgIGNhbnZhcy5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgd2lkdGgudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICBjYW52YXMuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBoZWlnaHQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICB2cCA9IHBhZ2UuZ2V0Vmlld3BvcnQoe1xuICAgICAgICAgICAgICBzY2FsZTogMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzY2FsZSA9IE1hdGgubWluKHdpZHRoIC8gdnAud2lkdGgsIGhlaWdodCAvIHZwLmhlaWdodCk7XG4gICAgICAgICAgICBjYW52YXNDb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgICAgICB2aWV3cG9ydCA9IHBhZ2UuZ2V0Vmlld3BvcnQoe1xuICAgICAgICAgICAgICBzY2FsZTogc2NhbGUsXG4gICAgICAgICAgICAgIHJvdGF0aW9uOiAwLFxuICAgICAgICAgICAgICBkb250RmxpcDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX2NvbnRleHQyLm5leHQgPSA5O1xuICAgICAgICAgICAgcmV0dXJuIHBhZ2UucmVuZGVyKHtcbiAgICAgICAgICAgICAgY2FudmFzQ29udGV4dDogY2FudmFzQ29udGV4dCxcbiAgICAgICAgICAgICAgdmlld3BvcnQ6IHZpZXdwb3J0XG4gICAgICAgICAgICB9KS5wcm9taXNlO1xuXG4gICAgICAgICAgY2FzZSA5OlxuICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0Mi5hYnJ1cHQoXCJyZXR1cm5cIiwgY2FudmFzKTtcblxuICAgICAgICAgIGNhc2UgMTA6XG4gICAgICAgICAgY2FzZSBcImVuZFwiOlxuICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0Mi5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCBfY2FsbGVlMik7XG4gIH0pKTtcbiAgcmV0dXJuIF9nZW5lcmF0ZVRodW1ibmFpbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmREb2N1bWVudFRodW1ibmFpbChfeDIpIHtcbiAgcmV0dXJuIF9hcHBlbmREb2N1bWVudFRodW1ibmFpbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG5mdW5jdGlvbiBfYXBwZW5kRG9jdW1lbnRUaHVtYm5haWwoKSB7XG4gIF9hcHBlbmREb2N1bWVudFRodW1ibmFpbCA9IF9hc3luY1RvR2VuZXJhdG9yKCAvKiNfX1BVUkVfXyovcmVnZW5lcmF0b3JSdW50aW1lLm1hcmsoZnVuY3Rpb24gX2NhbGxlZTMoaXRlbSkge1xuICAgIHZhciBfcmVmMyxcbiAgICAgICAgcGFnZU51bSxcbiAgICAgICAgdXJsLFxuICAgICAgICBkb2MsXG4gICAgICAgIHBhZ2UsXG4gICAgICAgIHRodW1ibmFpbENhbnZhcyxcbiAgICAgICAgX2FyZ3MzID0gYXJndW1lbnRzO1xuXG4gICAgcmV0dXJuIHJlZ2VuZXJhdG9yUnVudGltZS53cmFwKGZ1bmN0aW9uIF9jYWxsZWUzJChfY29udGV4dDMpIHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIHN3aXRjaCAoX2NvbnRleHQzLnByZXYgPSBfY29udGV4dDMubmV4dCkge1xuICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgIF9yZWYzID0gX2FyZ3MzLmxlbmd0aCA+IDEgJiYgX2FyZ3MzWzFdICE9PSB1bmRlZmluZWQgPyBfYXJnczNbMV0gOiB7XG4gICAgICAgICAgICAgIHBhZ2VOdW06IDFcbiAgICAgICAgICAgIH0sIHBhZ2VOdW0gPSBfcmVmMy5wYWdlTnVtO1xuICAgICAgICAgICAgdXJsID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdXJsJyk7XG5cbiAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgIF9jb250ZXh0My5uZXh0ID0gMTk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfY29udGV4dDMucHJldiA9IDM7XG4gICAgICAgICAgICBfY29udGV4dDMubmV4dCA9IDY7XG4gICAgICAgICAgICByZXR1cm4gZ2V0RG9jdW1lbnQodXJsKS5wcm9taXNlO1xuXG4gICAgICAgICAgY2FzZSA2OlxuICAgICAgICAgICAgZG9jID0gX2NvbnRleHQzLnNlbnQ7XG4gICAgICAgICAgICBfY29udGV4dDMubmV4dCA9IDk7XG4gICAgICAgICAgICByZXR1cm4gZG9jLmdldFBhZ2UocGFnZU51bSk7XG5cbiAgICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgICBwYWdlID0gX2NvbnRleHQzLnNlbnQ7XG4gICAgICAgICAgICBfY29udGV4dDMubmV4dCA9IDEyO1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyYXRlVGh1bWJuYWlsKHBhZ2UpO1xuXG4gICAgICAgICAgY2FzZSAxMjpcbiAgICAgICAgICAgIHRodW1ibmFpbENhbnZhcyA9IF9jb250ZXh0My5zZW50O1xuICAgICAgICAgICAgaXRlbS5hcHBlbmRDaGlsZCh0aHVtYm5haWxDYW52YXMpO1xuICAgICAgICAgICAgX2NvbnRleHQzLm5leHQgPSAxOTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAxNjpcbiAgICAgICAgICAgIF9jb250ZXh0My5wcmV2ID0gMTY7XG4gICAgICAgICAgICBfY29udGV4dDMudDAgPSBfY29udGV4dDNbXCJjYXRjaFwiXSgzKTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoX2NvbnRleHQzLnQwKTtcblxuICAgICAgICAgIGNhc2UgMTk6XG4gICAgICAgICAgY2FzZSBcImVuZFwiOlxuICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0My5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCBfY2FsbGVlMywgbnVsbCwgW1szLCAxNl1dKTtcbiAgfSkpO1xuICByZXR1cm4gX2FwcGVuZERvY3VtZW50VGh1bWJuYWlsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbjtcbi8qKlxuICogQW5pbWF0ZSB0aGUgZGlzcGxheSBhbmQgdHJhY2sgdGhlIGF1ZGlvIHNvdXJjZSBvZiBhIG1lZGlhIGFyY2hpdmUgYXVkaW8gcG9zdFxuICogQHBhcmFtIGl0ZW0gLSBUaGUgYEhUTUxFbGVtZW50YCB3aXRoIGFuIGBIVE1MQXVkaW9FbGVtZW50YCBpbnNpZGVcbiAqL1xuXG5mdW5jdGlvbiB0cmFja0F1ZGlvKGl0ZW0pIHtcbiAgdmFyIGF1ZGlvID0gcXVlcnlFbGVtZW50KGl0ZW0sICdhdWRpbycsIEhUTUxBdWRpb0VsZW1lbnQpO1xuICB2YXIgcGxheUVsID0gcXVlcnlFbGVtZW50KGl0ZW0sICcucGxheScsIEhUTUxFbGVtZW50KTtcbiAgdmFyIHBhdXNlRWwgPSBxdWVyeUVsZW1lbnQoaXRlbSwgJy5wYXVzZScsIEhUTUxEaXZFbGVtZW50KTtcbiAgdmFyIGVsYXBzZWRFbCA9IHF1ZXJ5RWxlbWVudChpdGVtLCAnLmVsYXBzZWQnLCBIVE1MU3BhbkVsZW1lbnQpO1xuICB2YXIgZHVyYXRpb25FbCA9IHF1ZXJ5RWxlbWVudChpdGVtLCAnLmR1cmF0aW9uJywgSFRNTFNwYW5FbGVtZW50KTtcbiAgdmFyIGNhbnZhcyA9IHF1ZXJ5RWxlbWVudChpdGVtLCAnY2FudmFzJywgSFRNTENhbnZhc0VsZW1lbnQpO1xuICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gIHZhciB3aWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgdmFyIGhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG4gIHZhciBleHRlcm5hbExpbmsgPSBxdWVyeUVsZW1lbnQoaXRlbSwgJy50aXRsZS1ib3ggaScsIEhUTUxFbGVtZW50KTtcbiAgLyoqXG4gICAqIENvbnZlcnQgYSBudW1iZXJlZCB0aW1lc3RhbXAgdG8gYSBkaWdpdGFsIGNsb2NrIHN0cmluZyAobW9yZSB1c2VyIGZyaWVuZGx5KVxuICAgKiBAcGFyYW0gdG90YWxTZWNvbmRzIC0gYSB0aW1lc3RhbXAgaW4gc2Vjb25kcyB0byBjb252ZXJ0XG4gICAqIEByZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGEgdGltZXN0YW1wIGxpa2Ugb24gYSBkaWdpdGFsIGNsb2NrXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGRpZ2l0YWxpemUodG90YWxTZWNvbmRzKSB7XG4gICAgdmFyIG1pbnV0ZXMgPSBNYXRoLmZsb29yKHRvdGFsU2Vjb25kcyAvIDYwKTtcbiAgICB2YXIgc2Vjb25kcyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzICUgNjApO1xuICAgIHJldHVybiBcIlwiLmNvbmNhdChtaW51dGVzLCBcIjpcIikuY29uY2F0KHNlY29uZHMgPCAxMCA/IDAgOiAnJykuY29uY2F0KHNlY29uZHMpO1xuICB9XG4gIC8qKlxuICAgKiBSZW5kZXIgdGhlIGVsYXBzZWQgdGltZSBhbmQgYXVkaW8gZHVyYXRpb24gYXMgYSB0eXBpY2FsIGRpZ2l0aXplZCBzdHJpbmdcbiAgICogQHBhcmFtIGlzVXBkYXRlIC0gd2hldGhlciB0aGUgZWxlbWVudCBpcyBiZWluZyB1cGRhdGVkIHZzIGZpcnN0IHNob3duXG4gICAqL1xuXG5cbiAgdmFyIGRpc3BsYXlUaW1lID0gZnVuY3Rpb24gZGlzcGxheVRpbWUoKSB7XG4gICAgdmFyIF9yZWYgPSBhcmd1bWVudHMubGVuZ3RoID4gMCAmJiBhcmd1bWVudHNbMF0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1swXSA6IHt9LFxuICAgICAgICBfcmVmJGlzVXBkYXRlID0gX3JlZi5pc1VwZGF0ZSxcbiAgICAgICAgaXNVcGRhdGUgPSBfcmVmJGlzVXBkYXRlID09PSB2b2lkIDAgPyBmYWxzZSA6IF9yZWYkaXNVcGRhdGU7XG5cbiAgICBlbGFwc2VkRWwuaW5uZXJIVE1MID0gZGlnaXRhbGl6ZShhdWRpby5jdXJyZW50VGltZSk7XG4gICAgaWYgKGlzVXBkYXRlKSBkdXJhdGlvbkVsLmlubmVySFRNTCA9IGRpZ2l0YWxpemUoYXVkaW8uZHVyYXRpb24pO1xuICB9O1xuICAvKipcbiAgICogUmVkcmF3IHRoZSBjb2xvcmVkLCBjaXJjdWxhciB0aW1lIHRyYWNrZXIgc2libGluZyB0byB0aGUgYEhUTUxBdWRpb0VsZW1lbnRgXG4gICAqL1xuXG5cbiAgdmFyIGRyYXdBdWRpb1RyYWNrZXIgPSBmdW5jdGlvbiBkcmF3QXVkaW9UcmFja2VyKCkge1xuICAgIHZhciBlbGFwc2VkID0gYXVkaW8uY3VycmVudFRpbWU7XG4gICAgdmFyIGR1cmF0aW9uID0gYXVkaW8uZHVyYXRpb247XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4LmZpbGxTdHlsZSA9IGF1ZGlvQ29sb3I7XG4gICAgY3R4Lm1vdmVUbyh3aWR0aCAvIDIsIGhlaWdodCAvIDIpO1xuICAgIGN0eC5hcmMod2lkdGggLyAyLCBoZWlnaHQgLyAyLCB3aWR0aCAvIDIsIDAsIGVsYXBzZWQgLyBkdXJhdGlvbiAqIE1hdGguUEkgKiAyKTtcbiAgICBjdHgubGluZVRvKHdpZHRoIC8gMiwgaGVpZ2h0IC8gMik7XG4gICAgY3R4LmZpbGwoKTtcbiAgfTtcbiAgLyoqXG4gICAqIENvbnRyb2wgc291cmNlIHRyYWNraW5nIGFuZCBidXR0b24gZGlzcGxheSB3aGVuIFwiUGxheVwiIGlzIHByZXNzZWRcbiAgICovXG5cblxuICB2YXIgcHJlc3NQbGF5ID0gZnVuY3Rpb24gcHJlc3NQbGF5KCkge1xuICAgIHBsYXlFbC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcbiAgICBwYXVzZUVsLmNsYXNzTGlzdC5yZXBsYWNlKCdoaWRkZW4nLCAnZmxleCcpO1xuICAgIGF1ZGlvLnBsYXkoKTtcbiAgfTtcbiAgLyoqXG4gICAqIENvbnRyb2wgc291cmNlIHRyYWNraW5nIGFuZCBidXR0b24gZGlzcGxheSB3aGVuIFwiUGF1c2VcIiBpcyBwcmVzc2VkXG4gICAqL1xuXG5cbiAgdmFyIHByZXNzUGF1c2UgPSBmdW5jdGlvbiBwcmVzc1BhdXNlKCkge1xuICAgIHBhdXNlRWwuY2xhc3NMaXN0LnJlcGxhY2UoJ2ZsZXgnLCAnaGlkZGVuJyk7XG4gICAgcGxheUVsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuICAgIGF1ZGlvLnBhdXNlKCk7XG4gIH07XG5cbiAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGRpc3BsYXlUaW1lKCk7XG4gIH0pO1xuICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgIGRpc3BsYXlUaW1lKHtcbiAgICAgIGlzVXBkYXRlOiB0cnVlXG4gICAgfSk7XG4gICAgZHJhd0F1ZGlvVHJhY2tlcigpOyAvLyBmaXggYXVkaW8gYnV0dG9uIGRpc3BsYXkgd2hlbiB0aGUgc291cmNlIGZpbmlzaGVzIHBsYXlpbmdcblxuICAgIGlmIChhdWRpby5jdXJyZW50VGltZSA9PT0gYXVkaW8uZHVyYXRpb24pIHtcbiAgICAgIHBsYXlFbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgIHBhdXNlRWwuY2xhc3NMaXN0LnJlcGxhY2UoJ2ZsZXgnLCAnaGlkZGVuJyk7XG4gICAgfVxuICB9KTtcbiAgcGxheUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcHJlc3NQbGF5KTtcbiAgcGF1c2VFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHByZXNzUGF1c2UpO1xuICBleHRlcm5hbExpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHdpbmRvdy5vcGVuKGF1ZGlvLnNyYywgJ19ibGFuaycpO1xuICB9KTtcbn1cblxuO1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKCkge1xuICB2YXIgZG9jcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5hcmNoaXZlLWl0ZW0ucGRmJyk7XG4gIHZhciBhdWRpb3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuYXJjaGl2ZS1pdGVtLmF1ZGlvJyk7XG4gIHZhciBzbGlkZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNsaWRlcicpO1xuXG4gIGZ1bmN0aW9uIGFkZFNsaWRlckhvcml6b250YWxTY3JvbGxpbmcoc2xpZGVyKSB7XG4gICAgc2xpZGVyLmFkZEV2ZW50TGlzdGVuZXIoXCJ3aGVlbFwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHZhciBzY3JvbGxTcGVlZCA9IDI7XG4gICAgICB2YXIgd2lsbFNjcm9sbExlZnQgPSBldmVudC5kZWx0YVggPCAwICYmIHNsaWRlci5zY3JvbGxMZWZ0ID4gMDtcbiAgICAgIHZhciB3aWxsU2Nyb2xsUmlnaHQgPSBldmVudC5kZWx0YVggPiAwICYmIHNsaWRlci5zY3JvbGxMZWZ0IDwgc2xpZGVyLnNjcm9sbFdpZHRoIC0gc2xpZGVyLmNsaWVudFdpZHRoO1xuXG4gICAgICBpZiAod2lsbFNjcm9sbExlZnQgfHwgd2lsbFNjcm9sbFJpZ2h0KSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHNsaWRlci5zY3JvbGxCeSh7XG4gICAgICAgICAgbGVmdDogZXZlbnQuZGVsdGFYICogc2Nyb2xsU3BlZWQsXG4gICAgICAgICAgYmVoYXZpb3I6IFwic21vb3RoXCJcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gLy8gc3luY2hyb25pemVzIGFzeW5jIHBkZiBjYWxsc1xuXG5cbiAgZG9jcyA9PT0gbnVsbCB8fCBkb2NzID09PSB2b2lkIDAgPyB2b2lkIDAgOiBkb2NzLmZvckVhY2goIC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG4gICAgdmFyIF9yZWYyID0gX2FzeW5jVG9HZW5lcmF0b3IoIC8qI19fUFVSRV9fKi9yZWdlbmVyYXRvclJ1bnRpbWUubWFyayhmdW5jdGlvbiBfY2FsbGVlKGRvYykge1xuICAgICAgcmV0dXJuIHJlZ2VuZXJhdG9yUnVudGltZS53cmFwKGZ1bmN0aW9uIF9jYWxsZWUkKF9jb250ZXh0KSB7XG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgc3dpdGNoIChfY29udGV4dC5wcmV2ID0gX2NvbnRleHQubmV4dCkge1xuICAgICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgICBfY29udGV4dC5uZXh0ID0gMjtcbiAgICAgICAgICAgICAgcmV0dXJuIGFwcGVuZERvY3VtZW50VGh1bWJuYWlsKGRvYyk7XG5cbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LmFicnVwdChcInJldHVyblwiLCBfY29udGV4dC5zZW50KTtcblxuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgY2FzZSBcImVuZFwiOlxuICAgICAgICAgICAgICByZXR1cm4gX2NvbnRleHQuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgX2NhbGxlZSk7XG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChfeDMpIHtcbiAgICAgIHJldHVybiBfcmVmMi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH0oKSk7XG4gIGF1ZGlvcyA9PT0gbnVsbCB8fCBhdWRpb3MgPT09IHZvaWQgMCA/IHZvaWQgMCA6IGF1ZGlvcy5mb3JFYWNoKGZ1bmN0aW9uIChhdWRpbykge1xuICAgIHJldHVybiB0cmFja0F1ZGlvKGF1ZGlvKTtcbiAgfSk7XG4gIHNsaWRlcnMgPT09IG51bGwgfHwgc2xpZGVycyA9PT0gdm9pZCAwID8gdm9pZCAwIDogc2xpZGVycy5mb3JFYWNoKGZ1bmN0aW9uIChzbGlkZXIpIHtcbiAgICByZXR1cm4gYWRkU2xpZGVySG9yaXpvbnRhbFNjcm9sbGluZyhzbGlkZXIpO1xuICB9KTtcbn1cbjtcbi8qIEtFRVAgVE8gU0VFIFdPUktJTkcgTEVHQUNZXG4oYXN5bmMgKCkgPT4ge1xuICBjb25zdCBwZGZqcyA9IGF3YWl0IGltcG9ydCgncGRmanMtZGlzdC9idWlsZC9wZGYnKTtcbiAgY29uc3QgcGRmanNXb3JrZXIgPSBhd2FpdCBpbXBvcnQoJ3BkZmpzLWRpc3QvYnVpbGQvcGRmLndvcmtlci5lbnRyeScpO1xuICBwZGZqcy5HbG9iYWxXb3JrZXJPcHRpb25zLndvcmtlclNyYyA9IHBkZmpzV29ya2VyO1xufSkoKTtcbiovIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDenBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDbFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QTs7Ozs7Ozs7QUM1U0E7QUFDQTtBOzs7Ozs7OztBQ0RBO0FBQ0E7QTs7Ozs7Ozs7QUNEQTtBQUNBO0E7Ozs7Ozs7O0FDREE7QUFDQTtBOzs7Ozs7OztBQ0RBO0FBQ0E7QTs7Ozs7Ozs7QUNEQTtBQUNBO0E7O0EiLCJzb3VyY2VSb290IjoiIn0=