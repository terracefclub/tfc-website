import '../styles/index.scss';
import * as common from './common';
import { queryElement } from '../../common/utilities/query';

const controller: {
  [key: string]: string[];
} = {
  archive: ['archiveLoader'],
  events: ['eventLoader', 'calendarLoader'],
  carousel: ['carouselLoader'],
  blog: ['shareLoader', 'searchLoader', 'rankedSortAndPaginationLoader'],
  menus: ['otherMenusBoxLoader'],
  forms: ['formsLoader'],
};

document.addEventListener('DOMContentLoaded', () => {
  // control component loading with body classes
  const bodyClasses = queryElement(document, 'body', HTMLBodyElement).classList;
  bodyClasses.forEach(async (class_) => {
    if (class_ in controller) {
      const { ...components } = await import('./components/index');
      const isComponentsKey = (x: string): x is keyof typeof components =>
        x in components;

      // load the valid components specified in the controller for body class
      const componentLoaders = controller[class_];
      componentLoaders.forEach((name) => {
        if (isComponentsKey(name)) components[name]();
      });
    }
  });

  // load common components
  Object.values(common).forEach((f) => f());
});
