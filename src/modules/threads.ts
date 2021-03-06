import { API, DEFAULT_API_OPTIONS } from '../core/api'
import { ApiOptions, Thread, ThreadList, ContactList } from '../models/index'
import Snapshots from './snapshots'
import Schemas from './schemas'

export type ThreadType = 'private' | 'read_only' | 'public' | 'open'
export type ThreadSharing = 'not_shared' | 'invite_only' | 'shared'

/**
 * Threads is an API module for managing Textile threads
 *
 * Threads are distributed sets of encrypted files between peers governed by build-in or
 * custom Schemas.
 *
 * Thread type controls read (R), annotate (A), and write (W) access:
 *
 * private  --> initiator: RAW, whitelist:
 * readonly --> initiator: RAW, whitelist: R
 * public   --> initiator: RAW, whitelist: RA
 * open     --> initiator: RAW, whitelist: RAW
 *
 * Thread sharing style controls if (Y/N) a thread can be shared:
 *
 * notshared  --> initiator: N, whitelist: N
 * inviteonly --> initiator: Y, whitelist: N
 * shared     --> initiator: Y, whitelist: Y
 *
 * @extends API
 */
export default class Threads extends API {
  snapshots: Snapshots
  schemas: Schemas
  constructor(opts: ApiOptions = DEFAULT_API_OPTIONS) {
    super(opts)
    this.snapshots = new Snapshots(opts)
    this.schemas = new Schemas(opts)
  }
  /**
   * Adds and joins a new thread
   *
   * @param name The name of the new thread
   * @param key A locally unique key used by an app to identify this thread on recovery
   * @param type The type of thread, must be one of 'private' (default), 'read_only', 'public',
   * or 'open'
   * @param sharing The sharing style of thread, must be one of 'notshared'
   * (default), 'invite_only', or 'shared'
   * @param whitelist An array of contact addresses. When supplied, the thread will not allow
   * additional peers, useful for 1-1 chat/file sharing or private threads.
   * @param schema Schema ID for the new thread
   * @returns The newly generated thread info
   */
  async add(name: string, schema?: string | object, key?: string, type?: ThreadType, sharing?: ThreadSharing, whitelist?: string[]) {
    let targetSchema: string | undefined
    // Attempt to create the schema on the fly
    if (schema && typeof schema === 'object') {
      const fileIndex = await this.schemas.add(schema)
      targetSchema = fileIndex.hash
    } else if (schema && typeof schema === 'string') {
      // check if it is one of the default schemas
      const known = await this.schemas.defaultByName(schema)
      if (known) {
        // if one of the default, add it or get it to find the hash
        const added = await this.schemas.add(known)
        targetSchema = added.hash
      } else {
        // @todo - perhaps a specific warning if schema here doesn't match a hash len
        targetSchema = schema
      }
    }
    const response = await this.sendPost(
      'threads',
      [name],
      {
        schema: targetSchema || '',
        key: key || '',
        type: type || 'private',
        sharing: sharing || 'not_shared',
        whitelist: (whitelist || []).join(',')
      }
    )
    return response.json() as Promise<Thread>
  }

  /**
   * Adds or updates a thread directly, usually from a backup
   *
   * @param thread ID of the thread
   * @param info Thread object
   */
  async addOrUpdate(thread: string, info: Thread) {
    this.sendPut(`threads/${thread}`, undefined, undefined, info)
  }

  /**
   * Retrieve a thread by ID
   *
   * @param thread ID of the thread
   * @returns A thread object
   */
  async get(thread: string) {
    const response = await this.sendGet(`threads/${thread}`)
    return response.json() as Promise<Thread>
  }

  /**
   * Retrieve a thread by Key
   *
   * @param key Key of the thread
   * @returns A thread object
   */
  async getByKey(key: string) {
    // @todo: update with https://github.com/textileio/go-textile/issues/712
    const response = await this.sendGet('threads')
    const threads: ThreadList = await response.json()
    return threads.items.find((thread) => thread.key === key)
  }
  /**
   * Retrieve threads by Name
   *
   * @param name Name of the thread
   * @returns An array thread objects
   */
  async getByName(name: string) {
    // @todo: update with https://github.com/textileio/go-textile/issues/712
    const response = await this.sendGet('threads')
    const threads: ThreadList = await response.json()
    return threads.items.filter((thread) => thread.name === name)
  }

  /**
   * Lists all local threads
   *
   * @returns An array of threads
   */
  async list() {
    const response = await this.sendGet('threads')
    return response.json() as Promise<ThreadList>
  }

  /**
   * Leave and remove a thread by ID
   *
   * @param thread ID of the thread
   * @returns Whether the thread removal was successfull
   */
  async remove(thread: string) {
    const response = await this.sendDelete(`threads/${thread}`)
    return response.status === 204
  }

  /**
   * Leave and remove a thread by Key
   *
   * @param key thread.key of the thread
   * @returns Whether the thread removal was successfull
   */
  async removeByKey(key: string) {
    const thread = await this.getByKey(key)
    if (!thread) {
      return false
    }
    const response = await this.sendDelete(`threads/${thread.id}`)
    return response.status === 204
  }

  /**
   * Renames a thread
   *
   * Note: Only initiators can rename a thread.
   * @param thread ID of the thread
   * @param name New name for the thread
   * @returns Whether the rename was successfully
   */
  async rename(thread: string, name: string) {
    const response = await this.sendPut(`threads/${thread}/name`)
    return response.status === 204
  }

  /**
   * List all peers in a thread
   *
   * @param thread ID of the thread (default is 'default').
   * @returns An array of thread contacts
   */
  async peers(thread: string) {
    const response = await this.sendGet(`threads/${thread || 'default'}/peers`)
    return response.json() as Promise<ContactList>
  }
}
