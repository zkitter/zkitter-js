import { ConstructorOptions } from 'eventemitter2';
import { GenericDBAdapterInterface } from '../adapters/db';
import { Proof } from '../models/proof';
import { Profile } from '../utils/message';
import { GenericService } from '../utils/svc';

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
