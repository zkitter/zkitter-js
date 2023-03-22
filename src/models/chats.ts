import { ChatMessageSubType } from '../utils/message';

export type ChatMeta = DirectMessageChatMeta;

export type DirectMessageChatMeta = {
  type: ChatMessageSubType.Direct;
  chatId: string;
  receiverECDH: string;
  senderECDH: string;
  senderSeed: string;
};
