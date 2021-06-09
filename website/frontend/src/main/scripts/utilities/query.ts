// query.ts
/**
 * DOM querying utilities for type specificity.
 * @module
 */

/**
 * Queries DOM for an element that must exist and must be of the type specified
 * in parameters. Used to guarantee that the element can undergo specific
 * transformations and attribute access without complicating business logic
 * to handle missing information.
 * 
 * @remarks
 * `InstanceType` is a built-in utility type for the return type of a
 * constructor function. It is used to get the return type of a generic because
 * the `<T extends typeof Element>` function tag does not open `T` up for direct
 * typecasting. Consider the following transpilation error: `'el' could be
 * instantiated with an arbitrary type which could be unrelated to 'Element'. 
 * ts(2352)`.
 * @see {@link https://github.com/Microsoft/TypeScript/issues/25998} for details
 * 
 * @template T is any type of DOM element
 * @param parent the context for querying the DOM
 * @param selector a DOM selector token
 * @param type the type of DOM element that the match must be
 * @throws if a successful match is not of the correct type
 * @returns the element queried from the DOM as the specified type
 */
export function queryElement<T extends typeof Element>(
  parent: Document | Element,
  selector: string,
  type: T
): InstanceType<T> {
  
  const el = parent.querySelector(selector);
  if (!el) {
    throw new ReferenceError(`Selector '${selector}' has no matching element.`);
  } else if (!(el instanceof type)) {
    throw new TypeError(
      `Selector '${selector}' matched element '${el}', which is not of the ` +
      `specified type '${typeof type}'`
    );
  }
  return el as InstanceType<T>;
}


/**
 * Type-specific, existence-mandatory DOM querying for multiple matching
 * elements. @see {@link queryElement} for more details on implementation and
 * purpose.
 * 
 * @template T is any type of DOM element
 * @param parent the context for querying the DOM
 * @param selector a DOM selector token
 * @param type the type of DOM element that the match must be
 * @throws if any successful match is not of the correct type
 * @returns all elements queried as an array of the specified type
 */
export function queryElementAll<T extends typeof Element>(
  parent: Document | Element,
  selector: string,
  type: T
): InstanceType<T>[] {
  const els = parent.querySelectorAll(selector);
  if (els.length <= 0) {
    throw new ReferenceError(`Selector '${selector}' matched zero elements.`);
  }

  els.forEach(el => {
    if (!(el instanceof type)) {
      throw new TypeError(
        `Selector '${selector}' matched element '${el}', which is not of the ` +
        `specified type '${typeof type}'`
      );
    }
  });
  return Array.from(els) as InstanceType<T>[];
}