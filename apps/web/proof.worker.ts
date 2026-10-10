import { prove } from '../../packages/crypto/prove';
self.onmessage = async (event) => {
  try {
    const { secret, snapshot, envelope } = event.data;
    self.postMessage({ submission: await prove(secret, snapshot, envelope, true) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Proof generation failed.',
    });
  }
};
