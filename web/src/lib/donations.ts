export type DonationCheckout = {
  id: string;
  fund: 'financial-aid' | 'club-support';
  frequency: 'once' | 'monthly';
  recipient: string;
  url: string;
  monthlyAmountCents?: number;
};

export const donationFunds = {
  'financial-aid': { title: 'A seat at the table', label: 'Financial aid', description: 'Help make Terrace possible for the people who belong here.' },
  'club-support': { title: 'Keep the house humming', label: 'Club support', description: 'For the rooms, the meals, the music, and whatever comes next.' }
};
