import axios, { AxiosError } from 'axios'
import { isNode } from 'browser-or-node'
import http from 'http'
import https from 'https'
import { getClientConfig, ClientProps, ClientConfig } from './config'
import { Client as AutoGeneratedClient } from './gen'

import { CreateFileInput, CreateFileResponse } from './gen/operations/createFile'
import { GetFileResponse } from './gen/operations/getFile'

export { isApiError } from './gen/errors'

export * as axios from 'axios'
export type {
  Message,
  Conversation,
  User,
  State,
  Event,
  File,
  Bot,
  Integration,
  Issue,
  IssueEvent,
  Account,
  Workspace,
  Usage,
} from './gen/models'
export * from './gen/errors'

const _100mb = 100 * 1024 * 1024
const maxBodyLength = _100mb
const maxContentLength = _100mb

export class Client extends AutoGeneratedClient {
  public readonly config: Readonly<ClientConfig>

  public constructor(clientProps: ClientProps = {}) {
    const clientConfig = getClientConfig(clientProps)
    const axiosClient = createAxiosClient(clientConfig)
    super(axiosClient)

    this.config = clientConfig
  }

  /**
   * Creates and uploads a new file in a single step. Returns an object containing the file metadata and the URL to retrieve the file.
   */
  public createAndUploadFile = async ({
    name,
    index,
    tags,
    contentType,
    accessPolicies,
    data,
    url,
  }: Omit<CreateFileInput, 'size'> & { data?: Buffer | string; url?: string }): Promise<GetFileResponse> => {
    if (url && data) {
      throw new CreateAndUploadFileError('Cannot provide both data and URL, please provide only one of them')
    }

    if (url) {
      data = await axios
        .get(url, { responseType: 'arraybuffer' })
        .then((res) => res.data)
        .catch((err) => {
          throw new CreateAndUploadFileError(`Failed to download file from provided URL: ${err.message}`, err)
        })
    }

    if (!data) {
      throw new CreateAndUploadFileError('No data was provided for file upload')
    }

    const buffer = data instanceof Buffer ? data : Buffer.from(data)

    const { file } = await this.createFile({
      name,
      tags,
      index,
      accessPolicies,
      contentType,
      size: buffer.byteLength,
    })

    try {
      await axios.put(file.uploadUrl, buffer, {
        maxBodyLength: Infinity,
      })
    } catch (err: any) {
      throw new CreateAndUploadFileError(`Failed to upload file: ${err.message}`, <AxiosError>err, file)
    }

    return await this.getFile({ id: file.id })
  }
}

export class CreateAndUploadFileError extends Error {
  public constructor(
    message: string,
    public readonly innerError?: AxiosError,
    public readonly file?: CreateFileResponse['file']
  ) {
    super(message)
    this.name = 'FileUploadError'
  }
}

function createAxiosClient(config: ClientConfig) {
  const { apiUrl, headers, withCredentials, timeout } = config
  return axios.create({
    baseURL: apiUrl,
    headers,
    withCredentials,
    timeout,
    maxBodyLength,
    maxContentLength,
    httpAgent: isNode ? new http.Agent({ keepAlive: true }) : undefined,
    httpsAgent: isNode ? new https.Agent({ keepAlive: true }) : undefined,
  })
}

type Simplify<T> = { [KeyType in keyof T]: Simplify<T[KeyType]> } & {}

type PickMatching<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] }
type ExtractMethods<T> = PickMatching<T, (...rest: any[]) => any>

type FunctionNames = keyof ExtractMethods<Client>

export type ClientParams<T extends FunctionNames> = Simplify<Parameters<Client[T]>[0]>
export type ClientReturn<T extends FunctionNames> = Simplify<Awaited<ReturnType<Client[T]>>>
