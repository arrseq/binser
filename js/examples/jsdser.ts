import {Decoder} from "../src/lib";
import {parse_ktp, parse_object, parse_type, Size} from "../src/type";

let dec = new Decoder({
    hello: "u8",
    world: "[u8; 2]"
});

let buf = new Uint8Array(3);
buf[0] = 10; // hello = 10
buf[1] = 105; // world[0] = 105
buf[2] = 204; // world[1] = 204
console.log(dec.decode(0n, buf)[0]);

function replaceBigInts(obj: any): any {
    if (typeof obj === 'bigint') {
        return Number(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => replaceBigInts(item));
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, replaceBigInts(value)])
        );
    } else {
        return obj;
    }
}

function print_o(obj: any) {
    console.log(JSON.stringify(replaceBigInts(obj), null, 4));
}

// print_o(parse_type("enum A[hi: bool, bye: u8], B[]"));