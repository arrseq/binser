import {Decoder} from "../src/lib";

let dec = new Decoder({
    e: "enum A[virtual: bool, b: u8], B[]",
    som: "u8"
});

let buffer = new Uint8Array([0, 1, 50, 50]);
console.log(dec.encode({
    e: {
        "A": { virtual: true, b: 10 }
    },
    som: 50
}));