#!/usr/bin/env NODE_NO_WARNINGS=1 node

process.removeAllListeners('warning');
import { program } from 'commander';
import { version } from '../../package.json';
import { fetch as fetchProgram } from './fetch';
import { init } from './init';
import { list } from './list';
import { status } from './status';
import { sync } from './sync';
import { timeline } from './timeline';
import { up } from './up';
import { whois } from './whois';
import { write } from './write';

program.name('zkitter').description('CLI for ZkitterJS local node').version(version);

init(program);
status(program);
timeline(program);
sync(program);
fetchProgram(program);
whois(program);
up(program);
write(program);
list(program);

program.parse();
