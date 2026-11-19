export type SupportBotCommand = {
  emotion: string | null;
  rant: string;
};

const emotions: Record<string, string> = {
  happy: 'happy',
  happiness: 'happy',
  joyful: 'joyful',
  masaya: 'happy',
  saya: 'happy',
  sad: 'sad',
  sadness: 'sad',
  malungkot: 'sad',
  lungkot: 'sad',
  stressed: 'stressed',
  stress: 'stressed',
  pagod: 'tired',
  angry: 'angry',
  anger: 'angry',
  galit: 'angry',
  inis: 'frustrated',
  naiinis: 'frustrated',
  anxious: 'anxious',
  anxiety: 'anxious',
  balisa: 'anxious',
  lonely: 'lonely',
  excited: 'excited',
  frustrated: 'frustrated',
  scared: 'scared',
  takot: 'scared',
  worried: 'worried',
  'nag-aalala': 'worried',
  confused: 'confused',
  grateful: 'grateful',
  tired: 'tired',
  overwhelmed: 'overwhelmed',
  hurt: 'hurt',
  numb: 'numb',
  hopeful: 'hopeful',
  disappointed: 'disappointed',
  jealous: 'jealous',
  nervous: 'nervous',
  kabado: 'nervous',
  guilty: 'guilty',
  ashamed: 'ashamed',
  bored: 'bored',
  calm: 'calm',
  proud: 'proud',
  grieving: 'grieving'
};

export function parseSupportBotCommand(content: string): SupportBotCommand | null {
  const match = content.trim().match(/^#([a-z][a-z-]{1,23})(?:\s+|:\s*|[-–—]\s*)([\s\S]+)$/i);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const rant = match[2].trim();
  if (!rant) return null;
  if (command === 'rant') return { emotion: null, rant };

  const emotion = emotions[command];
  return emotion ? { emotion, rant } : null;
}
