"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/stores/index.js
var stores_exports = {};
__export(stores_exports, {
  StoreConf: () => import_store_conf.StoreConf,
  StoreIndexedDB: () => import_store_indexeddb.StoreIndexedDB,
  StoreMemory: () => import_store_memory.StoreMemory
});
module.exports = __toCommonJS(stores_exports);

// src/stores/memory.js
var import_store_memory = require("@web3-storage/access/stores/store-memory");

// src/stores/indexeddb.js
var import_store_indexeddb = require("@web3-storage/access/stores/store-indexeddb");

// src/stores/conf.js
var import_store_conf = require("@web3-storage/access/stores/store-conf");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StoreConf,
  StoreIndexedDB,
  StoreMemory
});
