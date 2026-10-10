import { prove } from '../../packages/crypto/prove';
import { provePublicSignal } from '../../packages/crypto/prove';
self.onmessage = async (event) => {
  try {
    const { secret, snapshot, envelope, publicSignal } = event.data;
    if (publicSignal) {
      self.postMessage({ proof: await provePublicSignal(secret, snapshot, publicSignal, true) });
    } else {
      self.postMessage({ submission: await prove(secret, snapshot, envelope, true) });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Proof generation failed.',
    });
  }
};
