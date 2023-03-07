import { GenericService } from '../utils/svc';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Profile } from '../utils/message';
import { ConstructorOptions } from 'eventemitter2';
import { Proof } from '../models/proof';

export class ProfileService extends GenericService {
  db: GenericDBAdapterInterface;

  constructor(props: ConstructorOptions & { db: GenericDBAdapterInterface }) {
    super(props);
    this.db = props.db;
  }

  async insert(profile: Profile, proof: Proof) {
    if (!profile.creator) return;
    return this.db.insertProfile(profile, proof);
  }
}
