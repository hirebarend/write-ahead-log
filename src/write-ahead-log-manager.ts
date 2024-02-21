import * as fs from 'fs';
import { WriteAheadLog } from './write-ahead-log';
import { LogEntry } from './log-entry';
import { StringHelper } from './string.helper';

export class WriteAheadLogManager {
  protected index: number = 0;

  protected logSequenceNumber: number = 0;

  protected writeAheadLog: WriteAheadLog | null = null;

  constructor(
    protected directory: string,
    protected name: string,
    protected maxWriteAheadLogSize: number = 50 * 1024 * 1024, // 50 megabytes
  ) {}

  public async close(): Promise<void> {
    if (this.writeAheadLog) {
      await this.writeAheadLog.close();
    }

    this.index = 0;

    this.logSequenceNumber = 0;

    this.writeAheadLog = null;
  }

  protected static getIndexFromFilename(filename: string): number {
    const regExp: RegExp = new RegExp(/^.+\-(\d{3})\.data$/);

    const regExpExecArray: RegExpExecArray | null = regExp.exec(filename);

    if (!regExpExecArray) {
      throw new Error(`unable to get index from filename: ${filename}`);
    }

    return parseInt(regExpExecArray[1]);
  }

  public async open(): Promise<void> {
    const filenames: Array<string> = fs.readdirSync(this.directory);

    for (const filename of filenames) {
      if (filename.startsWith('.')) {
        continue;
      }

      const index: number = WriteAheadLogManager.getIndexFromFilename(filename);

      if (this.index === null || this.index < index) {
        this.index = index;

        this.writeAheadLog = new WriteAheadLog(this.directory, filename, 0);
      }
    }

    if (this.writeAheadLog) {
      const logEntries: Array<LogEntry> = await this.writeAheadLog.read();

      this.logSequenceNumber = logEntries.length
        ? parseInt(logEntries[logEntries.length - 1].logSequenceNumber)
        : 0;

      this.writeAheadLog.setLogSequenceNumber(this.logSequenceNumber);

      await this.writeAheadLog.open();

      console.log(this.logSequenceNumber); // TODO
    } else {
      this.index = 1;

      this.writeAheadLog = new WriteAheadLog(
        this.directory,
        `${this.name}-${StringHelper.padding(`${this.index}`, 3)}.data`,
      );

      await this.writeAheadLog.open();
    }
  }

  protected async rotate(): Promise<void> {
    if (!this.writeAheadLog) {
      return;
    }

    const writeAheadLog: WriteAheadLog = this.writeAheadLog;

    this.index += 1;

    this.writeAheadLog = new WriteAheadLog(
      this.directory,
      `${this.name}-${StringHelper.padding(`${this.index}`, 3)}.data`,
      this.logSequenceNumber,
    );

    await this.writeAheadLog.open();

    await writeAheadLog.close();
  }

  public async write(data: any): Promise<number> {
    if (!this.writeAheadLog) {
      return 0;
    }

    if ((await this.writeAheadLog.size()) > this.maxWriteAheadLogSize) {
      await this.rotate();
    }

    this.logSequenceNumber = await this.writeAheadLog.write(data);

    return this.logSequenceNumber;
  }
}
