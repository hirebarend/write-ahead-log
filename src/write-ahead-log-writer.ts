import * as crc32 from 'crc-32';
import * as fs from 'fs';
import { FileHelper, Mutex, StringHelper } from 'high-performance-utils';
import * as path from 'path';
import * as protobufjs from 'protobufjs';

const LogEntryProtoBufJs = new protobufjs.Type('LogEntry')
  .add(new protobufjs.Field('checksum', 1, 'string'))
  .add(new protobufjs.Field('data', 2, 'string'))
  .add(new protobufjs.Field('logSequenceNumber', 3, 'string'));

export class WriteAheadLogWriter {
  protected readonly buffer: Buffer;

  protected bufferOffset: number = 0;

  protected fileDescriptor: number | null = null;

  protected mutex: Mutex = new Mutex();

  protected fileDescriptorOffset: number = 0;

  constructor(
    protected directory: string,
    protected filename: string,
    protected logSequenceNumber: number = 0,
    protected bufferSize: number = 128 * 1024, // 10 kilobytes
  ) {
    this.buffer = Buffer.alloc(this.bufferSize);
  }

  public async close(): Promise<void> {
    if (!this.fileDescriptor) {
      return;
    }

    await this.flush();

    fs.closeSync(this.fileDescriptor);
  }

  protected async flush(): Promise<void> {
    if (!this.fileDescriptor) {
      return;
    }

    if (!this.buffer) {
      return;
    }

    if (!this.bufferOffset) {
      return;
    }

    await this.mutex.acquire();

    const buffer: Buffer = Buffer.alloc(this.bufferOffset);

    this.buffer.copy(buffer, 0, 0, this.bufferOffset);

    this.bufferOffset = 0;

    this.fileDescriptorOffset += await FileHelper.write(
      this.fileDescriptor,
      buffer,
      this.fileDescriptorOffset,
    );

    await this.mutex.release();
  }

  public async open(): Promise<void> {
    await this.mutex.acquire();

    this.fileDescriptor = fs.openSync(
      path.join(this.directory, this.filename),
      'a+',
    );

    this.fileDescriptorOffset = await this.size();

    await this.mutex.release();
  }

  public async size(): Promise<number> {
    if (!this.fileDescriptor) {
      return 0;
    }

    const stats = fs.statSync(path.join(this.directory, this.filename));

    return stats.size;
  }

  public async write(data: any): Promise<number> {
    this.logSequenceNumber += 1;

    const dataStr: string = JSON.stringify(data);

    const checksum: string = StringHelper.padding(
      Math.abs(
        crc32.buf(
          Buffer.from(`${this.logSequenceNumber}|${dataStr}`, 'binary'),
          0,
        ),
      ).toString(),
      10,
    );

    const logEntry: protobufjs.Message<{
      checksum: string;
      data: string;
      logSequenceNumber: string;
    }> = LogEntryProtoBufJs.fromObject({
      checksum,
      data: dataStr,
      logSequenceNumber: this.logSequenceNumber.toString(),
    });

    const bufferLogEntry: Uint8Array =
      LogEntryProtoBufJs.encode(logEntry).finish();

    const buffer: Buffer = Buffer.concat([
      Buffer.from(
        StringHelper.padding(bufferLogEntry.length.toString(), 10),
        'binary',
      ),
      bufferLogEntry,
    ]);

    if (this.bufferOffset + buffer.length > this.buffer.length) {
      await this.flush();
    }

    this.bufferOffset += buffer.copy(
      this.buffer,
      this.bufferOffset,
      0,
      buffer.length,
    );

    return this.logSequenceNumber;
  }
}
