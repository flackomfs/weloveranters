export type User = {
  id: string;
  name: string;
  username: string;
  bio: string;
  location: string;
  followers: number;
  following: number;
};

export type Post = {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  tags: string[];
};

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Mila Hart',
    username: 'mila',
    bio: 'Writer, overthinker, and loudest quiet observer in the room.',
    location: 'Boston, MA',
    followers: 18200,
    following: 340
  },
  {
    id: 'u2',
    name: 'Nico Flores',
    username: 'nicoflores',
    bio: 'Trying to be honest without burning out.',
    location: 'Austin, TX',
    followers: 9320,
    following: 210
  },
  {
    id: 'u3',
    name: 'Jenna Brooks',
    username: 'jennab',
    bio: 'Low-key venting in public, healing in private.',
    location: 'Seattle, WA',
    followers: 12650,
    following: 290
  }
];

export const MOCK_TRENDS = [
  { topic: 'burnout', posts: 2540 },
  { topic: 'anxiety', posts: 3980 },
  { topic: 'friendship', posts: 2105 },
  { topic: 'college', posts: 1620 }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    author: MOCK_USERS[0],
    content: 'Some days I feel like I am trying to hold my life together with a paperclip and a prayer.\n\nStill showing up anyway.',
    createdAt: '2h ago',
    likes: 1302,
    comments: 231,
    reposts: 42,
    tags: ['burnout', 'stress', 'reallife']
  },
  {
    id: 'p2',
    author: MOCK_USERS[1],
    content: 'I do not need a perfect explanation for why I am exhausted.\n\nI just need someone to recognize I am tired and not ask me to perform wellness.',
    createdAt: '5h ago',
    likes: 842,
    comments: 119,
    reposts: 28,
    tags: ['mentalhealth', 'honesty']
  },
  {
    id: 'p3',
    author: MOCK_USERS[2],
    content: 'The weirdest thing about healing is realizing you can still love people and also need distance from them.\n\nThat is not betrayal. That is self-respect.',
    createdAt: '1d ago',
    likes: 1760,
    comments: 244,
    reposts: 63,
    tags: ['healing', 'boundaries']
  }
];
