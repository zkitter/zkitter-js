import { GenericService } from '../utils/svc';
import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import {
  Chat,
  ChatMessageSubType,
  Connection,
  ConnectionMessageSubType,
  Message,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  parseMessageId,
  Post,
  PostMessageSubType,
  Profile,
  ProfileMessageSubType,
  Revert,
} from '../utils/message';
import { Proof } from '../models/proof';
import { ZkitterEvents } from '../utils/events';

export class DataService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(
    props: ConstructorOptions & {
      db: GenericDBAdapterInterface;
    }
  ) {
    super(props);
    this.db = props.db;
  }

  async insertMessage(msg: Message, proof: Proof): Promise<void> {
    const existing = await this.db.getMessage(msg.hash());

    if (existing) {
      this.emit(ZkitterEvents.AlreadyExist, msg);
      return;
    }

    await this.db.addMessage(msg);
    await this.db.addProof(msg, proof);

    if (proof.type === 'signature') await this.db.addUserMessage(msg);

    switch (msg.type) {
      case MessageType.Post:
        await this.insertPost(msg as Post, proof);
        break;
      case MessageType.Moderation:
        await this.insertModeration(msg as Moderation, proof);
        break;
      case MessageType.Connection:
        await this.insertConnection(msg as Connection, proof);
        break;
      case MessageType.Profile:
        await this.insertProfile(msg as Profile, proof);
        break;
      case MessageType.Chat:
        await this.insertChat(msg as Chat, proof);
        break;
      case MessageType.Revert:
        await this.revert(msg as Revert, proof);
        return;
      default:
        return;
    }

    this.emit(ZkitterEvents.NewMessageCreated, msg, proof);
  }

  async revert(rvt: Revert, proof: Proof): Promise<void> {
    const { hash } = parseMessageId(rvt.payload.reference);
    const msg = await this.db.getMessage(hash);

    if (!msg) {
      return;
    }

    if (!rvt.creator || rvt.creator !== msg.creator) {
      return;
    }

    switch (msg.type) {
      case MessageType.Post:
        await this.revertPost(msg as Post, proof);
        break;
      case MessageType.Moderation:
        await this.revertModeration(msg as Moderation, proof);
        break;
      case MessageType.Connection:
        await this.revertConnection(msg as Connection, proof);
        break;
      case MessageType.Profile:
      case MessageType.Chat:
        break;
    }

    await this.db.revertMessage(msg);
    this.emit(ZkitterEvents.MessageReverted, msg, proof);
  }

  async insertPost(post: Post, proof: Proof): Promise<void> {
    switch (post.subtype) {
      case PostMessageSubType.Default:
      case PostMessageSubType.MirrorPost:
        await this.db.addToPostlist(post);
        if (post.creator) {
          await this.db.addToUserPosts(post);
          await this.db.incrementCreatorPostCount(post);
        } else if (proof.type === 'rln') {
          await this.db.addToGroupPosts(post, proof);
        }
        return;
      case PostMessageSubType.Reply:
      case PostMessageSubType.MirrorReply:
        await this.db.addToThread(post);
        await this.db.incrementReplyCount(post);
        return;
      case PostMessageSubType.Repost:
        await this.db.addToPostlist(post);
        if (post.creator) {
          await this.db.addToUserPosts(post);
        }
        await this.db.incrementRepostCount(post);
        return;
    }
  }

  async revertPost(post: Post, proof: Proof): Promise<void> {
    switch (post.subtype) {
      case PostMessageSubType.Default:
      case PostMessageSubType.MirrorPost:
        await this.db.removeFromPostlist(post);
        if (post.creator) {
          await this.db.removeFromUserPosts(post);
          await this.db.decrementCreatorPostCount(post);
        } else if (proof.type === 'rln') {
          await this.db.removeFromGroupPosts(post, proof);
        }
        return;
      case PostMessageSubType.Reply:
      case PostMessageSubType.MirrorReply:
        await this.db.removeFromThread(post);
        await this.db.decrementReplyCount(post);
        return;
      case PostMessageSubType.Repost:
        await this.db.removeFromPostlist(post);
        if (post.creator) {
          await this.db.removeFromUserPosts(post);
        }
        await this.db.decrementRepostCount(post);
        return;
    }
  }

  async insertModeration(mod: Moderation, proof: Proof): Promise<void> {
    switch (mod.subtype) {
      case ModerationMessageSubType.Like:
        await this.db.incrementLikeCount(mod);
        break;
      case ModerationMessageSubType.Block:
        await this.db.incrementBlockCount(mod);
        break;
      case ModerationMessageSubType.Global:
        await this.db.updateThreadVisibility(mod);
        break;
      case ModerationMessageSubType.ThreadMention:
      case ModerationMessageSubType.ThreadFollow:
      case ModerationMessageSubType.ThreadBlock:
      case ModerationMessageSubType.ThreadAll:
        await this.db.updateThreadModeration(mod);
        break;
    }

    await this.db.addToThreadModerations(mod);
  }

  async revertModeration(mod: Moderation, proof: Proof): Promise<void> {
    switch (mod.subtype) {
      case ModerationMessageSubType.Like:
        await this.db.decrementLikeCount(mod);
        break;
      case ModerationMessageSubType.Block:
        await this.db.decrementBlockCount(mod);
        break;
      case ModerationMessageSubType.Global:
        await this.db.updateThreadVisibility(mod, true);
        break;
      case ModerationMessageSubType.ThreadMention:
      case ModerationMessageSubType.ThreadFollow:
      case ModerationMessageSubType.ThreadBlock:
      case ModerationMessageSubType.ThreadAll:
        // user should overwrite with new thread moderation subtype instead of reverting
        break;
    }

    await this.db.removeFromThreadModerations(mod);
  }

  async insertConnection(conn: Connection, proof: Proof): Promise<void> {
    switch (conn.subtype) {
      case ConnectionMessageSubType.Follow:
        await this.db.incrementFollowerCount(conn);
        break;
      case ConnectionMessageSubType.Block:
        await this.db.incrementBlockerCount(conn);
        break;
      case ConnectionMessageSubType.MemberInvite:
      case ConnectionMessageSubType.MemberAccept:
        break;
    }

    await this.db.addToConnections(conn);
  }

  async revertConnection(conn: Connection, proof: Proof): Promise<void> {
    switch (conn.subtype) {
      case ConnectionMessageSubType.Follow:
        await this.db.decrementFollowerCount(conn);
        break;
      case ConnectionMessageSubType.Block:
        await this.db.decrementBlockerCount(conn);
        break;
      case ConnectionMessageSubType.MemberInvite:
      case ConnectionMessageSubType.MemberAccept:
        break;
    }

    await this.db.removeFromConnections(conn);
  }

  async insertProfile(profile: Profile, proof: Proof): Promise<void> {
    switch (profile.subtype) {
      case ProfileMessageSubType.Bio:
        await this.db.updateProfile(profile, 'bio');
        break;
      case ProfileMessageSubType.CoverImage:
        await this.db.updateProfile(profile, 'coverImage');
        break;
      case ProfileMessageSubType.ProfileImage:
        await this.db.updateProfile(profile, 'profileImage');
        break;
      case ProfileMessageSubType.Group:
        await this.db.updateProfile(profile, 'group');
        break;
      case ProfileMessageSubType.Name:
        await this.db.updateProfile(profile, 'nickname');
        break;
      case ProfileMessageSubType.TwitterVerification:
        await this.db.updateProfile(profile, 'twitterVerification');
        break;
      case ProfileMessageSubType.Website:
        await this.db.updateProfile(profile, 'website');
        break;
      case ProfileMessageSubType.Custom:
        if (profile.payload.key === 'id_commitment') {
          await this.db.updateProfile(profile, 'idCommitment');
        } else if (profile.payload.key === 'ecdh_pubkey') {
          await this.db.updateProfile(profile, 'ecdh');
          await this.db.updateUserECDH(profile);
        }
        break;
    }
  }

  async insertChat(chat: Chat, proof: Proof): Promise<void> {
    switch (chat.subtype) {
      case ChatMessageSubType.Direct:
        await this.db.addChatMessage(chat);
        await this.db.addDirectChatMeta(chat);
        break;
    }
  }
}
