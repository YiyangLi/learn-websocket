#!/usr/bin/env node
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import dotenv from 'dotenv';
import Client from './client';
import {randomUUID} from 'crypto';

const isProd = process.env.NODE_ENV !== 'test';
if (isProd) {
  dotenv.config();
}

yargs(hideBin(process.argv))
  .command(
    'init',
    'initialize a new client',
    () => {},
    async argv => {
      const client = new Client(argv.username as string);
    }
  )
  .option('username', {
    alias: 'u',
    type: 'string',
    description: 'the message',
    default: randomUUID(),
  })
  .parse();
