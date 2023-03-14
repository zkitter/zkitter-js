import { ModerationMessageSubType } from '../utils/message';

export type PostMeta = {
  like: number;
  reply: number;
  repost: number;
  block: number;
  global: boolean;
  moderation:
    | null
    | ModerationMessageSubType.ThreadMention
    | ModerationMessageSubType.ThreadBlock
    | ModerationMessageSubType.ThreadFollow;
  groupId: string;
};

export const EmptyPostMeta = (): PostMeta => ({
  block: 0,
  global: false,
  groupId: '',
  like: 0,
  moderation: null,
  reply: 0,
  repost: 0,
});
