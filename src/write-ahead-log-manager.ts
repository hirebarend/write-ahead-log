import * as fs from 'fs';
import { WriteAheadLogWriter } from './write-ahead-log';
import { LogEntry } from './log-entry';
import { StringHelper } from './string.helper';
import { WriteAheadLogReader } from './write-ahead-log-reader';

export class WriteAheadLogManager {
  protected index: number = 0;

  protected logSequenceNumber: number = 0;

  protected writeAheadLogWriter: WriteAheadLogWriter | null = null;

  constructor(
    protected directory: string,
    protected name: string,
    protected maxWriteAheadLogSize: number = 50 * 1024 * 1024, // 50 megabytes
  ) {}

  public async close(): Promise<void> {
    if (this.writeAheadLogWriter) {
      await this.writeAheadLogWriter.close();
    }

    this.index = 0;

    this.logSequenceNumber = 0;

    this.writeAheadLogWriter = null;
  }

  public async open(): Promise<void> {
    const filenames: Array<string> = fs.readdirSync(this.directory);

    const writeAheadLogReaders: Array<WriteAheadLogReader> = [];

    for (const filename of filenames) {
      if (filename.startsWith('.')) {
        continue;
      }

      writeAheadLogReaders.push(
        new WriteAheadLogReader(this.directory, filename),
      );
    }

    if (writeAheadLogReaders.length) {
      const item = writeAheadLogReaders.sort((a, b) => b.index - a.index)[0];

      const logEntries: Array<LogEntry> = await item.writeAheadLogReader.read();

      this.index = item.index;

      this.logSequenceNumber = logEntries.length
        ? parseInt(logEntries[logEntries.length - 1].logSequenceNumber)
        : 0;

      this.writeAheadLogWriter = new WriteAheadLogWriter(
        this.directory,
        item.filename,
        this.logSequenceNumber,
      );

      await this.writeAheadLogWriter.open();
    } else {
      this.index = 1;

      this.writeAheadLogWriter = new WriteAheadLogWriter(
        this.directory,
        `${this.name}-${StringHelper.padding(`${this.index}`, 3)}.data`,
      );

      await this.writeAheadLogWriter.open();
    }
  }

  protected async rotate(): Promise<void> {
    if (!this.writeAheadLogWriter) {
      return;
    }

    const writeAheadLogWriter: WriteAheadLogWriter = this.writeAheadLogWriter;

    this.index += 1;

    this.writeAheadLogWriter = new WriteAheadLogWriter(
      this.directory,
      `${this.name}-${StringHelper.padding(`${this.index}`, 3)}.data`,
      this.logSequenceNumber,
    );

    await this.writeAheadLogWriter.open();

    await writeAheadLogWriter.close();
  }

  public async write(data: any): Promise<number> {
    if (!this.writeAheadLogWriter) {
      return 0;
    }

    if ((await this.writeAheadLogWriter.size()) > this.maxWriteAheadLogSize) {
      await this.rotate();
    }

    this.logSequenceNumber = await this.writeAheadLogWriter.write(data);

    return this.logSequenceNumber;
  }
}
