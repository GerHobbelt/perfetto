// Copyright (C) 2025 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** A function that can _adapt_ some object to another type. */
export type Adapter<T extends object> = (obj: object) => T | undefined;

/**
 * An adapter can adapt objects to types identified by adapter keys,
 * being either
 * - a class for object types, or
 * - a symbol for interface types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdapterKey = symbol | ClassType<any>;

export type ClassType<T extends object> = Function & { prototype: T };

class AdapterRegistry {
  private readonly adapters = new Map<AdapterKey, Adapter<object>[]>();

  /** Register an adapter for some class type. */
  register<T extends object>(adapter: Adapter<T>, forType: ClassType<T>): this;
  /** Register an adapter for some interface type identified by a symbol. */
  register<T extends object>(adapter: Adapter<T>, forType: symbol): this;
  register<T extends object>(adapter: Adapter<T>, forKey: AdapterKey): this {
    let adapters = this.adapters.get(forKey);
    if (adapters === undefined) {
      adapters = [];
      this.adapters.set(forKey, adapters);
    }
    adapters.push(adapter);
    return this;
  }

  /** Adapt the given object to some class type. */
  adapt<T extends object>(obj: object, toType: ClassType<T>): T | undefined;
  /** Adapt the given object to some interface type identified by a symbol. */
  adapt<T extends object>(obj: object, toType: symbol): T | undefined;
  adapt<T extends object>(obj: object, toKey: AdapterKey): T | undefined {
    const adapters = this.adapters.get(toKey) ?? [];
    if (typeof toKey === 'symbol') {
      for (const adapter of adapters) {
        const result = adapter(obj);
        if (result !== undefined) {
          return result as T;
        }
      }
    } else {
      for (const adapter of adapters) {
        const result = adapter(obj);
        if (result instanceof toKey) {
          return result as T;
        }
      }
    }
    return undefined;
  }
}

export const adapterRegistry = new AdapterRegistry();

/** Adapt the given object to some class type. */
export function adapt<T extends object>(obj: object, toType: ClassType<T>): T | undefined;
/** Adapt the given object to some interface type identified by a symbol. */
export function adapt<T extends object>(obj: object, toType: symbol): T | undefined;
export function adapt<T extends object>(obj: object, toKey: AdapterKey): T | undefined {
  return (typeof toKey === 'symbol') ?
    adapterRegistry.adapt(obj, toKey) :
    adapterRegistry.adapt(obj, toKey);
}
