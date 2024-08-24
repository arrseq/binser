import {Decoder} from "../src/lib";
import {Size} from "../src/type";

let dec = new Decoder({
    // aaa: "bool",
    hello: "f32",
    // var: "[u8; 2]"
});

let buf = new Uint8Array(4);
buf[0] = 0b11000011; // 0x00
buf[1] = 0b11110101; // 0x00
buf[2] = 0b01001000; // 0x00
buf[3] = 0b01000000; // 0x3F
console.log(dec.decode(0n, buf));