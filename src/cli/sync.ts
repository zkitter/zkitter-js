import { Command } from 'commander';
import { UserServiceEvents } from '../services/users';
import { initZkitter } from '../utils/cli';
import { debug, success } from '../utils/logger';
import {ZkitterEvents} from "../utils/events";

export function sync(program: Command) {
  program
    .command('sync')
    .description('sync with arbitrum and group')
    .option('-a, --arbitrum', 'sync with arbitrum')
    .option('--groups', 'sync with all group')
    .option('-g, --group <groupName>', 'sync with group')
    .action(async options => {
      const zkitter = await initZkitter(true);

      if (!zkitter) return;

      let newUsers = 0;
      let newMembers = 0;
      let newMsgs = 0;

      zkitter.on(UserServiceEvents.ArbitrumSynced, data => {
        const { fromBlock, latest, toBlock } = data;
        const completion = ((fromBlock / latest) * 100).toFixed(2);
        success(
          `Synced with Arbitrum Mainnet from block #${fromBlock} to #${toBlock}(${completion}%)`
        );
      });

      zkitter.on(ZkitterEvents.NewUserCreated, data => {
        newUsers++;
        debug('new user created: ' + data.address);
      });

      zkitter.on(ZkitterEvents.NewGroupMemberCreated, (data, groupId) => {
        newMembers++;
        debug(`new group member added to ${groupId}: ${data.idCommitment}`);
      });

      zkitter.on(ZkitterEvents.NewMessageCreated, msg => {
        newMsgs++;
        debug(`new message created: ${msg.toJSON().messageId}`);
      });

      if (options.arbitrum) {
        await zkitter.syncUsers();
      } else if (options.group) {
        await zkitter.syncGroup(options.group);
      } else if (options.groups) {
        await zkitter.syncGroup();
      } else {
        await zkitter.start();
        await zkitter.subscribe();
      }

      console.log(
        `Found ${newUsers} new user(s), ${newMembers} new member(s), and ${newMsgs} new message(s).`
      );
      process.exit(0);
    });
}
