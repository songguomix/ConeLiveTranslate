export interface TTSClient {
  synthesize(text: string): Promise<Uint8Array>
}
