export type FeedMood = 'happy' | 'sad' | 'stressed' | 'angry';

type MoodCue = {
  mood: FeedMood;
  words: string[];
};

const moodCues: MoodCue[] = [
  { mood: 'happy', words: ['masaya', 'saya', 'natutuwa', 'nakakatuwa', 'happy', 'glad', 'excited', 'grateful', 'thankful'] },
  { mood: 'sad', words: ['malungkot', 'lungkot', 'naiiyak', 'umiyak', 'iyak', 'sad', 'lonely', 'miss ko'] },
  { mood: 'stressed', words: ['pagod', 'nakakapagod', 'burnout', 'stress', 'stressed', 'pressure', 'overwhelmed', 'nahihirapan', 'anxious', 'worried', 'kabado'] },
  { mood: 'angry', words: ['galit', 'inis', 'naiinis', 'badtrip', 'bwisit', 'frustrated', 'annoyed', 'angry'] }
];

const negation = /\b(?:hindi|di|wag|huwag|not|never)\b(?:\s+\w+){0,2}\s*$/;

function countCue(text: string, cue: string) {
  const phrase = cue.split(' ').map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const expression = new RegExp(`\\b${phrase}\\b`, 'g');
  let match: RegExpExecArray | null;

  while ((match = expression.exec(text)) !== null) {
    const beforeCue = text.slice(0, match.index);
    if (!negation.test(beforeCue)) return 1;
  }

  return 0;
}

export function detectPostMood(content: string): FeedMood | null {
  const normalized = content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const scores = new Map<FeedMood, number>();

  for (const { mood, words } of moodCues) {
    scores.set(mood, words.reduce((score, word) => score + countCue(normalized, word), 0));
  }

  const ranked = Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
  if (!ranked[0] || ranked[0][1] === 0 || ranked[0][1] === ranked[1]?.[1]) return null;
  return ranked[0][0];
}

export function findDominantFeedMood(posts: Array<{ content: string; userId: string }>): FeedMood | null {
  const authors = new Set(posts.map((post) => post.userId));
  if (authors.size < 3) return null;

  const authorsByMood = new Map<FeedMood, Set<string>>();
  for (const post of posts) {
    const mood = detectPostMood(post.content);
    if (!mood) continue;

    const moodAuthors = authorsByMood.get(mood) || new Set<string>();
    moodAuthors.add(post.userId);
    authorsByMood.set(mood, moodAuthors);
  }

  const ranked = Array.from(authorsByMood.entries()).sort((left, right) => right[1].size - left[1].size);
  const dominant = ranked[0];
  if (!dominant || dominant[1].size < 3 || dominant[1].size < Math.ceil(authors.size * 0.4)) return null;
  if (dominant[1].size === ranked[1]?.[1].size) return null;
  return dominant[0];
}

export function createTagalogSupportPost(mood: FeedMood, postedOn: string, postNumber: number) {
  const messages: Record<FeedMood, string[]> = {
    happy: [
      'Nakakagaan ng araw ang mga kuwentong may saya. Kung may munting bagay na nagpasaya sa iyo, ibahagi mo kung gusto mo. — Kumusta Bot\n\n#KumustaBot #Saya',
      'May saya rin sa maliliit na tagumpay. Ano ang isang bagay na ipinagpapasalamat mo ngayong araw? — Kumusta Bot\n\n#KumustaBot #Saya',
      'Kung may magandang nangyari sa iyo, puwede mo itong ikuwento rito—baka makapagbigay-sigla rin sa iba. — Kumusta Bot\n\n#KumustaBot #Saya'
    ],
    sad: [
      'Para sa sinumang may mabigat na araw: hindi kailangang maging maayos agad ang lahat. Magpahinga kung kailangan, at magbahagi lamang kung komportable ka. — Kumusta Bot\n\n#KumustaBot #Suporta',
      'Kung mabigat ang araw mo, okay lang dahan-dahan lang muna. Hindi mo kailangang magbahagi hangga’t hindi ka komportable. — Kumusta Bot\n\n#KumustaBot #Suporta',
      'Hindi mo kailangang harapin ang lahat nang mag-isa. Magpahinga at lumapit sa taong pinagkakatiwalaan mo kung makatutulong. — Kumusta Bot\n\n#KumustaBot #Suporta'
    ],
    stressed: [
      'Paalaala: hindi kailangang solusyunan ang lahat nang sabay-sabay. Isang hakbang muna, at magpahinga o humingi ng tulong sa taong pinagkakatiwalaan mo kung kailangan. — Kumusta Bot\n\n#KumustaBot #Pahinga',
      'Kapag sabay-sabay ang iniisip, pumili muna ng isang maliit na hakbang. Magpahinga rin kapag kailangan. — Kumusta Bot\n\n#KumustaBot #Pahinga',
      'Hindi kailangang madaliin ang lahat. Huminga muna, magpahinga, at humingi ng suporta kung kailangan. — Kumusta Bot\n\n#KumustaBot #Pahinga'
    ],
    angry: [
      'Kung mabigat ang pakiramdam, puwedeng huminto muna at magpahinga bago sumagot. Kapag handa ka na, ilahad ang saloobin sa paraang ligtas at mahinahon. — Kumusta Bot\n\n#KumustaBot #Kalma',
      'Kapag mainit ang ulo, makatutulong ang sandaling pahinga bago magpasya o sumagot. Ingatan ang sarili at ang kausap. — Kumusta Bot\n\n#KumustaBot #Kalma',
      'Puwedeng kilalanin ang inis nang hindi agad kumikilos dito. Huminto muna at bumalik sa usapan kapag handa na. — Kumusta Bot\n\n#KumustaBot #Kalma'
    ]
  };

  const date = new Date(`${postedOn}T12:00:00.000Z`);
  const formattedDate = new Intl.DateTimeFormat('fil-PH', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  const moodMessages = messages[mood];
  const message = moodMessages[(postNumber - 1) % moodMessages.length];
  return `${message}\n\nPaalala #${postNumber} para sa ${formattedDate}.`;
}
