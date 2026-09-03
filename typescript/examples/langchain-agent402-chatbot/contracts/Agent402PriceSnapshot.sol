// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Agent402PriceSnapshot
/// @notice A price an agent bought over x402 from agent402.tools, pinned on
///         chain by the wallet that paid for it. The x402 settlement
///         transaction that bought the data is stored beside the data, so the
///         purchase and the deployment reference each other on the same chain.
contract Agent402PriceSnapshot {
    /// @notice The wallet that paid for the data and deployed this contract.
    address public immutable buyer;
    /// @notice Asset symbol, e.g. "ETH".
    string public symbol;
    /// @notice Quote currency, e.g. "usd".
    string public currency;
    /// @notice Price in micro-units of the quote currency (6 decimals).
    uint256 public immutable priceMicro;
    /// @notice The data source's own timestamp for the price (unix seconds).
    uint64 public immutable observedAt;
    /// @notice Where the data came from, e.g. "agent402.tools GET /api/crypto-price".
    string public source;
    /// @notice The Base transaction in which the x402 payment for the data settled.
    bytes32 public immutable paymentTx;

    constructor(
        string memory symbol_,
        string memory currency_,
        uint256 priceMicro_,
        uint64 observedAt_,
        string memory source_,
        bytes32 paymentTx_
    ) {
        buyer = msg.sender;
        symbol = symbol_;
        currency = currency_;
        priceMicro = priceMicro_;
        observedAt = observedAt_;
        source = source_;
        paymentTx = paymentTx_;
    }

    /// @notice The whole snapshot in one read.
    function snapshot()
        external
        view
        returns (address, string memory, string memory, uint256, uint64, string memory, bytes32)
    {
        return (buyer, symbol, currency, priceMicro, observedAt, source, paymentTx);
    }
}
