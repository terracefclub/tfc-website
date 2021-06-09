(self["webpackChunktfc_website_frontend"] = self["webpackChunktfc_website_frontend"] || []).push([["src_main_scripts_utilities_api_ts"],{

/***/ "./src/main/scripts/utilities/api.ts":
/*!*******************************************!*\
  !*** ./src/main/scripts/utilities/api.ts ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "loadHtml": function() { return /* binding */ loadHtml; }
/* harmony export */ });
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! regenerator-runtime/runtime.js */ "./node_modules/regenerator-runtime/runtime.js");
/* harmony import */ var regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(regenerator_runtime_runtime_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.promise.js */ "./node_modules/core-js/modules/es.promise.js");
/* harmony import */ var core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_promise_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.object.to-string.js */ "./node_modules/core-js/modules/es.object.to-string.js");
/* harmony import */ var core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_object_to_string_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var isomorphic_fetch__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! isomorphic-fetch */ "./node_modules/isomorphic-fetch/fetch-npm-browserify.js");
/* harmony import */ var isomorphic_fetch__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(isomorphic_fetch__WEBPACK_IMPORTED_MODULE_3__);




function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// api.ts

/**
 * Utility functions for interfacing with server API. Uses the fetch API
 * provided by the `isomorphic-fetch` package for better browser support.
 * @module
 */

/**
 * Helper adapter to server API to handle asynchronous loading of HTML from
 * `TemplateResponse` and `render` views.
 * @param container the element to load HTML into
 * @param fullUrl the url with query parameters to send a GET request to
 * @returns the response, which is primarily processed when rejected for 
 * error message display
 */

function loadHtml(_x, _x2) {
  return _loadHtml.apply(this, arguments);
}

function _loadHtml() {
  _loadHtml = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(container, fullUrl) {
    var init, response;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            init = {
              method: 'get',
              headers: {
                'Accept': 'text/html',
                'Content-Type': 'text/html'
              }
            };
            _context.next = 3;
            return fetch(fullUrl, init);

          case 3:
            response = _context.sent;

            if (!response.ok) {
              _context.next = 11;
              break;
            }

            _context.next = 7;
            return response.text();

          case 7:
            container.innerHTML = _context.sent;
            return _context.abrupt("return", response);

          case 11:
            return _context.abrupt("return", Promise.reject(response));

          case 12:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _loadHtml.apply(this, arguments);
}

/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvc3JjX21haW5fc2NyaXB0c191dGlsaXRpZXNfYXBpX3RzLmNodW5rLmpzIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGZjX3dlYnNpdGVfZnJvbnRlbmQvLi9zcmMvbWFpbi9zY3JpcHRzL3V0aWxpdGllcy9hcGkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFwicmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzXCI7XG5pbXBvcnQgXCJjb3JlLWpzL21vZHVsZXMvZXMucHJvbWlzZS5qc1wiO1xuaW1wb3J0IFwiY29yZS1qcy9tb2R1bGVzL2VzLm9iamVjdC50by1zdHJpbmcuanNcIjtcblxuZnVuY3Rpb24gYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBrZXksIGFyZykgeyB0cnkgeyB2YXIgaW5mbyA9IGdlbltrZXldKGFyZyk7IHZhciB2YWx1ZSA9IGluZm8udmFsdWU7IH0gY2F0Y2ggKGVycm9yKSB7IHJlamVjdChlcnJvcik7IHJldHVybjsgfSBpZiAoaW5mby5kb25lKSB7IHJlc29sdmUodmFsdWUpOyB9IGVsc2UgeyBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4oX25leHQsIF90aHJvdyk7IH0gfVxuXG5mdW5jdGlvbiBfYXN5bmNUb0dlbmVyYXRvcihmbikgeyByZXR1cm4gZnVuY3Rpb24gKCkgeyB2YXIgc2VsZiA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHZhciBnZW4gPSBmbi5hcHBseShzZWxmLCBhcmdzKTsgZnVuY3Rpb24gX25leHQodmFsdWUpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcIm5leHRcIiwgdmFsdWUpOyB9IGZ1bmN0aW9uIF90aHJvdyhlcnIpIHsgYXN5bmNHZW5lcmF0b3JTdGVwKGdlbiwgcmVzb2x2ZSwgcmVqZWN0LCBfbmV4dCwgX3Rocm93LCBcInRocm93XCIsIGVycik7IH0gX25leHQodW5kZWZpbmVkKTsgfSk7IH07IH1cblxuLy8gYXBpLnRzXG5cbi8qKlxuICogVXRpbGl0eSBmdW5jdGlvbnMgZm9yIGludGVyZmFjaW5nIHdpdGggc2VydmVyIEFQSS4gVXNlcyB0aGUgZmV0Y2ggQVBJXG4gKiBwcm92aWRlZCBieSB0aGUgYGlzb21vcnBoaWMtZmV0Y2hgIHBhY2thZ2UgZm9yIGJldHRlciBicm93c2VyIHN1cHBvcnQuXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCAnaXNvbW9ycGhpYy1mZXRjaCc7XG4vKipcbiAqIEhlbHBlciBhZGFwdGVyIHRvIHNlcnZlciBBUEkgdG8gaGFuZGxlIGFzeW5jaHJvbm91cyBsb2FkaW5nIG9mIEhUTUwgZnJvbVxuICogYFRlbXBsYXRlUmVzcG9uc2VgIGFuZCBgcmVuZGVyYCB2aWV3cy5cbiAqIEBwYXJhbSBjb250YWluZXIgdGhlIGVsZW1lbnQgdG8gbG9hZCBIVE1MIGludG9cbiAqIEBwYXJhbSBmdWxsVXJsIHRoZSB1cmwgd2l0aCBxdWVyeSBwYXJhbWV0ZXJzIHRvIHNlbmQgYSBHRVQgcmVxdWVzdCB0b1xuICogQHJldHVybnMgdGhlIHJlc3BvbnNlLCB3aGljaCBpcyBwcmltYXJpbHkgcHJvY2Vzc2VkIHdoZW4gcmVqZWN0ZWQgZm9yIFxuICogZXJyb3IgbWVzc2FnZSBkaXNwbGF5XG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRIdG1sKF94LCBfeDIpIHtcbiAgcmV0dXJuIF9sb2FkSHRtbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG5mdW5jdGlvbiBfbG9hZEh0bWwoKSB7XG4gIF9sb2FkSHRtbCA9IF9hc3luY1RvR2VuZXJhdG9yKCAvKiNfX1BVUkVfXyovcmVnZW5lcmF0b3JSdW50aW1lLm1hcmsoZnVuY3Rpb24gX2NhbGxlZShjb250YWluZXIsIGZ1bGxVcmwpIHtcbiAgICB2YXIgaW5pdCwgcmVzcG9uc2U7XG4gICAgcmV0dXJuIHJlZ2VuZXJhdG9yUnVudGltZS53cmFwKGZ1bmN0aW9uIF9jYWxsZWUkKF9jb250ZXh0KSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBzd2l0Y2ggKF9jb250ZXh0LnByZXYgPSBfY29udGV4dC5uZXh0KSB7XG4gICAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgaW5pdCA9IHtcbiAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdBY2NlcHQnOiAndGV4dC9odG1sJyxcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbCdcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSAzO1xuICAgICAgICAgICAgcmV0dXJuIGZldGNoKGZ1bGxVcmwsIGluaXQpO1xuXG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmVzcG9uc2UgPSBfY29udGV4dC5zZW50O1xuXG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSAxMTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9jb250ZXh0Lm5leHQgPSA3O1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnRleHQoKTtcblxuICAgICAgICAgIGNhc2UgNzpcbiAgICAgICAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBfY29udGV4dC5zZW50O1xuICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LmFicnVwdChcInJldHVyblwiLCByZXNwb25zZSk7XG5cbiAgICAgICAgICBjYXNlIDExOlxuICAgICAgICAgICAgcmV0dXJuIF9jb250ZXh0LmFicnVwdChcInJldHVyblwiLCBQcm9taXNlLnJlamVjdChyZXNwb25zZSkpO1xuXG4gICAgICAgICAgY2FzZSAxMjpcbiAgICAgICAgICBjYXNlIFwiZW5kXCI6XG4gICAgICAgICAgICByZXR1cm4gX2NvbnRleHQuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwgX2NhbGxlZSk7XG4gIH0pKTtcbiAgcmV0dXJuIF9sb2FkSHRtbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBOztBIiwic291cmNlUm9vdCI6IiJ9