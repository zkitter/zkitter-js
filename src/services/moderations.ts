import { GenericService } from '../utils/svc';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Moderation } from '../utils/message';
import { ConstructorOptions } from 'eventemitter2';
import { Proof } from '../models/proof';

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
