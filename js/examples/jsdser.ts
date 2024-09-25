import {Decoder} from "../src/lib";

let dec = new Decoder({
    e: "[u8; x:10]"
});

let buffer = new Uint8Array([
    3, 0, 0, 0, 0, 0, 0, 0, // length = 1
    0, 255, 127             // data = [0, 255, 127]
]);

console.log(dec.decode(0n, buffer));