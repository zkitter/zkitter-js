import {GenericService} from "../utils/svc";
import {GenericDBAdapterInterface} from "../adapters/db";
import {Post} from "../utils/message";
import {PostMeta} from "../models/postmeta";
import {ConstructorOptions} from "eventemitter2";
import {Proof} from "../models/proof";

export class PostService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & {
    db: GenericDBAdapterInterface
  }) {
    super(props);
    this.db = props.db;
  }

  async insert(post: Post, proof: Proof) {
    return this.db.insertPost(post, proof);
  }

  async getPostMeta(postHash: string): Promise<PostMeta> {
    return this.db.getPostMeta(postHash);
  }

  async getPost(hash: string) {
    return this.db.getPost(hash);
  }

  async getPosts(limit?: number, offset?: number|string) {
    return this.db.getPosts(limit, offset);
  }

  async getUserPosts(address: string, limit?: number, offset?: number|string) {
    return this.db.getUserPosts(address, limit, offset);
  }

  async getReplies(hash: string, limit?: number, offset?: number|string) {
    return this.db.getReplies(hash, limit, offset);
  }

  async getReposts(hash: string, limit?: number, offset?: number|string) {
    return this.db.getReposts(hash, limit, offset);
  }
}
