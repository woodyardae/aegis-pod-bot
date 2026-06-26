import { type PaymentProvider } from '../payment-provider';
import { type NormalizedBoostagram } from '../boostagram-poller';

const BOOSTERS = ['Dave Jones', 'Adam Curry', 'Geneva Captain', 'Sovereign Listener', 'Star Gazer', 'Wind Chaser'];
const MESSAGES = [
  'Loving the sailing podcast!',
  'Value for Value is the future of media ⚡',
  'Keep up the great work!',
  'Outstanding audio quality, greetings from the boat!',
  'Tipped for the awesome chapters links.',
  'Ahoy! Sent some sats from the high seas.',
];
const APPS = ['Fountain', 'Podverse', 'Truefans', 'Castamatic', 'Curiocaster'];

export class MockProvider implements PaymentProvider {
  public readonly name = 'Mock Provider (Diagnostics)';

  public async pollNewBoosts(feedUrl: string, sinceTimestamp: number): Promise<NormalizedBoostagram[]> {
    // 30% chance to generate a mock boostagram on poll
    if (Math.random() > 0.3) {
      return [];
    }

    const randomBooster = BOOSTERS[Math.floor(Math.random() * BOOSTERS.length)];
    const randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    const randomApp = APPS[Math.floor(Math.random() * APPS.length)];
    const randomAmount = Math.floor(Math.random() * 5000) + 100; // 100 to 5100 sats

    const paymentHash = `mock-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;

    const boost: NormalizedBoostagram = {
      feedUrl,
      paymentHash,
      senderAlias: randomBooster,
      amountSats: randomAmount,
      message: randomMessage,
      appName: randomApp,
      episodeTitle: 'Sailing Around the World — Ep. 12',
      episodeGuid: 'mock-episode-guid-12',
      receivedAt: new Date(),
    };

    console.log(`[MockProvider] Generated mock boost: ${randomAmount} sats from ${randomBooster}`);
    return [boost];
  }
}
