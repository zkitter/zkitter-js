import chalk from 'chalk';
import { Command } from 'commander';
import moment from 'moment';
import { Zkitter } from '../services';
import { initZkitter } from '../utils/cli';
import { error } from '../utils/logger';

const { blue, blueBright, cyan, gray, green, greenBright, magenta, red, yellow, yellowBright } =
  chalk;

export function whois(program: Command) {
  program
    .command('whois')
    .description('sync with arbitrum and group')
    .argument('<address>', 'display profile of user address')
    .action(async address => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      await handleWhois(zkitter, address);

      process.exit(0);
    });
}

export async function handleWhois(zkitter: Zkitter, address: string) {
  const u = await zkitter.getUser(address);
  const um = await zkitter.getUserMeta(address);

  if (!u) {
    error('user not found.');
    return;
  }

  const nickname = um.nickname || u.address;
  const posts = blueBright(um.posts + ' post(s)');
  const following = red(um.following + ' following');
  const followers = yellowBright(um.followers + ' follower(s)');
  console.log(`${magenta(nickname)} ${cyan('@' + u.address)}`);
  console.log(`${posts}  ${following}  ${followers}`);
  console.log(`Profile Picture: ${greenBright(um.profileImage)}`);
  console.log(`Cover Image: ${greenBright(um.coverImage)}`);
  console.log(`Bio: ${greenBright(um.bio)}`);
  console.log(`Website: ${greenBright(um.website)}`);
  console.log(`Twitter Verification: ${greenBright(um.twitterVerification)}`);
  console.log(`Group: ${um.group ? green(um.group) : red(um.group)}`);
  console.log('Public Keys:');
  console.log(`   ${gray('ECDSA')}: ${yellow(u.pubkey)}`);
  console.log(`   ${gray('ECDH')}: ${yellow(um.ecdh)}`);
  console.log(`   ${gray('Identity Commitment')}: ${yellow(um.idCommitment)}`);
  console.log(`Joined at ${yellowBright(moment(u.joinedAt).fromNow())}`);
}
