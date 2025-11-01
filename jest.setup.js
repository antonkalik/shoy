require("@testing-library/jest-dom");

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const crypto = require("crypto");

if (!global.crypto) {
  global.crypto = {};
}

global.crypto.subtle = {
  digest: async (algorithm, data) => {
    const hash = crypto.createHash(algorithm.replace("-", ""));
    hash.update(data);
    return hash.digest().buffer;
  },
};
