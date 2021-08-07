import { queryElement, queryElementAll } from '../utilities/query';

describe('Query utilities', () => {
  describe('queryElement', () => {
    beforeAll(() => {
      document.body.innerHTML =
        '<div id="div">' +
        '  <input class="search" type="text" />' +
        '  <button id="click" />' +
        '  <button id="submit" />' +
        '</div>';
    });

    it('should return the proper element as the type specified', () => {
      const div = queryElement(document, 'div', HTMLDivElement);
      expect(div.id).toBe('div');

      const input = queryElement(document, '.search', HTMLInputElement);
      expect(input.type).toBe('text');
    });

    it('should return the first match', () => {
      const firstBtn = queryElement(document, 'button', HTMLButtonElement);
      expect(firstBtn.id).toBe('click');
    });

    it('should throw a type error if the wrong type is specified', () => {
      expect(() =>
        queryElement(document, 'div', HTMLButtonElement),
      ).toThrowError(TypeError);
      expect(() =>
        queryElement(document, 'button', HTMLDivElement),
      ).toThrowError(TypeError);
    });

    it('should throw a reference error if the element does not exist', () => {
      expect(() =>
        queryElement(document, 'div#submit', HTMLDivElement),
      ).toThrowError(ReferenceError);
      expect(() =>
        queryElement(document, 'button#div', HTMLButtonElement),
      ).toThrowError(ReferenceError);
    });

    it('should throw a reference error before a type error if both would', () => {
      expect(() => queryElement(document, 'span', HTMLDivElement)).toThrowError(
        ReferenceError,
      );
    });
  });
  describe('queryElementAll', () => {
    beforeAll(() => {
      document.body.innerHTML =
        '<div id="div">' +
        '  <input class="search" type="text" />' +
        '  <button id="click" />' +
        '  <button id="submit" class="div" />' +
        '  <div class="search div">Text</div>' +
        '</div>';
    });

    it('should return all valid elements specified in document order', () => {
      const divs = queryElementAll(document, 'div', HTMLDivElement);
      expect(divs).toHaveLength(2);
      expect(divs[1].className).toBe('search div');

      const btns = queryElementAll(divs[0], 'button', HTMLButtonElement);
      expect(btns).toHaveLength(2);

      const inputs = queryElementAll(document, 'input', HTMLInputElement);
      expect(inputs).toHaveLength(1);
    });

    it('should throw a type error if not all elements are same type', () => {
      expect(() =>
        queryElementAll(document, '.search', HTMLInputElement),
      ).toThrowError(TypeError);
      expect(() =>
        queryElementAll(document, '.div', HTMLDivElement),
      ).toThrowError(TypeError);
    });

    it('should throw a reference error if no matching elements exist', () => {
      expect(() =>
        queryElementAll(document, 'div#submit', HTMLDivElement),
      ).toThrowError(ReferenceError);
      expect(() =>
        queryElementAll(document, 'button#div', HTMLButtonElement),
      ).toThrowError(ReferenceError);
    });
  });
});

/*
import QUnit from 'qunit';

QUnit.module('menus', {
  beforeEach: function() {
    const $ = django.jQuery;
    $(document).append('<button id="menus-forward></button>');
  }
});
QUnit.test('increments menu forward', assert => {
  // moveForward('#menus-forward');
  // assert.equal($('#menus-forward').length, 1);
  // $('#menus-forward').click();
  // assert.equa($('#menus-forward').length, 0);
});
*/
