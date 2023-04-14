import {GenericService} from "../utils/svc";
import {ConstructorOptions} from "eventemitter2";
import {GenericDBAdapterInterface} from "../adapters/db";
import {
  AnyMessage, Chat, ChatMessageSubType, Connection, ConnectionMessageSubType,
  MessageType,
  Moderation,
  ModerationMessageSubType,
  Post,
  PostMessageSubType, Profile, ProfileMessageSubType
} from "../utils/message";
import {Proof} from "../models/proof";

export class DBService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & {
    db: GenericDBAdapterInterface;
  }) {
    super(props);
    this.db = props.db;
  }

  async insertMessage(msg: AnyMessage, proof: Proof): Promise<void> {
    const existing = await this.db.getMessage(msg.hash());

    if (existing) return;

    await this.db.addMessage(msg);
    await this.db.addProof(msg, proof);

    if (proof.type === 'signature') await this.db.addUserMessage(msg);

    switch (msg.type) {
      case MessageType.Post:
        return this.insertPost(msg as Post, proof);
      case MessageType.Moderation:
        return this.insertModeration(msg as Moderation, proof);
      case MessageType.Connection:
        return this.insertConnection(msg as Connection, proof);
      case MessageType.Profile:
        return this.insertProfile(msg as Profile, proof);
      case MessageType.Chat:
        return this.insertChat(msg as Chat, proof);
      default:
        return;
    }
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
        await this.db.updateThreadModeration(mod);
        break;
    }

    await this.db.addToThreadModerations(mod);
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

  async insertProfile(profile: Profile, proof: Proof): Promise<void> {
    switch (profile.subtype) {
      case ProfileMessageSubType.Bio:
        await this.db.updateProfile(profile,'bio');
        break;
      case ProfileMessageSubType.CoverImage:
        await this.db.updateProfile(profile,'coverImage');
        break;
      case ProfileMessageSubType.ProfileImage:
        await this.db.updateProfile(profile,'profileImage');
        break;
      case ProfileMessageSubType.Group:
        await this.db.updateProfile(profile,'group');
        break;
      case ProfileMessageSubType.Name:
        await this.db.updateProfile(profile,'nickname');
        break;
      case ProfileMessageSubType.TwitterVerification:
        await this.db.updateProfile(profile,'twitterVerification');
        break;
      case ProfileMessageSubType.Website:
        await this.db.updateProfile(profile,'website');
        break;
      case ProfileMessageSubType.Custom:
        if (profile.payload.key === 'id_commitment') {
          await this.db.updateProfile(profile,'idCommitment');
        } else if (profile.payload.key === 'ecdh_pubkey') {
          await this.db.updateProfile(profile,'ecdh');
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