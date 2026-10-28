export interface Translator {
  translate(text: string, onPartial?: (partial: string) => void): Promise<string>
}
