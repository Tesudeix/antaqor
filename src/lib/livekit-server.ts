// LiveKit integration paused. This stub keeps imports compiling.
export interface TokenInput {
  room: string;
  identity: string;
  name: string;
  isHost: boolean;
}
export async function issueLiveKitToken(_input: TokenInput): Promise<string> {
  throw new Error("LiveKit not configured");
}
