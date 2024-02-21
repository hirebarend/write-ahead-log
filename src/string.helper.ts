export class StringHelper {
  public static padding(str: string, n: number): string {
    while (str.length < n) {
      str = `0${str}`;
    }

    return str;
  }
}
