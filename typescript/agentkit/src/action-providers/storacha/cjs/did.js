"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
    for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
    if (from2 && typeof from2 === "object" || typeof from2 === "function") {
        for (let key of __getOwnPropNames(from2))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
    }
    return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/did.js
var did_exports = {};
__export(did_exports, {
    BLS12381G1: () => BLS12381G1,
    BLS12381G2: () => BLS12381G2,
    DID_CORE: () => DID_CORE,
    ED25519: () => ED25519,
    P256: () => P256,
    P384: () => P384,
    P521: () => P521,
    RSA: () => RSA,
    SECP256K1: () => SECP256K1,
    decode: () => decode2,
    encode: () => encode2,
    format: () => format,
    from: () => from,
    parse: () => parse
});
module.exports = __toCommonJS(did_exports);
var import_base58 = require("multiformats/bases/base58");
var import_multiformats = require("multiformats");

// src/utf8.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var encode = (text) => encoder.encode(text);
var decode = (bytes) => decoder.decode(bytes);

// src/did.js
var DID_PREFIX = "did:";
var DID_PREFIX_SIZE = DID_PREFIX.length;
var DID_KEY_PREFIX = `did:key:`;
var DID_KEY_PREFIX_SIZE = DID_KEY_PREFIX.length;
var ED25519 = 237;
var RSA = 4613;
var P256 = 4608;
var P384 = 4609;
var P521 = 4610;
var SECP256K1 = 231;
var BLS12381G1 = 234;
var BLS12381G2 = 235;
var DID_CORE = 3357;
var METHOD_OFFSET = import_multiformats.varint.encodingLength(DID_CORE);
var parse = (did) => {
    if (!did.startsWith(DID_PREFIX)) {
        throw new RangeError(`Invalid DID "${did}", must start with 'did:'`);
    } else if (did.startsWith(DID_KEY_PREFIX)) {
        const key = import_base58.base58btc.decode(did.slice(DID_KEY_PREFIX_SIZE));
        return decode2(key);
    } else {
        const suffix = encode(did.slice(DID_PREFIX_SIZE));
        const bytes = new Uint8Array(suffix.byteLength + METHOD_OFFSET);
        import_multiformats.varint.encodeTo(DID_CORE, bytes);
        bytes.set(suffix, METHOD_OFFSET);
        return new DID(bytes);
    }
};
var format = (id) => id.did();
var from = (principal) => {
    if (principal instanceof DID) {
        return principal;
    } else if (principal instanceof Uint8Array) {
        return decode2(principal);
    } else if (typeof principal === "string") {
        return parse(principal);
    } else {
        return parse(principal.did());
    }
};
var decode2 = (bytes) => {
    const [code] = import_multiformats.varint.decode(bytes);
    const { buffer, byteOffset, byteLength } = bytes;
    switch (code) {
        case P256:
            if (bytes.length > 35) {
                throw new RangeError(`Only p256-pub compressed is supported.`);
            }
        case ED25519:
        case RSA:
        case P384:
        case P521:
        case BLS12381G1:
        case BLS12381G2:
        case SECP256K1:
            return (
                /** @type {UCAN.PrincipalView<any>} */
                new DIDKey(buffer, byteOffset, byteLength)
            );
        case DID_CORE:
            return new DID(buffer, byteOffset, byteLength);
        default:
            throw new RangeError(
                `Unsupported DID encoding, unknown multicode 0x${code.toString(16)}.`
            );
    }
};
var encode2 = (principal) => parse(principal.did());
var DID = class extends Uint8Array {
    /**
     * @returns {ID}
     */
    did() {
        const bytes = new Uint8Array(this.buffer, this.byteOffset + METHOD_OFFSET);
        return (
            /** @type {ID} */
            `did:${decode(bytes)}`
        );
    }
    toJSON() {
        return this.did();
    }
};
var DIDKey = class extends DID {
    /**
     * @return {`did:key:${string}`}
     */
    did() {
        return `did:key:${import_base58.base58btc.encode(this)}`;
    }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
    BLS12381G1,
    BLS12381G2,
    DID_CORE,
    ED25519,
    P256,
    P384,
    P521,
    RSA,
    SECP256K1,
    decode,
    encode,
    format,
    from,
    parse
});
