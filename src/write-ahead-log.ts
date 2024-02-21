import * as crc32 from 'crc-32';
import * as fs from 'fs';
import * as path from 'path';
import * as protobufjs from 'protobufjs';
import { StringHelper } from './string.helper';
import { Mutex } from './mutex';
import { FileHelper } from './file.helper';
import { LogEntry } from './log-entry';

const LogEntryProtoBufJs = new protobufjs.Type('LogEntry')
  .add(new protobufjs.Field('checksum', 1, 'string'))
  .add(new protobufjs.Field('data', 2, 'string'))
  .add(new protobufjs.Field('logSequenceNumber', 3, 'string'));

export class WriteAheadLog {
  protected buffer: Buffer | null = null;

  // protected readonly buffer: Buffer;

  // protected readonly bufferOffset: number = null;

  protected fileDescriptor: number | null = null;

  protected mutex: Mutex = new Mutex();

  protected offset: number = 0;

  constructor(
    protected directory: string,
    protected filename: string,
    protected logSequenceNumber: number = 0,
    protected bufferSize: number = 10 * 1024, // 10 kilobytes
  ) {}

  public async close(): Promise<void> {
    if (!this.fileDescriptor) {
      return;
    }

    await this.flush();

    fs.closeSync(this.fileDescriptor);
  }

  public async flush(): Promise<void> {
    if (!this.fileDescriptor) {
      return;
    }

    if (!this.buffer) {
      return;
    }

    await this.mutex.acquire();

    const buffer: Buffer = this.buffer;

    this.buffer = null;

    try {
      this.offset += await FileHelper.write(
        this.fileDescriptor,
        buffer,
        this.offset,
      );
    } catch {
      if (this.buffer) {
        this.buffer = Buffer.concat([buffer, this.buffer]);
      } else {
        this.buffer = buffer;
      }
    }

    await this.mutex.release();
  }

  public async open(): Promise<void> {
    await this.mutex.acquire();

    this.fileDescriptor = fs.openSync(
      path.join(this.directory, this.filename),
      'a+',
    );

    this.offset = await this.size();

    await this.mutex.release();
  }

  public async read(): Promise<Array<LogEntry>> {
    const fileDescriptor: number = fs.openSync(
      path.join(this.directory, this.filename),
      'r',
    );

    let offset: number = 0;

    const size: number = fs.statSync(
      path.join(this.directory, this.filename),
    ).size;

    const logEntries: Array<LogEntry> = [];

    while (offset < size) {
      const bufferLength: Buffer = Buffer.alloc(10);

      fs.readSync(fileDescriptor, bufferLength, 0, bufferLength.length, offset);

      const bufferLogEntry: Buffer = Buffer.alloc(
        parseInt(bufferLength.toString()),
      );

      fs.readSync(
        fileDescriptor,
        bufferLogEntry,
        0,
        bufferLogEntry.length,
        offset + bufferLength.length,
      );

      const logEntry: LogEntry = LogEntryProtoBufJs.decode(
        bufferLogEntry,
      ).toJSON() as LogEntry;

      logEntries.push(logEntry);

      offset += bufferLength.length + bufferLogEntry.length;
    }

    return logEntries;
  }

  public setLogSequenceNumber(logSequenceNumber: number): void {
    this.logSequenceNumber = logSequenceNumber;
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

    if (!this.buffer) {
      this.buffer = buffer;

      return this.logSequenceNumber;
    }

    this.buffer = Buffer.concat([this.buffer, buffer]);

    if (this.buffer.length < this.bufferSize) {
      return this.logSequenceNumber;
    }

    await this.flush();

    return this.logSequenceNumber;
  }
}
