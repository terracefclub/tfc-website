import sources from '../../static/merch/manifest.json';

export const terraceShop = 'https://www.redbubble.com/people/terracefclub/shop';
export const merchCategories = ['all', 'wear', 'stick', 'carry'] as const;
export type MerchCategory = typeof merchCategories[number];
const designs = [
  { id: 'terrace-mushroom', title: 'Terrace Mushroom', kind: 'Oversized T-shirt', category: 'wear', note: 'A little fungus among us.' },
  { id: 'terrace-fairies', title: 'Terrace Fairies', kind: 'Essential T-shirt', category: 'wear', note: 'Dress for the other realm.' },
  { id: 'pixel-terrace', title: 'Pixel Terrace', kind: 'Glossy sticker', category: 'stick', note: 'The Mother, in another resolution.' },
  { id: 'food-equals-love', title: 'food equals love', kind: 'Sticker', category: 'stick', note: 'The whole philosophy. Stick it somewhere.' },
  { id: 'reunions-tote', title: 'TFC Reunions 2021 Tote', kind: 'Cotton tote bag', category: 'carry', note: 'For books, leftovers, and questionable treasures.' },
  { id: 'terrace-purple', title: 'Terrace 2024 Logo Purple', kind: 'Phone case', category: 'carry', note: 'A purple portal in your pocket.' }
] as const;
export const merchDesigns = designs.map(design => {
  const source = sources.find(record => record.id === design.id);
  if (!source) throw new Error('Missing merchandise source.');
  return { ...design, url: source.productUrl, image: `/merch/${design.id}.jpg` };
});
