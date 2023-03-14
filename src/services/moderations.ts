import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Proof } from '../models/proof';
import { Moderation } from '../utils/message';
import { GenericService } from '../utils/svc';

export class ModerationService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & { db: GenericDBAdapterInterface }) {
    super(props);
    this.db = props.db;
  }

  async insert(mod: Moderation, proof: Proof) {
    return this.db.insertModeration(mod, proof);
  }

  async getModerations(
    hash: string,
    limit?: number,
    offset?: number | string
  ): Promise<Moderation[]> {
    return this.db.getModerations(hash, limit, offset);
  }
}
