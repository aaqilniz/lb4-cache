import { inject, Provider, ValueOrPromise } from '@loopback/core';
import { repository } from '@loopback/repository';
import { CacheBindings, CacheMetadata, CacheStrategy } from 'loopback-api-cache';
import {Cache} from '../models';
import { CacheRepository } from '../repositories';

export class CacheStrategyProvider implements Provider<CacheStrategy | undefined> {
  constructor(
    @inject(CacheBindings.METADATA)
    private metadata: CacheMetadata,
    @repository(CacheRepository) protected cacheRepo: CacheRepository
  ) { }

  value(): ValueOrPromise<CacheStrategy | undefined> {
    if (!this.metadata) {
      return undefined;
    }

    return {
      check: (path: string) =>
        this.cacheRepo.get(path).catch((err: any) => {
          console.error(err);
          return undefined;
        }),
      set: async (path: string, result: any) => {
        const cache = new Cache({ id: result.id, data: result, ttl: this.metadata.ttl });
        this.cacheRepo.set(path, cache, { ttl: this.metadata.ttl }).catch((err: any) => {
          console.error(err);
        });
      },
    };
  }
}