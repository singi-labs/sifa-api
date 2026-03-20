export interface AppRegistryEntry {
  id: string;
  name: string;
  category: string;
  collectionPrefixes: string[];
  scanCollections: string[];
  urlPattern?: string;
  color: string;
}

const APP_REGISTRY: AppRegistryEntry[] = [
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'Posts',
    collectionPrefixes: ['app.bsky.feed'],
    scanCollections: ['app.bsky.feed.post'],
    urlPattern: 'https://bsky.app/profile/{handle}/post/{rkey}',
    color: 'sky',
  },
  {
    id: 'tangled',
    name: 'Tangled',
    category: 'Code',
    collectionPrefixes: ['sh.tangled'],
    scanCollections: ['sh.tangled.repo', 'sh.tangled.repo.issue', 'sh.tangled.repo.pull'],
    urlPattern: 'https://tangled.sh/{handle}/{name}',
    color: 'emerald',
  },
  {
    id: 'smokesignal',
    name: 'Smoke Signal',
    category: 'Events',
    collectionPrefixes: ['events.smokesignal'],
    scanCollections: ['events.smokesignal.calendar.event'],
    urlPattern: 'https://smokesignal.events/{did}/{rkey}',
    color: 'orange',
  },
  {
    id: 'flashes',
    name: 'Flashes',
    category: 'Photos',
    collectionPrefixes: ['blue.flashes'],
    scanCollections: ['blue.flashes.feed.post'],
    color: 'pink',
  },
  {
    id: 'whitewind',
    name: 'Whitewind',
    category: 'Articles',
    collectionPrefixes: ['com.whtwnd'],
    scanCollections: ['com.whtwnd.blog.entry'],
    urlPattern: 'https://whtwnd.com/{handle}/{rkey}',
    color: 'slate',
  },
  {
    id: 'frontpage',
    name: 'Frontpage',
    category: 'Links',
    collectionPrefixes: ['fyi.unravel.frontpage'],
    scanCollections: ['fyi.unravel.frontpage.post'],
    urlPattern: 'https://frontpage.fyi/post/{did}/{rkey}',
    color: 'violet',
  },
  {
    id: 'picosky',
    name: 'Picosky',
    category: 'Chat',
    collectionPrefixes: ['social.psky'],
    scanCollections: ['social.psky.feed.post'],
    urlPattern: 'https://psky.social',
    color: 'pink',
  },
  {
    id: 'linkat',
    name: 'Linkat',
    category: 'Links',
    collectionPrefixes: ['blue.linkat'],
    scanCollections: ['blue.linkat.board'],
    urlPattern: 'https://linkat.blue/{handle}',
    color: 'emerald',
  },
  {
    id: 'pastesphere',
    name: 'PasteSphere',
    category: 'Pastes',
    collectionPrefixes: ['link.pastesphere'],
    scanCollections: ['link.pastesphere.snippet'],
    urlPattern: 'https://pastesphere.link/user/{handle}/snippet/{rkey}',
    color: 'amber',
  },
];

export const EXCLUDED_COLLECTIONS: string[] = [
  'app.bsky.feed.like',
  'app.bsky.feed.repost',
  'app.bsky.graph.follow',
  'app.bsky.graph.block',
  'app.bsky.graph.mute',
  'app.bsky.graph.listitem',
  'sh.tangled.graph.follow',
  'sh.tangled.feed.star',
  'events.smokesignal.calendar.rsvp',
  'fyi.unravel.frontpage.vote',
];

export function getAppsRegistry(): AppRegistryEntry[] {
  return APP_REGISTRY;
}

export function getAppForCollection(
  collection: string,
): (AppRegistryEntry & { matchedPrefix: string }) | undefined {
  // Exact match on scanCollections first
  for (const entry of APP_REGISTRY) {
    if (entry.scanCollections.includes(collection)) {
      const matchedPrefix: string =
        entry.collectionPrefixes.find((p) => collection.startsWith(p)) ??
        entry.collectionPrefixes[0] ??
        collection;
      return { ...entry, matchedPrefix };
    }
  }

  // Prefix match on collectionPrefixes
  for (const entry of APP_REGISTRY) {
    for (const prefix of entry.collectionPrefixes) {
      if (collection.startsWith(prefix)) {
        return { ...entry, matchedPrefix: prefix };
      }
    }
  }

  return undefined;
}
