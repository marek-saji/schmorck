/** Chrome Translator API (Chrome 138+) */

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

interface TranslatorCreateOptions extends TranslatorOptions {
  monitor?(m: TranslatorDownloadMonitor): void;
}

interface TranslatorDownloadMonitor {
  addEventListener(
    event: 'downloadprogress',
    handler: (e: ProgressEvent) => void,
  ): void;
}

interface Translator {
  translate(text: string): Promise<string>;
  translateStreaming(text: string): AsyncIterable<string>;
}

interface TranslatorConstructor {
  availability(options: TranslatorOptions): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(options: TranslatorCreateOptions): Promise<Translator>;
}

declare const Translator: TranslatorConstructor;
