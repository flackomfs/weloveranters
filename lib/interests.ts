export const INTERESTS = [
  'relationships',
  'work',
  'school',
  'family',
  'mentalhealth',
  'lifeadvice',
  'personalgrowth',
  'parenting',
  'friendship',
  'humor',
  'dailylife',
  'celebrations'
] as const;

export type Interest = typeof INTERESTS[number];

export const INTEREST_LABELS: Record<Interest, string> = {
  relationships: 'Relationships',
  work: 'Work',
  school: 'School',
  family: 'Family',
  mentalhealth: 'Mental health',
  lifeadvice: 'Life advice',
  personalgrowth: 'Personal growth',
  parenting: 'Parenting',
  friendship: 'Friendship',
  humor: 'Humor',
  dailylife: 'Daily life',
  celebrations: 'Celebrations'
};
