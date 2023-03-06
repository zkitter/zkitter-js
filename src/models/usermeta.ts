export type UserMetaKey =
  | 'nickname'
  | 'coverImage'
  | 'profileImage'
  | 'website'
  | 'twitterVerification'
  | 'bio'
  | 'ecdh'
  | 'idCommitment';

export type UserMeta = {
  nickname: string;
  coverImage: string;
  profileImage: string;
  website: string;
  twitterVerification: string;
  group: boolean;
  bio: string;
  ecdh: string;
  idCommitment: string;
  followers: number;
  following: number;
  blockers: number;
  blocking: number;
  posts: number;
};

export const EmptyUserMeta = (): UserMeta => ({
  bio: '',
  blockers: 0,
  blocking: 0,
  coverImage: '',
  ecdh: '',
  followers: 0,
  following: 0,
  group: false,
  idCommitment: '',
  nickname: '',
  posts: 0,
  profileImage: '',
  twitterVerification: '',
  website: '',
});
