import {Decoder} from "../src/lib";

let dec = new Decoder({
    e: "enum[container[inner: enum[hi[], bye[]]]]"
});

let buffer = new Uint8Array([
    0x00, 0x01
]);

console.log((dec.decode(0n, buffer)[0] as any).e);