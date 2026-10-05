declare module "web-push" {
  export interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
  }
  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
    payload?: string | Buffer,
    options?: { TTL?: number }
  ): Promise<SendResult>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
