export class Mutex {
  protected _value: boolean = false;

  public async acquire(): Promise<void> {
    while (this._value) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this._value = true;
  }

  public async release(): Promise<void> {
    this._value = false;
  }
}
