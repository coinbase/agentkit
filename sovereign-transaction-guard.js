'use strict';

const { ethers } = require('ethers');

/**
 * SovereignTransactionGuard
 * 
 * Implements a Transactional State Machine to prevent nonce collisions
 * and gas-limit hallucinations in high-concurrency AI agent environments.
 * 
 * Part of the Sovereign Settlement architecture.
 */
class SovereignTransactionGuard {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.pendingNonces = new Map(); // nonce -> { tx, timestamp, status }
    this.lock = false;
  }

  async acquireLock() {
    while (this.lock) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.lock = true;
  }

  releaseLock() {
    this.lock = false;
  }

  /**
   * synchronizedSubmit
   * Ensures atomic nonce increment and gas verification.
   */
  async synchronizedSubmit(txRequest) {
    await this.acquireLock();
    try {
      // 1. Nonce Synchronization
      // Use the max of (on-chain nonce, local tracking nonce) to prevent collisions
      const onChainNonce = await this.wallet.getNonce();
      const trackedNonce = this.getLatestTrackedNonce();
      const nonce = onChainNonce > trackedNonce ? onChainNonce : trackedNonce + 1;

      // 2. Gas Hallucination Guard
      // Agents often estimate gas poorly. We perform a strict dry-run and add a 20% safety buffer.
      const estimatedGas = await this.provider.estimateGas({
        ...txRequest,
        nonce: nonce
      });
      
      const gasLimit = (estimatedGas * 120n) / 100n; // 20% buffer

      // 3. Transaction Construction
      const tx = {
        ...txRequest,
        nonce: nonce,
        gasLimit: gasLimit
      };

      // 4. State Update
      this.pendingNonces.set(nonce, { 
        tx, 
        timestamp: Date.now(), 
        status: 'pending' 
      });

      // 5. Execution
      const response = await this.wallet.sendTransaction(tx);
      
      // Update status to confirmed
      this.pendingNonces.set(nonce, { ...this.pendingNonces.get(nonce), status: 'confirmed' });
      
      return response;
    } catch (error) {
      console.error('[SovereignGuard] Transaction Failure:', error);
      throw error;
    } finally {
      this.releaseLock();
    }
  }

  getLatestTrackedNonce() {
    if (this.pendingNonces.size === 0) return -1;
    return Math.max(...this.pendingNonces.keys());
  }

  /**
   * recoverStaleNonces
   * Cleans up nonces that never confirmed or were skipped.
   */
  async recoverStaleNonces() {
    await this.acquireLock();
    const currentNonce = await this.wallet.getNonce();
    for (const [nonce, data] of this.pendingNonces) {
      if (nonce < currentNonce && data.status === 'pending') {
        this.pendingNonces.delete(nonce);
      }
    }
    this.releaseLock();
  }
}

module.exports = { SovereignTransactionGuard };
