import {Decoder} from "../src/lib";

interface Struct {
    hello: number,
    world: [number, number]
}

let dec = new Decoder<Struct>({
    hello: "u8",
    world: "[u8; 2]"
});

let buf = new Uint8Array(3);
buf[0] = 10;  // hello = 10
buf[1] = 105; // world[0] = 105
buf[2] = 204; // world[1] = 204
console.log(dec.decode(0n, buf)[0]);