export interface STTClient {
  transcribe(wavBytes: Uint8Array): Promise<string>
}
