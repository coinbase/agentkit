"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/proof.js
var proof_exports = {};
__export(proof_exports, {
  parse: () => parse2
});
module.exports = __toCommonJS(proof_exports);
var import_delegation = require("@ucanto/core/delegation");
var CAR = __toESM(require("@ucanto/transport/car"), 1);
var import_car = require("@ipld/car");
var Link = __toESM(require("multiformats/link"), 1);
var import_base64 = require("multiformats/bases/base64");
var import_identity = require("multiformats/hashes/identity");
var parse2 = async (str) => {
  try {
    const cid = Link.parse(str, import_base64.base64);
    if (cid.code !== CAR.codec.code) {
      throw new Error(`non CAR codec found: 0x${cid.code.toString(16)}`);
    }
    if (cid.multihash.code !== import_identity.identity.code) {
      throw new Error(
        `non identity multihash: 0x${cid.multihash.code.toString(16)}`
      );
    }
    try {
      const { ok, error } = await (0, import_delegation.extract)(cid.multihash.digest);
      if (error)
        throw new Error("failed to extract delegation", { cause: error });
      return ok;
    } catch {
      return legacyExtract(cid.multihash.digest);
    }
  } catch {
    return legacyExtract(import_base64.base64.baseDecode(str));
  }
};
var legacyExtract = async (bytes) => {
  const blocks = [];
  const reader = await import_car.CarReader.fromBytes(bytes);
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return (0, import_delegation.importDAG)(blocks);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parse
});
