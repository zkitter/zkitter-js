import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import { ChatMeta } from '../models/chats';
import { Proof } from '../models/proof';
import { Chat } from '../utils/message';
import { GenericService } from '../utils/svc';

export class ChatService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & { db: GenericDBAdapterInterface }) {
    super(props);
    this.db = props.db;
  }

  async insert(chat: Chat, proof: Proof) {
    return this.db.insertChat(chat, proof);
  }

  async getChatByECDH(ecdh: string): Promise<ChatMeta[]> {
    return this.db.getChatByECDH(ecdh);
  }

  async getChatMessages(chatId: string, limit?: number, offset?: number | string): Promise<Chat[]> {
    return this.db.getChatMessages(chatId, limit, offset);
  }
}
