import { merchCategories, merchDesigns, type MerchCategory } from '$lib/merch';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const requested = url.searchParams.get('category');
  const category: MerchCategory = merchCategories.includes(requested as MerchCategory) ? requested as MerchCategory : 'all';
  return { category, designs: merchDesigns.filter(design => category === 'all' || design.category === category) };
};
