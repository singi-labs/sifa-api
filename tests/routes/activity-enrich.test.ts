import { describe, it, expect } from 'vitest';
import { enrichRsvpItems, type ActivityItem, type EventMeta } from '../../src/routes/activity.js';

function makeRsvpItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    uri: 'at://did:plc:myuser/community.lexicon.calendar.rsvp/3lte9abc123',
    collection: 'community.lexicon.calendar.rsvp',
    rkey: '3lte9abc123',
    record: {
      $type: 'community.lexicon.calendar.rsvp',
      status: 'community.lexicon.calendar.rsvp#going',
      subject: {
        cid: 'bafyreiabc123',
        uri: 'at://did:plc:eventcreator/community.lexicon.calendar.event/3lte3c7x43l2e',
      },
      createdAt: '2026-03-17T08:00:38.612Z',
    },
    appId: 'community-calendar',
    appName: 'Community Calendar',
    category: 'Events',
    indexedAt: '2026-03-17T08:00:38.612Z',
    ...overrides,
  };
}

function makeNonRsvpItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    uri: 'at://did:plc:myuser/app.bsky.feed.post/3ltexyz789',
    collection: 'app.bsky.feed.post',
    rkey: '3ltexyz789',
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Hello world',
      createdAt: '2026-03-17T10:00:00.000Z',
    },
    appId: 'bluesky',
    appName: 'Bluesky',
    category: 'Posts',
    indexedAt: '2026-03-17T10:00:00.000Z',
    ...overrides,
  };
}

const mockEventMeta: EventMeta = {
  name: 'ATProto Community Meetup',
  startsAt: '2026-04-01T18:00:00.000Z',
  endsAt: '2026-04-01T20:00:00.000Z',
  mode: 'community.lexicon.calendar.event#inPerson',
  locationName: 'Amsterdam Tech Hub',
  locationLocality: 'Amsterdam',
  locationCountry: 'NL',
};

const successFetchEvent = async (_uri: string): Promise<EventMeta | null> => mockEventMeta;
const failFetchEvent = async (_uri: string): Promise<EventMeta | null> => null;

describe('enrichRsvpItems', () => {
  it('passes non-RSVP items through unchanged', async () => {
    const items = [makeNonRsvpItem()];
    const result = await enrichRsvpItems(items, null, successFetchEvent);

    expect(result).toHaveLength(1);
    const [first] = result;
    expect(first).toEqual(items[0]);
    // Ensure no eventMeta was added to record
    expect((first?.record as Record<string, unknown>).eventMeta).toBeUndefined();
  });

  it('enriches RSVP items with eventMeta when fetch succeeds', async () => {
    const items = [makeRsvpItem()];
    const result = await enrichRsvpItems(items, null, successFetchEvent);

    expect(result).toHaveLength(1);
    const enrichedRecord = result[0]?.record as Record<string, unknown>;
    expect(enrichedRecord.eventMeta).toBeDefined();
    const meta = enrichedRecord.eventMeta as EventMeta;
    expect(meta.name).toBe('ATProto Community Meetup');
    expect(meta.startsAt).toBe('2026-04-01T18:00:00.000Z');
    expect(meta.locationName).toBe('Amsterdam Tech Hub');
    expect(meta.locationLocality).toBe('Amsterdam');
  });

  it('leaves RSVP items unchanged when fetch fails', async () => {
    const items = [makeRsvpItem()];
    const result = await enrichRsvpItems(items, null, failFetchEvent);

    expect(result).toHaveLength(1);
    const [first] = result;
    expect((first?.record as Record<string, unknown>).eventMeta).toBeUndefined();
    // Original fields preserved
    expect(first?.collection).toBe('community.lexicon.calendar.rsvp');
    expect(first?.uri).toBe(items[0]?.uri);
  });

  it('only enriches RSVP items in a mixed list', async () => {
    const rsvpItem = makeRsvpItem();
    const postItem = makeNonRsvpItem();
    const items = [rsvpItem, postItem];

    const result = await enrichRsvpItems(items, null, successFetchEvent);

    expect(result).toHaveLength(2);
    const [enrichedItem, unchangedItem] = result;

    // RSVP item should be enriched
    const enrichedRecord = enrichedItem?.record as Record<string, unknown>;
    expect(enrichedRecord.eventMeta).toBeDefined();
    expect((enrichedRecord.eventMeta as EventMeta).name).toBe('ATProto Community Meetup');

    // Non-RSVP item should pass through unchanged
    expect((unchangedItem?.record as Record<string, unknown>).eventMeta).toBeUndefined();
    expect(unchangedItem?.collection).toBe('app.bsky.feed.post');
  });
});
